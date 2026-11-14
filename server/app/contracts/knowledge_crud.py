"""Phase 7.3 — Knowledge Base CRUD, Keyset Pagination, and Versioning Contracts.

Defines Pydantic V2 DTOs for:
- Knowledge item creation, update, and retrieval
- Frontend UI reconciliation (matching client/src/types/knowledge.types.ts)
- Keyset cursor pagination (zero OFFSET)
- Historical version inspection
"""

import base64
from datetime import datetime, timezone
import json
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.knowledge import KnowledgeLifecycleStatus


# =============================================================================
# Cursor Pagination Helpers
# =============================================================================


def encode_cursor(dt: datetime, item_id: str) -> str:
    """Encode an updated_at datetime and item id into a base64 opaque keyset cursor."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    raw = f"{dt.isoformat()}|{item_id}"
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("utf-8")


def decode_cursor(cursor: str) -> tuple[datetime, str]:
    """Decode a base64 keyset cursor into (updated_at, item_id)."""
    try:
        raw = base64.urlsafe_b64decode(cursor.encode("utf-8")).decode("utf-8")
        parts = raw.split("|", 1)
        if len(parts) != 2:
            raise ValueError("Malformed cursor parts.")
        dt = datetime.fromisoformat(parts[0])
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt, parts[1]
    except Exception as exc:
        raise ValueError(f"Invalid pagination cursor: {exc}")


# =============================================================================
# Request DTOs
# =============================================================================


class KnowledgeItemCreateDTO(BaseModel):
    """Payload to create a new knowledge item with initial version."""

    category: str = Field(..., description="Target category key (e.g. 'products-services', 'policies')")
    title: str = Field(..., min_length=1, max_length=512, description="Canonical title or entity name")
    type: Optional[str] = Field(default="Information", description="UI type: Service, Policy, Contact, Offer, FAQ, etc.")
    description: Optional[str] = Field(default=None, description="Summary or excerpt")
    content: Optional[str] = Field(default=None, description="Full narrative content text")
    status: Optional[str] = Field(
        default=KnowledgeLifecycleStatus.ACTIVE.value,
        description="active | draft | published",
    )
    source: Optional[str] = Field(default="manual", description="manual | website | document | imported | integration")
    source_id: Optional[str] = Field(default=None, description="Direct KnowledgeSource foreign key reference")
    authority_level: Optional[str] = Field(default=None, description="Truth arbitration authority level")
    tags: Optional[List[str]] = Field(default=None, description="List of string tags")
    canonical_data: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Structured canonical fields dictionary (price, sku, currency, etc.)",
    )
    custom_attributes: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Tenant-scoped custom attributes dictionary",
    )
    effective_from: Optional[datetime] = Field(
        default=None,
        description="UTC timestamp when version becomes effective",
    )
    effective_until: Optional[datetime] = Field(
        default=None,
        description="UTC timestamp when version expires (null = open-ended)",
    )

    # UI Convenience properties
    pricing: Optional[str] = None
    currency: Optional[str] = None
    warranty: Optional[str] = None
    serviceRegions: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    conditions: Optional[str] = None
    question: Optional[str] = None
    answer: Optional[str] = None
    discount: Optional[str] = None
    code: Optional[str] = None
    city: Optional[str] = None

    def validate_temporal_dates(self) -> None:
        if self.effective_from and self.effective_until:
            if self.effective_from >= self.effective_until:
                raise ValueError("effective_from must be strictly earlier than effective_until.")


class KnowledgeItemUpdateDTO(BaseModel):
    """Payload to update an existing knowledge item (creates a new immutable version)."""

    title: Optional[str] = Field(default=None, min_length=1, max_length=512)
    category: Optional[str] = None
    type: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    status: Optional[str] = None
    source_id: Optional[str] = Field(default=None, description="Direct KnowledgeSource foreign key reference")
    authority_level: Optional[str] = Field(default=None, description="Truth arbitration authority level")
    change_summary: Optional[str] = Field(
        default=None,
        max_length=512,
        description="Summary of changes for version history audit",
    )
    canonical_data: Optional[Dict[str, Any]] = None
    custom_attributes: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None
    source: Optional[str] = None
    effective_from: Optional[datetime] = Field(
        default=None,
        description="UTC timestamp when version becomes effective",
    )
    effective_until: Optional[datetime] = Field(
        default=None,
        description="UTC timestamp when version expires (null = open-ended)",
    )

    # UI Convenience properties
    pricing: Optional[str] = None
    currency: Optional[str] = None
    warranty: Optional[str] = None
    serviceRegions: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    conditions: Optional[str] = None
    question: Optional[str] = None
    answer: Optional[str] = None
    discount: Optional[str] = None
    code: Optional[str] = None
    city: Optional[str] = None

    def validate_temporal_dates(self) -> None:
        if self.effective_from and self.effective_until:
            if self.effective_from >= self.effective_until:
                raise ValueError("effective_from must be strictly earlier than effective_until.")


# =============================================================================
# Response DTOs
# =============================================================================


class KnowledgeItemResponseDTO(BaseModel):
    """Full knowledge item representation, fully reconciled with the frontend Knowledge UI."""

    id: str
    organizationId: str
    source_id: Optional[str] = None
    category: str
    type: str
    title: str
    excerpt: str
    content: Optional[str] = None
    status: str
    source: str
    version: int
    updatedAt: str
    updatedBy: str
    tags: Optional[List[str]] = None
    canonical_data: Dict[str, Any] = Field(default_factory=dict)
    custom_attributes: Dict[str, Any] = Field(default_factory=dict)
    effective_from: Optional[str] = None
    effective_until: Optional[str] = None
    temporal_status: Optional[str] = None

    # Flattened convenience fields for UI display
    pricing: Optional[str] = None
    currency: Optional[str] = None
    warranty: Optional[str] = None
    serviceRegions: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    conditions: Optional[str] = None
    question: Optional[str] = None
    answer: Optional[str] = None
    discount: Optional[str] = None
    code: Optional[str] = None
    city: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class KnowledgeCursorPageDTO(BaseModel):
    """Keyset or offset paginated response containing items and pagination metadata."""

    items: List[KnowledgeItemResponseDTO]
    next_cursor: Optional[str] = None
    has_more: bool
    total_count: Optional[int] = None
    page: Optional[int] = None
    page_size: Optional[int] = None
    total_pages: Optional[int] = None


class KnowledgeVersionHistoryDTO(BaseModel):
    """Snapshot of an immutable historical KnowledgeVersion."""

    id: str
    knowledge_item_id: str
    version_number: int
    status: str
    change_summary: Optional[str] = None
    authority_level: str
    content_text: Optional[str] = None
    created_at: str
    published_at: Optional[str] = None
    archived_at: Optional[str] = None
    created_by_user_id: Optional[str] = None
    effective_from: Optional[str] = None
    effective_until: Optional[str] = None
    temporal_status: Optional[str] = None
    canonical_data: Dict[str, Any] = Field(default_factory=dict)
    custom_attributes: Dict[str, Any] = Field(default_factory=dict)
    diff: Optional[Dict[str, Any]] = None
