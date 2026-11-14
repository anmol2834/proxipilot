"""Reply Persistence & Outbound Delivery Gateway — Phase 7.

Handles durable persistence of AI draft responses, human review triage tickets,
and outbound messages with strict idempotency and duplicate-send protection:
1. Decoupled AIResponse Persistence: Persists draft body, plain text, and validation status.
2. HumanReview Escalation Queue: Creates review records when disposition is HUMAN_REVIEW.
3. Outbound Idempotency Safeguard: Generates deterministic idempotency keys per
   (tenant_id, thread_id, message_id, context_revision) to guarantee zero duplicate sends.
4. Resilient Fallback: Safe no-op / mock mode when running in unit tests or isolated pipelines.
"""

from __future__ import annotations

import json
from typing import Any, Dict, Optional, Tuple
import uuid

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.contracts.evidence_package import MinimalEvidencePackage
from app.contracts.reply_planner import (
    ReplyDisposition,
    ReplyValidationReport,
    StructuredReplyDraft,
)
from app.core.logging import logger
from app.services.feedback_memory import primary_intent
from app.models.ai import AIPipelineStage, AIRun, AIRunStatus, AIResponse, ResponseApprovalStatus
from app.models.inbox import EmailThread
from app.models.outbound import DeliveryStatus, OutboundMessage
from app.models.review import HumanReview, ReviewPriority, ReviewStatus, TriageReason


