"""Shared integration-test fixtures.

``seeded_tenant``  A throwaway organisation with the 24-row home-appliance service catalogue
                   (HA-001 .. HA-024, tests/fixtures/home_appliance_services.xlsx) imported through
                   the REAL production chain — profiler -> column mapping -> data-quality
                   pipeline -> PostgreSQL persistence + projection -> embeddings -> Qdrant — so
                   the retrieval tests also exercise the import pipeline end to end.
                   Created once per test session; everything is removed afterwards
                   (PostgreSQL rows, Qdrant points, the organisation itself).

Tests that need the catalogue take ``seeded_tenant`` as an argument instead of hard-coding a
tenant id, so they no longer depend on data that may have been deleted from the database.
"""

from __future__ import annotations

import asyncio
import sys
import uuid
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import AsyncIterator, Dict, List
from urllib.parse import urlsplit

import httpx
import pytest
from sqlalchemy import text

# =============================================================================================
# Production-database guard — tests only ever talk to a LOCAL database.
# =============================================================================================
# The app resolves DATABASE_URL from the environment first and then from server/.env, and the
# developer .env points at the production database. A test run without an explicit local
# DATABASE_URL therefore used to create (and not always fully remove) synthetic tenants in
# production. Resolve the URL exactly the way the app does and, unless the host is local, make
# every database connection fail with a clear error. Pure unit tests are unaffected.
LOCAL_DATABASE_HOSTS = frozenset({"localhost", "127.0.0.1", "::1"})


def database_host(url: str) -> str:
    return (urlsplit(url.replace("+asyncpg", "")).hostname or "").lower()


def _effective_database_url() -> str:
    from app.core.config import DatabaseSettings

    return DatabaseSettings().database_url


TEST_DATABASE_HOST = database_host(_effective_database_url())
REMOTE_DATABASE_BLOCKED = TEST_DATABASE_HOST not in LOCAL_DATABASE_HOSTS
_BLOCKED_MESSAGE = (
    f"Tests may only use a LOCAL database, but DATABASE_URL resolves to host '{TEST_DATABASE_HOST}' "
    "(server/.env points at production). Start a throwaway Postgres (e.g. docker run -d --name pp-test-pg "
    "-e POSTGRES_PASSWORD=pptest -e POSTGRES_DB=pptest -p 55432:5432 postgres:16-alpine), migrate it, and "
    "run with DATABASE_URL=postgresql://postgres:pptest@localhost:55432/pptest?sslmode=disable"
)

if REMOTE_DATABASE_BLOCKED:
    from app.core import database as _database

    def _refuse_remote_database(self) -> None:  # noqa: ANN001 — replaces DatabaseManager.initialize
        raise RuntimeError(_BLOCKED_MESSAGE)

    # Every engine/session in the app is created through DatabaseManager.initialize (lazily), so
    # blocking it blocks all database access for this test run - including fixtures and cleanup.
    _database.DatabaseManager.initialize = _refuse_remote_database  # type: ignore[method-assign]
    if _database.db_manager._engine is not None:  # pragma: no cover - only if something connected early
        raise RuntimeError(_BLOCKED_MESSAGE)


def pytest_report_header(config) -> str:  # noqa: ANN001
    if REMOTE_DATABASE_BLOCKED:
        return f"database: BLOCKED remote host '{TEST_DATABASE_HOST}' — database tests will fail; unit tests run"
    return f"database: local ({TEST_DATABASE_HOST})"

FIXTURE_XLSX = Path(__file__).parent / "fixtures" / "home_appliance_services.xlsx"
CATALOGUE_SIZE = 24
CATEGORY = "products_services"

