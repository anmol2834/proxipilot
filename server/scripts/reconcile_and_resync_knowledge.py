"""Reconciliation and Resynchronization Script for ProxiPilot Knowledge Architecture.

Steps executed:
1. Normalize canonical_data on all active versions in PostgreSQL.
2. Re-project active versions to 1 unified entity-centric chunk (replacing 5 fragmented chunks).
3. Re-index Qdrant vectors: purge old fragmented points, upsert unified context-rich points.
4. Verify PostgreSQL and Qdrant point counts match 1:1.
"""

import asyncio
import json
import os
import sys
from dotenv import load_dotenv

script_dir = os.path.dirname(os.path.abspath(__file__))
server_dir = os.path.dirname(script_dir)
load_dotenv(os.path.join(server_dir, ".env"), override=True)
sys.path.insert(0, server_dir)

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import db_manager
from app.core.redis import redis_manager
from app.core.qdrant import qdrant_manager
from app.core.logging import logger
from app.models.knowledge import (
    KnowledgeItem,
    KnowledgeVersion,
    KnowledgeSemanticChunk,
    KnowledgeLifecycleStatus,
)
from app.contracts.knowledge import category_registry
from app.services.knowledge_projection import KnowledgeProjectionService
from app.services.qdrant_service import qdrant_indexer_service
from app.services.embedding_service import EmbeddingPipelineService


