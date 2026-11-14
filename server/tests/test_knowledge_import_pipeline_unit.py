"""Unit tests for the Excel knowledge-upload pipeline (no network, no database).

Covers the root causes behind slow / crashing large imports:

1. Parsing -> schema mapping -> quality batches on a real 5k+ row XLSX, fully local.
2. Persistence issues O(1) statements per batch (multi-row INSERT, no per-row UPDATE)
   and retries transient connection drops on a fresh session.
3. Stuck-job recovery never hijacks a job whose worker is alive (lock held), and
   requeues dead jobs to a state the pipeline can legally restart from.
4. Long-running stream messages get their PEL idle time reset (no XAUTOCLAIM duplicate).
5. The local deterministic embedder is vectorised, equivalent, and off the event loop.

Run:  python -m pytest tests/test_knowledge_import_pipeline_unit.py -q
Set KNOWLEDGE_TEST_XLSX=<path> to also run against a real export file.
"""

from __future__ import annotations

import asyncio
import os
import random
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import Any, List
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.sql.dml import Insert, Update
from sqlalchemy.sql.selectable import Select

from app.contracts.data_quality import BatchQualityResultDTO, NormalizedRecordDTO, QualityRowStatus
from app.contracts.persistence import PersistenceBatchConfig
from app.models.knowledge import ImportJobStage, ImportJobStatus

TENANT = "org_unit_test"
CATEGORY = "products_services"


# ---------------------------------------------------------------------------
# Fakes
# ---------------------------------------------------------------------------


class FakeResult:
    def __init__(self, rows: List[Any] | None = None):
        self._rows = rows or []

    def __iter__(self):
        return iter(self._rows)

    def scalars(self):
        return SimpleNamespace(all=lambda: list(self._rows), first=lambda: (self._rows or [None])[0])

    def scalar_one_or_none(self):
        return self._rows[0] if self._rows else None


class FakeSession:
    """Records statements; optionally fails the first N write attempts."""

    def __init__(self, fail_with: BaseException | None = None, select_results: List[List[Any]] | None = None):
        self.fail_with = fail_with
        self.select_results = list(select_results or [])
        self.statements: List[Any] = []
        self.param_sets: List[Any] = []
        self.commits = 0
        self.rollbacks = 0

    async def execute(self, stmt, params=None):
        self.statements.append(stmt)
        self.param_sets.append(params)
        if self.fail_with is not None and isinstance(stmt, (Insert, Update)):
            raise self.fail_with
        if isinstance(stmt, Select):
            return FakeResult(self.select_results.pop(0) if self.select_results else [])
        return FakeResult()

    async def commit(self):
        self.commits += 1

    async def rollback(self):
        self.rollbacks += 1

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


def _record(row: int, key: str | None = None, **overrides) -> NormalizedRecordDTO:
    data = {
        "name": f"Product {row}",
        "description": f"Description for product {row}",
        "price": 100 + row,
        "currency": "INR",
    }
    return NormalizedRecordDTO(
        row_number=row,
        status=QualityRowStatus.VALID,
        organization_id=TENANT,
        category=CATEGORY,
        identity_key=f"org:{TENANT}:cat:{CATEGORY}:ext:{key or f'sku-{row}'}",
        canonical_data=data,
        custom_attributes={"brand": "Acme"},
        **overrides,
    )


def _batch(records: List[NormalizedRecordDTO], index: int = 0) -> BatchQualityResultDTO:
    return BatchQualityResultDTO(
        batch_index=index,
        total_rows=len(records),
        valid_count=len(records),
        warning_count=0,
        invalid_count=0,
        duplicate_count=0,
        conflict_count=0,
        records=records,
    )


def _persistence():
    from app.services.knowledge_persistence import KnowledgePersistenceService

    return KnowledgePersistenceService(
        tenant_id=TENANT,
        source_id="ks_unit",
        category=CATEGORY,
        job_id="ij_unit",
        created_by_user_id="usr_unit",
        config=PersistenceBatchConfig(batch_size=500),
    )


