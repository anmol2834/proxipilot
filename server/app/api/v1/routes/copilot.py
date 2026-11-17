"""AI Reply Copilot API.

POST /copilot/threads/{thread_id}/refine   instruction + current editor draft -> validated proposal

The thread is resolved server-side against the caller's tenant (a foreign or unknown thread is 404).
The endpoint only PROPOSES text: it never writes the editor, never creates an outbound message and
never sends email. Sending stays the editor's explicit Send action.
"""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.context import TenantContext, require_permission
from app.core.logging import logger
from app.services.reply_copilot import CopilotRequest, CopilotResult, ThreadNotFound, reply_copilot_service

router = APIRouter(prefix="/copilot", tags=["AI Reply Copilot"])

# Bound concurrent Copilot work per tenant (each request may make up to ~4 model calls).
_TENANT_LIMIT = 4
_tenant_sems: dict[str, asyncio.Semaphore] = {}


def _sem(tenant_id: str) -> asyncio.Semaphore:
    s = _tenant_sems.get(tenant_id)
    if s is None:
        s = _tenant_sems[tenant_id] = asyncio.Semaphore(_TENANT_LIMIT)
    return s


@router.post("/threads/{thread_id}/refine", response_model=CopilotResult,
             summary="Rewrite / complete the reply draft from an instruction (never sends)")
async def refine_draft(
    thread_id: str,
    payload: CopilotRequest,
    ctx: TenantContext = Depends(require_permission("inbox.reply")),
) -> CopilotResult:
    sem = _sem(ctx.organization_id)
    if sem.locked():
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                            detail="Copilot is busy with other requests for your team. Try again in a moment.")
    async with sem:
        try:
            return await reply_copilot_service.refine(ctx.organization_id, thread_id, payload, user_id=ctx.user_id)
        except ThreadNotFound:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
        except asyncio.TimeoutError:
            raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                                detail="Copilot took too long. Your draft is unchanged; please try again.")
        except Exception as exc:  # noqa: BLE001
            logger.error("copilot request failed", tenant_id=ctx.organization_id, thread_id=thread_id,
                         error=f"{type(exc).__name__}: {str(exc)[:300]}")
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY,
                                detail="Copilot could not complete this request. Your draft is unchanged.")
