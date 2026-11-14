"""Phase 9.6: Backfill script to migrate EAV knowledge_attributes to knowledge_versions.canonical_data.

Usage:
    python scripts/backfill_eav_to_canonical.py [--batch-size 100] [--dry-run]
"""

import argparse
import asyncio
import json
import logging
import sys
from datetime import datetime
from typing import Any, Dict

from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

# Add server root to path
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import db_manager
from app.models.knowledge import KnowledgeAttribute, KnowledgeVersion

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("backfill_canonical")


def _extract_resolved_value(attr: KnowledgeAttribute) -> Any:
    """Extract concrete value from typed KnowledgeAttribute slot."""
    if attr.string_value is not None:
        return attr.string_value
    if attr.text_value is not None:
        return attr.text_value
    if attr.number_value is not None:
        return attr.number_value
    if attr.boolean_value is not None:
        return attr.boolean_value
    if attr.date_value is not None:
        return attr.date_value.isoformat()
    if attr.json_value is not None:
        try:
            return json.loads(attr.json_value)
        except Exception:
            return attr.json_value
    return None


async def run_backfill(batch_size: int = 100, dry_run: bool = False) -> None:
    db_manager.initialize()
    total_migrated = 0
    total_skipped = 0

    async with db_manager.session_factory() as session:
        # Find all versions where canonical_data IS NULL
        stmt = (
            select(KnowledgeVersion)
            .where(KnowledgeVersion.canonical_data.is_(None))
            .options(selectinload(KnowledgeVersion.attributes))
            .order_by(KnowledgeVersion.created_at.asc())
            .limit(batch_size)
        )

        while True:
            result = await session.execute(stmt)
            versions = list(result.scalars().all())
            if not versions:
                break

            for ver in versions:
                attrs_dict: Dict[str, Any] = {}
                for attr in ver.attributes:
                    val = _extract_resolved_value(attr)
                    if val is not None:
                        attrs_dict[attr.key] = val

                if not attrs_dict:
                    # No attributes attached, store empty dict to avoid re-querying
                    attrs_dict = {}

                ver.canonical_data = attrs_dict
                total_migrated += 1

            if dry_run:
                logger.info(f"[DRY-RUN] Would have updated {len(versions)} versions in batch.")
                await session.rollback()
                break
            else:
                await session.commit()
                logger.info(f"Committed batch of {len(versions)} versions. Total migrated: {total_migrated}")

    logger.info(f"Backfill finished. Total records migrated: {total_migrated}, skipped: {total_skipped}")
    await db_manager.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill EAV attributes to canonical_data JSONB.")
    parser.add_argument("--batch-size", type=int, default=100, help="Batch size for processing")
    parser.add_argument("--dry-run", action="store_true", help="Simulate without committing changes")
    args = parser.parse_args()

    asyncio.run(run_backfill(batch_size=args.batch_size, dry_run=args.dry_run))
