"""Contact & Relationship Memory (Memory 4).

Two tenant-scoped tables:

``contacts``
    One row per external party (customer, supplier, partner, …) per organization,
    keyed by normalized email. Holds identity, relationship classification, and
    interaction statistics. Statistics are a *projection* of ``email_messages`` (the
    source of truth): they are maintained incrementally on ingestion and can always be
    recomputed exactly (``ContactMemoryService.rebuild_stats``).

``contact_facts``
    Long-term knowledge about a contact (preferences, interests, needs, open issues,
    attributes, employee notes) with provenance, confidence and history. Facts are
    never overwritten in place: a newer value for the same single-valued key
    *supersedes* the previous one (kept for history). Employee-authored facts
    outrank AI-inferred ones and cannot be superseded by AI inference.
"""

from datetime import datetime
from enum import Enum
from typing import Optional
import uuid

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
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantAwareMixin


class ContactType(str, Enum):
    CUSTOMER = "customer"
    PROSPECT = "prospect"
    SUPPLIER = "supplier"
    PARTNER = "partner"
    INTERNAL = "internal"
    UNKNOWN = "unknown"


class ContactFactType(str, Enum):
    PREFERENCE = "preference"   # e.g. preferred_language=Hindi, prefers_whatsapp=yes
    INTEREST = "interest"       # products / services the contact asked about
    NEED = "need"               # stated requirement, e.g. "bulk order of 200 units"
    ISSUE = "issue"             # complaint / open problem
    ATTRIBUTE = "attribute"     # last_intent, lead_temperature, city, budget …
    NOTE = "note"               # free-text employee note


class ContactFactSource(str, Enum):
    EMPLOYEE = "employee"       # authored / confirmed by a human — highest authority
    EMAIL = "email"             # stated explicitly by the contact in an email
    AI_INFERENCE = "ai_inference"  # derived by the AI pipeline


class ContactFactStatus(str, Enum):
    ACTIVE = "active"
    SUPERSEDED = "superseded"
    RETRACTED = "retracted"


# Authority order used for conflict resolution (higher wins).
FACT_SOURCE_AUTHORITY = {
    ContactFactSource.EMPLOYEE.value: 3,
    ContactFactSource.EMAIL.value: 2,
    ContactFactSource.AI_INFERENCE.value: 1,
}


class Contact(Base, TenantAwareMixin):
    __tablename__ = "contacts"

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=lambda: f"ct_{uuid.uuid4().hex}"
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False, comment="Lower-cased, trimmed")
    display_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    domain: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    contact_type: Mapped[str] = mapped_column(
        String(32), nullable=False, default=ContactType.UNKNOWN.value
    )
    # True when an employee set contact_type explicitly (automation never overrides it).
    type_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    company_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    job_title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    preferred_language: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    tags: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="JSON array of strings")
    lead_temperature: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    last_intent: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    is_blocked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Interaction statistics (projection of email_messages)
    inbound_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    outbound_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    first_interaction_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_interaction_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_inbound_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_outbound_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "email", name="uq_contacts_tenant_email"),
        Index("ix_contacts_tenant_last_interaction", "tenant_id", "last_interaction_at"),
        Index("ix_contacts_tenant_type", "tenant_id", "contact_type"),
    )


class ContactFact(Base, TenantAwareMixin):
    __tablename__ = "contact_facts"

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=lambda: f"cf_{uuid.uuid4().hex}"
    )
    contact_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False
    )
    fact_type: Mapped[str] = mapped_column(String(32), nullable=False)
    key: Mapped[str] = mapped_column(String(128), nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    # Lower-cased, whitespace-collapsed value used for de-duplication.
    value_normalized: Mapped[str] = mapped_column(String(512), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    source_type: Mapped[str] = mapped_column(String(32), nullable=False)
    source_ref: Mapped[Optional[str]] = mapped_column(
        String(128), nullable=True, comment="email_message id / user id / knowledge item id"
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=ContactFactStatus.ACTIVE.value
    )
    superseded_by_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    occurrences: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_by_user_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    __table_args__ = (
        Index("ix_contact_facts_tenant_contact_status", "tenant_id", "contact_id", "status"),
        Index("ix_contact_facts_lookup", "contact_id", "key", "value_normalized"),
    )