# ---------------------------------------------------------------------------
# 1. Persistence: set-based writes, retry, idempotency
# ---------------------------------------------------------------------------


async def test_persist_batch_uses_constant_statement_count_for_500_new_rows():
    svc = _persistence()
    db = FakeSession()
    result = await svc.persist_batch(db, _batch([_record(i) for i in range(1, 501)]))

    assert result.inserted_count == 500
    assert result.failed_count == 0
    # 1 SELECT existing + 1 multi-row INSERT items + 1 multi-row INSERT versions.
    # Previously: ORM flushes + savepoint + a 500-row UPDATE of current_version_id.
    assert len(db.statements) == 3
    assert db.commits == 1
    assert not any(isinstance(s, Update) for s in db.statements)

    items = db.param_sets[1]
    versions = db.param_sets[2]
    assert len(items) == 500 and len(versions) == 500
    by_id = {v["id"]: v for v in versions}
    # New items are inserted already pointing at their first version.
    for item in items:
        v = by_id[item["current_version_id"]]
        assert v["knowledge_item_id"] == item["id"]
        assert v["version_number"] == 1
        assert v["tenant_id"] == TENANT
        assert v["canonical_data"]["custom_attributes"] == {"brand": "Acme"}


async def test_persist_batch_with_retry_recovers_from_dropped_connection():
    svc = _persistence()
    sessions: List[FakeSession] = []

    class ConnectionDoesNotExistError(Exception):
        pass

    def factory():
        # First session dies mid-write exactly like the production log; second succeeds.
        s = FakeSession(
            fail_with=ConnectionDoesNotExistError("connection was closed in the middle of operation")
            if not sessions
            else None
        )
        sessions.append(s)
        return s

    result = await svc.persist_batch_with_retry(factory, _batch([_record(i) for i in range(1, 51)]), base_delay_seconds=0)

    assert len(sessions) == 2
    assert sessions[0].rollbacks == 1
    assert result.inserted_count == 50
    assert result.failed_count == 0
    summary = svc.get_summary()
    assert summary.total_inserted == 50
    assert summary.batches_committed == 1
    assert summary.batches_rolled_back == 0


async def test_persist_batch_with_retry_does_not_retry_permanent_errors():
    svc = _persistence()
    sessions: List[FakeSession] = []

    def factory():
        s = FakeSession(fail_with=ValueError("duplicate key value violates unique constraint"))
        sessions.append(s)
        return s

    result = await svc.persist_batch_with_retry(factory, _batch([_record(i) for i in range(1, 11)]), base_delay_seconds=0)
    assert len(sessions) == 1
    assert result.failed_count == 10
    assert svc.get_summary().batches_rolled_back == 1


async def test_in_batch_duplicate_identity_keys_do_not_roll_back_whole_batch():
    svc = _persistence()
    db = FakeSession()
    recs = [_record(1, key="same"), _record(2, key="same"), _record(3)]
    result = await svc.persist_batch(db, _batch(recs))
    assert result.inserted_count == 2
    assert result.duplicate_count == 1
    assert len(db.param_sets[1]) == 2


async def test_reimport_of_identical_rows_is_unchanged_and_writes_nothing():
    from app.services.knowledge_persistence import _build_version_payload

    svc = _persistence()
    recs = [_record(i) for i in range(1, 6)]
    existing_rows = [
        SimpleNamespace(id=f"ki_{i}", external_identity_key=f"sku-{i}", tags=None) for i in range(1, 6)
    ]
    versions = []
    for i, rec in enumerate(recs, start=1):
        _, canonical, eff_from, eff_until = _build_version_payload(rec)
        versions.append(SimpleNamespace(
            id=f"kv_{i}", knowledge_item_id=f"ki_{i}", version_number=1,
            canonical_data=canonical, effective_from=eff_from, effective_until=eff_until,
        ))
    db = FakeSession(select_results=[existing_rows, versions])
    result = await svc.persist_batch(db, _batch(recs))
    assert result.unchanged_count == 5
    assert result.inserted_count == 0 and result.versioned_count == 0
    assert not any(isinstance(s, (Insert, Update)) for s in db.statements)


