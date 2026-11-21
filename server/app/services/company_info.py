"""Company Info — registration facts + editor facts → one managed, versioned knowledge item.

Ownership (one authoritative PostgreSQL value per fact; see docs/COMPANY-INFO-WORKFLOW.md):
  organizations      -> company_name (unless a public name is set), website, industry
  business_profiles  -> description, industries_served, offerings_summary, customer_types
  company_info_profiles.facts -> everything the Company Info editor owns
  company_info_profiles.share -> which shared facts the email AI may use

``refresh`` rebuilds the PUBLIC document (allowlist + share flags) and, when its content changed,
writes a new ACTIVE version of the managed knowledge item inside the CALLER'S transaction — no
remote I/O — so signup and every edit commit business data and the index intent atomically. After
commit, ``schedule_sync`` publishes vectors in the background; the durable sweep in app/main.py
re-syncs any version still not indexed (crash between commit and sync).
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

from fastapi import HTTPException, status
from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.contracts.company_info import (
    NOT_APPLICABLE_SECTIONS,
    SHARED_FIELDS,
    CompanyFacts,
    CompanyInfoUpdateRequest,
    SharedFactsUpdate,
)
from app.core.logging import logger
from app.models.knowledge import (
    KnowledgeItem,
    KnowledgeLifecycleStatus,
    KnowledgeSource,
    KnowledgeSourceStatus,
    KnowledgeSourceType,
    KnowledgeVersion,
    SourceAuthorityLevel,
)
from app.models.onboarding import BusinessProfile, CompanyInfoProfile, WorkspacePreferences
from app.models.organization import Organization

CATEGORY = "company_info"
MANAGED_KEY = "company_profile"          # knowledge_items.external_identity_key of the managed item
SOURCE_NAME = "Company profile"
DOC_SCHEMA_VERSION = 1
INDEX_DELAYED_AFTER = timedelta(minutes=2)

_BACKGROUND: Set[asyncio.Task] = set()

_PURPOSE_LABEL = {"general": "General enquiries", "sales": "Sales", "support": "Support", "booking": "Bookings",
                  "billing": "Billing & invoices", "other": "Other"}
_CHANNEL_LABEL = {"email": "Email", "phone": "Phone", "whatsapp": "WhatsApp", "form": "Contact form", "link": "Link"}
_VISIT_LABEL = {"walk_in": "Walk-ins welcome", "appointment_only": "By appointment only",
                "no_visits": "No walk-ins / not open to visitors"}
_MODE_LABEL = {"online": "Online", "in_person": "In person", "on_site": "On site at the customer's location",
               "hybrid": "Hybrid (online and in person)"}
_ENQUIRY_LABEL = {"booking": "Book an appointment", "demo": "Book a demo", "quote": "Request a quote", "other": "Enquiry"}
_BRANCH_KIND = {"office": "Office", "store": "Store", "warehouse": "Warehouse", "service_center": "Service centre",
                "factory": "Factory", "other": "Location"}


# ---------------------------------------------------------------------------------------------
# Pure functions: public document, hashing, projection text
# ---------------------------------------------------------------------------------------------


def _split_list(value: Optional[str]) -> List[str]:
    out: List[str] = []
    for part in (value or "").replace(";", ",").split(","):
        p = part.strip()
        if p and p not in out:
            out.append(p)
    return out


def shared_values(org: Optional[Organization], bp: Optional[BusinessProfile]) -> Dict[str, Any]:
    """Current values of the shared facts, read from their owners."""
    return {
        "company_name": (org.name if org else None) or None,
        "website": (org.website if org else None) or None,
        "industry": (org.industry if org else None) or None,
        "description": (bp.description if bp else None) or None,
        "industries_served": (bp.industry_served if bp else None) or None,
        "offerings_summary": (bp.products_services if bp else None) or None,
        "customer_types": _split_list(bp.customer_type if bp else None),
    }


def is_shared(share: Dict[str, bool], key: str) -> bool:
    return bool(share.get(key, True))


def build_public_document(shared: Dict[str, Any], facts: Dict[str, Any], share: Dict[str, bool]) -> Dict[str, Any]:
    """The ONLY data that reaches the index and the email AI. Deterministic, allowlisted."""
    f = CompanyFacts.model_validate(facts or {}).model_dump(mode="json")
    doc: Dict[str, Any] = {"schema_version": DOC_SCHEMA_VERSION}
    name = f.get("public_name") or (shared.get("company_name") if is_shared(share, "company_name") else None)
    if name:
        doc["company_name"] = name
    for key in ("website", "industry", "description", "industries_served", "offerings_summary"):
        if shared.get(key) and is_shared(share, key):
            doc[key] = shared[key]
    if shared.get("customer_types") and is_shared(share, "customer_types"):
        doc["customer_types"] = list(shared["customer_types"])
    for key in ("legal_name", "founded_year", "timezone", "holiday_note", "appointment_note",
                "coverage_note", "shipping_note"):
        if f.get(key) not in (None, ""):
            doc[key] = f[key]
    if f.get("visit_policy") and f["visit_policy"] != "unknown":
        doc["visit_policy"] = f["visit_policy"]
    for key in ("service_modes", "coverage_areas", "languages", "not_applicable"):
        if f.get(key):
            doc[key] = list(f[key])
    for key in ("hours", "contact_routes", "branches", "enquiry_links"):
        if f.get(key):
            doc[key] = [{k: v for k, v in rec.items() if v not in (None, "", [])} for rec in f[key]]
    return doc


def content_hash(doc: Dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(doc, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()


def _hours_line(h: Dict[str, Any]) -> str:
    when = "closed" if h.get("closed") else f"{h.get('open')}–{h.get('close')}"
    label = h.get("label") or {"opening": "Opening hours", "support": "Support hours"}.get(h.get("scope"), "Hours")
    line = f"{label}: {h.get('days')} {when}"
    return line + (f" ({h['note']})" if h.get("note") else "")


def _route_line(r: Dict[str, Any], branch_names: Dict[str, str]) -> str:
    who = r.get("label") or _PURPOSE_LABEL.get(r.get("purpose"), "Contact")
    line = f"{who} — {_CHANNEL_LABEL.get(r.get('channel'), 'Contact')}: {r.get('value')}"
    if r.get("branch_id") and r["branch_id"] in branch_names:
        line += f" ({branch_names[r['branch_id']]})"
    return line + (f". {r['note']}" if r.get("note") else "")


def project_sections(doc: Dict[str, Any]) -> List[Tuple[str, str]]:
    """Compact, deterministic sections. Each names the company and the fact so a chunk retrieved on
    its own is still self-describing. Section ids are stable (record ids for repeated records)."""
    company = doc.get("company_name") or "The company"
    branches = doc.get("branches") or []
    branch_names = {b["id"]: b.get("name") for b in branches if b.get("id")}
    na = set(doc.get("not_applicable") or [])
    out: List[Tuple[str, str]] = []

    lines = [f"Company: {company}"]
    for key, label in (("legal_name", "Legal name"), ("industry", "Industry"), ("founded_year", "Founded"),
                       ("website", "Website")):
        if doc.get(key):
            lines.append(f"{label}: {doc[key]}")
    if doc.get("description"):
        lines.append(f"About: {doc['description']}")
    out.append(("overview", "\n".join(lines)))

    if doc.get("offerings_summary"):
        out.append(("offerings", f"{company} — what we offer (overview): {doc['offerings_summary']}"))
    aud = []
    if doc.get("customer_types"):
        aud.append(f"Customers we serve: {', '.join(doc['customer_types'])}")
    if doc.get("industries_served"):
        aud.append(f"Industries we serve: {doc['industries_served']}")
    if aud:
        out.append(("audience", f"{company}\n" + "\n".join(aud)))

    routes = doc.get("contact_routes") or []
    for r in routes:
        out.append((f"contact:{r['id']}", f"{company} contact — {_route_line(r, branch_names)}"))
    if not routes and "contact_routes" in na:
        out.append(("contact:none", f"{company}: no public contact routes are published."))

    hours = [h for h in (doc.get("hours") or []) if not h.get("branch_id")]
    visit = []
    if doc.get("timezone"):
        visit.append(f"Time zone: {doc['timezone']}")
    visit += [_hours_line(h) for h in hours]
    if doc.get("visit_policy"):
        visit.append(f"Visits: {_VISIT_LABEL[doc['visit_policy']]}")
    if doc.get("appointment_note"):
        visit.append(f"Appointments: {doc['appointment_note']}")
    if doc.get("holiday_note"):
        visit.append(f"Holidays / exceptions: {doc['holiday_note']}")
    if visit:
        out.append(("hours", f"{company} — hours and visits\n" + "\n".join(visit)))

    for b in branches:
        bl = [f"{company} — {_BRANCH_KIND.get(b.get('kind'), 'Location')}: {b.get('name')}"]
        addr = ", ".join(x for x in (b.get("address"), b.get("city"), b.get("region"), b.get("postal_code"),
                                     b.get("country")) if x)
        if addr:
            bl.append(f"Address: {addr}")
        if b.get("map_url"):
            bl.append(f"Map: {b['map_url']}")
        if b.get("timezone"):
            bl.append(f"Time zone: {b['timezone']}")
        bl += [_hours_line(h) for h in (doc.get("hours") or []) if h.get("branch_id") == b.get("id")]
        if b.get("hours_note"):
            bl.append(f"Hours: {b['hours_note']}")
        if b.get("visit_policy") and b["visit_policy"] != "unknown":
            bl.append(f"Visits: {_VISIT_LABEL[b['visit_policy']]}")
        if b.get("pickup_note"):
            bl.append(f"Pickup: {b['pickup_note']}")
        bl += [_route_line(r, branch_names) for r in routes if r.get("branch_id") == b.get("id")]
        out.append((f"branch:{b['id']}", "\n".join(bl)))
    if not branches and "branches" in na:
        out.append(("branch:none", f"{company} has no public office or branch to visit."))

    cov = []
    if doc.get("service_modes"):
        cov.append("How we serve customers: " + ", ".join(_MODE_LABEL[m] for m in doc["service_modes"]))
    if doc.get("coverage_areas"):
        cov.append("Service coverage areas: " + ", ".join(doc["coverage_areas"]))
    if doc.get("coverage_note"):
        cov.append(f"Coverage notes: {doc['coverage_note']}")
    if doc.get("shipping_note"):
        cov.append(f"Shipping / delivery reach: {doc['shipping_note']}")
    if cov:
        out.append(("coverage", f"{company} — service coverage\n" + "\n".join(cov)))

    if doc.get("languages"):
        out.append(("languages", f"{company} can communicate with customers in: {', '.join(doc['languages'])}"))
    for lk in doc.get("enquiry_links") or []:
        label = lk.get("label") or _ENQUIRY_LABEL.get(lk.get("kind"), "Enquiry")
        out.append((f"link:{lk['id']}", f"{company} — {label}: {lk['url']}"))
    return out


def projection_text(doc: Dict[str, Any]) -> str:
    return "\n\n".join(t for _, t in project_sections(doc))


# ---------------------------------------------------------------------------------------------
# Database helpers (never commit; the caller owns the transaction)
# ---------------------------------------------------------------------------------------------


async def _lock_profile(db: AsyncSession, tenant_id: str) -> CompanyInfoProfile:
    """Row-lock the workspace's profile, creating it first if needed (safe under concurrency)."""
    await db.execute(text(
        "INSERT INTO company_info_profiles (tenant_id, revision, facts, share, created_at, updated_at) "
        "VALUES (:t, 0, '{}'::jsonb, '{}'::jsonb, now(), now()) ON CONFLICT (tenant_id) DO NOTHING"),
        {"t": tenant_id})
    return (await db.execute(
        select(CompanyInfoProfile).where(CompanyInfoProfile.tenant_id == tenant_id)
        .with_for_update().execution_options(populate_existing=True))).scalar_one()


