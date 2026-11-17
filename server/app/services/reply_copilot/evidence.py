"""Copilot evidence: reuse what the conversation already established, retrieve only what is missing.

L1  Context records  - items already in this conversation (codes in the draft / customer message,
                       items shown in earlier replies) are RE-READ at their current version by exact
                       code (B-tree, O(k log n)). Reuse never serves a stale value: the record is read
                       now, not copied from an old package.
L2  Exact cache      - a fact request answered through retrieval is cached in Redis under an identity
                       key (tenant, thread, thread context revision, catalogue revision, algorithm
                       version, normalised request). Different budgets / sizes / codes are different
                       keys. On a hit every cached fact's version is re-checked against the current
                       version in PostgreSQL (one batch query); any change => miss.
L3  Primary retrieval - the EXISTING pipeline: requirement planner -> retrieval router (indexed
                       PostgreSQL + Qdrant HNSW + keyword) -> evidence fusion (hard constraints) ->
                       Minimal Evidence Package. No second RAG engine.

There is no semantic (similar-wording) cache: a similar question can concern a different product,
budget or size, and the indexed primary retrieval is already fast (see the report), so the risk is
not worth the saving.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import re
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from sqlalchemy import text

from app.core.logging import logger
from app.services.reply_copilot.contracts import CopilotFact, EvidenceSet, EvidenceSource, FactRequest

CACHE_VERSION = "cpv1"
CACHE_TTL_S = 600
MAX_CONTEXT_ITEMS = 12
MAX_FIELDS_PER_ITEM = 30
_REV_KEY = "copilot:catrev:{tenant}"

_SKIP_KEYS = re.compile(r"(^|_)(id|ids|uuid|embedding|vector|hash|checksum|raw|source_row|row_number|created|updated|"
                        r"imported|version|tenant)($|_)", re.IGNORECASE)


# ---------------------------------------------------------------------------
# Thread snapshot (read-only; never persists or locks the thread)
# ---------------------------------------------------------------------------

@dataclass
class ThreadSnapshot:
    thread_id: str
    integration_account_id: str
    provider_thread_id: str
    context_revision: int
    subject: str
    messages: List[Dict[str, Any]] = field(default_factory=list)      # oldest -> newest
    latest_inbound: Optional[Dict[str, Any]] = None
    presented: List[Tuple[str, Optional[str], Optional[str]]] = field(default_factory=list)  # (entity_id, code, title)


async def load_thread(db, tenant_id: str, thread_id: str, max_messages: int = 8) -> Optional[ThreadSnapshot]:
    """Tenant-scoped snapshot of one conversation. None when the thread is not this tenant's."""
    th = (await db.execute(text("""
        SELECT id, integration_account_id, external_thread_id, coalesce(context_revision, 1) AS rev, subject
        FROM email_threads WHERE id = :th AND tenant_id = :t"""), {"th": thread_id, "t": tenant_id})).mappings().first()
    if not th:
        return None
    msgs_q = db.execute(text("""
        SELECT id, external_message_id, direction, from_email, from_name, body_text, sent_at
        FROM email_messages
        WHERE tenant_id = :t AND thread_id = :th
          AND (direction = 'outbound' OR coalesce(filter_reason, 'BUSINESS_CONVERSATION')
               IN ('BUSINESS_CONVERSATION', 'AMBIGUOUS', 'ACCEPT'))
        ORDER BY sent_at DESC NULLS LAST LIMIT :n"""), {"t": tenant_id, "th": thread_id, "n": max_messages})
    rows = list((await msgs_q).mappings().all())[::-1]
    shown = (await db.execute(text("""
        SELECT entity_id, external_identity_key, entity_title FROM thread_presented_entities
        WHERE tenant_id = :t AND thread_id = :th ORDER BY presented_at DESC LIMIT :n"""),
        {"t": tenant_id, "th": thread_id, "n": MAX_CONTEXT_ITEMS})).all()
    msgs = [dict(r) for r in rows]
    inbound = [m for m in msgs if m["direction"] == "inbound"]
    return ThreadSnapshot(thread_id=th["id"], integration_account_id=th["integration_account_id"],
                          provider_thread_id=th["external_thread_id"] or th["id"], context_revision=int(th["rev"]),
                          subject=th["subject"] or "", messages=msgs, latest_inbound=inbound[-1] if inbound else None,
                          presented=[(r[0], r[1], r[2]) for r in shown])


