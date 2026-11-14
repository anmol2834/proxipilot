"""Candidate Fusion & Evidence Verification Contracts — Phase 5.

Defines the stable, versioned contract (`schema_version = "1.0"`) produced by the
Candidate Fusion & Evidence Verification stage and consumed by subsequent
response-generation and action-orchestration stages.

Design Principles:
1. Multi-Requirement Coverage: Each independent requirement in an email has its own
   typed coverage group, target entity tracking, and satisfaction status.
2. Distinct Entity Matching: Comparison targets (e.g. HA-001 and HA-004) are evaluated
   independently against explicit target sets—never conflated with discovery counts.
3. Hard Constraints Before Ranking: Eligibility criteria are verified deterministically
   before any soft relevance or semantic scoring is applied.
4. Authority and Provenance: Every verified fact links to an authoritative version with
   explicit conflict reporting and lifecycle validity checks.
5. Context-Aware Integrity: Short replies ('yes', 'ok', 'proceed') resolve against
   thread context without falsely confirming operational bookings.
6. Absolute Tenant Isolation: Scoped to authenticated tenant context with 0% cross-tenant leakage.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Union
import uuid

from pydantic import BaseModel, Field

from app.contracts.retrieval_result import (
    EvidenceProvenance,
    FactVerificationStatus,
    PlanReferenceDTO,
    VerifiedPricingEvidence,
)


# =============================================================================
# Domain Enums
# =============================================================================


class CandidateRole(str, Enum):
    """Categorical role of an evidence candidate within the enterprise domain."""

    PRODUCT_SERVICE = "product_service"
    TROUBLESHOOTING_GUIDE = "troubleshooting_guide"
    CONTACT_CARD = "contact_card"
    OPERATIONAL_AVAILABILITY = "operational_availability"
    POLICY_DOCUMENT = "policy_document"
    CONTEXTUAL_PROPOSAL = "contextual_proposal"
    GENERAL_KNOWLEDGE = "general_knowledge"


class RequirementType(str, Enum):
    """Semantic category of an individual customer requirement."""

    COMPARISON = "comparison"
    PRODUCT_SERVICE_DISCOVERY = "product_service_discovery"
    SUPPORT_TROUBLESHOOTING = "support_troubleshooting"
    CONTACT_RESOLUTION = "contact_resolution"
    OPERATIONAL_SCHEDULING = "operational_scheduling"
    POLICY_QUERY = "policy_query"
    CONTEXTUAL_FOLLOW_UP = "contextual_follow_up"
    CONVERSATIONAL_GREETING = "conversational_greeting"
    GENERAL_INQUIRY = "general_inquiry"


class RequirementCoverageStatus(str, Enum):
    """Evidence satisfaction status for a single requirement."""

    COMPLETE = "COMPLETE"                          # All required targets, attributes, and constraints satisfied
    PARTIAL = "PARTIAL"                            # Partial evidence found (e.g. some targets or attributes missing)
    NO_MATCH = "NO_MATCH"                          # Zero eligible records found matching constraints
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"  # Evidence found is incomplete or below authority threshold
    NEEDS_CLARIFICATION = "NEEDS_CLARIFICATION"    # Material ambiguity prevents conclusive verification
    CONFLICTING_EVIDENCE = "CONFLICTING_EVIDENCE"  # Unresolved discrepancies between authoritative records
    CAPABILITY_UNAVAILABLE = "CAPABILITY_UNAVAILABLE"  # Live integration (e.g. booking engine) not connected
    SOURCE_UNAVAILABLE = "SOURCE_UNAVAILABLE"      # Required backing source failed or timed out
    CATEGORY_NOT_CONFIGURED = "CATEGORY_NOT_CONFIGURED"  # Tenant has no knowledge records configured in requested category
    NOT_APPLICABLE = "NOT_APPLICABLE"              # Requirement superseded or cancelled by user
    SUPERSEDED = "SUPERSEDED"                      # Superseded by subsequent turn in conversation
    NO_RETRIEVAL_REQUIRED = "NO_RETRIEVAL_REQUIRED"  # Conversational greeting or simple standalone acknowledgment


class EvidenceOverallStatus(str, Enum):
    """Aggregate evidence coverage outcome across all requirements in the email."""

    COMPLETE = "COMPLETE"
    PARTIAL = "PARTIAL"
    NO_MATCH = "NO_MATCH"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"
    NEEDS_CLARIFICATION = "NEEDS_CLARIFICATION"
    CONFLICTING_EVIDENCE = "CONFLICTING_EVIDENCE"
    CAPABILITY_UNAVAILABLE = "CAPABILITY_UNAVAILABLE"
    STALE_CONTEXT = "STALE_CONTEXT"
    NO_RETRIEVAL_REQUIRED = "NO_RETRIEVAL_REQUIRED"


# =============================================================================
# Sub-Models & Evidence Records
# =============================================================================


class VerifiedFact(BaseModel):
    """An individual atomic business fact verified against authoritative sources."""

    fact_id: str = Field(default_factory=lambda: f"fct_{uuid.uuid4().hex[:10]}")
    attribute_name: str = Field(description="e.g. price, warranty, visit_charge, escalation_phone")
    entity_id: str = Field(description="Associated KnowledgeItem ID or entity reference")
    external_identity_key: Optional[str] = None
    typed_value: Any = Field(description="Typed scalar, dict, or Decimal string representation")
    currency_or_unit: Optional[str] = None
    source_system: str = Field(default="postgresql", description="postgresql | qdrant | operational")
    source_version_id: Optional[str] = None
    authority_level: str = "verified_canonical"
    authority_score: float = 0.85
    verification_status: FactVerificationStatus = FactVerificationStatus.VERIFIED
    effective_from: Optional[str] = None
    effective_until: Optional[str] = None
    conflict_notes: Optional[str] = None


class VerifiedCandidate(BaseModel):
    """A single normalized, deduplicated, and verified evidence candidate."""

    candidate_id: str = Field(description="Unique candidate key: cand_{entity_id}_{version_id}")
    entity_id: str = Field(description="Stable KnowledgeItem.id or entity reference")
    tenant_id: str = Field(default="", description="Tenant isolation identifier")
    external_identity_key: Optional[str] = Field(default=None, description="SKU or business key (e.g. HA-001)")
    title: str
    description: Optional[str] = None
    candidate_role: CandidateRole = CandidateRole.PRODUCT_SERVICE
    category: str
    service_area: Optional[str] = None
    pricing: Optional[VerifiedPricingEvidence] = None
    warranty: Optional[Union[Dict[str, Any], str]] = None
    sla: Optional[Union[Dict[str, Any], str]] = None
    attributes: Dict[str, Any] = Field(default_factory=dict)
    semantic_passages: List[str] = Field(default_factory=list)
    provenance: EvidenceProvenance
    verification_status: FactVerificationStatus = FactVerificationStatus.VERIFIED
    relevance_score: float = 0.0
    composite_score: float = 0.0
    retrieval_path: str = "hybrid"
    satisfied_constraints: List[str] = Field(default_factory=list)
    unmet_constraints: List[str] = Field(default_factory=list)


class RequirementEvidenceGroup(BaseModel):
    """Per-requirement coverage group preserving multi-intent independence."""

    requirement_id: str = Field(description="Stable requirement ID (e.g. req_comparison_01)")
    intent: str = Field(description="Resolved intent taxonomy value")
    requirement_type: RequirementType = RequirementType.GENERAL_INQUIRY
    description: str = Field(description="Human-readable requirement summary")
    
    # Target entity tracking (Crucial: separated from requested_count!)
    requested_targets: List[str] = Field(default_factory=list, description="Explicit target identifiers (e.g. ['HA-001', 'HA-004'])")
    verified_targets: List[str] = Field(default_factory=list, description="Explicit targets successfully verified")
    missing_targets: List[str] = Field(default_factory=list, description="Explicit targets not found or unverified")
    
    # Count semantics
    requested_count: int = Field(default=1, description="Expected result count for discovery or comparison")
    returned_count: int = Field(default=0, description="Eligible verified candidates returned")
    
    # Attributes & Constraints
    required_attributes: List[str] = Field(default_factory=list)
    satisfied_attributes: List[str] = Field(default_factory=list)
    missing_attributes: List[str] = Field(default_factory=list)
    satisfied_constraints: List[str] = Field(default_factory=list)
    unmet_constraints: List[str] = Field(default_factory=list)
    
    # Coverage outcome
    status: RequirementCoverageStatus = RequirementCoverageStatus.COMPLETE
    target_category: Optional[str] = None
    verified_candidates: List[VerifiedCandidate] = Field(default_factory=list)
    missing_evidence_reasons: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    evidence_references: List[str] = Field(default_factory=list)


class ActionWorkflowContext(BaseModel):
    """Downstream guidance for response drafting and operational action engines.
    
    Invariant: Fusion establishes factual prerequisites but NEVER confirms or commits
    an operational transaction directly.
    """

    workflow_action_required: bool = False
    required_workflow_type: Optional[str] = None
    booking_confirmed: bool = False  # Strictly False at fusion stage
    clarification_required: bool = False
    clarification_reason: Optional[str] = None
    requires_human_escalation: bool = False
    unsupported_categories: List[str] = Field(default_factory=list)
    escalation_reason: Optional[str] = None
    contextual_intent: Optional[str] = Field(
        default=None,
        description="e.g. proposal_accepted, booking_requested, explanation_requested, greeting, acknowledgment",
    )
    referenced_proposal_id: Optional[str] = None
    safe_response_strategy: str = Field(
        default="evidence_supported_response",
        description="evidence_supported_response | clarification_prompt | operational_escalation | conversational_greeting | conversational_acknowledgement | partial_evidence_with_escalation",
    )


class ConflictRecord(BaseModel):
    """Detailed record of conflicting evidence between sources or versions."""

    conflict_id: str = Field(default_factory=lambda: f"cnf_{uuid.uuid4().hex[:8]}")
    attribute: str
    source_a: str
    value_a: Any
    version_a: Optional[str] = None
    source_b: str
    value_b: Any
    version_b: Optional[str] = None
    resolution_applied: str = "prefer_postgresql_canonical"
    resolved_value: Optional[Any] = None


# =============================================================================
# Primary Output Contract: VerifiedEvidenceResult
# =============================================================================


class VerifiedEvidenceResult(BaseModel):
    """Versioned Verified Evidence Result contract (`schema_version = '1.0'`).
    
    The final verified evidence envelope emitted by Phase 5 and consumed by
    downstream response generation and action orchestration.
    """

    schema_version: str = "1.0"
    fusion_id: str = Field(default_factory=lambda: f"fus_{uuid.uuid4().hex[:12]}")
    verifier_version: str = "1.0.0"
    tenant_id: str = Field(description="Server-validated tenant identifier")
    thread_id: str
    message_id: str
    context_revision: int
    plan_reference: PlanReferenceDTO
    
    # Coverage & Multi-Requirement Groups
    overall_status: EvidenceOverallStatus = EvidenceOverallStatus.COMPLETE
    requirements: List[RequirementEvidenceGroup] = Field(default_factory=list)
    
    # Consolidated Atomic Facts
    verified_facts: List[VerifiedFact] = Field(default_factory=list)
    conflicts: List[ConflictRecord] = Field(default_factory=list)
    
    # Action Guidance for Response Stage
    action_context: ActionWorkflowContext = Field(default_factory=ActionWorkflowContext)
    
    # Diagnostics & Observability
    warnings: List[str] = Field(default_factory=list)
    fusion_duration_ms: float = 0.0
    rechecks_performed: int = 0
    duplicates_removed: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
