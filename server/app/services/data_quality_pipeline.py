"""Phase 8.4 — Enterprise Bounded Batch Data Quality Pipeline.

Streams file records in bounded batches (default: 1,000 rows/batch), executing:
1. Compiled Mapping Plan Header Alignment
2. Controlled Typed Normalization
3. Category Schema & Tenant Custom Attribute Validation
4. Deterministic Category Identity Generation
5. In-Memory Deduplication & Conflict Detection
6. Diagnostic Summary Generation

Guarantees:
- O(1) Memory Footprint relative to dataset rows (bounded batch size)
- Zero database queries per row (preloaded upfront)
- Error isolation (single invalid row does not abort entire batch)
- Cooperative cancellation support
"""

import logging
from pathlib import Path
from typing import Callable, Generator, List, Optional, Sequence, Tuple

from app.contracts.column_mapping import CompiledMappingPlanDTO
from app.contracts.data_quality import (
    BatchQualityResultDTO,
    DatasetQualitySummaryDTO,
    NormalizedRecordDTO,
    QualityRowStatus,
    RowQualityErrorCode,
    RowQualityIssueDTO,
    RowQualitySeverity,
)
from app.core.config import get_settings
from app.models.knowledge import KnowledgeAttributeDefinition
from app.services.dataset_parser import (
    DatasetParserError,
    ParserErrorType,
    get_dataset_stream_parser,
)
from app.services.deduplication_engine import DeduplicationEngine
from app.services.row_quality_service import RowQualityService

logger = logging.getLogger(__name__)


class DataQualityPipeline:
    """Streamed batch executor for dataset validation, normalization, and deduplication."""

    def __init__(
        self,
        tenant_id: str,
        category: str,
        mapping_plan: CompiledMappingPlanDTO,
        custom_attributes: Optional[List[KnowledgeAttributeDefinition]] = None,
        batch_size: int = 1000,
    ):
        self.tenant_id = tenant_id
        self.category = category
        self.mapping_plan = mapping_plan
        self.custom_attributes = custom_attributes or []
        self.batch_size = max(1, batch_size)
        self.dedup_engine = DeduplicationEngine(tenant_id, category)

    def process_file_batches(
        self,
        file_path: str,
        file_type: str,
        cancel_checker: Optional[Callable[[], bool]] = None,
    ) -> Generator[BatchQualityResultDTO, None, DatasetQualitySummaryDTO]:
        """Stream data rows from file in bounded batches, yielding BatchQualityResultDTO.

        Returns:
            DatasetQualitySummaryDTO once all rows have been streamed.
        """
        settings = get_settings()
        parser_cfg = settings.parser
        parser = get_dataset_stream_parser(Path(file_path), file_type)
        summary = DatasetQualitySummaryDTO()

        row_service: Optional[RowQualityService] = None
        current_batch_records: List[NormalizedRecordDTO] = []
        batch_idx = 0

        try:
            row_generator = parser.stream_rows(
                max_rows=parser_cfg.parser_max_rows,
                max_cols=parser_cfg.parser_max_columns,
                max_cell_len=parser_cfg.parser_max_cell_length,
            )
            for row_idx, row_values, headers in row_generator:
                # Cooperative cancellation check
                if cancel_checker and (row_idx % 500 == 0) and cancel_checker():
                    raise DatasetParserError(
                        ParserErrorType.CANCELLED,
                        f"Import cancelled cooperatively at row {row_idx + 1}.",
                    )

                # Initialize row service once headers are known
                if row_service is None:
                    row_service = RowQualityService(
                        tenant_id=self.tenant_id,
                        category=self.category,
                        mapping_plan=self.mapping_plan,
                        headers=headers,
                        custom_attributes=self.custom_attributes,
                        dedup_engine=self.dedup_engine,
                    )

                row_number = row_idx + 1  # 1-based data row number

                try:
                    record = row_service.process_row(row_number, row_values)
                except Exception as row_err:
                    # Isolate row-level exception
                    record = NormalizedRecordDTO(
                        row_number=row_number,
                        status=QualityRowStatus.INVALID,
                        organization_id=self.tenant_id,
                        category=self.category,
                        identity_key=f"org:{self.tenant_id}:cat:{self.category}:row:{row_number}:error",
                        canonical_data={},
                        custom_attributes={},
                        issues=[
                            RowQualityIssueDTO(
                                row_number=row_number,
                                field="row",
                                source_field=None,
                                error_code=RowQualityErrorCode.UNKNOWN_ERROR.value,
                                severity=RowQualitySeverity.ERROR.value,
                                message=f"Unexpected error processing row: {str(row_err)}",
                                invalid_value=None,
                            )
                        ],
                    )

                # Accumulate dataset-level stats
                summary.total_rows_evaluated += 1
                if record.status == QualityRowStatus.VALID:
                    summary.valid_count += 1
                elif record.status == QualityRowStatus.WARNING:
                    summary.warning_count += 1
                else:
                    summary.invalid_count += 1

                if record.is_duplicate:
                    summary.duplicate_count += 1
                if record.is_conflict:
                    summary.conflict_count += 1

                # Collect up to 50 sample issues for diagnostics
                for issue in record.issues:
                    if len(summary.sample_issues) < 50:
                        summary.sample_issues.append(issue)

                current_batch_records.append(record)

                # Emit batch when batch_size reached
                if len(current_batch_records) >= self.batch_size:
                    batch_result = self._create_batch_result(batch_idx, current_batch_records)
                    yield batch_result
                    batch_idx += 1
                    current_batch_records = []

            # Emit final partial batch if any rows remain
            if current_batch_records:
                batch_result = self._create_batch_result(batch_idx, current_batch_records)
                yield batch_result

        finally:
            if hasattr(parser, "close"):
                parser.close()

        return summary

    def execute(
        self,
        file_path: str,
        file_type: str,
        cancel_checker: Optional[Callable[[], bool]] = None,
    ) -> Tuple[List[NormalizedRecordDTO], DatasetQualitySummaryDTO]:
        """Execute validation pipeline on file, returning all records (for testing & moderate datasets)."""
        all_records: List[NormalizedRecordDTO] = []
        gen = self.process_file_batches(file_path, file_type, cancel_checker)
        try:
            while True:
                batch = next(gen)
                all_records.extend(batch.records)
        except StopIteration as stop:
            summary = stop.value
            return all_records, summary

    def _create_batch_result(
        self, batch_idx: int, records: List[NormalizedRecordDTO]
    ) -> BatchQualityResultDTO:
        valid_c = sum(1 for r in records if r.status == QualityRowStatus.VALID)
        warn_c = sum(1 for r in records if r.status == QualityRowStatus.WARNING)
        invalid_c = sum(1 for r in records if r.status == QualityRowStatus.INVALID)
        dup_c = sum(1 for r in records if r.is_duplicate)
        conf_c = sum(1 for r in records if r.is_conflict)

        return BatchQualityResultDTO(
            batch_index=batch_idx,
            total_rows=len(records),
            valid_count=valid_c,
            warning_count=warn_c,
            invalid_count=invalid_c,
            duplicate_count=dup_c,
            conflict_count=conf_c,
            records=records,
        )