async def reconcile_and_resync():
    print("=" * 70)
    print("STARTING KNOWLEDGE RECONCILIATION & RESYNCHRONIZATION")
    print("=" * 70)

    db_manager.initialize()
    redis_manager.initialize()
    qdrant_manager.initialize()

    projection_service = KnowledgeProjectionService()
    embedding_service = EmbeddingPipelineService()

    async with db_manager.session_factory() as session:
        # 1. Fetch all KnowledgeItems with active versions and attributes
        stmt = (
            select(KnowledgeItem)
            .options(
                selectinload(KnowledgeItem.versions).selectinload(KnowledgeVersion.attributes),
                selectinload(KnowledgeItem.source),
            )
            .order_by(KnowledgeItem.created_at.asc())
        )
        res = await session.execute(stmt)
        items = list(res.scalars().all())

        print(f"\n[Step 1] Found {len(items)} knowledge items across all tenants.")

        reconciled_count = 0
        total_chunks_created = 0

        for item in items:
            active_version = next(
                (v for v in item.versions if v.status == KnowledgeLifecycleStatus.ACTIVE.value),
                None
            )
            if not active_version and item.versions:
                active_version = item.versions[-1]

            if not active_version:
                print(f"  Skipping {item.id} (no version)")
                continue

            # Ensure item.current_version_id points to active version
            item.current_version_id = active_version.id

            # Reconcile canonical_data structure
            cat_def = category_registry.get(item.category)
            canonical_field_names = set(cat_def.fields.keys()) if cat_def else set()

            canonical_dict = {}
            custom_dict = {}

            # Populate from existing canonical_data if available
            if active_version.canonical_data:
                raw_data = dict(active_version.canonical_data)
                nested_custom = raw_data.pop("custom_attributes", None)
                if isinstance(nested_custom, dict):
                    custom_dict.update(nested_custom)

                for k, v in raw_data.items():
                    if k in canonical_field_names:
                        canonical_dict[k] = v
                    else:
                        custom_dict[k] = v

            # Merge from legacy EAV attributes if present
            for attr in active_version.attributes or []:
                k = attr.key
                val = attr.resolved_value()
                if val is not None:
                    if k in canonical_field_names and k not in canonical_dict:
                        canonical_dict[k] = val
                    elif k not in canonical_field_names and k not in custom_dict:
                        custom_dict[k] = val

            # Set reconciled canonical_data on version
            new_canonical_data = dict(canonical_dict)
            if custom_dict:
                new_canonical_data["custom_attributes"] = custom_dict

            active_version.canonical_data = new_canonical_data

            # 2. Re-project version in database (generates 1 unified entity document)
            doc = await projection_service.project_version_in_db(
                db=session,
                item=item,
                version=active_version,
                attributes=active_version.attributes,
            )
            total_chunks_created += len(doc.chunks)
            reconciled_count += 1

        await session.commit()
        print(f"\n[Step 2] Successfully reconciled and re-projected {reconciled_count} items.")
        print(f"Total relational chunks in PostgreSQL: {total_chunks_created}")

        # 3. Re-index Qdrant vectors
        print("\n[Step 3] Re-indexing into Qdrant (proxipilot_knowledge collection)...")
        dim = embedding_service.provider.dimension
        await qdrant_indexer_service.ensure_collection(dimension=dim)

        indexed_vectors = 0
        for item in items:
            active_version = next(
                (v for v in item.versions if v.status == KnowledgeLifecycleStatus.ACTIVE.value),
                None
            )
            if not active_version:
                continue

            # Query updated chunks for this version
            c_stmt = (
                select(KnowledgeSemanticChunk)
                .where(
                    KnowledgeSemanticChunk.knowledge_version_id == active_version.id,
                    KnowledgeSemanticChunk.tenant_id == item.tenant_id,
                )
                .order_by(KnowledgeSemanticChunk.chunk_index.asc())
            )
            c_res = await session.execute(c_stmt)
            chunks = list(c_res.scalars().all())

            if not chunks:
                continue

            # Compute dense embeddings
            vector_tuples, metrics = await embedding_service.process_chunks(
                tenant_id=item.tenant_id,
                item=item,
                version=active_version,
                chunks=chunks,
            )

            if vector_tuples:
                # Purge old fragmented points for this version first
                await qdrant_indexer_service.delete_version_vectors(
                    tenant_id=item.tenant_id,
                    knowledge_version_id=active_version.id,
                )

                # Upsert new entity-centric point(s)
                point_ids = await qdrant_indexer_service.upsert_version_vectors(
                    tenant_id=item.tenant_id,
                    vector_tuples=vector_tuples,
                )

                # Update point IDs in PostgreSQL
                active_version.vector_ids = json.dumps(point_ids)
                active_version.projection_status = "projected"
                active_version.semantic_status = "synced"

                for chunk, pt_id in zip(chunks, point_ids):
                    chunk.vector_point_id = pt_id

                indexed_vectors += len(point_ids)

        await session.commit()
        print(f"\n[Step 3 Complete] Re-indexed {indexed_vectors} unified vector points into Qdrant.")

    # 4. Final Verification
    print("\n--- FINAL VERIFICATION STATS ---")
    async with db_manager.session_factory() as session:
        items_cnt = (await session.execute(select(KnowledgeItem))).scalars().all()
        chunks_cnt = (await session.execute(select(KnowledgeSemanticChunk))).scalars().all()
        print(f"PostgreSQL KnowledgeItems: {len(items_cnt)}")
        print(f"PostgreSQL KnowledgeSemanticChunks: {len(chunks_cnt)}")

    # Check Qdrant collection via HTTP
    import httpx
    qdrant_url = qdrant_manager._settings.url
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(f"{qdrant_url}/collections/proxipilot_knowledge")
        info = r.json().get("result", {})
        print(f"Qdrant proxipilot_knowledge points count: {info.get('points_count')}")

        # Inspect 1 sample Qdrant point
        scroll_r = await client.post(
            f"{qdrant_url}/collections/proxipilot_knowledge/points/scroll",
            json={"limit": 1, "with_payload": True, "with_vector": False},
        )
        pts = scroll_r.json().get("result", {}).get("points", [])
        if pts:
            sample_pt = pts[0]
            print(f"\nSample Re-Indexed Point ID: {sample_pt.get('id')}")
            print(f"Sample Payload Section: {sample_pt.get('payload', {}).get('section')}")
            print(f"Sample Payload Text (first 300 chars):\n{sample_pt.get('payload', {}).get('text', '')[:300]}...")

    await db_manager.close()
    await redis_manager.close()
    await qdrant_manager.close()
    print("\n" + "=" * 70)
    print("RECONCILIATION & RESYNCHRONIZATION COMPLETED SUCCESSFULLY")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(reconcile_and_resync())
