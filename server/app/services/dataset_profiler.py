"""Phase 8.2 — Enterprise Bounded-Memory Dataset Profiler.

Specification:
- Purpose: Execute a single streaming pass over tabular datasets (CSV/XLSX/XLS) and generate a
  compact deterministic DatasetProfileDTO and schema fingerprint.
- Memory Guarantees:
  - Strictly O(columns) in-process state. Zero whole-dataset in-memory buffering.
  - Cardinality estimation bounded via BoundedCardinalityEstimator (Exact Set -> 128-byte HyperLogLog).
  - Samples capped at 5 truncated values per column (max 128 characters each).
- Performance:
  - Zero database queries, Redis calls, or queue messages per row.
  - Periodic cooperative cancellation checks (every 1,000 rows).
"""

from collections import defaultdict
import hashlib
from pathlib import Path
from typing import Callable, Dict, List, Optional, Set, Tuple

from app.algorithms.deduplication.hyperloglog import BoundedCardinalityEstimator
from app.algorithms.type_inference import DataType, TypeInferenceEngine
from app.contracts.dataset_profile import (
    ColumnProfileDTO,
    DatasetProfileDTO,
    FileParserMetadataDTO,
    ParserErrorType,
    QualitySummaryDTO,
)
from app.core.config import get_settings
from app.services.dataset_parser import (
    DatasetParserError,
    get_dataset_stream_parser,
    normalize_column_name,
)


