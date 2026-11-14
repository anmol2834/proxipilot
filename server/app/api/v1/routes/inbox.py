"""Inbox API — Clean Email Thread & Message Read Model.

Endpoints:
  GET  /api/v1/inbox/threads              — Paginated thread list (keyset cursor)
  GET  /api/v1/inbox/threads/{thread_id}  — Single thread detail
  GET  /api/v1/inbox/threads/{thread_id}/messages — Paginated messages (keyset cursor)
  PATCH /api/v1/inbox/threads/{thread_id}/star    — Toggle star
  PATCH /api/v1/inbox/threads/{thread_id}/read    — Mark as read
  PATCH /api/v1/inbox/threads/{thread_id}/lead-temperature — Set lead intent
  DELETE /api/v1/inbox/threads/{thread_id}        — Archive/delete

All endpoints:
- Require authenticated session (JWT cookie).
- Are strictly scoped to the authenticated user's organization (tenant_id).
- Use keyset pagination (no OFFSET) for correct behavior under live ingestion.
- Return clean DTOs — no raw MIME, no provider IDs, no HTML.
"""

from __future__ import annotations

import base64
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext, get_tenant_context
from app.core.database import get_db
from app.core.logging import logger
from app.models.inbox import EmailMessage, EmailThread, LeadIntent, ThreadStatus

router = APIRouter(prefix="/inbox", tags=["Inbox"])


# =============================================================================
# Response DTOs — clean, provider-neutral, no raw fields exposed
# =============================================================================


class SenderDTO(BaseModel):
    name: Optional[str] = None
    email: str


class AISummaryDTO(BaseModel):
    intent: Optional[str] = None
    bullet_points: List[str] = Field(default_factory=list)
    confidence: Optional[float] = None


class ThreadDTO(BaseModel):
    id: str
    subject: Optional[str] = None
    sender: SenderDTO
    snippet: Optional[str] = None
    latest_message_at: Optional[datetime] = None
    message_count: int
    unread_count: int
    is_unread: bool
    is_starred: bool
    lead_temperature: Optional[str] = None
    status: str
    ai_summary: Optional[AISummaryDTO] = None
    integration_account_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MessageDTO(BaseModel):
    id: str
    sender: SenderDTO
    to_emails: List[str] = Field(default_factory=list)
    cc_emails: List[str] = Field(default_factory=list)
    sent_at: Optional[datetime] = None
    body_text: Optional[str] = None
    direction: str
    integration_account_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class PaginatedThreadsResponse(BaseModel):
    items: List[ThreadDTO]
    next_cursor: Optional[str] = None
    has_more: bool
    total_returned: int


class PaginatedMessagesResponse(BaseModel):
    items: List[MessageDTO]
    previous_cursor: Optional[str] = None
    has_more: bool
    total_returned: int


# =============================================================================
# Cursor helpers
# =============================================================================


def _encode_thread_cursor(latest_message_at: Optional[datetime], thread_id: str) -> str:
    """Encode opaque keyset cursor for thread list pagination."""
    payload = {
        "t": latest_message_at.isoformat() if latest_message_at else None,
        "id": thread_id,
    }
    return base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()


def _decode_thread_cursor(cursor: str) -> tuple[Optional[datetime], str]:
    """Decode thread list cursor. Returns (latest_message_at, thread_id)."""
    try:
        payload = json.loads(base64.urlsafe_b64decode(cursor + "==").decode())
        ts_str = payload.get("t")
        ts = datetime.fromisoformat(ts_str) if ts_str else None
        return ts, payload.get("id", "")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid pagination cursor",
        )


def _encode_message_cursor(sent_at: Optional[datetime], message_id: str) -> str:
    """Encode opaque keyset cursor for message pagination."""
    payload = {
        "s": sent_at.isoformat() if sent_at else None,
        "id": message_id,
    }
    return base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()


