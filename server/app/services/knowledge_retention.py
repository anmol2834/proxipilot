"""Phase 9.5: Knowledge Lifecycle Retention and Safe Cleanup Service.

Provides explicit, tenant-isolated retention policy evaluation and safe cleanup.
Enforces separation of retention policy from active knowledge state.

Invariants:
- Active versions and current_version_id references are NEVER eligible for deletion.
- Historical versions are preserved by default unless an explicit tenant-scoped
  retention policy threshold has elapsed.
- Dry-run capability: inspect cleanup candidates without modifying data.
- Atomic, audited batch processing: all purge actions record audit events.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import logging
from typing import Any, Dict, List, Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditAction
from app.models.knowledge import (
    KnowledgeItem,
    KnowledgeLifecycleStatus,
    KnowledgeVersion,
)
from app.services.audit import audit_service

logger = logging.getLogger("proxipilot.knowledge.retention")


@dataclass
class RetentionPolicyConfig:
    """Configurable retention thresholds."""

    # Retain archived/superseded historical versions for N days (None = retain indefinitely)
    archived_version_retention_days: Optional[int] = None
    # Retain revoked historical versions for N days
    revoked_version_retention_days: Optional[int] = None
    # Maximum versions to purge per cleanup execution batch
    batch_size: int = 100


@dataclass
class RetentionEligibilityReport:
    """Report detailing candidate records eligible for retention cleanup."""

    tenant_id: str
    evaluated_at: str
    eligible_version_ids: List[str]
    total_eligible: int
    retained_active_count: int
    is_dry_run: bool


class KnowledgeRetentionService:
    """Enterprise retention policy manager."""

    @staticmethod
    async def evaluate_eligibility(
        db: AsyncSession,
        tenant_id: str,
        config: RetentionPolicyConfig,
    ) -> RetentionEligibilityReport:
        """Evaluates versions eligible for retention purge without deleting anything."""
        now_utc = datetime.now(timezone.utc)
        eligible_ids: List[str] = []

        # Find items' current_version_id to guarantee they are protected
        items_stmt = select(KnowledgeItem.current_version_id).where(
            KnowledgeItem.tenant_id == tenant_id,
            KnowledgeItem.current_version_id.is_not(None),
        )
        items_res = await db.execute(items_stmt)
        protected_version_ids = set(items_res.scalars().all())

        # Count active versions
        active_stmt = select(KnowledgeVersion.id).where(
            KnowledgeVersion.tenant_id == tenant_id,
            KnowledgeVersion.status == KnowledgeLifecycleStatus.ACTIVE.value,
        )
        active_res = await db.execute(active_stmt)
        active_ids = set(active_res.scalars().all())
        protected_version_ids.update(active_ids)

        # Check archived versions if retention threshold is set
        if config.archived_version_retention_days is not None and config.archived_version_retention_days > 0:
            cutoff = now_utc - timedelta(days=config.archived_version_retention_days)
            archived_stmt = (
                select(KnowledgeVersion.id)
                .where(
                    KnowledgeVersion.tenant_id == tenant_id,
                    KnowledgeVersion.status == KnowledgeLifecycleStatus.ARCHIVED.value,
                    KnowledgeVersion.archived_at <= cutoff,
                )
                .limit(config.batch_size)
            )
            arch_res = await db.execute(archived_stmt)
            for v_id in arch_res.scalars().all():
                if v_id not in protected_version_ids:
                    eligible_ids.append(v_id)

        # Check revoked versions if retention threshold is set
        if config.revoked_version_retention_days is not None and config.revoked_version_retention_days > 0:
            cutoff = now_utc - timedelta(days=config.revoked_version_retention_days)
            revoked_stmt = (
                select(KnowledgeVersion.id)
                .where(
                    KnowledgeVersion.tenant_id == tenant_id,
                    KnowledgeVersion.status == KnowledgeLifecycleStatus.REVOKED.value,
                    KnowledgeVersion.updated_at <= cutoff,
                )
                .limit(config.batch_size)
            )
            rev_res = await db.execute(revoked_stmt)
            for v_id in rev_res.scalars().all():
                if v_id not in protected_version_ids:
                    eligible_ids.append(v_id)

        return RetentionEligibilityReport(
            tenant_id=tenant_id,
            evaluated_at=now_utc.isoformat(),
            eligible_version_ids=eligible_ids,
            total_eligible=len(eligible_ids),
            retained_active_count=len(active_ids),
            is_dry_run=True,
        )

    @classmethod
    async def execute_cleanup(
        cls,
        db: AsyncSession,
        tenant_id: str,
        config: RetentionPolicyConfig,
        user_id: Optional[str] = None,
        dry_run: bool = True,
    ) -> RetentionEligibilityReport:
        """Executes retention cleanup or dry-run assessment."""
        report = await cls.evaluate_eligibility(db, tenant_id, config)
        report.is_dry_run = dry_run

        if dry_run or not report.eligible_version_ids:
            return report

        # Purge eligible versions
        del_stmt = delete(KnowledgeVersion).where(
            KnowledgeVersion.tenant_id == tenant_id,
            KnowledgeVersion.id.in_(report.eligible_version_ids),
        )
        await db.execute(del_stmt)
        await db.commit()

        # Audit event
        await audit_service.record(
            db=db,
            action=AuditAction.KNOWLEDGE_VERSION_ARCHIVED,
            resource_type="knowledge_retention",
            resource_id=f"retention_{tenant_id}",
            organization_id=tenant_id,
            actor_user_id=user_id,
            metadata={
                "purged_count": len(report.eligible_version_ids),
                "purged_version_ids": report.eligible_version_ids[:10],
            },
        )

        logger.info(
            "knowledge.retention.cleanup_completed",
            tenant_id=tenant_id,
            purged_count=len(report.eligible_version_ids),
        )
        return report
