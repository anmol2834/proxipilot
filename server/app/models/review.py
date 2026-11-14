"""Human Review Domain Model.

Tables owned by this module:
- human_reviews: Triage records routing AI responses to human reviewers

Architectural rules:
- HumanReview is created when AI confidence_score < threshold OR policy violations detected.
- A HumanReview is always linked to exactly one AIResponse.
- Resolution = either approving the AI draft or overriding it with a manual response.
- SLA priority determines queue ordering for the review dashboard.
- Assignment is optional; unassigned reviews appear in the global review queue.
"""

import uuid
from enum import Enum
from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TenantAwareMixin, TimestampMixin


class TriageReason(str, Enum):
    """Reason why a response was escalated to human review."""

    LOW_CONFIDENCE = "low_confidence"              # AI confidence score below threshold
    POLICY_VIOLATION = "policy_violation"          # Response failed policy validation
    SENSITIVE_TOPIC = "sensitive_topic"            # Topic flagged as requiring human judgment
    HIGH_VALUE_LEAD = "high_value_lead"            # Hot lead requiring personal touch
    CUSTOM_RULE = "custom_rule"                    # User-defined escalation rule triggered
    MANUAL_ESCALATION = "manual_escalation"        # Manually escalated by another reviewer
    FIRST_CONTACT = "first_contact"                # Organization configured to review first contacts


class ReviewPriority(str, Enum):
    """SLA priority levels for review queue ordering."""

    CRITICAL = "critical"    # Must be reviewed immediately (e.g. enterprise lead)
    HIGH = "high"            # Review within 1 hour
    MEDIUM = "medium"        # Review within 4 hours
    LOW = "low"              # Review within 24 hours


class ReviewStatus(str, Enum):
    """Lifecycle status of a human review record."""

    OPEN = "open"                        # In queue, awaiting reviewer assignment
    ASSIGNED = "assigned"                # Assigned to a specific reviewer
    IN_REVIEW = "in_review"              # Reviewer is actively working on it
    APPROVED = "approved"                # AI draft approved and dispatched
    REJECTED = "rejected"                # AI draft rejected; manual reply needed
    OVERRIDDEN = "overridden"            # Reviewer wrote a completely new response
    CLOSED = "closed"                    # Resolved without dispatch (ignored/archived)


class HumanReview(Base, TenantAwareMixin):
    """Triage and review record linking an AI response to a human reviewer.

    Created automatically when AI pipeline determines human oversight is required.
    The HumanReview drives the review dashboard queue and SLA tracking.

    One HumanReview per AIResponse (one-to-one relationship).
    """

    __tablename__ = "human_reviews"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"rev_{uuid.uuid4().hex}",
    )
    # tenant_id comes from TenantAwareMixin
    ai_response_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("ai_responses.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
        comment="The AI-generated response draft being reviewed. One-to-one.",
    )
    thread_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("email_threads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ai_run_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("ai_runs.id", ondelete="SET NULL"),
        nullable=True,
        default=None,
        index=True,
    )

    # Triage context
    triage_reason: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        comment="Primary reason this review was created",
    )
    triage_context: Mapped[str] = mapped_column(
        Text,
        nullable=True,
        default=None,
        comment="Additional context JSON explaining the triage decision",
    )
    confidence_score_at_triage: Mapped[float] = mapped_column(
        default=None,
        nullable=True,
        comment="AI confidence score at the time this review was created",
    )

    # SLA and assignment
    priority: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=ReviewPriority.MEDIUM,
        index=True,
    )
    assigned_to_user_id: Mapped[str] = mapped_column(
        String(64),
        nullable=True,
        default=None,
        index=True,
        comment="User assigned to review this item. NULL = in global queue.",
    )
    assigned_at: Mapped[str] = mapped_column(String(64), nullable=True, default=None)

    # Review lifecycle
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=ReviewStatus.OPEN,
        index=True,
    )

    # Resolution
    reviewed_by_user_id: Mapped[str] = mapped_column(String(64), nullable=True, default=None)
    reviewer_notes: Mapped[str] = mapped_column(
        Text,
        nullable=True,
        default=None,
        comment="Free-text notes from the reviewer explaining their decision",
    )
    override_body: Mapped[str] = mapped_column(
        Text,
        nullable=True,
        default=None,
        comment="Full manual response body if reviewer chose to override the AI draft",
    )
    resolved_at: Mapped[str] = mapped_column(
        String(64),
        nullable=True,
        default=None,
        index=True,
    )

    # SLA tracking
    sla_deadline_at: Mapped[str] = mapped_column(
        String(64),
        nullable=True,
        default=None,
        comment="Computed SLA deadline based on priority. NULL = no SLA configured.",
    )
    sla_breached: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
        comment="True if resolved_at > sla_deadline_at",
    )

    def __repr__(self) -> str:
        return (
            f"<HumanReview id={self.id} status={self.status} "
            f"priority={self.priority} reason={self.triage_reason}>"
        )
