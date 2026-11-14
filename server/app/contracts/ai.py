"""AI Pipeline Typed Contracts.

Pydantic V2 schemas for all AI pipeline stage inputs and outputs.

These contracts govern:
1. What data flows into each pipeline stage.
2. What data flows out of each pipeline stage.
3. The format of confidence scores, intent extractions, and review triggers.

Architectural rules:
- All pipeline contracts are immutable (frozen Pydantic models).
- Confidence scores are float 0.0–1.0.
- Intent classification uses the canonical LeadIntent enum.
- Review triggers include the specific reason and threshold configuration.
- These contracts are used by AI workers; they are NOT HTTP API schemas.
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ============================================================================
# Shared Enumerations
# ============================================================================


class IntentCategory(str, Enum):
    """Classified intent categories for incoming emails."""

    SALES_INQUIRY = "sales_inquiry"
    SUPPORT_REQUEST = "support_request"
    PARTNERSHIP_INQUIRY = "partnership_inquiry"
    COMPLAINT = "complaint"
    PRICING_REQUEST = "pricing_request"
    DEMO_REQUEST = "demo_request"
    FOLLOW_UP = "follow_up"
    SPAM = "spam"
    INTERNAL = "internal"
    UNKNOWN = "unknown"


class LeadTemperature(str, Enum):
    """Lead scoring temperature matching UI display."""

    HOT = "hot"
    WARM = "warm"
    COLD = "cold"
    UNKNOWN = "unknown"


class ResponseTone(str, Enum):
    """Available response generation tones."""

    PROFESSIONAL = "professional"
    FRIENDLY = "friendly"
    FORMAL = "formal"
    EMPATHETIC = "empathetic"
    CONCISE = "concise"


# ============================================================================
# Stage 1: Email Understanding
# ============================================================================


class EmailUnderstandingInput(BaseModel):
    """Input to the email understanding stage."""

    model_config = {"frozen": True}

    thread_id: str
    message_id: str
    from_email: str
    subject: Optional[str]
    body_text: str = Field(description="Plain text body (no HTML) for LLM processing")
    language_hint: Optional[str] = Field(
        default=None,
        description="Optional language hint from provider metadata (ISO 639-1)",
    )


class EmailUnderstandingResult(BaseModel):
    """Output from email understanding stage."""

    model_config = {"frozen": True}

    detected_language: str = Field(description="ISO 639-1 language code detected")
    is_spam: bool
    is_auto_reply: bool
    is_internal: bool
    normalized_body: str = Field(
        description="Cleaned, normalized email body (signatures removed, HTML stripped)"
    )
    key_entities: List[str] = Field(
        default_factory=list,
        description="Named entities extracted from email (company names, products, etc.)",
    )
    confidence: float = Field(ge=0.0, le=1.0)


# ============================================================================
# Stage 2: Intent Extraction
# ============================================================================


class IntentExtractionInput(BaseModel):
    """Input to intent extraction stage."""

    model_config = {"frozen": True}

    thread_id: str
    understanding_result: EmailUnderstandingResult
    historical_thread_count: int = Field(
        default=0,
        description="Number of prior threads from this sender (context for scoring)",
    )


class IntentExtractionResult(BaseModel):
    """Output from intent extraction stage."""

    model_config = {"frozen": True}

    primary_intent: IntentCategory
    secondary_intents: List[IntentCategory] = Field(default_factory=list)
    lead_temperature: LeadTemperature
    lead_score: float = Field(ge=0.0, le=1.0)
    urgency_score: float = Field(ge=0.0, le=1.0)
    topics: List[str] = Field(
        default_factory=list,
        description="High-level topics identified (e.g. 'pricing', 'enterprise plan')",
    )
    extracted_requirements: List[str] = Field(
        default_factory=list,
        description="Specific requirements or questions identified in the email",
    )
    confidence: float = Field(ge=0.0, le=1.0)


# ============================================================================
# Stage 3: Confidence Scoring
# ============================================================================


class ConfidenceScore(BaseModel):
    """Multi-dimensional confidence scoring result."""

    model_config = {"frozen": True}

    overall: float = Field(ge=0.0, le=1.0, description="Composite overall confidence score")
    intent_confidence: float = Field(ge=0.0, le=1.0)
    retrieval_confidence: float = Field(ge=0.0, le=1.0)
    generation_confidence: float = Field(ge=0.0, le=1.0)
    policy_confidence: float = Field(ge=0.0, le=1.0)
    threshold_met: bool = Field(
        description="True if overall >= org-configured threshold (auto-approve if True)"
    )
    threshold_used: float = Field(description="The configured threshold value for this evaluation")


# ============================================================================
# Stage 4: Response Planning
# ============================================================================


class ResponsePlanInput(BaseModel):
    """Input to response planning stage."""

    model_config = {"frozen": True}

    thread_id: str
    intent_result: IntentExtractionResult
    retrieved_evidence: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Evidence chunks retrieved from knowledge base",
    )
    tone_preference: Optional[ResponseTone] = None
    language: str = Field(default="en")
    max_response_length: Optional[int] = Field(
        default=None,
        description="Maximum character count for generated response",
    )


class ResponsePlanResult(BaseModel):
    """Output from response planning stage — the generation blueprint."""

    model_config = {"frozen": True}

    should_respond: bool = Field(
        description="False if email is spam/auto-reply and should not receive a response"
    )
    response_structure: List[str] = Field(
        default_factory=list,
        description="Ordered list of sections/points to include in the response",
    )
    key_points_to_address: List[str] = Field(default_factory=list)
    evidence_ids_to_cite: List[str] = Field(
        default_factory=list,
        description="IDs of evidence records to ground the response",
    )
    recommended_tone: ResponseTone = ResponseTone.PROFESSIONAL
    estimated_response_length: str = Field(
        default="medium",
        description="short | medium | long",
    )


# ============================================================================
# Stage 5: Policy Validation
# ============================================================================


class PolicyViolation(BaseModel):
    """A single detected policy violation."""

    model_config = {"frozen": True}

    code: str = Field(description="Machine-readable violation code (e.g. PRICE_DISCLOSURE)")
    description: str = Field(description="Human-readable explanation of the violation")
    severity: str = Field(description="critical | high | medium | low")
    offending_excerpt: Optional[str] = Field(
        default=None,
        description="The specific text excerpt that triggered this violation",
    )


class PolicyValidationResult(BaseModel):
    """Output from policy validation stage."""

    model_config = {"frozen": True}

    is_compliant: bool = Field(description="True if no violations were detected")
    violations: List[PolicyViolation] = Field(default_factory=list)
    compliance_score: float = Field(ge=0.0, le=1.0)
    requires_human_review: bool


# ============================================================================
# Human Handoff Trigger
# ============================================================================


class ReviewTrigger(BaseModel):
    """Specification of why and how a response is being escalated to human review."""

    model_config = {"frozen": True}

    reason: str = Field(description="Primary trigger reason code")
    confidence_score: float = Field(ge=0.0, le=1.0)
    confidence_threshold: float = Field(ge=0.0, le=1.0)
    policy_violations: List[PolicyViolation] = Field(default_factory=list)
    priority: str = Field(
        default="medium",
        description="Review priority: critical | high | medium | low",
    )
    context: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional context for the reviewer",
    )
