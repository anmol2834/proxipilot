"""Ingestion-side trigger: called INSIDE the transaction that stores a business message.

1. Fence: bump the thread's follow-up revision and mark it stale when this is the newest message,
   so any outreach planned before it can no longer pass the send gate (even before AI #2 runs).
2. Outbox: record a ``followup.assess`` event in the same transaction (at-least-once delivery via
   the fast path or the relay loop). The worker deduplicates by (thread, message, prompt version).

Only recent mail (default 48 h) triggers: an initial mailbox import never causes a launch burst of
historical assessments, notices or customer sends. Provider echo of a message we already stored is
a duplicate insert upstream and never reaches this function. ProxiPilot's own team notices are
excluded by sender address.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import case, or_
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.models.followup import ThreadFollowupState
from app.models.outbox import OutboxEvent
from app.services.followups.flags import get_flags

STREAM = "followup_events"
EVENT_ASSESS = "followup.assess"


def _own_notice_sender() -> str:
    try:
        from app.core.config import get_transactional_email_settings
        return (get_transactional_email_settings().email_from_address or "").strip().lower()
    except Exception:  # noqa: BLE001
        return ""


def fence_statement(*, tenant_id: str, thread_id: str, message_id: str, sent_at: datetime, now: datetime):
    ins = pg_insert(ThreadFollowupState).values(
        thread_id=thread_id, tenant_id=tenant_id, revision=1, last_message_id=message_id, last_message_at=sent_at,
        stale=True, stale_reason="awaiting_assessment", status="none", needs_review=False, attempts_used=0,
        created_at=now, updated_at=now,
    )
    t = ThreadFollowupState
    newer = or_(t.last_message_at.is_(None), t.last_message_at <= ins.excluded.last_message_at)
    return ins.on_conflict_do_update(
        index_elements=["thread_id"],
        set_={
            "revision": case((newer, t.revision + 1), else_=t.revision),
            "last_message_id": case((newer, ins.excluded.last_message_id), else_=t.last_message_id),
            "last_message_at": case((newer, ins.excluded.last_message_at), else_=t.last_message_at),
            "stale": case((newer, True), else_=t.stale),
            "stale_reason": case((newer, "awaiting_assessment"), else_=t.stale_reason),
            "updated_at": now,
        },
        where=(t.tenant_id == tenant_id),
    )


async def on_message_stored(db: AsyncSession, *, tenant_id: str, account_id: str, thread_id: str, message_id: str,
                            sent_at: Optional[datetime], direction: str, from_email: Optional[str],
                            now: Optional[datetime] = None) -> Optional[OutboxEvent]:
    """Fence + enqueue inside the caller's transaction. Returns the outbox row (dispatch after
    commit) or None. Never raises: follow-up intelligence must not block ingestion."""
    now = now or datetime.now(timezone.utc)
    sent_at = sent_at or now
    if sent_at.tzinfo is None:
        sent_at = sent_at.replace(tzinfo=timezone.utc)
    try:
        flags = get_flags()
        if now - sent_at > timedelta(hours=flags.assess_max_age_hours):
            return None
        own = _own_notice_sender()
        if own and (from_email or "").strip().lower() == own:
            return None
    except Exception:  # noqa: BLE001
        return None
    # The caller's own pending rows are flushed OUTSIDE the savepoint so their errors surface
    # exactly as they would at the caller's commit.
    await db.flush()
    try:
        from app.services.outbox import OutboxService

        # SAVEPOINT: a failure here rolls back only the follow-up rows, never the stored message.
        async with db.begin_nested():
            await db.execute(fence_statement(tenant_id=tenant_id, thread_id=thread_id, message_id=message_id,
                                             sent_at=sent_at, now=now))
            event = OutboxService.create_record(
                db=db, tenant_id=tenant_id, event_type=EVENT_ASSESS, aggregate_type="email_thread",
                aggregate_id=thread_id, stream_name=STREAM, correlation_id=message_id,
                payload={"tenant_id": tenant_id, "account_id": account_id, "thread_id": thread_id,
                         "message_id": message_id, "direction": direction},
            )
            await db.flush()
        return event
    except Exception as exc:  # noqa: BLE001
        logger.warning("followup trigger skipped", thread_id=thread_id, error=f"{type(exc).__name__}: {str(exc)[:200]}")
        return None
