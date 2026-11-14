"""Knowledge Source Lineage & Authority DTOs — Phase 7.4 Enterprise Contracts.

Typed request/response models and keyset pagination structures for:
- KnowledgeSource registration and deduplication
- Keyset cursor pagination (zero-OFFSET)
- Full lineage tracing from source -> item -> version
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.models.knowledge import KnowledgeSourceStatus, KnowledgeSourceType, SourceAuthorityLevel


class KnowledgeSourceCreateDTO(BaseModel):
    """Payload for registering or ingesting a knowledge source."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    name: str = Field(..., min_length=1, max_length=255, description="Human-readable source name")
    source_type: str = Field(
        default=KnowledgeSourceType.MANUAL.value,
        description="Origin mechanism (manual, csv, xlsx, api, import, system, connector)",
    )
    authority_level: str = Field(
        default=SourceAuthorityLevel.MANUAL.value,
        description="Truth arbitration tier (system, owner, admin, business_profile, imported_data, manual, external_source)",
    )
    status: Optional[str] = Field(
        default=KnowledgeSourceStatus.ACTIVE.value,
        description="Source lifecycle status (active, inactive, archived, revoked)",
    )
    source_reference: Optional[str] = Field(
        default=None,
        max_length=255,
        description="External identifier, batch ID, or connector ID",
    )
    dataset_name: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Logical dataset group name",
    )
    file_name: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Original uploaded filename",
    )
    checksum: Optional[str] = Field(
        default=None,
        max_length=128,
        description="Cryptographic SHA-256 hash for deduplication",
    )
    schema_fingerprint: Optional[str] = Field(
        default=None,
        max_length=64,
        description="Deterministic schema plan fingerprint",
    )
    effective_from: Optional[datetime] = Field(
        default=None,
        description="UTC datetime when this source becomes valid",
    )
    effective_until: Optional[datetime] = Field(
        default=None,
        description="UTC datetime when this source expires",
    )
    origin_uri: Optional[str] = Field(
        default=None,
        max_length=2048,
        description="Storage key or API URI",
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Arbitrary non-secret operational metadata",
    )


class KnowledgeSourceUpdateDTO(BaseModel):
    """Payload for updating an existing knowledge source."""

    model_config = ConfigDict(extra="ignore")

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    status: Optional[str] = Field(
        default=None,
        description="active | inactive | archived | revoked",
    )
    authority_level: Optional[str] = None
    dataset_name: Optional[str] = None
    effective_from: Optional[datetime] = None
    effective_until: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None


class KnowledgeSourceResponseDTO(BaseModel):
    """Clean API presentation DTO for a KnowledgeSource."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    organizationId: str
    source_type: str
    name: str
    authority_level: str
    status: str
    source_reference: Optional[str] = None
    dataset_name: Optional[str] = None
    file_name: Optional[str] = None
    checksum: Optional[str] = None
    schema_fingerprint: Optional[str] = None
    effective_from: Optional[datetime] = None
    effective_until: Optional[datetime] = None
    origin_uri: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    created_by_user_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items_count: int = 0
    versions_count: int = 0


class KnowledgeSourceCursorPageDTO(BaseModel):
    """Cursor-paginated list of KnowledgeSources."""

    items: List[KnowledgeSourceResponseDTO]
    next_cursor: Optional[str] = None
    has_more: bool
    total_count: Optional[int] = None


class KnowledgeSourceLineageItemDTO(BaseModel):
    """Lightweight summary of a KnowledgeItem derived from a source."""

    id: str
    title: str
    category: str
    is_active: bool
    version_count: int
    created_at: datetime


class KnowledgeSourceLineageVersionDTO(BaseModel):
    """Snapshot of a KnowledgeVersion tied to a source."""

    id: str
    knowledge_item_id: str
    item_title: str
    version_number: int
    status: str
    authority_level: str
    effective_from: Optional[datetime] = None
    effective_until: Optional[datetime] = None
    change_summary: Optional[str] = None
    created_at: datetime


class KnowledgeSourceLineageDTO(BaseModel):
    """Comprehensive lineage tree: Source -> Items & Versions."""

    source: KnowledgeSourceResponseDTO
    total_items: int
    total_versions: int
    active_items_count: int
    items: List[KnowledgeSourceLineageItemDTO]
    versions: List[KnowledgeSourceLineageVersionDTO]
