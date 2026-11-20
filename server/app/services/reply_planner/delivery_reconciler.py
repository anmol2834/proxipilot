"""Delivery reconciler: resolves every outbound send whose outcome is not yet known.

Each tick (bounded batch, indexed status filter):
  * SEND_ATTEMPTED older than STUCK_ATTEMPT_S (process crashed mid-send), DELIVERY_UNKNOWN and
    RECONCILIATION_REQUIRED -> ask Gmail first (thread metadata lookup by X-ProxiPilot-Outbound-Id).
    Found -> finalise as SENT (no resend). Not found -> FAILED_RETRYABLE / FAILED_FINAL.
  * FAILED_RETRYABLE (verified NOT sent) -> resend with exponential backoff, but only while the reply
    is still valid: not older than RESEND_MAX_AGE_S, the customer has not written again since, and
    nobody (human or AI) has replied in the meantime. Otherwise it is CANCELLED for the team.

A resend goes through the same state machine, so it can never produce a duplicate.
"""

from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from sqlalchemy import select

from app.core.database import db_manager
from app.core.logging import logger
from app.core.redis import redis_manager
from app.models.inbox import EmailMessage, EmailThread, MessageDirection, ThreadStatus
from app.models.integration import ConnectedIntegrationAccount
from app.models.outbound import DeliveryStatus, OutboundMessage
from app.services.reply_planner.delivery_state import dispatch_with_reconciliation, reconcile

TICK_S = 60.0
BATCH = 25
STUCK_ATTEMPT_S = 180          # SEND_ATTEMPTED this old = the sender died before recording the outcome
RESEND_MAX_AGE_S = 1800        # never auto-resend a reply older than 30 minutes (stale)

_UNKNOWN = (DeliveryStatus.SEND_ATTEMPTED.value, DeliveryStatus.DELIVERY_UNKNOWN.value,
            DeliveryStatus.RECONCILIATION_REQUIRED.value)


def _ts(v: Any) -> Optional[datetime]:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    try:
        d = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