async def _load_owners(db: AsyncSession, tenant_id: str):
    org = (await db.execute(select(Organization).where(Organization.id == tenant_id))).scalar_one_or_none()
    bp = (await db.execute(select(BusinessProfile).where(BusinessProfile.organization_id == tenant_id)
                           .limit(1))).scalar_one_or_none()
    return org, bp


async def _ensure_source(db: AsyncSession, tenant_id: str, user_id: Optional[str]) -> KnowledgeSource:
    src = (await db.execute(select(KnowledgeSource).where(
        KnowledgeSource.tenant_id == tenant_id, KnowledgeSource.name == SOURCE_NAME,
        KnowledgeSource.status == KnowledgeSourceStatus.ACTIVE.value,
    ).limit(1))).scalar_one_or_none()
    if src is None:
        now = datetime.now(timezone.utc)
        src = KnowledgeSource(
            id=f"ks_{uuid.uuid4().hex}", tenant_id=tenant_id, source_type=KnowledgeSourceType.MANUAL.value,
            name=SOURCE_NAME, authority_level=SourceAuthorityLevel.BUSINESS_PROFILE.value,
            status=KnowledgeSourceStatus.ACTIVE.value, created_by_user_id=user_id, created_at=now, updated_at=now)
        db.add(src)
        await db.flush()
    return src


