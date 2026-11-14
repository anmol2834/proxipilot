"""Enterprise Reply Planning & Validation Contracts — Phase 7.

Defines the stable, versioned contract (`schema_version = "1.0"`) produced by the
Reply Planning and Validation stage, which converts the Minimal Evidence Package into
grounded, natural, context-aware email drafts, deterministically validates them against
active customer requirements, and safely decides the outbound disposition.

Design Principles:
1. Grounded Exclusively in Evidence: Factual claims must trace directly to verified
   facts or explicit missing-information signals in the Minimal Evidence Package.
2. Exact Numeric Integrity: Exact prices, currencies, and units are validated
   deterministically without hallucination or rounding drift.
3. Operational Safety Invariant: When `booking_confirmed` is False, the draft must
   NEVER claim or imply that an appointment or reservation is confirmed.
4. Honest Limitation Communication: Missing categories, contacts, or capabilities are
   disclosed tactfully and naturally without inventing synthetic solutions.
5. Context-Aware Natural Communication: Concise, professional, non-robotic enterprise
   style without canned boilerplate or unwanted sales pressure.
6. Safe Policy Gating: Distinguishes SEND, CLARIFY, HUMAN_REVIEW, PARTIAL_RESPONSE,
   and NO_REPLY_REQUIRED with strict tenant configuration and idempotency guards.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
import uuid

from pydantic import BaseModel, Field


# =============================================================================
# Domain Enums
# =============================================================================


class ReplyDisposition(str, Enum):
    """Aggregate sending disposition for the generated reply plan."""

    SEND = "SEND"                              # Complete, validated response permitted for auto-send
    CLARIFY = "CLARIFY"                        # Material ambiguity requires customer clarification
    HUMAN_REVIEW = "HUMAN_REVIEW"              # Risk, policy violation, or missing material requirement
    PARTIAL_RESPONSE = "PARTIAL_RESPONSE"      # Verified aspects answered, clear limitations disclosed
    NO_REPLY_REQUIRED = "NO_REPLY_REQUIRED"    # Conversational closure or no customer-facing action needed
    REJECTED = "REJECTED"                      # Validation failed and could not be repaired
    RETRYABLE_FAILURE = "RETRYABLE_FAILURE"    # Temporary transient failure


class RequirementDisposition(str, Enum):
    """Disposition of an individual customer requirement within the draft."""

    ANSWERED = "ANSWERED"                      # Factually answered from verified evidence
    PARTIALLY_ANSWERED = "PARTIALLY_ANSWERED"  # Addressed partially with noted boundaries
    LIMITATION_DISCLOSED = "LIMITATION_DISCLOSED"  # Transparently explained why info is absent
    CLARIFICATION_REQUESTED = "CLARIFICATION_REQUESTED"  # Targeted question asked to unblock
    ESCALATED_TO_HUMAN = "ESCALATED_TO_HUMAN"  # Routed to human reviewer / team
    NO_ACTION_REQUIRED = "NO_ACTION_REQUIRED"  # Greeting, polite closure, or superseded
    OMITTED_VIOLATION = "OMITTED_VIOLATION"    # Material requirement was ignored (validator issue)


class GroundingType(str, Enum):
    """Type of grounding source for a specific material claim."""

    FACT = "fact"                              # Directly supported by a PackagedFact
    MISSING_SIGNAL = "missing_signal"          # Supported by a MissingInformationSignal
    CONTEXTUAL_ANTECEDENT = "contextual_antecedent"  # Supported by thread history / antecedent
    GENERAL_COURTESY = "general_courtesy"      # Greeting, polite closing, non-factual framing


class ValidationIssueSeverity(str, Enum):
    """Severity of an issue detected by the deterministic reply validator."""

    CRITICAL = "CRITICAL"                      # Blocks auto-sending; forces HUMAN_REVIEW or REJECTED
    WARNING = "WARNING"                        # Advisory warning; may still be sendable if policy permits
    INFO = "INFO"                              # Diagnostic observation


# =============================================================================
# Claim-to-Evidence Mapping
# =============================================================================


class ClaimEvidenceMapping(BaseModel):
    """Traceability mapping for an individual factual statement in the draft."""

    claim_id: str = Field(default_factory=lambda: f"clm_{uuid.uuid4().hex[:8]}")
    claim_statement: str = Field(description="The specific factual claim made in the draft")
    grounding_type: GroundingType = GroundingType.FACT
    supported_by_fact_id: Optional[str] = Field(
        default=None,
        description="Reference to PackagedFact.fact_id in MinimalEvidencePackage",
    )
    supported_by_signal_id: Optional[str] = Field(
        default=None,
        description="Reference to MissingInformationSignal.signal_id",
    )
    supports_requirement_id: Optional[str] = Field(
        default=None,
        description="The requirement ID this claim addresses",
    )
    is_verified: bool = True
    numeric_values_extracted: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Extracted numeric values (e.g. [{'value': 1000.64, 'currency': 'INR'}])",
    )


# =============================================================================
# Requirement Coverage Evaluation
# =============================================================================


class RequirementCoverageEvaluation(BaseModel):
    """Evaluation of how an individual customer requirement was addressed in the reply."""

    requirement_id: str
    requirement_intent: str
    disposition: RequirementDisposition = RequirementDisposition.ANSWERED
    evidence_grounded: bool = True
    limitations_disclosed: bool = False
    claims_mapped: List[str] = Field(
        default_factory=list,
        description="List of claim_ids addressing this requirement",
    )
    notes: Optional[str] = None


# =============================================================================
# Structured Reply Draft
# =============================================================================


class StructuredReplyDraft(BaseModel):
    """The structured draft email generated from the Minimal Evidence Package."""

    draft_id: str = Field(default_factory=lambda: f"drf_{uuid.uuid4().hex[:10]}")
    subject: str = Field(description="Email subject line respecting thread semantics")
    body_text: str = Field(description="Clean, formatted plain-text email body")
    body_html: str = Field(description="Safe, semantic HTML email body")
    detected_tone: str = Field(
        default="professional_consultative",
        description="Tone applied: professional_consultative, empathetic_support, concise_direct, courteous_closure",
    )
    claims: List[ClaimEvidenceMapping] = Field(
        default_factory=list,
        description="Claim-level evidence grounding records",
    )
    clarification_question: Optional[str] = Field(
        default=None,
        description="Single focused clarification question, if required",
    )
    proposed_next_step: Optional[str] = Field(
        default=None,
        description="Contextual commercial next step, if appropriate",
    )
    closure_detected: bool = Field(
        default=False,
        description="True if conversation ending was detected (prevents unsolicited sales push)",
    )
    unconfirmed_booking_claimed: bool = Field(
        default=False,
        description="Must be strictly False if booking is not confirmed",
    )
    unauthorized_contact_claimed: bool = Field(
        default=False,
        description="Must be strictly False if contact is not authorized/found",
    )
    unauthorized_policy_claimed: bool = Field(
        default=False,
        description="Must be strictly False if policy is not configured/found",
    )


# =============================================================================
# Validation Issue & Report
# =============================================================================


class ValidationIssue(BaseModel):
    """A specific issue or rule violation detected during deterministic validation."""

    issue_code: str = Field(
        description="e.g. PRICE_MISMATCH, UNCONFIRMED_BOOKING_PROMISE, UNSUPPORTED_POLICY_CLAIM, "
                    "FABRICATED_CONTACT, UNGROUNDED_CLAIM, MISSING_REQUIREMENT_COVERAGE, UNSAFE_HTML"
    )
    severity: ValidationIssueSeverity = ValidationIssueSeverity.CRITICAL
    description: str
    target_field: Optional[str] = None
    requirement_id: Optional[str] = None


class ReplyValidationReport(BaseModel):
    """Report produced by the deterministic reply validator."""

    validation_passed: bool = True
    is_sendable: bool = True
    issues: List[ValidationIssue] = Field(default_factory=list)
    facts_checked_count: int = 0
    facts_verified_count: int = 0
    prices_validated_count: int = 0
    booking_safety_verified: bool = True
    missing_signals_disclosed_count: int = 0
    unsupported_claims_count: int = 0
    repaired_deterministically: bool = False
    validation_duration_ms: float = 0.0


# =============================================================================
# Primary Output Contract: ReplyPlan
# =============================================================================


class ReplyPlan(BaseModel):
    """Versioned Reply Plan contract (`schema_version = '1.0'`).
    
    The authoritative response planning, drafting, validation, and policy decision
    record produced by Phase 7.
    """

    schema_version: str = "1.0"
    plan_id: str = Field(default_factory=lambda: f"rpl_{uuid.uuid4().hex[:12]}")
    package_reference: str = Field(description="MinimalEvidencePackage.package_id")
    tenant_id: str
    thread_id: str
    message_id: str
    context_revision: int

    # Core Decisions
    disposition: ReplyDisposition = ReplyDisposition.SEND
    coverage_evaluations: List[RequirementCoverageEvaluation] = Field(default_factory=list)
    draft: Optional[StructuredReplyDraft] = None
    validation_report: ReplyValidationReport = Field(default_factory=ReplyValidationReport)

    # Operational & Audit Metadata
    human_review_reason: Optional[str] = None
    human_review_id: Optional[str] = None
    clarification_reason: Optional[str] = None
    outbound_message_id: Optional[str] = None
    ai_response_id: Optional[str] = None
    idempotency_key: Optional[str] = None
    generation_metrics: Dict[str, Any] = Field(default_factory=dict)
    warnings: List[str] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
