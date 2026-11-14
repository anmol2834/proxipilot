"""Provider-Agnostic Embedding Contracts & Protocol.

Pydantic V2 schemas and abstract interfaces governing all vector generation,
batching, normalization, and reproducible indexing metadata.

Design Principles:
1. Vendor/SDK Independence: Business and indexing pipelines must never bind directly
   to a specific proprietary SDK.
2. Reproducibility: Every generated vector encapsulates deterministic hashes,
   model versions, dimensions, and projection lineages.
3. Multi-Tenant Safety: Every payload and metadata envelope enforces tenant boundaries.
   Zero secrets or authorization tokens are ever transmitted or persisted to vector payloads.
4. Strict Lifecycle & Temporal Metadata: Version status, effective dates, and authority
   tiers are preserved for retrieval-time filtering.
"""

from enum import Enum
from typing import Any, Dict, List, Optional, Protocol, runtime_checkable
from pydantic import BaseModel, Field


# ============================================================================
# Embedding Enums & Policies
# ============================================================================


class EmbeddingInputType(str, Enum):
    """Semantic intent of the embedding payload."""

    DOCUMENT = "document"  # Passage/chunk indexing (asymmetric retrieval document)
    QUERY = "query"        # Search/user prompt embedding (asymmetric retrieval query)


class NormalizationPolicy(str, Enum):
    """Vector unit-length normalization policy."""

    L2 = "l2"              # Unit length (Euclidean norm = 1.0, ideal for Dot/Cosine)
    NONE = "none"          # Raw output vector directly from model


class EmbeddingDtype(str, Enum):
    """Numerical precision of returned vector coordinates."""

    FLOAT32 = "float32"    # Standard 32-bit floating point
    FLOAT16 = "float16"    # Half-precision 16-bit
    INT8 = "int8"          # Scalar quantized 8-bit integer


# ============================================================================
# Request & Result DTOs
# ============================================================================


class EmbeddingRequestItem(BaseModel):
    """A single text chunk or document scheduled for embedding."""

    item_id: str = Field(description="Unique deterministic chunk ID (e.g. chk_...)")
    text: str = Field(description="Projected semantic text content")
    content_hash: str = Field(description="SHA-256 hash of the normalized text")
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Lineage and tenant metadata associated with this chunk",
    )


class EmbeddingBatchRequest(BaseModel):
    """Bounded batch request passed to an EmbeddingProvider."""

    items: List[EmbeddingRequestItem] = Field(
        description="List of text chunks to embed in this batch"
    )
    input_type: EmbeddingInputType = Field(
        default=EmbeddingInputType.DOCUMENT,
        description="Input type discrimination (document vs query)",
    )
    model_name: Optional[str] = Field(
        default=None,
        description="Override model name (defaults to provider's configured model)",
    )
    model_version: Optional[str] = Field(
        default=None,
        description="Target model version identifier",
    )
    dimension: Optional[int] = Field(
        default=None,
        description="Target vector dimensionality (for models supporting flexible dimensions)",
    )
    normalization: NormalizationPolicy = Field(
        default=NormalizationPolicy.L2,
        description="Normalization policy to apply to vectors",
    )
    dtype: EmbeddingDtype = Field(
        default=EmbeddingDtype.FLOAT32,
        description="Target vector numerical dtype",
    )


class EmbeddingResultItem(BaseModel):
    """Result vector and reproducibility metrics for a single input chunk."""

    item_id: str = Field(description="Chunk ID matching the EmbeddingRequestItem")
    vector: List[float] = Field(description="Dense floating-point vector coordinates")
    dimension: int = Field(description="Vector dimensionality")
    content_hash: str = Field(description="SHA-256 hash of the embedded content")
    token_count: Optional[int] = Field(default=None, description="Tokens consumed by this chunk")


class EmbeddingBatchResult(BaseModel):
    """Output envelope returned by an EmbeddingProvider."""

    results: List[EmbeddingResultItem] = Field(
        description="Successfully embedded vector items in order"
    )
    model_name: str = Field(description="Canonical model name that generated vectors")
    model_version: str = Field(description="Model version/checkpoint used")
    dimension: int = Field(description="Vector dimension (e.g. 1024, 1536)")
    normalization: NormalizationPolicy = Field(description="Normalization applied")
    dtype: EmbeddingDtype = Field(description="Precision dtype")
    total_tokens: int = Field(default=0, description="Total tokens processed across batch")
    latency_ms: float = Field(default=0.0, description="Latency spent inside provider call")
    partial_errors: Dict[str, str] = Field(
        default_factory=dict,
        description="Map of item_id -> error reason for any failed items in partial batch",
    )