async def managed_item(db: AsyncSession, tenant_id: str, lock: bool = False) -> Optional[KnowledgeItem]:
    stmt = select(KnowledgeItem).where(KnowledgeItem.tenant_id == tenant_id, KnowledgeItem.category == CATEGORY,
                                       KnowledgeItem.external_identity_key == MANAGED_KEY)
    if lock:
        stmt = stmt.with_for_update()
    return (await db.execute(stmt)).scalar_one_or_none()


def is_managed(item: Optional[KnowledgeItem]) -> bool:
    return bool(item is not None and item.category == CATEGORY and item.external_identity_key == MANAGED_KEY)


async def refresh(db: AsyncSession, tenant_id: str, user_id: Optional[str] = None,
                  reason: str = "refresh") -> Optional[Tuple[KnowledgeItem, KnowledgeVersion]]:
    """Rebuild the public document; write a new ACTIVE version only if it changed. No commit."""
    profile = await _lock_profile(db, tenant_id)
    org, bp = await _load_owners(db, tenant_id)
    if org is None:
        return None
    doc = build_public_document(shared_values(org, bp), profile.facts or {}, profile.share or {})
    digest = content_hash(doc)
    item = await managed_item(db, tenant_id, lock=True)
    current = None
    if item is not None and item.current_version_id:
        current = await db.get(KnowledgeVersion, item.current_version_id)
    if (item is not None and item.is_active and current is not None
            and current.status == KnowledgeLifecycleStatus.ACTIVE.value
            and (current.canonical_data or {}).get("_content_hash") == digest):
        if profile.content_hash != digest:
            profile.content_hash = digest
        return None                                            # no-op: nothing to version or embed

    source = await _ensure_source(db, tenant_id, user_id)
    title = doc.get("company_name") or "Company profile"
    now = datetime.now(timezone.utc)
    if item is None:
        item = KnowledgeItem(
            tenant_id=tenant_id, title=title[:512], category=CATEGORY, description=(doc.get("description") or "")[:500] or None,
            source_id=source.id, source_type=source.source_type, external_identity_key=MANAGED_KEY,
            is_active=True, created_by_user_id=user_id)
        db.add(item)
        await db.flush()
        next_no = 1
    else:
        item.title = title[:512]
        item.description = (doc.get("description") or "")[:500] or None
        item.is_active = True
        next_no = int((await db.execute(text(
            "SELECT COALESCE(MAX(version_number), 0) + 1 FROM knowledge_versions WHERE knowledge_item_id = :i"),
            {"i": item.id})).scalar())
        # The previous generation is superseded: archive it so no reader can serve a revoked fact.
        await db.execute(update(KnowledgeVersion).where(
            KnowledgeVersion.knowledge_item_id == item.id,
            KnowledgeVersion.status == KnowledgeLifecycleStatus.ACTIVE.value,
        ).values(status=KnowledgeLifecycleStatus.ARCHIVED.value, effective_until=now))

    version = KnowledgeVersion(
        tenant_id=tenant_id, knowledge_item_id=item.id, version_number=next_no,
        status=KnowledgeLifecycleStatus.ACTIVE.value, source_id=source.id,
        authority_level=SourceAuthorityLevel.BUSINESS_PROFILE.value,
        content_text=projection_text(doc), change_summary=f"Company Info {reason}",
        canonical_data={**doc, "_content_hash": digest}, projection_status="pending", semantic_status="pending",
        published_at=now, effective_from=now, created_by_user_id=user_id)
    db.add(version)
    await db.flush()
    item.current_version_id = version.id
    profile.content_hash = digest
    profile.knowledge_item_id = item.id
    profile.revision = (profile.revision or 0) + 1
    profile.updated_at = now
    if user_id:
        profile.updated_by_user_id = user_id
    return item, version