def _decode_message_cursor(cursor: str) -> tuple[Optional[datetime], str]:
    """Decode message cursor. Returns (sent_at, message_id)."""
    try:
        payload = json.loads(base64.urlsafe_b64decode(cursor + "==").decode())
        ts_str = payload.get("s")
        ts = datetime.fromisoformat(ts_str) if ts_str else None
        return ts, payload.get("id", "")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid pagination cursor",
        )


# =============================================================================
# Mapping helpers
# =============================================================================


def _thread_to_dto(thread: EmailThread) -> ThreadDTO:
    """Map EmailThread ORM object to ThreadDTO."""
    ai_summary = None
    if thread.ai_summary:
        try:
            raw_summary = json.loads(thread.ai_summary)
            ai_summary = AISummaryDTO(
                intent=raw_summary.get("intent"),
                bullet_points=raw_summary.get("bulletPoints", []),
                confidence=raw_summary.get("confidence"),
            )
        except Exception:
            ai_summary = AISummaryDTO(intent=thread.ai_summary)

    return ThreadDTO(
        id=thread.id,
        subject=thread.subject,
        sender=SenderDTO(name=thread.sender_name, email=thread.sender_email or ""),
        snippet=thread.snippet,
        latest_message_at=thread.latest_message_at,
        message_count=thread.message_count,
        unread_count=thread.unread_count,
        is_unread=not thread.is_read,
        is_starred=thread.is_starred,
        lead_temperature=thread.lead_intent,
        status=thread.status,
        ai_summary=ai_summary,
        integration_account_id=thread.integration_account_id,
        created_at=thread.created_at,
        updated_at=thread.updated_at,
    )


def _message_to_dto(msg: EmailMessage) -> MessageDTO:
    """Map EmailMessage ORM object to MessageDTO."""
    to_emails: List[str] = []
    cc_emails: List[str] = []
    try:
        if msg.to_emails:
            to_emails = json.loads(msg.to_emails)
    except Exception:
        pass
    try:
        if msg.cc_emails:
            cc_emails = json.loads(msg.cc_emails)
    except Exception:
        pass

    return MessageDTO(
        id=msg.id,
        sender=SenderDTO(name=msg.from_name, email=msg.from_email),
        to_emails=to_emails,
        cc_emails=cc_emails,
        sent_at=msg.sent_at,
        body_text=msg.body_text,
        direction=msg.direction,
        integration_account_id=msg.integration_account_id,
        created_at=msg.created_at,
    )


# =============================================================================
# Thread List
# =============================================================================


@router.get("/threads", response_model=PaginatedThreadsResponse)
@router.get("/conversations", response_model=PaginatedThreadsResponse)
async def list_threads(
    limit: int = Query(default=30, ge=1, le=100),
    cursor: Optional[str] = Query(default=None),
    integration_account_id: Optional[str] = Query(default=None),
    lead_temperature: Optional[str] = Query(default=None),
    starred: Optional[bool] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context),
) -> PaginatedThreadsResponse:
    """List email threads for the authenticated organization.

    Returns newest-first with keyset cursor pagination.
    Strict tenant isolation: only returns threads for the caller's organization.
    """
    org_id = context.organization_id

    # Build base filters
    filters: List[Any] = [EmailThread.tenant_id == org_id]

    if integration_account_id:
        filters.append(EmailThread.integration_account_id == integration_account_id)
    if lead_temperature:
        filters.append(EmailThread.lead_intent == lead_temperature)
    if starred is not None:
        filters.append(EmailThread.is_starred == starred)

    # Apply cursor if provided (keyset: WHERE (latest_message_at, id) < (cursor_ts, cursor_id))
    if cursor:
        cursor_ts, cursor_id = _decode_thread_cursor(cursor)
        if cursor_ts:
            filters.append(
                text(
                    "(email_threads.latest_message_at, email_threads.id) < (:cursor_ts, :cursor_id)"
                ).bindparams(cursor_ts=cursor_ts, cursor_id=cursor_id)
            )

    stmt = (
        select(EmailThread)
        .where(and_(*filters))
        .order_by(EmailThread.latest_message_at.desc(), EmailThread.id.desc())
        .limit(limit + 1)  # Fetch one extra to determine has_more
    )

    result = await db.execute(stmt)
    rows = list(result.scalars().all())

    has_more = len(rows) > limit
    if has_more:
        rows = rows[:limit]

    next_cursor = None
    if has_more and rows:
        last = rows[-1]
        next_cursor = _encode_thread_cursor(last.latest_message_at, last.id)

    items = [_thread_to_dto(t) for t in rows]

    logger.info(
        "Inbox thread list",
        org_id=org_id,
        count=len(items),
        has_more=has_more,
    )

    return PaginatedThreadsResponse(
        items=items,
        next_cursor=next_cursor,
        has_more=has_more,
        total_returned=len(items),
    )


