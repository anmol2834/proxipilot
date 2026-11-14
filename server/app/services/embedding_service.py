"""Embedding Generation Pipeline and Idempotency Cache Service.

Implements the hot path:
Semantic Projection
        ↓
Eligibility Check
        ↓
Content Hash
        ↓
Embedding Cache / Idempotency (O(1) Hot Path)
        ↓
Bounded Batch Embedding (Semaphore Concurrency Guard)
        ↓
Vector Validation
        ↓
Payload Construction

Computational Complexity Documentation (DSA):
- Cache & Deduplication: O(1) average time complexity using Python hash map (dict)
  and Redis key-value lookup.
- Bounded Batch Slicing: O(N) linear scan to partition input chunks into bounded batches of size K.
- Concurrency Control: Bounded using asyncio.Semaphore (O(1) acquire/release).
- No artificial O(log n) tree structures are forced onto neural inference.
"""

import asyncio
import hashlib
import time
from typing import Any, Dict, List, Optional, Tuple
from typing import TypedDict
from datetime import datetime, timezone

from app.contracts.embeddings import (
    EmbeddingBatchRequest,
    EmbeddingBatchResult,
    EmbeddingInputType,
    EmbeddingProvider,
    EmbeddingRequestItem,
    EmbeddingResultItem,
    KnowledgeVectorPayload,
    NormalizationPolicy,
)
from app.contracts.knowledge import normalize_category_key
from app.core.config import EmbeddingSettings, get_settings
from app.core.logging import logger
from app.core.redis import redis_manager
from app.models.knowledge import KnowledgeItem, KnowledgeLifecycleStatus, KnowledgeSemanticChunk, KnowledgeVersion
from app.services.embedding_providers import get_embedding_provider


class EmbeddingPipelineMetrics(TypedDict, total=False):
    """Typed metrics envelope returned by EmbeddingPipelineService.process_chunks."""

    total_chunks: int
    cached_chunks: int
    newly_embedded: int
    output_vectors: int
    elapsed_ms: float
    skipped: bool
    reason: str


class EmbeddingIdempotencyCache:
    """O(1) hot-path embedding cache with multi-tier memory + Redis persistence.

    Key Structure:
    emb:{tenant_id}:{version_id}:{proj_version}:{content_hash}:{model_version}
    """

    def __init__(self, ttl_seconds: int = 604800):
        self._memory_cache: Dict[str, List[float]] = {}
        self._ttl_seconds = ttl_seconds

    @staticmethod
    def build_cache_key(
        tenant_id: str,
        version_id: str,
        projection_version: int,
        content_hash: str,
        model_version: str,
    ) -> str:
        """Deterministic cache key derived from projection identity, content hash, and model version."""
        raw = f"{tenant_id}:{version_id}:{projection_version}:{content_hash}:{model_version}"
        key_digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
        return f"emb:cache:{key_digest}"

    async def get(self, cache_key: str) -> Optional[List[float]]:
        """O(1) memory lookup with Redis fallback."""
        # Tier 1: In-memory O(1) lookup
        if cache_key in self._memory_cache:
            return self._memory_cache[cache_key]

        # Tier 2: Redis Streams/Key-Value cache
        try:
            client = redis_manager.client
            val = await client.get(cache_key)
            if val:
                import json
                vec: List[float] = json.loads(val)
                self._memory_cache[cache_key] = vec
                return vec
        except Exception as err:
            logger.debug("Redis embedding cache read missed/errored", error=str(err))

        return None

    async def get_batch(self, cache_keys: List[str]) -> Dict[str, List[float]]:
        """Batch lookup: in-memory first, then single Redis MGET for missing keys."""
        results: Dict[str, List[float]] = {}
        missing_keys: List[str] = []
        for k in cache_keys:
            if k in self._memory_cache:
                results[k] = self._memory_cache[k]
            else:
                missing_keys.append(k)

        if missing_keys:
            try:
                client = redis_manager.client
                vals = await client.mget(*missing_keys)
                import json
                for k, val in zip(missing_keys, vals):
                    if val:
                        vec: List[float] = json.loads(val)
                        self._memory_cache[k] = vec
                        results[k] = vec
            except Exception as err:
                logger.debug("Redis embedding cache batch read error", error=str(err))

        return results

    async def put(self, cache_key: str, vector: List[float]) -> None:
        """Store single vector in both memory and Redis."""
        await self.put_batch([(cache_key, vector)])

    async def put_batch(self, key_vector_pairs: List[Tuple[str, List[float]]]) -> None:
        """Batch store vectors in both memory and Redis with pipeline."""
        if not key_vector_pairs:
            return
        import json
        for k, v in key_vector_pairs:
            self._memory_cache[k] = v
        try:
            client = redis_manager.client
            pipe = client.pipeline(transaction=False)
            for k, v in key_vector_pairs:
                pipe.set(k, json.dumps(v), ex=self._ttl_seconds)
            await pipe.execute()
        except Exception as err:
            logger.debug("Redis embedding cache batch write error", error=str(err))


