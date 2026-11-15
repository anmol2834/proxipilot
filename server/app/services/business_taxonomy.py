"""Business context & taxonomy map for the requirement planner (AI #1).

A small, cached summary of what THIS business actually has: its name / industry /
description and the knowledge categories, product families, product types and brands
present in its active knowledge. AI #1 uses it to translate vague, regional or functional
wording into this business's own vocabulary, and to write search concepts that look like
the records that really exist.

- One aggregate query per tenant, never the whole catalogue.
- Cached per tenant (never shared across tenants), invalidated when an import completes.
- Every value comes from the tenant's own data; nothing here is business-specific code.
- Fails soft: on any error the planner simply runs without a taxonomy.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import text

from app.core.logging import logger

TAXONOMY_TTL_SECONDS = 600.0
MAX_FAMILIES = 25
MAX_PRODUCT_TYPES = 15
MAX_BRANDS = 10
MAX_DESCRIPTION_CHARS = 300
MAX_LABEL_CHARS = 60


@dataclass
class BusinessTaxonomy:
    business_name: Optional[str] = None
    industry: Optional[str] = None
    description: Optional[str] = None
    knowledge_categories: List[Tuple[str, int]] = field(default_factory=list)
    product_families: List[Tuple[str, int]] = field(default_factory=list)
    product_types: List[str] = field(default_factory=list)
    brands: List[str] = field(default_factory=list)
    total_items: int = 0
    loaded_at: float = field(default_factory=time.monotonic)

    @property
    def is_empty(self) -> bool:
        return not (self.knowledge_categories or self.product_families or self.business_name)

    def to_prompt_json(self) -> str:
        """Compact JSON for the planner system prompt (bounded size)."""
        data: Dict[str, Any] = {}
        if self.business_name:
            data["business"] = self.business_name
        if self.industry:
            data["industry"] = self.industry
        if self.description:
            data["about"] = self.description
        if self.knowledge_categories:
            data["knowledge_categories"] = {k: n for k, n in self.knowledge_categories}
        if self.product_families:
            data["product_families"] = {k: n for k, n in self.product_families}
        if self.product_types:
            data["product_types"] = self.product_types
        if self.brands:
            data["brands"] = self.brands
        data["total_active_items"] = self.total_items
        return json.dumps(data, ensure_ascii=False, separators=(",", ":"))


_CACHE: Dict[str, BusinessTaxonomy] = {}


def _clip(value: Any, limit: int = MAX_LABEL_CHARS) -> Optional[str]:
    s = " ".join(str(value or "").split())
    return s[:limit] if s else None


async def load_business_taxonomy(db: Any, tenant_id: str) -> Optional[BusinessTaxonomy]:
    """Tenant-scoped taxonomy map, cached for TAXONOMY_TTL_SECONDS. Returns None on failure."""
    hit = _CACHE.get(tenant_id)
    if hit is not None and time.monotonic() - hit.loaded_at < TAXONOMY_TTL_SECONDS:
        return hit
    try:
        rows = (await db.execute(text("""
            WITH cur AS (
                SELECT i.category,
                       coalesce(v.canonical_data->'custom_attributes'->>'category',
                                v.canonical_data->>'sub_category') AS fam,
                       coalesce(v.canonical_data->'custom_attributes'->>'product_type',
                                v.canonical_data->>'product_type') AS ptype,
                       v.canonical_data->>'brand' AS brand
                FROM knowledge_items i JOIN knowledge_versions v ON v.id = i.current_version_id
                WHERE i.tenant_id = :t AND i.is_active
            )
            SELECT 'cat' AS kind, category AS k, count(*) AS n FROM cur GROUP BY category
            UNION ALL
            (SELECT 'fam', fam, count(*) FROM cur WHERE coalesce(fam, '') <> ''
             GROUP BY fam ORDER BY count(*) DESC LIMIT :mf)
            UNION ALL
            (SELECT 'ptype', ptype, count(*) FROM cur WHERE coalesce(ptype, '') <> ''
             GROUP BY ptype ORDER BY count(*) DESC LIMIT :mp)
            UNION ALL
            (SELECT 'brand', brand, count(*) FROM cur WHERE coalesce(brand, '') <> ''
             GROUP BY brand ORDER BY count(*) DESC LIMIT :mb)
            """), {"t": tenant_id, "mf": MAX_FAMILIES, "mp": MAX_PRODUCT_TYPES, "mb": MAX_BRANDS})).all()
        org = (await db.execute(text("""
            SELECT o.name, o.industry, bp.description
            FROM organizations o LEFT JOIN business_profiles bp ON bp.organization_id = o.id
            WHERE o.id = :t LIMIT 1
            """), {"t": tenant_id})).first()
    except Exception as exc:  # noqa: BLE001 - the planner must run without a taxonomy
        logger.warning("Business taxonomy unavailable", tenant_id=tenant_id, error=str(exc)[:200])
        return None

    cats = [(str(r.k), int(r.n)) for r in rows if r.kind == "cat" and r.k]
    tax = BusinessTaxonomy(
        business_name=_clip(org.name, 120) if org else None,
        industry=_clip(org.industry, 80) if org else None,
        description=_clip(org.description, MAX_DESCRIPTION_CHARS) if org else None,
        knowledge_categories=cats,
        product_families=[(lab, int(r.n)) for r in rows if r.kind == "fam" and (lab := _clip(r.k))],
        product_types=[lab for r in rows if r.kind == "ptype" and (lab := _clip(r.k))],
        brands=[lab for r in rows if r.kind == "brand" and (lab := _clip(r.k))],
        total_items=sum(n for _k, n in cats),
    )
    _CACHE[tenant_id] = tax
    return tax


def invalidate_business_taxonomy(tenant_id: str) -> None:
    _CACHE.pop(tenant_id, None)
