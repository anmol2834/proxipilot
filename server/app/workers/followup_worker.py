"""Follow-up background processes.

FollowupWorker      consumes 'followup_events' (``followup.assess``): AI #2 assessment mode, isolated from
                    email ingestion and reply drafting so model latency never delays either.
SchedulerRunner     leased due scans: team notices + gated customer email (see services/followups/scheduler).
OutboxRelayRunner   publishes committed-but-unpublished outbox rows (fast path failed / Redis was down),
                    so no committed work is dropped after a restart.

Embedded in the API process by ``app.main`` and runnable standalone:
    python -m app.workers.cli --worker followup
    python -m app.workers.cli --worker followup_scheduler
    python -m app.workers.cli --worker outbox_relay
"""

from __future__ import annotations

import asyncio

from app.core.config import get_automation_worker_settings
from app.core.logging import logger
from app.core.messaging import DomainEvent
from app.workers.base import BaseWorker

STREAM = "followup_events"


class FollowupWorker(BaseWorker):
    def __init__(self, standalone: bool = True):
        settings = get_automation_worker_settings()
        super().__init__(
            worker_name="followup-worker",
            stream_name=STREAM,
            group_name="followup-worker-group",
            concurrency=max(1, min(4, settings.worker.automation_worker_concurrency)),
            standalone=standalone,
        )

    async def process_event(self, event: DomainEvent) -> None:
        payload = event.payload or {}
        if event.event_type != "followup.assess":
            logger.info("FollowupWorker ignoring event", event_type=event.event_type)
            return
        tenant_id = event.tenant_id or payload.get("tenant_id")
        thread_id, message_id = payload.get("thread_id"), payload.get("message_id")
        if not (tenant_id and thread_id and message_id):
            logger.warning("followup.assess missing identifiers", event_id=event.event_id)
            return
        from app.services.followups.service import process_assessment

        outcome = await process_assessment(tenant_id=tenant_id, thread_id=thread_id, message_id=message_id)
        logger.info("followup.assess processed", thread_id=thread_id, message_id=message_id, outcome=outcome)


RELAY_MAX_AGE_SECONDS = 6 * 3600      # never auto-replay an old stuck backlog as a launch burst


async def outbox_relay_forever(interval: float = 10.0) -> None:
    from app.services.outbox import OutboxService

    while True:
        try:
            n = await OutboxService.relay_pending_batch(limit=100, max_age_seconds=RELAY_MAX_AGE_SECONDS)
            if n:
                logger.info("Outbox relay published pending events", count=n)
                continue                                   # drain a backlog without waiting
        except asyncio.CancelledError:
            raise
        except Exception as err:  # noqa: BLE001
            logger.warning("Outbox relay tick failed", error=str(err)[:300])
        await asyncio.sleep(interval)


class SchedulerRunner:
    def __init__(self):
        self._stop_event = asyncio.Event()

    async def run(self) -> None:
        from app.core.database import db_manager
        from app.core.redis import redis_manager
        from app.services.followups.scheduler import followup_scheduler

        db_manager.initialize()
        redis_manager.initialize()
        await followup_scheduler.run_forever()


class OutboxRelayRunner:
    def __init__(self):
        self._stop_event = asyncio.Event()

    async def run(self) -> None:
        from app.core.database import db_manager
        from app.core.redis import redis_manager

        db_manager.initialize()
        redis_manager.initialize()
        await outbox_relay_forever()
