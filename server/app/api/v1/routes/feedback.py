"""Feedback & Outcome Memory API (Memory 7).

GET    /feedback/drafts                       AI drafts with their review state (tenant-scoped)
POST   /feedback/drafts/{ai_response_id}/review  approve | edit | reject (+ reason) a draft
GET    /feedback/lessons                      drafting lessons (derived + employee-authored)
POST   /feedback/lessons                      add an employee lesson (active immediately)
PATCH  /feedback/lessons/{lesson_id}          change text / status / priority / scope
DELETE /feedback/lessons/{lesson_id}          disable a lesson (history is kept)
POST   /feedback/lessons/refresh              recompute derived lessons now
GET    /feedback/metrics                      acceptance / edit / rejection rates, reasons, outcomes

Recording a review does NOT send email: sending stays an explicit delivery action. Every
change is audited. Permissions: read = ``inbox.read``; changes = ``inbox.reply``.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext, require_permission
from app.core.database import get_db
from app.models.ai import AIResponse
from app.models.audit import AuditAction
from app.models.feedback import DraftFeedback, FeedbackLesson, LessonStatus
from app.services.audit import audit_service
from app.services.feedback_memory import feedback_memory_service

router = APIRouter(prefix="/feedback", tags=["Feedback & Outcome Memory"])

ReasonCode = Literal["wrong_facts", "missing_info", "wrong_tone", "too_long", "too_short",
                     "off_topic", "policy", "other"]


class DraftReviewDTO(BaseModel):
    action: Literal["approved", "edited", "rejected"]
    final_text: Optional[str] = Field(default=None, max_length=20000)
    reason_code: Optional[ReasonCode] = None
    comment: Optional[str] = Field(default=None, max_length=2000)


class LessonCreateDTO(BaseModel):
    instruction: str = Field(min_length=5, max_length=500)
    scope_intent: Optional[str] = Field(default=None, max_length=64)
    priority: int = Field(default=60, ge=0, le=100)


class LessonUpdateDTO(BaseModel):
    instruction: Optional[str] = Field(default=None, min_length=5, max_length=500)
    scope_intent: Optional[str] = Field(default=None, max_length=64)
    priority: Optional[int] = Field(default=None, ge=0, le=100)
    status: Optional[Literal["active", "suggested", "disabled"]] = None


def _lesson_dict(l: FeedbackLesson) -> Dict[str, Any]:
    return {
        "id": l.id, "instruction": l.instruction, "scope_intent": l.scope_intent, "origin": l.origin,
        "derived_key": l.derived_key, "evidence_count": l.evidence_count, "status": l.status,
        "priority": l.priority, "updated_at": l.updated_at.isoformat() if l.updated_at else None,
    }


async def _get_lesson(db: AsyncSession, tenant_id: str, lesson_id: str) -> FeedbackLesson:
    lesson = (await db.execute(select(FeedbackLesson).where(
        FeedbackLesson.id == lesson_id, FeedbackLesson.tenant_id == tenant_id))).scalar_one_or_none()
    if lesson is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found for this organization.")
    return lesson


@router.get("/drafts", summary="AI drafts and their review state")
async def list_drafts(
    approval_status: Optional[str] = Query(default="pending_review", max_length=32),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.read")),
) -> Dict[str, Any]:
    conds = [AIResponse.tenant_id == ctx.organization_id]
    if approval_status and approval_status != "all":
        conds.append(AIResponse.approval_status == approval_status)
    rows = (await db.execute(
        select(AIResponse, func.count().over().label("total")).where(*conds)
        .order_by(AIResponse.created_at.desc()).limit(limit).offset(offset)
    )).all()
    return {
        "items": [{
            "id": r.AIResponse.id, "thread_id": r.AIResponse.thread_id,
            "subject": r.AIResponse.draft_subject, "body": r.AIResponse.draft_body_plain,
            "approval_status": r.AIResponse.approval_status, "tone": r.AIResponse.tone,
            "has_policy_violations": r.AIResponse.has_policy_violations,
            "reviewed_at": r.AIResponse.reviewed_at,
            "created_at": r.AIResponse.created_at.isoformat() if r.AIResponse.created_at else None,
        } for r in rows],
        "total": rows[0].total if rows else 0, "limit": limit, "offset": offset,
    }


class DraftSendDTO(BaseModel):
    body_text: Optional[str] = Field(default=None, max_length=20000, description="Edited reply; omit to send as drafted")


@router.get("/threads/{thread_id}/draft", summary="Latest unsent AI draft for a conversation")
async def thread_draft(
    thread_id: str,
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.read")),
) -> Dict[str, Any]:
    from sqlalchemy import text as _t

    row = (await db.execute(_t("""
        SELECT r.id, r.draft_subject, r.draft_body_plain, r.approval_status, r.has_policy_violations, r.created_at,
               (SELECT h.triage_context FROM human_reviews h WHERE h.ai_response_id = r.id ORDER BY h.created_at DESC LIMIT 1) AS triage,
               (SELECT max(m.sent_at) FROM email_messages m WHERE m.tenant_id = r.tenant_id AND m.thread_id = r.thread_id
                  AND m.direction = 'outbound') AS last_outbound_at
        FROM ai_responses r
        WHERE r.tenant_id = :t AND r.thread_id = :th AND r.approval_status IN ('pending_review', 'auto_approved', 'human_approved')
        ORDER BY r.created_at DESC LIMIT 1"""), {"t": ctx.organization_id, "th": thread_id})).mappings().first()
    latest_inbound = (await db.execute(_t("""
        SELECT max(sent_at) FROM email_messages WHERE tenant_id = :t AND thread_id = :th AND direction = 'inbound'
          AND coalesce(filter_reason, 'BUSINESS_CONVERSATION') IN ('BUSINESS_CONVERSATION', 'AMBIGUOUS', 'ACCEPT')"""),
        {"t": ctx.organization_id, "th": thread_id})).scalar()
    draft = None
    if row and not (row["last_outbound_at"] and row["created_at"] and row["last_outbound_at"] > row["created_at"]):
        reason = None
        try:
            reason = (json.loads(row["triage"]) or {}).get("reason") if row["triage"] else None
        except (ValueError, TypeError):
            reason = None
        draft = {"id": row["id"], "subject": row["draft_subject"], "body": row["draft_body_plain"],
                 "approval_status": row["approval_status"], "has_policy_violations": row["has_policy_violations"],
                 "review_reason": reason, "created_at": row["created_at"].isoformat() if row["created_at"] else None}
    # A customer message newer than the draft (and recent) is still being processed by the AI.
    from datetime import datetime, timedelta, timezone
    now = datetime.now(timezone.utc)
    generating = bool(latest_inbound and now - latest_inbound < timedelta(minutes=3) and (
        draft is None or (row and row["created_at"] and latest_inbound > row["created_at"])))
    return {"thread_id": thread_id, "draft": draft, "generating": generating,
            "latest_inbound_at": latest_inbound.isoformat() if latest_inbound else None}


@router.post("/drafts/{ai_response_id}/send", summary="Send an AI draft (optionally edited) in the same Gmail thread")
async def send_draft(
    ai_response_id: str,
    payload: DraftSendDTO,
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.reply")),
) -> Dict[str, Any]:
    from app.services.gmail_client import GmailApiException
    from app.services.reply_planner.delivery import outbound_delivery_service

    try:
        result = await outbound_delivery_service.send_draft(ctx.organization_id, ai_response_id, ctx.user_id,
                                                            body_text=payload.body_text)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e).capitalize() + ".")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e).capitalize() + ".")
    except GmailApiException as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY,
                            detail=f"Gmail rejected the send: {str(e)[:300]}. Reconnect Gmail if this persists.")
    if result.get("status") == "in_flight":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This reply is already being sent.")
    await audit_service.record(
        db=db, action=AuditAction.DRAFT_FEEDBACK_RECORDED, resource_type="ai_response", resource_id=ai_response_id,
        organization_id=ctx.organization_id, actor_user_id=ctx.user_id,
        metadata={"op": "send", "status": result.get("status"), "edited": result.get("edited")},
    )
    await db.commit()
    return result


class ManualReplyDTO(BaseModel):
    body_text: str = Field(min_length=1, max_length=20000)
    client_token: str = Field(min_length=8, max_length=64)


@router.post("/threads/{thread_id}/reply", summary="Send a reply typed by the user in the same Gmail thread")
async def send_manual_reply(
    thread_id: str,
    payload: ManualReplyDTO,
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.reply")),
) -> Dict[str, Any]:
    from app.services.gmail_client import GmailApiException
    from app.services.reply_planner.delivery import outbound_delivery_service

    try:
        result = await outbound_delivery_service.send_manual_reply(
            ctx.organization_id, thread_id, ctx.user_id, payload.body_text, payload.client_token)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e).capitalize() + ".")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e).capitalize() + ".")
    except GmailApiException as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY,
                            detail=f"Gmail rejected the send: {str(e)[:300]}. Reconnect Gmail if this persists.")
    if result.get("status") == "in_flight":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This reply is already being sent.")
    return result


@router.post("/drafts/{ai_response_id}/review", summary="Approve, edit or reject an AI draft")
async def review_draft(
    ai_response_id: str,
    payload: DraftReviewDTO,
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.reply")),
) -> Dict[str, Any]:
    try:
        fb = await feedback_memory_service.review_draft(
            db, ctx.organization_id, ai_response_id, payload.action, ctx.user_id,
            final_text=payload.final_text, reason_code=payload.reason_code, comment=payload.comment,
        )
    except LookupError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found for this organization.")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    await audit_service.record(
        db=db, action=AuditAction.DRAFT_FEEDBACK_RECORDED, resource_type="ai_response",
        resource_id=ai_response_id, organization_id=ctx.organization_id, actor_user_id=ctx.user_id,
        metadata={"action": fb.action, "reason_code": fb.reason_code, "similarity": fb.similarity},
    )
    await db.commit()
    return {"id": fb.id, "action": fb.action, "similarity": fb.similarity,
            "length_ratio": fb.length_ratio, "reason_code": fb.reason_code}


@router.get("/lessons", summary="Drafting lessons learned from feedback")
async def list_lessons(
    include_disabled: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.read")),
) -> List[Dict[str, Any]]:
    conds = [FeedbackLesson.tenant_id == ctx.organization_id]
    if not include_disabled:
        conds.append(FeedbackLesson.status != LessonStatus.DISABLED.value)
    rows = (await db.execute(select(FeedbackLesson).where(*conds).order_by(
        FeedbackLesson.priority.desc(), FeedbackLesson.created_at.desc()))).scalars().all()
    return [_lesson_dict(l) for l in rows]


@router.post("/lessons", status_code=status.HTTP_201_CREATED, summary="Add an employee lesson")
async def create_lesson(
    payload: LessonCreateDTO,
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.reply")),
) -> Dict[str, Any]:
    lesson = FeedbackLesson(
        tenant_id=ctx.organization_id, instruction=payload.instruction.strip(),
        scope_intent=(payload.scope_intent or "").strip() or None, origin="employee",
        status=LessonStatus.ACTIVE.value, priority=payload.priority, created_by_user_id=ctx.user_id,
    )
    db.add(lesson)
    await db.flush()
    await audit_service.record(
        db=db, action=AuditAction.FEEDBACK_LESSON_CHANGED, resource_type="feedback_lesson",
        resource_id=lesson.id, organization_id=ctx.organization_id, actor_user_id=ctx.user_id,
        metadata={"op": "create", "scope_intent": lesson.scope_intent},
    )
    await db.commit()
    feedback_memory_service.invalidate(ctx.organization_id)
    return _lesson_dict(lesson)


@router.patch("/lessons/{lesson_id}", summary="Update a lesson")
async def update_lesson(
    lesson_id: str,
    payload: LessonUpdateDTO,
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.reply")),
) -> Dict[str, Any]:
    lesson = await _get_lesson(db, ctx.organization_id, lesson_id)
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No changes supplied.")
    for field, value in changes.items():
        if isinstance(value, str):
            value = value.strip() or None
        if field == "instruction" and not value:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Instruction cannot be empty.")
        setattr(lesson, field, value)
    # An employee decision on a derived lesson is final: the deriver will not undo it.
    lesson.created_by_user_id = ctx.user_id
    await audit_service.record(
        db=db, action=AuditAction.FEEDBACK_LESSON_CHANGED, resource_type="feedback_lesson",
        resource_id=lesson.id, organization_id=ctx.organization_id, actor_user_id=ctx.user_id,
        metadata={"op": "update", "fields": sorted(changes)},
    )
    await db.commit()
    feedback_memory_service.invalidate(ctx.organization_id)
    return _lesson_dict(lesson)


@router.delete("/lessons/{lesson_id}", summary="Disable a lesson (history is kept)")
async def disable_lesson(
    lesson_id: str,
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.reply")),
) -> Dict[str, Any]:
    lesson = await _get_lesson(db, ctx.organization_id, lesson_id)
    lesson.status = LessonStatus.DISABLED.value
    lesson.created_by_user_id = ctx.user_id
    await audit_service.record(
        db=db, action=AuditAction.FEEDBACK_LESSON_CHANGED, resource_type="feedback_lesson",
        resource_id=lesson.id, organization_id=ctx.organization_id, actor_user_id=ctx.user_id,
        metadata={"op": "disable"},
    )
    await db.commit()
    feedback_memory_service.invalidate(ctx.organization_id)
    return _lesson_dict(lesson)


@router.post("/lessons/refresh", summary="Recompute derived lessons from recent feedback")
async def refresh_lessons(
    ctx: TenantContext = Depends(require_permission("inbox.reply")),
) -> Dict[str, Any]:
    return {"changed": await feedback_memory_service.refresh_derived_lessons(ctx.organization_id)}


@router.get("/metrics", summary="Draft acceptance and customer outcome metrics")
async def feedback_metrics(
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.read")),
) -> Dict[str, Any]:
    return await feedback_memory_service.metrics(db, ctx.organization_id, days)