async def test_reimport_of_changed_rows_archives_and_versions_in_bulk():
    svc = _persistence()
    recs = [_record(i) for i in range(1, 4)]
    existing_rows = [SimpleNamespace(id=f"ki_{i}", external_identity_key=f"sku-{i}", tags=None) for i in range(1, 4)]
    versions = [
        SimpleNamespace(id=f"kv_{i}", knowledge_item_id=f"ki_{i}", version_number=2,
                        canonical_data={"name": "old"}, effective_from=None, effective_until=None)
        for i in range(1, 4)
    ]
    db = FakeSession(select_results=[existing_rows, versions])
    result = await svc.persist_batch(db, _batch(recs))
    assert result.versioned_count == 3
    updates = [p for s, p in zip(db.statements, db.param_sets) if isinstance(s, Update)]
    # One set-based archive UPDATE + one executemany pointer UPDATE.
    assert len(updates) == 2
    inserts = [p for s, p in zip(db.statements, db.param_sets) if isinstance(s, Insert)]
    assert len(inserts) == 1 and all(v["version_number"] == 3 for v in inserts[0])


def test_transient_error_classification():
    from app.services.knowledge_persistence import _is_transient_db_error

    assert _is_transient_db_error(ConnectionResetError())
    assert _is_transient_db_error(Exception("connection was closed in the middle of operation"))
    assert not _is_transient_db_error(ValueError("invalid input syntax for type numeric"))


# ---------------------------------------------------------------------------
# 2. Stuck-job recovery must not hijack live jobs
# ---------------------------------------------------------------------------


def _job(job_id: str, status: ImportJobStatus, **kw):
    now = datetime.now(timezone.utc)
    base = dict(
        id=job_id, tenant_id=TENANT, source_id="ks_unit", dataset_name="d", file_type="xlsx",
        file_uri="storage://local/x.xlsx", file_size_bytes=1, idempotency_key=None,
        status=status.value, current_stage=status.value, worker_id="w-1",
        last_heartbeat_at=now - timedelta(minutes=5), retry_count=0, max_retries=3,
        error_summary=None, completed_at=None, updated_at=now - timedelta(minutes=5),
    )
    base.update(kw)
    return SimpleNamespace(**base)


async def test_recovery_skips_jobs_whose_worker_still_holds_the_lock(monkeypatch):
    from app.services import knowledge_import as ki

    live = _job("ij_live", ImportJobStatus.IMPORTING)
    db = FakeSession(select_results=[[live], []])
    redis = SimpleNamespace(exists=AsyncMock(return_value=1), delete=AsyncMock())
    monkeypatch.setattr(ki, "redis_manager", SimpleNamespace(client=redis))
    publish = AsyncMock()
    monkeypatch.setattr(ki.event_bus, "publish", publish)

    recovered = await ki.knowledge_import_service.recover_stuck_jobs(db)

    assert recovered == []
    assert live.status == ImportJobStatus.IMPORTING.value
    assert live.worker_id == "w-1"
    assert db.rollbacks == 1 and db.commits == 0
    publish.assert_not_called()


async def test_recovery_requeues_dead_job_to_restartable_state(monkeypatch):
    from app.models.knowledge import VALID_JOB_TRANSITIONS
    from app.services import knowledge_import as ki

    dead = _job("ij_dead", ImportJobStatus.IMPORTING)
    db = FakeSession(select_results=[[dead], []])
    redis = SimpleNamespace(exists=AsyncMock(return_value=0), delete=AsyncMock())
    monkeypatch.setattr(ki, "redis_manager", SimpleNamespace(client=redis))
    publish = AsyncMock(return_value="1-0")
    monkeypatch.setattr(ki.event_bus, "publish", publish)

    recovered = await ki.knowledge_import_service.recover_stuck_jobs(db)

    assert recovered == ["ij_dead"]
    assert dead.status == ImportJobStatus.UPLOADED.value
    assert dead.current_stage == ImportJobStage.UPLOADED.value
    assert dead.worker_id is None and dead.retry_count == 1
    # The worker's first transition must be legal from the recovered state.
    assert ImportJobStatus.PARSING in VALID_JOB_TRANSITIONS[ImportJobStatus.UPLOADED]
    assert db.commits == 1
    publish.assert_awaited_once()