# ---------------------------------------------------------------------------
# L1: context records (current versions, exact code / id lookups)
# ---------------------------------------------------------------------------

def _price(cd: Dict[str, Any]) -> Optional[str]:
    from app.services.knowledge_search_index import _price as price_of
    p = price_of(cd or {})
    return f"{p:.2f}" if p is not None else None


def _flatten(cd: Dict[str, Any], prefix: str = "", depth: int = 0) -> Iterable[Tuple[str, str]]:
    for k, v in (cd or {}).items():
        key = f"{prefix}{k}"
        if _SKIP_KEYS.search(str(k)):
            continue
        if isinstance(v, dict) and depth < 1:
            yield from _flatten(v, f"{key}.", depth + 1)
        elif isinstance(v, (str, int, float)) and not isinstance(v, bool):
            s = str(v).strip()
            if s and s.lower() not in ("nan", "none", "null", "-", "n/a"):
                yield key, s[:200]


def record_facts(item_id: str, code: Optional[str], title: Optional[str], version_id: Optional[str],
                 cd: Dict[str, Any], source: EvidenceSource) -> List[CopilotFact]:
    """Compact, attribute-level facts of one current catalogue record (pure)."""
    facts: List[CopilotFact] = []
    base: Dict[str, Any] = dict(entity_id=item_id, entity_code=code, entity_title=title, source=source,
                                version_id=version_id)
    price = _price(cd)
    if price is not None:
        facts.append(CopilotFact(fact_id=f"{code or item_id}:price", attribute="price", value=price, **base))
    seen = {"price"}
    for key, val in _flatten(cd):
        leaf = key.split(".")[-1].lower()
        if leaf in seen or "price" in leaf or leaf in ("mrp", "base_price", "final_price", "estimated_total"):
            continue
        seen.add(leaf)
        facts.append(CopilotFact(fact_id=f"{code or item_id}:{leaf}", attribute=leaf, value=val, **base))
        if len(facts) >= MAX_FIELDS_PER_ITEM:
            break
    return facts


async def _ids_for_codes(db, tenant_id: str, codes: Sequence[str]) -> Dict[str, str]:
    if not codes:
        return {}
    from app.services import knowledge_search_index as ksi
    if await ksi.is_available(db, tenant_id):
        rows = (await db.execute(text("""SELECT knowledge_item_id, code_upper FROM knowledge_search_index
            WHERE tenant_id = :t AND code_upper = ANY(:c)"""), {"t": tenant_id, "c": list(codes)})).all()
    else:
        rows = (await db.execute(text("""SELECT id, upper(external_identity_key) FROM knowledge_items
            WHERE tenant_id = :t AND is_active AND upper(external_identity_key) = ANY(:c)"""),
            {"t": tenant_id, "c": list(codes)})).all()
    return {r[0]: r[1] for r in rows}