def schedule_sync(tenant_id: str, item: Optional[KnowledgeItem], version: Optional[KnowledgeVersion],
                  reason: str = "updated") -> None:
    """Publish vectors after commit without making the caller wait (signup never waits on Qdrant).
    If the process stops first, the durable sweep (app/main.py) re-syncs the pending version."""
    if item is None:
        return
    from app.services.knowledge_sync import knowledge_sync_service

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    task = loop.create_task(knowledge_sync_service.sync_after_commit(
        tenant_id=tenant_id, item_id=item.id, reason=reason, version_id=version.id if version else None,
        item=item, version=version))
    _BACKGROUND.add(task)
    task.add_done_callback(_BACKGROUND.discard)


async def refresh_after_owner_change(db: AsyncSession, tenant_id: str, user_id: Optional[str], reason: str):
    """Hook for organization / business-profile writes. Never breaks the caller: a projection
    problem is logged and repaired by the next save or the backfill."""
    try:
        async with db.begin_nested():
            return await refresh(db, tenant_id, user_id, reason)
    except Exception as err:  # noqa: BLE001
        logger.warning("company_info.refresh_failed", tenant_id=tenant_id, reason=reason, error=type(err).__name__)
        return None


# ---------------------------------------------------------------------------------------------
# Editor read / save
# ---------------------------------------------------------------------------------------------


