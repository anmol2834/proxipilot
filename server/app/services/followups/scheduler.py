"""Follow-up scheduler: indexed due scans with row-locked, leased claims.

Each tick (bounded batches, FOR UPDATE SKIP LOCKED + a lease so two processes never work one row):
  1. advance notices whose notice_at has arrived            -> team fan-out (per-recipient records)
  2. occurrences whose due_at has arrived                   -> gated customer email (if permitted),
                                                               then the due notice to the team
  3. in-flight customer sends ('sending'/'unknown')         -> synced from the outbound record that
                                                               the delivery reconciler resolves
No database transaction is held across a model or provider call. The customer email reuses the
existing outbound identity, Gmail threading and reconciliation with a stable idempotency key
(``fu_<occurrence id>``) across every retry.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from sqlalchemy import and_, or_, select, update

from app.core.database import db_manager
from app.core.logging import logger
from app.models.followup import FollowupOccurrence, ThreadFollowupState
from app.models.inbox import EmailThread
from app.models.outbound import DeliveryStatus, OutboundMessage
from app.services.followups import composer, engine, gate, notify
from app.services.followups.flags import get_flags

BATCH = 20
LEASE = timedelta(minutes=5)
MAX_DUE_NOTICE_LATENESS = timedelta(days=7)      # after long downtime: no retrospective notice bursts
INFLIGHT_STUCK = timedelta(minutes=10)
CLOSED_STATES = ("suppressed", "closed", "stopped", "none")


def idem_key(occ_id: str) -> str:
    return f"fu_{occ_id}"


def _utc(dt):
    return dt if dt is None or dt.tzinfo else dt.replace(tzinfo=timezone.utc)


async def _claim(where, now: datetime, tenant_id: Optional[str]) -> List[str]:
    async with db_manager.session_factory() as db:
        stmt = select(FollowupOccurrence.id).where(
            where, or_(FollowupOccurrence.lease_until.is_(None), FollowupOccurrence.lease_until < now))
        if tenant_id:
            stmt = stmt.where(FollowupOccurrence.tenant_id == tenant_id)
        ids = list((await db.execute(stmt.order_by(FollowupOccurrence.due_at).limit(BATCH)
                                     .with_for_update(skip_locked=True))).scalars().all())
        if ids:
            await db.execute(update(FollowupOccurrence).where(FollowupOccurrence.id.in_(ids))
                             .values(lease_until=now + LEASE))
        await db.commit()
        return ids


class FollowupScheduler:
    async def run_forever(self) -> None:
        tick = get_flags().scheduler_tick_seconds
        if tick <= 0:
            return
        await asyncio.sleep(20)
        while True:
            try:
                await self.run_once()
            except asyncio.CancelledError:
                raise
            except Exception as err:  # noqa: BLE001 - never stop the loop
                logger.warning("Follow-up scheduler tick failed", error=str(err)[:300])
            await asyncio.sleep(tick)

    async def run_once(self, now: Optional[datetime] = None, tenant_id: Optional[str] = None) -> Dict[str, int]:
        now = now or datetime.now(timezone.utc)
        stats = {"advance": 0, "due": 0, "customer_sent": 0, "customer_held": 0, "synced": 0}
        O = FollowupOccurrence
        for oid in await _claim(and_(O.status == "scheduled", O.advance_status == "pending",
                                     O.notice_at.is_not(None), O.notice_at <= now), now, tenant_id):
            if await self._advance(oid, now):
                stats["advance"] += 1
        for oid in await _claim(and_(O.status == "scheduled", O.due_at <= now), now, tenant_id):
            res = await self._due(oid, now)
            stats["due"] += 1
            if res in ("customer_sent", "customer_held"):
                stats[res] += 1
        stats["synced"] = await self._sync_inflight(now, tenant_id)
        if any(stats.values()):
            logger.info("Follow-up scheduler", **stats)
        return stats

    # ------------------------------------------------------------------ advance
    async def _advance(self, oid: str, now: datetime) -> bool:
        async with db_manager.session_factory() as db:
            occ = await db.get(FollowupOccurrence, oid)
            if occ is None or occ.status != "scheduled" or occ.advance_status != "pending":
                return False
            state = await db.get(ThreadFollowupState, occ.thread_id)
            thread = await db.get(EmailThread, occ.thread_id)
            if thread is None or state is None or state.status in CLOSED_STATES or _utc(occ.due_at) <= now:
                occ.advance_status, occ.lease_until = "skipped", None
                await db.commit()
                return False
            if not get_flags().reminders_enabled:
                occ.lease_until = None
                await db.commit()
                return False
            if await self._snoozed_until(db, occ, now):
                return False
            cal = await engine.load_calendar(db, occ.tenant_id)
            done = await notify.deliver(db, occ=occ, kind="advance", thread=thread, state=state, cal=cal, now=now)
            occ = await db.get(FollowupOccurrence, oid)
            if done:
                occ.advance_status = "done"
            occ.lease_until = None
            await db.commit()
            return done

    # ------------------------------------------------------------------ due
    async def _due(self, oid: str, now: datetime) -> str:
        async with db_manager.session_factory() as db:
            occ = await db.get(FollowupOccurrence, oid)
            if occ is None or occ.status != "scheduled" or _utc(occ.due_at) > now:
                return "skip"
            state = await db.get(ThreadFollowupState, occ.thread_id)
            thread = await db.get(EmailThread, occ.thread_id)
            if thread is None or state is None or state.status in CLOSED_STATES:
                occ.status, occ.lease_until = "cancelled", None
                occ.customer_status = "not_applicable" if occ.customer_status == "pending" else occ.customer_status
                await db.commit()
                return "cancelled"
            if await self._snoozed_until(db, occ, now):
                return "snoozed"
            result = "notified"
            if occ.customer_status == "pending":
                result = await self._customer_send(db, occ, now)
                occ = await db.get(FollowupOccurrence, oid)
            if occ.due_notice_status == "pending":
                if not get_flags().reminders_enabled or now - _utc(occ.due_at) > MAX_DUE_NOTICE_LATENESS:
                    occ.due_notice_status = "skipped"
                else:
                    cal = await engine.load_calendar(db, occ.tenant_id)
                    if await notify.deliver(db, occ=occ, kind="due", thread=thread, state=state, cal=cal, now=now):
                        occ = await db.get(FollowupOccurrence, oid)
                        occ.due_notice_status = "done"
                    occ = await db.get(FollowupOccurrence, oid)
            if occ.advance_status == "pending":
                occ.advance_status = "skipped"
            if occ.due_notice_status != "pending" and occ.customer_status not in ("pending", "sending"):
                occ.status = "done"
                if occ.step > 0:
                    st = await engine.lock_state(db, occ.tenant_id, occ.thread_id)
                    st.attempts_used = (st.attempts_used or 0) + 1
            if occ.customer_status != "pending" or occ.lease_until is None or occ.lease_until <= now:
                occ.lease_until = None                     # keep a send-window wait lease, release otherwise
            await db.commit()
            return result

    @staticmethod
    async def _snoozed_until(db, occ: FollowupOccurrence, now: datetime) -> bool:
        """A snoozed conversation defers its reminders (and customer email) until the snooze ends."""
        from app.models.followup import ThreadFollowupControl

        ctl = await db.get(ThreadFollowupControl, occ.thread_id)
        until = _utc(ctl.snoozed_until) if ctl is not None and ctl.snoozed_until else None
        if until and until > now:
            occ.lease_until = until
            await db.commit()
            return True
        return False

    async def _customer_send(self, db, occ: FollowupOccurrence, now: datetime) -> str:
        """Gate -> compose -> gate again on fresh state -> mark sending -> provider call."""
        existing = (await db.execute(select(OutboundMessage).where(
            OutboundMessage.tenant_id == occ.tenant_id,
            OutboundMessage.idempotency_key == idem_key(occ.id)))).scalar_one_or_none()
        if existing is not None:                              # a prior attempt reached the dispatcher
            occ.customer_status = "unknown" if existing.delivery_status != DeliveryStatus.SENT.value else "sent"
            occ.outbound_message_id = existing.id
            await db.commit()
            return "customer_inflight"
        g = await gate.evaluate(db, occ, now)
        if not g.ok:
            if g.retry_at or g.reason == "awaiting_assessment_of_new_message":
                occ.lease_until = g.retry_at or now + timedelta(minutes=2)
                await db.commit()
                return "customer_wait"
            occ.customer_status, occ.hold_reason = "held", g.reason
            await db.commit()
            logger.info("followup customer email held", occurrence_id=occ.id, reason=g.reason)
            return "customer_held"
        tenant_id, thread_id, occ_id = occ.tenant_id, occ.thread_id, occ.id
        await db.commit()                                      # no transaction across the model call
        composed = await composer.compose(db, tenant_id, thread_id)
        await db.commit()
        occ = (await db.execute(select(FollowupOccurrence).where(FollowupOccurrence.id == occ_id)
                                .with_for_update().execution_options(populate_existing=True))).scalar_one()
        if not composed.ok:
            occ.customer_status, occ.hold_reason = "held", composed.reason
            st = await db.get(ThreadFollowupState, thread_id)
            if st is not None:
                st.needs_review, st.review_reason = True, f"follow-up email not sent: {composed.reason}"
            await db.commit()
            return "customer_held"
        g = await gate.evaluate(db, occ, max(now, datetime.now(timezone.utc)))   # fresh state after the slow step
        if not g.ok:
            occ.customer_status, occ.hold_reason = ("pending", None) if g.retry_at else ("held", g.reason)
            if g.retry_at:
                occ.lease_until = g.retry_at
            await db.commit()
            return "customer_held" if not g.retry_at else "customer_wait"
        occ.customer_status, occ.attempts = "sending", (occ.attempts or 0) + 1
        await db.commit()

        from app.services.reply_planner.delivery import outbound_delivery_service as ods

        thread = await db.get(EmailThread, thread_id)
        try:
            await ods._deliver_in_thread(db, tenant_id=tenant_id, thread=thread, user_id=None, text_out=composed.text,
                                         body_html=ods._text_to_html(composed.text), idem_key=idem_key(occ_id),
                                         ai_response_id=None)
        except Exception as exc:  # noqa: BLE001 - outcome recorded by the dispatcher; reconciler resolves
            await db.rollback()
            logger.warning("followup customer email attempt failed", occurrence_id=occ_id,
                           error=f"{type(exc).__name__}: {str(exc)[:200]}")
        out = (await db.execute(select(OutboundMessage).where(
            OutboundMessage.tenant_id == tenant_id, OutboundMessage.idempotency_key == idem_key(occ_id)))).scalar_one_or_none()
        occ = await db.get(FollowupOccurrence, occ_id)
        if out is None:
            occ.customer_status, occ.last_error = "failed", "not dispatched"
        else:
            occ.outbound_message_id = out.id
            occ.customer_status = {DeliveryStatus.SENT.value: "sent",
                                   DeliveryStatus.FAILED_FINAL.value: "failed"}.get(out.delivery_status, "unknown")
        await db.commit()
        return "customer_sent" if occ.customer_status == "sent" else "customer_inflight"

    # ------------------------------------------------------------------ in-flight sync
    async def _sync_inflight(self, now: datetime, tenant_id: Optional[str]) -> int:
        n = 0
        async with db_manager.session_factory() as db:
            stmt = select(FollowupOccurrence).where(FollowupOccurrence.customer_status.in_(("sending", "unknown")))
            if tenant_id:
                stmt = stmt.where(FollowupOccurrence.tenant_id == tenant_id)
            for occ in (await db.execute(stmt.limit(BATCH))).scalars().all():
                out = (await db.execute(select(OutboundMessage).where(
                    OutboundMessage.tenant_id == occ.tenant_id,
                    OutboundMessage.idempotency_key == idem_key(occ.id)))).scalar_one_or_none()
                if out is None:
                    # Crash before the dispatcher recorded SEND_ATTEMPTED: the provider was never called.
                    if now - _utc(occ.updated_at) > INFLIGHT_STUCK:
                        occ.customer_status = "pending"
                        n += 1
                    continue
                new = {DeliveryStatus.SENT.value: "sent", DeliveryStatus.FAILED_FINAL.value: "failed",
                       DeliveryStatus.CANCELLED.value: "held"}.get(out.delivery_status)
                if new and new != occ.customer_status:
                    occ.customer_status, occ.outbound_message_id = new, out.id
                    if new == "held":
                        occ.hold_reason = out.last_error
                    n += 1
            await db.commit()
        return n


followup_scheduler = FollowupScheduler()
