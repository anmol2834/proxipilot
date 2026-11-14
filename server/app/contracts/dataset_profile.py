"""Phase 8.2 — Dataset Profile Data Contracts and DTOs.

Defines Pydantic V2 DTOs for:
- Compact deterministic column profiles (cardinality, types, lengths, samples, numeric bounds)
- Dataset quality summaries (duplicate estimation, row/column counts)
- File parser metadata (delimiter, encoding, sheets, headers)
- Cryptographic schema fingerprinting
- Structured parser error types
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ParserErrorType(str, Enum):
    """Structured parser failure classification (Section 24)."""

    PARSER_ERROR = "PARSER_ERROR"
    ENCODING_ERROR = "ENCODING_ERROR"
    INVALID_FILE = "INVALID_FILE"
    TOO_MANY_COLUMNS = "TOO_MANY_COLUMNS"
    TOO_MANY_ROWS = "TOO_MANY_ROWS"
    CELL_TOO_LARGE = "CELL_TOO_LARGE"
    WORKBOOK_INVALID = "WORKBOOK_INVALID"
    AMBIGUOUS_HEADER = "AMBIGUOUS_HEADER"
    RESOURCE_LIMIT = "RESOURCE_LIMIT"
    CANCELLED = "CANCELLED"


class ColumnProfileDTO(BaseModel):
    """Compact statistical profile of an individual dataset column."""

    original_name: str = Field(description="Original verbatim column header as observed in file")
    normalized_name: str = Field(description="Normalized comparison identifier (lowercase snake_case)")
    column_index: int = Field(ge=0, description="0-based positional index of the column")

    # Observational counts
    row_count_observed: int = Field(ge=0, description="Total rows inspected for this column")
    non_empty_count: int = Field(ge=0, description="Count of non-null, non-empty cells")
    empty_count: int = Field(ge=0, description="Count of null or blank cells")
    empty_ratio: float = Field(ge=0.0, le=1.0, description="Proportion of empty cells (empty / total)")

    # Type & Confidence
    candidate_types: List[str] = Field(description="List of detected candidate types in descending frequency")
    dominant_type: str = Field(description="Highest confidence dominant candidate type")
    type_confidence: float = Field(ge=0.0, le=1.0, description="Confidence score for dominant type")

    # Bounded samples & lengths
    samples: List[str] = Field(default_factory=list, description="Bounded non-empty sample values (max 5)")
    max_length: int = Field(ge=0, description="Maximum observed string character length")

    # Numerical statistics (when applicable)
    min_numeric: Optional[float] = Field(default=None, description="Minimum numeric value if applicable")
    max_numeric: Optional[float] = Field(default=None, description="Maximum numeric value if applicable")

    # Date / Pattern information
    date_patterns: List[str] = Field(default_factory=list, description="Candidate date pattern formats detected")
    is_ambiguous_date: bool = Field(default=False, description="True if date format could be DD/MM or MM/DD")
    currency_symbols: List[str] = Field(default_factory=list, description="Detected currency symbols (e.g. $, €)")

    # Categorical / Enum-like detection
    enum_candidates: Optional[List[str]] = Field(
        default=None, description="Candidate categorical values if column exhibits low cardinality"
    )

    # Cardinality
    approx_unique_count: int = Field(ge=0, description="Distinct value count (exact or HLL estimated)")
    approx_unique_ratio: float = Field(ge=0.0, le=1.0, description="Ratio of unique values to non-empty count")
    is_cardinality_exact: bool = Field(default=True, description="True if distinct count was measured exactly")

    model_config = ConfigDict(populate_by_name=True)


class QualitySummaryDTO(BaseModel):
    """Dataset-level quality metrics."""

    total_rows: int = Field(ge=0, description="Total data rows parsed (excluding header)")
    total_columns: int = Field(ge=0, description="Total columns detected")
    empty_column_count: int = Field(ge=0, description="Count of columns with 100% empty values")
    duplicate_row_count_estimate: int = Field(ge=0, default=0, description="Estimated duplicate row count")
    is_duplicate_count_exact: bool = Field(default=True, description="True if duplicate count is exact")

    model_config = ConfigDict(populate_by_name=True)


class FileParserMetadataDTO(BaseModel):
    """File structure metadata extracted during parsing."""

    file_type: str = Field(description="Format of parsed file: csv, xls, xlsx")
    encoding: Optional[str] = Field(default=None, description="Detected text encoding (UTF-8, etc.)")
    delimiter: Optional[str] = Field(default=None, description="Detected CSV delimiter (comma, tab, semicolon)")
    sheet_name: Optional[str] = Field(default=None, description="Active sheet name profiled")
    sheet_names: Optional[List[str]] = Field(default=None, description="All sheet names in workbook")
    header_row_index: int = Field(ge=0, default=0, description="0-based line/row index identified as header")

    model_config = ConfigDict(populate_by_name=True)


class DatasetProfileDTO(BaseModel):
    """Complete, compact dataset profile for Phase 8.2 handoff to Phase 8.3."""

    schema_fingerprint: str = Field(description="Deterministic SHA-256 hash of schema structure")
    file_metadata: FileParserMetadataDTO
    quality_summary: QualitySummaryDTO
    columns: List[ColumnProfileDTO]

    model_config = ConfigDict(populate_by_name=True)