async def context_records(db, tenant_id: str, codes: Sequence[str], entity_ids: Sequence[str]
                          ) -> Tuple[Dict[str, List[CopilotFact]], List[str]]:
    """Current facts per code for items in context; returns (facts_by_code, codes_not_found)."""
    from app.services.knowledge_read_contract import CanonicalKnowledgeReader

    codes = [c.upper() for c in codes][:MAX_CONTEXT_ITEMS]
    by_code = await _ids_for_codes(db, tenant_id, codes)
    ids = list(dict.fromkeys(list(by_code) + list(entity_ids)))[:MAX_CONTEXT_ITEMS * 2]
    batch = await CanonicalKnowledgeReader.get_current_items_batch(db, tenant_id, ids)
    out: Dict[str, List[CopilotFact]] = {}
    for item_id, (item, ver) in batch.items():
        code = (getattr(item, "external_identity_key", None) or by_code.get(item_id) or "").upper() or None
        cd = getattr(ver, "canonical_data", None) or {}
        out[code or item_id] = record_facts(item_id, code, getattr(item, "title", None), getattr(ver, "id", None),
                                            cd if isinstance(cd, dict) else {}, EvidenceSource.CONTEXT_RECORD)
    missing = [c for c in codes if c not in out]
    return out, missing


_PRICE_WORDS = {"price", "prices", "cost", "rate", "rates", "mrp", "pricing", "quote", "quotation"}
_GENERIC_WORDS = {"spec", "specs", "specification", "specifications", "details", "detail", "features", "info",
                  "information", "description"}


def covers(facts: Sequence[CopilotFact], attributes: Sequence[str]) -> bool:
    """True when every requested attribute is present in the records (generic name matching)."""
    names = [f.attribute.lower().replace(" ", "_") for f in facts]
    if not names:
        return False
    for raw in attributes:
        a = raw.lower().strip().replace(" ", "_")
        if not a or a in _GENERIC_WORDS:
            continue
        target = "price" if a in _PRICE_WORDS else a
        if not any(target in n or (len(n) >= 4 and n in target) for n in names):
            return False
    return True


# ---------------------------------------------------------------------------
# L2: exact identity cache (catalogue revision + per-fact version re-check)
# ---------------------------------------------------------------------------

def _redis():
    try:
        from app.core.redis import redis_manager
        return redis_manager.client
    except Exception:  # noqa: BLE001 - cache is optional
        return None


async def catalogue_revision(tenant_id: str) -> str:
    r = _redis()
    if r is None:
        return "na"
    try:
        v = await r.get(_REV_KEY.format(tenant=tenant_id))
        return (v.decode() if isinstance(v, bytes) else str(v)) if v is not None else "0"
    except Exception:  # noqa: BLE001
        return "na"


def bump_catalogue_revision(tenant_id: str) -> None:
    """Called whenever the tenant's knowledge changes (manual edit or import). Never raises."""
    async def _bump():
        r = _redis()
        if r is not None:
            try:
                await r.incr(_REV_KEY.format(tenant=tenant_id))
            except Exception:  # noqa: BLE001
                pass
    try:
        asyncio.get_running_loop().create_task(_bump())
    except RuntimeError:
        pass


def normalise_request(req: FactRequest) -> str:
    q = re.sub(r"\s+", " ", req.request.strip().lower())
    return json.dumps({"q": q, "a": sorted(req.attributes), "c": sorted(req.entity_codes)}, sort_keys=True)


def cache_key(tenant_id: str, thread_id: str, context_revision: int, cat_rev: str, req: FactRequest) -> str:
    digest = hashlib.sha256(normalise_request(req).encode()).hexdigest()[:32]
    return f"copilot:ev:{CACHE_VERSION}:{tenant_id}:{thread_id}:{context_revision}:{cat_rev}:{digest}"


async def cache_get(key: str) -> Optional[EvidenceSet]:
    r = _redis()
    if r is None or ":na:" in key:
        return None
    try:
        raw = await r.get(key)
        return EvidenceSet.model_validate_json(raw) if raw else None
    except Exception:  # noqa: BLE001
        return None


async def cache_put(key: str, ev: EvidenceSet) -> None:
    r = _redis()
    if r is None or ":na:" in key:
        return
    try:
        await r.set(key, ev.model_dump_json(), ex=CACHE_TTL_S)
    except Exception:  # noqa: BLE001
        pass


