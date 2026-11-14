"""Knowledge Base Domain Models — Phase 7.0 Enterprise Knowledge Architecture.

Tables owned by this module:
- knowledge_items: Stable logical identity of a business knowledge entry.
- knowledge_versions: Immutable version snapshots containing content, lifecycle, and temporal dates.
- knowledge_sources: Lineage origin and authority tracking for ingested and manual knowledge.
- knowledge_semantic_chunks: Semantic projection registry mapping version projections to Qdrant vector points.
- business_entities: Structured entity data (products, services, offices, contacts).

Architectural rules:
1. KnowledgeItem represents stable business identity. It persists across updates.
2. KnowledgeVersion represents content and fact state at a specific point in time.
3. Every mutable fact belongs to KnowledgeVersion, NOT KnowledgeItem.
4. Structured facts (prices, regions, dates) and custom attributes are modeled authoritatively
   in KnowledgeVersion.canonical_data (JSONB) with GIN indexing (EAV knowledge_attributes decommissioned).
5. Semantic/narrative projections live in knowledge_semantic_chunks and content_text
   for Phase 10 hybrid retrieval and candidate generation.
6. Centralized 9-category taxonomy. There is NO standalone pricing category;
   pricing belongs inside products_services.
7. Multi-tenant scoping: Every entity is strictly isolated by tenant_id (= organization_id).
8. Source authority: All knowledge records track lineage and authority level.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Set
import uuid
from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TenantAwareMixin


# =============================================================================
# Domain Enums — Frozen Contracts
# =============================================================================


class KnowledgeCategory(str, Enum):
    """Centralized taxonomy of 9 business knowledge categories.
    
    CRITICAL: Pricing is embedded within PRODUCTS_SERVICES; there is NO separate pricing category.
    """

    COMPANY_INFO = "company_info"
    PRODUCTS_SERVICES = "products_services"
    CONTACTS = "contacts"
    POLICIES = "policies"
    SUPPORT_FAQS = "support_faqs"
    OFFERS_PROMOTIONS = "offers_promotions"
    OPERATIONS = "operations"
    LOCATIONS = "locations"
    BRAND_COMMUNICATION = "brand_communication"


class KnowledgeSourceType(str, Enum):
    """Origin mechanism through which knowledge was introduced into ProxiPilot."""

    MANUAL = "manual"
    CSV = "csv"
    XLSX = "xlsx"
    API = "api"
    IMPORT = "import"
    SYSTEM = "system"
    CONNECTOR = "connector"


class KnowledgeSourceStatus(str, Enum):
    """Lifecycle status of a knowledge source."""

    ACTIVE = "active"
    INACTIVE = "inactive"
    ARCHIVED = "archived"
    REVOKED = "revoked"


class SourceAuthorityLevel(str, Enum):
    """Authority hierarchy used for truth arbitration and retrieval weighting."""

    SYSTEM = "system"                   # Highest authority (system-enforced invariants)
    OWNER = "owner"                     # Organization Owner input
    ADMIN = "admin"                     # Organization Admin input
    BUSINESS_PROFILE = "business_profile"# Verified organization profile
    IMPORTED_DATA = "imported_data"     # Bulk CSV/XLSX imports
    MANUAL = "manual"                   # General member manual entry
    EXTERNAL_SOURCE = "external_source" # External integrations/web sources


class KnowledgeLifecycleStatus(str, Enum):
    """Lifecycle state machine for a knowledge item and its versions."""

    DRAFT = "draft"                     # Work in progress; not retrievable by AI
    VALIDATED = "validated"             # Passed schema & entity validation
    ACTIVE = "active"                   # Primary authoritative version in production
    ARCHIVED = "archived"               # Superseded by newer version; historical audit only
    REVOKED = "revoked"                 # Explicitly deprecated / invalidated


class AttributeValueType(str, Enum):
    """Strongly typed data representation for machine-readable knowledge attributes."""

    STRING = "string"
    TEXT = "text"
    INTEGER = "integer"
    DECIMAL = "decimal"
    BOOLEAN = "boolean"
    DATE = "date"
    DATETIME = "datetime"
    CURRENCY = "currency"
    ENUM = "enum"
    ARRAY = "array"


class ImportJobStatus(str, Enum):
    """Execution lifecycle status of an asynchronous knowledge import job."""

    CREATED = "created"
    UPLOADING = "uploading"
    UPLOADED = "uploaded"
    PARSING = "parsing"
    SCHEMA_DETECTION = "schema_detection"
    MAPPING = "mapping"
    VALIDATING = "validating"
    IMPORTING = "importing"
    PROJECTING = "projecting"
    COMPLETED = "completed"
    PARTIAL = "partial"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ImportJobStage(str, Enum):
    """Active execution stage of the import orchestration pipeline."""

    CREATED = "created"
    UPLOADING = "uploading"
    UPLOADED = "uploaded"
    PARSING = "parsing"
    SCHEMA_DETECTION = "schema_detection"
    MAPPING = "mapping"
    VALIDATING = "validating"
    IMPORTING = "importing"
    PROJECTING = "projecting"
    COMPLETED = "completed"


# Centralized, immutable state machine transition graph
VALID_JOB_TRANSITIONS: Dict[ImportJobStatus, Set[ImportJobStatus]] = {
    ImportJobStatus.CREATED: {
        ImportJobStatus.UPLOADING,
        ImportJobStatus.UPLOADED,
        ImportJobStatus.PARSING,
        ImportJobStatus.FAILED,
        ImportJobStatus.CANCELLED,
    },
    ImportJobStatus.UPLOADING: {
        ImportJobStatus.UPLOADED,
        ImportJobStatus.FAILED,
        ImportJobStatus.CANCELLED,
    },
    ImportJobStatus.UPLOADED: {
        ImportJobStatus.PARSING,
        ImportJobStatus.FAILED,
        ImportJobStatus.CANCELLED,
    },
    ImportJobStatus.PARSING: {
        ImportJobStatus.SCHEMA_DETECTION,
        ImportJobStatus.VALIDATING,
        ImportJobStatus.FAILED,
        ImportJobStatus.CANCELLED,
    },
    ImportJobStatus.SCHEMA_DETECTION: {
        ImportJobStatus.MAPPING,
        ImportJobStatus.VALIDATING,
        ImportJobStatus.FAILED,
        ImportJobStatus.CANCELLED,
    },
    ImportJobStatus.MAPPING: {
        ImportJobStatus.VALIDATING,
        ImportJobStatus.IMPORTING,
        ImportJobStatus.FAILED,
        ImportJobStatus.CANCELLED,
    },
    ImportJobStatus.VALIDATING: {
        ImportJobStatus.IMPORTING,
        ImportJobStatus.FAILED,
        ImportJobStatus.CANCELLED,
    },
    ImportJobStatus.IMPORTING: {
        ImportJobStatus.PROJECTING,
        ImportJobStatus.COMPLETED,
        ImportJobStatus.PARTIAL,
        ImportJobStatus.FAILED,
        ImportJobStatus.CANCELLED,
    },
    ImportJobStatus.PROJECTING: {
        ImportJobStatus.COMPLETED,
        ImportJobStatus.PARTIAL,
        ImportJobStatus.FAILED,
        ImportJobStatus.CANCELLED,
    },
    # Terminal states (allow restart/retry from FAILED if re-queued)
    ImportJobStatus.COMPLETED: set(),
    ImportJobStatus.PARTIAL: set(),
    ImportJobStatus.FAILED: {
        ImportJobStatus.PARSING,
        ImportJobStatus.UPLOADED,
        ImportJobStatus.CREATED,
    },
    ImportJobStatus.CANCELLED: set(),
}


# =============================================================================
# KnowledgeSource — Lineage & Authority
# =============================================================================


class KnowledgeSource(Base, TenantAwareMixin):
    """Tracks the exact lineage, authority, and origin of knowledge entries.
    
    Every version links to a KnowledgeSource to answer:
    - Where did this knowledge come from? (CSV, Manual, API, System)
    - What authority level does it hold?
    - Who uploaded or created it, and when?
    - What is its temporal validity window?
    """

    __tablename__ = "knowledge_sources"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"ks_{uuid.uuid4().hex}",
    )
    # tenant_id comes from TenantAwareMixin (= organization_id)
    source_type: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=KnowledgeSourceType.MANUAL.value,
        index=True,
        comment="manual | csv | xlsx | api | import | system | connector",
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Human-readable source label (e.g. 'Catalog Import Q3', 'Support Desk')",
    )
    authority_level: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=SourceAuthorityLevel.MANUAL.value,
        index=True,
        comment="system | owner | admin | business_profile | imported_data | manual | external_source",
    )
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=KnowledgeSourceStatus.ACTIVE.value,
        index=True,
        comment="active | inactive | archived | revoked",
    )
    source_reference: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        default=None,
        comment="External reference, batch identifier, or connector ID",
    )
    dataset_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        default=None,
        comment="Logical dataset name (e.g. 'Q3 Master Catalog')",
    )
    file_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        default=None,
        comment="Original uploaded filename (e.g. 'inventory_2026.csv')",
    )
    checksum: Mapped[Optional[str]] = mapped_column(
        String(128),
        nullable=True,
        default=None,
        comment="Cryptographic content hash (e.g. SHA-256) for deduplication",
    )
    schema_fingerprint: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
        comment="Deterministic schema fingerprint from flexible schema engine",
    )
    effective_from: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
        comment="UTC timestamp when this source becomes valid",
    )
    effective_until: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
        comment="UTC timestamp when this source expires (null = indefinite)",
    )
    origin_uri: Mapped[Optional[str]] = mapped_column(
        String(2048),
        nullable=True,
        default=None,
        comment="File storage key, API source URL, or reference URI",
    )
    metadata_json: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        default=None,
        comment="JSON object storing source technical metadata (checksum, rows, encoding)",
    )
    created_by_user_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
    )

    # Relationships
    items: Mapped[List["KnowledgeItem"]] = relationship(
        back_populates="source",
    )
    versions: Mapped[List["KnowledgeVersion"]] = relationship(
        back_populates="source",
    )
    import_jobs: Mapped[List["ImportJob"]] = relationship(
        back_populates="source",
    )

    __table_args__ = (
        Index("ix_knowledge_sources_tenant_authority", "tenant_id", "authority_level"),
        Index("ix_knowledge_sources_tenant_created", "tenant_id", "created_at"),
        Index("ix_knowledge_sources_tenant_status", "tenant_id", "status"),
        Index("ix_knowledge_sources_tenant_checksum", "tenant_id", "checksum"),
        Index("ix_knowledge_sources_tenant_type_ref", "tenant_id", "source_type", "source_reference"),
    )

    def __repr__(self) -> str:
        return f"<KnowledgeSource id={self.id} type={self.source_type} authority={self.authority_level}>"


# =============================================================================
# ImportJob — Durable Async Import Orchestration
# =============================================================================


class ImportJob(Base, TenantAwareMixin):
    """Durable asynchronous import job orchestration record.

    PostgreSQL is the authoritative source of truth for job lifecycle,
    execution progress, heartbeat status, and error diagnosis.
    """

    __tablename__ = "import_jobs"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"ij_{uuid.uuid4().hex}",
    )
    source_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("knowledge_sources.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    dataset_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    file_type: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="csv",
    )
    file_size_bytes: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        nullable=True,
        default=None,
    )
    file_uri: Mapped[Optional[str]] = mapped_column(
        String(2048),
        nullable=True,
        default=None,
    )
    idempotency_key: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        default=None,
    )
    row_count: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        default=None,
    )
    processed_rows: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    failed_rows: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    progress_percent: Mapped[float] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        default=0.00,
    )
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=ImportJobStatus.CREATED.value,
        index=True,
    )
    current_stage: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=ImportJobStage.CREATED.value,
    )
    worker_id: Mapped[Optional[str]] = mapped_column(
        String(128),
        nullable=True,
        default=None,
    )
    last_heartbeat_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )
    cancel_requested_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )
    retry_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    max_retries: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=3,
    )
    error_summary: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        default=None,
    )
    error_details_json: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        default=None,
    )
    metadata_json: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        default=None,
    )
    created_by_user_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        default=None,
    )

    # Relationships
    source: Mapped["KnowledgeSource"] = relationship(
        back_populates="import_jobs",
    )

    __table_args__ = (
        Index("ix_import_jobs_tenant_status", "tenant_id", "status"),
        Index("ix_import_jobs_tenant_created", "tenant_id", "created_at"),
        Index("ix_import_jobs_tenant_source", "tenant_id", "source_id"),
        Index("ix_import_jobs_heartbeat_recovery", "status", "last_heartbeat_at"),
    )

    def __repr__(self) -> str:
        return f"<ImportJob id={self.id} status={self.status} stage={self.current_stage} progress={self.progress_percent}%>"


# =============================================================================
# KnowledgeItem — Stable Logical Identity
# =============================================================================


class KnowledgeItem(Base, TenantAwareMixin):
    """Stable logical identity of a business knowledge entry.
    
    A KnowledgeItem represents an ongoing business concept (e.g. 'ProxiPilot Standard',
    'Return Policy', 'Mumbai Branch Office'). Its identity persists across content updates.
    All mutable content, structured facts, and temporal ranges live in KnowledgeVersion.
    """

    __tablename__ = "knowledge_items"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"ki_{uuid.uuid4().hex}",
    )
    # tenant_id comes from TenantAwareMixin (= organization_id)
    title: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
        index=True,
        comment="Canonical title or entity name",
    )
    category: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default=KnowledgeCategory.COMPANY_INFO.value,
        index=True,
        comment="Frozen 9-category taxonomy",
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        default=None,
        comment="High-level description or summary",
    )
    source_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        ForeignKey("knowledge_sources.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Primary or origin source reference",
    )
    source_type: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=KnowledgeSourceType.MANUAL.value,
    )
    current_version_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
        index=True,
        comment="ID of the currently active/published KnowledgeVersion",
    )
    tags: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        default=None,
        comment="JSON array of user-defined string tags",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        index=True,
        comment="Whether the item is active in the organization catalog",
    )
    created_by_user_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
    )

    # Phase 8.5 — Canonical Import Identity Key
    external_identity_key: Mapped[Optional[str]] = mapped_column(
        String(512),
        nullable=True,
        default=None,
        index=True,
        comment=(
            "Deterministic canonical identity key assigned during bulk import (Phase 8.5). "
            "Derived from category-specific business fields (e.g. SKU, name). "
            "NULL for manually authored items. "
            "Used with (tenant_id, category) for idempotent upsert resolution."
        ),
    )

    # Relationships
    source: Mapped[Optional["KnowledgeSource"]] = relationship(
        back_populates="items",
    )
    versions: Mapped[List["KnowledgeVersion"]] = relationship(
        back_populates="knowledge_item",
        cascade="all, delete-orphan",
        order_by="desc(KnowledgeVersion.version_number)",
    )

    __table_args__ = (
        Index("ix_knowledge_items_tenant_category", "tenant_id", "category"),
        Index("ix_knowledge_items_tenant_active", "tenant_id", "is_active"),
        Index("ix_knowledge_items_tenant_created", "tenant_id", "created_at"),
        # Phase 8.5: Partial unique index for canonical import idempotency.
        # Only applies when external_identity_key IS NOT NULL (manual items unaffected).
        Index(
            "uq_knowledge_items_tenant_cat_identity",
            "tenant_id",
            "category",
            "external_identity_key",
            unique=True,
            postgresql_where="external_identity_key IS NOT NULL",
        ),
    )

    def __repr__(self) -> str:
        return f"<KnowledgeItem id={self.id} title={self.title!r} category={self.category}>"


# =============================================================================
# KnowledgeVersion — Content State & Temporal Validity
# =============================================================================


class KnowledgeVersion(Base, TenantAwareMixin):
    """Immutable snapshot of content and structured facts for a KnowledgeItem.
    
    Supports:
    - Version numbering (monotonic per KnowledgeItem)
    - Lifecycle status (draft, validated, active, archived, revoked)
    - Temporal validity (effective_from, effective_until)
    - Source lineage and authority level
    - Narrative/semantic content for future RAG
    - Extensible structured attributes via KnowledgeAttribute
    """

    __tablename__ = "knowledge_versions"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"kv_{uuid.uuid4().hex}",
    )
    # tenant_id comes from TenantAwareMixin (= organization_id)
    knowledge_item_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("knowledge_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
        comment="Monotonically increasing version counter per knowledge item",
    )
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=KnowledgeLifecycleStatus.DRAFT.value,
        index=True,
        comment="draft | validated | active | archived | revoked",
    )
    source_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        ForeignKey("knowledge_sources.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Specific source lineage for this version",
    )
    authority_level: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=SourceAuthorityLevel.MANUAL.value,
        index=True,
    )

    # Narrative & Semantic content
    content_text: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        default=None,
        comment="Human-readable plain text narrative content (for future semantic projection)",
    )
    change_summary: Mapped[Optional[str]] = mapped_column(
        String(512),
        nullable=True,
        default=None,
        comment="Brief description of what changed in this version",
    )

    # Temporal validity window
    effective_from: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
        index=True,
        comment="UTC timestamp when this knowledge version becomes effective",
    )
    effective_until: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
        index=True,
        comment="UTC timestamp when this knowledge version expires (null = indefinite)",
    )

    # Binary storage references (Phase 8 file uploads will attach here)
    storage_object_key: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True, default=None)
    source_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True, default=None)
    original_filename: Mapped[Optional[str]] = mapped_column(String(512), nullable=True, default=None)
    mime_type: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, default=None)
    size_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, default=None)

    # Vector reference placeholders (Reserved for Phase 10 semantic projection)
    chunk_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, default=None)
    embedding_model: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, default=None)

    # Phase 8.6: Semantic Projection
    semantic_version: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        default=None,
        comment="Semantic projection schema version (Phase 8.6)",
    )

    # Phase 9.6: Canonical JSONB & Search Sync Alignment
    canonical_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=True,
        default=None,
        comment="Authoritative normalized business data (JSONB)",
    )
    projection_status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="pending",
        index=True,
        comment="pending | projected | failed",
    )
    semantic_status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="pending",
        index=True,
        comment="pending | synced | failed",
    )
    projection_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True, default=None)
    last_projected_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, default=None)

    # Lifecycle audit timestamps
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, default=None)
    archived_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, default=None)
    published_by_user_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, default=None)
    created_by_user_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, default=None)

    # Relationships
    knowledge_item: Mapped["KnowledgeItem"] = relationship(
        back_populates="versions",
    )
    source: Mapped[Optional["KnowledgeSource"]] = relationship(
        back_populates="versions",
    )
    semantic_chunks: Mapped[List["KnowledgeSemanticChunk"]] = relationship(
        back_populates="knowledge_version",
        cascade="all, delete-orphan",
        order_by="KnowledgeSemanticChunk.chunk_index",
    )

    __table_args__ = (
        UniqueConstraint(
            "knowledge_item_id",
            "version_number",
            name="uq_knowledge_versions_item_version",
        ),
        Index(
            "ix_knowledge_versions_temporal",
            "tenant_id",
            "status",
            "effective_from",
            "effective_until",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<KnowledgeVersion id={self.id} "
            f"item={self.knowledge_item_id} v={self.version_number} status={self.status}>"
        )


# =============================================================================
# Deprecated: KnowledgeAttribute (Decommissioned in Phase 9.7)
# All business and custom attributes are now stored authoritatively in
# KnowledgeVersion.canonical_data (JSONB) with GIN indexing.
# =============================================================================


class KnowledgeAttribute:
    """Deprecated stub retained for backward import compatibility."""
    pass


# =============================================================================
# KnowledgeSemanticChunk — Phase 8.6 Logical Chunk Storage for Phase 10
# =============================================================================


class KnowledgeSemanticChunk(Base, TenantAwareMixin):
    """Deterministic logical chunk of a projected KnowledgeVersion for Phase 10 vector embedding.

    Stores decomposed, section-tagged text with rich tenant and lifecycle metadata,
    enabling Phase 10 to embed chunks without re-querying or parsing canonical rows.
    """

    __tablename__ = "knowledge_semantic_chunks"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        comment="Deterministic chunk ID (e.g. chk_<sha256>)",
    )
    # tenant_id comes from TenantAwareMixin (= organization_id)
    knowledge_item_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("knowledge_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    knowledge_version_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("knowledge_versions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chunk_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="0-indexed position within the version projection",
    )
    section: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        comment="Logical section name (e.g. overview, pricing, features)",
    )
    text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Exact chunk text ready for embedding",
    )
    char_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Character length of chunk text",
    )
    projection_version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
        comment="Projection template schema version",
    )
    source_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        ForeignKey("knowledge_sources.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    authority_level: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=SourceAuthorityLevel.MANUAL.value,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=KnowledgeLifecycleStatus.ACTIVE.value,
        index=True,
    )
    effective_from: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )
    effective_until: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )

    # Phase 9.6: Qdrant Sync and Search Alignment
    vector_point_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
        index=True,
        comment="Qdrant vector point ID reference",
    )
    semantic_hash: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
        comment="Deterministic SHA-256 hash of chunk content",
    )
    chunk_metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        "metadata",
        JSON().with_variant(JSONB, "postgresql"),
        nullable=True,
        default=None,
        comment="Search payload filters and rich metadata",
    )

    # Relationships
    knowledge_version: Mapped["KnowledgeVersion"] = relationship(
        back_populates="semantic_chunks",
    )
    knowledge_item: Mapped["KnowledgeItem"] = relationship()
    source: Mapped[Optional["KnowledgeSource"]] = relationship()

    __table_args__ = (
        UniqueConstraint(
            "knowledge_version_id",
            "chunk_index",
            name="uq_knowledge_semantic_chunks_ver_idx",
        ),
        Index("ix_knowledge_semantic_chunks_tenant_ver", "tenant_id", "knowledge_version_id"),
        Index("ix_knowledge_semantic_chunks_tenant_sec", "tenant_id", "section"),
        Index("ix_knowledge_semantic_chunks_tenant_item", "tenant_id", "knowledge_item_id"),
        Index("ix_knowledge_semantic_chunks_tenant_hash", "tenant_id", "semantic_hash"),
    )

    def __repr__(self) -> str:
        return (
            f"<KnowledgeSemanticChunk id={self.id} ver={self.knowledge_version_id} "
            f"idx={self.chunk_index} sec={self.section}>"
        )


# =============================================================================
# KnowledgeAttributeDefinition — Organization-Scoped Custom Schema Model
# =============================================================================


class KnowledgeAttributeDefinition(Base, TenantAwareMixin):
    """Organization-scoped definition of a custom attribute for a knowledge category.
    
    Ensures custom fields are typed, validated, and strictly partitioned by tenant.
    Prevents Organization A's custom fields (e.g. 'warranty_period') from leaking
    to or colliding with Organization B's custom fields (e.g. 'installation_type').
    """

    __tablename__ = "knowledge_attribute_definitions"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"kad_{uuid.uuid4().hex}",
    )
    # tenant_id comes from TenantAwareMixin (= organization_id)
    category: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        comment="Category to which this custom attribute belongs",
    )
    key: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        index=True,
        comment="Normalized attribute key (e.g. 'warranty_period', 'material')",
    )
    display_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Human-readable label for UI forms and imports",
    )
    value_type: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=AttributeValueType.STRING.value,
        comment="string | text | integer | decimal | boolean | date | datetime | currency | enum | array",
    )
    is_required: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="Whether this custom attribute is mandatory for this category in this tenant",
    )
    allowed_values_json: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        default=None,
        comment="JSON array of allowed string options if value_type == enum",
    )
    validation_regex: Mapped[Optional[str]] = mapped_column(
        String(512),
        nullable=True,
        default=None,
        comment="Optional regex pattern to validate string values",
    )
    description: Mapped[Optional[str]] = mapped_column(
        String(512),
        nullable=True,
        default=None,
        comment="Field guidance / help text for users",
    )
    created_by_user_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
    )

    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "category",
            "key",
            name="uq_knowledge_attr_def_tenant_cat_key",
        ),
        Index("ix_knowledge_attr_def_tenant_cat", "tenant_id", "category"),
    )

    def __repr__(self) -> str:
        return f"<KnowledgeAttributeDefinition tenant={self.tenant_id} cat={self.category} key={self.key!r} type={self.value_type}>"


# =============================================================================
# BusinessEntity — Structured Business Data Entity
# =============================================================================


class BusinessEntity(Base, TenantAwareMixin):
    """Structured business data record.
    
    Stores structured business information such as products, services,
    team members, and office locations.
    
    Pricing invariant: Pricing is stored as an attribute within entity_type=product_service,
    NOT as a standalone top-level category.
    """

    __tablename__ = "business_entities"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"be_{uuid.uuid4().hex}",
    )
    # tenant_id comes from TenantAwareMixin (= organization_id)
    entity_type: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        comment="Structured type: product_service | team_member | office | policy | faq",
    )
    name: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True, default=None)
    attributes_json: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        default=None,
        comment="JSON object of entity-type-specific attributes (e.g. price, SKU, phone)",
    )
    authority_score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=1.0,
        comment="Source authority weight for hybrid retrieval ranking (0.0–1.0)",
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    effective_from: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
        comment="ISO 8601 date from which this entity is valid",
    )
    effective_until: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
        comment="ISO 8601 date until which this entity is valid (null = indefinite)",
    )
    created_by_user_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, default=None)

    __table_args__ = (
        Index("ix_business_entities_tenant_type", "tenant_id", "entity_type"),
    )

    def __repr__(self) -> str:
        return f"<BusinessEntity id={self.id} type={self.entity_type} name={self.name!r}>"


# =============================================================================
# KnowledgeSchemaProfile — Reusable Tenant-Scoped Schema Mapping Profile
# =============================================================================


class KnowledgeSchemaProfile(Base, TenantAwareMixin):
    """Reusable, tenant-scoped schema mapping profile.
    
    Permits organizations to save and reuse approved column mappings for recurring
    CSV/XLSX or connector ingestion without rediscovering the schema every time.
    """

    __tablename__ = "knowledge_schema_profiles"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"ksp_{uuid.uuid4().hex}",
    )
    # tenant_id comes from TenantAwareMixin (= organization_id)
    category: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        comment="Target canonical category key",
    )
    fingerprint: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        comment="Deterministic SHA-256 fingerprint of normalized source column names",
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="User-friendly label (e.g. 'Supplier Price Sheet Q3')",
    )
    source_type: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="csv",
        comment="csv | xlsx | api | connector",
    )
    mappings_json: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="JSON serialized list of approved FieldMapping specifications",
    )
    version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
        comment="Schema profile revision number",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        index=True,
    )
    created_by_user_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
    )

    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "category",
            "fingerprint",
            "version",
            name="uq_knowledge_schema_profile_tenant_cat_fp_ver",
        ),
        Index("ix_knowledge_schema_profiles_tenant_cat_fp", "tenant_id", "category", "fingerprint"),
    )

    def __repr__(self) -> str:
        return f"<KnowledgeSchemaProfile id={self.id} tenant={self.tenant_id} cat={self.category} name={self.name!r} v={self.version}>"

