"""Inbox Domain Models — Email Threads and Messages.

Tables owned by this module:
- email_threads: Deduplicated conversation threads per org/integration
- email_messages: Individual messages within a thread (normalized plain-text only)
- attachment_metadata: File attachment references (binary stored in Object Storage)
- trusted_senders: Organization-level sender/domain allowlist

Architectural rules (Phase 4 contract):
- Threads are the primary unit. Messages are subordinate to threads.
- Subject is stored ONCE on email_threads, NOT on email_messages.
- body_html is NEVER stored. Only normalized plain-text body_text.
- raw_headers are NEVER stored. Only minimal RFC reply-threading fields.
- external_thread_id + organization_id + integration_account_id must be unique.
- external_message_id + integration_account_id must be unique (idempotent ingestion).
- Binary attachments (PDFs, images) are stored in Object Storage; only metadata is in Postgres.
- is_read / is_starred are user-facing UI state, not provider state.
- lead_intent_score is an AI-computed field (0.0-1.0). Nullable until AI run completes.
- latest_message_at uses DateTime(timezone=True) for proper indexed sort.
- sent_at uses DateTime(timezone=True) for correct chronological message ordering.
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import List, Optional
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TenantAwareMixin, TimestampMixin


class ThreadStatus(str, Enum):
    """Lifecycle status of an email thread in the ProxiPilot system."""

    PENDING_TRIAGE = "pending_triage"      # Newly ingested, not yet classified
    AI_PROCESSING = "ai_processing"        # AI pipeline running
    PENDING_REVIEW = "pending_review"      # Awaiting human approval
    RESPONDED = "responded"                # Outbound reply dispatched
    ARCHIVED = "archived"                  # Closed / resolved
    IGNORED = "ignored"                    # Intentionally skipped


class LeadIntent(str, Enum):
    """Categorical intent classification for lead scoring display."""

    HOT = "hot"
    WARM = "warm"
    COLD = "cold"
    UNKNOWN = "unknown"


class MessageDirection(str, Enum):
    """Direction of a message relative to the organization's mailbox."""

    INBOUND = "inbound"
    OUTBOUND = "outbound"


class EmailThread(Base, TenantAwareMixin):
    """A deduplicated email conversation thread.

    One EmailThread = one logical conversation. All messages in the same Gmail thread
    share the same external_thread_id (e.g. Gmail threadId).

    Ingestion idempotency: (tenant_id, integration_account_id, external_thread_id)
    must be unique — enforced at DB level via UniqueConstraint.

    Inbox list query uses composite index on
    (tenant_id, integration_account_id, latest_message_at DESC).
    """

    __tablename__ = "email_threads"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"thr_{uuid.uuid4().hex}",
    )
    # tenant_id comes from TenantAwareMixin (= organization_id)
    integration_account_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("connected_integration_accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    external_thread_id: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
        index=True,
        comment="Provider thread ID (e.g. Gmail threadId). Used for idempotent ingestion.",
    )

    # Thread metadata — subject stored ONCE here, never on email_messages
    subject: Mapped[Optional[str]] = mapped_column(
        String(998),
        nullable=True,
        default=None,
        comment="Canonical thread subject, normalized (Re:/Fwd: stripped).",
    )
    snippet: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        default=None,
        comment="Short preview from the latest accepted message body_text.",
    )
    # Latest sender denormalized for O(1) inbox list display
    sender_email: Mapped[Optional[str]] = mapped_column(String(320), nullable=True, default=None)
    sender_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, default=None)

    # Lifecycle state
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=ThreadStatus.PENDING_TRIAGE.value,
        index=True,
    )

    # AI-computed fields (populated after AI run completes)
    lead_intent: Mapped[Optional[str]] = mapped_column(
        String(16),
        nullable=True,
        default=None,
        index=True,
        comment="Categorical AI lead intent: hot | warm | cold | unknown",
    )
    lead_intent_score: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
        default=None,
        comment="AI confidence score 0.0–1.0 for lead intent classification",
    )
    ai_summary: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        default=None,
        comment="AI-generated thread summary shown in UI",
    )
    context_revision: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
        comment="Optimistic locking revision counter for context resolution and summary updates",
    )
    unresolved_requirements: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        default=None,
        comment="JSON array of structured unresolved customer requirements and requests",
    )
    summary_metadata: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        default=None,
        comment="JSON metadata tracking summary provenance, included messages, and participant roles",
    )

    # User-facing state (maintained in ProxiPilot, not synced to provider)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    is_starred: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Counts (denormalized for O(1) list queries — updated on message ingestion)
    message_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unread_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Timestamps using DateTime(timezone=True) for proper indexed sorting
    first_message_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
        comment="UTC timestamp of the first message in this thread",
    )
    latest_message_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
        index=True,
        comment="UTC timestamp of the latest accepted message — primary sort key for inbox list",
    )

    # Relationships
    messages: Mapped[List["EmailMessage"]] = relationship(
        back_populates="thread", cascade="all, delete-orphan"
    )

    __table_args__ = (
        # Race-safe upsert: prevents duplicate threads per (org, account, thread)
        UniqueConstraint(
            "tenant_id",
            "integration_account_id",
            "external_thread_id",
            name="uq_email_threads_tenant_account_thread",
        ),
        # Composite index for inbox list keyset pagination query
        Index(
            "ix_email_threads_tenant_account_latest",
            "tenant_id",
            "integration_account_id",
            "latest_message_at",
        ),
    )

    def __repr__(self) -> str:
        return f"<EmailThread id={self.id} status={self.status} intent={self.lead_intent}>"