def test_recovery_threshold_is_far_above_heartbeat_interval():
    from app.services.knowledge_import import KnowledgeImportService

    # Heartbeat runs every 5s; the old 20s threshold hijacked live imports.
    assert KnowledgeImportService.STUCK_JOB_STALE_SECONDS >= 60


# ---------------------------------------------------------------------------
# 3. Stream PEL keepalive prevents duplicate redelivery
# ---------------------------------------------------------------------------


async def test_long_running_message_pel_idle_is_reset(monkeypatch):
    from app.core.messaging import DomainEvent
    from app.workers import base as base_mod

    xclaim = AsyncMock()
    monkeypatch.setattr(base_mod, "redis_manager", SimpleNamespace(client=SimpleNamespace(xclaim=xclaim)))
    ack = AsyncMock()
    monkeypatch.setattr(base_mod.event_bus, "acknowledge", ack)

    class SlowWorker(base_mod.BaseWorker):
        PEL_KEEPALIVE_SECONDS = 0.02

        async def process_event(self, event):
            await asyncio.sleep(0.15)

    w = SlowWorker("slow", "knowledge_import_events", "g")
    w._semaphore = asyncio.Semaphore(1)
    await w._handle_message("1-0", DomainEvent(event_type="t", tenant_id=TENANT, payload={}))

    assert xclaim.await_count >= 3
    kwargs = xclaim.await_args.kwargs
    assert kwargs["min_idle_time"] == 0 and kwargs["justid"] is True
    assert kwargs["message_ids"] == ["1-0"]
    ack.assert_awaited_once()
    calls_after = xclaim.await_count
    await asyncio.sleep(0.06)
    assert xclaim.await_count == calls_after  # keepalive stopped after completion


async def test_distributed_lock_extend_only_when_owned(monkeypatch):
    from app.services import gmail_sync

    evals = AsyncMock(return_value=1)
    monkeypatch.setattr(gmail_sync, "redis_manager", SimpleNamespace(client=SimpleNamespace(eval=evals)))
    lock = gmail_sync.DistributedLock("lock:import_job:x", ttl_seconds=60)
    assert await lock.extend() is False  # not acquired
    evals.assert_not_called()
    lock._acquired = True
    assert await lock.extend() is True
    assert evals.await_args.args[-1] == 60


# ---------------------------------------------------------------------------
# 4. Local embedder
# ---------------------------------------------------------------------------


def test_local_embedder_vectorised_matches_reference():
    from app.services.embedding_providers import LocalDeterministicEmbeddingProvider

    p = LocalDeterministicEmbeddingProvider()
    text = "name: Inverter Split AC 1.5 Ton; brand: Samsung; price: 42999.00; warranty: 1 year"
    ref = p._generate_vector_reference(text.lower().split())
    new = p._generate_vector(text)
    assert len(new) == 1024
    assert max(abs(a - b) for a, b in zip(ref, new)) < 1e-12


async def test_local_embedder_batch_is_fast_and_off_loop():
    from app.contracts.embeddings import EmbeddingBatchRequest, EmbeddingRequestItem
    from app.services.embedding_providers import LocalDeterministicEmbeddingProvider

    p = LocalDeterministicEmbeddingProvider()
    rnd = random.Random(7)
    words = [f"w{i}" for i in range(3000)]
    items = [
        EmbeddingRequestItem(item_id=str(i), text=" ".join(rnd.choices(words, k=60)), content_hash=str(i))
        for i in range(500)
    ]
    ticks = 0

    async def ticker():
        nonlocal ticks
        while True:
            await asyncio.sleep(0.005)
            ticks += 1

    t = asyncio.create_task(ticker())
    t0 = time.perf_counter()
    res = await p.embed_batch(EmbeddingBatchRequest(items=items))
    dt = time.perf_counter() - t0
    t.cancel()
    assert len(res.results) == 500
    assert dt < 5.0, f"500 chunks took {dt:.2f}s"
    assert ticks > 0, "event loop was blocked during embedding"