# Every tenant-scoped table a seeded test tenant can touch, children first.
_CLEANUP_TABLES = (
    # followups & intelligence
    "followup_notice_deliveries", "followup_occurrences", "message_assessments",
    "thread_followup_states", "thread_followup_controls", "contact_suppressions", "followup_policies",
    # memories written by the reply pipeline
    "contact_facts", "contacts", "commitments", "thread_memories", "draft_feedback", "response_outcomes",
    "feedback_lessons", "style_profiles", "org_practices",
    # conversation + reply state
    "thread_suppression_markers", "thread_presented_entities", "outbound_messages", "human_reviews",
    "ai_responses", "ai_runs", "outbox_events", "email_messages", "email_threads", "connected_integration_accounts",
    # knowledge
    "knowledge_semantic_chunks", "knowledge_versions", "knowledge_items", "import_jobs",
    "knowledge_schema_profiles", "knowledge_attribute_definitions", "knowledge_sources", "audit_events",
)


async def _qdrant_delete_tenant(tenant_id: str) -> None:
    from app.core.config import get_settings

    url = str(get_settings().qdrant.url).rstrip("/")
    try:
        async with httpx.AsyncClient(base_url=url, timeout=2.0) as c:
            res = await c.get("/collections")
            if res.status_code == 200:
                cols = res.json().get("result", {}).get("collections", [])
                for col in cols:
                    await c.post(
                        f"/collections/{col['name']}/points/delete?wait=true",
                        json={"filter": {"must": [{"key": "organization_id", "match": {"value": tenant_id}}]}},
                    )
    except Exception:
        pass


# Modules that keep fire-and-forget work (memory updates after a send, …) in a module-level
# ``_BACKGROUND`` task set. That work can write rows for a test tenant AFTER the test finished.
_BACKGROUND_TASK_MODULES = (
    "app.services.thread_memory", "app.services.commitment_memory", "app.services.feedback_memory",
)


async def drain_background_tasks(timeout: float = 30.0) -> None:
    """Wait for the app's tracked fire-and-forget tasks so they cannot write after cleanup."""
    current = asyncio.current_task()
    pending = set()
    for name in _BACKGROUND_TASK_MODULES:
        mod = sys.modules.get(name)
        tasks = getattr(mod, "_BACKGROUND", None) if mod else None
        if tasks:
            pending.update(t for t in tasks if not t.done() and t is not current)
    if pending:
        await asyncio.wait(pending, timeout=timeout)


async def _delete_tenant_rows(tenant_id: str) -> None:
    from app.core.database import db_manager

    async with db_manager.session_factory() as db:
        existing = set((await db.execute(text(
            "SELECT table_name FROM information_schema.columns WHERE column_name = 'tenant_id'"))).scalars().all())
        for tbl in _CLEANUP_TABLES:
            if tbl in existing:
                await db.execute(text(f"DELETE FROM {tbl} WHERE tenant_id = :t"), {"t": tenant_id})
        await db.commit()


async def purge_tenant(tenant_id: str) -> None:
    """Remove every row and vector a test tenant created. Safe to call repeatedly."""
    from app.core.database import db_manager

    await drain_background_tasks()
    await _delete_tenant_rows(tenant_id)
    # Work scheduled by the test that was still starting up can land after the first pass.
    await drain_background_tasks()
    await _delete_tenant_rows(tenant_id)
    try:
        await _qdrant_delete_tenant(tenant_id)
    except Exception:  # noqa: BLE001 — vector cleanup is best effort if Qdrant is down
        pass
    async with db_manager.session_factory() as db:
        try:
            await db.execute(text("DELETE FROM organizations WHERE id = :t"), {"t": tenant_id})
            await db.commit()
        except Exception:  # noqa: BLE001 — another table still references it; rows above are gone
            await db.rollback()


