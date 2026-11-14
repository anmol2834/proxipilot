"""Phase 8.6: AI-Ready Semantic Projection DTOs and Data Contracts.

Defines deterministic data structures representing the semantic projection
of persisted canonical knowledge into AI-ready document representations
and logical chunks, ready for Phase 10 vector embedding.

Invariants:
- Deterministic IDs derived from stable composite keys.
- Pure metadata enrichment (tenant, source, version, temporal bounds).
- No embedding vectors or model-specific dependencies in this layer.
"""

from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class SemanticChunkDTO:
    """Deterministic logical chunk extracted from a projected semantic document."""

    chunk_id: str
    section: str
    text: str
    chunk_index: int
    organization_id: str
    knowledge_item_id: str
    knowledge_version_id: str
    category: str
    authority: str
    status: str
    source_id: Optional[str] = None
    effective_from: Optional[str] = None
    effective_until: Optional[str] = None
    char_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class SemanticMetadataDTO:
    """Rich metadata envelope accompanying a projected knowledge document."""

    source_id: Optional[str] = None
    source_type: Optional[str] = None
    authority: str = "manual"
    status: str = "active"
    effective_from: Optional[str] = None
    effective_until: Optional[str] = None
    region: Optional[str] = None
    language: Optional[str] = None
    entity_type: Optional[str] = None
    chunk_count: int = 0
    extra: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class SemanticDocumentDTO:
    """Complete deterministic semantic document representing a KnowledgeVersion."""

    document_id: str
    organization_id: str
    knowledge_item_id: str
    knowledge_version_id: str
    category: str
    full_text: str
    chunks: List[SemanticChunkDTO]
    projection_version: int
    metadata: SemanticMetadataDTO

    def to_dict(self) -> Dict[str, Any]:
        return {
            "document_id": self.document_id,
            "organization_id": self.organization_id,
            "knowledge_item_id": self.knowledge_item_id,
            "knowledge_version_id": self.knowledge_version_id,
            "category": self.category,
            "full_text": self.full_text,
            "chunks": [c.to_dict() for c in self.chunks],
            "projection_version": self.projection_version,
            "metadata": self.metadata.to_dict(),
        }


@dataclass
class ProjectionBatchSummaryDTO:
    """Aggregated outcome of a batch projection execution."""

    total_projected: int
    total_chunks: int
    duration_seconds: float
    projection_version: int
    errors: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
