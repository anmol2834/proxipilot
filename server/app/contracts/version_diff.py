"""Phase 9.1 & 9.3: Version Diff & Lifecycle Action Contracts.

Defines Pydantic V2 DTOs for:
- Field-level deterministic version diffs
- Publish version request
- Rollback version request
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class FieldDiffDTO(BaseModel):
    """Field-level difference between two versions of a knowledge item."""

    field: str = Field(description="Name of the field that changed")
    field_type: str = Field(description="header | content | canonical | custom | temporal")
    old_value: Optional[Any] = Field(default=None, description="Previous value")
    new_value: Optional[Any] = Field(default=None, description="New value")


class VersionDiffDTO(BaseModel):
    """Structured report comparing two versions of a knowledge item."""

    knowledge_item_id: str
    from_version: Optional[int] = Field(default=None, description="Baseline version number (None if initial version)")
    to_version: int = Field(description="Comparison version number")
    changed_fields: List[str] = Field(default_factory=list, description="List of changed field keys")
    diffs: List[FieldDiffDTO] = Field(default_factory=list, description="Itemized field diffs")
    is_no_op: bool = Field(default=False, description="True if no field changes occurred")
    generated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="ISO 8601 UTC timestamp of diff generation",
    )


class PublishVersionRequestDTO(BaseModel):
    """Payload to publish a draft or validated version."""

    version_number: Optional[int] = Field(
        default=None,
        description="Specific version number to publish (defaults to latest draft/validated version)",
        ge=1,
    )


class RollbackRequestDTO(BaseModel):
    """Payload to rollback a knowledge item to a historical version."""

    target_version_number: int = Field(
        ...,
        description="Target historical version number to restore",
        ge=1,
    )
    reason: Optional[str] = Field(
        default=None,
        max_length=512,
        description="Audit reason for the rollback",
    )
