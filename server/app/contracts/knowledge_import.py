"""Phase 8.0 — Knowledge Import Architecture and Job Lifecycle Contracts.

Defines Pydantic V2 DTOs for:
- Asynchronous import job creation and cancellation
- Centralized stage and status reporting
- Zero-OFFSET keyset cursor pagination
- Compact queue event envelopes for Redis Streams
"""

from datetime import datetime, timezone
import json
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.knowledge import ImportJobStage, ImportJobStatus


# =============================================================================
# Request DTOs
# =============================================================================


class ImportJobCreateDTO(BaseModel):
    """Payload to initiate an asynchronous knowledge import job."""

    dataset_name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Logical name of the dataset (e.g. 'Master Price List 2026')",
    )
    file_type: str = Field(
        default="csv",
        description="Source file format: csv, xlsx, json",
    )
    source_id: Optional[str] = Field(
        default=None,
        description="Existing KnowledgeSource foreign key. If omitted, a source will be auto-created.",
    )
    file_uri: Optional[str] = Field(
        default=None,
        description="Storage reference URI or path where raw uploaded file is staged (never raw bytes).",
    )
    file_size_bytes: Optional[int] = Field(
        default=None,
        ge=0,
        description="Size in bytes of the staged upload file.",
    )
    idempotency_key: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Unique client idempotency token preventing duplicate job submissions.",
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Non-sensitive operational metadata (delimiter, encoding, header row index, etc.).",
    )

    model_config = ConfigDict(populate_by_name=True)


class ImportJobCancelDTO(BaseModel):
    """Payload to request cooperative job cancellation."""

    reason: Optional[str] = Field(
        default="Cancelled by user",
        max_length=512,
        description="Audit reason for requesting cancellation.",
    )


# =============================================================================
# Response DTOs
# =============================================================================


class ImportJobResponseDTO(BaseModel):
    """Safe, sanitized representation of an asynchronous import job."""

    id: str
    organization_id: str
    source_id: str
    dataset_name: str
    file_type: str
    file_size_bytes: Optional[int] = None
    file_uri: Optional[str] = None
    idempotency_key: Optional[str] = None

    # Lifecycle & Stage
    status: str
    current_stage: str

    # Progress & Metrics
    row_count: Optional[int] = None
    processed_rows: int = 0
    failed_rows: int = 0
    progress_percent: float = 0.00

    # Coordination & Heartbeat
    worker_id: Optional[str] = None
    last_heartbeat_at: Optional[datetime] = None
    retry_count: int = 0
    max_retries: int = 3

    # Timestamps
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    cancel_requested_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    # Error & Metadata
    error_summary: Optional[str] = None
    error_details: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None
    created_by_user_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ImportJobCursorPageDTO(BaseModel):
    """Zero-OFFSET keyset pagination response for import jobs."""

    items: List[ImportJobResponseDTO]
    next_cursor: Optional[str] = None
    has_more: bool = False


class FileUploadResponseDTO(BaseModel):
    """Response returned upon successful secure file upload and staging (Phase 8.1)."""

    upload_id: str = Field(description="Unique immutable upload identifier")
    source_id: str = Field(description="Associated KnowledgeSource identifier")
    job_id: str = Field(description="Associated ImportJob identifier")
    dataset_name: str = Field(description="Dataset name assigned to import")
    file_name: str = Field(description="Sanitized file name")
    file_type: str = Field(description="Validated file format: csv, xls, xlsx")
    file_size_bytes: int = Field(description="Total file size in bytes")
    checksum: str = Field(description="Cryptographic checksum (SHA-256)")
    checksum_algorithm: str = Field(default="sha256", description="Algorithm used to compute checksum")
    status: str = Field(default="uploaded", description="Current status of upload: uploaded or duplicate")
    is_duplicate: bool = Field(default=False, description="True if identical file was previously uploaded by this tenant")
    created_at: datetime = Field(description="Timestamp when upload was received and staged")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# =============================================================================
# Event Payload DTOs
# =============================================================================


class KnowledgeImportEventPayload(BaseModel):
    """Compact domain event payload published to Redis Streams.

    Strictly excludes raw file contents, CSV strings, or secrets.
    """

    job_id: str
    organization_id: str
    source_id: str
    dataset_name: str
    file_type: str
    idempotency_key: Optional[str] = None
    correlation_id: Optional[str] = None
