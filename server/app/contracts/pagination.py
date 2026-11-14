"""Cursor-Based Pagination Contracts.

Shared across all list endpoints in the ProxiPilot API.

Design decisions:
- Cursor pagination is used for all list endpoints (not page/offset).
  Rationale: Offset pagination is inconsistent with live data insertion (rows shift).
- The cursor is an opaque base64-encoded string encoding sort key + id.
  Callers MUST NOT parse or construct cursors manually.
- next_cursor is None when no further results exist (do NOT check has_more alone).
- total_hint is an approximate count for UI display only (NOT guaranteed exact).
  It uses PostgreSQL estimate from pg_stat_user_tables, not COUNT(*).
"""

from typing import Generic, List, Optional, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")


class CursorPaginationParams(BaseModel):
    """Standard cursor pagination request parameters.

    Applied uniformly to all list endpoints via FastAPI dependency injection.
    """

    cursor: Optional[str] = Field(
        default=None,
        description=(
            "Opaque pagination cursor from a previous response's next_cursor field. "
            "Pass None (omit) to start from the beginning."
        ),
    )
    limit: int = Field(
        default=25,
        ge=1,
        le=100,
        description="Number of items to return per page. Max: 100.",
    )
    direction: str = Field(
        default="forward",
        pattern="^(forward|backward)$",
        description="Pagination direction. 'forward' = next page. 'backward' = previous page.",
    )


class CursorPaginatedResponse(BaseModel, Generic[T]):
    """Generic cursor-paginated list response.

    Usage:
        @router.get("/threads", response_model=CursorPaginatedResponse[ThreadSummary])
        async def list_threads(...) -> CursorPaginatedResponse[ThreadSummary]:
            ...
    """

    items: List[T] = Field(description="Page of result items.")
    next_cursor: Optional[str] = Field(
        default=None,
        description=(
            "Cursor to retrieve the next page. "
            "Pass as 'cursor' parameter in the next request. "
            "None when no further pages exist."
        ),
    )
    prev_cursor: Optional[str] = Field(
        default=None,
        description=(
            "Cursor to retrieve the previous page. "
            "None when at the beginning of the result set."
        ),
    )
    has_more: bool = Field(
        description="True if additional pages exist beyond next_cursor."
    )
    total_hint: Optional[int] = Field(
        default=None,
        description=(
            "Approximate total count for UI display. "
            "NOT guaranteed exact. Computed from PostgreSQL table statistics."
        ),
    )
    page_size: int = Field(description="Number of items in the current page (may be less than limit).")


class ReverseCursorParams(BaseModel):
    """Reverse cursor pagination for loading latest-first (e.g. thread messages).

    Used for message thread views where newest messages load first and
    older messages are loaded as the user scrolls up.
    """

    before: Optional[str] = Field(
        default=None,
        description=(
            "Load messages sent BEFORE this cursor (scroll up to load older). "
            "None = load from the most recent message."
        ),
    )
    limit: int = Field(
        default=30,
        ge=1,
        le=100,
        description="Number of messages to load per batch. Max: 100.",
    )
