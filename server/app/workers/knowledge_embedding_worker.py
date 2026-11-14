"""Knowledge Embedding and Vector Indexing Background Worker.

Consumes: 'knowledge-events' Redis Stream.
Consumer Group: 'knowledge-indexer-group'.

Handled Events:
- knowledge.version_published
- knowledge.semantic_projection.ready
- knowledge.rolled_back
- knowledge.archived

Responsibilities:
1. Verify version and tenant authority against canonical PostgreSQL.
2. Ensure semantic chunks exist (or trigger deterministic projection).
3. Check temporal & lifecycle eligibility.
4. Execute embedding pipeline with O(1) content-hash cache and bounded batching.
5. Upsert reproducible dense vectors into shared logical Qdrant collection with tenant payload index.
6. Persist generated Qdrant point UUIDs back to knowledge_versions.vector_ids.
7. Safely delete Qdrant vectors upon archiving.
"""

from datetime import datetime, timezone
import json
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.contracts.events import EventNames
from app.core.config import get_ai_worker_settings
from app.core.database import db_manager
from app.core.logging import logger
from app.core.messaging import DomainEvent
from app.core.qdrant import qdrant_manager
from app.models.knowledge import KnowledgeItem, KnowledgeSemanticChunk, KnowledgeVersion
from app.services.embedding_service import EmbeddingPipelineService
from app.services.knowledge_projection import KnowledgeProjectionService
from app.services.qdrant_service import qdrant_indexer_service
from app.workers.base import BaseWorker


