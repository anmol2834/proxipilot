"""Phase 8.3 — Column Mapping & Schema Detection Data Contracts.

Defines Pydantic V2 DTOs and enumerations for:
- Deterministic column mapping targets (CANONICAL_FIELD, CUSTOM_ATTRIBUTE, NEEDS_REVIEW, UNMAPPED, IGNORED)
- Explainable mapping reasons and confidence scores
- Immutable compiled mapping plans for Phase 8.4 batch ingestion
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class MappingTargetKind(str, Enum):
    """Classification of target field destination (Section 5)."""

    CANONICAL_FIELD = "CANONICAL_FIELD"
    CUSTOM_ATTRIBUTE = "CUSTOM_ATTRIBUTE"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    UNMAPPED = "UNMAPPED"
    IGNORED = "IGNORED"


class MappingReason(str, Enum):
    """Explainable deterministic rationale for mapping resolution (Section 9)."""

    EXACT_CANONICAL = "exact_canonical"
    EXACT_ALIAS = "exact_alias"
    CATEGORY_ALIAS = "category_alias"
    SAVED_PROFILE_REUSE = "saved_profile_reuse"
    CUSTOM_ATTRIBUTE_KEY = "custom_attribute_key"
    CUSTOM_ATTRIBUTE_DISPLAY = "custom_attribute_display"
    TOKEN_SIMILARITY = "token_similarity"
    TYPE_MISMATCH = "type_mismatch"
    AMBIGUOUS_KEYWORD = "ambiguous_keyword"
    MEDIA_IGNORED = "media_ignored"
    POSITIONAL_IGNORED = "positional_ignored"
    UNKNOWN = "unknown"


class ColumnMappingDTO(BaseModel):
    """Deterministic mapping specification for an individual source column."""

    source_column: str = Field(description="Original column header verbatim from file")
    normalized_column: str = Field(description="Normalized snake_case identifier")
    target_kind: MappingTargetKind = Field(description="Target classification destination")
    target_field: Optional[str] = Field(default=None, description="Resolved target field or attribute key")
    target_type: Optional[str] = Field(default=None, description="Expected target AttributeValueType")
    confidence: float = Field(ge=0.0, le=1.0, description="Explainable confidence score between 0.0 and 1.0")
    reason: MappingReason = Field(description="Deterministic reason for mapping assignment")
    candidates: List[str] = Field(
        default_factory=list,
        description="Candidate field options when marked as NEEDS_REVIEW",
    )
    is_required: bool = Field(default=False, description="True if target is a mandatory canonical field")
    transformation_op: str = Field(
        default="none",
        description="Recommended pre-validation transform operation (trim, lowercase, etc.)",
    )
    validation_notes: Optional[str] = Field(
        default=None,
        description="Advisory notes for Phase 8.4 normalization and validation",
    )

    model_config = ConfigDict(populate_by_name=True)


class CompiledMappingPlanDTO(BaseModel):
    """Immutable compiled mapping plan produced once per dataset (Section 7 & 8).

    Passed to Phase 8.4 for high-throughput batch normalization without per-row DB lookups.
    """

    schema_fingerprint: str = Field(description="Deterministic cryptographic fingerprint of dataset schema")
    category: str = Field(description="Canonical KnowledgeCategory context for mapping resolution")
    is_reused_from_profile: bool = Field(
        default=False,
        description="True if resolved from a pre-existing approved KnowledgeSchemaProfile",
    )
    profile_id: Optional[str] = Field(
        default=None,
        description="Associated KnowledgeSchemaProfile identifier if reused",
    )
    columns: List[ColumnMappingDTO] = Field(description="Ordered list of mapped source columns")
    mapped_count: int = Field(ge=0, description="Count of successfully mapped columns (canonical + custom)")
    unmapped_count: int = Field(ge=0, description="Count of unmapped columns")
    needs_review_count: int = Field(ge=0, description="Count of columns requiring human review")
    ignored_count: int = Field(default=0, ge=0, description="Count of deliberately ignored columns (e.g. media/binary)")
    total_columns: int = Field(ge=0, description="Total number of source columns evaluated")

    model_config = ConfigDict(populate_by_name=True)