class ColumnAccumulator:
    """In-memory bounded accumulator tracking single-pass statistics for a single column."""

    def __init__(
        self,
        original_name: str,
        column_index: int,
        sample_size: int = 5,
        max_enum_cardinality: int = 25,
    ) -> None:
        self.original_name = original_name
        self.normalized_name = normalize_column_name(original_name)
        self.column_index = column_index
        self.sample_size = sample_size
        self.max_enum_cardinality = max_enum_cardinality

        # Counters
        self.row_count_observed = 0
        self.non_empty_count = 0
        self.empty_count = 0
        self.max_length = 0

        # Numerical bounds
        self.min_numeric: Optional[float] = None
        self.max_numeric: Optional[float] = None

        # Type frequency
        self.type_counts: Dict[DataType, int] = defaultdict(int)

        # Samples (strictly bounded)
        self.samples: List[str] = []
        self._sample_set: Set[str] = set()

        # Patterns
        self.date_patterns: Set[str] = set()
        self.currency_symbols: Set[str] = set()
        self.is_ambiguous_date = False
        self.has_leading_zero = False

        # Cardinality & Enum tracking
        self.cardinality_estimator = BoundedCardinalityEstimator(exact_threshold=1_000)
        self.enum_candidates_set: Optional[Set[str]] = set()

    def update(self, raw_val: str) -> None:
        """Process a single cell value in O(1) time and memory."""
        self.row_count_observed += 1

        val = raw_val.strip() if raw_val else ""
        if not val:
            self.empty_count += 1
            return

        self.non_empty_count += 1
        val_len = len(val)
        if val_len > self.max_length:
            self.max_length = val_len

        # Cardinality
        self.cardinality_estimator.add(val)

        # Enum tracking
        if self.enum_candidates_set is not None:
            if len(self.enum_candidates_set) < self.max_enum_cardinality:
                self.enum_candidates_set.add(val)
            elif val not in self.enum_candidates_set:
                # Cardinality exceeded threshold; stop tracking enum candidates
                self.enum_candidates_set = None

        # Bounded samples
        if len(self.samples) < self.sample_size and val not in self._sample_set:
            truncated = val[:128]
            self.samples.append(truncated)
            self._sample_set.add(val)

        # Type inference
        obs = TypeInferenceEngine.infer_cell(val)
        for cand in obs.candidate_types:
            self.type_counts[cand] += 1

        if obs.numeric_value is not None:
            if self.min_numeric is None or obs.numeric_value < self.min_numeric:
                self.min_numeric = obs.numeric_value
            if self.max_numeric is None or obs.numeric_value > self.max_numeric:
                self.max_numeric = obs.numeric_value

        if obs.date_pattern:
            self.date_patterns.add(obs.date_pattern)
        if obs.currency_symbol:
            self.currency_symbols.add(obs.currency_symbol)
        if obs.is_ambiguous_date:
            self.is_ambiguous_date = True
        if obs.has_leading_zero:
            self.has_leading_zero = True

    def finalize(self) -> ColumnProfileDTO:
        """Finalize column profile statistics into ColumnProfileDTO."""
        empty_ratio = (
            round(self.empty_count / self.row_count_observed, 4)
            if self.row_count_observed > 0
            else 0.0
        )

        approx_unique = self.cardinality_estimator.cardinality()
        unique_ratio = (
            round(min(1.0, approx_unique / self.non_empty_count), 4)
            if self.non_empty_count > 0
            else 0.0
        )

        # Determine dominant type & confidence
        if self.non_empty_count == 0:
            dominant_type = DataType.STRING.value
            type_confidence = 1.0
            candidate_types = [DataType.STRING.value]
        else:
            # Sort candidate types by observation count descending
            sorted_candidates = sorted(
                self.type_counts.items(), key=lambda kv: kv[1], reverse=True
            )
            top_type, top_count = sorted_candidates[0]

            # Leading zero guardrail: strictly preserve as STRING / identifier
            if self.has_leading_zero:
                dominant_type = DataType.STRING.value
                top_count = self.type_counts.get(DataType.STRING, self.non_empty_count)
            else:
                # If STRING was top but 70%+ cells matched a specific structural type
                specific = [
                    (t, c)
                    for t, c in sorted_candidates
                    if t not in (DataType.STRING, DataType.TEXT) and c / self.non_empty_count >= 0.7
                ]
                if specific:
                    dominant_type = specific[0][0].value
                    top_count = specific[0][1]
                elif top_type == DataType.STRING and self.type_counts.get(DataType.TEXT, 0) > 0:
                    dominant_type = DataType.TEXT.value
                    top_count = self.type_counts[DataType.TEXT]
                else:
                    dominant_type = top_type.value

            type_confidence = round(
                max(0.1, min(1.0, top_count / self.non_empty_count)), 4
            )
            candidate_types = [t.value for t, _ in sorted_candidates]

        # Categorical / Enum-like detection
        enum_list: Optional[List[str]] = None
        if (
            self.non_empty_count >= 5
            and self.enum_candidates_set is not None
            and 1 < len(self.enum_candidates_set) <= self.max_enum_cardinality
            and (unique_ratio <= 0.25 or len(self.enum_candidates_set) <= 8)
        ):
            enum_list = sorted(list(self.enum_candidates_set))
            if DataType.ENUM.value not in candidate_types:
                candidate_types.insert(0, DataType.ENUM.value)

        return ColumnProfileDTO(
            original_name=self.original_name,
            normalized_name=self.normalized_name,
            column_index=self.column_index,
            row_count_observed=self.row_count_observed,
            non_empty_count=self.non_empty_count,
            empty_count=self.empty_count,
            empty_ratio=empty_ratio,
            candidate_types=candidate_types,
            dominant_type=dominant_type,
            type_confidence=type_confidence,
            samples=self.samples,
            max_length=self.max_length,
            min_numeric=self.min_numeric,
            max_numeric=self.max_numeric,
            date_patterns=sorted(list(self.date_patterns)),
            is_ambiguous_date=self.is_ambiguous_date,
            currency_symbols=sorted(list(self.currency_symbols)),
            enum_candidates=enum_list,
            approx_unique_count=approx_unique,
            approx_unique_ratio=unique_ratio,
            is_cardinality_exact=self.cardinality_estimator.is_exact,
        )