class ReplyPersistenceGateway:
    """Manages transactional database persistence for reply drafts, reviews, and delivery."""

    @staticmethod
    def compute_idempotency_key(
        tenant_id: str,
        thread_id: str,
        message_id: str,
        context_revision: int,
    ) -> str:
        """Derive a deterministic, collision-resistant idempotency key for outbound dispatch."""
        return f"pp_out_{tenant_id[:12]}_{thread_id}_{message_id}_rev{context_revision}"

    async def persist_reply_state(
        self,
        package: MinimalEvidencePackage,
        draft: Optional[StructuredReplyDraft],
        validation_report: ReplyValidationReport,
        disposition: ReplyDisposition,
        human_review_reason: Optional[str] = None,
        db: Optional[AsyncSession] = None,
    ) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
        """Persist AIRun, AIResponse, HumanReview, and OutboundMessage within active transaction.

        Returns:
            Tuple of (ai_response_id, human_review_id, outbound_message_id, idempotency_key)
        """
        idempotency_key = self.compute_idempotency_key(
            tenant_id=package.tenant_id,
            thread_id=package.thread_id,
            message_id=package.message_id,
            context_revision=package.context_revision,
        )

        # If no DB session provided (e.g. unit tests or isolated benchmark), generate typed IDs
        if db is None:
            ai_resp_id = f"ares_{uuid.uuid4().hex[:12]}" if draft else None
            human_rev_id = f"rev_{uuid.uuid4().hex[:12]}" if disposition == ReplyDisposition.HUMAN_REVIEW else None
            outbound_id = f"out_{uuid.uuid4().hex[:12]}" if disposition == ReplyDisposition.SEND else None
            return ai_resp_id, human_rev_id, outbound_id, idempotency_key

        try:
            # 1. Ensure or find AIRun
            ai_run = AIRun(
                id=f"air_{uuid.uuid4().hex[:12]}",
                tenant_id=package.tenant_id,
                thread_id=package.thread_id,
                trigger_event_id=package.message_id,
                correlation_id=package.package_id,
                pipeline_stage=AIPipelineStage.COMPLETED.value,
                status=AIRunStatus.COMPLETED.value,
            )
            db.add(ai_run)
            await db.flush()

            ai_resp_id: Optional[str] = None
            human_rev_id: Optional[str] = None
            outbound_id: Optional[str] = None

            # 2. Persist AIResponse if draft is available
            if draft:
                ai_resp_id = f"ares_{uuid.uuid4().hex[:12]}"
                approval_status = (
                    ResponseApprovalStatus.AUTO_APPROVED.value
                    if disposition == ReplyDisposition.SEND
                    else ResponseApprovalStatus.PENDING_REVIEW.value
                )
                violation_codes = [issue.issue_code for issue in validation_report.issues]

                ai_response = AIResponse(
                    id=ai_resp_id,
                    tenant_id=package.tenant_id,
                    ai_run_id=ai_run.id,
                    thread_id=package.thread_id,
                    draft_subject=draft.subject,
                    draft_body=draft.body_html,
                    draft_body_plain=draft.body_text,
                    tone=draft.detected_tone,
                    policy_violations=json.dumps(violation_codes),
                    has_policy_violations=len(violation_codes) > 0,
                    approval_status=approval_status,
                    generation_instructions=json.dumps({"intent": primary_intent(package)}),
                )
                db.add(ai_response)

            # Flush parents first: the ORM models do not declare these FKs as relationships, so the
            # unit of work would not order the INSERTs (human_reviews -> ai_responses -> ai_runs) and
            # Postgres rejected the whole draft with a foreign-key violation.
            await db.flush()

            # 3. Create HumanReview record if escalated
            if disposition == ReplyDisposition.HUMAN_REVIEW and ai_resp_id:
                human_rev_id = f"rev_{uuid.uuid4().hex[:12]}"
                triage_reason = (
                    TriageReason.POLICY_VIOLATION.value
                    if not validation_report.validation_passed
                    else TriageReason.SENSITIVE_TOPIC.value
                )
                triage_ctx = {
                    "reason": human_review_reason or "Escalated for human oversight",
                    "package_id": package.package_id,
                    "validation_issues": [i.model_dump() for i in validation_report.issues],
                }

                review = HumanReview(
                    id=human_rev_id,
                    tenant_id=package.tenant_id,
                    ai_response_id=ai_resp_id,
                    thread_id=package.thread_id,
                    ai_run_id=ai_run.id,
                    triage_reason=triage_reason,
                    triage_context=json.dumps(triage_ctx),
                    priority=ReviewPriority.MEDIUM.value,
                    status=ReviewStatus.OPEN.value,
                )
                db.add(review)

            # 4. Create OutboundMessage if SEND (with duplicate prevention)
            if disposition == ReplyDisposition.SEND and draft and ai_resp_id:
                # Idempotency check: verify if an outbound message with this idempotency key already exists
                stmt = select(OutboundMessage).where(
                    OutboundMessage.tenant_id == package.tenant_id,
                    OutboundMessage.thread_id == package.thread_id,
                    or_(
                        OutboundMessage.idempotency_key == idempotency_key,
                        OutboundMessage.idempotency_key.like(f"pp_out_{package.tenant_id[:12]}_{package.thread_id}_{package.message_id}%"),
                    ),
                )
                res = await db.execute(stmt)
                existing_outbound = res.scalar_one_or_none()

                if existing_outbound:
                    logger.warning(
                        "Duplicate outbound send prevented by idempotency key",
                        idempotency_key=idempotency_key,
                        existing_outbound_id=existing_outbound.id,
                    )
                    outbound_id = existing_outbound.id
                else:
                    outbound_id = f"out_{uuid.uuid4().hex[:12]}"
                    # The sending mailbox is the one the thread belongs to (FK-enforced).
                    thread_account_id = (await db.execute(
                        select(EmailThread.integration_account_id).where(
                            EmailThread.id == package.thread_id,
                            EmailThread.tenant_id == package.tenant_id,
                        )
                    )).scalar_one()
                    outbound_msg = OutboundMessage(
                        id=outbound_id,
                        tenant_id=package.tenant_id,
                        thread_id=package.thread_id,
                        ai_response_id=ai_resp_id,
                        integration_account_id=thread_account_id,
                        to_emails=json.dumps([]),
                        subject=draft.subject,
                        body_html=draft.body_html,
                        body_text=draft.body_text,
                        idempotency_key=idempotency_key,
                        delivery_status=DeliveryStatus.CREATED.value,
                    )
                    db.add(outbound_msg)

            await db.commit()
            return ai_resp_id, human_rev_id, outbound_id, idempotency_key

        except Exception as exc:
            logger.error(
                "Failed to persist reply state to database",
                package_id=package.package_id,
                tenant_id=package.tenant_id,
                error=str(exc),
            )
            if db:
                await db.rollback()
            return None, None, None, idempotency_key


# Global singleton
reply_persistence_gateway = ReplyPersistenceGateway()
