"""Structured PostgreSQL Retriever — Phase 4.

Provides authoritative, tenant-scoped structured retrieval from PostgreSQL for:
1. Exact identifiers, product codes, and SKUs (KnowledgeItem.external_identity_key / canonical_data).
2. Category-scoped queries with exact numeric boundaries (min_price, max_price, operators).
3. Contact, office, and organization records (category == 'contacts').
4. Bounded catalogue discovery with stable pagination.

All queries enforce:
- Mandatory server-side tenant isolation (tenant_id).
- Temporal validity (status == ACTIVE, effective_from <= as_of < effective_until).
- Zero model-generated SQL: parameterized ORM queries against allowlisted fields only.
- Strict Decimal precision for price comparisons.
"""

from __future__ import annotations

import asyncio
import re
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.contracts.requirement_plan import PlannedFilter, PlannedRange
from app.contracts.retrieval_capability import FilterOperator
from app.core.logging import logger
from app.models.knowledge import (
    KnowledgeCategory,
    KnowledgeItem,
    KnowledgeLifecycleStatus,
    KnowledgeVersion,
)
from app.services.knowledge_read_contract import (
    CanonicalKnowledgeReader,
    build_current_version_filter,
    normalize_utc_timestamp,
)


def _extract_numeric_price(pricing_dict: Dict[str, Any]) -> Tuple[Decimal, str]:
    """Extract calculated total or base price and currency as Decimal."""
    currency = str(pricing_dict.get("currency") or "INR").upper()
    
    # Check calculated_total or estimated_total first
    raw_total = pricing_dict.get("calculated_total") or pricing_dict.get("estimated_total")
    if raw_total is not None:
        try:
            return Decimal(str(raw_total)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP), currency
        except Exception:
            pass
            
    base = Decimal(str(pricing_dict.get("base_price", "0.00")))
    visit = Decimal(str(pricing_dict.get("visit_charge") or pricing_dict.get("visit_diagnostic_charge") or "0.00"))
    parts = Decimal(str(pricing_dict.get("parts_cost_estimate") or pricing_dict.get("estimated_parts_cost") or "0.00"))
    disc = Decimal(str(pricing_dict.get("discount_percent") or pricing_dict.get("discount_percentage") or "0.00"))
    tax = Decimal(str(pricing_dict.get("tax_percent") or pricing_dict.get("tax_percentage") or "0.00"))
    
    subtotal = base + visit + parts
    after_disc = subtotal * (Decimal("1.00") - (disc / Decimal("100.00")))
    total = after_disc * (Decimal("1.00") + (tax / Decimal("100.00")))
    return total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP), currency