class DatasetProfiler:
    """Enterprise Bounded-Memory Dataset Profiler."""

    def __init__(
        self,
        max_rows: Optional[int] = None,
        max_cols: Optional[int] = None,
        max_cell_len: Optional[int] = None,
        max_sheets: Optional[int] = None,
        sample_size: Optional[int] = None,
        max_enum_cardinality: Optional[int] = None,
    ) -> None:
        settings = get_settings()
        parser_cfg = settings.parser
        self.max_rows = max_rows or parser_cfg.parser_max_rows
        self.max_cols = max_cols or parser_cfg.parser_max_columns
        self.max_cell_len = max_cell_len or parser_cfg.parser_max_cell_length
        self.max_sheets = max_sheets or parser_cfg.parser_max_sheets
        self.sample_size = sample_size or parser_cfg.parser_sample_size
        self.max_enum_cardinality = (
            max_enum_cardinality or parser_cfg.parser_max_enum_cardinality
        )

    def profile_file(
        self,
        file_path: Path,
        file_type: str,
        cancel_checker: Optional[Callable[[], bool]] = None,
    ) -> DatasetProfileDTO:
        """Stream file through bounded profiling engine and return DatasetProfileDTO.

        Args:
            file_path: Local filesystem path to staged upload file.
            file_type: File format: 'csv', 'xlsx', 'xls'.
            cancel_checker: Optional callable returning True if job cancellation was requested.

        Raises:
            DatasetParserError: If parsing fails, file violates limits, or job is cancelled.
        """
        parser = get_dataset_stream_parser(file_path, file_type)

        accumulators: List[ColumnAccumulator] = []
        total_data_rows = 0

        # Duplicate row tracking via bounded 64-bit row hash estimator
        row_duplicate_estimator = BoundedCardinalityEstimator(exact_threshold=5_000)

        # Stream rows
        row_generator = parser.stream_rows(
            max_rows=self.max_rows,
            max_cols=self.max_cols,
            max_cell_len=self.max_cell_len,
        )

        for row_idx, row_cells, headers in row_generator:
            # Initialize accumulators on first yielded row
            if not accumulators:
                accumulators = [
                    ColumnAccumulator(
                        original_name=h,
                        column_index=i,
                        sample_size=self.sample_size,
                        max_enum_cardinality=self.max_enum_cardinality,
                    )
                    for i, h in enumerate(headers)
                ]

            total_data_rows += 1

            # Cooperative cancellation check every 1,000 rows
            if total_data_rows % 1_000 == 0 and cancel_checker and cancel_checker():
                raise DatasetParserError(
                    ParserErrorType.CANCELLED,
                    f"Dataset profiling cancelled at row {total_data_rows} upon user request.",
                )

            # Update column accumulators
            for i, cell in enumerate(row_cells):
                if i < len(accumulators):
                    accumulators[i].update(cell)

            # Update duplicate row tracking
            row_repr = "|".join(row_cells)
            row_duplicate_estimator.add(row_repr)

        if not accumulators:
            raise DatasetParserError(
                ParserErrorType.INVALID_FILE, "Dataset contains no usable data rows or columns."
            )

        # Finalize columns
        finalized_columns = [acc.finalize() for acc in accumulators]

        # Duplicate row calculation
        unique_row_count = row_duplicate_estimator.cardinality()
        duplicate_count = max(0, total_data_rows - unique_row_count)
        is_duplicate_exact = row_duplicate_estimator.is_exact

        quality_summary = QualitySummaryDTO(
            total_rows=total_data_rows,
            total_columns=len(finalized_columns),
            empty_column_count=sum(1 for c in finalized_columns if c.non_empty_count == 0),
            duplicate_row_count_estimate=duplicate_count,
            is_duplicate_count_exact=is_duplicate_exact,
        )

        # File metadata
        file_metadata = parser.metadata or FileParserMetadataDTO(
            file_type=file_type.lower().strip(".")
        )

        # Cryptographic schema fingerprint (Section 18)
        # Deterministic SHA-256 over: normalized_name:dominant_type:index
        fingerprint_tokens = [
            f"{c.normalized_name}:{c.dominant_type}:{c.column_index}"
            for c in finalized_columns
        ]
        schema_fingerprint = hashlib.sha256(
            ";".join(fingerprint_tokens).encode("utf-8")
        ).hexdigest()

        return DatasetProfileDTO(
            schema_fingerprint=schema_fingerprint,
            file_metadata=file_metadata,
            quality_summary=quality_summary,
            columns=finalized_columns,
        )