def _index_status(version: Optional[KnowledgeVersion]) -> Dict[str, Any]:
    if version is None:
        return {"state": "not_published", "version_number": None, "saved_at": None}
    saved = version.created_at or version.published_at
    if version.semantic_status == "synced":
        state = "ready"
    elif saved and datetime.now(timezone.utc) - (saved if saved.tzinfo else saved.replace(tzinfo=timezone.utc)) > INDEX_DELAYED_AFTER:
        state = "delayed"
    else:
        state = "indexing"
    return {"state": state, "version_number": version.version_number,
            "saved_at": saved.isoformat() if saved else None,
            "indexed_at": version.last_projected_at.isoformat() if getattr(version, "last_projected_at", None) else None}


async def get_state(db: AsyncSession, tenant_id: str, perms: Set[str]) -> Dict[str, Any]:
    profile = (await db.execute(select(CompanyInfoProfile).where(CompanyInfoProfile.tenant_id == tenant_id)
                                .execution_options(populate_existing=True))).scalar_one_or_none()
    org, bp = await _load_owners(db, tenant_id)
    wp = (await db.execute(select(WorkspacePreferences).where(WorkspacePreferences.organization_id == tenant_id)
                           .limit(1))).scalar_one_or_none()
    facts = CompanyFacts.model_validate((profile.facts if profile else None) or {}).model_dump(mode="json")
    share = (profile.share if profile else None) or {}
    shared = shared_values(org, bp)
    item = await managed_item(db, tenant_id)
    version = await db.get(KnowledgeVersion, item.current_version_id) if item and item.current_version_id else None
    doc = build_public_document(shared, facts, share)
    legacy = (await db.execute(text(
        "SELECT count(*) FROM knowledge_items WHERE tenant_id = :t AND category = :c AND is_active "
        "AND (external_identity_key IS DISTINCT FROM :k)"), {"t": tenant_id, "c": CATEGORY, "k": MANAGED_KEY})).scalar()
    suggestions: Dict[str, Any] = {}
    if wp and not facts.get("timezone"):
        suggestions["timezone"] = {"value": wp.timezone, "from": "Workspace settings (AI time zone)"}
    if wp and not facts.get("languages") and wp.language:
        suggestions["languages"] = {"value": [wp.language], "from": "Workspace settings (AI reply language)"}
    owners = {"company_name": "organization", "website": "organization", "industry": "organization",
              "description": "business_profile", "industries_served": "business_profile",
              "offerings_summary": "business_profile", "customer_types": "business_profile"}
    return {
        "revision": profile.revision if profile else 0,
        "permissions": {"edit_company_facts": "knowledge.update" in perms,
                        "edit_shared_facts": "organization.update" in perms},
        "shared": {k: {"value": shared[k], "owner": owners[k], "shared": is_shared(share, k)} for k in SHARED_FIELDS},
        "facts": facts,
        "not_applicable_sections": list(NOT_APPLICABLE_SECTIONS),
        "suggestions": suggestions,
        "ai_can_share": [{"section": sid, "text": txt} for sid, txt in project_sections(doc)],
        "index": _index_status(version),
        "legacy_items": int(legacy or 0),
    }


