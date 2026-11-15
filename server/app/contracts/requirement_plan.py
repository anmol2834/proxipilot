"""Requirement Plan Contracts — Phase 3: Requirement & Intent Planner.

Defines the stable, versioned Requirement Plan contract (`schema_version = "1.0"`)
produced by the Requirement & Intent Planner stage and consumed by the subsequent
retrieval stage.

Design Principles:
1. Versioned and Stable: The retrieval stage consumes this contract without
   re-interpreting the natural language email.
2. Safe and Bounded: Every filter and entity is mapped to allowlisted capability
   catalogue fields. Clamped output counts and explicit operators.
3. Strict Separation of Concerns: This contract plans retrieval; it does not
   execute queries, generate customer replies, or make unsupported assertions.
4. Tenant Scoping: Tenant ID, thread ID, message ID, and revision are enforced
   by trusted application code, never chosen by the LLM.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
import uuid

from pydantic import BaseModel, Field

from app.contracts.retrieval_capability import FilterOperator


# =============================================================================
# Domain Enums
# =============================================================================


class IntentType(str, Enum):
    """Canonical intent taxonomy for business email interactions."""

    PRODUCT_DISCOVERY = "product_discovery"
    PRODUCT_LOOKUP = "product_lookup"
    SERVICE_LOOKUP = "service_lookup"
    PRICE_QUERY = "price_query"
    AVAILABILITY_QUERY = "availability_query"
    SERVICE_COMPARISON = "service_comparison"
    PRODUCT_COMPARISON = "product_comparison"
    RECOMMENDATION = "recommendation"
    CATALOGUE_REQUEST = "catalogue_request"
    POLICY_QUESTION = "policy_question"
    WARRANTY_QUESTION = "warranty_question"
    ORDER_OR_DELIVERY_QUESTION = "order_or_delivery_question"
    SUPPORT_ISSUE = "support_issue"
    FOLLOW_UP = "follow_up"
    MORE_OPTIONS = "more_options"
    DIFFERENT_OPTIONS = "different_options"
    CLARIFICATION = "clarification"
    OTHER = "other"
    UNKNOWN = "unknown"


class RetrievalStrategy(str, Enum):
    """Strategy compiled by the planner for the downstream retrieval stage."""

    EXACT_LOOKUP = "exact_lookup"              # Exact SKU/code/order lookup
    STRUCTURED_FILTER = "structured_filter"    # Pure exact structured SQL/payload filter
    SEMANTIC_DISCOVERY = "semantic_discovery"  # Broad ANN vector search in Qdrant
    HYBRID = "hybrid"                          # Combined structured constraint + semantic ANN
    CLARIFICATION_REQUIRED = "clarification_required"  # Material ambiguity prevents retrieval


class ValidationStatus(str, Enum):
    """Deterministic validation outcome for the requirement plan."""

    READY_FOR_RETRIEVAL = "ready_for_retrieval"
    NEEDS_CLARIFICATION = "needs_clarification"
    RETRYABLE_PLANNING_FAILURE = "retryable_planning_failure"
    UNSUPPORTED_REQUEST = "unsupported_request"
    SAFE_FALLBACK = "safe_fallback"


class EntityResolutionStatus(str, Enum):
    """Resolution status of an extracted entity."""

    RESOLVED = "resolved"      # Mapped to a known canonical category or exact identifier
    AMBIGUOUS = "ambiguous"    # Multiple plausible interpretations exist
    UNRESOLVED = "unresolved"  # Entity mentioned but cannot be mapped to catalogue


# =============================================================================
# Planned Components
# =============================================================================


class PlannedEntity(BaseModel):
    """An extracted business entity or concept."""

    entity_type: str = Field(description="e.g. product, service_category, brand, sku, location")
    original_text: str = Field(description="Exact span from email text")
    canonical_value: Optional[str] = Field(default=None, description="Normalized canonical identifier or concept")
    resolution_status: EntityResolutionStatus = EntityResolutionStatus.RESOLVED
    source_span: Optional[str] = Field(default=None, description="Reference span in message")


class PlannedFilter(BaseModel):
    """A typed structured filter constraint against the capability catalogue."""

    field: str = Field(description="Field name matching capability catalogue (e.g. price, category, sku)")
    operator: FilterOperator = Field(description="Allowlisted filter operator")
    value: Any = Field(description="Scalar, list, or range dict (e.g. {'min': 500, 'max': 1500, 'currency': 'INR'})")


class PlannedRange(BaseModel):
    """Explicit range semantics preserving inclusive/exclusive boundaries and units."""

    field: str = Field(description="Target range field (e.g. price, warranty_months)")
    min_value: Optional[float] = Field(default=None)
    max_value: Optional[float] = Field(default=None)
    is_min_inclusive: bool = True
    is_max_inclusive: bool = True
    currency: Optional[str] = Field(default=None, description="ISO-4217 code (e.g. INR, USD)")
    unit: Optional[str] = Field(default=None, description="Measurement or time unit (e.g. month, year, ton)")


class PlannedComparison(BaseModel):
    """Preserves requested comparisons between products, services, or packages."""

    requested: bool = False
    target_entities: List[str] = Field(default_factory=list, description="Entities or category to compare")
    criteria: List[str] = Field(default_factory=list, description="Attributes to compare (e.g. price, warranty)")
    ranking_criterion: Optional[str] = Field(default=None, description="Requested sort/ranking order")
    inferred: bool = False


class PlannedResultCount(BaseModel):
    """Distinguishes explicit user request count from server safe limits."""

    explicit_count: Optional[int] = Field(default=None, description="Explicit count requested by user (e.g. 'top 3')")
    default_count: int = 5
    max_safe_limit: int = 20
    final_count: int = 5


class MissingDetail(BaseModel):
    """Tracks missing information and whether clarification is necessary."""

    field_or_concept: str
    is_required_for_retrieval: bool = False
    recovered_from_context: bool = False
    safe_default_applied: Optional[str] = None


class Ambiguity(BaseModel):
    """Tracks ambiguous constraints and resolution decisions."""

    field: str
    competing_interpretations: List[str] = Field(default_factory=list)
    chosen_interpretation: Optional[str] = None
    requires_clarification: bool = False


class EvidenceReference(BaseModel):
    """Traceable reference to supporting context message or span."""

    message_id: str
    source_span: str
    field_supported: str


class PlanMetadata(BaseModel):
    """Observability and execution metadata (privacy-safe, zero secrets)."""

    model_used: Optional[str] = None
    planner_duration_ms: float = 0.0
    validation_duration_ms: float = 0.0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    embedding_profile_id: str = "emb_voyage_4_large_1024_v1"
    fast_path_used: bool = False


class PlannedRequirement(BaseModel):
    """An independent requirement decomposed from a complex multi-intent query.

    Supports 10+ independent requirements per message across all 9 knowledge categories.
    """

    requirement_id: str = Field(default_factory=lambda: f"req_{uuid.uuid4().hex[:8]}")
    intent: IntentType = Field(default=IntentType.UNKNOWN)
    category: str = Field(default="products_services", description="Target knowledge category from the 9 dashboard categories")
    description: str = Field(default="", description="Human-readable requirement summary")
    query_text: str = Field(default="", description="Sanitized semantic query text for this requirement")
    entities: List[PlannedEntity] = Field(default_factory=list)
    filters: List[PlannedFilter] = Field(default_factory=list)
    range_semantics: Optional[PlannedRange] = None
    requested_attributes: List[str] = Field(default_factory=list)
    retrieval_strategy: RetrievalStrategy = Field(default=RetrievalStrategy.HYBRID)
    dependencies: List[str] = Field(default_factory=list, description="IDs of earlier requirements this requirement depends on")
    requested_count: int = Field(default=5)
    clarification_required: bool = False
    clarification_reason: Optional[str] = None


# =============================================================================
# Primary Output Contract: RequirementPlan
# =============================================================================


class RequirementPlan(BaseModel):
    """Versioned Requirement Plan contract (`schema_version = '1.0'`).

    Produced by Stage 3 (Requirement & Intent Planner) and consumed by
    the subsequent retrieval stage.
    """

    schema_version: str = "1.0"
    plan_id: str = Field(default_factory=lambda: f"plan_{uuid.uuid4().hex[:12]}")
    tenant_id: str
    integration_account_id: str
    thread_id: str
    message_id: str
    context_revision: int

    # Core Planner Intent & Entities
    intent: IntentType = IntentType.UNKNOWN
    entities: List[PlannedEntity] = Field(default_factory=list)
    filters: List[PlannedFilter] = Field(default_factory=list)
    range_semantics: Optional[PlannedRange] = None
    requested_attributes: List[str] = Field(default_factory=list)
    comparison: PlannedComparison = Field(default_factory=PlannedComparison)
    requested_result_count: PlannedResultCount = Field(default_factory=PlannedResultCount)

    # Multi-Intent Decomposed Requirements (supports 10+ independent requirements)
    requirements: List[PlannedRequirement] = Field(
        default_factory=list,
        description="List of independent decomposed requirements across categories",
    )

    # Missing Details & Clarification
    missing_details: List[MissingDetail] = Field(default_factory=list)
    ambiguities: List[Ambiguity] = Field(default_factory=list)
    clarification_required: bool = False
    clarification_reason: Optional[str] = None

    # Downstream Retrieval Guidance
    retrieval_strategy: RetrievalStrategy = RetrievalStrategy.SEMANTIC_DISCOVERY
    retrieval_strategy_hints: List[str] = Field(default_factory=list)
    query_text: str = Field(default="", description="Sanitized semantic query text for retrieval embedding")

    # Novelty & Continuation Metadata
    is_continuation: bool = Field(default=False, description="True if continuing an antecedent discovery session")
    continuation_type: Optional[str] = Field(default=None, description="MORE_OPTIONS | DIFFERENT_OPTIONS | CHEAPER_OPTIONS")
    excluded_entity_ids: List[str] = Field(default_factory=list, description="Canonical entity IDs/SKUs to exclude")

    # Conversation selection state (derived from the thread, never invented): the item the customer
    # chose among those already presented. While set, catalogue requirements retrieve ONLY these
    # entities instead of rediscovering the catalogue.
    active_selection: Optional[Dict[str, Optional[str]]] = Field(default=None)
    focus_entity_ids: List[str] = Field(default_factory=list)

    # Validation & Evidence
    validation_status: ValidationStatus = ValidationStatus.READY_FOR_RETRIEVAL
    validation_errors: List[str] = Field(default_factory=list)
    evidence_references: List[EvidenceReference] = Field(default_factory=list)
    metadata: PlanMetadata = Field(default_factory=PlanMetadata)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# =============================================================================
# OpenAI Strict Structured Output Schema DTO
# =============================================================================


class PlannerProposalDTO(BaseModel):
    """Strict schema model representing the LLM proposal before deterministic validation.

    Compatible with OpenAI `response_format={'type': 'json_schema', 'strict': True}`:
    - All fields are explicitly required (no optional omitting).
    - Uses primitives and typed sub-models.
    """

    intent: str = Field(description="Intent from approved taxonomy (e.g. service_lookup, product_comparison)")
    target_category: str = Field(
        default="products_services",
        description="Target category from 9 canonical categories (e.g. products_services, policies, support_faqs)",
    )
    entities: List[Dict[str, str]] = Field(
        default_factory=list,
        description="List of entities with 'entity_type', 'original_text', 'canonical_value', 'resolution_status'",
    )
    filters: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="List of filters with 'field', 'operator' (e.g. between, eq, lte), 'value'",
    )
    range_min: Optional[float] = Field(default=None, description="Minimum numeric boundary if range query")
    range_max: Optional[float] = Field(default=None, description="Maximum numeric boundary if range query")
    currency: Optional[str] = Field(default=None, description="Currency ISO code if price query (e.g. INR)")
    unit: Optional[str] = Field(default=None, description="Measurement or billing unit (e.g. month, year)")
    requested_attributes: List[str] = Field(
        default_factory=list,
        description="Attributes required in response (e.g. price, warranty, features)",
    )
    comparison_requested: bool = Field(default=False)
    comparison_criteria: List[str] = Field(default_factory=list)
    ranking_criterion: Optional[str] = Field(default=None)
    requested_count: Optional[int] = Field(default=None, description="Count explicitly requested (e.g. 3)")
    missing_required_details: List[str] = Field(default_factory=list)
    clarification_needed: bool = Field(default=False)
    clarification_reason: Optional[str] = Field(default=None)
    semantic_search_query: str = Field(description="Distilled search query for vector retrieval")
    retrieval_hints: List[str] = Field(default_factory=list)
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
