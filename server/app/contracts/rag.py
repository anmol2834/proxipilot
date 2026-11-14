"""Qdrant Vector Payload and Retrieval Contracts.

Pydantic V2 schemas governing all vector database interactions.

Architectural rules:
1. EVERY Qdrant point payload MUST include tenant_id (enforced by QdrantManager).
2. NEVER execute an unrestricted global vector query (no tenant filter = forbidden).
3. Qdrant is EPHEMERAL — it can be rebuilt from Postgres/Object Storage at any time.
4. Postgres is the source of truth for all knowledge version ownership.
5. Authority hierarchy for hybrid retrieval:
   live_api > structured_db > approved_policy > semantic_kb > historical

These contracts are used by AI workers and the RAG retrieval pipeline.
They are NOT HTTP API schemas.
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ============================================================================
# Source Authority Hierarchy
# ============================================================================


class SourceAuthority(str, Enum):
    """Authority tier for retrieved evidence ranking in hybrid retrieval.

    Higher authority = higher priority in context window construction.
    """

    LIVE_API = "live_api"                # Real-time data from integrated system (highest authority)
    STRUCTURED_DB = "structured_db"      # BusinessEntity from Postgres (structured, authoritative)
    APPROVED_POLICY = "approved_policy"  # Published policy knowledge version
    SEMANTIC_KB = "semantic_kb"          # Semantic knowledge base (general knowledge)
    HISTORICAL = "historical"            # Historical email threads (lowest authority)


AUTHORITY_RANK: Dict[str, int] = {
    SourceAuthority.LIVE_API: 100,
    SourceAuthority.STRUCTURED_DB: 80,
    SourceAuthority.APPROVED_POLICY: 60,
    SourceAuthority.SEMANTIC_KB: 40,
    SourceAuthority.HISTORICAL: 20,
}


# ============================================================================
# Qdrant Vector Point Payload Contract
# ============================================================================


class QdrantVectorPayload(BaseModel):
    """Mandatory payload schema for ALL Qdrant vector points.

    CRITICAL: Every point stored in Qdrant MUST conform to this schema.
    The tenant_id field is the primary isolation mechanism and is always
    included in every query filter (enforced by QdrantManager.build_tenant_filter).
    """

    model_config = {"frozen": True}

    # === Mandatory fields (all required, no exceptions) ===
    tenant_id: str = Field(description="Organization ID — mandatory tenant isolation key")
    knowledge_item_id: str = Field(description="Parent KnowledgeItem.id")
    version_id: str = Field(description="KnowledgeVersion.id this chunk belongs to")
    chunk_index: int = Field(description="0-based sequential chunk index within the version")

    # === Source metadata ===
    category: str = Field(description="KnowledgeCategory value for filtered retrieval")
    source_type: str = Field(description="KnowledgeSourceType value")
    authority: str = Field(
        default=SourceAuthority.SEMANTIC_KB,
        description="Source authority tier for retrieval ranking",
    )
    authority_score: float = Field(
        default=0.4,
        ge=0.0,
        le=1.0,
        description="Normalized authority weight derived from authority tier",
    )

    # === Content ===
    text_excerpt: str = Field(description="The actual text chunk this vector represents")
    char_count: int = Field(description="Character count of text_excerpt")

    # === Validity window (for time-sensitive knowledge) ===
    effective_from: Optional[str] = Field(
        default=None,
        description="ISO 8601 date from which this chunk is valid (null = always valid)",
    )
    effective_until: Optional[str] = Field(
        default=None,
        description="ISO 8601 date until which this chunk is valid (null = no expiry)",
    )

    # === Embedding metadata ===
    embedding_model: str = Field(
        description="Embedding model used (e.g. text-embedding-3-small)"
    )
    embedding_dimensions: int = Field(description="Vector dimensionality")


# ============================================================================
# Retrieval Request
# ============================================================================


class RetrievalQuery(BaseModel):
    """A vector retrieval request for the RAG pipeline.

    Hybrid retrieval combines:
    1. Qdrant ANN (approximate nearest neighbor) search for semantic similarity.
    2. Postgres structured query for BusinessEntity data (exact key-value matching).
    3. Authority-weighted reranking to merge and sort results.
    """

    model_config = {"frozen": True}

    # === Mandatory context ===
    tenant_id: str = Field(description="Organization ID — injected from authenticated user")
    query_text: str = Field(description="Normalized query text for embedding and search")

    # === Filtering ===
    category_filter: Optional[List[str]] = Field(
        default=None,
        description=(
            "Restrict retrieval to specific KnowledgeCategory values. "
            "None = search all categories."
        ),
    )
    authority_min: Optional[str] = Field(
        default=None,
        description="Minimum authority tier for returned results (e.g. approved_policy)",
    )
    effective_at: Optional[str] = Field(
        default=None,
        description=(
            "ISO 8601 date to filter results valid at this point in time. "
            "None = ignore validity windows."
        ),
    )

    # === Retrieval parameters ===
    top_k: int = Field(
        default=10,
        ge=1,
        le=50,
        description="Maximum number of vector results to retrieve from Qdrant",
    )
    score_threshold: float = Field(
        default=0.65,
        ge=0.0,
        le=1.0,
        description="Minimum cosine similarity score for inclusion in results",
    )
    include_business_entities: bool = Field(
        default=True,
        description=(
            "Whether to augment vector results with structured BusinessEntity "
            "data from Postgres (hybrid retrieval)"
        ),
    )
    max_context_chars: int = Field(
        default=8000,
        description="Maximum total characters across all evidence to fit in LLM context window",
    )

    # === Trace context ===
    ai_run_id: Optional[str] = Field(
        default=None,
        description="AIRun.id for attribution — all evidence is linked back to this run",
    )
    correlation_id: Optional[str] = Field(
        default=None,
        description="End-to-end trace ID for log correlation",
    )


# ============================================================================
# Retrieval Result
# ============================================================================


class EvidenceRecord(BaseModel):
    """A single retrieved and ranked evidence record.

    Combines vector-retrieved chunks and structured DB results into a unified schema
    that the response generation stage consumes.
    """

    model_config = {"frozen": True}

    # Source identification
    source_type: str = Field(description="EvidenceSourceType value")
    source_id: str = Field(
        description="PK of source entity (KnowledgeVersion.id, BusinessEntity.id, etc.)"
    )
    qdrant_point_id: Optional[str] = Field(
        default=None,
        description="Qdrant point UUID (only for vector-retrieved evidence)",
    )

    # Content
    text_excerpt: str = Field(description="Text content fed into the AI context window")

    # Scoring
    similarity_score: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Cosine similarity score from Qdrant (0 for structured DB results)",
    )
    authority_score: float = Field(ge=0.0, le=1.0)
    authority_tier: str = Field(description="SourceAuthority value")
    final_rank_score: float = Field(
        ge=0.0,
        description=(
            "Composite rank score after authority-weighted reranking. "
            "Used to order evidence in context window construction."
        ),
    )

    # Metadata
    category: Optional[str] = Field(default=None)
    knowledge_item_id: Optional[str] = Field(default=None)
    version_id: Optional[str] = Field(default=None)
    retrieval_rank: int = Field(description="Final position in ranked result list (0-indexed)")


class RetrievalResult(BaseModel):
    """Complete output from the RAG retrieval pipeline."""

    model_config = {"frozen": True}

    query_text: str
    tenant_id: str
    ai_run_id: Optional[str] = None

    # Results
    evidence: List[EvidenceRecord] = Field(default_factory=list)
    total_retrieved: int = Field(description="Total results before context window truncation")
    total_after_threshold: int = Field(description="Results above score_threshold")
    included_in_context: int = Field(description="Results included after max_context_chars limit")

    # Context summary
    total_context_chars: int = Field(description="Total character count of all included evidence")
    retrieval_duration_ms: Optional[int] = Field(default=None)

    # Retrieval quality indicators
    has_high_authority_evidence: bool = Field(
        description="True if any evidence >= approved_policy authority"
    )
    avg_similarity_score: float = Field(ge=0.0, le=1.0)


# ============================================================================
# Phase 10: Hybrid Retrieval & Fact Verification Contracts
# ============================================================================


class CommercialPriceType(str, Enum):
    """Controlled commercial price types."""

    FIXED = "fixed"
    ESTIMATE = "estimate"
    STARTING_PRICE = "starting_price"
    QUOTE_REQUIRED = "quote_required"
    NOT_SPECIFIED = "not_specified"


class VerificationDecision(str, Enum):
    """Decision outcome of the Requirement-Coverage Validation Gate."""

    PROCEED = "PROCEED"              # All required facts verified; safe for automated generation
    CLARIFY = "CLARIFY"              # Ambiguous or incomplete facts; ask customer clarifying questions
    HUMAN_HANDOFF = "HUMAN_HANDOFF"  # Critical business discrepancy or unserviceable request; hand off to human


class AuthoritativePricingEvidence(BaseModel):
    """Exact, authoritative monetary and commercial facts from PostgreSQL."""

    model_config = {"frozen": True}

    currency: str = "INR"
    base_price: float = 0.0
    visit_diagnostic_charge: float = 0.0
    estimated_parts_cost: float = 0.0
    discount_percentage: float = 0.0
    tax_percentage: float = 0.0
    calculated_total: float = 0.0
    commercial_price_type: CommercialPriceType = CommercialPriceType.NOT_SPECIFIED
    pricing_notes: Optional[str] = None
    qualifying_statement: str = Field(
        description="Mandatory qualification text to prevent hallucinating estimates as fixed quotes"
    )


class AuthoritativeEvidenceObject(BaseModel):
    """Verified evidence entity reconstructed from PostgreSQL canonical JSONB."""

    model_config = {"frozen": True}

    item_id: str
    external_key: Optional[str] = None
    title: str
    description: Optional[str] = None
    category: str
    service_area: Optional[str] = None
    business_domain: Optional[str] = None
    pricing: Optional[AuthoritativePricingEvidence] = None
    warranty: Optional[Dict[str, Any]] = None
    sla: Optional[Dict[str, Any]] = None
    custom_attributes: Dict[str, Any] = Field(default_factory=dict)
    authority_level: str = "imported_data"
    effective_from: Optional[str] = None
    effective_until: Optional[str] = None
    similarity_score: float = 0.0
    retrieval_source: str = "hybrid"  # "exact_key" | "vector_ann" | "hybrid"


class RequirementValidationResult(BaseModel):
    """Outcome of requirement coverage validation against authoritative facts."""

    model_config = {"frozen": True}

    decision: VerificationDecision
    coverage_status: str  # "COMPLETE" | "PARTIAL" | "INSUFFICIENT"
    missing_requirements: List[str] = Field(default_factory=list)
    clarification_prompt: Optional[str] = None
    verified_fact_summary: str = Field(
        description="Structured verified fact text containing exact pricing and qualifiers"
    )


class HybridRetrievalRequestDTO(BaseModel):
    """Unified hybrid retrieval request from email processing or chat."""

    query_text: str = Field(description="Raw customer query or email excerpt")
    customer_location: Optional[str] = Field(
        default=None,
        description="Customer-provided geographic location or municipality for service-area verification",
    )
    required_service_code: Optional[str] = Field(
        default=None,
        description="Specific SKU or item code if mentioned by user (e.g. HA-001)",
    )
    category_filter: Optional[List[str]] = Field(default=None)
    top_k: int = Field(default=5, ge=1, le=20)
    score_threshold: float = Field(default=0.5, ge=0.0, le=1.0)


class HybridRetrievalResponseDTO(BaseModel):
    """Complete verified retrieval and validation response."""

    model_config = {"frozen": True}

    query_text: str
    tenant_id: str
    validation: RequirementValidationResult
    evidence_objects: List[AuthoritativeEvidenceObject] = Field(default_factory=list)
    total_candidates_found: int = 0
    duration_ms: float = 0.0