async def save(db: AsyncSession, tenant_id: str, user_id: str, payload: CompanyInfoUpdateRequest,
               perms: Set[str]) -> Dict[str, Any]:
    from app.models.audit import AuditAction
    from app.services.audit import audit_service

    shared_set = payload.shared.model_fields_set if payload.shared else set()
    if (payload.facts or payload.share) and "knowledge.update" not in perms:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You don't have permission to edit Company Info.")
    if shared_set and "organization.update" not in perms:
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            "Only workspace owners and admins can change the company name, website, industry or "
                            "business description.")

    profile = await _lock_profile(db, tenant_id)
    if payload.revision != (profile.revision or 0):
        raise HTTPException(status.HTTP_409_CONFLICT, {
            "message": "Company Info was changed by someone else. Your edits are kept — review the latest "
                       "values and save again.",
            "current": await get_state(db, tenant_id, perms)})

    changed: List[str] = []
    org, bp = await _load_owners(db, tenant_id)
    if shared_set:
        upd: SharedFactsUpdate = payload.shared
        for key in shared_set:
            value = getattr(upd, key)
            if key in ("company_name", "description", "offerings_summary") and not value:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                                    f"{key.replace('_', ' ').capitalize()} cannot be empty — hide it from customers instead.")
        if org is not None:
            for key, attr in (("company_name", "name"), ("website", "website"), ("industry", "industry")):
                if key in shared_set and getattr(upd, key) != getattr(org, attr):
                    setattr(org, attr, getattr(upd, key))
                    changed.append(key)
        bp_keys = {"description": "description", "industries_served": "industry_served",
                   "offerings_summary": "products_services"}
        if shared_set & (set(bp_keys) | {"customer_types"}):
            if bp is None:
                bp = BusinessProfile(id=f"bp_{uuid.uuid4().hex}", organization_id=tenant_id,
                                     description=upd.description or "", products_services=upd.offerings_summary or "")
                db.add(bp)
            for key, attr in bp_keys.items():
                if key in shared_set and getattr(upd, key) != getattr(bp, attr):
                    setattr(bp, attr, getattr(upd, key))
                    changed.append(key)
            if "customer_types" in shared_set:
                joined = ", ".join(upd.customer_types or []) or None
                if joined != bp.customer_type:
                    bp.customer_type = joined
                    changed.append("customer_types")

    if payload.facts is not None:
        merged = {**(profile.facts or {}), **payload.facts}
        validated = CompanyFacts.model_validate(merged).model_dump(mode="json")
        if validated != (profile.facts or {}):
            changed += sorted(k for k in payload.facts if validated.get(k) != (profile.facts or {}).get(k))
            profile.facts = validated
    if payload.share is not None:
        new_share = {**(profile.share or {}), **payload.share}
        if new_share != (profile.share or {}):
            changed += [f"share.{k}" for k in payload.share if (profile.share or {}).get(k, True) != payload.share[k]]
            profile.share = new_share

    if not changed:
        return {**await get_state(db, tenant_id, perms), "saved": False}

    profile.revision = (profile.revision or 0) + 1
    profile.updated_by_user_id = user_id
    # The session does not autoflush: write the edits before refresh() re-reads the locked row.
    await db.flush()
    result = await refresh(db, tenant_id, user_id, "edited")
    await audit_service.record(
        db=db, action=AuditAction.KNOWLEDGE_UPDATED, resource_type="company_info", resource_id=tenant_id,
        organization_id=tenant_id, actor_user_id=user_id,
        metadata={"changed_fields": changed[:50], "revision": profile.revision},   # field names only, no values
    )
    await db.commit()
    if result:
        schedule_sync(tenant_id, *result)
    try:
        from app.services.onboarding import onboarding_service
        await onboarding_service.invalidate_cache(user_id, tenant_id)
    except Exception:  # noqa: BLE001
        pass
    return {**await get_state(db, tenant_id, perms), "saved": True}


