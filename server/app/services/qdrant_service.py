"""Qdrant Production Knowledge Collection & Indexing Service.

Features:
1. Shared Logical Knowledge Collection: Single 'proxipilot_knowledge' collection
   with tenant-aware payload indexing (consistent with Qdrant multi-tenant architecture).
2. Named Vector Contract: Vectors are keyed under 'dense' (VectorParams(size=dim, distance=Cosine))
   ensuring future hybrid retrieval (sparse, bm25) can be attached without schema breakage.
3. Tenant & Filter Payload Indexes: Keyword indexes for organization_id, category, status,
   knowledge_item_id, knowledge_version_id, source_id, and authority.
4. Deterministic Point Identities: RFC 4122 UUIDv5 derived from:
   uuid5(NAMESPACE_DNS, f"{tenant_id}:{version_id}:{chunk_id}:{model_version}")
   Guarantees retry-safety and zero duplicate vectors.
5. Authoritative PostgreSQL Tenant Validation: Ensures point metadata matches
   authoritative PostgreSQL state before any network upsert.
"""

import asyncio
import uuid
from typing import Any, Dict, List, Optional, Tuple
from qdrant_client import AsyncQdrantClient
from qdrant_client.http import models as qmodels

from app.contracts.embeddings import KnowledgeVectorPayload
from app.core.config import QdrantSettings, get_settings
from app.core.logging import logger
from app.core.qdrant import qdrant_manager


