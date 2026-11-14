"""Decision & Commitment Memory (Memory 6).

One table holds three kinds of business memory, each with an owner, a lifecycle and
provenance:

``commitment``   a promise someone made ("we will send the revised quote by Friday",
                 "we'll share the PO on Monday"). ``owed_by`` says which side owes it.
``decision``     something decided / approved ("10% discount approved for orders above
                 50 units — approved by Ravi"). In force while ``status = open``.
``action_item``  a pending task / responsibility that is not a promise to the other side.

Lifecycle: open -> fulfilled | cancelled | superseded (by a newer item, kept as history).
"Overdue" is derived (open and due_at in the past), so it can never be stale.
"""

from datetime import datetime
from enum import Enum
from typing import Optional
import uuid

from sqlalchemy import DateTime, Float, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantAwareMixin


class CommitmentKind(str, Enum):
    COMMITMENT = "commitment"
    DECISION = "decision"
    ACTION_ITEM = "action_item"


class CommitmentParty(str, Enum):
    COMPANY = "company"      # our business owes it
    CUSTOMER = "customer"    # the external counterparty owes it
    INTERNAL = "internal"    # internal responsibility / decision


class CommitmentStatus(str, Enum):
    OPEN = "open"
    FULFILLED = "fulfilled"
    CANCELLED = "cancelled"
    SUPERSEDED = "superseded"


class CommitmentCategory(str, Enum):
    QUOTE = "quote"
    PRICING = "pricing"
    DISCOUNT = "discount"
    DELIVERY = "delivery"
    DOCUMENT = "document"
    CALLBACK = "callback"
    MEETING = "meeting"
    PAYMENT = "payment"
    ORDER = "order"
    SUPPORT = "support"
    POLICY = "policy"
    OTHER = "other"


class Commitment(Base, TenantAwareMixin):
    __tablename__ = "commitments"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: f"cm_{uuid.uuid4().hex}")
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    owed_by: Mapped[str] = mapped_column(String(16), nullable=False)
    category: Mapped[str] = mapped_column(String(16), nullable=False, default=CommitmentCategory.OTHER.value)
    statement: Mapped[str] = mapped_column(Text, nullable=False)
    statement_key: Mapped[str] = mapped_column(String(255), nullable=False, comment="Normalised for dedupe")
    thread_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    counterparty_email: Mapped[Optional[str]] = mapped_column(String(320), nullable=True)
    owner_email: Mapped[Optional[str]] = mapped_column(String(320), nullable=True, comment="Responsible person")
    owner_user_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    approved_by: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    due_text: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=CommitmentStatus.OPEN.value)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    source_type: Mapped[str] = mapped_column(String(32), nullable=False, comment="email_outbound|email_inbound|employee")
    source_message_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_by: Mapped[Optional[str]] = mapped_column(String(320), nullable=True)
    resolution_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resolution_message_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    superseded_by_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_by_user_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "source_message_id", "statement_key", name="uq_commitments_source_statement"),
        Index("ix_commitments_tenant_status_due", "tenant_id", "status", "due_at"),
        Index("ix_commitments_tenant_thread_status", "tenant_id", "thread_id", "status"),
        Index("ix_commitments_tenant_counterparty_status", "tenant_id", "counterparty_email", "status"),
    )
