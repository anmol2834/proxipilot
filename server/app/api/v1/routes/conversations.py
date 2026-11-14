"""Thread & Conversation Memory API (Memory 3).

GET   /conversations/{thread_id}/memory           the conversation's memory
PATCH /conversations/{thread_id}/memory           pinned team notes; correct a requirement's status
POST  /conversations/{thread_id}/memory/rebuild   re-summarise the whole thread (keeps pinned notes)
GET   /conversations/memory/preview               the conversation section the drafter receives

Permissions: read = ``inbox.read``; changes = ``inbox.reply``. Every change is audited.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext, require_permission
from app.core.database import get_db
from app.models.audit import AuditAction
from app.services.audit import audit_service
from app.services.thread_memory import thread_memory_service

router = APIRouter(prefix="/conversations", tags=["Thread & Conversation Memory"])


class RequirementStatusDTO(BaseModel):
    id: str = Field(min_length=1, max_length=32)
    status: Literal["open", "answered", "cancelled"]


class MemoryPatchDTO(BaseModel):
    pinned_notes: Optional[str] = Field(default=None, max_length=2000)
    requirements: Optional[List[RequirementStatusDTO]] = Field(default=None, max_length=30)


async def _assert_thread(db: AsyncSession, tenant_id: str, thread_id: str) -> None:
    ok = (await db.execute(text("SELECT 1 FROM email_threads WHERE id=:th AND tenant_id=:t"),
                           {"th": thread_id, "t": tenant_id})).first()
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found for this organization.")


async def _memory(db: AsyncSession, tenant_id: str, thread_id: str) -> Optional[Dict[str, Any]]:
    row = (await db.execute(text("SELECT * FROM thread_memories WHERE tenant_id=:t AND thread_id=:th"),
                            {"t": tenant_id, "th": thread_id})).mappings().first()
    if row is None:
        return None
    r = dict(row)

    def load(v):
        try:
            return json.loads(v) if v else []
        except (ValueError, TypeError):
            return []

    return {
        "thread_id": r["thread_id"], "summary": r["summary"], "stage": r["stage"], "sentiment": r["sentiment"],
        "language": r["language"], "last_customer_ask": r["last_customer_ask"],
        "customer_requirements": load(r["customer_requirements"]), "open_issues": load(r["open_issues"]),
        "key_facts": load(r["key_facts"]), "pinned_notes": r["pinned_notes"],
        "messages_included": r["messages_included"], "version": r["version"], "status": r["status"],
        "last_error": r["last_error"],
        "included_until_sent_at": r["included_until_sent_at"].isoformat() if r["included_until_sent_at"] else None,
        "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None,
    }


@router.get("/memory/preview", summary="Conversation section the drafter receives for a message")
async def preview_memory(
    message_id: str = Query(min_length=1, max_length=64),
    ctx: TenantContext = Depends(require_permission("inbox.read")),
) -> Dict[str, Any]:
    return {"message_id": message_id,
            "thread_context": await thread_memory_service.build_prompt_context(ctx.organization_id, message_id)}


@router.get("/{thread_id}/memory", summary="The conversation's memory")
async def get_memory(
    thread_id: str,
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.read")),
) -> Dict[str, Any]:
    await _assert_thread(db, ctx.organization_id, thread_id)
    mem = await _memory(db, ctx.organization_id, thread_id)
    return mem or {"thread_id": thread_id, "status": "not_built", "messages_included": 0}


@router.patch("/{thread_id}/memory", summary="Pin team notes or correct requirement status")
async def patch_memory(
    thread_id: str,
    payload: MemoryPatchDTO,
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.reply")),
) -> Dict[str, Any]:
    await _assert_thread(db, ctx.organization_id, thread_id)
    sent = payload.model_dump(exclude_unset=True)
    if not sent:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No changes supplied.")
    await db.execute(text("""
        INSERT INTO thread_memories (id, tenant_id, thread_id, messages_included, version, status, created_at, updated_at)
        VALUES ('tm_' || md5(random()::text || clock_timestamp()::text), :t, :th, 0, 0, 'ok', now(), now())
        ON CONFLICT ON CONSTRAINT uq_thread_memories_thread DO NOTHING"""),
        {"t": ctx.organization_id, "th": thread_id})
    row = (await db.execute(text("""SELECT customer_requirements FROM thread_memories
                                    WHERE tenant_id=:t AND thread_id=:th FOR UPDATE"""),
                            {"t": ctx.organization_id, "th": thread_id})).mappings().first()
    sets, params = [], {"t": ctx.organization_id, "th": thread_id, "u": ctx.user_id}
    if "pinned_notes" in sent:
        sets.append("pinned_notes = :notes")
        params["notes"] = (payload.pinned_notes or "").strip() or None
    if payload.requirements:
        try:
            reqs = json.loads(row["customer_requirements"] or "[]")
        except (ValueError, TypeError):
            reqs = []
        by_id = {r.get("id"): r for r in reqs if isinstance(r, dict)}
        unknown = [c.id for c in payload.requirements if c.id not in by_id]
        if unknown:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                                detail=f"Unknown requirement ids: {', '.join(unknown)}")
        for c in payload.requirements:
            by_id[c.id]["status"] = c.status
            by_id[c.id]["resolved_by"] = f"user:{ctx.user_id}" if c.status != "open" else None
        sets.append("customer_requirements = :reqs")
        params["reqs"] = json.dumps(reqs, ensure_ascii=False)
    if sets:
        # Bump version so an in-flight AI update cannot overwrite the employee's change.
        await db.execute(text(f"""UPDATE thread_memories SET {', '.join(sets)}, version = version + 1,
                                  updated_by_user_id = :u, updated_at = now()
                                  WHERE tenant_id = :t AND thread_id = :th"""), params)
    await audit_service.record(
        db=db, action=AuditAction.THREAD_MEMORY_UPDATED, resource_type="thread_memory", resource_id=thread_id,
        organization_id=ctx.organization_id, actor_user_id=ctx.user_id, metadata={"fields": sorted(sent)},
    )
    await db.commit()
    return await _memory(db, ctx.organization_id, thread_id)


@router.post("/{thread_id}/memory/rebuild", summary="Re-summarise the whole conversation")
async def rebuild_memory(
    thread_id: str,
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.reply")),
) -> Dict[str, Any]:
    await _assert_thread(db, ctx.organization_id, thread_id)
    if not thread_memory_service.llm_enabled:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="Conversation memory needs an LLM provider (OPENAI_API_KEY).")
    result = await thread_memory_service.rebuild_thread(ctx.organization_id, thread_id)
    await audit_service.record(
        db=db, action=AuditAction.THREAD_MEMORY_UPDATED, resource_type="thread_memory", resource_id=thread_id,
        organization_id=ctx.organization_id, actor_user_id=ctx.user_id, metadata={"op": "rebuild", **result},
    )
    await db.commit()
    return {"result": result, "memory": await _memory(db, ctx.organization_id, thread_id)}