async def _import_catalogue(tenant_id: str) -> None:
    from app.contracts.persistence import PersistenceBatchConfig
    from app.core.database import db_manager
    from app.models.knowledge import KnowledgeSource, SourceAuthorityLevel
    from app.models.organization import Organization
    from app.services.column_mapping_service import column_mapping_service
    from app.services.data_quality_pipeline import DataQualityPipeline
    from app.services.dataset_profiler import DatasetProfiler
    from app.services.knowledge_persistence import KnowledgePersistenceService
    from app.services.knowledge_reconciliation import knowledge_reconciliation_service

    source_id = f"ks_test_{uuid.uuid4().hex[:12]}"
    async with db_manager.session_factory() as db:
        db.add(Organization(id=tenant_id, name="Integration Test Catalogue",
                            slug=f"it-catalogue-{uuid.uuid4().hex[:8]}"))
        await db.flush()
        db.add(KnowledgeSource(id=source_id, tenant_id=tenant_id, name="Home appliance services (test)",
                               source_type="xlsx", authority_level=SourceAuthorityLevel.IMPORTED_DATA.value))
        await db.commit()

    profile = DatasetProfiler().profile_file(FIXTURE_XLSX, "xlsx")
    async with db_manager.session_factory() as db:
        plan = await column_mapping_service.detect_and_compile_mapping(
            db=db, tenant_id=tenant_id, category=CATEGORY, profile=profile, source_type="xlsx")
    assert plan.mapped_count > 0, "column mapping produced no mapped columns"

    pipeline = DataQualityPipeline(tenant_id=tenant_id, category=CATEGORY, mapping_plan=plan,
                                   custom_attributes=[], batch_size=100)
    persistence = KnowledgePersistenceService(
        tenant_id=tenant_id, source_id=source_id, category=CATEGORY, job_id=f"job_test_{uuid.uuid4().hex[:12]}",
        created_by_user_id=None, config=PersistenceBatchConfig(batch_size=100))
    indexable_all: List = []
    for batch in pipeline.process_file_batches(str(FIXTURE_XLSX), "xlsx"):
        _, indexable = await persistence.persist_and_project_batch(
            session_factory=db_manager.session_factory, batch=batch)
        indexable_all.extend(indexable or [])
    # Embed + upsert synchronously (wait=True) so vectors are queryable before tests run.
    await knowledge_reconciliation_service.index_documents(tenant_id, indexable_all, wait=True)

    async with db_manager.session_factory() as db:
        n_items, n_synced = (await db.execute(text("""
            SELECT count(*), count(*) FILTER (WHERE v.semantic_status = 'synced')
            FROM knowledge_items i JOIN knowledge_versions v ON v.id = i.current_version_id
            WHERE i.tenant_id = :t"""), {"t": tenant_id})).one()
    assert n_items == CATALOGUE_SIZE, f"seeded {n_items} items, expected {CATALOGUE_SIZE}"
    assert n_synced == CATALOGUE_SIZE, f"only {n_synced}/{CATALOGUE_SIZE} items indexed in Qdrant"


@pytest.fixture(scope="session")
async def seeded_tenant() -> AsyncIterator[str]:
    """A fresh organisation holding the 24-item home-appliance service catalogue."""
    tenant_id = f"org_itest_{uuid.uuid4().hex[:16]}"
    try:
        await _import_catalogue(tenant_id)
        yield tenant_id
    finally:
        await purge_tenant(tenant_id)


# Names the integration fixtures give the organisations they create.
_TEST_ORG_NAMES = ("Outbox Test Org", "Sync Test Org", "Ingestion Test Org", "Tenant Alpha Corp",
                   "Tenant Beta Corp", "Tenant A", "Tenant B", "Integration Test Catalogue")


@pytest.fixture(scope="session", autouse=True)
async def _purge_test_orgs_created_this_session() -> AsyncIterator[None]:
    """Safety net: several older fixtures create organisations without deleting them. At the end
    of the session, remove ONLY organisations created during this session whose name is one of
    the fixture names above — never anything that existed before the run."""
    started = datetime.now(timezone.utc) - timedelta(seconds=5)
    yield
    try:
        from app.core.database import db_manager

        async with db_manager.session_factory() as db:
            ids = (await db.execute(text(
                "SELECT id FROM organizations WHERE created_at >= :s AND name = ANY(:n)"),
                {"s": started, "n": list(_TEST_ORG_NAMES)})).scalars().all()
        for org_id in ids:
            await purge_tenant(org_id)
    except Exception:  # noqa: BLE001 — cleanup must never fail the test run
        pass


