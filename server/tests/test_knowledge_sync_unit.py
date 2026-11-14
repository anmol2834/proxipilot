"""Unit tests for Memory Update & Sync (no network, no database)."""

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import Any, List
from unittest.mock import AsyncMock

import pytest

from app.models.knowledge import KnowledgeItem, KnowledgeVersion

T = "org_sync_test"


class _Result:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value

    def all(self):
        return self._value or []


class _Session:
    def __init__(self, results: List[Any]):
        self._results = list(results)

    async def execute(self, stmt, params=None):
        return _Result(self._results.pop(0) if self._results else None)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


def _item(active=True, version_id="kv_2"):
    return KnowledgeItem(
        id="ki_1", tenant_id=T, title="Warranty policy", category="policies",
        source_id=None, source_type="manual", is_active=active, current_version_id=version_id,
    )


def _version(vid="kv_2", semantic_status="pending"):
    return KnowledgeVersion(
        id=vid, tenant_id=T, knowledge_item_id="ki_1", version_number=2, status="active",
        authority_level="manual", content_text="Warranty is 2 years.",
        canonical_data={"title": "Warranty policy"}, semantic_status=semantic_status,
        projection_status="pending",
    )


@pytest.fixture
def svc(monkeypatch):
    from app.services import knowledge_sync as ks

    calls: List[str] = []
    qdrant = SimpleNamespace(
        delete_item_vectors=AsyncMock(side_effect=lambda **kw: calls.append("delete_all")),
        delete_item_vectors_except_version=AsyncMock(side_effect=lambda **kw: calls.append("delete_stale")),
    )
    monkeypatch.setattr(ks.KnowledgeSyncService, "_qdrant", staticmethod(lambda: qdrant))

    async def index_documents(tenant_id, triples, mark_synced=True, wait=False):
        calls.append("upsert")
        assert wait is True, "interactive sync must wait for Qdrant to apply the upsert"
        assert mark_synced is True
        return {"indexed": len(triples[0][2].chunks)}

    service = ks.KnowledgeSyncService()
    service._recon = SimpleNamespace(index_documents=index_documents)
    service._projector = SimpleNamespace(
        project_item_version=lambda item, version: SimpleNamespace(chunks=[object()])
    )
    return ks, service, qdrant, calls


async def test_publish_indexes_current_version_then_removes_stale(svc, monkeypatch):
    ks, service, qdrant, calls = svc
    monkeypatch.setattr(ks, "db_manager", SimpleNamespace(session_factory=lambda: _Session([_item(), _version()])))

    res = await service.sync_item(T, "ki_1")

    assert res.state == "indexed" and res.version_id == "kv_2" and res.vectors == 1
    # Upsert BEFORE stale cleanup: the item is never missing from search mid-update.
    assert calls == ["upsert", "delete_stale"]
    assert qdrant.delete_item_vectors_except_version.await_args.kwargs["keep_version_id"] == "kv_2"


async def test_archived_or_deleted_item_is_purged_from_retrieval(svc, monkeypatch):
    ks, service, qdrant, calls = svc
    monkeypatch.setattr(ks, "db_manager", SimpleNamespace(session_factory=lambda: _Session([_item(active=False)])))
    res = await service.sync_item(T, "ki_1")
    assert res.state == "removed" and calls == ["delete_all"]

    calls.clear()
    monkeypatch.setattr(ks, "db_manager", SimpleNamespace(session_factory=lambda: _Session([None])))
    res = await service.sync_item(T, "ki_1")  # hard-deleted
    assert res.state == "removed" and calls == ["delete_all"]


async def test_already_synced_version_is_not_re_embedded(svc, monkeypatch):
    ks, service, qdrant, calls = svc
    monkeypatch.setattr(
        ks, "db_manager",
        SimpleNamespace(session_factory=lambda: _Session([_item(), _version(semantic_status="synced")])),
    )
    res = await service.sync_item(T, "ki_1")
    assert res.state == "already_synced" and calls == ["delete_stale"]