async def versions_still_current(db, tenant_id: str, facts: Sequence[CopilotFact]) -> bool:
    """Every cached fact's source version is still the item's current version (one batch query)."""
    from app.services.knowledge_read_contract import CanonicalKnowledgeReader

    pinned = {f.entity_id: f.version_id for f in facts if f.entity_id and f.version_id}
    if not pinned:
        return True
    batch = await CanonicalKnowledgeReader.get_current_items_batch(db, tenant_id, list(pinned))
    return all(eid in batch and getattr(batch[eid][1], "id", None) == vid for eid, vid in pinned.items())


# ---------------------------------------------------------------------------
# L3: primary retrieval through the existing pipeline
# ---------------------------------------------------------------------------

def _package_to_evidence(package: Any) -> EvidenceSet:
    ev = EvidenceSet(sources_used=[EvidenceSource.RETRIEVAL.value])
    for req in getattr(package, "requirements", None) or []:
        for f in getattr(req, "facts", None) or []:
            val = getattr(f, "typed_value", None)
            if val in (None, ""):
                continue
            ev.facts.append(CopilotFact(
                fact_id=getattr(f, "fact_id", None) or f"fct_{uuid.uuid4().hex[:8]}",
                entity_id=getattr(f, "entity_id", None), entity_code=getattr(f, "external_identity_key", None),
                entity_title=getattr(f, "entity_title", None), attribute=str(getattr(f, "attribute_name", "") or ""),
                value=str(val)[:300], source=EvidenceSource.RETRIEVAL,
                authority=str(getattr(f, "authority_level", "verified_canonical") or "verified_canonical"),
                version_id=getattr(f, "source_version_id", None)))
        for sig in getattr(req, "missing_signals", None) or []:
            reason = str(getattr(sig, "reason", "") or "").strip()
            if reason and reason not in ev.unresolved:
                ev.unresolved.append(reason[:300])
    ev.unknown_codes = list(getattr(package, "unknown_identifiers", None) or [])[:5]
    ev.search_incomplete = bool(getattr(package, "search_incomplete", False))
    return ev


_ATTR_GAP = re.compile(r"Attribute '([^']+)'", re.IGNORECASE)


def relevant_gaps(gaps: Sequence[str], attributes: Sequence[str]) -> List[str]:
    """Keep only gaps about what THIS request asked for. The planner also sees the thread, so it may add
    attributes from the customer's earlier questions ("features", "warranty") that the employee did not ask
    about; reporting those as gaps is noise."""
    wanted = [a.lower().replace(" ", "_") for a in attributes if a]
    out: List[str] = []
    for g in gaps:
        m = _ATTR_GAP.search(g)
        if m is None:
            out.append(g)
            continue
        name = m.group(1).lower().replace(" ", "_")
        if any(w in name or name in w for w in wanted):
            out.append(g)
    return out


