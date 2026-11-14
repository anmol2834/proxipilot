"""SQLAlchemy Declarative Base and Multi-Tenant Mixins.

Rules:
- All tenant-scoped entities MUST inherit from TenantAwareMixin.
- Automatic indexed tenant_id column enforces tenant isolation.
- Timestamps standardized in UTC.
"""

from datetime import datetime, timezone
from sqlalchemy import DateTime, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Root Declarative Base for ProxiPilot SQLAlchemy models."""

    pass


class TimestampMixin:
    """Standardized UTC creation and update audit timestamps."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class TenantAwareMixin(TimestampMixin):
    """Enforces multi-tenant data isolation at the database schema level.

    Every query for a tenant-aware table MUST filter by tenant_id.
    """

    tenant_id: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
    )
