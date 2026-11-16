"""Outbound Message Domain Model.

Tables owned by this module:
- outbound_messages: Delivery records for all emails sent via ProxiPilot

Architectural rules:
- OutboundMessage is DECOUPLED from AIResponse. Dispatch is a separate step.
- idempotency_key prevents duplicate sends even on worker retries.
- provider_message_id is stored after successful provider dispatch for tracking.
- send_attempts tracks retry count; never retry beyond max_send_attempts.
- Delivery state transitions: created → scheduled → sending → sent | failed → dead_letter
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional
import uuid
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TenantAwareMixin, TimestampMixin


class DeliveryStatus(str, Enum):
    """Lifecycle status of an outbound email delivery attempt."""

    CREATED = "created"              # Record created, not yet dispatched
    SCHEDULED = "scheduled"          # Queued for dispatch at scheduled_at
    SENDING = "sending"              # Worker is actively attempting send
    SENT = "sent"                    # Provider confirmed delivery
    FAILED = "failed"                # Send attempt failed, will retry
    DEAD_LETTER = "dead_letter"      # Max retries exceeded, permanently failed
    CANCELLED = "cancelled"          # Cancelled before dispatch (human rejection etc.)
    # Delivery state machine (reconciled sends; see services/reply_planner/delivery_state.py)
    PENDING = "pending"                              # created, never sent
    SEND_ATTEMPTED = "send_attempted"                # durable marker written BEFORE calling Gmail
    PROVIDER_ACCEPTED = "provider_accepted"          # Gmail returned a message id
    DELIVERY_UNKNOWN = "delivery_unknown"            # timeout / 5xx: Gmail may or may not have sent it
    RECONCILIATION_REQUIRED = "reconciliation_required"  # outcome still unknown; reconciler checks Gmail
    FAILED_RETRYABLE = "failed_retryable"            # verified NOT sent; safe to retry
    FAILED_FINAL = "failed_final"                    # permanently failed (4xx / attempts exhausted)


class OutboundMessage(Base, TenantAwareMixin):
    """Delivery record for an email sent from ProxiPilot to a recipient.

    One row per outbound email dispatch attempt. Retries create new send_attempts
    increments on the SAME record (not new rows) until max_send_attempts is reached.

    Idempotency invariant:
    - idempotency_key is generated once and stored permanently.
    - Workers check idempotency_key before calling provider APIs.
    - provider_message_id is stored on successful send to prevent duplicate delivery.
    """

    __tablename__ = "outbound_messages"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"out_{uuid.uuid4().hex}",
    )
    # tenant_id comes from TenantAwareMixin
    thread_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("email_threads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ai_response_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("ai_responses.id", ondelete="SET NULL"),
        nullable=True,
        default=None,
        index=True,
        comment="AI-generated response that this message dispatches. NULL for manual sends.",
    )
    integration_account_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("connected_integration_accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="The sending mailbox (connected integration account)",
    )
    sent_by_user_id: Mapped[str] = mapped_column(
        String(64),
        nullable=True,
        default=None,
        comment="User who triggered the send (NULL for fully automated sends)",
    )

    # Recipient information
    to_emails: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="JSON array of recipient email addresses",
    )
    cc_emails: Mapped[str] = mapped_column(
        Text,
        nullable=True,
        default=None,
        comment="JSON array of CC email addresses",
    )
    subject: Mapped[str] = mapped_column(String(998), nullable=True, default=None)
    body_html: Mapped[str] = mapped_column(Text, nullable=False)
    body_text: Mapped[str] = mapped_column(Text, nullable=True, default=None)

    # Idempotency and provider tracking
    idempotency_key: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        unique=True,
        index=True,
        default=lambda: f"idem_{uuid.uuid4().hex}",
        comment="Unique key checked before provider API calls to prevent duplicate sends",
    )
    provider_message_id: Mapped[str] = mapped_column(
        String(512),
        nullable=True,
        default=None,
        index=True,
        comment="Provider-assigned message ID after successful dispatch (e.g. Gmail messageId)",
    )
    in_reply_to_external_id: Mapped[str] = mapped_column(
        String(512),
        nullable=True,
        default=None,
        comment="external_message_id of the message being replied to (for threading headers)",
    )

    # Delivery state
    delivery_status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=DeliveryStatus.CREATED,
        index=True,
    )
    send_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_send_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    last_attempt_at: Mapped[str] = mapped_column(String(64), nullable=True, default=None)
    last_error: Mapped[str] = mapped_column(
        Text,
        nullable=True,
        default=None,
        comment="Error message from the most recent failed send attempt",
    )

    # Scheduling
    scheduled_at: Mapped[str] = mapped_column(
        String(64),
        nullable=True,
        default=None,
        comment="ISO 8601 UTC timestamp for scheduled delivery. NULL = send immediately.",
    )
    sent_at: Mapped[str] = mapped_column(
        String(64),
        nullable=True,
        default=None,
        comment="ISO 8601 UTC timestamp of confirmed provider delivery",
    )

    # Presentation & Evidence tracking
    reply_plan_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
        index=True,
        comment="ReplyPlan.plan_id that generated this email draft",
    )
    evidence_package_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
        index=True,
        comment="MinimalEvidencePackage.package_id backing this email draft",
    )
    presented_entity_ids: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        default=None,
        comment="JSON array of canonical entity IDs/SKUs actually presented in this outbound email",
    )

    def __repr__(self) -> str:
        return (
            f"<OutboundMessage id={self.id} "
            f"status={self.delivery_status} attempts={self.send_attempts}>"
        )


class ThreadPresentedEntity(Base, TenantAwareMixin):
    """Canonical tracking of entities (products, services, policies, contacts, etc.)
    actually presented to a customer in confirmed outbound emails.

    Invariants:
    - Scoped strictly to tenant_id, integration_account_id, thread_id.
    - Associated with outbound_message_id and only persisted upon confirmed Gmail provider dispatch.
    - Stores both entity_id (KnowledgeItem.id) and external_identity_key (canonical SKU/business key).
    - Fully domain-agnostic and multi-tenant (works for any business entity type).
    """

    __tablename__ = "thread_presented_entities"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"tpe_{uuid.uuid4().hex[:12]}",
    )
    # tenant_id comes from TenantAwareMixin
    integration_account_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("connected_integration_accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    thread_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("email_threads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    outbound_message_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("outbound_messages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider_message_id: Mapped[Optional[str]] = mapped_column(
        String(512),
        nullable=True,
        default=None,
        index=True,
    )
    entity_id: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        comment="KnowledgeItem.id of the presented entity",
    )
    external_identity_key: Mapped[Optional[str]] = mapped_column(
        String(128),
        nullable=True,
        default=None,
        index=True,
        comment="Canonical business key or SKU (e.g. HA-001, PRD-900)",
    )
    entity_title: Mapped[Optional[str]] = mapped_column(
        String(512),
        nullable=True,
        default=None,
    )
    category: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
    )
    reply_plan_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
    )
    evidence_package_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
    )
    presented_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:
        return (
            f"<ThreadPresentedEntity id={self.id} thread={self.thread_id} "
            f"entity={self.entity_id} key={self.external_identity_key}>"
        )

