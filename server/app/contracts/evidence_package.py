"""Minimal Evidence Package Contracts — Phase 6.

Defines the stable, versioned contract (`schema_version = "1.0"`) produced by the
Minimal Evidence Package stage and consumed by downstream response-generation and
action-orchestration stages.

Design Principles:
1. Relevance-Driven: Contains ONLY facts and limitations required to address the
   active customer requirements—irrelevant candidate metadata is stripped.
2. Requirement-Aware: Preserves multi-intent independence with per-requirement
   evidence groups, explicit target tracking, and missing-information signals.
3. Provenance-Preserving: Every material fact retains its source system, version,
   authority level, and verification status.
4. Honest Limitations: Explicit typed missing signals (e.g. CATEGORY_NOT_CONFIGURED,
   NO_MATCH, CAPABILITY_UNAVAILABLE) prevent hallucination.
5. Contextually Grounded: Compact antecedent tracking for short/context-dependent
   messages ('yes', 'book now', 'show me') without raw email thread bloat.
6. Absolute Tenant Isolation: Scoped to authenticated tenant context with 0%
   cross-tenant leakage.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Union
import uuid

from pydantic import BaseModel, Field

from app.contracts.evidence_fusion import (
    CandidateRole,
    EvidenceOverallStatus,
    RequirementCoverageStatus,
    RequirementType,
)
from app.contracts.retrieval_result import FactVerificationStatus


# =============================================================================
# Domain Enums
# =============================================================================


class PackageStatus(str, Enum):
    """Aggregate package readiness for downstream response generation."""

    VALID = "VALID"                                # Ready for complete response generation
    PARTIAL_EVIDENCE = "PARTIAL_EVIDENCE"          # Answerable in part, with explicit missing boundaries
    NEEDS_CLARIFICATION = "NEEDS_CLARIFICATION"    # Material ambiguity requires clarification prompt
    ACTION_REQUIRED = "ACTION_REQUIRED"            # Operational action prerequisite identified
    NO_EVIDENCE = "NO_EVIDENCE"                    # No verifiable facts found matching request
    STALE_REJECTED = "STALE_REJECTED"              # Context or plan revision mismatch
    NO_RETRIEVAL_REQUIRED = "NO_RETRIEVAL_REQUIRED"  # Conversational greeting or acknowledgment


class MissingSignalType(str, Enum):
    """Precise, typed reason why evidence is missing or actionable capability is absent."""

    NO_MATCH = "NO_MATCH"                          # Zero eligible records found matching constraints
    CATEGORY_NOT_CONFIGURED = "CATEGORY_NOT_CONFIGURED"  # Tenant has no knowledge records in requested category
    CAPABILITY_UNAVAILABLE = "CAPABILITY_UNAVAILABLE"  # Operational integration (e.g. booking engine) not connected
    SOURCE_UNAVAILABLE = "SOURCE_UNAVAILABLE"      # Backing source failed, offline, or timed out
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"  # Evidence found is below authority/confidence threshold
    CONFLICTING_EVIDENCE = "CONFLICTING_EVIDENCE"  # Unresolved discrepancies between authoritative records
    STALE_EVIDENCE = "STALE_EVIDENCE"              # Expired or out-of-date source record
    NEEDS_CLARIFICATION = "NEEDS_CLARIFICATION"    # Customer request is ambiguous or missing required parameter
    UNRESOLVED_REFERENCE = "UNRESOLVED_REFERENCE"  # Short reply reference could not be resolved from thread context


class FactTemporalStatus(str, Enum):
    """Temporal validity state of a packaged fact."""

    CURRENT = "current"
    HISTORICAL = "historical"
    EXPIRED = "expired"


class EvidenceFactType(str, Enum):
    """Categorical classification of a verified fact."""

    STRUCTURED_NUMERIC = "structured_numeric"      # e.g. price, discount, tax rate, SLA hours
    STRUCTURED_TEXT = "structured_text"            # e.g. SKU, product name, warranty duration
    TEMPORAL_WINDOW = "temporal_window"            # e.g. effective dates, schedule window
    CONTACT_IDENTITY = "contact_identity"          # e.g. email, phone, department
    OPERATIONAL_STATUS = "operational_status"      # e.g. booking capability, stock status
    POLICY_RULE = "policy_rule"                    # e.g. cancellation terms, refund condition


# =============================================================================
# Packaged Facts & Excerpts
# =============================================================================


class PackagedFact(BaseModel):
    """A minimal, atomic verified fact with rigorous provenance."""

    fact_id: str = Field(default_factory=lambda: f"fct_{uuid.uuid4().hex[:10]}")
    attribute_name: str = Field(description="e.g. price, warranty, base_price, contact_email")
    fact_type: EvidenceFactType = EvidenceFactType.STRUCTURED_TEXT
    typed_value: Any = Field(description="Normalized scalar value (number, string, bool, dict)")
    currency_or_unit: Optional[str] = None
    
    # Entity reference
    entity_id: str = Field(description="KnowledgeItem.id or entity reference")
    external_identity_key: Optional[str] = Field(default=None, description="SKU or business key (e.g. HA-006)")
    entity_title: Optional[str] = None
    
    # Provenance & Authority
    source_system: str = Field(default="postgresql", description="postgresql | qdrant | operational")
    source_version_id: Optional[str] = None
    authority_level: str = "verified_canonical"
    authority_score: float = 0.85
    verification_status: FactVerificationStatus = FactVerificationStatus.VERIFIED
    temporal_status: FactTemporalStatus = FactTemporalStatus.CURRENT
    effective_from: Optional[str] = None
    effective_until: Optional[str] = None
    
    # Downstream Mapping
    supports_requirement_id: str = Field(description="The requirement group this fact directly satisfies")
    supports_attribute: str = Field(description="Requested attribute name satisfied")
    is_authoritative: bool = True


class EvidenceExcerpt(BaseModel):
    """A compact, strictly bounded narrative excerpt supporting a fact or policy."""

    excerpt_id: str = Field(default_factory=lambda: f"exc_{uuid.uuid4().hex[:8]}")
    entity_id: str
    source_system: str
    version_id: Optional[str] = None
    text: str = Field(description="Bounded excerpt text (strictly <= 250 characters)")
    relevance_reason: str


class MissingInformationSignal(BaseModel):
    """An explicit, actionable signal describing what information is missing and why."""

    signal_id: str = Field(default_factory=lambda: f"sig_{uuid.uuid4().hex[:8]}")
    signal_type: MissingSignalType
    requirement_id: str
    target_field_or_entity: Optional[str] = None
    reason: str = Field(description="Clear explanation of the missing or unavailable information")
    remediation_action: Optional[str] = Field(
        default=None,
        description="escalate_to_human | request_clarification | offer_catalog | operational_manual_booking",
    )
    requires_human_escalation: bool = False


class RequirementActionGuidance(BaseModel):
    """Action orchestration guidance scoped to a specific requirement."""

    workflow_type: Optional[str] = None
    action_prerequisites_met: bool = False
    missing_parameters: List[str] = Field(default_factory=list)
    requires_confirmation: bool = True
    human_review_required: bool = False


# =============================================================================
# Per-Requirement Evidence Package
# =============================================================================


class RequirementEvidencePackage(BaseModel):
    """Minimal, self-contained evidence group for one independent customer requirement."""

    requirement_id: str = Field(description="Stable requirement ID (e.g. req_comparison_a4b624)")
    requirement_type: RequirementType = RequirementType.GENERAL_INQUIRY
    intent: str
    description: str
    origin: str = Field(
        default="validated_plan",
        description="validated_plan | context_reconstructed | hybrid",
    )
    
    # Target tracking
    target_entities: List[str] = Field(default_factory=list)
    verified_targets: List[str] = Field(default_factory=list)
    missing_targets: List[str] = Field(default_factory=list)
    
    # Evidence & Coverage
    coverage_status: RequirementCoverageStatus
    facts: List[PackagedFact] = Field(default_factory=list)
    supporting_excerpts: List[EvidenceExcerpt] = Field(default_factory=list)
    missing_signals: List[MissingInformationSignal] = Field(default_factory=list)
    
    # Constraints
    satisfied_constraints: List[str] = Field(default_factory=list)
    unmet_constraints: List[str] = Field(default_factory=list)
    
    # Guidance
    action_guidance: Optional[RequirementActionGuidance] = None


# =============================================================================
# Contextual Reference for Short / Dependent Messages
# =============================================================================


class ContextualReference(BaseModel):
    """Compact antecedent tracking for short or context-dependent customer messages."""

    antecedent_text: Optional[str] = None
    referenced_entity_id: Optional[str] = None
    referenced_entity_key: Optional[str] = None
    referenced_proposal_id: Optional[str] = None
    pending_question: Optional[str] = None
    is_ambiguous: bool = False
    missing_parameters: List[str] = Field(default_factory=list)


# =============================================================================
# Package Action Context
# =============================================================================


class PackageActionContext(BaseModel):
    """Downstream instructions for response drafting and workflow orchestration."""

    safe_response_strategy: str = Field(
        default="evidence_supported_response",
        description="evidence_supported_response | partial_evidence_with_escalation | clarification_prompt | operational_escalation | conversational_greeting | conversational_acknowledgement | no_retrieval_direct_reply",
    )
    workflow_action_required: bool = False
    required_workflow_type: Optional[str] = None
    booking_confirmed: bool = False  # Strictly False at evidence package stage
    requires_human_escalation: bool = False
    unsupported_categories: List[str] = Field(default_factory=list)
    escalation_reason: Optional[str] = None
    clarification_prompt: Optional[str] = None
    contextual_intent: Optional[str] = None
    referenced_proposal_id: Optional[str] = None


# =============================================================================
# Package Budget Metrics
# =============================================================================


class PackageBudgetMetrics(BaseModel):
    """Observability and cost-optimization metrics for evidence packaging."""

    candidate_input_bytes: int = 0
    serialized_package_bytes: int = 0
    estimated_tokens: int = 0
    facts_evaluated_count: int = 0
    facts_included_count: int = 0
    facts_excluded_count: int = 0
    excerpts_included_count: int = 0
    excerpts_truncated_count: int = 0
    budget_reductions_applied: List[str] = Field(default_factory=list)


# =============================================================================
# Primary Output Contract: MinimalEvidencePackage
# =============================================================================


class MinimalEvidencePackage(BaseModel):
    """Versioned Minimal Evidence Package contract (`schema_version = '1.0'`).
    
    The trusted, minimal, and verified evidence package produced by Phase 6
    and consumed by response generation and action orchestration.
    """

    schema_version: str = "1.0"
    package_id: str = Field(default_factory=lambda: f"evp_{uuid.uuid4().hex[:12]}")
    builder_version: str = "1.0.0"
    tenant_id: str = Field(description="Server-validated tenant identifier")
    thread_id: str
    message_id: str
    context_revision: int
    plan_id: Optional[str] = None
    fusion_id: str
    
    # Status & Requirements
    package_status: PackageStatus = PackageStatus.VALID
    requirements: List[RequirementEvidencePackage] = Field(default_factory=list)
    
    # Contextual antecedents (for short replies)
    contextual_reference: Optional[ContextualReference] = None
    
    # Action Guidance for Response Stage
    action_context: PackageActionContext = Field(default_factory=PackageActionContext)
    
    # Novelty & Continuation Metadata
    is_continuation: bool = Field(default=False)
    continuation_type: Optional[str] = None
    previously_presented_entity_ids: List[str] = Field(default_factory=list)
    novelty_verified: bool = Field(default=False)
    # Item the customer selected earlier in the conversation (title), if any.
    active_selection_title: Optional[str] = None

    # Budget & Observability
    budget_metrics: PackageBudgetMetrics = Field(default_factory=PackageBudgetMetrics)
    warnings: List[str] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