class DeliveryReconciler:
    async def run_forever(self, tick: float = TICK_S) -> None:
        while True:
            try:
                await self.run_once()
            except asyncio.CancelledError:
                raise
            except Exception as err:  # noqa: BLE001 - never stop the loop
                logger.warning("Delivery reconciler tick failed", error=str(err)[:300])
            await asyncio.sleep(tick)

    async def run_once(self, now: Optional[datetime] = None, tenant_id: Optional[str] = None) -> Dict[str, int]:
        now = now or datetime.now(timezone.utc)
        stats = {"checked": 0, "confirmed_sent": 0, "resent": 0, "cancelled": 0, "unknown": 0, "final": 0}
        stmt = select(OutboundMessage.id).where(
            OutboundMessage.delivery_status.in_(_UNKNOWN + (DeliveryStatus.FAILED_RETRYABLE.value,)))
        if tenant_id:
            stmt = stmt.where(OutboundMessage.tenant_id == tenant_id)
        async with db_manager.session_factory() as db:
            rows = (await db.execute(stmt.order_by(OutboundMessage.created_at).limit(BATCH))).scalars().all()
        for out_id in rows:
            try:
                res = await self._handle(out_id, now)
            except Exception as err:  # noqa: BLE001 - one record never blocks the rest
                logger.warning("Delivery reconciliation failed for record", outbound_id=out_id, error=str(err)[:300])
                continue
            if res:
                stats["checked"] += 1
                stats[res] = stats.get(res, 0) + 1
        if stats["checked"]:
            logger.info("Delivery reconciler", **stats)
        return stats

    async def _handle(self, out_id: str, now: datetime) -> Optional[str]:
        lock = f"lock:delivery_reconcile:{out_id}"
        try:
            if not await redis_manager.client.set(lock, "1", nx=True, ex=300):
                return None
        except Exception:  # noqa: BLE001 - the state machine still prevents duplicates
            pass
        try:
            async with db_manager.session_factory() as db:
                out = await db.get(OutboundMessage, out_id)
                if out is None:
                    return None
                last = _ts(out.last_attempt_at) or _ts(out.created_at) or now
                status = out.delivery_status
                if status == DeliveryStatus.SEND_ATTEMPTED.value and (now - last).total_seconds() < STUCK_ATTEMPT_S:
                    return None           # a sender may still be working on it
                if status == DeliveryStatus.FAILED_RETRYABLE.value:
                    backoff = 60 * (2 ** max(0, int(out.send_attempts or 1) - 1))
                    if (now - last).total_seconds() < backoff:
                        return None
                thread = await db.get(EmailThread, out.thread_id)
                account = await db.get(ConnectedIntegrationAccount, out.integration_account_id)
                if thread is None or account is None or thread.tenant_id != out.tenant_id:
                    out.delivery_status = DeliveryStatus.FAILED_FINAL.value
                    out.last_error = "thread or mailbox no longer available"
                    await db.commit()
                    return "final"
                from app.services.gmail_client import gmail_client

                token = await gmail_client.get_valid_access_token(account, db)

                if status in _UNKNOWN:
                    found = await reconcile(out, token, thread.external_thread_id)
                    if found is True:
                        await self._finalise_sent(db, out, thread, account, now)
                        return "confirmed_sent"
                    await db.commit()
                    if found is None:
                        return "unknown"
                    if out.delivery_status == DeliveryStatus.FAILED_FINAL.value:
                        return "final"
                    # verified not sent -> fall through to the resend checks below

                if out.delivery_status != DeliveryStatus.FAILED_RETRYABLE.value:
                    return None
                reason = await self._resend_blocker(db, out, thread, now)
                if reason:
                    out.delivery_status = DeliveryStatus.CANCELLED.value
                    out.last_error = f"not resent: {reason}"
                    await db.commit()
                    logger.warning("Undelivered reply cancelled for the team", outbound_id=out.id, reason=reason)
                    return "cancelled"
                parent = (await db.execute(select(EmailMessage).where(
                    EmailMessage.tenant_id == out.tenant_id, EmailMessage.thread_id == thread.id,
                    EmailMessage.external_message_id == out.in_reply_to_external_id))).scalar_one_or_none()
                in_reply_to, references = _threading(parent)
                try:
                    await dispatch_with_reconciliation(
                        db, out, account, gmail_thread_id=thread.external_thread_id,
                        send_kwargs=dict(
                            to_email=(json.loads(out.to_emails or "[]") or [""])[0], subject=out.subject or "Re:",
                            body_text=out.body_text or "", body_html=out.body_html, from_email=account.email_address,
                            thread_id=thread.external_thread_id, in_reply_to_header=in_reply_to,
                            references_header=references, auto_submitted=out.sent_by_user_id is None))
                except Exception:  # noqa: BLE001 - state already recorded by the dispatcher
                    return "unknown" if out.delivery_status in _UNKNOWN else "final" \
                        if out.delivery_status == DeliveryStatus.FAILED_FINAL.value else None
                await self._finalise_sent(db, out, thread, account, now)
                return "resent"
        finally:
            try:
                await redis_manager.client.delete(lock)
            except Exception:  # noqa: BLE001
                pass

    @staticmethod
    async def _resend_blocker(db, out: OutboundMessage, thread: EmailThread, now: datetime) -> Optional[str]:
        if (out.idempotency_key or "").startswith("fu_"):
            # Proactive follow-up: re-run the authoritative customer-send gate on fresh state
            # (kill switch, consent, suppression, revision, mailbox health) before ANY resend.
            from app.models.followup import FollowupOccurrence
            from app.services.followups import gate

            occ = await db.get(FollowupOccurrence, out.idempotency_key[3:])
            if occ is None or occ.tenant_id != out.tenant_id:
                return "follow-up occurrence no longer exists"
            g = await gate.evaluate(db, occ, now, check_window=False, for_resend=True)
            if not g.ok:
                return f"follow-up gate: {g.reason}"
        created = _ts(out.created_at) or now
        if (now - created).total_seconds() > RESEND_MAX_AGE_S:
            return "reply is stale (older than 30 minutes)"
        newer = (await db.execute(select(EmailMessage.id, EmailMessage.direction).where(
            EmailMessage.tenant_id == out.tenant_id, EmailMessage.thread_id == thread.id,
            EmailMessage.sent_at > created - timedelta(seconds=1)).limit(5))).all()
        if any(r.direction == MessageDirection.INBOUND.value for r in newer):
            return "the customer wrote again since"
        if any(r.direction == MessageDirection.OUTBOUND.value for r in newer):
            return "the thread was already answered"
        return None

    @staticmethod
    async def _finalise_sent(db, out: OutboundMessage, thread: EmailThread, account: Any, now: datetime) -> None:
        out.delivery_status = DeliveryStatus.SENT.value
        out.sent_at = out.sent_at or now.isoformat()
        exists = (await db.execute(select(EmailMessage.id).where(
            EmailMessage.tenant_id == out.tenant_id,
            EmailMessage.external_message_id == out.provider_message_id))).scalar_one_or_none()
        fu_event = None
        if not exists and out.provider_message_id:
            new_id = f"msg_{uuid.uuid4().hex[:12]}"
            db.add(EmailMessage(
                id=new_id, tenant_id=out.tenant_id, thread_id=thread.id,
                integration_account_id=account.id, external_message_id=out.provider_message_id,
                direction=MessageDirection.OUTBOUND.value, from_email=account.email_address,
                to_emails=out.to_emails, body_text=out.body_text, sent_at=now,
                message_id_header=out.provider_message_id, in_reply_to_external_id=out.in_reply_to_external_id,
                filter_reason="ACCEPT"))
            from app.services.followups.triggers import on_message_stored
            fu_event = await on_message_stored(
                db, tenant_id=out.tenant_id, account_id=account.id, thread_id=thread.id, message_id=new_id,
                sent_at=now, direction=MessageDirection.OUTBOUND.value, from_email=account.email_address, now=now)
        thread.status = ThreadStatus.RESPONDED.value
        await db.commit()
        if fu_event is not None:
            from app.services.outbox import OutboxService
            asyncio.create_task(OutboxService.dispatch_fast_path(fu_event.id))


def _threading(parent: Optional[EmailMessage]):
    if parent is None or not (parent.message_id_header or "").strip():
        return None, getattr(parent, "references_header", None)
    pid = (parent.message_id_header or "").strip()
    pid = pid if pid.startswith("<") else f"<{pid}>"
    refs = f"{parent.references_header} {pid}".strip() if parent.references_header else pid
    return pid, refs


delivery_reconciler = DeliveryReconciler()
