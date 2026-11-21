"""AI Pipeline Domain Models.

Tables owned by this module:
- ai_runs: One row per AI pipeline execution (linked to an email thread)
- evidence: Retrieved knowledge chunks used to ground a response
- ai_responses: Generated response drafts produced by the AI pipeline

Architectural rules:
- AIRun is the primary audit trail for every AI action. Every AI action is traceable.
- Evidence records link AIRuns to the specific KnowledgeVersion chunks retrieved.
- AIResponse is decoupled from OutboundMessage (dispatch is a separate concern).
- Confidence scoring and policy validation results are stored here, not in the response body.
- No AI decision is taken without a corresponding AIRun record.
"""

import uuid
from enum import Enum
from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TenantAwareMixin, TimestampMixin


class AIPipelineStage(str, Enum):
    """Pipeline stages that an AIRun can be in."""

    EMAIL_UNDERSTANDING = "email_understanding"
    INTENT_EXTRACTION = "intent_extraction"
    KNOWLEDGE_RETRIEVAL = "knowledge_retrieval"
    RESPONSE_PLANNING = "response_planning"
    RESPONSE_GENERATION = "response_generation"
    POLICY_VALIDATION = "policy_validation"
    COMPLETED = "completed"


class AIRunStatus(str, Enum):
    """Execution status of an AI run."""

    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class EvidenceSourceType(str, Enum):
    """Type of source a retrieved evidence chunk came from."""

    KNOWLEDGE_VERSION = "knowledge_version"      # KnowledgeVersion content chunk
    BUSINESS_ENTITY = "business_entity"          # BusinessEntity structured data
    HISTORICAL_THREAD = "historical_thread"      # Prior email thread
    LIVE_API = "live_api"                        # Real-time data from external API
    STRUCTURED_DB = "structured_db"              # Direct Postgres query result


class ResponseApprovalStatus(str, Enum):
    """Human-review approval state for an AI-generated response."""

    PENDING_REVIEW = "pending_review"
    AUTO_APPROVED = "auto_approved"              # Confidence threshold met, no human review needed
    HUMAN_APPROVED = "human_approved"            # Explicitly approved by a human reviewer
    HUMAN_REJECTED = "human_rejected"            # Rejected, requires regeneration or manual reply
    SENT = "sent"                                # Dispatched via OutboundMessage


class AIRun(Base, TenantAwareMixin):
    """Audit record for every AI pipeline execution.

    One AIRun = one complete invocation of the AI pipeline for a given thread.
    Multiple AIRuns can exist for the same thread (retries, re-runs).

    The AIRun is the central audit trail linking email events, knowledge retrieval,
    and response generation into a single traceable chain.
    """

    __tablename__ = "ai_runs"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"air_{uuid.uuid4().hex}",
    )
    # tenant_id comes from TenantAwareMixin
    thread_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("email_threads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    trigger_event_id: Mapped[str] = mapped_column(
        String(128),
        nullable=True,
        default=None,
        comment="DomainEvent.event_id that triggered this AI run (for correlation)",
    )
    correlation_id: Mapped[str] = mapped_column(
        String(128),
        nullable=True,
        default=None,
        comment="End-to-end trace ID for distributed log correlation",
    )

    # Pipeline state
    pipeline_stage: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default=AIPipelineStage.EMAIL_UNDERSTANDING,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=AIRunStatus.QUEUED,
        index=True,
    )

    # AI Model metadata
    model_used: Mapped[str] = mapped_column(
        String(128),
        nullable=True,
        default=None,
        comment="LLM model name (e.g. gpt-4o-mini, gpt-4o)",
    )
    embedding_model_used: Mapped[str] = mapped_column(
        String(128),
        nullable=True,
        default=None,
        comment="Embedding model used for retrieval",
    )

    # Scoring
    confidence_score: Mapped[float] = mapped_column(
        Float,
        nullable=True,
        default=None,
        comment="Overall pipeline confidence score 0.0–1.0",
    )
    confidence_threshold_met: Mapped[bool] = mapped_column(
        Boolean,
        nullable=True,
        default=None,
        comment="Whether confidence_score exceeded the org's configured threshold",
    )

    # Token and cost tracking
    prompt_tokens: Mapped[int] = mapped_column(Integer, nullable=True, default=None)
    completion_tokens: Mapped[int] = mapped_column(Integer, nullable=True, default=None)
    total_tokens: Mapped[int] = mapped_column(Integer, nullable=True, default=None)

    # Performance
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=True, default=None)

    # Error tracking
    error_message: Mapped[str] = mapped_column(Text, nullable=True, default=None)
    error_stage: Mapped[str] = mapped_column(String(64), nullable=True, default=None)

    # Timestamps
    started_at: Mapped[str] = mapped_column(
        String(64), nullable=True, default=None, index=True
    )
    completed_at: Mapped[str] = mapped_column(String(64), nullable=True, default=None)

    # Relationships
    ai_responses: Mapped[list["AIResponse"]] = relationship(
        back_populates="ai_run", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<AIRun id={self.id} thread={self.thread_id} status={self.status}>"


class AIResponse(Base, TenantAwareMixin):
    """AI-generated email response draft.

    Decoupled from OutboundMessage (dispatch is a separate step).
    An AIResponse may be approved and sent, rejected, or regenerated.

    Policy invariant: policy_violations is a JSON array of violation codes.
    If not empty, confidence_threshold_met must be False and human review is required.
    """

    __tablename__ = "ai_responses"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"ares_{uuid.uuid4().hex}",
    )
    # tenant_id comes from TenantAwareMixin
    ai_run_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("ai_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    thread_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("email_threads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Response content
    draft_subject: Mapped[str] = mapped_column(String(998), nullable=True, default=None)
    draft_body: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Full generated response body (HTML or plain text)",
    )
    draft_body_plain: Mapped[str] = mapped_column(
        Text,
        nullable=True,
        default=None,
        comment="Plain text version for non-HTML email clients",
    )

    # Generation metadata
    tone: Mapped[str] = mapped_column(
        String(64),
        nullable=True,
        default=None,
        comment="Detected/applied tone: professional | friendly | formal | neutral",
    )
    language: Mapped[str] = mapped_column(
        String(16),
        nullable=True,
        default=None,
        comment="ISO 639-1 language code of the generated response",
    )
    generation_instructions: Mapped[str] = mapped_column(
        Text,
        nullable=True,
        default=None,
        comment="Prompt or planning instructions used to generate this response",
    )

    # Policy validation
    policy_violations: Mapped[str] = mapped_column(
        Text,
        nullable=True,
        default=None,
        comment="JSON array of policy violation codes detected during validation",
    )
    has_policy_violations: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, index=True
    )

    # Approval lifecycle
    approval_status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=ResponseApprovalStatus.PENDING_REVIEW,
        index=True,
    )
    reviewed_by_user_id: Mapped[str] = mapped_column(String(64), nullable=True, default=None)
    reviewed_at: Mapped[str] = mapped_column(String(64), nullable=True, default=None)
    reviewer_notes: Mapped[str] = mapped_column(Text, nullable=True, default=None)

    # Relationships
    ai_run: Mapped["AIRun"] = relationship(back_populates="ai_responses")

    def __repr__(self) -> str:
        return (
            f"<AIResponse id={self.id} run={self.ai_run_id} "
            f"approval={self.approval_status}>"
        )