# =============================================================================
# Thread Detail
# =============================================================================


@router.get("/threads/{thread_id}", response_model=ThreadDTO)
@router.get("/conversations/{thread_id}", response_model=ThreadDTO)
async def get_thread(
    thread_id: str,
    db: AsyncSession = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context),
) -> ThreadDTO:
    """Get a single email thread by ID."""
    org_id = context.organization_id

    stmt = select(EmailThread).where(
        EmailThread.id == thread_id,
        EmailThread.tenant_id == org_id,
    )
    result = await db.execute(stmt)
    thread = result.scalar_one_or_none()

    if not thread:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thread not found",
        )

    return _thread_to_dto(thread)


# =============================================================================
# Messages for Thread
# =============================================================================


@router.get("/threads/{thread_id}/messages", response_model=PaginatedMessagesResponse)
@router.get("/conversations/{thread_id}/messages", response_model=PaginatedMessagesResponse)
async def list_thread_messages(
    thread_id: str,
    limit: int = Query(default=30, ge=1, le=100),
    before: Optional[str] = Query(default=None, description="Cursor for reverse pagination (older messages)"),
    db: AsyncSession = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context),
) -> PaginatedMessagesResponse:
    """List messages in a thread, ordered chronologically (oldest first).

    Uses keyset cursor on (sent_at, id) for stable pagination.
    The `before` cursor enables prepending older messages on upward scroll.
    """
    org_id = context.organization_id

    # Verify thread belongs to org
    thread_stmt = select(EmailThread.id).where(
        EmailThread.id == thread_id,
        EmailThread.tenant_id == org_id,
    )
    thread_res = await db.execute(thread_stmt)
    if not thread_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thread not found",
        )

    filters: List[Any] = [
        EmailMessage.tenant_id == org_id,
        EmailMessage.thread_id == thread_id,
    ]

    if before:
        before_ts, before_id = _decode_message_cursor(before)
        if before_ts:
            filters.append(
                text(
                    "(email_messages.sent_at, email_messages.id) < (:before_ts, :before_id)"
                ).bindparams(before_ts=before_ts, before_id=before_id)
            )

    stmt = (
        select(EmailMessage)
        .where(and_(*filters))
        .order_by(EmailMessage.sent_at.asc(), EmailMessage.id.asc())
        .limit(limit + 1)
    )

    result = await db.execute(stmt)
    rows = list(result.scalars().all())

    has_more = len(rows) > limit
    if has_more:
        rows = rows[:limit]

    previous_cursor = None
    if has_more and rows:
        first = rows[0]
        previous_cursor = _encode_message_cursor(first.sent_at, first.id)

    items = [_message_to_dto(m) for m in rows]

    return PaginatedMessagesResponse(
        items=items,
        previous_cursor=previous_cursor,
        has_more=has_more,
        total_returned=len(items),
    )


# =============================================================================
# Mutations
# =============================================================================


class StarRequest(BaseModel):
    starred: bool


class ReadRequest(BaseModel):
    is_read: bool = True


class LeadTemperatureRequest(BaseModel):
    lead_temperature: Optional[str] = Field(
        None,
        description="hot | warm | cold | null to clear",
    )