# ---------------------------------------------------------------------------
# 5. End-to-end local pipeline on an XLSX (parse -> map -> quality -> persist plan)
# ---------------------------------------------------------------------------


def _write_products_xlsx(path: Path, rows: int) -> None:
    from openpyxl import Workbook

    wb = Workbook(write_only=True)
    ws = wb.create_sheet("Products")
    ws.append([
        "SKU", "Product Name", "Category", "Brand", "Description", "MRP", "Selling Price",
        "Currency", "Stock Quantity", "Warranty", "Model Number", "Color", "Weight (kg)", "Status",
    ])
    for i in range(1, rows + 1):
        ws.append([
            f"SKU-{i:05d}", f"Appliance {i}", "Air Conditioner" if i % 2 else "Refrigerator",
            "Acme" if i % 3 else "Zen", f"Energy efficient appliance number {i}", 50000 + i,
            45000 + i, "INR", i % 50, "1 year", f"MDL{i}", "White", 30.5, "Active",
        ])
    wb.save(path)


class _IndexHarness:
    """Patches Qdrant + DB status updates so index_documents runs fully in memory."""

    def __init__(self, monkeypatch):
        from app.services import knowledge_reconciliation as kr

        self.points = 0
        self.status_updates = 0
        self.cache_reads = AsyncMock(return_value={})
        self.cache_writes = AsyncMock()
        harness = self

        async def upsert(tenant_id, vector_tuples, wait=False):
            assert all(len(v) == 1024 for _, v in vector_tuples)
            assert all(p.organization_id == TENANT for p, _ in vector_tuples)
            harness.points += len(vector_tuples)
            return [p.chunk_id for p, _ in vector_tuples]

        class _DB(FakeSession):
            async def execute(self, stmt, params=None):
                harness.status_updates += 1
                return await super().execute(stmt, params)

        monkeypatch.setattr(kr.qdrant_indexer_service, "upsert_version_vectors", upsert)
        monkeypatch.setattr(kr, "db_manager", SimpleNamespace(session_factory=_DB))
        svc = kr.KnowledgeReconciliationService()
        # Unit tests never call external APIs, whatever EMBEDDING_PROVIDER .env selects.
        from app.services.embedding_providers import LocalDeterministicEmbeddingProvider

        svc.embedding_service.provider = LocalDeterministicEmbeddingProvider()
        monkeypatch.setattr(svc.embedding_service.cache, "get_batch", self.cache_reads)
        monkeypatch.setattr(svc.embedding_service.cache, "put_batch", self.cache_writes)
        self.service = svc


