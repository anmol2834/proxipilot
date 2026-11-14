"""Contact & Relationship Memory API (Memory 4).

GET    /contacts                         list / search contacts (tenant-scoped)
GET    /contacts/{contact_id}            full relationship profile
PATCH  /contacts/{contact_id}            employee edits (identity, classification, block)
POST   /contacts/{contact_id}/facts      add an employee-authored fact (highest authority)
DELETE /contacts/{contact_id}/facts/{id} retract a fact (kept for history)
POST   /contacts/rebuild                 recompute statistics from email history

Permissions: read = ``inbox.read``; changes = ``inbox.reply``. Every change is audited.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import TenantContext, require_permission
from app.core.database import get_db
from app.models.audit import AuditAction
from app.models.contact import (
    Contact,
    ContactFact,
    ContactFactSource,
    ContactFactStatus,
    ContactFactType,
    ContactType,
)
from app.services.audit import audit_service
from app.services.contact_memory import contact_memory_service

router = APIRouter(prefix="/contacts", tags=["Contacts & Relationship Memory"])


class ContactSummaryDTO(BaseModel):
    id: str
    email: str
    display_name: Optional[str] = None
    company_name: Optional[str] = None
    contact_type: str
    lead_temperature: Optional[str] = None
    inbound_count: int
    outbound_count: int
    last_interaction_at: Optional[str] = None
    is_blocked: bool


class ContactPageDTO(BaseModel):
    items: List[ContactSummaryDTO]
    total: int
    limit: int
    offset: int


class ContactUpdateDTO(BaseModel):
    display_name: Optional[str] = Field(default=None, max_length=255)
    contact_type: Optional[Literal["customer", "prospect", "supplier", "partner", "internal", "unknown"]] = None
    company_name: Optional[str] = Field(default=None, max_length=255)
    job_title: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=64)
    preferred_language: Optional[str] = Field(default=None, max_length=32)
    tags: Optional[List[str]] = Field(default=None, max_length=50)
    is_blocked: Optional[bool] = None


class ContactFactCreateDTO(BaseModel):
    fact_type: Literal["preference", "interest", "need", "issue", "attribute", "note"]
    key: str = Field(min_length=1, max_length=128)
    value: str = Field(min_length=1, max_length=4000)

    @field_validator("key")
    @classmethod
    def _key_slug(cls, v: str) -> str:
        return "_".join(v.strip().lower().split())


async def _get_contact(db: AsyncSession, tenant_id: str, contact_id: str) -> Contact:
    contact = (await db.execute(
        select(Contact).where(Contact.id == contact_id, Contact.tenant_id == tenant_id)
    )).scalar_one_or_none()
    if contact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found for this organization.")
    return contact


@router.get("", response_model=ContactPageDTO, summary="List and search contacts")
async def list_contacts(
    search: Optional[str] = Query(default=None, max_length=200),
    contact_type: Optional[str] = Query(default=None, alias="type"),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=100_000),
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.read")),
) -> ContactPageDTO:
    conds = [Contact.tenant_id == ctx.organization_id]
    if contact_type:
        conds.append(Contact.contact_type == contact_type.lower())
    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        conds.append(or_(
            Contact.email.like(term),
            func.lower(Contact.display_name).like(term),
            func.lower(Contact.company_name).like(term),
        ))
    total_col = func.count().over().label("_total")
    rows = (await db.execute(
        select(Contact, total_col).where(*conds)
        .order_by(Contact.last_interaction_at.desc().nullslast(), Contact.id)
        .limit(limit).offset(offset)
    )).all()
    total = int(rows[0][1]) if rows else 0
    return ContactPageDTO(
        items=[
            ContactSummaryDTO(
                id=c.id, email=c.email, display_name=c.display_name, company_name=c.company_name,
                contact_type=c.contact_type, lead_temperature=c.lead_temperature,
                inbound_count=c.inbound_count, outbound_count=c.outbound_count,
                last_interaction_at=c.last_interaction_at.isoformat() if c.last_interaction_at else None,
                is_blocked=c.is_blocked,
            )
            for c, _ in rows
        ],
        total=total, limit=limit, offset=offset,
    )


@router.post("/rebuild", summary="Recompute contact statistics from email history")
async def rebuild_contacts(
    request: Request,
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.reply")),
) -> Dict[str, Any]:
    result = await contact_memory_service.rebuild_stats(ctx.organization_id)
    await audit_service.record(
        db=db, action=AuditAction.CONTACT_MEMORY_REBUILT, resource_type="contacts",
        resource_id=ctx.organization_id, organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id, metadata=result,
    )
    await db.commit()
    return result


@router.get("/{contact_id}", summary="Full relationship profile")
async def get_contact(
    contact_id: str,
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.read")),
) -> Dict[str, Any]:
    profile = await contact_memory_service.get_profile(db, ctx.organization_id, contact_id=contact_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found for this organization.")
    return profile


@router.patch("/{contact_id}", summary="Update contact identity / classification")
async def update_contact(
    contact_id: str,
    payload: ContactUpdateDTO,
    request: Request,
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.reply")),
) -> Dict[str, Any]:
    contact = await _get_contact(db, ctx.organization_id, contact_id)
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No changes supplied.")
    changed: Dict[str, Any] = {}
    for field, value in changes.items():
        if field == "tags":
            value = json.dumps([t.strip() for t in (value or []) if t and t.strip()][:50]) if value is not None else None
        elif isinstance(value, str):
            value = value.strip() or None
        if getattr(contact, field) != value:
            changed[field] = {"from": getattr(contact, field), "to": value}
            setattr(contact, field, value)
    if "contact_type" in changes:
        contact.type_locked = changes["contact_type"] != ContactType.UNKNOWN.value
    if changed:
        await audit_service.record(
            db=db, action=AuditAction.CONTACT_UPDATED, resource_type="contact", resource_id=contact.id,
            organization_id=ctx.organization_id, actor_user_id=ctx.user_id,
            metadata={"changes": {k: v["to"] for k, v in changed.items()},
                      "ip_address": request.client.host if request.client else None},
        )
    await db.commit()
    return await contact_memory_service.get_profile(db, ctx.organization_id, contact_id=contact.id)


@router.post("/{contact_id}/facts", status_code=status.HTTP_201_CREATED, summary="Add an employee-authored fact")
async def add_contact_fact(
    contact_id: str,
    payload: ContactFactCreateDTO,
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.reply")),
) -> Dict[str, Any]:
    contact = await _get_contact(db, ctx.organization_id, contact_id)
    fact = await contact_memory_service.upsert_fact(
        db, ctx.organization_id, contact.id, ContactFactType(payload.fact_type).value, payload.key,
        payload.value, ContactFactSource.EMPLOYEE.value, 1.0, ctx.user_id, ctx.user_id,
    )
    if fact is None:  # employee authority is highest; only empty values are rejected
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Fact could not be stored.")
    await audit_service.record(
        db=db, action=AuditAction.CONTACT_FACT_ADDED, resource_type="contact_fact", resource_id=fact.id,
        organization_id=ctx.organization_id, actor_user_id=ctx.user_id,
        metadata={"contact_id": contact.id, "fact_type": fact.fact_type, "key": fact.key},
    )
    await db.commit()
    return {"id": fact.id, "fact_type": fact.fact_type, "key": fact.key, "value": fact.value,
            "source_type": fact.source_type, "status": fact.status}


@router.delete("/{contact_id}/facts/{fact_id}", summary="Retract a fact (history is kept)")
async def retract_contact_fact(
    contact_id: str,
    fact_id: str,
    db: AsyncSession = Depends(get_db),
    ctx: TenantContext = Depends(require_permission("inbox.reply")),
) -> Dict[str, Any]:
    await _get_contact(db, ctx.organization_id, contact_id)
    fact = (await db.execute(
        select(ContactFact).where(
            ContactFact.id == fact_id,
            ContactFact.contact_id == contact_id,
            ContactFact.tenant_id == ctx.organization_id,
        )
    )).scalar_one_or_none()
    if fact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fact not found for this contact.")
    if fact.status != ContactFactStatus.RETRACTED.value:
        fact.status = ContactFactStatus.RETRACTED.value
        await audit_service.record(
            db=db, action=AuditAction.CONTACT_FACT_RETRACTED, resource_type="contact_fact", resource_id=fact.id,
            organization_id=ctx.organization_id, actor_user_id=ctx.user_id,
            metadata={"contact_id": contact_id, "key": fact.key},
        )
        await db.commit()
    return {"id": fact.id, "status": fact.status}
