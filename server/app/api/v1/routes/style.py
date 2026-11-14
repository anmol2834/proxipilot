"""Communication Style Memory API (Memory 2).

GET  /style/profiles             learned + employee-defined style per company / mailbox
PUT  /style/settings             set employee overrides / rules (company-wide or per mailbox)
POST /style/rebuild              re-learn style from human-written sent emails now
GET  /style/preview              exactly what the drafter receives for a given message

Permissions: read = ``inbox.read``; changes = ``inbox.reply``. Every change is audited.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext, require_permission
from app.core.database import get_db
from app.models.audit import AuditAction
from app.models.style import StyleProfile, StyleProfileStatus
from app.services.audit import audit_service
from app.services.contact_memory import normalize_email
from app.services.style_memory import style_memory_service

router = APIRouter(prefix="/style", tags=["Communication Style Memory"])


class StyleOverridesDTO(BaseModel):
    greeting: Optional[str] = Field(default=None, max_length=80)
    sign_off: Optional[str] = Field(default=None, max_length=60)
    language: Optional[Literal["english", "hindi", "hinglish"]] = None
    formality: Optional[Literal["formal", "neutral", "casual"]] = None
    max_words: Optional[int] = Field(default=None, ge=30, le=600)
    use_bullets: Optional[bool] = None


class StyleSettingsDTO(BaseModel):
    scope: Literal["company", "sender"] = "company"
    scope_key: Optional[str] = Field(default=None, max_length=320, description="mailbox email for scope=sender")
    overrides: Optional[StyleOverridesDTO] = None
    employee_guide: Optional[str] = Field(default=None, max_length=2000)
    enabled: Optional[bool] = None

    @model_validator(mode="after")
    def _key(self) -> "StyleSettingsDTO":
        if self.scope == "sender":
            key = normalize_email(self.scope_key or "") or (self.scope_key or "").strip().lower()
            if "@" not in key:
                raise ValueError("scope_key must be the mailbox email when scope is 'sender'")
            self.scope_key = key
        else:
            self.scope_key = "*"
        return self


def _loads(raw: Optional[str]) -> Any:
    try:
        return json.loads(raw) if raw else None
    except (ValueError, TypeError):
        return None


def _dto(p: StyleProfile) -> Dict[str, Any]:
    return {
        "id": p.id, "scope": p.scope, "scope_key": p.scope_key, "status": p.status,
        "sample_count": p.sample_count, "version": p.version,
        "computed_at": p.computed_at.isoformat() if p.computed_at else None,
        "learned": _loads(p.stats), "learned_guide": _loads(p.learned_guide),
        "overrides": _loads(p.overrides) or {}, "employee_guide": p.employee_guide,
    }


@router.get("/profiles", summary="Learned and employee-defined communication style")
async def list_profiles(
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.read")),
) -> List[Dict[str, Any]]:
    rows = (await db.execute(select(StyleProfile).where(StyleProfile.tenant_id == ctx.organization_id)
                             .order_by(StyleProfile.scope, StyleProfile.scope_key))).scalars().all()
    return [_dto(p) for p in rows]


@router.put("/settings", summary="Set style overrides / rules (company-wide or per mailbox)")
async def put_settings(
    payload: StyleSettingsDTO,
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.reply")),
) -> Dict[str, Any]:
    sent = payload.model_dump(exclude_unset=True)
    if not ({"overrides", "employee_guide", "enabled"} & set(sent)):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No changes supplied.")
    values: Dict[str, Any] = {"updated_by_user_id": ctx.user_id, "updated_at": datetime.now(timezone.utc)}
    if "overrides" in sent:
        ov = payload.overrides.model_dump(exclude_none=True) if payload.overrides else {}
        values["overrides"] = json.dumps({k: (v.strip() if isinstance(v, str) else v) for k, v in ov.items()},
                                         ensure_ascii=False) if ov else None
    if "employee_guide" in sent:
        values["employee_guide"] = (payload.employee_guide or "").strip() or None
    insert_values = {"tenant_id": ctx.organization_id, "scope": payload.scope, "scope_key": payload.scope_key,
                     "status": StyleProfileStatus.INSUFFICIENT_DATA.value, **values}
    if "enabled" in sent:
        if payload.enabled is False:
            values["status"] = insert_values["status"] = StyleProfileStatus.DISABLED.value
    await db.execute(pg_insert(StyleProfile).values(**insert_values).on_conflict_do_update(
        constraint="uq_style_profiles_scope", set_=values))
    profile = (await db.execute(select(StyleProfile).where(
        StyleProfile.tenant_id == ctx.organization_id, StyleProfile.scope == payload.scope,
        StyleProfile.scope_key == payload.scope_key))).scalar_one()
    if payload.enabled is True and profile.status == StyleProfileStatus.DISABLED.value:
        min_n = 5 if payload.scope == "company" else 10
        profile.status = (StyleProfileStatus.ACTIVE.value if profile.sample_count >= min_n
                          else StyleProfileStatus.INSUFFICIENT_DATA.value)
    await audit_service.record(
        db=db, action=AuditAction.STYLE_PROFILE_UPDATED, resource_type="style_profile", resource_id=profile.id,
        organization_id=ctx.organization_id, actor_user_id=ctx.user_id,
        metadata={"scope": payload.scope, "scope_key": payload.scope_key, "fields": sorted(sent)},
    )
    await db.commit()
    await db.refresh(profile)
    style_memory_service.invalidate(ctx.organization_id)
    return _dto(profile)


@router.post("/rebuild", summary="Re-learn style from human-written sent emails")
async def rebuild_style(
    force_guide: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.reply")),
) -> Dict[str, Any]:
    result = await style_memory_service.rebuild_tenant(ctx.organization_id, force_guide=force_guide)
    await audit_service.record(
        db=db, action=AuditAction.STYLE_REBUILT, resource_type="style_profiles", resource_id=ctx.organization_id,
        organization_id=ctx.organization_id, actor_user_id=ctx.user_id,
        metadata={"usable": result["usable"], "profiles": len(result["profiles"])},
    )
    await db.commit()
    return result


@router.get("/preview", summary="Style section the drafter receives for a message")
async def preview_style(
    message_id: str = Query(min_length=1, max_length=64),
    ctx: TenantContext = Depends(require_permission("inbox.read")),
) -> Dict[str, Any]:
    style_memory_service.invalidate(ctx.organization_id)
    return {"message_id": message_id,
            "style_context": await style_memory_service.build_prompt_context(ctx.organization_id, message_id)}