async def _run_local_pipeline(xlsx: Path, expected_min_rows: int, monkeypatch=None):
    """Parse -> map -> quality -> persist+project (fake DB) -> embed -> Qdrant (fake).

    Mirrors the worker's streaming IMPORTING stage, minus network I/O.
    """
    from app.services.column_mapping_service import column_mapping_service
    from app.services.data_quality_pipeline import DataQualityPipeline
    from app.services.dataset_profiler import DatasetProfiler

    harness = _IndexHarness(monkeypatch) if monkeypatch is not None else None
    timings = {}
    t0 = time.perf_counter()
    profile = await asyncio.to_thread(DatasetProfiler().profile_file, xlsx, "xlsx")
    timings["parse"] = time.perf_counter() - t0
    assert profile.quality_summary.total_rows >= expected_min_rows

    t0 = time.perf_counter()
    plan = await column_mapping_service.detect_and_compile_mapping(
        db=FakeSession(), tenant_id=TENANT, category=CATEGORY, profile=profile, source_type="xlsx"
    )
    timings["map"] = time.perf_counter() - t0
    assert plan.mapped_count > 0, "no columns mapped"

    pipeline = DataQualityPipeline(
        tenant_id=TENANT, category=CATEGORY, mapping_plan=plan, custom_attributes=[], batch_size=500
    )
    svc = _persistence()
    gen = pipeline.process_file_batches(str(xlsx), "xlsx")
    sessions: List[FakeSession] = []

    def factory():
        s = FakeSession()
        sessions.append(s)
        return s

    t0 = time.perf_counter()
    total_records = 0
    batches = 0
    indexed_versions = 0
    while True:
        batch = await asyncio.to_thread(next, gen, None)
        if batch is None:
            break
        batches += 1
        total_records += len(batch.records)
        res, indexable = await svc.persist_and_project_batch(factory, batch)
        assert res.failed_count == 0
        assert len(indexable) == res.inserted_count + res.versioned_count
        if harness is not None:
            await harness.service.index_documents(TENANT, indexable)
        indexed_versions += len(indexable)
    timings["quality+persist+project+embed"] = time.perf_counter() - t0

    summary = svc.get_summary()
    assert total_records >= expected_min_rows
    assert summary.total_inserted + summary.total_duplicates + summary.total_conflicts + summary.total_invalid >= expected_min_rows
    # Constant statements per batch: SELECT + INSERT items + INSERT versions + INSERT chunks.
    assert sum(len(s.statements) for s in sessions) <= batches * 4
    if harness is not None:
        assert harness.points >= indexed_versions  # >= 1 chunk per version
        assert harness.status_updates == batches  # one bulk UPDATE per batch
        harness.cache_reads.assert_not_called()  # local embeddings never round-trip to Redis
        harness.cache_writes.assert_not_called()
        timings["vectors"] = harness.points
    return profile, plan, summary, timings


async def test_persist_and_project_writes_projected_versions_in_one_txn():
    svc = _persistence()
    assert svc.persist_semantic_chunks is False  # default: no duplicate chunk rows
    db = FakeSession()
    res, indexable = await svc.persist_and_project_batch(lambda: db, _batch([_record(i) for i in range(1, 101)]))
    assert res.inserted_count == 100 and len(indexable) == 100
    inserts = [(s, p) for s, p in zip(db.statements, db.param_sets) if isinstance(s, Insert)]
    assert [s.table.name for s, _ in inserts] == ["knowledge_items", "knowledge_versions"]
    assert db.commits == 1
    versions = inserts[1][1]
    assert all(v["projection_status"] == "projected" and v["chunk_count"] >= 1 for v in versions)
    assert all(v["semantic_status"] == "pending" for v in versions)  # synced only after Qdrant upsert
    item, version, doc = indexable[0]
    assert version.content_text == doc.full_text
    assert sum(len(d.chunks) for _, _, d in indexable) >= 100  # vectors still built from memory


async def test_persist_and_project_can_also_write_chunk_rows():
    svc = _persistence()
    svc.persist_semantic_chunks = True
    db = FakeSession()
    await svc.persist_and_project_batch(lambda: db, _batch([_record(i) for i in range(1, 51)]))
    inserts = [(s, p) for s, p in zip(db.statements, db.param_sets) if isinstance(s, Insert)]
    assert [s.table.name for s, _ in inserts] == ["knowledge_items", "knowledge_versions", "knowledge_semantic_chunks"]
    versions, chunks = inserts[1][1], inserts[2][1]
    assert len(chunks) == sum(v["chunk_count"] for v in versions)
    assert {c["knowledge_version_id"] for c in chunks} == {v["id"] for v in versions}


def test_copy_rows_fill_required_defaults_and_serialise_json():
    from app.models.knowledge import KnowledgeVersion
    from app.services.knowledge_persistence import _copy_columns, _copy_value

    rows = [{"id": "kv_1", "tenant_id": TENANT, "knowledge_item_id": "ki_1", "canonical_data": {"a": 1}}]
    cols = _copy_columns(KnowledgeVersion.__table__, rows)
    names = [c.name for c in cols]
    for required in ("version_number", "status", "authority_level", "projection_status",
                     "semantic_status", "created_at", "updated_at"):
        assert required in names
    values = dict(zip(names, (_copy_value(c, rows[0]) for c in cols)))
    assert values["canonical_data"] == '{"a": 1}'
    assert values["created_at"] is not None


