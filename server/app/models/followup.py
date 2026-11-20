"""Conversation intelligence & follow-ups.

Postgres is the durable source of truth for:
  * ``FollowupPolicy``          workspace timing defaults (never permission to email customers)
  * ``ThreadFollowupControl``   per-conversation switches + manual overrides (customer email OFF by default)
  * ``MessageAssessment``       one AI #2 assessment per (message, prompt version), immutable history
  * ``ThreadFollowupState``     the current effective decision per conversation (revision-fenced)
  * ``ContactSuppression``      evidenced do-not-contact restrictions (tenant-scoped, survive retries)
  * ``FollowupOccurrence``      a scheduled follow-up step (team reminder; optional customer email)
  * ``FollowupNoticeDelivery``  one internal notice per occurrence / notice type / team member

Three independent controls (thread level, inherited where null):
  automatic lead assessment | automatic follow-up planning & team reminders | automatically email customer
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantAwareMixin

PROMPT_VERSION = "followup-assess-v1"


def _id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex}"


class FollowupPolicy(Base, TenantAwareMixin):
    __tablename__ = "followup_policies"
    __table_args__ = (UniqueConstraint("tenant_id", name="uq_followup_policy_tenant"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: _id("fpol"))
    assessment_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("true"))
    planning_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("true"))
    cadence_hot_days: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    cadence_warm_days: Mapped[int] = mapped_column(Integer, nullable=False, default=3, server_default="3")
    cadence_cold_days: Mapped[int] = mapped_column(Integer, nullable=False, default=7, server_default="7")
    workdays: Mapped[str] = mapped_column(String(32), nullable=False, default="0,1,2,3,4", server_default="0,1,2,3,4")
    send_window_start: Mapped[str] = mapped_column(String(5), nullable=False, default="09:00", server_default="09:00")
    send_window_end: Mapped[str] = mapped_column(String(5), nullable=False, default="18:00", server_default="18:00")
    default_local_time: Mapped[str] = mapped_column(String(5), nullable=False, default="10:00", server_default="10:00")
    advance_notice_days: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=3, server_default="3")
    min_spacing_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=24, server_default="24")
    timezone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    # 'shadow' = observe only (assess + record, never act) | 'active'
    mode: Mapped[str] = mapped_column(String(16), nullable=False, default="shadow", server_default="shadow")
    # Workspace admins must allow automatic customer email before members can enable it per conversation.
    customer_email_allowed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False,
                                                         server_default=text("false"))
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    updated_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)


class ThreadFollowupControl(Base, TenantAwareMixin):
    __tablename__ = "thread_followup_controls"

    thread_id: Mapped[str] = mapped_column(String(64), ForeignKey("email_threads.id", ondelete="CASCADE"),
                                           primary_key=True)
    assessment_enabled: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)   # null = inherit policy
    planning_enabled: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)     # null = inherit policy
    customer_email_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False,
                                                         server_default=text("false"))
    customer_recipient_email: Mapped[Optional[str]] = mapped_column(String(320), nullable=True)
    customer_email_enabled_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    customer_email_enabled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    manual_temperature: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    manual_temperature_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    manual_temperature_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    manual_due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    manual_due_tz: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    manual_due_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    manual_interval_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    manual_max_attempts: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    manual_notice_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    snoozed_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    completed_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")


class MessageAssessment(Base, TenantAwareMixin):
    __tablename__ = "message_assessments"
    __table_args__ = (
        UniqueConstraint("thread_id", "message_id", "prompt_version", name="uq_assessment_message_version"),
        Index("ix_assessment_thread_created", "tenant_id", "thread_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: _id("asm"))
    thread_id: Mapped[str] = mapped_column(String(64), ForeignKey("email_threads.id", ondelete="CASCADE"),
                                           nullable=False)
    message_id: Mapped[str] = mapped_column(String(64), nullable=False)
    message_sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    prompt_version: Mapped[str] = mapped_column(String(48), nullable=False, default=PROMPT_VERSION)
    model: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")  # pending|valid|invalid|failed
    applied: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    not_applied_reason: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    suggested_temperature: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    label_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    buying_interest: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    outcome: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    next_actor: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    decision: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    result: Mapped[Optional[Any]] = mapped_column(JSONB, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    latency_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)


class ThreadFollowupState(Base, TenantAwareMixin):
    __tablename__ = "thread_followup_states"
    __table_args__ = (
        Index("ix_followup_state_status", "tenant_id", "status"),
        Index("ix_followup_state_due", "tenant_id", "due_at"),
    )

    thread_id: Mapped[str] = mapped_column(String(64), ForeignKey("email_threads.id", ondelete="CASCADE"),
                                           primary_key=True)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    last_message_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    last_message_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_assessment_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    suggested_temperature: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    effective_temperature: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    temperature_source: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)   # ai|manual|legacy
    temperature_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    outcome: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    next_actor: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    next_action: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    decision: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    # open|scheduled|deferred|waiting_team|needs_review|closed|suppressed|stopped|none
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="none", server_default="none")
    opportunities: Mapped[Optional[Any]] = mapped_column(JSONB, nullable=True)
    due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    due_tz: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    due_precision: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    due_source: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    due_phrase: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notice_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    needs_review: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    review_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    stale: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    stale_reason: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    sequence_anchor_message_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    attempts_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    # A set follow-up time is locked; a different time proposed by AI #2 waits here for a person.
    suggested_due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    suggested_due_tz: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    suggested_due_phrase: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    suggested_due_source: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    suggested_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class ContactSuppression(Base, TenantAwareMixin):
    __tablename__ = "contact_suppressions"
    __table_args__ = (
        Index("ix_suppression_lookup", "tenant_id", "recipient_email"),
        Index("uq_suppression_active", "tenant_id", "recipient_email", "scope", unique=True,
              postgresql_where=text("lifted_at IS NULL")),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: _id("sup"))
    recipient_email: Mapped[str] = mapped_column(String(320), nullable=False)
    scope: Mapped[str] = mapped_column(String(16), nullable=False)   # all | email | until
    until_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    thread_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    source_message_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    quote: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    lifted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    lifted_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)


class FollowupOccurrence(Base, TenantAwareMixin):
    __tablename__ = "followup_occurrences"
    __table_args__ = (
        UniqueConstraint("thread_id", "anchor_message_id", "step", name="uq_occurrence_anchor_step"),
        Index("ix_occurrence_due", "status", "due_at"),
        Index("ix_occurrence_notice", "status", "notice_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: _id("fuo"))
    thread_id: Mapped[str] = mapped_column(String(64), ForeignKey("email_threads.id", ondelete="CASCADE"),
                                           nullable=False)
    anchor_message_id: Mapped[str] = mapped_column(String(64), nullable=False)
    step: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    origin: Mapped[str] = mapped_column(String(16), nullable=False)          # ai | customer_date | cadence | user
    scheduled_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    notice_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    tz: Mapped[str] = mapped_column(String(64), nullable=False, default="UTC")
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # scheduled|cancelled|superseded|done|held
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="scheduled")
    advance_status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")  # pending|done|skipped
    due_notice_status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    # not_applicable|pending|sending|sent|held|failed|unknown
    customer_status: Mapped[str] = mapped_column(String(16), nullable=False, default="not_applicable")
    state_revision: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    recipient_email: Mapped[Optional[str]] = mapped_column(String(320), nullable=True)
    outbound_message_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    hold_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    lease_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class FollowupNoticeDelivery(Base, TenantAwareMixin):
    __tablename__ = "followup_notice_deliveries"
    __table_args__ = (
        UniqueConstraint("occurrence_id", "notice_type", "email", name="uq_notice_recipient"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: _id("fnd"))
    occurrence_id: Mapped[str] = mapped_column(String(64), ForeignKey("followup_occurrences.id", ondelete="CASCADE"),
                                               nullable=False, index=True)
    notice_type: Mapped[str] = mapped_column(String(16), nullable=False)    # advance | due
    user_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    # pending|accepted|logged|failed|unknown
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
