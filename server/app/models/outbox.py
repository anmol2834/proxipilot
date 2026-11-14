"""Transactional Outbox Domain Model.

Tables owned by this module:
- outbox_events: Atomic outbox records for durable event acceptance and reliable relay.

Architectural rules:
- OutboxEvent is written within the exact same database transaction as the business entity or provider receipt.
- Ensures zero dual-write inconsistencies between PostgreSQL and Redis Streams.
- The outbox relayer reads pending records in bounded batches and publishes them to Redis Streams with manual acknowledgment.
"""

from datetime import datetime
from enum import Enum
from typing import Optional
import uuid
from sqlalchemy import DateTime, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TenantAwareMixin


class OutboxStatus(str, Enum):
    """Lifecycle status of an outbox event."""

    PENDING = "pending"
    PUBLISHED = "published"
    FAILED = "failed"


class OutboxEvent(Base, TenantAwareMixin):
    """Atomic outbox event for reliable asynchronous publishing to Redis Streams."""

    __tablename__ = "outbox_events"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"out_{uuid.uuid4().hex}",
    )
    # tenant_id comes from TenantAwareMixin (indexed)
    stream_name: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="email_events",
        index=True,
        comment="Destination Redis Stream topic name (without prefix)",
    )
    event_type: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        comment="Domain event type (e.g. gmail.mailbox_change)",
    )
    aggregate_type: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        comment="Domain aggregate type (e.g. integration_account)",
    )
    aggregate_id: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        comment="Primary entity ID this event is about",
    )
    payload: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="JSON-serialized payload dictionary",
    )
    correlation_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
        comment="Distributed tracing correlation ID",
    )
    causation_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
        comment="Triggering provider event ID or causation ID",
    )
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=OutboxStatus.PENDING.value,
        index=True,
        comment="pending | published | failed",
    )
    retry_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Number of times outbox relayer attempted publishing",
    )
    published_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
        comment="UTC timestamp when successfully published to Redis Stream",
    )
    last_error: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        default=None,
        comment="Error message if publishing failed",
    )

    __table_args__ = (
        Index("ix_outbox_events_status_created", "status", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<OutboxEvent id={self.id} event_type={self.event_type} status={self.status}>"
