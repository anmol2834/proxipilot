"""Phase 9.4: Canonical Active-Version Read Contract.

Provides the single source of truth for resolving active, temporally valid
knowledge across ProxiPilot. All future knowledge consumers (retrieval, RAG,
synthesis, API) must query through this canonical abstraction.

Canonical Temporal Filter Rule:
    status == ACTIVE
    AND (effective_from IS NULL OR effective_from <= as_of)
    AND (effective_until IS NULL OR effective_until > as_of)

Invariants:
- Multi-tenant strictness: Every query requires tenant_id.
- Timezone standardized: All comparisons are performed against timezone-aware UTC datetimes.
- Fast execution: Uses the composite index ix_knowledge_versions_temporal.
- Deterministic resolution: If multiple active versions overlap, the highest
  version_number is selected deterministically.
- Zero full-history scans: Directly queries candidate active records.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.knowledge import (
    KnowledgeItem,
    KnowledgeLifecycleStatus,
    KnowledgeVersion,
)


def normalize_utc_timestamp(dt: Optional[datetime]) -> datetime:
    """Ensure a timestamp is timezone-aware UTC."""
    if dt is None:
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def build_current_version_filter(as_of: Optional[datetime] = None):
    """Constructs the canonical SQLAlchemy filter clause for active, effective versions."""
    ref_time = normalize_utc_timestamp(as_of)
    return and_(
        KnowledgeVersion.status == KnowledgeLifecycleStatus.ACTIVE.value,
        or_(
            KnowledgeVersion.effective_from.is_(None),
            KnowledgeVersion.effective_from <= ref_time,
        ),
        or_(
            KnowledgeVersion.effective_until.is_(None),
            KnowledgeVersion.effective_until > ref_time,
        ),
    )


def compute_temporal_status(
    effective_from: Optional[datetime],
    effective_until: Optional[datetime],
    as_of: Optional[datetime] = None,
) -> str:
    """Classifies temporal validity into 'current', 'future', or 'expired'."""
    ref_time = normalize_utc_timestamp(as_of)

    if effective_from is not None:
        eff_from_utc = normalize_utc_timestamp(effective_from)
        if eff_from_utc > ref_time:
            return "future"

    if effective_until is not None:
        eff_until_utc = normalize_utc_timestamp(effective_until)
        if eff_until_utc <= ref_time:
            return "expired"

    return "current"


class CanonicalKnowledgeReader:
    """Unified repository for active-version resolution."""

    @staticmethod
    async def get_current_item_version(
        db: AsyncSession,
        tenant_id: str,
        item_id: str,
        as_of: Optional[datetime] = None,
    ) -> Optional[Tuple[KnowledgeItem, KnowledgeVersion]]:
        """Fetch the single authoritative, active version of a KnowledgeItem at time `as_of`."""
        temporal_clause = build_current_version_filter(as_of)

        stmt = (
            select(KnowledgeVersion)
            .join(KnowledgeItem, KnowledgeVersion.knowledge_item_id == KnowledgeItem.id)
            .where(
                KnowledgeVersion.tenant_id == tenant_id,
                KnowledgeVersion.knowledge_item_id == item_id,
                KnowledgeItem.is_active.is_(True),
                temporal_clause,
            )
            .options(
                selectinload(KnowledgeVersion.knowledge_item),
                selectinload(KnowledgeVersion.source),
            )
            .order_by(KnowledgeVersion.version_number.desc())
            .limit(1)
        )

        res = await db.execute(stmt)
        version = res.scalar_one_or_none()
        if not version or not version.knowledge_item:
            return None

        return version.knowledge_item, version

    @staticmethod
    async def get_current_items_batch(
        db: AsyncSession,
        tenant_id: str,
        item_ids: List[str],
        as_of: Optional[datetime] = None,
    ) -> Dict[str, Tuple[KnowledgeItem, KnowledgeVersion]]:
        """Fetch authoritative active versions for a batch of KnowledgeItem IDs in a single query."""
        if not item_ids:
            return {}

        temporal_clause = build_current_version_filter(as_of)

        stmt = (
            select(KnowledgeVersion)
            .join(KnowledgeItem, KnowledgeVersion.knowledge_item_id == KnowledgeItem.id)
            .where(
                KnowledgeVersion.tenant_id == tenant_id,
                KnowledgeVersion.knowledge_item_id.in_(item_ids),
                KnowledgeItem.is_active.is_(True),
                temporal_clause,
            )
            .options(
                selectinload(KnowledgeVersion.knowledge_item),
                selectinload(KnowledgeVersion.source),
            )
            .order_by(KnowledgeVersion.knowledge_item_id, KnowledgeVersion.version_number.desc())
        )

        res = await db.execute(stmt)
        versions = res.scalars().all()

        results: Dict[str, Tuple[KnowledgeItem, KnowledgeVersion]] = {}
        for v in versions:
            if v.knowledge_item and v.knowledge_item_id not in results:
                results[v.knowledge_item_id] = (v.knowledge_item, v)

        return results

    @staticmethod
    async def get_current_knowledge(
        db: AsyncSession,
        tenant_id: str,
        category: Optional[str] = None,
        as_of: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Tuple[KnowledgeItem, KnowledgeVersion]]:
        """Fetch all currently active knowledge items and versions for a tenant."""
        temporal_clause = build_current_version_filter(as_of)

        stmt = (
            select(KnowledgeVersion)
            .join(KnowledgeItem, KnowledgeVersion.knowledge_item_id == KnowledgeItem.id)
            .where(
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

        stmt = stmt.order_by(KnowledgeItem.updated_at.desc(), KnowledgeVersion.version_number.desc())
        stmt = stmt.offset(offset).limit(limit)

        res = await db.execute(stmt)
        versions = list(res.scalars().all())

        # Deduplicate to ensure at most 1 version per KnowledgeItem
        seen_items = set()
        pairs: List[Tuple[KnowledgeItem, KnowledgeVersion]] = []
        for v in versions:
            if v.knowledge_item and v.knowledge_item_id not in seen_items:
                seen_items.add(v.knowledge_item_id)
                pairs.append((v.knowledge_item, v))

        return pairs
