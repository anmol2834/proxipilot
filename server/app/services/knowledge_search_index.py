"""Indexed retrieval projection (``knowledge_search_index``) for very large catalogues.

Why: at 1 lakh+ items, filtering by product family, item role, size or price inside Python after
fetching a fixed window (150 rows, top-K vectors) silently misses records outside that window, and
the regex scans over every item's JSON are O(n) per query. Here every hard constraint is a real,
indexed column, so it is evaluated by PostgreSQL over the WHOLE catalogue with index lookups
(B-tree O(log n + k), GIN posting lists), and progressive retrieval pages through matches in index
order until they are exhausted or the configured budget is reached.

Facets are derived with the SAME classifiers retrieval uses (family label, item role, sizes), so the
index and the live eligibility rules always agree. Nothing here is business-specific.
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from sqlalchemy import text

from app.core.database import db_manager
from app.core.logging import logger

UPSERT_BATCH = 500
_PRESENCE_TTL_S = 60.0
_presence: Dict[str, Tuple[float, bool]] = {}


@dataclass
class Facets:
    item_id: str
    tenant_id: str
    category: Optional[str]
    family: Optional[str]
    product_type: Optional[str]
    item_role: Optional[str]
    brand: Optional[str]
    code_upper: Optional[str]
    title: str
    price: Optional[Decimal]
    volume_ml: Optional[float]
    weight_g: Optional[float]
    power_w: Optional[float]
    search_text: str


def _price(cd: Dict[str, Any]) -> Optional[Decimal]:
    raw_pricing = cd.get("pricing")
    pricing: Dict[str, Any] = raw_pricing if isinstance(raw_pricing, dict) else {}
    for v in (pricing.get("base_price"), pricing.get("estimated_total"), cd.get("final_price"), cd.get("price"),
              cd.get("base_price"), cd.get("mrp")):
        try:
            if v not in (None, "") and Decimal(str(v)) > 0:
                return Decimal(str(v)).quantize(Decimal("0.01"))
        except (InvalidOperation, ValueError):
            continue
    return None


def compute_facets(item_id: str, tenant_id: str, category: Optional[str], title: Optional[str],
                   external_key: Optional[str], cd: Optional[Dict[str, Any]]) -> Facets:
    """Pure: facets of one item from its current canonical data."""
    from app.services.retrieval_router.entity_eligibility import classify_candidate, family_label
    from app.services.units import parse_quantities

    cd = cd or {}
    raw_ca = cd.get("custom_attributes")
    ca: Dict[str, Any] = raw_ca if isinstance(raw_ca, dict) else {}
    src_cat = ca.get("category") or cd.get("sub_category") or cd.get("category")
    ptype = ca.get("product_type") or cd.get("product_type")
    name = title or cd.get("name") or cd.get("product_name") or ""
    fam = family_label(str(src_cat)) if src_cat else ""
    role = classify_candidate(cd, name).role
    sizes: Dict[str, float] = {}
    for q in parse_quantities(str(name)):
        sizes.setdefault(q.kind, q.value)
    code = (external_key or cd.get("sku") or "").strip().upper() or None
    brand = (cd.get("brand") or ca.get("brand") or None)
    search_text = " ".join(str(x) for x in (name, fam, src_cat, ptype, brand, code) if x)
    return Facets(item_id=item_id, tenant_id=tenant_id, category=category, family=(fam.lower() or None),
                  product_type=(str(ptype)[:255] if ptype else None), item_role=getattr(role, "value", str(role)),
                  brand=(str(brand)[:255] if brand else None), code_upper=(code[:255] if code else None),
                  title=str(name), price=_price(cd), volume_ml=sizes.get("volume"), weight_g=sizes.get("weight"),
                  power_w=sizes.get("power"), search_text=search_text)


_UPSERT_SQL = text("""
    INSERT INTO knowledge_search_index (knowledge_item_id, tenant_id, category, family, product_type, item_role,
        brand, code_upper, title, price, volume_ml, weight_g, power_w, search_tsv, updated_at)
    VALUES (:item_id, :tenant_id, :category, :family, :product_type, :item_role, :brand, :code_upper, :title,
        :price, :volume_ml, :weight_g, :power_w, to_tsvector('simple', :search_text), now())
    ON CONFLICT (knowledge_item_id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id, category = EXCLUDED.category, family = EXCLUDED.family,
        product_type = EXCLUDED.product_type, item_role = EXCLUDED.item_role, brand = EXCLUDED.brand,
        code_upper = EXCLUDED.code_upper, title = EXCLUDED.title, price = EXCLUDED.price,
        volume_ml = EXCLUDED.volume_ml, weight_g = EXCLUDED.weight_g, power_w = EXCLUDED.power_w,
        search_tsv = EXCLUDED.search_tsv, updated_at = now()
""")


async def _load_rows(db, tenant_id: str, item_ids: Optional[Sequence[str]] = None, after_id: str = "",
                     limit: int = UPSERT_BATCH):
    where = "i.tenant_id = :t AND i.is_active"
    params: Dict[str, Any] = {"t": tenant_id, "lim": limit, "after": after_id}
    if item_ids is not None:
        where += " AND i.id = ANY(:ids)"
        params["ids"] = list(item_ids)
    else:
        where += " AND i.id > :after"
    return (await db.execute(text(f"""
        SELECT i.id, i.category, i.title, i.external_identity_key AS k, v.canonical_data AS cd
        FROM knowledge_items i JOIN knowledge_versions v ON v.id = i.current_version_id
        WHERE {where} ORDER BY i.id LIMIT :lim"""), params)).all()


async def _write(db, rows: Iterable[Any], tenant_id: str) -> int:
    params = []
    for r in rows:
        f = compute_facets(r.id, tenant_id, r.category, r.title, r.k, r.cd)
        params.append({**f.__dict__, "item_id": f.item_id})
    if params:
        await db.execute(_UPSERT_SQL, params)
    return len(params)


async def upsert_items(tenant_id: str, item_ids: Sequence[str]) -> int:
    """Refresh the index rows of specific items (active -> upsert, inactive/deleted -> removed)."""
    if not item_ids:
        return 0
    async with db_manager.session_factory() as db:
        rows = await _load_rows(db, tenant_id, item_ids=item_ids, limit=len(item_ids))
        n = await _write(db, rows, tenant_id)
        alive = {r.id for r in rows}
        gone = [i for i in item_ids if i not in alive]
        if gone:
            await db.execute(text("DELETE FROM knowledge_search_index WHERE tenant_id = :t AND knowledge_item_id = ANY(:ids)"),
                             {"t": tenant_id, "ids": gone})
        await db.commit()
    _presence.pop(tenant_id, None)
    return n


async def rebuild_tenant(tenant_id: str, batch: int = UPSERT_BATCH) -> int:
    """(Re)build a tenant's index rows in keyset-paged batches (bounded memory), then remove rows of
    items that are no longer active. Safe to run while serving (idempotent upserts)."""
    t0 = time.perf_counter()
    total, after = 0, ""
    while True:
        async with db_manager.session_factory() as db:
            rows = await _load_rows(db, tenant_id, after_id=after, limit=batch)
            if not rows:
                break
            total += await _write(db, rows, tenant_id)
            await db.commit()
        after = rows[-1].id
        await asyncio.sleep(0)
    async with db_manager.session_factory() as db:
        await db.execute(text("""DELETE FROM knowledge_search_index s WHERE s.tenant_id = :t AND NOT EXISTS (
            SELECT 1 FROM knowledge_items i WHERE i.id = s.knowledge_item_id AND i.is_active)"""), {"t": tenant_id})
        await db.commit()
    _presence.pop(tenant_id, None)
    logger.info("knowledge search index rebuilt", tenant_id=tenant_id, items=total,
                duration_ms=round((time.perf_counter() - t0) * 1000, 1))
    return total


async def is_available(db, tenant_id: str) -> bool:
    """True when this tenant's index exists (cached; O(1) index probe otherwise)."""
    hit = _presence.get(tenant_id)
    if hit and time.monotonic() - hit[0] < _PRESENCE_TTL_S:
        return hit[1]
    try:
        ok = (await db.execute(text("SELECT 1 FROM knowledge_search_index WHERE tenant_id = :t LIMIT 1"),
                               {"t": tenant_id})).first() is not None
    except Exception:  # noqa: BLE001 - table missing before the migration: use the legacy paths
        ok = False
    _presence[tenant_id] = (time.monotonic(), ok)
    return ok


def schedule_rebuild(tenant_id: str) -> None:
    """Fire-and-forget rebuild (after an import). Never raises."""
    async def _run():
        try:
            await rebuild_tenant(tenant_id)
        except Exception as err:  # noqa: BLE001
            logger.warning("knowledge search index rebuild failed", tenant_id=tenant_id, error=str(err)[:300])
    try:
        asyncio.get_running_loop().create_task(_run())
    except RuntimeError:
        pass