class KnowledgeEmbeddingWorker(BaseWorker):
    """Event-driven worker for asynchronous vector embedding and Qdrant indexing."""

    def __init__(self, standalone: bool = True):
        settings = get_ai_worker_settings()
        super().__init__(
            worker_name="knowledge-indexer",
            stream_name="knowledge-events",
            group_name="knowledge-indexer-group",
            concurrency=settings.worker.ai_worker_concurrency,
            max_retries=3,
            standalone=standalone,
        )
        self.embedding_service = EmbeddingPipelineService()
        self.projection_service = KnowledgeProjectionService()

    async def initialize(self) -> None:
        """Initialize worker infrastructure and ensure Qdrant collection schema."""
        await super().initialize()
        if self.standalone:
            qdrant_manager.initialize()
        dim = self.embedding_service.provider.dimension
        await qdrant_indexer_service.ensure_collection(dimension=dim)
        logger.info("KnowledgeEmbeddingWorker initialized", dimension=dim)

    async def shutdown(self) -> None:
        """Graceful shutdown releasing resources."""
        if self.standalone:
            await qdrant_manager.close()
        await super().shutdown()

    async def process_event(self, event: DomainEvent) -> None:
        """Converge one item's vectors to its current PostgreSQL state.

        Every knowledge event (created / published / rolled back / archived / projection
        ready) is handled the same way: ``knowledge_sync_service.sync_item`` reads the
        item's current approved version and makes Qdrant match it (index current, purge
        stale versions, or purge everything when archived/deleted). This is idempotent
        and order-independent, so retries, duplicates and out-of-order delivery are safe.
        Only tenant_id + item_id are required (rollback events used to be dropped for
        lacking a version_id).
        """
        from app.services.knowledge_sync import knowledge_sync_service

        tenant_id = event.tenant_id
        payload = event.payload or {}
        item_id = payload.get("item_id") or payload.get("knowledge_item_id") or event.aggregate_id

        if not tenant_id or not item_id:
            logger.warning(
                "Knowledge event missing tenant/item identity; skipping",
                event_id=event.event_id,
                event_type=event.event_type,
            )
            return

        result = await knowledge_sync_service.sync_item(tenant_id=tenant_id, item_id=item_id)
        logger.info(
            "Knowledge item synced from event",
            event_type=event.event_type,
            tenant_id=tenant_id,
            item_id=item_id,
            state=result.state,
            version_id=result.version_id,
            vectors=result.vectors,
            duration_ms=result.duration_ms,
        )

    async def _index_version(self, tenant_id: str, item_id: str, version_id: str) -> None:
        """Validate and index version chunks into Qdrant."""
        async with db_manager.session_factory() as db:
            # Query authoritative PostgreSQL record with tenant filter
            stmt = (
                select(KnowledgeItem)
                .where(
                    KnowledgeItem.id == item_id,
                    KnowledgeItem.tenant_id == tenant_id,
                )
                .options(
                    selectinload(KnowledgeItem.versions),
                    selectinload(KnowledgeItem.source),
                )
            )
            res = await db.execute(stmt)
            item = res.scalar_one_or_none()

            if not item:
                logger.warning(
                    "KnowledgeItem not found for indexing event; skipping",
                    tenant_id=tenant_id,
                    item_id=item_id,
                )
                return

            version = next((v for v in item.versions if v.id == version_id), None)
            if not version:
                logger.warning(
                    "KnowledgeVersion not found for item; skipping",
                    tenant_id=tenant_id,
                    item_id=item_id,
                    version_id=version_id,
                )
                return

            # Check eligibility
            eligible, reason = self.embedding_service.is_eligible_for_indexing(version)
            if not eligible:
                logger.info(
                    "KnowledgeVersion ineligible for vector indexing",
                    tenant_id=tenant_id,
                    version_id=version_id,
                    reason=reason,
                )
                return

            # Fetch existing semantic chunks
            chunks_stmt = (
                select(KnowledgeSemanticChunk)
                .where(
                    KnowledgeSemanticChunk.knowledge_version_id == version_id,
                    KnowledgeSemanticChunk.tenant_id == tenant_id,
                )
                .order_by(KnowledgeSemanticChunk.chunk_index.asc())
            )
            c_res = await db.execute(chunks_stmt)
            chunks = list(c_res.scalars().all())

            # If no semantic chunks exist yet, project them now
            if not chunks:
                logger.info(
                    "Projecting semantic chunks before embedding",
                    tenant_id=tenant_id,
                    item_id=item_id,
                    version_id=version_id,
                )
                doc = await self.projection_service.project_version_in_db(
                    db=db,
                    item=item,
                    version=version,
                    attributes=None,
                )
                await db.commit()

                # Re-query saved chunks
                c_res = await db.execute(chunks_stmt)
                chunks = list(c_res.scalars().all())

            if not chunks:
                logger.warning(
                    "No chunks generated for version; skipping vector indexing",
                    tenant_id=tenant_id,
                    version_id=version_id,
                )
                return

            # Execute embedding pipeline (O(1) cache + bounded batching)
            vector_tuples, metrics = await self.embedding_service.process_chunks(
                tenant_id=tenant_id,
                item=item,
                version=version,
                chunks=chunks,
            )

            if not vector_tuples:
                logger.info(
                    "Embedding pipeline produced zero vectors",
                    tenant_id=tenant_id,
                    version_id=version_id,
                    metrics=metrics,
                )
                return

            # Purge previous vector points for this item to guarantee zero stale/orphan points
            if version.version_number > 1:
                try:
                    await qdrant_indexer_service.delete_item_vectors(
                        tenant_id=tenant_id,
                        knowledge_item_id=item_id,
                    )
                except Exception as del_err:
                    logger.debug(
                        "Pre-delete skipped",
                        item_id=item_id,
                        error=str(del_err),
                    )

            # Upsert into Qdrant
            point_ids = await qdrant_indexer_service.upsert_version_vectors(
                tenant_id=tenant_id,
                vector_tuples=vector_tuples,
            )

            # Persist sync statuses back to authoritative PostgreSQL record
            now_utc = datetime.now(timezone.utc)
            version.projection_status = "projected"
            version.semantic_status = "synced"
            version.last_projected_at = now_utc

            # Link vector_point_id to knowledge_semantic_chunks in PostgreSQL
            for chunk, pt_id in zip(chunks, point_ids):
                chunk.vector_point_id = pt_id

            await db.commit()

            logger.info(
                "Successfully indexed knowledge version into Qdrant",
                tenant_id=tenant_id,
                item_id=item_id,
                version_id=version_id,
                vector_count=len(point_ids),
                metrics=metrics,
            )
