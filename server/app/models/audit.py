"""Audit Domain Models — Enterprise Audit Event System.

Core Invariants:
- Immutable audit event trail for security, compliance, and tenant activity.
- organization_id is NULL for system or pre-tenant actions (e.g. signup before org creation).
- actor_user_id is NULL for autonomous system worker operations.
- Metadata is strictly scrubbed of secrets (passwords, tokens, OTPs, keys).
- Optimized indexing on (organization_id, created_at) and (resource_type, resource_id).
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional, TYPE_CHECKING
import uuid
from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

if TYPE_CHECKING:
    from app.models.organization import Organization, User


class AuditAction(str, Enum):
    """Canonical audit action taxonomy."""

    USER_SIGNED_IN = "USER_SIGNED_IN"
    USER_SIGNED_OUT = "USER_SIGNED_OUT"
    EMAIL_VERIFIED = "EMAIL_VERIFIED"
    PASSWORD_RESET = "PASSWORD_RESET"
    ORGANIZATION_CREATED = "ORGANIZATION_CREATED"
    ORGANIZATION_UPDATED = "ORGANIZATION_UPDATED"
    MEMBERSHIP_CREATED = "MEMBERSHIP_CREATED"
    ROLE_CHANGED = "ROLE_CHANGED"
    MEMBERSHIP_STATUS_CHANGED = "MEMBERSHIP_STATUS_CHANGED"
    BUSINESS_PROFILE_CREATED = "BUSINESS_PROFILE_CREATED"
    BUSINESS_PROFILE_UPDATED = "BUSINESS_PROFILE_UPDATED"
    WORKSPACE_PREFERENCES_UPDATED = "WORKSPACE_PREFERENCES_UPDATED"
    KNOWLEDGE_CREATED = "KNOWLEDGE_CREATED"
    KNOWLEDGE_UPDATED = "KNOWLEDGE_UPDATED"
    KNOWLEDGE_DELETED = "KNOWLEDGE_DELETED"
    KNOWLEDGE_VERSION_CREATED = "KNOWLEDGE_VERSION_CREATED"
    KNOWLEDGE_VERSION_ACTIVATED = "KNOWLEDGE_VERSION_ACTIVATED"
    KNOWLEDGE_VERSION_PUBLISHED = "KNOWLEDGE_VERSION_PUBLISHED"
    KNOWLEDGE_VERSION_ARCHIVED = "KNOWLEDGE_VERSION_ARCHIVED"
    KNOWLEDGE_ROLLED_BACK = "KNOWLEDGE_ROLLED_BACK"
    CONTACT_UPDATED = "CONTACT_UPDATED"
    CONTACT_FACT_ADDED = "CONTACT_FACT_ADDED"
    CONTACT_FACT_RETRACTED = "CONTACT_FACT_RETRACTED"
    CONTACT_MEMORY_REBUILT = "CONTACT_MEMORY_REBUILT"
    DRAFT_FEEDBACK_RECORDED = "DRAFT_FEEDBACK_RECORDED"
    FEEDBACK_LESSON_CHANGED = "FEEDBACK_LESSON_CHANGED"
    COMMITMENT_CREATED = "COMMITMENT_CREATED"
    COMMITMENT_UPDATED = "COMMITMENT_UPDATED"
    STYLE_PROFILE_UPDATED = "STYLE_PROFILE_UPDATED"
    STYLE_REBUILT = "STYLE_REBUILT"
    PRACTICE_CHANGED = "PRACTICE_CHANGED"
    PRACTICES_MINED = "PRACTICES_MINED"
    THREAD_MEMORY_UPDATED = "THREAD_MEMORY_UPDATED"
    KNOWLEDGE_REPLACED = "KNOWLEDGE_REPLACED"
    KNOWLEDGE_IMPORTED = "KNOWLEDGE_IMPORTED"
    KNOWLEDGE_SOURCE_CREATED = "KNOWLEDGE_SOURCE_CREATED"
    KNOWLEDGE_SOURCE_UPDATED = "KNOWLEDGE_SOURCE_UPDATED"
    KNOWLEDGE_SOURCE_ARCHIVED = "KNOWLEDGE_SOURCE_ARCHIVED"
    KNOWLEDGE_SOURCE_REVOKED = "KNOWLEDGE_SOURCE_REVOKED"
    KNOWLEDGE_IMPORT_CREATED = "KNOWLEDGE_IMPORT_CREATED"
    KNOWLEDGE_IMPORT_STARTED = "KNOWLEDGE_IMPORT_STARTED"
    KNOWLEDGE_IMPORT_COMPLETED = "KNOWLEDGE_IMPORT_COMPLETED"
    KNOWLEDGE_IMPORT_FAILED = "KNOWLEDGE_IMPORT_FAILED"
    KNOWLEDGE_IMPORT_CANCELLED = "KNOWLEDGE_IMPORT_CANCELLED"
    KNOWLEDGE_FILE_UPLOADED = "KNOWLEDGE_FILE_UPLOADED"
    KNOWLEDGE_FILE_REJECTED = "KNOWLEDGE_FILE_REJECTED"
    GMAIL_CONNECTED = "GMAIL_CONNECTED"
    GMAIL_DISCONNECTED = "GMAIL_DISCONNECTED"
    GMAIL_WATCH_CREATED = "GMAIL_WATCH_CREATED"
    GMAIL_WATCH_RENEWED = "GMAIL_WATCH_RENEWED"
    GMAIL_FULL_SYNC_COMPLETED = "GMAIL_FULL_SYNC_COMPLETED"
    GMAIL_REAUTH_REQUIRED = "GMAIL_REAUTH_REQUIRED"
    SESSION_REVOKED = "SESSION_REVOKED"


class AuditActorType(str, Enum):
    """Originator of the audited action."""

    USER = "USER"
    SYSTEM = "SYSTEM"


class AuditEvent(Base):
    """Immutable record of an administrative, domain, or authentication event."""

    __tablename__ = "audit_events"
    __table_args__ = (
        Index("ix_audit_events_org_created", "organization_id", "created_at"),
        Index("ix_audit_events_resource", "resource_type", "resource_id"),
    )

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"aud_{uuid.uuid4().hex}",
    )
    organization_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    actor_user_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    organization: Mapped[Optional["Organization"]] = relationship(
        "Organization",
        back_populates="audit_events",
        foreign_keys=[organization_id],
    )
    actor_user: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[actor_user_id],
    )
    actor_type: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=AuditActorType.USER.value,
    )
    action: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
    )
    resource_type: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
    )
    resource_id: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        index=True,
    )
    metadata_: Mapped[dict] = mapped_column(
        "metadata",
        JSONB,
        nullable=False,
        default=dict,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    def __repr__(self) -> str:
        return (
            f"<AuditEvent id={self.id} action={self.action} "
            f"org={self.organization_id} actor={self.actor_user_id}>"
        )
