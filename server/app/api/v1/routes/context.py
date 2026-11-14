"""Context Intelligence Engine API.

GET /context/preview?message_id=...   everything the drafter would receive for this message from
                                      the seven memories: sections, cross-memory alerts and risks,
                                      confidence (with reasons), escalations, per-memory timings.

Evidence-dependent checks (outdated facts, price drift against verified prices) run during real
drafting, where the evidence package exists; the preview reports memory-side checks only.
Permission: ``inbox.read``.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext, require_permission
from app.core.database import get_db
from app.services.context_engine import context_engine

router = APIRouter(prefix="/context", tags=["Context Intelligence Engine"])


@router.get("/preview", summary="What the AI knows about this message, and why")
async def preview_context(
    message_id: str = Query(min_length=1, max_length=64),
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.read")),
) -> Dict[str, Any]:
    msg = (await db.execute(text("SELECT thread_id FROM email_messages WHERE id=:m AND tenant_id=:t"),
                            {"m": message_id, "t": ctx.organization_id})).first()
    if msg is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found for this organization.")
    stub = SimpleNamespace(tenant_id=ctx.organization_id, message_id=message_id, thread_id=msg.thread_id,
                           package_id=None, package_status=SimpleNamespace(value="VALID"), requirements=[])
    bundle = await context_engine.assemble(stub)
    return {"message_id": message_id, "thread_id": msg.thread_id, "evidence_checks": "run during drafting",
            **bundle.to_dict()}