async def test_inline_failure_never_raises_and_queues_retry_event(svc, monkeypatch):
    ks, service, qdrant, calls = svc

    async def boom(*a, **k):
        raise ConnectionError("qdrant down")

    monkeypatch.setattr(service, "sync_item", boom)
    publish = AsyncMock(return_value="1-0")
    monkeypatch.setattr(ks.event_bus, "publish", publish)

    res = await service.sync_after_commit(T, "ki_1", "rolled_back", version_id="kv_3")

    assert res.state == "deferred" and "qdrant down" in res.error
    stream, event = publish.await_args.args
    assert stream == "knowledge-events"
    assert event.payload["item_id"] == "ki_1" and event.tenant_id == T
    assert event.event_type == ks.EventNames.KNOWLEDGE_ROLLED_BACK


async def test_inline_timeout_and_dead_redis_still_does_not_raise(svc, monkeypatch):
    ks, service, qdrant, calls = svc

    async def slow(*a, **k):
        await asyncio.sleep(1)

    monkeypatch.setattr(service, "sync_item", slow)
    monkeypatch.setattr(ks.event_bus, "publish", AsyncMock(side_effect=ConnectionError("redis down")))

    res = await service.sync_after_commit(T, "ki_1", "published", timeout_seconds=0.01)
    assert res.state == "failed" and res.error == "timeout"
    assert res.details["retry_event_queued"] is False  # periodic sweep will repair it


async def test_indexer_worker_syncs_events_without_version_id(monkeypatch):
    from app.core.messaging import DomainEvent
    from app.services import knowledge_sync as ks
    from app.workers.knowledge_embedding_worker import KnowledgeEmbeddingWorker

    sync = AsyncMock(return_value=ks.SyncResult(item_id="ki_1", state="indexed", version_id="kv_3"))
    monkeypatch.setattr(ks.knowledge_sync_service, "sync_item", sync)
    worker = KnowledgeEmbeddingWorker.__new__(KnowledgeEmbeddingWorker)

    # Rollback events historically carried no version_id and were silently skipped.
    await worker.process_event(DomainEvent(
        event_type="knowledge.rolled_back", tenant_id=T,
        payload={"item_id": "ki_1", "target_version_number": 1},
    ))
    sync.assert_awaited_once_with(tenant_id=T, item_id="ki_1")


async def test_fast_path_uses_committed_objects_with_one_check_query(svc, monkeypatch):
    ks, service, qdrant, calls = svc
    executed: List[int] = []

    class _Check(_Session):
        async def execute(self, stmt, params=None):
            executed.append(1)
            return SimpleNamespace(first=lambda: SimpleNamespace(current_version_id="kv_2", is_active=True))

    monkeypatch.setattr(ks, "db_manager", SimpleNamespace(session_factory=lambda: _Check([])))
    res = await service.sync_item(T, "ki_1", item=_item(), version=_version())
    assert res.state == "indexed" and res.version_id == "kv_2"
    assert len(executed) == 1  # only the concurrency guard, no full re-read


async def test_fast_path_falls_back_when_a_newer_version_was_published(svc, monkeypatch):
    ks, service, qdrant, calls = svc
    newer = _version(vid="kv_9")

    class _Guard(_Session):  # guard query: someone published kv_9 meanwhile
        async def execute(self, stmt, params=None):
            return SimpleNamespace(first=lambda: SimpleNamespace(current_version_id="kv_9", is_active=True))

    factories = iter([_Guard([]), _Session([_item(version_id="kv_9"), newer])])
    monkeypatch.setattr(ks, "db_manager", SimpleNamespace(session_factory=lambda: next(factories)))
    res = await service.sync_item(T, "ki_1", item=_item(), version=_version())
    # Must index the NEWER version, never resurrect the stale one.
    assert res.version_id == "kv_9"
    assert qdrant.delete_item_vectors_except_version.await_args.kwargs["keep_version_id"] == "kv_9"


async def test_archive_and_delete_skip_reads_and_purge(svc, monkeypatch):
    ks, service, qdrant, calls = svc
    monkeypatch.setattr(ks, "db_manager", SimpleNamespace(session_factory=lambda: (_ for _ in ()).throw(AssertionError("no DB read expected"))))
    res = await service.sync_after_commit(T, "ki_1", "archived")
    assert res.state == "removed" and calls == ["delete_all"]
