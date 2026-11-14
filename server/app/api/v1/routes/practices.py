"""Organizational Experience Memory API (Memory 5).

GET    /practices               list (filter by status / situation)
POST   /practices               add a practice (active immediately)
PATCH  /practices/{id}          edit; approve a suggestion (status=active); disable / archive
POST   /practices/mine          propose practices from real history (status 'suggested')
POST   /practices/test          dry-run: which practices match a sample customer message
GET    /practices/insights      turnaround, fulfilment and approval numbers

Permissions: read = ``inbox.read``; changes = ``inbox.reply``. Every change is audited with
a before/after snapshot and the version is incremented.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext, require_permission
from app.core.database import get_db
from app.models.audit import AuditAction
from app.models.practice import OrgPractice, PracticeStatus
from app.services.audit import audit_service
from app.services.org_memory import PracticeView, build_guidance, org_memory_service

router = APIRouter(prefix="/practices", tags=["Organizational Experience Memory"])

Situation = Literal["general", "complaint", "return_refund", "negotiation", "quotation", "order", "payment",
                    "delivery", "support", "approval"]


class PracticeCreateDTO(BaseModel):
    title: str = Field(min_length=5, max_length=200)
    situation: Situation = "general"
    trigger_keywords: List[str] = Field(default_factory=list, max_length=20)
    description: str = Field(min_length=10, max_length=3000)
    rules: List[str] = Field(default_factory=list, max_length=15)
    exceptions: Optional[str] = Field(default=None, max_length=1000)
    requires_approval: bool = False
    approver: Optional[str] = Field(default=None, max_length=255)
    escalate_to_human: bool = False
    priority: int = Field(default=60, ge=0, le=100)


class PracticeUpdateDTO(BaseModel):
    title: Optional[str] = Field(default=None, min_length=5, max_length=200)
    situation: Optional[Situation] = None
    trigger_keywords: Optional[List[str]] = Field(default=None, max_length=20)
    description: Optional[str] = Field(default=None, min_length=10, max_length=3000)
    rules: Optional[List[str]] = Field(default=None, max_length=15)
    exceptions: Optional[str] = Field(default=None, max_length=1000)
    requires_approval: Optional[bool] = None
    approver: Optional[str] = Field(default=None, max_length=255)
    escalate_to_human: Optional[bool] = None
    priority: Optional[int] = Field(default=None, ge=0, le=100)
    status: Optional[Literal["active", "disabled", "archived"]] = None


class PracticeTestDTO(BaseModel):
    text: str = Field(min_length=3, max_length=5000)
    include_suggested: bool = False


def _clean_list(values: Optional[List[str]], n: int) -> List[str]:
    return [" ".join(v.split())[:300] for v in (values or []) if v and v.strip()][:n]


def _dto(p: OrgPractice) -> Dict[str, Any]:
    def lst(raw):
        try:
            return json.loads(raw) if raw else []
        except (ValueError, TypeError):
            return []

    def obj(raw):
        try:
            return json.loads(raw) if raw else None
        except (ValueError, TypeError):
            return None

    return {
        "id": p.id, "title": p.title, "situation": p.situation, "trigger_keywords": lst(p.trigger_keywords),
        "description": p.description, "rules": lst(p.rules), "exceptions": p.exceptions,
        "requires_approval": p.requires_approval, "approver": p.approver, "escalate_to_human": p.escalate_to_human,
        "priority": p.priority, "status": p.status, "origin": p.origin, "confidence": p.confidence,
        "evidence": obj(p.evidence), "version": p.version,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


async def _get(db: AsyncSession, tenant_id: str, pid: str) -> OrgPractice:
    p = (await db.execute(select(OrgPractice).where(OrgPractice.id == pid, OrgPractice.tenant_id == tenant_id))
         ).scalar_one_or_none()
    if p is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Practice not found for this organization.")
    return p


@router.get("", summary="List company practices")
async def list_practices(
    status_filter: str = Query(default="all", alias="status", max_length=16),
    situation: Optional[Situation] = None,
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.read")),
) -> List[Dict[str, Any]]:
    conds = [OrgPractice.tenant_id == ctx.organization_id]
    if status_filter != "all":
        conds.append(OrgPractice.status == status_filter)
    else:
        conds.append(OrgPractice.status != PracticeStatus.ARCHIVED.value)
    if situation:
        conds.append(OrgPractice.situation == situation)
    rows = (await db.execute(select(OrgPractice).where(*conds).order_by(
        OrgPractice.status, OrgPractice.priority.desc(), OrgPractice.title))).scalars().all()
    return [_dto(p) for p in rows]


@router.post("", status_code=status.HTTP_201_CREATED, summary="Add a company practice")
async def create_practice(
    payload: PracticeCreateDTO,
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.reply")),
) -> Dict[str, Any]:
    p = OrgPractice(
        tenant_id=ctx.organization_id, title=" ".join(payload.title.split()), situation=payload.situation,
        trigger_keywords=json.dumps(_clean_list(payload.trigger_keywords, 20), ensure_ascii=False),
        description=payload.description.strip(), rules=json.dumps(_clean_list(payload.rules, 15), ensure_ascii=False),
        exceptions=(payload.exceptions or "").strip() or None, requires_approval=payload.requires_approval,
        approver=(payload.approver or "").strip() or None, escalate_to_human=payload.escalate_to_human,
        priority=payload.priority, status=PracticeStatus.ACTIVE.value, origin="employee", confidence=1.0,
        created_by_user_id=ctx.user_id, updated_by_user_id=ctx.user_id,
    )
    db.add(p)
    await db.flush()
    await audit_service.record(
        db=db, action=AuditAction.PRACTICE_CHANGED, resource_type="org_practice", resource_id=p.id,
        organization_id=ctx.organization_id, actor_user_id=ctx.user_id,
        metadata={"op": "create", "after": _dto(p)},
    )
    await db.commit()
    org_memory_service.invalidate(ctx.organization_id)
    return _dto(p)


@router.patch("/{practice_id}", summary="Edit, approve, disable or archive a practice")
async def update_practice(
    practice_id: str,
    payload: PracticeUpdateDTO,
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.reply")),
) -> Dict[str, Any]:
    p = await _get(db, ctx.organization_id, practice_id)
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No changes supplied.")
    before = _dto(p)
    for f, v in changes.items():
        if f in ("trigger_keywords", "rules"):
            v = json.dumps(_clean_list(v, 20 if f == "trigger_keywords" else 15), ensure_ascii=False)
        elif isinstance(v, str):
            v = " ".join(v.split()) if f == "title" else (v.strip() or None)
            if f in ("description",) and not v:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"{f} cannot be empty.")
        setattr(p, f, v)
    p.version += 1
    p.updated_by_user_id = ctx.user_id
    op = "approve" if before["status"] == "suggested" and p.status == "active" else "update"
    await audit_service.record(
        db=db, action=AuditAction.PRACTICE_CHANGED, resource_type="org_practice", resource_id=p.id,
        organization_id=ctx.organization_id, actor_user_id=ctx.user_id,
        metadata={"op": op, "fields": sorted(changes), "before": before},
    )
    await db.commit()
    await db.refresh(p)
    org_memory_service.invalidate(ctx.organization_id)
    return _dto(p)


@router.post("/mine", summary="Propose practices learned from real history (as suggestions)")
async def mine_practices(
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.reply")),
) -> Dict[str, Any]:
    if not org_memory_service.llm_enabled:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="Practice mining needs an LLM provider (OPENAI_API_KEY).")
    result = await org_memory_service.mine_practices(ctx.organization_id)
    await audit_service.record(
        db=db, action=AuditAction.PRACTICES_MINED, resource_type="org_practices", resource_id=ctx.organization_id,
        organization_id=ctx.organization_id, actor_user_id=ctx.user_id, metadata=result,
    )
    await db.commit()
    return result


@router.post("/test", summary="Dry-run: which practices match a customer message")
async def test_practices(
    payload: PracticeTestDTO,
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.read")),
) -> Dict[str, Any]:
    statuses = ["active"] + (["suggested"] if payload.include_suggested else [])
    rows = (await db.execute(select(OrgPractice).where(
        OrgPractice.tenant_id == ctx.organization_id, OrgPractice.status.in_(statuses)))).scalars().all()
    g = build_guidance([PracticeView.from_row(r) for r in rows], payload.text)
    return {"situations": g.situations, "escalate_to_human_review": bool(g.escalations),
            "escalation_reason": g.escalation_reason, "matched": g.escalations, "drafter_context": g.context}


@router.get("/insights", summary="Operational numbers: turnaround, fulfilment, approvals")
async def practice_insights(
    days: int = Query(default=90, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.read")),
) -> Dict[str, Any]:
    return await org_memory_service.insights(db, ctx.organization_id, days)
