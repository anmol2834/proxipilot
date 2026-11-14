"""Enterprise Outbound Email Delivery Service.

Responsible for:
- Checking account/tenant automation toggles (user can disable anytime).
- Idempotency protection against duplicate sends.
- Gmail REST API message dispatch.
- Updating EmailThread, EmailMessage (outbound), AIResponse, and OutboundMessage records.
- Emitting `email.outbound.sent` domain event.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import json
import re
import time
from typing import Any, Dict, Optional
import uuid

from sqlalchemy import and_, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import db_manager
from app.core.logging import logger
from app.core.messaging import DomainEvent, event_bus
from app.core.redis import redis_manager
from app.contracts.reply_planner import ReplyPlan, ReplyDisposition
from app.contracts.evidence_package import MinimalEvidencePackage
from app.models.inbox import EmailMessage, EmailThread, MessageDirection, ThreadStatus
from app.models.integration import ConnectedIntegrationAccount
from app.models.ai import AIResponse
from app.models.outbound import OutboundMessage, DeliveryStatus
from app.services.gmail_client import gmail_client, GmailApiException


class OutboundEmailDeliveryService:
    """Service to safely deliver validated reply drafts to customer inboxes."""

    @staticmethod
    async def is_automation_enabled(tenant_id: str, account_id: str, db: AsyncSession) -> bool:
        """Check if AI automation is enabled for this account (checking Redis cache then DB)."""
        cache_key = f"automation:account:{account_id}:enabled"
        try:
            cached = await redis_manager.client.get(cache_key)
            if cached is not None:
                if isinstance(cached, bytes):
                    cached = cached.decode("utf-8")
                return cached.lower() in ("true", "1")
        except Exception as e:
            logger.warning("Failed to read automation toggle from redis cache", error=str(e))

        stmt = select(ConnectedIntegrationAccount.automation_enabled).where(
            ConnectedIntegrationAccount.id == account_id,
            ConnectedIntegrationAccount.tenant_id == tenant_id,
        )
        res = await db.execute(stmt)
        val = res.scalar_one_or_none()
        is_enabled = val if val is not None else True

        try:
            await redis_manager.client.set(cache_key, "1" if is_enabled else "0", ex=60)
        except Exception:
            pass

        return is_enabled

    @staticmethod
    async def set_automation_enabled(tenant_id: str, account_id: str, enabled: bool, db: AsyncSession) -> bool:
        """Toggle automation on or off for an integration account."""
        stmt = (
            update(ConnectedIntegrationAccount)
            .where(
                ConnectedIntegrationAccount.id == account_id,
                ConnectedIntegrationAccount.tenant_id == tenant_id,
            )
            .values(automation_enabled=enabled)
        )
        await db.execute(stmt)
        await db.commit()

        cache_key = f"automation:account:{account_id}:enabled"
        try:
            await redis_manager.client.set(cache_key, "1" if enabled else "0", ex=300)
        except Exception:
            pass

        logger.info("Updated automation toggle", tenant_id=tenant_id, account_id=account_id, enabled=enabled)
        return True

    async def deliver_reply(
        self,
        tenant_id: str,
        reply_plan: ReplyPlan,
        package: MinimalEvidencePackage,
    ) -> Optional[Dict[str, Any]]:
        """Deliver the reply plan to the recipient via Gmail if eligible and auto-send is allowed."""
        if not reply_plan.draft:
            logger.info("No draft in reply plan, skipping delivery", plan_id=reply_plan.plan_id)
            return None

        # Verify sendability
        if not reply_plan.validation_report.is_sendable:
            logger.info(
                "Reply plan is not marked sendable by validator, skipping outbound send",
                plan_id=reply_plan.plan_id,
                disposition=reply_plan.disposition.value,
            )
            return None

        t_delivery_start = time.perf_counter()
        async with db_manager.session_factory() as db:
            # 1. Fetch thread and message concurrently or via primary key
            thread = await db.get(EmailThread, package.thread_id)
            if not thread or thread.tenant_id != tenant_id:
                logger.error("Thread not found for outbound delivery", thread_id=package.thread_id)
                return None

            current_msg = await db.get(EmailMessage, package.message_id)
            if not current_msg or current_msg.tenant_id != tenant_id:
                logger.error("Incoming message not found for outbound delivery", message_id=package.message_id)
                return None

            # Only deliver replies to INBOUND customer messages
            if current_msg.direction != MessageDirection.INBOUND.value:
                logger.info(
                    "Target message is not INBOUND, skipping outbound reply delivery",
                    message_id=current_msg.id,
                    direction=current_msg.direction,
                )
                return None

            # 2. Fetch connected account
            account = await db.get(ConnectedIntegrationAccount, thread.integration_account_id)
            if not account or account.tenant_id != tenant_id:
                logger.error("Connected account not found", account_id=thread.integration_account_id)
                return None

            # 3. Check automation toggle
            is_enabled = await self.is_automation_enabled(tenant_id, account.id, db)
            if not is_enabled:
                logger.info(
                    "AI Automation is turned OFF by user for account. Outbound send held.",
                    account_email=account.email_address,
                    thread_id=thread.id,
                )
                return None

            # 4. Extract clean recipient email address
            match = re.search(r"[\w\.-]+@[\w\.-]+", current_msg.from_email)
            recipient_email = match.group(0) if match else current_msg.from_email.strip()

            # 5. Strict multi-layer idempotency guard
            # A. Redis in-flight lock to eliminate concurrency race
            redis_client = redis_manager.client
            send_lock_key = f"lock:outbound_send:{tenant_id}:{thread.id}:{current_msg.id}"
            try:
                acquired = await redis_client.set(send_lock_key, "1", nx=True, ex=120)
                if not acquired:
                    logger.warning(
                        "Outbound send already in flight for message (redis lock guard)",
                        thread_id=thread.id,
                        message_id=current_msg.id,
                    )
                    return {"status": "in_flight"}
            except Exception as r_err:
                logger.warning("Redis lock error during outbound delivery", error=str(r_err))

            # B. Single combined query for existing OutboundMessage & matching current plan
            stmt_out = select(OutboundMessage).where(
                OutboundMessage.tenant_id == tenant_id,
                or_(
                    OutboundMessage.idempotency_key == reply_plan.idempotency_key,
                    and_(
                        OutboundMessage.thread_id == thread.id,
                        OutboundMessage.delivery_status == DeliveryStatus.SENT.value,
                        or_(
                            OutboundMessage.in_reply_to_external_id == current_msg.external_message_id,
                            OutboundMessage.idempotency_key.like(f"pp_out_{tenant_id[:12]}_{thread.id}_{current_msg.id}%"),
                        ),
                    ),
                ),
            )
            out_res = await db.execute(stmt_out)
            outbound_msg_records = out_res.scalars().all()
            existing_sent = next((o for o in outbound_msg_records if o.delivery_status == DeliveryStatus.SENT.value), None)

            if existing_sent:
                logger.warning(
                    "Outbound message already delivered (idempotency guard)",
                    idempotency_key=reply_plan.idempotency_key,
                    provider_message_id=existing_sent.provider_message_id,
                    message_id=current_msg.id,
                )
                return {"status": "already_sent", "provider_message_id": existing_sent.provider_message_id}

            # C. Check EmailMessage table for existing outbound reply linked to this message
            stmt_msg_out = select(EmailMessage.external_message_id).where(
                EmailMessage.tenant_id == tenant_id,
                EmailMessage.thread_id == thread.id,
                EmailMessage.direction == MessageDirection.OUTBOUND.value,
                EmailMessage.in_reply_to_external_id == current_msg.external_message_id,
            )
            existing_email_id = (await db.execute(stmt_msg_out)).scalar_one_or_none()
            if existing_email_id:
                logger.warning(
                    "EmailMessage outbound reply already exists in thread (thread guard)",
                    thread_id=thread.id,
                    message_id=current_msg.id,
                    provider_message_id=existing_email_id,
                )
                return {"status": "already_sent", "provider_message_id": existing_email_id}

            # 6. Enforce thread subject continuity and RFC 2822 headers
            raw_subj = (thread.subject or "Inquiry").strip()
            clean_subj = re.sub(r"^(Re|Fwd|re|fwd):\s*", "", raw_subj, flags=re.IGNORECASE).strip()
            reply_subject = f"Re: {clean_subj}" if clean_subj else "Re: Your inquiry"
            reply_plan.draft.subject = reply_subject

            parent_msg_id = (current_msg.message_id_header or "").strip()
            if parent_msg_id:
                if not parent_msg_id.startswith("<"):
                    parent_msg_id = f"<{parent_msg_id}>"
                in_reply_to = parent_msg_id
                if current_msg.references_header:
                    references = f"{current_msg.references_header} {parent_msg_id}".strip()
                else:
                    references = parent_msg_id
            else:
                in_reply_to = None
                references = current_msg.references_header

            # Verify and fetch AIResponse once if referenced
            ai_resp = None
            valid_ai_resp_id = None
            if reply_plan.ai_response_id:
                ai_resp = await db.get(AIResponse, reply_plan.ai_response_id)
                if ai_resp:
                    valid_ai_resp_id = ai_resp.id

            outbound_msg = next((o for o in outbound_msg_records if o.idempotency_key == reply_plan.idempotency_key), None)
            if not outbound_msg:
                outbound_msg = OutboundMessage(
                    id=f"out_{uuid.uuid4().hex[:12]}",
                    tenant_id=tenant_id,
                    thread_id=thread.id,
                    ai_response_id=valid_ai_resp_id,
                    integration_account_id=account.id,
                    to_emails=json.dumps([recipient_email]),
                    subject=reply_subject,
                    body_html=reply_plan.draft.body_html,
                    body_text=reply_plan.draft.body_text,
                    idempotency_key=reply_plan.idempotency_key,
                    in_reply_to_external_id=current_msg.external_message_id,
                    delivery_status=DeliveryStatus.SENDING.value,
                )
                db.add(outbound_msg)
            else:
                outbound_msg.delivery_status = DeliveryStatus.SENDING.value
                outbound_msg.to_emails = json.dumps([recipient_email])
                outbound_msg.subject = reply_subject
                outbound_msg.in_reply_to_external_id = current_msg.external_message_id
                outbound_msg.integration_account_id = account.id
                if valid_ai_resp_id:
                    outbound_msg.ai_response_id = valid_ai_resp_id

            # 7. Dispatch via Gmail API in the exact same thread
            t_gmail_start = time.perf_counter()
            try:
                access_token = await gmail_client.get_valid_access_token(account, db)
                provider_res = await gmail_client.send_message(
                    access_token=access_token,
                    to_email=recipient_email,
                    subject=reply_subject,
                    body_text=reply_plan.draft.body_text,
                    body_html=reply_plan.draft.body_html,
                    from_email=account.email_address,
                    thread_id=thread.external_thread_id,
                    in_reply_to_header=in_reply_to,
                    references_header=references,
                )
            except Exception as send_err:
                logger.error(
                    "Failed to dispatch email via Gmail API",
                    error=str(send_err),
                    account_email=account.email_address,
                    to_email=recipient_email,
                )
                outbound_msg.delivery_status = DeliveryStatus.FAILED.value
                outbound_msg.last_error = str(send_err)
                await db.commit()
                raise
            gmail_duration_ms = (time.perf_counter() - t_gmail_start) * 1000

            now = datetime.now(timezone.utc)
            prov_id = provider_res.get("id")
            prov_id_str = str(prov_id) if prov_id is not None else None

            # 8. Record outbound EmailMessage in thread
            out_email_msg = EmailMessage(
                id=f"msg_{uuid.uuid4().hex[:12]}",
                tenant_id=tenant_id,
                thread_id=thread.id,
                integration_account_id=account.id,
                external_message_id=prov_id_str or f"ext_{uuid.uuid4().hex[:8]}",
                direction=MessageDirection.OUTBOUND.value,
                from_email=account.email_address,
                to_emails=json.dumps([recipient_email]),
                body_text=reply_plan.draft.body_text,
                sent_at=now,
                message_id_header=prov_id_str,
                in_reply_to_external_id=current_msg.external_message_id,
                filter_reason="ACCEPT",
            )
            db.add(out_email_msg)

            # 9. Update OutboundMessage, Thread, AIResponse
            if prov_id_str is not None:
                outbound_msg.provider_message_id = prov_id_str
            outbound_msg.delivery_status = DeliveryStatus.SENT.value
            if now is not None:
                outbound_msg.sent_at = now.isoformat()

            thread.status = ThreadStatus.RESPONDED.value
            thread.latest_message_at = now
            if ai_resp:
                ai_resp.approval_status = "sent"

            # 9.5 Record presented entities to durable presentation ledger upon confirmed send
            from app.services.presentation_tracker import presentation_tracker
            presented_ents = presentation_tracker.extract_presented_entities_from_package_and_draft(
                package=package,
                draft_text=reply_plan.draft.body_text,
            )
            recorded_ids = await presentation_tracker.record_presented_entities(
                db=db,
                tenant_id=tenant_id,
                integration_account_id=account.id,
                thread_id=thread.id,
                outbound_message_id=outbound_msg.id,
                provider_message_id=prov_id_str,
                presented_entities=presented_ents,
                reply_plan_id=reply_plan.plan_id,
                evidence_package_id=package.package_id,
            )
            outbound_msg.reply_plan_id = reply_plan.plan_id
            outbound_msg.evidence_package_id = package.package_id
            if recorded_ids:
                outbound_msg.presented_entity_ids = json.dumps(recorded_ids)

            t_commit_start = time.perf_counter()
            await db.commit()
            db_commit_ms = (time.perf_counter() - t_commit_start) * 1000
            total_duration_ms = (time.perf_counter() - t_delivery_start) * 1000

            logger.info(
                "Reply email successfully dispatched to customer",
                to_email=recipient_email,
                from_email=account.email_address,
                provider_message_id=provider_res.get("id"),
                thread_id=thread.id,
                plan_id=reply_plan.plan_id,
                duration_ms=round(total_duration_ms, 2),
                gmail_api_ms=round(gmail_duration_ms, 2),
                db_commit_ms=round(db_commit_ms, 2),
            )

            # Memory 4: record the reply in the recipient's relationship memory. When Gmail
            # sync later sees this sent message it is skipped as a duplicate, so the
            # interaction is counted exactly once. Never raises.
            from app.services.contact_memory import contact_memory_service

            await contact_memory_service.record_message_interaction(
                tenant_id=tenant_id,
                direction=MessageDirection.OUTBOUND.value,
                from_email=account.email_address,
                from_name=None,
                to_emails=[recipient_email],
                cc_emails=[],
                sent_at=now,
                own_emails=[account.email_address or ""],
            )

            # Memory 6: promises made in the AI reply ("we will send the quote by Friday").
            from app.services.commitment_memory import commitment_memory_service

            commitment_memory_service.schedule_extraction(tenant_id, out_email_msg.id, now)

            # Memory 3: our reply becomes part of the conversation memory.
            from app.services.thread_memory import thread_memory_service

            thread_memory_service.schedule_update(tenant_id, thread.id, now)

            # 10. Emit domain event
            try:
                await event_bus.publish(
                    "email_events",
                    DomainEvent(
                        event_type="email.outbound.sent",
                        tenant_id=tenant_id,
                        aggregate_type="email_thread",
                        aggregate_id=thread.id,
                        correlation_id=reply_plan.plan_id,
                        payload={
                            "thread_id": thread.id,
                            "outbound_message_id": outbound_msg.id,
                            "provider_message_id": provider_res.get("id"),
                            "to_email": recipient_email,
                            "from_email": account.email_address,
                            "subject": reply_plan.draft.subject,
                        },
                    ),
                )
            except Exception:
                pass

            return {
                "status": "sent",
                "provider_message_id": provider_res.get("id"),
                "to_email": recipient_email,
            }

    # ------------------------------------------------------------------
    # Human-approved send of a saved AI draft (inbox "Send" button)
    # ------------------------------------------------------------------

    @staticmethod
    def _threading_headers(thread: EmailThread, parent: EmailMessage) -> tuple:
        raw_subj = (thread.subject or "Inquiry").strip()
        clean_subj = re.sub(r"^(Re|Fwd|re|fwd):\s*", "", raw_subj, flags=re.IGNORECASE).strip()
        subject = f"Re: {clean_subj}" if clean_subj else "Re: Your inquiry"
        parent_id = (parent.message_id_header or "").strip()
        if parent_id:
            if not parent_id.startswith("<"):
                parent_id = f"<{parent_id}>"
            references = f"{parent.references_header} {parent_id}".strip() if parent.references_header else parent_id
            return subject, parent_id, references
        return subject, None, parent.references_header

    @staticmethod
    def _text_to_html(text: str) -> str:
        import html as _html
        paras = [p.strip() for p in re.split(r"\n\s*\n", text.strip()) if p.strip()]
        return "".join(f"<p>{_html.escape(p).replace(chr(10), '<br>')}</p>" for p in paras)

    async def send_draft(
        self,
        tenant_id: str,
        ai_response_id: str,
        user_id: Optional[str],
        body_text: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send a saved AI draft (optionally edited) as a reply in the SAME Gmail thread.

        Idempotent (one send per draft, guarded by a Redis lock + the outbound idempotency key),
        tenant-scoped, and it never sends twice on a double click or retry. Raises LookupError
        (not found), ValueError (not sendable / nothing to reply to) or GmailApiException.
        """
        final_text = (body_text or "").strip()
        lock_key = f"lock:draft_send:{tenant_id}:{ai_response_id}"
        try:
            if not await redis_manager.client.set(lock_key, "1", nx=True, ex=120):
                return {"status": "in_flight"}
        except Exception as r_err:  # noqa: BLE001 — DB idempotency below still protects
            logger.warning("Redis lock unavailable for draft send", error=str(r_err))

        try:
            async with db_manager.session_factory() as db:
                ai_resp = (await db.execute(select(AIResponse).where(
                    AIResponse.id == ai_response_id, AIResponse.tenant_id == tenant_id))).scalar_one_or_none()
                if ai_resp is None:
                    raise LookupError("draft not found")
                idem_key = f"pp_draft_{ai_response_id}"
                existing = (await db.execute(select(OutboundMessage).where(
                    OutboundMessage.tenant_id == tenant_id, OutboundMessage.idempotency_key == idem_key,
                    OutboundMessage.delivery_status == DeliveryStatus.SENT.value))).scalar_one_or_none()
                if existing is not None or ai_resp.approval_status == "sent":
                    return {"status": "already_sent", "provider_message_id": existing.provider_message_id if existing else None}

                original = ai_resp.draft_body_plain or ""
                text_out = final_text or original
                if not text_out.strip():
                    raise ValueError("the reply is empty")

                thread = await db.get(EmailThread, ai_resp.thread_id)
                edited = bool(final_text) and final_text != original.strip()
                body_html = self._text_to_html(text_out) if edited or not ai_resp.draft_body else ai_resp.draft_body
                sent = await self._deliver_in_thread(
                    db, tenant_id=tenant_id, thread=thread, user_id=user_id, text_out=text_out,
                    body_html=body_html, idem_key=idem_key, ai_response_id=ai_resp.id)
        finally:
            try:
                await redis_manager.client.delete(lock_key)
            except Exception:  # noqa: BLE001
                pass

        # Learning + memory (best effort; the email is already sent).
        try:
            from app.services.feedback_memory import feedback_memory_service
            async with db_manager.session_factory() as fdb:
                await feedback_memory_service.review_draft(
                    fdb, tenant_id, ai_response_id, "edited" if edited else "approved", user_id,
                    final_text=text_out if edited else None)
        except Exception as fb_err:  # noqa: BLE001
            logger.warning("Draft feedback capture after send failed", error=str(fb_err)[:300])
        try:
            async with db_manager.session_factory() as sdb:
                await sdb.execute(update(AIResponse).where(AIResponse.id == ai_response_id)
                                  .values(approval_status="sent", reviewed_by_user_id=user_id))
                await sdb.commit()
        except Exception as st_err:  # noqa: BLE001
            logger.warning("Could not mark draft sent", error=str(st_err)[:300])
        await self._after_send_memory(tenant_id, sent)

        logger.info("AI draft sent by user", tenant_id=tenant_id, ai_response_id=ai_response_id,
                    thread_id=sent["thread_id"], edited=edited, provider_message_id=sent["provider_message_id"])
        return {"status": "sent", "provider_message_id": sent["provider_message_id"],
                "to_email": sent["to_email"], "edited": edited}

    async def send_manual_reply(
        self,
        tenant_id: str,
        thread_id: str,
        user_id: Optional[str],
        body_text: str,
        client_token: str,
    ) -> Dict[str, Any]:
        """Send a reply typed by the user in the SAME Gmail thread.

        `client_token` is generated once per composed reply by the browser, so retries and
        double clicks map to one idempotency key and the email is sent at most once.
        """
        text_out = (body_text or "").strip()
        if not text_out:
            raise ValueError("the reply is empty")
        token = re.sub(r"[^A-Za-z0-9_-]", "", client_token or "")[:64]
        if len(token) < 8:
            raise ValueError("invalid client token")
        idem_key = f"pp_manual_{token}"
        lock_key = f"lock:manual_send:{tenant_id}:{token}"
        try:
            if not await redis_manager.client.set(lock_key, "1", nx=True, ex=120):
                return {"status": "in_flight"}
        except Exception as r_err:  # noqa: BLE001
            logger.warning("Redis lock unavailable for manual send", error=str(r_err))
        try:
            async with db_manager.session_factory() as db:
                existing = (await db.execute(select(OutboundMessage).where(
                    OutboundMessage.tenant_id == tenant_id, OutboundMessage.idempotency_key == idem_key,
                    OutboundMessage.delivery_status == DeliveryStatus.SENT.value))).scalar_one_or_none()
                if existing is not None:
                    return {"status": "already_sent", "provider_message_id": existing.provider_message_id}
                thread = await db.get(EmailThread, thread_id)
                sent = await self._deliver_in_thread(
                    db, tenant_id=tenant_id, thread=thread, user_id=user_id, text_out=text_out,
                    body_html=self._text_to_html(text_out), idem_key=idem_key, ai_response_id=None)
        finally:
            try:
                await redis_manager.client.delete(lock_key)
            except Exception:  # noqa: BLE001
                pass
        await self._after_send_memory(tenant_id, sent)
        logger.info("Manual reply sent", tenant_id=tenant_id, thread_id=thread_id,
                    provider_message_id=sent["provider_message_id"])
        return {"status": "sent", "provider_message_id": sent["provider_message_id"], "to_email": sent["to_email"]}

    async def _deliver_in_thread(
        self, db, *, tenant_id: str, thread: Optional[EmailThread], user_id: Optional[str], text_out: str,
        body_html: str, idem_key: str, ai_response_id: Optional[str],
    ) -> Dict[str, Any]:
        """Send `text_out` as a reply to the latest customer message of `thread`, threaded in Gmail
        (same threadId + In-Reply-To/References), and record it. Raises LookupError / ValueError /
        GmailApiException; a failed send is recorded as FAILED and re-raised."""
        if thread is None or thread.tenant_id != tenant_id:
            raise LookupError("conversation not found")
        parent = (await db.execute(select(EmailMessage).where(
            EmailMessage.tenant_id == tenant_id, EmailMessage.thread_id == thread.id,
            EmailMessage.direction == MessageDirection.INBOUND.value,
        ).order_by(EmailMessage.sent_at.desc().nullslast()).limit(1))).scalar_one_or_none()
        if parent is None:
            raise ValueError("this conversation has no customer message to reply to")
        account = await db.get(ConnectedIntegrationAccount, thread.integration_account_id)
        if account is None or account.tenant_id != tenant_id:
            raise ValueError("the mailbox for this conversation is not connected")

        match = re.search(r"[\w\.\+-]+@[\w\.-]+", parent.reply_to_email or parent.from_email or "")
        recipient = match.group(0) if match else (parent.from_email or "").strip()
        subject, in_reply_to, references = self._threading_headers(thread, parent)

        outbound = OutboundMessage(
            id=f"out_{uuid.uuid4().hex[:12]}", tenant_id=tenant_id, thread_id=thread.id,
            ai_response_id=ai_response_id, integration_account_id=account.id, sent_by_user_id=user_id,
            to_emails=json.dumps([recipient]), subject=subject, body_html=body_html, body_text=text_out,
            idempotency_key=idem_key, in_reply_to_external_id=parent.external_message_id,
            delivery_status=DeliveryStatus.SENDING.value,
        )
        db.add(outbound)
        await db.commit()

        try:
            token = await gmail_client.get_valid_access_token(account, db)
            provider_res = await gmail_client.send_message(
                access_token=token, to_email=recipient, subject=subject, body_text=text_out,
                body_html=body_html, from_email=account.email_address, thread_id=thread.external_thread_id,
                in_reply_to_header=in_reply_to, references_header=references,
            )
        except Exception as send_err:
            outbound.delivery_status = DeliveryStatus.FAILED.value
            outbound.last_error = str(send_err)[:1000]
            await db.commit()
            raise

        now = datetime.now(timezone.utc)
        prov_id = str(provider_res.get("id")) if provider_res.get("id") is not None else None
        sent_msg_id = f"msg_{uuid.uuid4().hex[:12]}"
        db.add(EmailMessage(
            id=sent_msg_id, tenant_id=tenant_id, thread_id=thread.id,
            integration_account_id=account.id, external_message_id=prov_id or f"ext_{uuid.uuid4().hex[:8]}",
            direction=MessageDirection.OUTBOUND.value, from_email=account.email_address,
            to_emails=json.dumps([recipient]), body_text=text_out, sent_at=now, message_id_header=prov_id,
            in_reply_to_external_id=parent.external_message_id, filter_reason="ACCEPT",
        ))
        outbound.provider_message_id = prov_id
        outbound.delivery_status = DeliveryStatus.SENT.value
        outbound.sent_at = now.isoformat()
        thread.status = ThreadStatus.RESPONDED.value
        thread.latest_message_at = now
        await db.commit()
        return {"provider_message_id": prov_id, "to_email": recipient, "thread_id": thread.id,
                "sent_msg_id": sent_msg_id, "sent_at": now, "from_email": account.email_address}

    @staticmethod
    async def _after_send_memory(tenant_id: str, sent: Dict[str, Any]) -> None:
        """Contact / thread / commitment memory updates after a send (best effort)."""
        try:
            from app.services.contact_memory import contact_memory_service
            from app.services.commitment_memory import commitment_memory_service
            from app.services.thread_memory import thread_memory_service
            await contact_memory_service.record_message_interaction(
                tenant_id=tenant_id, direction=MessageDirection.OUTBOUND.value, from_email=sent["from_email"],
                from_name=None, to_emails=[sent["to_email"]], cc_emails=[], sent_at=sent["sent_at"],
                own_emails=[sent["from_email"] or ""])
            thread_memory_service.schedule_update(tenant_id, sent["thread_id"], sent["sent_at"])
            commitment_memory_service.schedule_extraction(tenant_id, sent["sent_msg_id"], sent["sent_at"])
        except Exception as mem_err:  # noqa: BLE001
            logger.warning("Memory update after send failed", error=str(mem_err)[:300])

outbound_delivery_service = OutboundEmailDeliveryService()