def test_legacy_rows_with_duplicate_attribute_copy_still_compare_unchanged():
    from app.services.knowledge_persistence import _build_version_payload, _is_canonical_identical

    rec = _record(1)
    _, canonical, _, _ = _build_version_payload(rec)
    assert "custom_attributes_json" not in canonical  # duplicate copy no longer written
    legacy = dict(canonical, custom_attributes_json=dict(canonical["custom_attributes"]))
    assert _is_canonical_identical(legacy, canonical)


def test_entity_type_is_derived_at_write_time():
    from app.services.knowledge_persistence import _build_version_payload

    cases = {"Spare Parts": "PART", "Raw Material": "RAW_MATERIAL", "AMC Service": "SERVICE",
             "Accessory": "ACCESSORY", "Appliance": "PRODUCT"}
    for product_type, expected in cases.items():
        rec = _record(1)
        rec.custom_attributes = {"product_type": product_type}
        _, canonical, _, _ = _build_version_payload(rec)
        assert canonical["entity_type"] == expected, product_type


async def test_synthetic_5000_row_xlsx_streaming_pipeline(tmp_path, monkeypatch):
    xlsx = tmp_path / "products.xlsx"
    _write_products_xlsx(xlsx, 5104)
    profile, plan, summary, timings = await _run_local_pipeline(xlsx, 5104, monkeypatch)
    assert profile.quality_summary.total_columns == 14
    assert summary.total_inserted == 5104
    assert timings["vectors"] >= 5104
    assert sum(v for k, v in timings.items() if k != "vectors") < 60, timings


@pytest.mark.skipif(
    not os.environ.get("KNOWLEDGE_TEST_XLSX") or not Path(os.environ.get("KNOWLEDGE_TEST_XLSX", "")).is_file(),
    reason="set KNOWLEDGE_TEST_XLSX to a real export to run",
)
async def test_real_export_xlsx_pipeline(monkeypatch):
    xlsx = Path(os.environ["KNOWLEDGE_TEST_XLSX"])
    profile, plan, summary, timings = await _run_local_pipeline(xlsx, 1, monkeypatch)
    print(
        f"\nrows={profile.quality_summary.total_rows} cols={profile.quality_summary.total_columns} "
        f"mapped={plan.mapped_count} unmapped={plan.unmapped_count} review={plan.needs_review_count} "
        f"inserted={summary.total_inserted} dup={summary.total_duplicates} "
        f"conflict={summary.total_conflicts} invalid={summary.total_invalid} "
        f"timings={ {k: round(v, 2) for k, v in timings.items()} }"
    )


async def test_job_transition_retries_dropped_connection(monkeypatch):
    from app.services import knowledge_import as ki

    calls = {"n": 0}

    async def flaky(db, job_id, **kw):
        calls["n"] += 1
        if calls["n"] == 1:
            raise Exception("connection was closed in the middle of operation")
        return SimpleNamespace(id=job_id, status=kw["next_status"].value)

    monkeypatch.setattr(ki.knowledge_import_service, "transition_job", flaky)
    sessions: List[FakeSession] = []

    def factory():
        sessions.append(FakeSession())
        return sessions[-1]

    job = await ki.knowledge_import_service.transition_job_resilient(
        factory, "ij_1", base_delay_seconds=0, next_status=ImportJobStatus.COMPLETED
    )
    assert job.status == "completed" and calls["n"] == 2 and len(sessions) == 2


async def test_job_transition_never_retries_illegal_state_change(monkeypatch):
    from app.services import knowledge_import as ki

    async def illegal(db, job_id, **kw):
        raise ValueError("Illegal state transition")

    monkeypatch.setattr(ki.knowledge_import_service, "transition_job", illegal)
    with pytest.raises(ValueError):
        await ki.knowledge_import_service.transition_job_resilient(
            FakeSession, "ij_1", base_delay_seconds=0, next_status=ImportJobStatus.COMPLETED
        )
