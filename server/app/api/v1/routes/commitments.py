"""Decision & Commitment Memory API (Memory 6).

GET    /commitments                    list / filter (status, kind, owed_by, thread, contact, overdue, due soon)
GET    /commitments/summary            open / overdue / due-soon counts for dashboards
POST   /commitments                    record a decision, promise or action item by hand
PATCH  /commitments/{id}               edit, fulfil, cancel or reopen (superseded items are history)
POST   /commitments/extract            (re)run extraction for one email message

Permissions: read = ``inbox.read``; changes = ``inbox.reply``. Every change is audited.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext, require_permission
from app.core.database import get_db
from app.models.audit import AuditAction
from app.models.commitment import Commitment, CommitmentStatus
from app.models.organization import User
from app.services.audit import audit_service
from app.services.commitment_memory import commitment_memory_service, statement_key
from app.services.contact_memory import normalize_email

router = APIRouter(prefix="/commitments", tags=["Decision & Commitment Memory"])

Kind = Literal["commitment", "decision", "action_item"]
Party = Literal["company", "customer", "internal"]
Category = Literal["quote", "pricing", "discount", "delivery", "document", "callback", "meeting", "payment",
                   "order", "support", "policy", "other"]


def _aware(v: Optional[datetime]) -> Optional[datetime]:
    if v is not None and v.tzinfo is None:
        raise ValueError("due_at must include a timezone offset, e.g. 2026-11-14T18:00:00+05:30")
    return v


class CommitmentCreateDTO(BaseModel):
    kind: Kind
    owed_by: Party
    category: Category = "other"
    statement: str = Field(min_length=8, max_length=300)
    thread_id: Optional[str] = Field(default=None, max_length=64)
    counterparty_email: Optional[str] = Field(default=None, max_length=320)
    owner_email: Optional[str] = Field(default=None, max_length=320)
    approved_by: Optional[str] = Field(default=None, max_length=255)
    due_at: Optional[datetime] = None

    @field_validator("due_at")
    @classmethod
    def _due_has_tz(cls, v: Optional[datetime]) -> Optional[datetime]:
        return _aware(v)


class CommitmentUpdateDTO(BaseModel):
    statement: Optional[str] = Field(default=None, min_length=8, max_length=300)
    category: Optional[Category] = None
    owner_email: Optional[str] = Field(default=None, max_length=320)
    approved_by: Optional[str] = Field(default=None, max_length=255)
    due_at: Optional[datetime] = None
    status: Optional[Literal["open", "fulfilled", "cancelled"]] = None
    resolution_note: Optional[str] = Field(default=None, max_length=1000)

    @field_validator("due_at")
    @classmethod
    def _due_has_tz(cls, v: Optional[datetime]) -> Optional[datetime]:
        return _aware(v)


class ExtractDTO(BaseModel):
    message_id: str = Field(min_length=1, max_length=64)


def _dto(c: Commitment, now: datetime) -> Dict[str, Any]:
    return {
        "id": c.id, "kind": c.kind, "owed_by": c.owed_by, "category": c.category, "statement": c.statement,
        "thread_id": c.thread_id, "counterparty_email": c.counterparty_email, "owner_email": c.owner_email,
        "owner_user_id": c.owner_user_id, "approved_by": c.approved_by,
        "due_at": c.due_at.isoformat() if c.due_at else None, "due_text": c.due_text,
        "is_overdue": bool(c.status == "open" and c.due_at and c.due_at < now),
        "status": c.status, "confidence": c.confidence, "source_type": c.source_type,
        "source_message_id": c.source_message_id,
        "resolved_at": c.resolved_at.isoformat() if c.resolved_at else None, "resolved_by": c.resolved_by,
        "resolution_note": c.resolution_note, "superseded_by_id": c.superseded_by_id,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


async def _actor_email(db: AsyncSession, user_id: str) -> str:
    email = (await db.execute(select(User.email).where(User.id == user_id))).scalar_one_or_none()
    return (email or f"user:{user_id}").lower()


async def _get(db: AsyncSession, tenant_id: str, cid: str) -> Commitment:
    c = (await db.execute(select(Commitment).where(Commitment.id == cid, Commitment.tenant_id == tenant_id))
         ).scalar_one_or_none()
    if c is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commitment not found for this organization.")
    return c


@router.get("", summary="List decisions, commitments and action items")
async def list_commitments(
    status_filter: str = Query(default="open", alias="status", max_length=16),
    kind: Optional[Kind] = None,
    owed_by: Optional[Party] = None,
    thread_id: Optional[str] = Query(default=None, max_length=64),
    counterparty_email: Optional[str] = Query(default=None, max_length=320),
    owner_email: Optional[str] = Query(default=None, max_length=320),
    overdue: Optional[bool] = None,
    due_within_hours: Optional[int] = Query(default=None, ge=1, le=24 * 90),
    q: Optional[str] = Query(default=None, max_length=200),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.read")),
) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    conds = [Commitment.tenant_id == ctx.organization_id]
    if status_filter != "all":
        conds.append(Commitment.status == status_filter)
    if kind:
        conds.append(Commitment.kind == kind)
    if owed_by:
        conds.append(Commitment.owed_by == owed_by)
    if thread_id:
        conds.append(Commitment.thread_id == thread_id)
    if counterparty_email:
        conds.append(Commitment.counterparty_email == counterparty_email.strip().lower())
    if owner_email:
        conds.append(Commitment.owner_email == owner_email.strip().lower())
    if overdue is True:
        conds += [Commitment.status == "open", Commitment.due_at < now]
    elif overdue is False:
        conds.append(or_(Commitment.due_at.is_(None), Commitment.due_at >= now))
    if due_within_hours:
        conds += [Commitment.status == "open", Commitment.due_at >= now,
                  Commitment.due_at <= now + timedelta(hours=due_within_hours)]
    if q and q.strip():
        conds.append(Commitment.statement.ilike(f"%{q.strip()}%"))
    rows = (await db.execute(
        select(Commitment, func.count().over().label("total")).where(*conds)
        .order_by(Commitment.due_at.asc().nulls_last(), Commitment.created_at.desc())
        .limit(limit).offset(offset)
    )).all()
    return {"items": [_dto(r.Commitment, now) for r in rows], "total": rows[0].total if rows else 0,
            "limit": limit, "offset": offset}


@router.get("/summary", summary="Open, overdue and due-soon counts")
async def commitments_summary(
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.read")),
) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    row = (await db.execute(
        select(
            func.count().label("open"),
            func.count().filter(Commitment.due_at < now).label("overdue"),
            func.count().filter(Commitment.due_at.between(now, now + timedelta(hours=48))).label("due_48h"),
            func.count().filter(Commitment.kind == "decision").label("decisions_in_force"),
            func.count().filter(Commitment.kind == "commitment", Commitment.owed_by == "company").label("we_owe"),
            func.count().filter(Commitment.kind == "commitment", Commitment.owed_by == "customer").label("customer_owes"),
            func.count().filter(Commitment.kind == "action_item").label("action_items"),
        ).where(Commitment.tenant_id == ctx.organization_id, Commitment.status == "open")
    )).one()
    return dict(row._mapping)


@router.post("", status_code=status.HTTP_201_CREATED, summary="Record a decision, promise or action item")
async def create_commitment(
    payload: CommitmentCreateDTO,
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.reply")),
) -> Dict[str, Any]:
    actor = await _actor_email(db, ctx.user_id)
    owner = normalize_email(payload.owner_email) if payload.owner_email else actor
    c = Commitment(
        tenant_id=ctx.organization_id, kind=payload.kind, owed_by=payload.owed_by, category=payload.category,
        statement=" ".join(payload.statement.split()), statement_key=statement_key(payload.statement),
        thread_id=payload.thread_id, counterparty_email=normalize_email(payload.counterparty_email)
        if payload.counterparty_email else None, owner_email=owner,
        approved_by=payload.approved_by or (actor if payload.kind == "decision" else None),
        due_at=payload.due_at, status=CommitmentStatus.OPEN.value, confidence=1.0, source_type="employee",
        created_by_user_id=ctx.user_id,
    )
    db.add(c)
    await db.flush()
    await audit_service.record(
        db=db, action=AuditAction.COMMITMENT_CREATED, resource_type="commitment", resource_id=c.id,
        organization_id=ctx.organization_id, actor_user_id=ctx.user_id,
        metadata={"kind": c.kind, "owed_by": c.owed_by, "thread_id": c.thread_id},
    )
    await db.commit()
    commitment_memory_service.invalidate(ctx.organization_id)
    return _dto(c, datetime.now(timezone.utc))


@router.patch("/{commitment_id}", summary="Edit, fulfil, cancel or reopen")
async def update_commitment(
    commitment_id: str,
    payload: CommitmentUpdateDTO,
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.reply")),
) -> Dict[str, Any]:
    c = await _get(db, ctx.organization_id, commitment_id)
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No changes supplied.")
    if c.status == CommitmentStatus.SUPERSEDED.value:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="This item was superseded by a newer one and is kept as history.")
    now = datetime.now(timezone.utc)
    actor = await _actor_email(db, ctx.user_id)
    new_status = changes.pop("status", None)
    note = changes.pop("resolution_note", None)
    for field, value in changes.items():
        if field == "statement":
            value = " ".join(value.split())
            c.statement_key = statement_key(value)
        elif field == "owner_email" and value:
            value = normalize_email(value) or value.strip().lower()
        setattr(c, field, value)
    if new_status and new_status != c.status:
        if new_status == CommitmentStatus.OPEN.value:  # reopen
            c.resolved_at = c.resolved_by = c.resolution_note = c.resolution_message_id = None
        else:
            c.resolved_at, c.resolved_by = now, actor
            c.resolution_note = note
        c.status = new_status
    elif note is not None:
        c.resolution_note = note
    await audit_service.record(
        db=db, action=AuditAction.COMMITMENT_UPDATED, resource_type="commitment", resource_id=c.id,
        organization_id=ctx.organization_id, actor_user_id=ctx.user_id,
        metadata={"fields": sorted(payload.model_dump(exclude_unset=True)), "status": c.status},
    )
    await db.commit()
    commitment_memory_service.invalidate(ctx.organization_id)
    return _dto(c, now)


@router.post("/extract", summary="(Re)run commitment extraction for one email")
async def extract_commitments(
    payload: ExtractDTO,
    ctx: TenantContext = Depends(require_permission("inbox.reply")),
) -> Dict[str, Any]:
    if not commitment_memory_service.llm_enabled:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="Commitment extraction needs an LLM provider (OPENAI_API_KEY).")
    result = await commitment_memory_service.extract_from_message(ctx.organization_id, payload.message_id)
    if result.get("status") == "not_found":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found for this organization.")
    return result