class StructuredRetriever:
    """Authoritative structured data retriever for PostgreSQL."""

    async def fetch_by_exact_keys(
        self,
        db: AsyncSession,
        tenant_id: str,
        keys: Sequence[str],
        as_of: Optional[datetime] = None,
    ) -> List[Tuple[KnowledgeItem, KnowledgeVersion]]:
        """Fetch active items by their exact external_identity_key or SKU."""
        if not keys:
            return []

        clean_keys = [k.strip().upper() for k in keys if k and k.strip()]
        if not clean_keys:
            return []

        ref_time = normalize_utc_timestamp(as_of)
        temporal_clause = build_current_version_filter(ref_time)

        stmt = (
            select(KnowledgeVersion)
            .join(KnowledgeItem, KnowledgeVersion.knowledge_item_id == KnowledgeItem.id)
            .where(
                KnowledgeItem.tenant_id == tenant_id,
                KnowledgeVersion.tenant_id == tenant_id,
                KnowledgeItem.is_active.is_(True),
                or_(
                    KnowledgeItem.external_identity_key.in_(clean_keys),
                    # Also match against case-insensitive uppercase
                    KnowledgeItem.external_identity_key.in_([k.lower() for k in clean_keys]),
                ),
                temporal_clause,
            )
            .options(
                selectinload(KnowledgeVersion.knowledge_item),
                selectinload(KnowledgeVersion.source),
            )
            .order_by(KnowledgeVersion.version_number.desc())
        )

        versions: List[KnowledgeVersion] = []
        for attempt in range(3):
            try:
                res = await db.execute(stmt)
                versions = list(res.scalars().all())
                break
            except Exception as exc:
                if attempt < 2:
                    await asyncio.sleep(0.4 * (attempt + 1))
                else:
                    raise exc

        seen_item_ids: Set[str] = set()
        matched: List[Tuple[KnowledgeItem, KnowledgeVersion]] = []
        for v in versions:
            if v.knowledge_item and v.knowledge_item_id not in seen_item_ids:
                seen_item_ids.add(v.knowledge_item_id)
                matched.append((v.knowledge_item, v))

        return matched

    async def fetch_near_keys(
        self,
        db: AsyncSession,
        tenant_id: str,
        key: str,
        limit: int = 3,
        max_distance: int = 2,
        as_of: Optional[datetime] = None,
    ) -> List[Tuple[KnowledgeItem, KnowledgeVersion]]:
        """Closest EXISTING identifiers to a code that does not exist (a typo or a wrong digit):
        same leading letter prefix, edit distance <= max_distance, nearest first. Business-agnostic:
        it only compares the tenant's own codes. The caller must present these as suggestions,
        never as the requested code."""
        code = (key or "").strip().upper()
        prefix = re.match(r"[A-Z]+", code)
        if not code or not prefix or len(prefix.group(0)) < 2 or len(code) < 4:
            return []
        from sqlalchemy import text as _text

        rows = (await db.execute(_text("""
            SELECT upper(external_identity_key) AS k FROM knowledge_items
            WHERE tenant_id = :t AND is_active AND upper(external_identity_key) LIKE :p
            LIMIT 2000"""), {"t": tenant_id, "p": prefix.group(0) + "%"})).scalars().all()
        scored = sorted(
            ((d, k) for k in set(rows) if k != code and (d := _edit_distance(code, k)) <= max_distance),
            key=lambda dk: (dk[0], _numeric_gap(code, dk[1]), dk[1]),
        )[:limit]
        if not scored:
            return []
        found = await self.fetch_by_exact_keys(db=db, tenant_id=tenant_id, keys=[k for _d, k in scored], as_of=as_of)
        order = {k: i for i, (_d, k) in enumerate(scored)}
        return sorted(found, key=lambda iv: order.get((iv[0].external_identity_key or "").upper(), 99))

    async def fetch_by_category_and_range(
        self,
        db: AsyncSession,
        tenant_id: str,
        category: Optional[str] = None,
        range_semantics: Optional[PlannedRange] = None,
        filters: Optional[Sequence[PlannedFilter]] = None,
        exclude_entity_ids: Optional[Sequence[str]] = None,
        limit: int = 10,
        offset: int = 0,
        as_of: Optional[datetime] = None,
    ) -> Tuple[List[Tuple[KnowledgeItem, KnowledgeVersion]], bool]:
        """Fetch items matching category and strict range boundaries (e.g. price between 500 and 1500).
        
        Applies novelty-aware exclusion against exclude_entity_ids (canonical IDs and SKUs).
        Returns:
            Tuple of (matched_pairs, has_more)
        """
        ref_time = normalize_utc_timestamp(as_of)
        temporal_clause = build_current_version_filter(ref_time)

        clean_excluded = [str(x).strip() for x in (exclude_entity_ids or []) if x and str(x).strip()]
        clean_excluded_upper = {x.upper() for x in clean_excluded}
        clean_excluded_set = set(clean_excluded) | clean_excluded_upper

        # Adaptive over-fetch taking exclusions into account to avoid candidate exhaustion
        fetch_limit = min(max((limit + len(clean_excluded) + 1) * 3, 30), 200)

        stmt = (
            select(KnowledgeVersion)
            .join(KnowledgeItem, KnowledgeVersion.knowledge_item_id == KnowledgeItem.id)
            .where(
                KnowledgeItem.tenant_id == tenant_id,
                KnowledgeVersion.tenant_id == tenant_id,
                KnowledgeItem.is_active.is_(True),
                temporal_clause,
            )
            .options(
                selectinload(KnowledgeVersion.knowledge_item),
                selectinload(KnowledgeVersion.source),
            )
        )

        if category:
            stmt = stmt.where(KnowledgeItem.category == category)

        if clean_excluded:
            stmt = stmt.where(
                KnowledgeItem.id.notin_(clean_excluded),
                or_(
                    KnowledgeItem.external_identity_key.is_(None),
                    KnowledgeItem.external_identity_key.notin_(list(clean_excluded_upper) + clean_excluded),
                ),
            )

        stmt = stmt.order_by(KnowledgeItem.updated_at.desc(), KnowledgeVersion.version_number.desc())
        stmt = stmt.limit(fetch_limit)

        res = await db.execute(stmt)
        versions = list(res.scalars().all())

        # Deduplicate to single newest version per item
        seen_items: Set[str] = set()
        candidate_pairs: List[Tuple[KnowledgeItem, KnowledgeVersion]] = []
        for v in versions:
            if v.knowledge_item and v.knowledge_item_id not in seen_items:
                # In-memory novelty guard
                if clean_excluded_set:
                    if v.knowledge_item_id in clean_excluded_set:
                        continue
                    if v.knowledge_item.external_identity_key and v.knowledge_item.external_identity_key.strip().upper() in clean_excluded_set:
                        continue
                seen_items.add(v.knowledge_item_id)
                candidate_pairs.append((v.knowledge_item, v))

        # Apply strict range semantics
        matched_pairs: List[Tuple[KnowledgeItem, KnowledgeVersion]] = []
        for item, version in candidate_pairs:
            canonical = version.canonical_data or {}

            # Price / Range check
            if range_semantics and range_semantics.field == "price":
                pricing_dict = canonical.get("pricing") or {}
                if not pricing_dict and "price" in canonical:
                    pricing_dict = {"base_price": canonical["price"], "currency": canonical.get("currency", "INR")}

                if not pricing_dict:
                    # Item has no pricing; cannot satisfy price range constraint
                    continue

                item_price, item_curr = _extract_numeric_price(pricing_dict)

                # Currency check
                if range_semantics.currency and range_semantics.currency.upper() != item_curr:
                    continue

                # Min boundary check
                if range_semantics.min_value is not None:
                    min_dec = Decimal(str(range_semantics.min_value))
                    if range_semantics.is_min_inclusive:
                        if item_price < min_dec:
                            continue
                    else:
                        if item_price <= min_dec:
                            continue

                # Max boundary check
                if range_semantics.max_value is not None:
                    max_dec = Decimal(str(range_semantics.max_value))
                    if range_semantics.is_max_inclusive:
                        if item_price > max_dec:
                            continue
                    else:
                        if item_price >= max_dec:
                            continue

            # Additional structured filters
            passes_filters = True
            if filters:
                for f in filters:
                    if f.field in ("price", "pricing"):
                        continue  # Handled by range semantics above
                    val_str = str(f.value).lower().strip()
                    # Check in canonical root or custom_attributes
                    target_val = canonical.get(f.field)
                    if target_val is None:
                        custom_attrs = canonical.get("custom_attributes") or {}
                        target_val = custom_attrs.get(f.field)

                    if target_val is not None:
                        target_str = str(target_val).lower().strip()
                        if f.operator == FilterOperator.EQ and target_str != val_str:
                            passes_filters = False
                            break
                        elif f.operator == FilterOperator.CONTAINS and val_str not in target_str:
                            passes_filters = False
                            break

            if passes_filters:
                matched_pairs.append((item, version))

        has_more = len(matched_pairs) > (offset + limit)
        paged_results = matched_pairs[offset : offset + limit]
        return paged_results, has_more

    async def fetch_family_candidates(
        self,
        db: AsyncSession,
        tenant_id: str,
        family_token_groups: Sequence[Sequence[str]],
        limit: int = 150,
        as_of: Optional[datetime] = None,
    ) -> List[Tuple[KnowledgeItem, KnowledgeVersion]]:
        """All current items of the requested product families (bounded).

        A family is a token group resolved from the tenant's own category vocabulary
        (e.g. {"air", "curtain"}); an item belongs to it when every token appears as a word
        prefix in its source category or title. Used for progressive retrieval: a top-K
        semantic cut can no longer hide the eligible members of the requested family.
        Tenant-scoped in SQL; tokens are bound parameters (never interpolated).
        """
        import re as _re
        from sqlalchemy import text as _text

        groups = [[t for t in g if t] for g in family_token_groups if g]
        groups = [g for g in groups if g]
        if not tenant_id or not groups:
            return []
        params: Dict[str, Any] = {"t": tenant_id, "lim": max(1, min(int(limit), 500))}
        ors = []
        for gi, g in enumerate(groups[:5]):
            ands = []
            for ti, tok in enumerate(g[:6]):
                key = f"p{gi}_{ti}"
                params[key] = r"\m" + _re.sub(r"([.\-/\\^$*+?()\[\]{}|])", r"\\\1", tok)
                ands.append(f"hay ~* :{key}")
            ors.append("(" + " AND ".join(ands) + ")")
        rows = (await db.execute(_text(f"""
            SELECT id FROM (
                SELECT i.id, concat_ws(' ', i.title,
                       v.canonical_data->'custom_attributes'->>'category',
                       v.canonical_data->>'sub_category') AS hay
                FROM knowledge_items i JOIN knowledge_versions v ON v.id = i.current_version_id
                WHERE i.tenant_id = :t AND i.is_active
            ) c WHERE {" OR ".join(ors)} LIMIT :lim"""), params)).scalars().all()
        if not rows:
            return []
        found = await CanonicalKnowledgeReader.get_current_items_batch(
            db=db, tenant_id=tenant_id, item_ids=list(rows), as_of=as_of)
        return [found[i] for i in rows if i in found]

    async def fetch_contacts(
        self,
        db: AsyncSession,
        tenant_id: str,
        department_or_role: Optional[str] = None,
        limit: int = 5,
        as_of: Optional[datetime] = None,
    ) -> List[Tuple[KnowledgeItem, KnowledgeVersion]]:
        """Fetch contact persons or office contact cards strictly scoped to tenant."""
        ref_time = normalize_utc_timestamp(as_of)
        temporal_clause = build_current_version_filter(ref_time)

        stmt = (
            select(KnowledgeVersion)
            .join(KnowledgeItem, KnowledgeVersion.knowledge_item_id == KnowledgeItem.id)
            .where(
                KnowledgeItem.tenant_id == tenant_id,
                KnowledgeVersion.tenant_id == tenant_id,
                KnowledgeItem.category == KnowledgeCategory.CONTACTS.value,
                KnowledgeItem.is_active.is_(True),
                temporal_clause,
            )
            .options(
                selectinload(KnowledgeVersion.knowledge_item),
                selectinload(KnowledgeVersion.source),
            )
            .order_by(KnowledgeItem.updated_at.desc())
            .limit(limit * 2)
        )

        res = await db.execute(stmt)
        versions = list(res.scalars().all())

        results: List[Tuple[KnowledgeItem, KnowledgeVersion]] = []
        seen: Set[str] = set()

        dept_lower = department_or_role.lower().strip() if department_or_role else None

        for v in versions:
            if v.knowledge_item and v.knowledge_item_id not in seen:
                seen.add(v.knowledge_item_id)
                canonical = v.canonical_data or {}
                if dept_lower:
                    desc_text = f"{v.knowledge_item.title} {canonical.get('department', '')} {canonical.get('role', '')} {v.content_text or ''}".lower()
                    if dept_lower not in desc_text:
                        continue
                results.append((v.knowledge_item, v))
                if len(results) >= limit:
                    break

        return results


structured_retriever = StructuredRetriever()


def _edit_distance(a: str, b: str) -> int:
    """Levenshtein distance (codes are short; O(len(a)*len(b)))."""
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def _numeric_gap(a: str, b: str) -> int:
    """|n(a) - n(b)| for the first digit runs (DSDR0016 is nearer DSDR0015 than DSDR0061)."""
    na, nb = re.search(r"\d+", a), re.search(r"\d+", b)
    if not na or not nb:
        return 10**9
    return abs(int(na.group(0)) - int(nb.group(0)))
