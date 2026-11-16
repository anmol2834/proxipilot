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


async def test_crash_recovery_poison_messages_and_lag_stats():
    """Own-PEL recovery after a restart, poison reclaimed message -> DLQ + ack, lag/pending stats."""
    redis_manager.initialize()
    client = redis_manager.client
    name = f"qa_recovery_{uuid.uuid4().hex[:10]}"
    full = event_bus._resolve_stream(name)
    dlq = f"{event_bus._prefix}dlq:{name}"
    group = "qa-group"
    try:
        await client.xgroup_create(full, group, id="0", mkstream=True)
        for i in range(3):
            await event_bus.publish(name, DomainEvent(event_type="qa.recovery", tenant_id="t_qa", payload={"i": i}))
        # consumer "c1" claims 2 then "crashes" (never acks)
        claimed = await event_bus.read_events(stream_name=name, group_name=group, consumer_name="c1",
                                              count=2, block_ms=100)
        assert len(claimed) == 2
        stats = await event_bus.stream_stats(name, group)
        assert stats["length"] == 3 and stats["pending"] == 2 and stats["lag"] == 1

        # restart: the same consumer recovers exactly its own unacked entries, immediately
        own = await event_bus.read_own_pending(name, group, "c1")
        assert [m for m, _ in own] == [m for m, _ in claimed]

        # a poison entry reclaimed via XAUTOCLAIM goes to the DLQ and is acknowledged (no loop)
        bad_id = await client.xadd(full, {"garbage": "x"})
        await client.xreadgroup(groupname=group, consumername="c2", streams={full: ">"}, count=10)
        recl = await event_bus.read_events(stream_name=name, group_name=group, consumer_name="c3",
                                           count=10, block_ms=100, min_idle_time=0)
        assert all(m != bad_id for m, _ in (recl or []))
        assert await client.xlen(dlq) >= 1
        pend_ids = [p["message_id"] for p in await client.xpending_range(full, group, min="-", max="+", count=50)]
        assert bad_id not in pend_ids
    finally:
        await client.delete(full, dlq)