# ============================================================================
# Reproducible Indexing Payload Metadata
# ============================================================================


class KnowledgeVectorPayload(BaseModel):
    """Complete, reproducible payload stored alongside each dense vector in Qdrant.

    Contains all tenant, lineage, category, lifecycle, and temporal properties
    needed for filtered retrieval and safe re-indexing.
    NEVER store credentials, secrets, or sensitive tokens here.
    """

    model_config = {"frozen": True}

    # === Tenant & Identity (Strict Isolation) ===
    organization_id: str = Field(description="Authoritative tenant ID")
    knowledge_item_id: str = Field(description="Parent KnowledgeItem.id")
    knowledge_version_id: str = Field(description="Immutable KnowledgeVersion.id")
    chunk_id: str = Field(description="Deterministic chunk ID (chk_...)")
    chunk_index: int = Field(description="Zero-indexed chunk offset within version")

    # === Categorization & Lineage ===
    title: Optional[str] = Field(default=None, description="Title of the knowledge item / entity")
    category: str = Field(description="Canonical knowledge category (e.g. products_services)")
    knowledge_category: Optional[str] = Field(default=None, description="ProxiPilot Knowledge taxonomy category")
    business_domain: Optional[str] = Field(default=None, description="Canonical business domain (e.g. home_appliances)")
    business_category: Optional[str] = Field(default=None, description="Business domain category (e.g. home_appliances)")
    service_subcategory: Optional[str] = Field(default=None, description="Service subcategory (e.g. washing_machine)")
    brand: Optional[str] = Field(default=None, description="Commercial brand or manufacturer name")
    source_id: Optional[str] = Field(default=None, description="KnowledgeSource.id origin")
    entity_type: Optional[str] = Field(default=None, description="Domain sub-type or entity type")
    entity_id: Optional[str] = Field(default=None, description="Domain entity reference ID")
    authority_level: Optional[str] = Field(default=None, description="Authoritative source trust tier")
    authority: str = Field(default="imported_data", description="Source authority tier")
    service_area: Optional[str] = Field(default=None, description="Service area or operational territory")
    region: Optional[str] = Field(default=None, description="Geographic validity region")
    language: str = Field(default="en", description="Primary document language (e.g. en, hi)")

    # === Lifecycle & Temporal Boundaries ===
    status: str = Field(default="active", description="Version lifecycle status (active, draft, archived)")
    effective_from: Optional[str] = Field(
        default=None,
        description="ISO 8601 timestamp when knowledge becomes valid (inclusive)",
    )
    effective_until: Optional[str] = Field(
        default=None,
        description="ISO 8601 timestamp when knowledge expires (exclusive, null = indefinite)",
    )

    # === Semantic Projection & Embedding Provenance ===
    section: str = Field(description="Logical section tag (e.g. pricing, overview)")
    text: str = Field(description="Chunk text content that was embedded")
    char_count: int = Field(description="Character length of text")
    projection_version: int = Field(description="Semantic projection template version")
    content_hash: str = Field(description="SHA-256 content hash of the projected chunk text")
    embedding_model: str = Field(description="Embedding model name (e.g. voyage-4-large)")
    embedding_model_version: str = Field(description="Embedding model release/checkpoint version")
    embedding_dimension: int = Field(description="Dimensionality of the dense vector")
    created_at: str = Field(description="ISO 8601 creation timestamp")
    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Rich business metadata filters (e.g. price, currency, sizes, variants)",
    )


# ============================================================================
# Provider Protocol Abstraction
# ============================================================================


@runtime_checkable
class EmbeddingProvider(Protocol):
    """Protocol that every embedding provider implementation must satisfy."""

    @property
    def model_name(self) -> str:
        """Name of the primary embedding model."""
        ...

    @property
    def model_version(self) -> str:
        """Version string of the embedding model."""
        ...

    @property
    def dimension(self) -> int:
        """Dimensionality of vectors produced by this provider."""
        ...

    async def embed_batch(self, request: EmbeddingBatchRequest) -> EmbeddingBatchResult:
        """Generate embeddings for a batch of text chunks asynchronously."""
        ...

    async def embed_single(
        self,
        text: str,
        input_type: EmbeddingInputType = EmbeddingInputType.DOCUMENT,
    ) -> List[float]:
        """Convenience method to generate an embedding for a single text."""
        ...
