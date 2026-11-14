"""Phase 8.4 — Data Quality, Validation, Normalization & Deduplication Contracts.

Defines Pydantic DTOs and Enums governing:
- Row data quality status (VALID, WARNING, INVALID)
- Structured machine-readable error codes & issues
- Normalized canonical & custom record representation
- Category-aware deduplication outcomes (compatible vs conflicting)
- Bounded batch and dataset-level quality summaries
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class QualityRowStatus(str, Enum):
    """Centralized row-level data quality status."""

    VALID = "VALID"
    WARNING = "WARNING"
    INVALID = "INVALID"


class RowQualitySeverity(str, Enum):
    """Severity of an individual row quality issue."""

    ERROR = "ERROR"
    WARNING = "WARNING"
    INFO = "INFO"


class RowQualityErrorCode(str, Enum):
    """Stable, machine-readable row validation and quality error codes."""

    REQUIRED_FIELD_MISSING = "REQUIRED_FIELD_MISSING"
    INVALID_STRING = "INVALID_STRING"
    INVALID_TEXT = "INVALID_TEXT"
    INVALID_INTEGER = "INVALID_INTEGER"
    INVALID_DECIMAL = "INVALID_DECIMAL"
    INVALID_BOOLEAN = "INVALID_BOOLEAN"
    INVALID_DATE = "INVALID_DATE"
    INVALID_DATETIME = "INVALID_DATETIME"
    INVALID_CURRENCY = "INVALID_CURRENCY"
    INVALID_ENUM = "INVALID_ENUM"
    INVALID_EMAIL = "INVALID_EMAIL"
    INVALID_URL = "INVALID_URL"
    INVALID_PHONE = "INVALID_PHONE"
    INVALID_ARRAY = "INVALID_ARRAY"
    OUT_OF_BOUNDS = "OUT_OF_BOUNDS"
    REGEX_MISMATCH = "REGEX_MISMATCH"
    CUSTOM_ATTRIBUTE_INVALID = "CUSTOM_ATTRIBUTE_INVALID"
    UNMAPPED_REQUIRED_FIELD = "UNMAPPED_REQUIRED_FIELD"
    DUPLICATE_RECORD = "DUPLICATE_RECORD"
    CONFLICTING_DUPLICATE = "CONFLICTING_DUPLICATE"
    UNKNOWN_ERROR = "UNKNOWN_ERROR"


class RowQualityIssueDTO(BaseModel):
    """Structured diagnostic representation of a validation or quality defect."""

    row_number: int = Field(description="1-based data row number in the file")
    field: str = Field(description="Canonical field name or custom attribute key")
    source_field: Optional[str] = Field(default=None, description="Original source column header if mapped")
    error_code: str = Field(description="Machine-readable RowQualityErrorCode string")
    severity: str = Field(default="ERROR", description="ERROR | WARNING | INFO")
    message: str = Field(description="Human-readable explanation of the defect")
    invalid_value: Optional[str] = Field(default=None, description="Truncated string representation of invalid input")

    model_config = ConfigDict(populate_by_name=True)


class NormalizedRecordDTO(BaseModel):
    """Clean, typed canonical and custom record produced per row."""

    row_number: int = Field(description="1-based data row number")
    status: QualityRowStatus = Field(description="VALID | WARNING | INVALID")
    organization_id: str = Field(description="Tenant identifier")
    category: str = Field(description="Canonical category identifier")
    identity_key: str = Field(description="Deterministic category-aware identity key used for deduplication")
    canonical_data: Dict[str, Any] = Field(
        default_factory=dict,
        description="Normalized, typed canonical fields matching CategoryDefinition",
    )
    custom_attributes: Dict[str, Any] = Field(
        default_factory=dict,
        description="Normalized, typed custom attributes defined by tenant",
    )
    issues: List[RowQualityIssueDTO] = Field(
        default_factory=list,
        description="Quality and validation issues observed on this row",
    )
    is_duplicate: bool = Field(default=False, description="True if identical duplicate of an earlier row")
    duplicate_of_row: Optional[int] = Field(default=None, description="Row number of first-seen identical record")
    is_conflict: bool = Field(default=False, description="True if conflicting duplicate with differing attributes")
    conflict_details: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Details of mismatched fields between conflicting duplicates",
    )

    model_config = ConfigDict(populate_by_name=True)


class BatchQualityResultDTO(BaseModel):
    """Results of a bounded batch evaluation."""

    batch_index: int = Field(description="0-based batch sequence index")
    total_rows: int = Field(description="Number of rows evaluated in this batch")
    valid_count: int = Field(description="Count of VALID rows")
    warning_count: int = Field(description="Count of WARNING rows")
    invalid_count: int = Field(description="Count of INVALID rows")
    duplicate_count: int = Field(description="Count of duplicate rows")
    conflict_count: int = Field(description="Count of conflicting duplicate rows")
    records: List[NormalizedRecordDTO] = Field(description="Normalized records in this batch")

    model_config = ConfigDict(populate_by_name=True)


class DatasetQualitySummaryDTO(BaseModel):
    """Aggregate quality metrics across the entire dataset import."""

    total_rows_evaluated: int = Field(default=0, description="Total data rows parsed and evaluated")
    valid_count: int = Field(default=0, description="Total clean VALID records ready for persistence")
    warning_count: int = Field(default=0, description="Records accepted with non-fatal warnings")
    invalid_count: int = Field(default=0, description="Records rejected due to fatal validation errors")
    duplicate_count: int = Field(default=0, description="Count of duplicate records observed")
    conflict_count: int = Field(default=0, description="Count of conflicting duplicate records")
    sample_issues: List[RowQualityIssueDTO] = Field(
        default_factory=list,
        description="Representative sample of issues (up to 50) for UI display",
    )

    model_config = ConfigDict(populate_by_name=True)