async def backfill(db_factory, dry_run: bool = True, limit: int = 500, tenant_id: Optional[str] = None) -> Dict[str, Any]:
    """Idempotent, bounded backfill: create/refresh the managed item for workspaces that lack it.
    Never touches manual Company Info items; reports workspaces that also have legacy items."""
    report: Dict[str, Any] = {"dry_run": dry_run, "scanned": 0, "created_or_updated": 0, "unchanged": 0,
                              "with_legacy_items": [], "errors": 0}
    async with db_factory() as db:
        q = "SELECT id FROM organizations WHERE is_active"
        params: Dict[str, Any] = {}
        if tenant_id:
            q += " AND id = :t"
            params["t"] = tenant_id
        ids = [r[0] for r in (await db.execute(text(q + " ORDER BY created_at LIMIT :n"), {**params, "n": limit})).all()]
    for org_id in ids:
        report["scanned"] += 1
        async with db_factory() as db:
            try:
                legacy = (await db.execute(text(
                    "SELECT count(*) FROM knowledge_items WHERE tenant_id = :t AND category = :c AND is_active "
                    "AND (external_identity_key IS DISTINCT FROM :k)"), {"t": org_id, "c": CATEGORY, "k": MANAGED_KEY})).scalar()
                if legacy:
                    report["with_legacy_items"].append({"tenant_id": org_id, "legacy_items": int(legacy)})
                res = await refresh(db, org_id, None, "backfill")
                if res is None:
                    report["unchanged"] += 1
                    await db.rollback()
                    continue
                report["created_or_updated"] += 1
                if dry_run:
                    await db.rollback()
                else:
                    await db.commit()
                    # A batch job awaits the sync (never raises; on failure it queues a retry event and
                    # the periodic sweep re-syncs it) instead of fire-and-forget, which dies with the process.
                    from app.services.knowledge_sync import knowledge_sync_service
                    await knowledge_sync_service.sync_after_commit(
                        tenant_id=org_id, item_id=res[0].id, reason="created", version_id=res[1].id,
                        item=res[0], version=res[1])
            except Exception as err:  # noqa: BLE001
                report["errors"] += 1
                await db.rollback()
                logger.warning("company_info.backfill_failed", tenant_id=org_id, error=type(err).__name__)
    return report