@router.patch("/threads/{thread_id}/star", status_code=status.HTTP_200_OK)
@router.patch("/conversations/{thread_id}/star", status_code=status.HTTP_200_OK)
async def toggle_star(
    thread_id: str,
    body: StarRequest,
    db: AsyncSession = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    """Star or unstar a thread."""
    org_id = context.organization_id
    now = datetime.now(timezone.utc)

    stmt = (
        update(EmailThread)
        .where(EmailThread.id == thread_id, EmailThread.tenant_id == org_id)
        .values({EmailThread.is_starred: body.starred, EmailThread.updated_at: now})
        .returning(EmailThread.id)
    )
    result = await db.execute(stmt)
    updated = result.scalar_one_or_none()
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    await db.commit()
    return {"id": thread_id, "starred": body.starred}


@router.patch("/threads/{thread_id}/read", status_code=status.HTTP_200_OK)
@router.patch("/conversations/{thread_id}/read", status_code=status.HTTP_200_OK)
async def mark_read(
    thread_id: str,
    body: ReadRequest = ReadRequest(),
    db: AsyncSession = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    """Mark a thread as read (default) or unread."""
    org_id = context.organization_id
    now = datetime.now(timezone.utc)

    unread_count_expr = 0 if body.is_read else EmailThread.unread_count

    stmt = (
        update(EmailThread)
        .where(EmailThread.id == thread_id, EmailThread.tenant_id == org_id)
        .values({
            EmailThread.is_read: body.is_read,
            EmailThread.unread_count: unread_count_expr,
            EmailThread.updated_at: now,
        })
        .returning(EmailThread.id)
    )
    result = await db.execute(stmt)
    updated = result.scalar_one_or_none()
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    await db.commit()
    return {"id": thread_id, "is_read": body.is_read}


@router.patch("/threads/{thread_id}/lead-temperature", status_code=status.HTTP_200_OK)
@router.patch("/conversations/{thread_id}/lead-temperature", status_code=status.HTTP_200_OK)
async def set_lead_temperature(
    thread_id: str,
    body: LeadTemperatureRequest,
    db: AsyncSession = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    """Set or clear the lead temperature classification for a thread."""
    org_id = context.organization_id

    # Validate lead_temperature value
    valid = {None, "hot", "warm", "cold", LeadIntent.HOT.value, LeadIntent.WARM.value, LeadIntent.COLD.value}
    if body.lead_temperature not in valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid lead_temperature. Must be one of: hot, warm, cold, null",
        )

    now = datetime.now(timezone.utc)
    stmt = (
        update(EmailThread)
        .where(EmailThread.id == thread_id, EmailThread.tenant_id == org_id)
        .values({
            EmailThread.lead_intent: body.lead_temperature,
            EmailThread.updated_at: now,
        })
        .returning(EmailThread.id)
    )
    result = await db.execute(stmt)
    updated = result.scalar_one_or_none()
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    await db.commit()
    return {"id": thread_id, "lead_temperature": body.lead_temperature}


@router.delete("/threads/{thread_id}", status_code=status.HTTP_200_OK)
@router.delete("/conversations/{thread_id}", status_code=status.HTTP_200_OK)
async def delete_thread(
    thread_id: str,
    db: AsyncSession = Depends(get_db),
    context: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    """Archive/delete a thread (soft delete via status=ARCHIVED)."""
    org_id = context.organization_id
    now = datetime.now(timezone.utc)

    stmt = (
        update(EmailThread)
        .where(EmailThread.id == thread_id, EmailThread.tenant_id == org_id)
        .values({
            EmailThread.status: ThreadStatus.ARCHIVED.value,
            EmailThread.updated_at: now,
        })
        .returning(EmailThread.id)
    )
    result = await db.execute(stmt)
    updated = result.scalar_one_or_none()
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    await db.commit()
    logger.info("Thread archived", thread_id=thread_id, org_id=org_id)
    return {"id": thread_id, "status": ThreadStatus.ARCHIVED.value}
