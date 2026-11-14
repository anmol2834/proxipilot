"""Thread & Conversation Memory (Memory 3).

One row per email thread: an incrementally maintained memory of the whole conversation.

  summary               rolling summary of everything discussed so far
  stage                 enquiry | quoted | negotiating | ordered | fulfilment | issue | closed | other
  customer_requirements JSON [{id, text, status: open|answered|cancelled, since, resolved_by}]
  open_issues           JSON [{text, owner: company|customer}]
  key_facts             JSON [str] — concrete facts stated in the conversation (quantities, sizes, sites ...)
  pinned_notes          employee notes — always shown, never overwritten by the AI
  included_until_*      watermark: the memory covers messages up to here (idempotent updates)
  version               optimistic concurrency token
"""

from datetime import datetime
from typing import Optional
import uuid

from sqlalchemy import DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantAwareMixin


class ThreadMemory(Base, TenantAwareMixin):
    __tablename__ = "thread_memories"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: f"tm_{uuid.uuid4().hex}")
    thread_id: Mapped[str] = mapped_column(String(64), nullable=False)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    stage: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    sentiment: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    language: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    last_customer_ask: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    customer_requirements: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    open_issues: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    key_facts: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    pinned_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    included_until_message_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    included_until_sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    messages_included: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="ok")
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_by_user_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "thread_id", name="uq_thread_memories_thread"),
    )
