"""Phase 8.5 — Canonical Persistence Contracts.

Typed Pydantic DTOs governing the bulk-batch PostgreSQL write layer:

- PersistenceOutcome: per-record disposition after attempting canonical write
- RecordPersistenceResultDTO: per-record lineage refs and outcome
- BatchPersistenceResultDTO: batch-level counters and record outcomes
- ImportPersistenceSummaryDTO: aggregate metrics across all batches
- PersistenceBatchConfig: configurable batch parameters
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class PersistenceOutcome(str, Enum):
    """Disposition of a single normalized record after canonical persistence attempt."""

    INSERTED = "INSERTED"
    """New KnowledgeItem + KnowledgeVersion created."""

    VERSIONED = "VERSIONED"
    """Existing KnowledgeItem found; new KnowledgeVersion created."""

    UNCHANGED = "UNCHANGED"
    """Existing KnowledgeItem found; data unchanged, retained active version without write."""

    DUPLICATE = "DUPLICATE"
    """Record is an exact compatible duplicate; skipped without DB write."""

    CONFLICT = "CONFLICT"
    """Record conflicts with existing data on key fields; skipped, logged."""

    INVALID = "INVALID"
    """Record failed Phase 8.4 validation; not persisted."""

    FAILED = "FAILED"
    """Unexpected transient or permanent error during persistence."""


class RecordPersistenceResultDTO(BaseModel):
    """Per-record outcome from the persistence layer, including lineage references."""

    row_number: int = Field(description="1-based source file row number")
    outcome: PersistenceOutcome = Field(description="Disposition of this record")
    identity_key: str = Field(description="Deterministic identity key used for upsert resolution")
    knowledge_item_id: Optional[str] = Field(
        default=None,
        description="KnowledgeItem.id if INSERTED or VERSIONED",
    )
    knowledge_version_id: Optional[str] = Field(
        default=None,
        description="KnowledgeVersion.id if INSERTED or VERSIONED",
    )
    error_message: Optional[str] = Field(
        default=None,
        description="Error detail if outcome == FAILED",
    )
    conflict_fields: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Field-level discrepancies if outcome == CONFLICT",
    )

    model_config = ConfigDict(populate_by_name=True)


class BatchPersistenceResultDTO(BaseModel):
    """Aggregate outcome of persisting one bounded batch of normalized records."""

    batch_index: int = Field(description="0-based batch sequence index")
    total_rows: int = Field(description="Records in this batch (including skipped)")
    inserted_count: int = Field(default=0, description="New KnowledgeItems created")
    versioned_count: int = Field(default=0, description="Existing items with new version")
    unchanged_count: int = Field(default=0, description="Existing items whose data was unchanged, retained version")
    duplicate_count: int = Field(default=0, description="Compatible duplicates skipped")
    conflict_count: int = Field(default=0, description="Conflicting records skipped")
    invalid_count: int = Field(default=0, description="Phase 8.4 INVALID records skipped")
    failed_count: int = Field(default=0, description="Persistence failures (retryable or permanent)")
    records: List[RecordPersistenceResultDTO] = Field(
        default_factory=list,
        description="Per-record outcomes (populated only in diagnostic mode)",
    )

    @property
    def successful_count(self) -> int:
        """Records that produced durable canonical data (INSERTED + VERSIONED + UNCHANGED)."""
        return self.inserted_count + self.versioned_count + self.unchanged_count

    model_config = ConfigDict(populate_by_name=True)


class ImportPersistenceSummaryDTO(BaseModel):
    """Aggregate persistence metrics across the entire import job."""

    total_rows_attempted: int = Field(default=0, description="Total records processed by persistence layer")
    total_inserted: int = Field(default=0, description="New KnowledgeItems created")
    total_versioned: int = Field(default=0, description="Existing items updated with new version")
    total_unchanged: int = Field(default=0, description="Existing items whose data was unchanged, retained version")
    total_duplicates: int = Field(default=0, description="Compatible duplicates safely skipped")
    total_conflicts: int = Field(default=0, description="Conflicting records logged and skipped")
    total_invalid: int = Field(default=0, description="Phase 8.4 INVALID records not persisted")
    total_failed: int = Field(default=0, description="Records that failed persistence with error")
    batches_committed: int = Field(default=0, description="Fully committed batch transactions")
    batches_rolled_back: int = Field(default=0, description="Batch transactions that were rolled back")

    @property
    def total_successful(self) -> int:
        """Records producing durable canonical data."""
        return self.total_inserted + self.total_versioned + self.total_unchanged

    @property
    def total_skipped(self) -> int:
        """Records not written to DB (duplicates + conflicts + invalid)."""
        return self.total_duplicates + self.total_conflicts + self.total_invalid

    model_config = ConfigDict(populate_by_name=True)


class PersistenceBatchConfig(BaseModel):
    """Configurable parameters governing batch persistence behaviour."""

    batch_size: int = Field(
        default=500,
        ge=50,
        le=5000,
        description="Number of records per database transaction batch (50–5000)",
    )
    progress_update_interval_rows: int = Field(
        default=5000,
        ge=100,
        description="Persist import_job progress after every N rows processed",
    )
    skip_invalid_records: bool = Field(
        default=True,
        description="If True, INVALID records from Phase 8.4 are silently skipped; if False, they abort the batch",
    )
    skip_duplicate_records: bool = Field(
        default=True,
        description="If True, compatible exact duplicates are skipped without DB write",
    )
    skip_conflict_records: bool = Field(
        default=True,
        description="If True, conflicting duplicates are logged and skipped rather than aborting",
    )

    model_config = ConfigDict(populate_by_name=True)
