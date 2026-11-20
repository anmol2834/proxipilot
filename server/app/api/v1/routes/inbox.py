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
from sqlalchemy import and_, func, select, text, tuple_, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext, get_tenant_context
from app.core.database import get_db
from app.core.logging import logger
from app.models.inbox import EmailMessage, EmailThread, LeadIntent, ThreadStatus
from app.models.integration import ConnectedIntegrationAccount

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
    # True when the message was sent from the connected mailbox (our reply), so the UI can tell
    # the customer's messages apart from the business's own without guessing from names.
    from_me: bool = False
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
    """One page of a thread, in chronological order (oldest first within the page).

    The first page (no ``before``) holds the NEWEST messages; ``previous_cursor`` fetches the
    page of messages just older than this one, so the client can load history while the user
    scrolls up. ``total_count`` and ``mailbox`` are only computed for the first page.
    """

    items: List[MessageDTO]
    previous_cursor: Optional[str] = None
    has_more: bool
    total_returned: int
    total_count: Optional[int] = None
    mailbox: Optional[SenderDTO] = None


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


def _message_to_dto(msg: EmailMessage, mailbox: Optional[SenderDTO] = None) -> MessageDTO:
    """Map EmailMessage ORM object to MessageDTO.

    ``mailbox`` is the connected account the thread belongs to: messages sent from it are marked
    ``from_me`` and, when the provider gave no display name, carry the mailbox's name.
    """
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

    from_email = msg.from_email or ""
    from_me = msg.direction == "outbound" or bool(
        mailbox and mailbox.email and from_email.lower() == mailbox.email.lower()
    )
    name = msg.from_name or (mailbox.name if from_me and mailbox else None)

    return MessageDTO(
        id=msg.id,
        sender=SenderDTO(name=name, email=from_email),
        to_emails=to_emails,
        cc_emails=cc_emails,
        sent_at=msg.sent_at,
        body_text=msg.body_text,
        direction=msg.direction,
        from_me=from_me,
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
    await _overlay_memory_summaries(db, org_id, items)

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


async def _overlay_memory_summaries(db: AsyncSession, org_id: str, items: List[ThreadDTO]) -> None:
    """Replace the rule-based thread summary with the real AI conversation memory (model-written
    rolling summary + key facts) wherever one exists. One batched query for the whole page."""
    if not items:
        return
    rows = (await db.execute(text(
        "SELECT thread_id, summary, key_facts FROM thread_memories "
        "WHERE tenant_id = :t AND thread_id = ANY(:ids) AND coalesce(summary, '') <> ''"),
        {"t": org_id, "ids": [i.id for i in items]})).mappings().all()
    by_thread = {r["thread_id"]: r for r in rows}
    for item in items:
        mem = by_thread.get(item.id)
        if not mem:
            continue
        try:
            facts = json.loads(mem["key_facts"]) if mem["key_facts"] else []
        except (ValueError, TypeError):
            facts = []
        item.ai_summary = AISummaryDTO(
            intent=mem["summary"].strip(),
            bullet_points=[str(f) for f in (facts or []) if str(f).strip()][:6],
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

    dto = _thread_to_dto(thread)
    await _overlay_memory_summaries(db, org_id, [dto])
    return dto


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
    """One page of a thread's messages, newest page first, each page in chronological order.

    Keyset pagination on (message time, id), walking BACKWARDS in time:
      * no ``before``  -> the newest ``limit`` messages (what the reader sees on open);
      * ``before=<previous_cursor>`` -> the ``limit`` messages just older than that page.
    The client prepends each older page while the user scrolls up, so opening a long thread
    costs one small query instead of loading the whole history.

    Message time is ``COALESCE(sent_at, created_at)`` so a message without a Date header can
    neither break the ordering nor be skipped by the cursor (a NULL row comparison is never true).
    """
    org_id = context.organization_id

    # Verify the thread belongs to the caller's org and learn which mailbox it lives in
    # (one query: needed to label our own replies as "from me").
    thread_res = await db.execute(
        select(
            EmailThread.id,
            ConnectedIntegrationAccount.email_address,
            ConnectedIntegrationAccount.display_name,
        )
        .outerjoin(
            ConnectedIntegrationAccount,
            and_(
                ConnectedIntegrationAccount.id == EmailThread.integration_account_id,
                ConnectedIntegrationAccount.tenant_id == org_id,
            ),
        )
        .where(EmailThread.id == thread_id, EmailThread.tenant_id == org_id)
    )
    thread_row = thread_res.first()
    if not thread_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thread not found",
        )
    mailbox = (
        SenderDTO(name=thread_row.display_name or None, email=thread_row.email_address)
        if thread_row.email_address
        else None
    )

    msg_time = func.coalesce(EmailMessage.sent_at, EmailMessage.created_at)
    filters: List[Any] = [
        EmailMessage.tenant_id == org_id,
        EmailMessage.thread_id == thread_id,
    ]

    if before:
        before_ts, before_id = _decode_message_cursor(before)
        if before_ts is None or not before_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid pagination cursor",
            )
        filters.append(tuple_(msg_time, EmailMessage.id) < tuple_(before_ts, before_id))

    stmt = (
        select(EmailMessage)
        .where(and_(*filters))
        .order_by(msg_time.desc(), EmailMessage.id.desc())
        .limit(limit + 1)  # one extra row tells us whether an older page exists
    )
    rows = list((await db.execute(stmt)).scalars().all())

    has_more = len(rows) > limit
    rows = rows[:limit]
    rows.reverse()  # chronological within the page (oldest at the top, newest at the bottom)

    previous_cursor = None
    if has_more and rows:
        oldest = rows[0]
        previous_cursor = _encode_message_cursor(oldest.sent_at or oldest.created_at, oldest.id)

    total_count = None
    if not before:
        total_count = (
            await db.execute(
                select(func.count())
                .select_from(EmailMessage)
                .where(EmailMessage.tenant_id == org_id, EmailMessage.thread_id == thread_id)
            )
        ).scalar_one()

    items = [_message_to_dto(m, mailbox) for m in rows]

    return PaginatedMessagesResponse(
        items=items,
        previous_cursor=previous_cursor,
        has_more=has_more,
        total_returned=len(items),
        total_count=total_count,
        mailbox=mailbox,
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

    # A user's label is a manual override that survives later AI #2 output until released (null =
    # "use automatic classification"). It never schedules or authorizes customer email.
    from app.services.followups import engine as followup_engine

    manual = (body.lead_temperature or "").lower() or None
    control = await followup_engine.get_or_create_control(db, org_id, thread_id)
    control.manual_temperature = manual
    control.manual_temperature_by = context.user_id if manual else None
    control.manual_temperature_at = now if manual else None
    control.version = (control.version or 0) + 1
    state = await followup_engine.lock_state(db, org_id, thread_id)
    if manual:
        state.effective_temperature, state.temperature_source = manual, "manual"
    else:
        state.effective_temperature = state.suggested_temperature
        state.temperature_source = "ai" if state.suggested_temperature else None
        if state.suggested_temperature:
            await db.execute(update(EmailThread).where(EmailThread.id == thread_id, EmailThread.tenant_id == org_id)
                             .values({EmailThread.lead_intent: state.suggested_temperature}))

    await db.commit()
    return {"id": thread_id, "lead_temperature": manual or state.effective_temperature,
            "temperature_source": state.temperature_source}


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
