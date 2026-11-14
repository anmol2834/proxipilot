"""Retrieval Result Contracts — Phase 4: Enterprise Tenant-Scoped Retrieval Router.

Defines the stable, versioned Retrieval Result contract (`schema_version = "1.0"`)
produced by the Retrieval Router stage and consumed by the subsequent response-generation
and action-orchestration stages.

Design Invariants:
1. Versioned and Stable (`schema_version = "1.0"`): Downstream stages consume
   this contract without reinterpreting natural language emails or repeating searches.
2. Source Authority Separation: Distinguishes verified structured facts (PostgreSQL),
   semantic supporting passages (Qdrant), operational availability, and unverified data.
3. Hard Constraints are Non-Negotiable: Semantic similarity scores cannot override
   price ranges, tenant boundaries, or currency mismatches.
4. Operational Integrity: Slot checking is strictly distinguished from committed
   bookings; unavailable integrations emit typed capability limitations.
5. Evidence Traceability: Every fact links back to an authoritative source record
   with version and temporal validity metadata.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Union
import uuid

from pydantic import BaseModel, Field


# =============================================================================
# Domain Enums
# =============================================================================


class RetrievalStatus(str, Enum):
    """Overall status of the retrieval operation."""

    SUCCESS = "SUCCESS"                            # All requirements and hard constraints satisfied
    PARTIAL = "PARTIAL"                            # Partial evidence found (e.g. fewer results than requested, or non-critical attribute missing)
    NO_MATCH = "NO_MATCH"                          # Zero records satisfied hard constraints
    NEEDS_CLARIFICATION = "NEEDS_CLARIFICATION"    # Material ambiguity or conflicting evidence prevents safe response
    SOURCE_CONFLICT = "SOURCE_CONFLICT"            # Irreconcilable conflict between authoritative sources
    CAPABILITY_UNAVAILABLE = "CAPABILITY_UNAVAILABLE"  # Requested live capability (e.g. live booking engine) not integrated
    RETRYABLE_FAILURE = "RETRYABLE_FAILURE"        # Transient infrastructure error (e.g. DB connection pool timeout)
    INCOMPATIBLE_CONFIGURATION = "INCOMPATIBLE_CONFIGURATION"  # Embedding profile or vector schema mismatch


class RetrievalStrategyUsed(str, Enum):
    """The concrete execution strategy executed by the router."""

    EXACT_STRUCTURED = "exact_structured"
    SEMANTIC_DISCOVERY = "semantic_discovery"
    HYBRID = "hybrid"
    OPERATIONAL_LIMITATION = "operational_limitation"


class FactVerificationStatus(str, Enum):
    """Verification classification for individual evidence candidates."""

    VERIFIED = "VERIFIED"                          # Rehydrated from PostgreSQL canonical data and verified against constraints
    UNVERIFIED_SEMANTIC_ONLY = "UNVERIFIED_SEMANTIC_ONLY"  # Narrative chunk without canonical structured record
    CONFLICT_DETECTED = "CONFLICT_DETECTED"        # Fact conflicts with newer or higher-authority record
    EXPIRED = "EXPIRED"                            # Temporal window has lapsed
    OUT_OF_BOUNDS = "OUT_OF_BOUNDS"                # Fails hard user filter constraints (e.g. price out of range)


# =============================================================================
# Contract Sub-Models
# =============================================================================


class PlanReferenceDTO(BaseModel):
    """Traceable reference linking this retrieval to the originating plan."""

    schema_version: str = "1.0"
    plan_id: str = Field(description="Originating RequirementPlan.plan_id")
    tenant_id: str = Field(description="Server-validated tenant identifier")
    thread_id: str
    message_id: str
    context_revision: int


class SourceExecutionMetadata(BaseModel):
    """Performance and execution metrics for observability."""

    structured_source_status: str = Field(default="NOT_INVOKED", description="SUCCESS | EMPTY | FAILED | NOT_INVOKED")
    semantic_source_status: str = Field(default="NOT_INVOKED", description="SUCCESS | EMPTY | FAILED | NOT_INVOKED")
    embedding_profile_id: str = Field(default="emb_voyage_4_large_1024_v1")
    strategy_used: RetrievalStrategyUsed = RetrievalStrategyUsed.HYBRID
    duration_ms: float = 0.0
    structured_duration_ms: float = 0.0
    semantic_duration_ms: float = 0.0
    candidate_counts: Dict[str, int] = Field(default_factory=dict)


class VerifiedPricingEvidence(BaseModel):
    """Authoritative monetary amounts calculated with Decimal precision."""

    currency: str = "INR"
    base_price: float = 0.0
    visit_diagnostic_charge: float = 0.0
    estimated_parts_cost: float = 0.0
    discount_percentage: float = 0.0
    tax_percentage: float = 0.0
    calculated_total: float = 0.0
    commercial_price_type: str = "not_specified"
    pricing_notes: Optional[str] = None
    qualifying_statement: str = Field(
        description="Mandatory qualification preventing estimate hallucination"
    )


class EvidenceProvenance(BaseModel):
    """Exact source provenance and lineage for every retrieved fact."""

    source_system: str = Field(description="postgresql | qdrant | operational_system")
    source_id: Optional[str] = None
    source_type: Optional[str] = None
    version_id: Optional[str] = None
    chunk_id: Optional[str] = None
    tenant_id: Optional[str] = None
    authority_level: str = "imported_data"
    authority_score: float = 0.6
    effective_from: Optional[str] = None
    effective_until: Optional[str] = None
    temporal_status: str = "current"


class RetrievedEvidenceItem(BaseModel):
    """A single deduplicated, verified, and ranked business evidence candidate."""

    entity_id: str = Field(description="Stable KnowledgeItem.id or unique business entity ID")
    external_identity_key: Optional[str] = Field(default=None, description="SKU or business key (e.g. HA-001)")
    title: str
    description: Optional[str] = None
    category: str
    service_area: Optional[str] = None
    pricing: Optional[VerifiedPricingEvidence] = None
    warranty: Optional[Union[Dict[str, Any], str]] = None
    sla: Optional[Union[Dict[str, Any], str]] = None
    attributes: Dict[str, Any] = Field(default_factory=dict)
    semantic_passages: List[str] = Field(default_factory=list)
    relevance_score: float = 0.0
    retrieval_path: str = "hybrid"
    verification_status: FactVerificationStatus = FactVerificationStatus.VERIFIED
    provenance: EvidenceProvenance
    satisfied_constraints: List[str] = Field(default_factory=list)
    unmet_constraints: List[str] = Field(default_factory=list)
    # Requirement(s) this item was retrieved for (multi-requirement plans). Empty = whole plan.
    requirement_ids: List[str] = Field(default_factory=list)


class CoverageAssessment(BaseModel):
    """Analysis of how well retrieved evidence satisfies the plan's requirements."""

    requested_count: int = 5
    returned_count: int = 0
    satisfied_attributes: List[str] = Field(default_factory=list)
    missing_attributes: List[str] = Field(default_factory=list)
    unmet_constraints: List[str] = Field(default_factory=list)
    has_more: bool = False
    pagination_token: Optional[str] = None


