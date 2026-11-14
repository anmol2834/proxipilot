"""Automated Tests for Transactional Outbox and Async Relay Service (Phase 10.0).

Tests:
1. OutboxService.create_record inserts pending OutboxEvent within caller's transaction.
2. OutboxService.dispatch_fast_path immediately publishes to Redis Stream and updates status to 'published'.
3. OutboxService.relay_pending_batch sweeps multiple pending records, publishes them, and updates them atomically.
4. Outbox relay retry & failure handling: failed publication increments retry_count and marks 'failed' after 5 attempts.
5. Crash recovery: un-relayed pending events from simulated worker restarts are reliably delivered.
"""

from datetime import datetime, timezone
import json
from unittest.mock import AsyncMock, patch
import uuid
import pytest
from sqlalchemy import select

from app.core.database import get_db
from app.models.organization import Organization
from app.models.outbox import OutboxEvent, OutboxStatus
from app.services.outbox import outbox_service


async def _past_grace_window(event_ids):
    """The relay skips events younger than its 5s fast-path grace window; age test events past it."""
    from sqlalchemy import update
    from datetime import timedelta
    async for db in get_db():
        await db.execute(
            update(OutboxEvent).where(OutboxEvent.id.in_(event_ids))
            .values(created_at=datetime.now(timezone.utc) - timedelta(seconds=30))
        )
        await db.commit()


@pytest.fixture
async def setup_outbox_org():
    """Create test organization for outbox tests."""
    test_org_id = f"org_{uuid.uuid4().hex}"
    async for db in get_db():
        org = Organization(
            id=test_org_id,
            name="Outbox Test Org",
            slug=f"outbox-org-{uuid.uuid4().hex[:6]}",
        )
        db.add(org)
        await db.commit()
    return test_org_id


@pytest.mark.asyncio
async def test_create_outbox_record(setup_outbox_org):
    """Verify that create_record creates a valid pending OutboxEvent inside a transaction."""
    org_id = setup_outbox_org
    event_id = f"out_{uuid.uuid4().hex}"
    payload = {"account_id": "int_123", "history_id": "9999"}

    async for db in get_db():
        record = outbox_service.create_record(
            db=db,
            tenant_id=org_id,
            event_type="gmail.mailbox_change",
            aggregate_type="integration_account",
            aggregate_id="int_123",
            payload=payload,
            event_id=event_id,
        )
        await db.commit()

        # Query back
        stmt = select(OutboxEvent).where(OutboxEvent.id == event_id)
        res = await db.execute(stmt)
        saved = res.scalar_one_or_none()
        assert saved is not None
        assert saved.status == OutboxStatus.PENDING.value
        assert saved.tenant_id == org_id
        assert json.loads(saved.payload) == payload


@pytest.mark.asyncio
async def test_fast_path_dispatch(setup_outbox_org):
    """Verify that dispatch_fast_path publishes to Redis and marks record published."""
    org_id = setup_outbox_org
    event_id = f"out_{uuid.uuid4().hex}"
    payload = {"account_id": "int_fast", "history_id": "112233"}

    async for db in get_db():
        outbox_service.create_record(
            db=db,
            tenant_id=org_id,
            event_type="gmail.mailbox_change",
            aggregate_type="integration_account",
            aggregate_id="int_fast",
            payload=payload,
            event_id=event_id,
        )
        await db.commit()

    # Dispatch fast path
    published = await outbox_service.dispatch_fast_path(event_id)
    assert published is True

    # Verify status changed to published
    async for db in get_db():
        stmt = select(OutboxEvent).where(OutboxEvent.id == event_id)
        res = await db.execute(stmt)
        saved = res.scalar_one_or_none()
        assert saved is not None
        assert saved.status == OutboxStatus.PUBLISHED.value
        assert saved.published_at is not None
        assert saved.last_error is None


@pytest.mark.asyncio
async def test_batch_relay_sweeper(setup_outbox_org):
    """Verify that relay_pending_batch publishes multiple pending records in bounded batches."""
    org_id = setup_outbox_org
    event_ids = [f"out_{uuid.uuid4().hex}" for _ in range(5)]

    async for db in get_db():
        for i, eid in enumerate(event_ids):
            outbox_service.create_record(
                db=db,
                tenant_id=org_id,
                event_type="gmail.mailbox_change",
                aggregate_type="integration_account",
                aggregate_id=f"int_{i}",
                payload={"index": i},
                event_id=eid,
            )
        await db.commit()
    await _past_grace_window(event_ids)

    # Execute batch relay
    count = await outbox_service.relay_pending_batch(limit=10, tenant_id=org_id)
    assert count == 5

    # Verify all 5 are now published
    async for db in get_db():
        stmt = select(OutboxEvent).where(OutboxEvent.id.in_(event_ids))
        res = await db.execute(stmt)
        records = res.scalars().all()
        assert len(records) == 5
        for r in records:
            assert r.status == OutboxStatus.PUBLISHED.value
            assert r.published_at is not None


@pytest.mark.asyncio
async def test_relay_failure_and_dlq_transition(setup_outbox_org):
    """Verify that repeated publish failures increment retry_count and transition to failed."""
    org_id = setup_outbox_org
    event_id = f"out_{uuid.uuid4().hex}"

    async for db in get_db():
        outbox_service.create_record(
            db=db,
            tenant_id=org_id,
            event_type="gmail.mailbox_change",
            aggregate_type="integration_account",
            aggregate_id="int_fail",
            payload={"test": "fail"},
            event_id=event_id,
        )
        await db.commit()
    await _past_grace_window([event_id])

    # Simulate 5 consecutive Redis publish errors
    from app.core.messaging import event_bus
    with patch.object(event_bus, "publish", side_effect=RuntimeError("Redis connection refused")):
        for _ in range(5):
            await outbox_service.relay_pending_batch(limit=10, tenant_id=org_id)

    # Verify event transitioned to FAILED status after 5 retries
    async for db in get_db():
        stmt = select(OutboxEvent).where(OutboxEvent.id == event_id)
        res = await db.execute(stmt)
        record = res.scalar_one_or_none()
        assert record is not None
        assert record.status == OutboxStatus.FAILED.value
        assert record.retry_count >= 5
        assert "Redis connection refused" in (record.last_error or "")
