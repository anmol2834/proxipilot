"""Transactional Outbox Service & Relay Implementation.

Guarantees:
- Zero dual-write inconsistencies between PostgreSQL and Redis Streams.
- At-least-once publication: pending outbox rows are published to Redis Streams.
- Dual-mode delivery:
    1. Immediate Fast-Path Dispatch: Fires right after DB transaction commit.
    2. Background Sweeper Relay: Periodically sweeps pending records, safely recovering from
       worker restarts, network partitions, or Redis transient outages.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import json
from typing import Any, Dict, List, Optional
import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import db_manager
from app.core.logging import logger
from app.core.messaging import DomainEvent, event_bus
from app.models.outbox import OutboxEvent, OutboxStatus


class OutboxService:
    """Service to create outbox records within active transactions and relay them to Redis Streams."""

    @staticmethod
    def create_record(
        db: AsyncSession,
        tenant_id: str,
        event_type: str,
        aggregate_type: str,
        aggregate_id: str,
        payload: Dict[str, Any],
        stream_name: str = "email_events",
        correlation_id: Optional[str] = None,
        causation_id: Optional[str] = None,
        event_id: Optional[str] = None,
    ) -> OutboxEvent:
        """Create OutboxEvent inside caller's transaction. Caller must commit."""
        outbox_id = event_id or f"out_{uuid.uuid4().hex}"
        outbox_event = OutboxEvent(
            id=outbox_id,
            tenant_id=tenant_id,
            stream_name=stream_name,
            event_type=event_type,
            aggregate_type=aggregate_type,
            aggregate_id=aggregate_id,
            payload=json.dumps(payload),
            correlation_id=correlation_id,
            causation_id=causation_id,
            status=OutboxStatus.PENDING.value,
            retry_count=0,
        )
        db.add(outbox_event)
        return outbox_event

    @staticmethod
    async def dispatch_fast_path(outbox_id: str) -> bool:
        """Immediately attempt to publish a newly committed outbox record to Redis Stream.
        
        If this fails or times out, it silently leaves the event as 'pending'.
        The background relay sweeper will reliably catch and publish it.
        """
        try:
            async with db_manager.session_factory() as db:
                stmt = (
                    select(OutboxEvent)
                    .where(
                        OutboxEvent.id == outbox_id,
                        OutboxEvent.status == OutboxStatus.PENDING.value,
                    )
                    .with_for_update(skip_locked=True)
                )
                res = await db.execute(stmt)
                record = res.scalar_one_or_none()
                if not record:
                    return False

                payload_dict = json.loads(record.payload)
                domain_event = DomainEvent(
                    event_id=record.id,
                    event_type=record.event_type,
                    tenant_id=record.tenant_id,
                    aggregate_type=record.aggregate_type,
                    aggregate_id=record.aggregate_id,
                    correlation_id=record.correlation_id,
                    causation_id=record.causation_id,
                    payload=payload_dict,
                )

                # Publish to Redis Stream
                await event_bus.publish(record.stream_name, domain_event)

                now = datetime.now(timezone.utc)
                record.status = OutboxStatus.PUBLISHED.value
                record.published_at = now
                record.last_error = None
                await db.commit()
                return True
        except Exception as exc:
            logger.debug(
                "Fast-path outbox dispatch deferred to background relay",
                outbox_id=outbox_id,
                error=str(exc),
            )
            return False

    @staticmethod
    async def relay_pending_batch(limit: int = 100, tenant_id: Optional[str] = None,
                                  max_age_seconds: Optional[int] = None) -> int:
        """Query and publish a batch of pending outbox events to Redis Streams.

        ``max_age_seconds`` bounds how old a pending row may be to be relayed automatically, so a
        long-stuck historical backlog is never replayed as a burst (it stays PENDING and visible)."""
        from datetime import timedelta
        published_count = 0
        now = datetime.now(timezone.utc)
        # Give fast-path a 5-second grace window to publish immediately without race condition
        cutoff = now - timedelta(seconds=5)

        async with db_manager.session_factory() as db:
            query = select(OutboxEvent).where(
                OutboxEvent.status == OutboxStatus.PENDING.value,
                OutboxEvent.created_at <= cutoff,
            )
            if max_age_seconds:
                query = query.where(OutboxEvent.created_at >= now - timedelta(seconds=max_age_seconds))
            if tenant_id:
                query = query.where(OutboxEvent.tenant_id == tenant_id)
            stmt = (
                query
                .order_by(OutboxEvent.created_at.asc())
                .limit(limit)
                .with_for_update(skip_locked=True)
            )
            res = await db.execute(stmt)
            records = res.scalars().all()

            if not records:
                return 0

            for record in records:
                try:
                    payload_dict = json.loads(record.payload)
                    domain_event = DomainEvent(
                        event_id=record.id,
                        event_type=record.event_type,
                        tenant_id=record.tenant_id,
                        aggregate_type=record.aggregate_type,
                        aggregate_id=record.aggregate_id,
                        correlation_id=record.correlation_id,
                        causation_id=record.causation_id,
                        payload=payload_dict,
                    )

                    await event_bus.publish(record.stream_name, domain_event)

                    record.status = OutboxStatus.PUBLISHED.value
                    record.published_at = now
                    record.last_error = None
                    published_count += 1
                except Exception as err:
                    record.retry_count += 1
                    record.last_error = str(err)
                    if record.retry_count >= 5:
                        record.status = OutboxStatus.FAILED.value
                        logger.error(
                            "Outbox event exceeded max retries, marked FAILED",
                            outbox_id=record.id,
                            error=str(err),
                        )
                    else:
                        logger.warning(
                            "Outbox relay failed for event, will retry",
                            outbox_id=record.id,
                            attempt=record.retry_count,
                            error=str(err),
                        )

            await db.commit()

        if published_count > 0:
            logger.info("Outbox relay published batch", count=published_count)
        return published_count


outbox_service = OutboxService()