async def retrieve(tenant_id: str, snap: ThreadSnapshot, req: FactRequest) -> Tuple[EvidenceSet, Dict[str, Any]]:
    """Run the existing planner -> retrieval -> fusion -> package chain for one fact request."""
    from app.services.context_resolver import ContextEnvelope, ContextMessage
    from app.services.evidence_fusion import evidence_fusion_service
    from app.services.evidence_package import evidence_package_service
    from app.services.requirement_planner import requirement_planner_service
    from app.services.retrieval_router import retrieval_router_service

    t0 = time.perf_counter()
    now = datetime.now(timezone.utc).isoformat()
    prev = [ContextMessage(id=m["id"], external_message_id=m["external_message_id"] or m["id"],
                           direction=m["direction"], from_email=m["from_email"] or "", from_name=m.get("from_name"),
                           subject=snap.subject, body_text=(m["body_text"] or "")[:4000],
                           sent_at=m["sent_at"].isoformat() if m.get("sent_at") else None)
            for m in snap.messages]
    cur_id = f"copilot_{uuid.uuid4().hex[:12]}"
    customer = (snap.latest_inbound or {}).get("from_email") or "customer"
    cur = ContextMessage(id=cur_id, external_message_id=cur_id, direction="inbound", from_email=customer,
                         subject=snap.subject, body_text=req.request, sent_at=now)
    env = ContextEnvelope(tenant_id=tenant_id, integration_account_id=snap.integration_account_id,
                          provider_thread_id=snap.provider_thread_id, thread_id=snap.thread_id,
                          current_message_id=cur_id, context_revision=snap.context_revision, current_message=cur,
                          relevant_previous_messages=prev,
                          previously_presented_entity_ids=[p[0] for p in snap.presented])
    plan = await requirement_planner_service.plan_requirements(envelope=env, dispatch_event=False)
    t1 = time.perf_counter()
    ret = await retrieval_router_service.route_and_retrieve(tenant_id=tenant_id, plan=plan, dispatch_event=False)
    t2 = time.perf_counter()
    fusion = await evidence_fusion_service.fuse_and_verify(tenant_id=tenant_id, plan=plan, retrieval_result=ret,
                                                           dispatch_event=False)
    package = await evidence_package_service.build_package(tenant_id=tenant_id, fusion_result=fusion, envelope=env,
                                                           plan=plan, dispatch_event=False)
    ev = _package_to_evidence(package)
    ev.unresolved = relevant_gaps(ev.unresolved, req.attributes)
    if plan.clarification_required and plan.clarification_reason and not ev.facts:
        ev.unresolved.append(str(plan.clarification_reason)[:300])
    metrics = {"planner_ms": round((t1 - t0) * 1000, 1), "retrieval_ms": round((t2 - t1) * 1000, 1),
               "fusion_package_ms": round((time.perf_counter() - t2) * 1000, 1),
               "retrieval_status": getattr(ret.status, "value", str(ret.status)),
               "search_exhaustive": ret.search_exhaustive, "candidates_matching": ret.candidates_matching}
    return ev, metrics


async def resolve_request(db, tenant_id: str, snap: ThreadSnapshot, req: FactRequest,
                          context_facts: Dict[str, List[CopilotFact]]) -> Tuple[EvidenceSet, Dict[str, Any]]:
    """L1 -> L2 -> L3 for one fact request. Deterministic and observable (``level`` in metrics)."""
    # L1: every referenced code is a context record with the requested attributes.
    codes = [c.upper() for c in req.entity_codes] or (list(context_facts) if req.about_context_items else [])
    if codes and all(c in context_facts for c in codes):
        facts = [f for c in codes for f in context_facts[c]]
        if covers(facts, req.attributes):
            return EvidenceSet(facts=facts, sources_used=[EvidenceSource.CONTEXT_RECORD.value]), {"level": "L1_reuse"}
    # L2: exact identity cache, then version re-check.
    key = cache_key(tenant_id, snap.thread_id, snap.context_revision, await catalogue_revision(tenant_id), req)
    hit = await cache_get(key)
    if hit is not None and await versions_still_current(db, tenant_id, hit.facts):
        for f in hit.facts:
            f.source = EvidenceSource.CACHE
        hit.sources_used = [EvidenceSource.CACHE.value]
        return hit, {"level": "L2_cache_hit"}
    # L3: primary retrieval.
    try:
        ev, m = await retrieve(tenant_id, snap, req)
    except Exception as exc:  # noqa: BLE001 - an unavailable source is reported, never turned into "does not exist"
        logger.warning("copilot retrieval failed", tenant_id=tenant_id, error=f"{type(exc).__name__}: {str(exc)[:200]}")
        return EvidenceSet(unresolved=[f"Could not search the catalogue right now for: {req.request[:120]}"],
                           search_incomplete=True), {"level": "L3_error"}
    if not ev.search_incomplete and (ev.facts or ev.unknown_codes):
        await cache_put(key, ev)
    m["level"] = "L3_retrieval"
    m["cache"] = "miss" if hit is None else "stale"
    return ev, m
