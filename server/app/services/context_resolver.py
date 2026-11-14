"""Enterprise Conversation Context Resolver Service.

Phase 10.1 Specifications:
- Builds accurate, bounded, tenant-safe conversation context envelopes for relevant emails.
- Tenant-scoped: Enforces tenant_id + integration_account_id + provider_thread_id relationships.
- Bounded history: Chronological ordering with configurable window (default 10 messages).
- Structured unresolved requirements: Explicit lifecycle (OPEN, PARTIALLY_FULFILLED, FULFILLED, CANCELLED, SUPERSEDED).
- Incremental thread summary: Navigation aid with participant roles, key facts, decisions, and revision tracking.
- Optimistic locking: Serialized per-thread distributed lock + context_revision increments.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
import json
import re
from typing import Any, Dict, List, Optional, Sequence, cast
import uuid

from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import db_manager
from app.core.logging import logger
from app.models.inbox import EmailMessage, EmailThread, MessageDirection
from app.services.gmail_sync import DistributedLock


# =============================================================================
# Typed Context Data Contracts (Phase 10.1 Context Envelope)
# =============================================================================


class RequirementStatus(str, Enum):
    """Lifecycle status of a structured customer requirement/request."""

    OPEN = "OPEN"
    PARTIALLY_FULFILLED = "PARTIALLY_FULFILLED"
    FULFILLED = "FULFILLED"
    CANCELLED = "CANCELLED"
    SUPERSEDED = "SUPERSEDED"


class UnresolvedRequirement(BaseModel):
    """A structured customer requirement, inquiry, or outstanding request."""

    requirement_id: str = Field(default_factory=lambda: f"req_{uuid.uuid4().hex[:12]}")
    description: str
    status: RequirementStatus = RequirementStatus.OPEN
    origin_message_id: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    confidence: float = 1.0
    fulfilled_by_message_id: Optional[str] = None


class ThreadSummaryState(BaseModel):
    """Incremental summary state for an email conversation thread."""

    summary_text: str
    participants: List[str] = Field(default_factory=list)
    key_facts: List[str] = Field(default_factory=list)
    decisions: List[str] = Field(default_factory=list)
    included_until_message_id: Optional[str] = None
    revision: int = 1


class ContextMessage(BaseModel):
    """Normalized, sanitized email message representation for context assembly."""

    id: str
    external_message_id: str
    direction: str
    from_email: str
    from_name: Optional[str] = None
    to_emails: Optional[List[str]] = None
    subject: Optional[str] = None
    sent_at: Optional[str] = None
    body_text: str
    message_id_header: Optional[str] = None
    in_reply_to_external_id: Optional[str] = None
    filter_reason: Optional[str] = None


class ContextEnvelope(BaseModel):
    """Structured, versioned conversation context envelope for downstream AI reasoning."""

    tenant_id: str
    integration_account_id: str
    provider_thread_id: str
    thread_id: str
    current_message_id: str
    context_schema_version: int = 1
    context_revision: int
    generated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    current_message: ContextMessage
    relevant_previous_messages: List[ContextMessage] = Field(default_factory=list)
    thread_summary: Optional[ThreadSummaryState] = None
    unresolved_requirements: List[UnresolvedRequirement] = Field(default_factory=list)
    previously_presented_entity_ids: List[str] = Field(default_factory=list)
    active_discovery_scope: Optional[Dict[str, Any]] = None


class OptimisticLockException(RuntimeError):
    """Raised when concurrent modification is detected during thread state update."""


# =============================================================================
# Deterministic Requirement Extraction Patterns
# =============================================================================

_CATALOGUE_PATTERNS = re.compile(
    r"(share\s+(me\s+)?(your\s+)?catalogue|send\s+(me\s+)?(your\s+)?catalogue|need\s+catalogue|price\s*list|product\s*catalog)",
    re.IGNORECASE,
)

_PRICING_PATTERNS = re.compile(
    r"(quotation|quote|pricing|rate\s*card|how\s*much\s*does\s*it\s*cost)",
    re.IGNORECASE,
)

_DEMO_PATTERNS = re.compile(
    r"(schedule\s+(a\s+)?demo|book\s+(a\s+)?demo|meeting|call\s+with\s+sales)",
    re.IGNORECASE,
)

_ORDER_STATUS_PATTERNS = re.compile(
    r"(order\s*#?\s*\d+|payment\s*done|where\s*is\s*my\s*order|order\s*cancelled)",
    re.IGNORECASE,
)

_FULFILMENT_PATTERNS = re.compile(
    r"(attached\s+(is\s+)?(the\s+)?(catalogue|price\s*list)|here\s+is\s+the\s+(catalogue|price\s*list)|shared\s+the\s+details)",
    re.IGNORECASE,
)


# =============================================================================
# Context Resolver Service
# =============================================================================


class ConversationContextResolver:
    """Service to assemble tenant-isolated, bounded conversation context envelopes."""

    async def resolve_context(
        self,
        tenant_id: str,
        integration_account_id: str,
        thread_id: str,
        current_message_id: str,
        max_messages: int = 10,
    ) -> ContextEnvelope:
        """Resolve and persist conversation context under a per-thread distributed lock."""
        lock_key = f"email:thread_lock:{tenant_id}:{thread_id}"
        lock = DistributedLock(lock_key, ttl_seconds=60)

        async with lock:
            async with db_manager.session_factory() as db:
                # 1. Tenant-Safe Thread Lookup
                stmt_th = select(EmailThread).where(
                    EmailThread.id == thread_id,
                    EmailThread.tenant_id == tenant_id,
                    EmailThread.integration_account_id == integration_account_id,
                )
                res_th = await db.execute(stmt_th)
                thread = res_th.scalar_one_or_none()
                if not thread:
                    raise ValueError(
                        f"Thread {thread_id} not found for tenant {tenant_id} and account {integration_account_id}"
                    )

                expected_revision = thread.context_revision or 1

                # 2. Query Chronological Relevant Messages for the Thread
                stmt_msgs = (
                    select(EmailMessage)
                    .where(
                        EmailMessage.thread_id == thread_id,
                        EmailMessage.tenant_id == tenant_id,
                        EmailMessage.integration_account_id == integration_account_id,
                        EmailMessage.filter_reason.in_(["ACCEPT", "BUSINESS_CONVERSATION"]),
                    )
                    .order_by(EmailMessage.sent_at.asc(), EmailMessage.created_at.asc())
                )
                res_msgs = await db.execute(stmt_msgs)
                all_msgs = res_msgs.scalars().all()

                if not all_msgs:
                    raise ValueError(f"No eligible messages found in thread {thread_id}")

                # Find the target current message
                current_msg_model = next((m for m in all_msgs if m.id == current_message_id), all_msgs[-1])

                # Split into previous messages and current message
                prev_msg_models = [m for m in all_msgs if m.id != current_msg_model.id]
                # Bound previous messages to the configured window (e.g. latest 10)
                bounded_prev_models = prev_msg_models[-max_messages:] if len(prev_msg_models) > max_messages else prev_msg_models

                # 3. Build ContextMessage representations
                current_context_msg = self._build_context_message(current_msg_model, thread.subject)
                previous_context_msgs = [
                    self._build_context_message(m, thread.subject) for m in bounded_prev_models
                ]

                # 4. Extract and Track Structured Unresolved Requirements
                existing_reqs = self._parse_existing_requirements(thread.unresolved_requirements)
                updated_reqs = self._update_requirements(
                    existing_requirements=existing_reqs,
                    all_messages=all_msgs,
                )

                # 5. Build Incremental Thread Summary
                summary_state = self._build_thread_summary(
                    thread=thread,
                    all_messages=all_msgs,
                    current_message=current_msg_model,
                    requirements=updated_reqs,
                )

                # 6. Optimistic Thread State Update in PostgreSQL
                new_revision = expected_revision + 1
                reqs_json = json.dumps([r.model_dump() for r in updated_reqs])
                meta_json = json.dumps(summary_state.model_dump())

                update_stmt = (
                    text("""
                        UPDATE email_threads
                        SET
                            ai_summary = :summary_text,
                            unresolved_requirements = :unresolved_requirements,
                            summary_metadata = :summary_metadata,
                            context_revision = :new_revision,
                            updated_at = :now
                        WHERE id = :thread_id AND context_revision = :expected_revision
                    """)
                )
                now = datetime.now(timezone.utc)
                upd_res = await db.execute(
                    update_stmt,
                    {
                        "summary_text": summary_state.summary_text,
                        "unresolved_requirements": reqs_json,
                        "summary_metadata": meta_json,
                        "new_revision": new_revision,
                        "now": now,
                        "thread_id": thread.id,
                        "expected_revision": expected_revision,
                    },
                )
                rowcount = getattr(upd_res, "rowcount", None)
                if rowcount == 0:
                    raise OptimisticLockException(
                        f"Concurrent context update race detected on thread {thread_id} (revision {expected_revision})"
                    )

                await db.commit()

                logger.info(
                    "Conversation context resolved and persisted",
                    tenant_id=tenant_id,
                    thread_id=thread_id,
                    revision=new_revision,
                    messages_count=len(previous_context_msgs) + 1,
                    unresolved_reqs_count=len([r for r in updated_reqs if r.status == RequirementStatus.OPEN]),
                )

                # 7. Fetch previously presented entities for novelty-aware conversation tracking
                from app.services.presentation_tracker import presentation_tracker
                previously_presented_ids = await presentation_tracker.get_previously_presented_identifiers(
                    db=db,
                    tenant_id=tenant_id,
                    thread_id=thread_id,
                )

                # Determine active discovery scope if previous outbound recommendations exist
                active_scope: Optional[Dict[str, Any]] = None
                has_outbound = any(m.direction == MessageDirection.OUTBOUND.value for m in all_msgs if m.id != current_msg_model.id)
                if previously_presented_ids or has_outbound:
                    active_scope = {
                        "category": "products_services",
                        "has_previous_discovery": True,
                        "previously_presented_count": len(previously_presented_ids),
                    }

                # 8. Assemble Complete Context Envelope
                return ContextEnvelope(
                    tenant_id=tenant_id,
                    integration_account_id=integration_account_id,
                    provider_thread_id=thread.external_thread_id,
                    thread_id=thread.id,
                    current_message_id=current_msg_model.id,
                    context_revision=new_revision,
                    current_message=current_context_msg,
                    relevant_previous_messages=previous_context_msgs,
                    thread_summary=summary_state,
                    unresolved_requirements=updated_reqs,
                    previously_presented_entity_ids=previously_presented_ids,
                    active_discovery_scope=active_scope,
                )

    def _build_context_message(self, msg: EmailMessage, subject: Optional[str]) -> ContextMessage:
        """Convert an EmailMessage row to a clean ContextMessage structure."""
        to_list: Optional[List[str]] = None
        if msg.to_emails:
            try:
                to_list = json.loads(msg.to_emails)
            except Exception:
                to_list = [msg.to_emails]

        return ContextMessage(
            id=msg.id,
            external_message_id=msg.external_message_id,
            direction=msg.direction,
            from_email=msg.from_email,
            from_name=msg.from_name,
            to_emails=to_list,
            subject=subject,
            sent_at=msg.sent_at.isoformat() if msg.sent_at else None,
            body_text=msg.body_text or "",
            message_id_header=msg.message_id_header,
            in_reply_to_external_id=msg.in_reply_to_external_id,
            filter_reason=msg.filter_reason,
        )

    def _parse_existing_requirements(self, raw_json: Optional[str]) -> List[UnresolvedRequirement]:
        """Deserialize stored requirements list from JSON string."""
        if not raw_json:
            return []
        try:
            data = json.loads(raw_json)
            return [UnresolvedRequirement(**item) for item in data]
        except Exception as exc:
            logger.warning("Error parsing stored unresolved requirements", error=str(exc))
            return []

    def _update_requirements(
        self,
        existing_requirements: List[UnresolvedRequirement],
        all_messages: Sequence[EmailMessage],
    ) -> List[UnresolvedRequirement]:
        """Incrementally identify new open requirements and mark fulfilled requirements."""
        reqs_by_origin = {r.origin_message_id: r for r in existing_requirements}
        now_str = datetime.now(timezone.utc).isoformat()

        # Check for new requirements in inbound messages
        for msg in all_messages:
            if msg.direction == MessageDirection.INBOUND.value:
                body = (msg.body_text or "").lower()
                
                # Check Catalogue / Pricing Request
                if _CATALOGUE_PATTERNS.search(body) and msg.id not in reqs_by_origin:
                    req = UnresolvedRequirement(
                        description="Customer requested product catalogue and price list",
                        status=RequirementStatus.OPEN,
                        origin_message_id=msg.id,
                        created_at=msg.sent_at.isoformat() if msg.sent_at else now_str,
                        last_updated_at=now_str,
                        confidence=0.95,
                    )
                    reqs_by_origin[msg.id] = req
                
                # Check Order Status / Payment Inquiry
                elif _ORDER_STATUS_PATTERNS.search(body) and msg.id not in reqs_by_origin:
                    req = UnresolvedRequirement(
                        description="Customer inquiring regarding order status or payment confirmation",
                        status=RequirementStatus.OPEN,
                        origin_message_id=msg.id,
                        created_at=msg.sent_at.isoformat() if msg.sent_at else now_str,
                        last_updated_at=now_str,
                        confidence=0.90,
                    )
                    reqs_by_origin[msg.id] = req

        # Check for fulfillment in outbound agent messages
        for msg in all_messages:
            if msg.direction == MessageDirection.OUTBOUND.value:
                body = (msg.body_text or "").lower()
                if _FULFILMENT_PATTERNS.search(body):
                    for req in reqs_by_origin.values():
                        if req.status == RequirementStatus.OPEN and "catalogue" in req.description.lower():
                            req.status = RequirementStatus.FULFILLED
                            req.fulfilled_by_message_id = msg.id
                            req.last_updated_at = now_str

        return list(reqs_by_origin.values())

    def _build_thread_summary(
        self,
        thread: EmailThread,
        all_messages: Sequence[EmailMessage],
        current_message: EmailMessage,
        requirements: List[UnresolvedRequirement],
    ) -> ThreadSummaryState:
        """Synthesize an incremental, evidence-linked thread summary."""
        # 1. Extract unique participants
        participants = list(dict.fromkeys(
            m.from_email for m in all_messages if m.from_email
        ))

        # 2. Extract Key Facts and Decisions
        key_facts: List[str] = []
        decisions: List[str] = []

        if thread.subject:
            key_facts.append(f"Subject: {thread.subject}")

        # Scan for decisions or agreements
        for msg in all_messages:
            body = (msg.body_text or "").lower()
            if "ready to proceed" in body:
                decisions.append(f"Customer confirmed ready to proceed (Msg {msg.id})")
            if "order cancelled" in body:
                key_facts.append("Order cancellation noted")

        # 3. Formulate Summary Text
        open_reqs = [r.description for r in requirements if r.status == RequirementStatus.OPEN]
        req_summary = f" Open requests: {'; '.join(open_reqs)}." if open_reqs else " No outstanding requests."
        
        summary_text = (
            f"Conversation between {', '.join(participants[:3])} regarding '{thread.subject or 'General Inquiry'}'. "
            f"Total messages: {len(all_messages)}.{req_summary}"
        )

        return ThreadSummaryState(
            summary_text=summary_text,
            participants=participants,
            key_facts=key_facts,
            decisions=decisions,
            included_until_message_id=current_message.id,
            revision=(thread.context_revision or 1) + 1,
        )


context_resolver = ConversationContextResolver()
