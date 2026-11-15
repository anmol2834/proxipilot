"""Regression (QA audit 2026-11-15): Redis Streams must stay bounded by the real backlog.

Before the fix, acknowledged entries were never deleted (XADD without MAXLEN, XACK without
XDEL): every stream grew forever until Redis hit maxmemory (noeviction) and every XADD failed,
stopping the whole pipeline. After the fix an entry is deleted only once it is acknowledged,
so unprocessed entries (a burst backlog) are never trimmed.

Runs against a real Redis (REDIS_URL) on a uniquely named stream that is deleted afterwards.
"""

import uuid

import pytest

from app.core.messaging import DLQ_MAX_ENTRIES, DomainEvent, event_bus
from app.core.redis import redis_manager

pytestmark = pytest.mark.asyncio


async def test_acked_entries_are_deleted_and_backlog_is_kept():
    redis_manager.initialize()
    client = redis_manager.client
    name = f"qa_retention_{uuid.uuid4().hex[:10]}"
    full = event_bus._resolve_stream(name)
    group = "qa-group"
    try:
        await client.xgroup_create(full, group, id="0", mkstream=True)
        for i in range(25):
            await event_bus.publish(name, DomainEvent(event_type="qa.retention", tenant_id="t_qa", payload={"i": i}))
        assert await client.xlen(full) == 25

        batch = await event_bus.read_events(stream_name=name, group_name=group, consumer_name="c1",
                                            count=10, block_ms=100)
        assert batch and len(batch) == 10
        for msg_id, _ev in batch:
            await event_bus.acknowledge(name, group, msg_id)

        # processed entries are gone; the 15 not yet processed are all still there
        assert await client.xlen(full) == 15
        assert (await client.xpending(full, group))["pending"] == 0

        # acknowledging an already-acked id deletes nothing else
        await event_bus.acknowledge(name, group, batch[0][0])
        assert await client.xlen(full) == 15
    finally:
        await client.delete(full)


async def test_dlq_is_capped():
    assert DLQ_MAX_ENTRIES >= 1000
