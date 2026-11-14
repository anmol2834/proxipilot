"""Memory Update & Sync — one publish, instantly consistent AI knowledge.

Contract
--------
PostgreSQL is the source of truth: an item's *current* approved state is
``knowledge_items.current_version_id`` (on an active item, with an ACTIVE version).
The vector index (Qdrant) is a derived projection of that state.

``KnowledgeSyncService.sync_item`` is a state-based, idempotent reconciler: it reads
the item's current state from PostgreSQL and makes Qdrant match it exactly:

    current ACTIVE version  ->  upsert its vectors (wait=True), mark it synced,
                                then delete vectors of every other version
    archived / deleted item ->  delete all of the item's vectors

Because it converges to state rather than replaying an event, running it twice,
out of order, or after a crash is always safe. Upserting the new version BEFORE
deleting stale ones means the item is never missing from search mid-update.

Delivery (fastest path first, each one backing up the previous):
1. Inline: CRUD calls ``sync_after_commit`` right after the DB commit, so the
   publish/rollback API returns only once retrieval already serves the new data.
2. Event: if inline sync fails or times out, a ``knowledge.*`` event is published
   to the ``knowledge-events`` stream; the indexer worker retries via ``sync_item``.
3. Sweep: ``sweep_pending`` periodically re-syncs ACTIVE versions still not
   ``synced`` (covers Redis outages and crashes between commit and sync).

Retrieval-side guards (independent of sync latency) ensure outdated text is never
served: lexical/structured readers resolve only the current version, and dense hits
are re-hydrated to the current version with stale passages dropped (verifier).
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import select

from app.contracts.events import EventNames
from app.core.database import db_manager
from app.core.logging import logger
from app.core.messaging import DomainEvent, event_bus
from app.models.knowledge import KnowledgeItem, KnowledgeLifecycleStatus, KnowledgeVersion

KNOWLEDGE_EVENTS_STREAM = "knowledge-events"


@dataclass
class SyncResult:
    item_id: str
    state: str  # "indexed" | "already_synced" | "removed" | "failed" | "deferred"
    version_id: Optional[str] = None
    vectors: int = 0
    stale_removed: bool = False
    duration_ms: float = 0.0
    error: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return self.state in ("indexed", "already_synced", "removed")


class KnowledgeSyncService:
    """Converges the vector index to PostgreSQL's current approved knowledge state."""

    INLINE_TIMEOUT_SECONDS = 20.0
    SWEEP_GRACE_SECONDS = 90
    SWEEP_BATCH_LIMIT = 100

    def __init__(self) -> None:
        self._projector = None
        self._recon = None

    # Lazy imports keep this module importable without initialising providers.
    def _get_projector(self):
        if self._projector is None:
            from app.services.knowledge_projection import KnowledgeProjectionService

            self._projector = KnowledgeProjectionService()
        return self._projector

    def _get_recon(self):
        if self._recon is None:
            from app.services.knowledge_reconciliation import knowledge_reconciliation_service

            self._recon = knowledge_reconciliation_service
        return self._recon

    @staticmethod
    def _qdrant():
        from app.services.qdrant_service import qdrant_indexer_service

        return qdrant_indexer_service

    # ------------------------------------------------------------------
    # Core reconciler
    # ------------------------------------------------------------------

    async def sync_item(
        self,
        tenant_id: str,
        item_id: str,
        force: bool = False,
        item: Optional[KnowledgeItem] = None,
        version: Optional[KnowledgeVersion] = None,
        removed: bool = False,
    ) -> SyncResult:
        """Make the vector index match the item's current state. Idempotent. Raises on failure.

        Fast path (used right after a CRUD commit): the caller passes the committed
        ``item``/``version`` it already holds, or ``removed=True`` for archive/delete,
        so no full re-read is needed. One cheap check of ``current_version_id`` still
        guards against a concurrent edit; on mismatch it falls back to a full read.
        """
        import time

        if not tenant_id or not item_id:
            raise ValueError("tenant_id and item_id are required for knowledge sync")
        t0 = time.perf_counter()

        if removed:
            item, version = None, None
        elif item is not None and version is not None:
            async with db_manager.session_factory() as db:
                row = (await db.execute(
                    select(KnowledgeItem.current_version_id, KnowledgeItem.is_active).where(
                        KnowledgeItem.id == item_id, KnowledgeItem.tenant_id == tenant_id,
                    )
                )).first()
            if (
                row is None
                or not row.is_active
                or row.current_version_id != version.id
                or version.status != KnowledgeLifecycleStatus.ACTIVE.value
            ):
                item, version = await self._load_current(tenant_id, item_id)
        else:
            item, version = await self._load_current(tenant_id, item_id)

        qdrant = self._qdrant()

        # Not retrievable any more (deleted, archived, or no approved version): purge.
        if version is None:
            await qdrant.delete_item_vectors(tenant_id=tenant_id, knowledge_item_id=item_id)
            return SyncResult(
                item_id=item_id, state="removed",
                duration_ms=round((time.perf_counter() - t0) * 1000, 2),
            )

        vectors = 0
        state = "already_synced"
        if force or version.semantic_status != "synced":
            doc = self._get_projector().project_item_version(item, version)
            stats = await self._get_recon().index_documents(
                tenant_id, [(item, version, doc)], mark_synced=True, wait=True,
            )
            vectors = stats.get("indexed", 0)
            state = "indexed"

        # Remove every vector that does not belong to the current version.
        await qdrant.delete_item_vectors_except_version(
            tenant_id=tenant_id, knowledge_item_id=item_id, keep_version_id=version.id,
        )
        return SyncResult(
            item_id=item_id, state=state, version_id=version.id, vectors=vectors,
            stale_removed=True, duration_ms=round((time.perf_counter() - t0) * 1000, 2),
        )

    async def _load_current(self, tenant_id: str, item_id: str):
        """Authoritative read of the item and its current ACTIVE version (or None)."""
        async with db_manager.session_factory() as db:
            item = (await db.execute(
                select(KnowledgeItem).where(
                    KnowledgeItem.id == item_id, KnowledgeItem.tenant_id == tenant_id,
                )
            )).scalar_one_or_none()
            version: Optional[KnowledgeVersion] = None
            if item is not None and item.is_active and item.current_version_id:
                version = (await db.execute(
                    select(KnowledgeVersion).where(
                        KnowledgeVersion.id == item.current_version_id,
                        KnowledgeVersion.tenant_id == tenant_id,
                        KnowledgeVersion.status == KnowledgeLifecycleStatus.ACTIVE.value,
                    )
                )).scalar_one_or_none()
        return item, version

    # ------------------------------------------------------------------
    # Delivery
    # ------------------------------------------------------------------

    async def sync_after_commit(
        self,
        tenant_id: str,
        item_id: str,
        reason: str,
        version_id: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
        item: Optional[KnowledgeItem] = None,
        version: Optional[KnowledgeVersion] = None,
    ) -> SyncResult:
        """Inline sync with timeout; on any failure fall back to a durable retry event.

        Never raises: the business change is already committed, so a sync problem must
        degrade to "eventually consistent" (event + sweep), not fail the user's request.
        """
        try:
            result = await asyncio.wait_for(
                self.sync_item(
                    tenant_id, item_id, item=item, version=version,
                    removed=reason in ("archived", "deleted"),
                ),
                timeout=timeout_seconds or self.INLINE_TIMEOUT_SECONDS,
            )
            logger.info(
                "knowledge.sync.completed",
                tenant_id=tenant_id, item_id=item_id, reason=reason, state=result.state,
                version_id=result.version_id, vectors=result.vectors, duration_ms=result.duration_ms,
            )
            return result
        except Exception as err:
            error = "timeout" if isinstance(err, asyncio.TimeoutError) else f"{type(err).__name__}: {err}"
            logger.warning(
                "knowledge.sync.inline_failed — deferring to indexer worker",
                tenant_id=tenant_id, item_id=item_id, reason=reason, error=error[:300],
            )
            queued = await self._enqueue_retry(tenant_id, item_id, reason, version_id)
            return SyncResult(
                item_id=item_id, state="deferred" if queued else "failed",
                version_id=version_id, error=error[:300],
                details={"retry_event_queued": queued},
            )

    async def _enqueue_retry(
        self, tenant_id: str, item_id: str, reason: str, version_id: Optional[str]
    ) -> bool:
        event_type = {
            "archived": EventNames.KNOWLEDGE_ARCHIVED,
            "deleted": EventNames.KNOWLEDGE_ARCHIVED,
            "rolled_back": EventNames.KNOWLEDGE_ROLLED_BACK,
            "created": EventNames.KNOWLEDGE_CREATED,
        }.get(reason, EventNames.KNOWLEDGE_VERSION_PUBLISHED)
        try:
            await event_bus.publish(
                KNOWLEDGE_EVENTS_STREAM,
                DomainEvent(
                    event_type=event_type,
                    tenant_id=tenant_id,
                    aggregate_type="knowledge",
                    aggregate_id=item_id,
                    payload={"item_id": item_id, "version_id": version_id, "reason": reason},
                ),
            )
            return True
        except Exception as pub_err:
            # Last line of defence: the periodic sweep re-syncs pending ACTIVE versions.
            logger.error(
                "knowledge.sync.retry_event_failed — relying on periodic sweep",
                tenant_id=tenant_id, item_id=item_id, error=str(pub_err)[:300],
            )
            return False

    async def sweep_pending(
        self, grace_seconds: Optional[int] = None, limit: Optional[int] = None
    ) -> List[SyncResult]:
        """Re-sync current ACTIVE versions that are still not indexed after a grace period."""
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=grace_seconds or self.SWEEP_GRACE_SECONDS)
        async with db_manager.session_factory() as db:
            rows = (await db.execute(
                select(KnowledgeItem.tenant_id, KnowledgeItem.id)
                .join(KnowledgeVersion, KnowledgeVersion.id == KnowledgeItem.current_version_id)
                .where(
                    KnowledgeItem.is_active.is_(True),
                    KnowledgeVersion.status == KnowledgeLifecycleStatus.ACTIVE.value,
                    KnowledgeVersion.semantic_status != "synced",
                    KnowledgeVersion.updated_at < cutoff,
                )
                .limit(limit or self.SWEEP_BATCH_LIMIT)
            )).all()

        results: List[SyncResult] = []
        for tenant_id, item_id in rows:
            try:
                results.append(await self.sync_item(tenant_id, item_id))
            except Exception as err:
                logger.warning("knowledge.sync.sweep_item_failed", tenant_id=tenant_id, item_id=item_id, error=str(err)[:300])
                results.append(SyncResult(item_id=item_id, state="failed", error=str(err)[:300]))
        if rows:
            logger.info(
                "knowledge.sync.sweep_completed",
                attempted=len(rows), synced=sum(1 for r in results if r.ok),
            )
        return results


knowledge_sync_service = KnowledgeSyncService()
