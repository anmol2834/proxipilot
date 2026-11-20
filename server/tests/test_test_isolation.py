"""The test suite's own safety rails: database guard and complete tenant cleanup."""

import asyncio
import uuid

import pytest
from sqlalchemy import text

from conftest import LOCAL_DATABASE_HOSTS, REMOTE_DATABASE_BLOCKED, database_host, purge_tenant


@pytest.mark.parametrize("url,host", [
    ("postgresql://u:p@localhost:55432/db?sslmode=disable", "localhost"),
    ("postgresql+asyncpg://u:p@127.0.0.1:5432/db", "127.0.0.1"),
    ("postgresql://u:p@ep-x-pooler.c-3.ap-southeast-1.aws.neon.tech/db?sslmode=require",
     "ep-x-pooler.c-3.ap-southeast-1.aws.neon.tech"),
    ("postgresql://u:p@[::1]:5432/db", "::1"),
])
def test_database_host_parsing(url, host):
    assert database_host(url) == host


def test_only_local_hosts_are_allowed():
    assert LOCAL_DATABASE_HOSTS == {"localhost", "127.0.0.1", "::1"}
    assert "ep-x-pooler.c-3.ap-southeast-1.aws.neon.tech" not in LOCAL_DATABASE_HOSTS


@pytest.mark.skipif(REMOTE_DATABASE_BLOCKED, reason="needs a local throwaway database")
async def test_purge_waits_for_late_background_memory_writes():
    """A memory update still running when the test ends must not leave rows behind (it used to
    write thread_memories after purge_tenant on the slow cross-region database)."""
    from app.core.database import db_manager
    from app.models.organization import Organization
    from app.services import thread_memory

    tenant_id = f"org_itest_isolation_{uuid.uuid4().hex[:12]}"
    async with db_manager.session_factory() as db:
        db.add(Organization(id=tenant_id, name="Tenant A", slug=f"itest-isolation-{uuid.uuid4().hex[:8]}"))
        await db.commit()

    async def slow_memory_write():
        await asyncio.sleep(0.5)             # still running when the test "finishes"
        async with db_manager.session_factory() as db:
            await db.execute(text("""
                INSERT INTO thread_memories (id, tenant_id, thread_id, messages_included, version, status,
                    created_at, updated_at)
                VALUES (:id, :t, 'thr_isolation', 0, 1, 'ok', now(), now())"""),
                {"id": f"tm_{uuid.uuid4().hex}", "t": tenant_id})
            await db.commit()

    task = asyncio.get_running_loop().create_task(slow_memory_write())
    thread_memory._BACKGROUND.add(task)
    task.add_done_callback(thread_memory._BACKGROUND.discard)

    await purge_tenant(tenant_id)

    async with db_manager.session_factory() as db:
        left = (await db.execute(text("SELECT count(*) FROM thread_memories WHERE tenant_id = :t"),
                                 {"t": tenant_id})).scalar()
        orgs = (await db.execute(text("SELECT count(*) FROM organizations WHERE id = :t"),
                                 {"t": tenant_id})).scalar()
    assert left == 0 and orgs == 0