FIRST_TEN_SERVICES = ("HA-001", "HA-020", "HA-009", "HA-018", "HA-023",
                      "HA-010", "HA-022", "HA-019", "HA-007", "HA-004")


@pytest.fixture(scope="session")
async def seeded_conversation(seeded_tenant: str) -> Dict[str, str]:
    """A customer thread on the seeded tenant: we already listed the first ten services, and the
    customer replied asking for more options. Removed together with ``seeded_tenant``."""
    from app.core.database import db_manager

    tag = uuid.uuid4().hex[:12]
    ids = {"tenant_id": seeded_tenant, "account_id": f"int_itest_{tag}", "thread_id": f"thr_itest_{tag}",
           "outbound_id": f"msg_itest_out_{tag}", "follow_up_id": f"msg_itest_in_{tag}"}
    now = datetime.now(timezone.utc)
    async with db_manager.session_factory() as db:
        rows = (await db.execute(text("""
            SELECT i.external_identity_key AS k, i.title FROM knowledge_items i
            WHERE i.tenant_id = :t AND i.external_identity_key = ANY(:keys)"""),
            {"t": seeded_tenant, "keys": list(FIRST_TEN_SERVICES)})).mappings().all()
        titles = {r["k"]: r["title"] for r in rows}
        listing = "\n".join(f"{n}. {titles[k]}" for n, k in enumerate(FIRST_TEN_SERVICES, 1) if k in titles)
        await db.execute(text("""
            INSERT INTO connected_integration_accounts (id, tenant_id, provider, email_address, status,
                connection_status, sync_enabled, automation_enabled, created_at, updated_at)
            VALUES (:a, :t, 'gmail', :e, 'active', 'connected', false, false, now(), now())"""),
            {"a": ids["account_id"], "t": seeded_tenant, "e": f"support-{tag}@itest.example"})
        await db.execute(text("""
            INSERT INTO email_threads (id, tenant_id, integration_account_id, external_thread_id, subject,
                status, message_count, unread_count, is_read, context_revision,
                first_message_at, latest_message_at, created_at, updated_at)
            VALUES (:th, :t, :a, :ext, 'Home appliance services', 'responded', 2, 1, false, 1,
                    :first, :latest, now(), now())"""),
            {"th": ids["thread_id"], "t": seeded_tenant, "a": ids["account_id"], "ext": f"ext_thr_{tag}",
             "first": now - timedelta(hours=2), "latest": now})
        for mid, direction, sender, body, at in (
            (ids["outbound_id"], "outbound", f"support-{tag}@itest.example",
             "Hello,\n\nHere are the services we offer:\n" + listing + "\n\nRegards,\nSupport",
             now - timedelta(hours=1)),
            (ids["follow_up_id"], "inbound", "customer@itest.example",
             "Thanks! Do you have any more service options other than these?", now),
        ):
            await db.execute(text("""
                INSERT INTO email_messages (id, tenant_id, thread_id, integration_account_id, external_message_id,
                    direction, from_email, to_emails, body_text, sent_at, filter_reason, created_at, updated_at)
                VALUES (:id, :t, :th, :a, :ext, :dir, :frm, '[]', :body, :at, 'ACCEPT', now(), now())"""),
                {"id": mid, "t": seeded_tenant, "th": ids["thread_id"], "a": ids["account_id"], "ext": f"ext_{mid}",
                 "dir": direction, "frm": sender, "body": body, "at": at})
        await db.commit()
    assert len(titles) == len(FIRST_TEN_SERVICES), f"catalogue is missing some of {FIRST_TEN_SERVICES}"
    return ids
