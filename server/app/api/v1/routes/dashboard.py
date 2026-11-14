"""Dashboard overview API: real, tenant-scoped numbers for the overview screen.

GET /dashboard/overview   counters, trends, response times and recent activity (read: inbox.read)
"""

from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext, require_permission
from app.core.database import get_db
from app.services.dashboard_overview import build_overview

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/overview", summary="Overview metrics computed from the organization's own data")
async def dashboard_overview(
    days: int = Query(default=7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.read")),
) -> Dict[str, Any]:
    return await build_overview(db, ctx.organization_id, days=days)