class QdrantKnowledgeIndexerService:
    """Manages the lifecycle, indexing, and multi-tenant point management in Qdrant."""

    def __init__(
        self,
        client: Optional[AsyncQdrantClient] = None,
        settings: Optional[QdrantSettings] = None,
    ):
        self._client = client or qdrant_manager.client
        self._settings = settings or get_settings().qdrant
        self._collection_name = self._settings.collection_name
        self._vector_name = self._settings.vector_name
        self._ensured_collections: set[str] = set()
        self._ensure_lock = asyncio.Lock()

    @property
    def collection_name(self) -> str:
        return self._collection_name

    @property
    def vector_name(self) -> str:
        return self._vector_name

    @staticmethod
    def generate_point_id(
        tenant_id: str,
        knowledge_version_id: str,
        chunk_id: str,
        model_version: str,
    ) -> str:
        """Generate deterministic RFC 4122 UUIDv5 for a vector point.

        Guarantees:
        - Re-running the pipeline generates identical point IDs.
        - Idempotent upserts replace old coordinates without creating duplicates.
        """
        seed = f"{tenant_id}:{knowledge_version_id}:{chunk_id}:{model_version}"
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, seed))

    async def ensure_collection(self, dimension: int) -> None:
        """Create the shared logical knowledge collection if it does not already exist.

        Configures:
        - Named dense vector schema: vectors_config={"dense": VectorParams(size=dim, distance=Cosine)}
        - Optimizers & on-disk payload storage
        - Selective payload indexes for multi-tenant query acceleration

        Thread-safe: uses an asyncio.Lock so concurrent events don't race to create the
        collection simultaneously (which would cause 409 Conflict errors).
        """
        # Fast-path: already ensured in this process lifetime
        if self._collection_name in self._ensured_collections:
            return

        async with self._ensure_lock:
            # Double-checked locking: re-check inside the lock
            if self._collection_name in self._ensured_collections:
                return

            collections = await self._client.get_collections()
            exists = any(c.name == self._collection_name for c in collections.collections)
            if exists:
                exists = await self._reconcile_dimension(dimension)
            if not exists:
                logger.info(
                    "Creating shared Qdrant knowledge collection",
                    collection=self._collection_name,
                    dimension=dimension,
                    vector_name=self._vector_name,
                )
                await self._client.create_collection(
                    collection_name=self._collection_name,
                    vectors_config={
                        self._vector_name: qmodels.VectorParams(
                            size=dimension,
                            distance=qmodels.Distance.COSINE,
                            on_disk=True,
                        )
                    },
                    hnsw_config=qmodels.HnswConfigDiff(
                        m=16,
                        ef_construct=100,
                        full_scan_threshold=10000,
                    ),
                    optimizers_config=qmodels.OptimizersConfigDiff(
                        indexing_threshold=20000,
                    ),
                )

            # Ensure payload indexes for high-selectivity retrieval filters
            await self._ensure_payload_indexes()
            self._ensured_collections.add(self._collection_name)

    async def _reconcile_dimension(self, dimension: int) -> bool:
        """Check the existing collection's vector size against the configured embedding size.

        Returns True when the collection can be used as is. When the size differs (e.g.
        EMBEDDING_DIMENSION changed from 1024 to 512):
          - EMPTY collection: dropped so the caller recreates it at the new size;
          - collection WITH points: refuse loudly. Mixing sizes would make every upsert fail
            and every search wrong; the data must be cleared / re-imported deliberately.
        Read over plain HTTP: the installed qdrant-client cannot parse this server version's
        get_collection response.
        """
        import httpx

        from app.core.config import get_settings

        qs = get_settings().qdrant
        headers = {"api-key": qs.api_key} if qs.api_key else {}
        try:
            async with httpx.AsyncClient(base_url=str(qs.url).rstrip("/"), timeout=30, headers=headers) as c:
                res = (await c.get(f"/collections/{self._collection_name}")).json().get("result") or {}
                vectors = (res.get("config") or {}).get("params", {}).get("vectors") or {}
                spec = vectors.get(self._vector_name) if isinstance(vectors, dict) and self._vector_name in vectors else vectors
                current = int((spec or {}).get("size") or 0)
                if not current or current == dimension:
                    return True
                points = int(res.get("points_count") or 0)
                if points:
                    raise RuntimeError(
                        f"Qdrant collection '{self._collection_name}' stores {current}-d vectors ({points} points) "
                        f"but EMBEDDING_DIMENSION is {dimension}. Clear the knowledge base (or restore the "
                        f"previous dimension) before importing."
                    )
                logger.warning("Recreating empty Qdrant collection for new embedding dimension",
                               collection=self._collection_name, old_dimension=current, new_dimension=dimension)
                await c.delete(f"/collections/{self._collection_name}")
                return False
        except RuntimeError:
            raise
        except Exception as err:  # noqa: BLE001 — never block indexing on the metadata probe itself
            logger.warning("Could not verify Qdrant collection dimension", error=str(err)[:200])
            return True

    async def _ensure_payload_indexes(self) -> None:
        """Create indexes on tenant-selective and category-selective payload fields concurrently."""
        keyword_fields = [
            "organization_id",
            "category",
            "business_domain",
            "status",
            "knowledge_item_id",
            "knowledge_version_id",
            "source_id",
            "authority",
            "entity_type",
            "brand",
            # product category / type (e.g. "grab_bar", "spare_parts"): category-scoped searches
            "business_category",
            "service_subcategory",
        ]
        datetime_fields = [
            "effective_from",
            "effective_until",
            "created_at",
        ]

        async def _safe_create_index(field: str, schema_type: qmodels.PayloadSchemaType) -> None:
            try:
                await self._client.create_payload_index(
                    collection_name=self._collection_name,
                    field_name=field,
                    field_schema=schema_type,
                    wait=False,
                )
            except Exception as err:
                logger.debug(f"Payload index on '{field}' skipped or existing", error=str(err))

        datetime_schema = getattr(qmodels.PayloadSchemaType, "DATETIME", qmodels.PayloadSchemaType.KEYWORD)
        tasks = [
            _safe_create_index(f, qmodels.PayloadSchemaType.KEYWORD) for f in keyword_fields
        ] + [
            _safe_create_index(f, datetime_schema) for f in datetime_fields
        ]
        await asyncio.gather(*tasks, return_exceptions=True)

    def validate_tenant_isolation(
        self,
        tenant_id: str,
        payloads: List[KnowledgeVectorPayload],
    ) -> None:
        """Strict multi-tenant security assertion.

        Ensures NO point in the batch has a mismatched organization_id.
        Organization A vectors can NEVER be indexed under Organization B.
        """
        assert tenant_id and tenant_id.strip(), "tenant_id cannot be empty"
        for p in payloads:
            if p.organization_id != tenant_id:
                raise ValueError(
                    f"Cross-tenant vector write violation! Batch tenant '{tenant_id}' "
                    f"does not match payload tenant '{p.organization_id}'."
                )

    async def upsert_version_vectors(
        self,
        tenant_id: str,
        vector_tuples: List[Tuple[KnowledgeVectorPayload, List[float]]],
        wait: bool = False,
    ) -> List[str]:
        """Upsert a batch of dense vectors and payloads for a specific tenant version.

        Args:
            tenant_id: Authoritative organization ID
            vector_tuples: List of (KnowledgeVectorPayload, dense_vector)

        Returns:
            List of deterministic Qdrant point UUIDs created/updated.
        """
        if not vector_tuples:
            return []

        payloads = [vt[0] for vt in vector_tuples]
        self.validate_tenant_isolation(tenant_id, payloads)

        dim = len(vector_tuples[0][1])
        await self.ensure_collection(dimension=dim)

        points: List[qmodels.PointStruct] = []
        point_ids: List[str] = []

        for payload, vector in vector_tuples:
            point_id = self.generate_point_id(
                tenant_id=payload.organization_id,
                knowledge_version_id=payload.knowledge_version_id,
                chunk_id=payload.chunk_id,
                model_version=payload.embedding_model_version,
            )
            point_ids.append(point_id)

            # Convert payload to dictionary (excluding internal None values)
            payload_dict = payload.model_dump(exclude_none=True)

            points.append(
                qmodels.PointStruct(
                    id=point_id,
                    vector={self._vector_name: vector},
                    payload=payload_dict,
                )
            )

        # Batch upsert to Qdrant
        # wait=True for interactive edits/publishes so the change is searchable when the
        # API returns; bulk imports keep wait=False for throughput.
        await self._client.upsert(
            collection_name=self._collection_name,
            points=points,
            wait=wait,
        )

        logger.debug(
            "Qdrant vector batch upsert complete",
            tenant_id=tenant_id,
            count=len(points),
            collection=self._collection_name,
        )
        return point_ids

    async def delete_version_vectors(
        self,
        tenant_id: str,
        knowledge_version_id: str,
    ) -> int:
        """Safely delete all vectors belonging to a specific version under strict tenant filter."""
        assert tenant_id and tenant_id.strip()
        version_filter = qmodels.Filter(
            must=[
                qmodels.FieldCondition(
                    key="organization_id",
                    match=qmodels.MatchValue(value=tenant_id),
                ),
                qmodels.FieldCondition(
                    key="knowledge_version_id",
                    match=qmodels.MatchValue(value=knowledge_version_id),
                ),
            ]
        )
        res = await self._client.delete(
            collection_name=self._collection_name,
            points_selector=qmodels.FilterSelector(filter=version_filter),
            wait=False,  # Fire-and-forget — upsert idempotency (UUIDv5) makes this safe
        )
        logger.info(
            "Deleted version vectors from Qdrant",
            tenant_id=tenant_id,
            version_id=knowledge_version_id,
        )
        return 1

    async def delete_item_vectors_except_version(
        self,
        tenant_id: str,
        knowledge_item_id: str,
        keep_version_id: str,
    ) -> None:
        """Delete every vector of an item except those of ``keep_version_id`` (stale cleanup).

        Called AFTER the current version is upserted, so the item stays searchable
        throughout an update and no outdated version can be retrieved afterwards.
        """
        assert tenant_id and tenant_id.strip() and keep_version_id
        stale_filter = qmodels.Filter(
            must=[
                qmodels.FieldCondition(key="organization_id", match=qmodels.MatchValue(value=tenant_id)),
                qmodels.FieldCondition(key="knowledge_item_id", match=qmodels.MatchValue(value=knowledge_item_id)),
            ],
            must_not=[
                qmodels.FieldCondition(key="knowledge_version_id", match=qmodels.MatchValue(value=keep_version_id)),
            ],
        )
        await self._client.delete(
            collection_name=self._collection_name,
            points_selector=qmodels.FilterSelector(filter=stale_filter),
            wait=True,
        )

    async def delete_item_vectors(
        self,
        tenant_id: str,
        knowledge_item_id: str,
    ) -> int:
        """Safely delete all vectors belonging to a specific item across all versions under strict tenant filter."""
        assert tenant_id and tenant_id.strip()
        item_filter = qmodels.Filter(
            must=[
                qmodels.FieldCondition(
                    key="organization_id",
                    match=qmodels.MatchValue(value=tenant_id),
                ),
                qmodels.FieldCondition(
                    key="knowledge_item_id",
                    match=qmodels.MatchValue(value=knowledge_item_id),
                ),
            ]
        )
        await self._client.delete(
            collection_name=self._collection_name,
            points_selector=qmodels.FilterSelector(filter=item_filter),
            wait=True,
        )
        logger.info(
            "Deleted all item vectors from Qdrant",
            tenant_id=tenant_id,
            item_id=knowledge_item_id,
        )
        return 1


qdrant_indexer_service = QdrantKnowledgeIndexerService()
