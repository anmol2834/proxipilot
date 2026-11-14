"""Feedback & Outcome Memory (Memory 7).

``draft_feedback``      Every human judgement on an AI draft: approved as-is, edited,
                        rejected (with reason), or replaced by a human-written reply
                        (detected implicitly from Gmail). Stores original + final text.
``response_outcomes``   What happened after a reply was sent: the customer's next
                        message classified as positive / negative / follow-up question.
                        One outcome per sent message.
``feedback_lessons``    Tenant-specific drafting rules learned from feedback (derived
                        from repeated patterns) or written by employees. Active lessons
                        are injected into every future draft.
"""

from enum import Enum
from typing import Optional
import uuid

from sqlalchemy import Float, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantAwareMixin


class FeedbackAction(str, Enum):
    APPROVED = "approved"                    # sent / accepted without changes
    EDITED = "edited"                        # accepted after human edits
    REJECTED = "rejected"                    # explicitly rejected
    REPLACED_BY_HUMAN = "replaced_by_human"  # human wrote a substantially different reply
    HUMAN_REPLY = "human_reply"              # human reply with no AI draft involved


class FeedbackReason(str, Enum):
    WRONG_FACTS = "wrong_facts"
    MISSING_INFO = "missing_info"
    WRONG_TONE = "wrong_tone"
    TOO_LONG = "too_long"
    TOO_SHORT = "too_short"
    OFF_TOPIC = "off_topic"
    POLICY = "policy"
    OTHER = "other"


class OutcomeType(str, Enum):
    POSITIVE = "positive"
    NEGATIVE = "negative"
    FOLLOW_UP_QUESTION = "follow_up_question"
    NEUTRAL = "neutral"


class LessonStatus(str, Enum):
    ACTIVE = "active"
    SUGGESTED = "suggested"
    DISABLED = "disabled"


class DraftFeedback(Base, TenantAwareMixin):
    __tablename__ = "draft_feedback"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: f"fb_{uuid.uuid4().hex}")
    ai_response_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    thread_id: Mapped[str] = mapped_column(String(64), nullable=False)
    message_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, comment="Human reply message, if any")
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    channel: Mapped[str] = mapped_column(String(32), nullable=False, comment="review_api | gmail_implicit")
    reviewer_user_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    reason_code: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    intent: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    original_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    final_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    similarity: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="0..1 draft vs final")
    length_ratio: Mapped[Optional[float]] = mapped_column(Float, nullable=True, comment="final words / draft words")

    __table_args__ = (
        Index("ix_draft_feedback_tenant_created", "tenant_id", "created_at"),
        Index("ix_draft_feedback_tenant_action", "tenant_id", "action"),
        Index("ix_draft_feedback_tenant_intent", "tenant_id", "intent"),
        UniqueConstraint("tenant_id", "ai_response_id", "message_id", name="uq_draft_feedback_response_message"),
    )


class ResponseOutcome(Base, TenantAwareMixin):
    __tablename__ = "response_outcomes"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: f"ro_{uuid.uuid4().hex}")
    thread_id: Mapped[str] = mapped_column(String(64), nullable=False)
    sent_message_id: Mapped[str] = mapped_column(String(64), nullable=False, comment="Outbound email_messages.id")
    customer_message_id: Mapped[str] = mapped_column(String(64), nullable=False)
    sent_by: Mapped[str] = mapped_column(String(16), nullable=False, comment="ai | human")
    ai_response_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    outcome: Mapped[str] = mapped_column(String(32), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.5)
    signals: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="JSON list of matched cues")
    response_latency_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "sent_message_id", name="uq_response_outcomes_sent_message"),
        Index("ix_response_outcomes_tenant_outcome", "tenant_id", "outcome"),
    )


class FeedbackLesson(Base, TenantAwareMixin):
    __tablename__ = "feedback_lessons"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: f"fl_{uuid.uuid4().hex}")
    instruction: Mapped[str] = mapped_column(Text, nullable=False)
    scope_intent: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, comment="NULL = all replies")
    origin: Mapped[str] = mapped_column(String(16), nullable=False, comment="employee | derived")
    derived_key: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    evidence_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=LessonStatus.ACTIVE.value)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    created_by_user_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "derived_key", name="uq_feedback_lessons_derived_key"),
        Index("ix_feedback_lessons_tenant_status", "tenant_id", "status"),
    )