class EmailMessage(Base, TenantAwareMixin):
    """An individual email message within a thread.

    Phase 4 storage policy:
    - body_text: Normalized plain text only. No HTML. No MIME. No base64.
    - subject: NOT stored here. Subject is on EmailThread only.
    - body_html: NOT stored. Ever.
    - raw_headers: NOT stored. Only minimal RFC threading fields.
    - sent_at: DateTime(timezone=True) for correct chronological ordering.

    Ingestion idempotency: (integration_account_id, external_message_id) must be unique.
    """

    __tablename__ = "email_messages"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"msg_{uuid.uuid4().hex}",
    )
    # tenant_id comes from TenantAwareMixin
    thread_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("email_threads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    integration_account_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("connected_integration_accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    external_message_id: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
        index=True,
        comment="Provider message ID (e.g. Gmail messageId). Used for idempotent ingestion.",
    )

    # Message direction
    direction: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=MessageDirection.INBOUND.value,
        comment="inbound | outbound",
    )

    # Sender / recipient headers
    from_email: Mapped[str] = mapped_column(String(320), nullable=False)
    from_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, default=None)
    to_emails: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        default=None,
        comment="JSON array of recipient email addresses",
    )
    cc_emails: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        default=None,
        comment="JSON array of CC email addresses",
    )
    bcc_emails: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        default=None,
        comment="JSON array of BCC email addresses (if available)",
    )
    reply_to_email: Mapped[Optional[str]] = mapped_column(String(320), nullable=True, default=None)

    # Body — plain text ONLY, normalized. No HTML, no MIME garbage.
    body_text: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        default=None,
        comment="Normalized plain-text body. Quote chains removed. AI-ready.",
    )

    # Timing — proper datetime for correct ordering
    sent_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
        index=True,
        comment="UTC timestamp from email Date header",
    )

    # Minimal RFC reply-threading metadata
    message_id_header: Mapped[Optional[str]] = mapped_column(
        String(998),
        nullable=True,
        default=None,
        comment="RFC 2822 Message-ID header value (for reply chaining)",
    )
    in_reply_to_external_id: Mapped[Optional[str]] = mapped_column(
        String(512),
        nullable=True,
        default=None,
        comment="external_message_id of the message this replies to",
    )
    references_header: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        default=None,
        comment="RFC 2822 References header value (full threading chain)",
    )

    # Filter observability — records why a message was classified (if stored)
    filter_reason: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
        comment="FilterDecision value that allowed this message through (ACCEPT or body-stage)",
    )

    # Relationships
    thread: Mapped["EmailThread"] = relationship(back_populates="messages")
    attachments: Mapped[List["AttachmentMetadata"]] = relationship(
        back_populates="message", cascade="all, delete-orphan"
    )

    __table_args__ = (
        # Idempotency constraint — prevents duplicate messages at DB level
        UniqueConstraint(
            "integration_account_id",
            "external_message_id",
            name="uq_email_messages_account_message_id",
        ),
        # Composite index for thread detail query (chronological order)
        Index(
            "ix_email_messages_tenant_thread_sent",
            "tenant_id",
            "thread_id",
            "sent_at",
        ),
    )

    def __repr__(self) -> str:
        return f"<EmailMessage id={self.id} from={self.from_email} direction={self.direction}>"


class AttachmentMetadata(Base, TenantAwareMixin):
    """Metadata for email attachments. Binary stored in Object Storage.

    Invariant: Binary content is NEVER stored in Postgres.
    Only metadata and the storage_object_key reference are stored here.
    """

    __tablename__ = "attachment_metadata"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"att_{uuid.uuid4().hex}",
    )
    # tenant_id comes from TenantAwareMixin
    message_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("email_messages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    mime_type: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, default=None)
    size_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, default=None)
    storage_object_key: Mapped[Optional[str]] = mapped_column(
        String(2048),
        nullable=True,
        default=None,
        comment="Object storage key (S3/GCS/Azure path) for binary retrieval",
    )
    is_inline: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="True if attachment is embedded inline in HTML body",
    )

    # Relationships
    message: Mapped["EmailMessage"] = relationship(back_populates="attachments")

    def __repr__(self) -> str:
        return f"<AttachmentMetadata id={self.id} filename={self.filename}>"


class TrustedSender(Base, TimestampMixin):
    """Organization-level sender/domain allowlist.

    Trusted senders bypass promotional/advertisement heuristics.
    SPAM label still blocks even trusted senders.

    Phase 4: Table exists, management UI is a future phase.
    The filter pipeline queries this table; empty table = no allowlist effect.
    """

    __tablename__ = "trusted_senders"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"trs_{uuid.uuid4().hex}",
    )
    tenant_id: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        comment="Organization ID this allowlist entry belongs to",
    )
    email: Mapped[Optional[str]] = mapped_column(
        String(320),
        nullable=True,
        default=None,
        comment="Trust specific email address (e.g. billing@stripe.com)",
    )
    domain: Mapped[Optional[str]] = mapped_column(
        String(253),
        nullable=True,
        default=None,
        comment="Trust all senders from this domain (e.g. customer-company.com)",
    )
    created_by_user_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
    )

    __table_args__ = (
        UniqueConstraint("tenant_id", "email", name="uq_trusted_senders_tenant_email"),
        UniqueConstraint("tenant_id", "domain", name="uq_trusted_senders_tenant_domain"),
    )

    def __repr__(self) -> str:
        return f"<TrustedSender tenant={self.tenant_id} email={self.email} domain={self.domain}>"