class VerificationAssessment(BaseModel):
    """Assessment of factual accuracy and conflict resolution."""

    exact_facts_checked: bool = True
    hard_constraints_satisfied: bool = True
    unresolved_conflicts: List[str] = Field(default_factory=list)
    conflict_details: List[Dict[str, Any]] = Field(default_factory=list)


class FollowUpActions(BaseModel):
    """Signals for downstream response generation and operational orchestration."""

    clarification_required: bool = False
    clarification_reason: Optional[str] = None
    workflow_action_required: bool = False
    required_workflow_type: Optional[str] = None
    operational_limitation_reason: Optional[str] = None


# =============================================================================
# Primary Output Contract: RetrievalResult
# =============================================================================


class RetrievalResult(BaseModel):
    """Versioned Retrieval Result contract (`schema_version = '1.0'`).
    
    The final evidence envelope emitted by Phase 4 and consumed by
    downstream response generation and workflow orchestration.
    """

    schema_version: str = "1.0"
    retrieval_id: str = Field(default_factory=lambda: f"ret_{uuid.uuid4().hex[:12]}")
    status: RetrievalStatus = RetrievalStatus.SUCCESS
    plan_reference: PlanReferenceDTO
    retrieval: SourceExecutionMetadata
    results: List[RetrievedEvidenceItem] = Field(default_factory=list)
    coverage: CoverageAssessment = Field(default_factory=CoverageAssessment)
    verification: VerificationAssessment = Field(default_factory=VerificationAssessment)
    follow_up: FollowUpActions = Field(default_factory=FollowUpActions)
    warnings: List[str] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
