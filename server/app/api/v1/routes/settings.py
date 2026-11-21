"""Settings API — generic, registry-driven storage for user and workspace settings.

GET returns every active setting's effective value, whether it was customized, and its definition
(type, choices, default) so a client can render controls without hard-coding them. PATCH changes
only the keys sent (``values``) and/or resets keys to their default (``reset``); it is validated
against the registry and all-or-nothing.

The behaviour behind each setting is implemented separately; these endpoints only store values.
"""

from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.contracts.settings_registry import SettingScope
from app.core.context import TenantContext, require_permission
from app.core.database import get_db
from app.core.security import TokenPayload, get_current_user
from app.services import settings_store

router = APIRouter(prefix="/settings", tags=["Settings"])


class SettingsPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    values: Dict[str, Any] = Field(default_factory=dict, description="Settings to change: {key: value}.")
    reset: List[str] = Field(default_factory=list, max_length=100,
                             description="Keys to return to their default value.")


@router.get("/me", summary="My settings (effective values + definitions)")
async def get_my_settings(db: AsyncSession = Depends(get_db),
                          user: TokenPayload = Depends(get_current_user)) -> Dict[str, Any]:
    return await settings_store.get_settings(db, SettingScope.USER, user.sub)


@router.patch("/me", summary="Change my settings (partial, validated)")
async def patch_my_settings(payload: SettingsPatch, db: AsyncSession = Depends(get_db),
                            user: TokenPayload = Depends(get_current_user)) -> Dict[str, Any]:
    return await settings_store.update_settings(
        db, SettingScope.USER, user.sub, user.sub, values=payload.values, reset=payload.reset,
        audit_tenant_id=user.tenant_id or None)


@router.get("/workspace", summary="Workspace settings (effective values + definitions)")
async def get_workspace_settings(db: AsyncSession = Depends(get_db),
                                 ctx: TenantContext = Depends(require_permission("organization.read"))) -> Dict[str, Any]:
    out = await settings_store.get_settings(db, SettingScope.WORKSPACE, ctx.organization_id)
    out["can_edit"] = "organization.update" in ctx.permissions
    return out


@router.patch("/workspace", summary="Change workspace settings (owners/admins; partial, validated)")
async def patch_workspace_settings(payload: SettingsPatch, db: AsyncSession = Depends(get_db),
                                   ctx: TenantContext = Depends(require_permission("organization.read"))) -> Dict[str, Any]:
    # Each definition names the permission it needs (organization.update today); checked per key.
    out = await settings_store.update_settings(
        db, SettingScope.WORKSPACE, ctx.organization_id, ctx.user_id, values=payload.values,
        reset=payload.reset, permissions=set(ctx.permissions), audit_tenant_id=ctx.organization_id)
    out["can_edit"] = "organization.update" in ctx.permissions
    return out