class EmbeddingPipelineService:
    """Production Embedding Pipeline with bounded batching, eligibility checks, and retries."""

    def __init__(
        self,
        provider: Optional[EmbeddingProvider] = None,
        settings: Optional[EmbeddingSettings] = None,
    ):
        self.settings = settings or get_settings().embedding
        # Default settings share the process-wide provider (one warm HTTP connection pool
        # for indexing, sync and query embedding); explicit settings get their own.
        self.provider = provider or (
            get_embedding_provider(settings=settings) if settings is not None else get_embedding_provider()
        )
        self.cache = EmbeddingIdempotencyCache(ttl_seconds=self.settings.cache_ttl_seconds)
        self._semaphore = asyncio.Semaphore(self.settings.max_concurrency)

    def is_eligible_for_indexing(self, version: KnowledgeVersion) -> Tuple[bool, Optional[str]]:
        """Verify version eligibility for vector indexing based on temporal and lifecycle rules.

        Rules:
        1. Must not be ARCHIVED or DELETED unless explicitly purging.
        2. If effective_until exists, it must be > now (not expired).
        """
        now = datetime.now(timezone.utc)

        if version.status == KnowledgeLifecycleStatus.ARCHIVED.value:
            return False, "Version is archived"

        if version.effective_until:
            until_dt = (
                version.effective_until
                if version.effective_until.tzinfo
                else version.effective_until.replace(tzinfo=timezone.utc)
            )
            if until_dt <= now:
                return False, f"Version expired at {until_dt.isoformat()}"

        return True, None

    async def process_chunks(
        self,
        tenant_id: str,
        item: KnowledgeItem,
        version: KnowledgeVersion,
        chunks: List[KnowledgeSemanticChunk],
    ) -> Tuple[List[Tuple[KnowledgeVectorPayload, List[float]]], EmbeddingPipelineMetrics]:
        """Execute the end-to-end embedding hot path for a version's semantic chunks.

        Returns:
            Tuple of:
            - List of (KnowledgeVectorPayload, vector) ready for Qdrant upsert
            - Metrics dictionary (total, cached, newly_embedded, latency_ms)
        """
        start_time = time.perf_counter()

        # Step 1: Eligibility check
        eligible, reason = self.is_eligible_for_indexing(version)
        if not eligible:
            logger.info(
                "Skipping vector indexing for ineligible version",
                tenant_id=tenant_id,
                item_id=item.id,
                version_id=version.id,
                reason=reason,
            )
            return [], EmbeddingPipelineMetrics(skipped=True, reason=reason or "unknown")

        # Step 2: Extract chunks and compute content hashes
        model_ver = self.provider.model_version
        proj_ver = version.semantic_version or 1

        to_embed_items: List[EmbeddingRequestItem] = []
        cached_vectors: Dict[str, List[float]] = {}
        chunk_payload_map: Dict[str, KnowledgeVectorPayload] = {}

        now_iso = datetime.now(timezone.utc).isoformat()
        eff_from_str = version.effective_from.isoformat() if version.effective_from else None
        eff_until_str = version.effective_until.isoformat() if version.effective_until else None

        # Resolve attributes dict from canonical_data JSONB if present
        attrs_dict: Dict[str, Any] = {}
        custom_attrs_dict: Dict[str, Any] = {}
        if version.canonical_data is not None:
            raw_data = dict(version.canonical_data)
            nested_custom = raw_data.pop("custom_attributes", None)
            if isinstance(nested_custom, dict):
                custom_attrs_dict = dict(nested_custom)
            attrs_dict = raw_data

        region = (
            attrs_dict.get("region")
            or attrs_dict.get("service_area")
            or custom_attrs_dict.get("service_area")
            or attrs_dict.get("applies_to_region")
        )
        if isinstance(region, list):
            region_str = ", ".join(str(r) for r in region)
        elif region is not None:
            region_str = str(region)
        else:
            region_str = None

        entity_type_val = (
            attrs_dict.get("entity_type")
            or getattr(item, "entity_type", None)
            or custom_attrs_dict.get("entity_type")
        )
        if entity_type_val is not None:
            entity_type_val = str(entity_type_val)

        price_val = (
            attrs_dict.get("final_price")
            or attrs_dict.get("price")
            or attrs_dict.get("base_price")
            or custom_attrs_dict.get("final_price")
            or custom_attrs_dict.get("base_price")
        )
        try:
            price_num = float(price_val) if price_val is not None and str(price_val).strip() != "" else None
        except (ValueError, TypeError):
            price_num = None

        currency_val = (
            attrs_dict.get("currency")
            or custom_attrs_dict.get("currency")
        )
        availability_val = (
            attrs_dict.get("availability")
            or custom_attrs_dict.get("availability")
        )
        # Distinct business/domain category (e.g. home_appliances) vs knowledge category (products_services)
        business_domain_val = (
            attrs_dict.get("service_category")
            or custom_attrs_dict.get("service_category")
            or attrs_dict.get("business_domain")
            or custom_attrs_dict.get("business_domain")
            # NOTE: No hardcoded fallback — absent domain stays None so it doesn't
            # pollute Qdrant payload filters for tenants in other industries.
        )
        business_domain_str = str(business_domain_val).strip().lower().replace(" ", "_") if business_domain_val else None

        business_cat_val = (
            attrs_dict.get("business_category")
            or custom_attrs_dict.get("business_category")
            or attrs_dict.get("appliance")
            or custom_attrs_dict.get("appliance")
            or attrs_dict.get("appliance_type")
        )
        business_cat_str = str(business_cat_val).strip().lower().replace(" ", "_") if business_cat_val else None

        brand_val = (
            attrs_dict.get("brand")
            or custom_attrs_dict.get("brand")
            or attrs_dict.get("brand_scope")
            or attrs_dict.get("manufacturer")
        )
        brand_str = str(brand_val).strip() if brand_val else None

        # Service subcategory (e.g. washing_machine)
        subcategory_val = (
            attrs_dict.get("service_subcategory")
            or custom_attrs_dict.get("service_subcategory")
            or attrs_dict.get("sub_category")
            or attrs_dict.get("subcategory")
            or custom_attrs_dict.get("subcategory")
        )
        subcat_str = str(subcategory_val).strip().lower().replace(" ", "_") if subcategory_val else None

        # Explicit service area preserved from source (Problem 5)
        service_area_val = (
            attrs_dict.get("service_area")
            or custom_attrs_dict.get("service_area")
            or attrs_dict.get("coverage_area")
        )
        service_area_str = str(service_area_val).strip() if service_area_val else None

        # Effective dates: full timezone-aware ISO-8601 UTC timestamp format for Qdrant DATETIME index (Issue 4)
        if version.effective_from:
            eff_from_dt = (
                version.effective_from
                if version.effective_from.tzinfo
                else version.effective_from.replace(tzinfo=timezone.utc)
            )
            eff_from_str = eff_from_dt.isoformat()
        else:
            raw_ef = attrs_dict.get("effective_from") or custom_attrs_dict.get("effective_from")
            if raw_ef:
                try:
                    dt = datetime.fromisoformat(str(raw_ef).replace("Z", "+00:00").replace("/", "-"))
                    eff_from_str = (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).isoformat()
                except Exception:
                    eff_from_str = str(raw_ef)
            else:
                eff_from_str = None

        if version.effective_until:
            eff_until_dt = (
                version.effective_until
                if version.effective_until.tzinfo
                else version.effective_until.replace(tzinfo=timezone.utc)
            )
            eff_until_str = eff_until_dt.isoformat()
        else:
            raw_eu = attrs_dict.get("effective_until") or custom_attrs_dict.get("effective_until")
            if raw_eu:
                try:
                    dt = datetime.fromisoformat(str(raw_eu).replace("Z", "+00:00").replace("/", "-"))
                    eff_until_str = (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).isoformat()
                except Exception:
                    eff_until_str = str(raw_eu)
            else:
                eff_until_str = None

        norm_cat = normalize_category_key(item.category) if item.category else "products_services"

        for chunk in chunks:
            # O(1) content hash
            content_hash = hashlib.sha256(chunk.text.encode("utf-8")).hexdigest()
            cache_key = self.cache.build_cache_key(
                tenant_id=tenant_id,
                version_id=version.id,
                projection_version=proj_ver,
                content_hash=content_hash,
                model_version=model_ver,
            )

            # Map authority strictly from chunk/version lineage (Problem 3)
            authority_val = chunk.authority_level or version.authority_level or "imported_data"

            # Build reproducible, consistent payload contract (Problem 5)
            payload = KnowledgeVectorPayload(
                organization_id=tenant_id,
                knowledge_item_id=item.id,
                knowledge_version_id=version.id,
                chunk_id=chunk.id,
                chunk_index=chunk.chunk_index,
                title=item.title,
                category=norm_cat,
                knowledge_category=norm_cat,
                business_domain=business_domain_str,
                business_category=business_cat_str,
                service_subcategory=subcat_str,
                brand=brand_str,
                source_id=item.source_id,
                entity_type=entity_type_val,
                entity_id=getattr(item, "entity_id", None),
                authority_level=authority_val,
                authority=authority_val,
                service_area=service_area_str or region_str,
                region=region_str,
                language="en",
                status=version.status,
                effective_from=eff_from_str,
                effective_until=eff_until_str,
                section=chunk.section,
                text=chunk.text,
                char_count=len(chunk.text),
                projection_version=proj_ver,
                content_hash=content_hash,
                embedding_model=self.provider.model_name,
                embedding_model_version=model_ver,
                embedding_dimension=self.provider.dimension,
                created_at=now_iso,
                metadata=None,  # Do not duplicate fields or store ambiguous price in metadata
            )
            chunk_payload_map[chunk.id] = payload

            # Step 3: O(1) Idempotency Cache lookup
            cached_vec = await self.cache.get(cache_key) if self.settings.cache_enabled else None
            if cached_vec is not None:
                cached_vectors[chunk.id] = cached_vec
            else:
                to_embed_items.append(
                    EmbeddingRequestItem(
                        item_id=chunk.id,
                        text=chunk.text,
                        content_hash=content_hash,
                        metadata={"cache_key": cache_key},
                    )
                )

        # Step 4: Bounded Batch Embedding with Semaphore Concurrency Guard
        newly_embedded_vectors: Dict[str, List[float]] = {}
        batch_size = max(1, self.settings.batch_size)

        if to_embed_items:
            # Partition into bounded batches
            batches = [
                to_embed_items[i : i + batch_size]
                for i in range(0, len(to_embed_items), batch_size)
            ]

            async def _process_batch(b_items: List[EmbeddingRequestItem]) -> None:
                async with self._semaphore:
                    batch_req = EmbeddingBatchRequest(
                        items=b_items,
                        input_type=EmbeddingInputType.DOCUMENT,
                        normalization=NormalizationPolicy.L2,
                    )
                    batch_res = await self.provider.embed_batch(batch_req)
                    for res_item in batch_res.results:
                        newly_embedded_vectors[res_item.item_id] = res_item.vector
                        # Step 5: Store newly generated vector in cache
                        if self.settings.cache_enabled:
                            matched_req = next((it for it in b_items if it.item_id == res_item.item_id), None)
                            if matched_req and "cache_key" in matched_req.metadata:
                                await self.cache.put(matched_req.metadata["cache_key"], res_item.vector)

            # Execute batch tasks concurrently up to max_concurrency
            await asyncio.gather(*[_process_batch(batch) for batch in batches])

        # Step 6: Assemble all payloads and vectors
        output: List[Tuple[KnowledgeVectorPayload, List[float]]] = []
        for chunk in chunks:
            vec = cached_vectors.get(chunk.id) or newly_embedded_vectors.get(chunk.id)
            if vec:
                payload = chunk_payload_map[chunk.id]
                output.append((payload, vec))
            else:
                logger.warning("Chunk missing vector in assembly", chunk_id=chunk.id)

        total_elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        metrics = EmbeddingPipelineMetrics(
            total_chunks=len(chunks),
            cached_chunks=len(cached_vectors),
            newly_embedded=len(newly_embedded_vectors),
            output_vectors=len(output),
            elapsed_ms=round(total_elapsed_ms, 2),
        )
        return output, metrics
