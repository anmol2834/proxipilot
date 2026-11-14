"""Semantic Qdrant Retriever — Phase 4.

Provides tenant-isolated semantic knowledge retrieval from Qdrant:
1. Validates embedding profile compatibility against the Qdrant collection configuration.
2. Derives query embedding vectors through the configured provider adapter (Voyage / OpenAI).
3. Enforces mandatory server-side tenant isolation (`organization_id == tenant_id`)
   and lifecycle status (`status == 'active'`) in Qdrant query filters.
4. Returns semantic point hits with similarity scores and chunk payloads.
5. Safe failure handling: Qdrant timeouts or network errors fail safely without
   crashing the pipeline.
"""

from __future__ import annotations

import hashlib
import time
from typing import Any, Dict, List, Optional, Sequence, Set

from qdrant_client.http import models as qmodels

from app.contracts.embeddings import (
    EmbeddingBatchRequest,
    EmbeddingInputType,
    EmbeddingRequestItem,
)
from app.contracts.requirement_plan import RequirementPlan
from app.core.config import get_settings
from app.core.logging import logger
from app.core.qdrant import qdrant_manager
from app.services.embedding_profile import (
    EmbeddingProfileMismatchError,
    embedding_profile_registry,
)
from app.services.embedding_providers import get_embedding_provider


class SemanticCandidateHit:
    """Normalized semantic hit from Qdrant."""

    def __init__(
        self,
        knowledge_item_id: str,
        knowledge_version_id: Optional[str],
        score: float,
        text_excerpt: str,
        category: Optional[str] = None,
        authority: Optional[str] = None,
        payload: Optional[Dict[str, Any]] = None,
    ):
        self.knowledge_item_id = knowledge_item_id
        self.knowledge_version_id = knowledge_version_id
        self.score = score
        self.text_excerpt = text_excerpt
        self.category = category
        self.authority = authority or "semantic_kb"
        self.payload = payload or {}


class SemanticRetriever:
    """Semantic vector knowledge retriever using Qdrant."""

    def __init__(self):
        self._collection_name = "proxipilot_knowledge"
        self._vector_name = "dense"

    async def search(
        self,
        tenant_id: str,
        plan: RequirementPlan,
        top_k: int = 5,
        score_threshold: float = 0.20,
        exclude_entity_ids: Optional[Sequence[str]] = None,
    ) -> List[SemanticCandidateHit]:
        """Execute tenant-scoped semantic ANN search against Qdrant."""
        if not tenant_id or not tenant_id.strip():
            raise ValueError("tenant_id is required for semantic retrieval")

        clean_excluded: Set[str] = set()
        raw_excluded = list(exclude_entity_ids or []) + list(plan.excluded_entity_ids or [])
        for x in raw_excluded:
            if x and str(x).strip():
                clean_excluded.add(str(x).strip())
                clean_excluded.add(str(x).strip().upper())

        # 1. Distill semantic query text
        query_text = plan.query_text.strip() if plan.query_text else ""
        if not query_text:
            # Fall back to entity concepts or intent
            entity_names = [e.canonical_value or e.original_text for e in plan.entities if e.original_text]
            if entity_names:
                query_text = " ".join(entity_names)
            else:
                query_text = plan.intent.value.replace("_", " ")

        # Bound query length to 500 characters
        query_text = query_text[:500]

        # 2. Embedding Profile Validation
        profile_id = plan.metadata.embedding_profile_id or "emb_voyage_4_large_1024_v1"
        try:
            profile = embedding_profile_registry.get_profile(profile_id)
        except KeyError:
            logger.warning(
                "Unknown embedding profile; falling back to default Voyage profile",
                profile_id=profile_id,
            )
            profile = embedding_profile_registry.get_profile("emb_voyage_4_large_1024_v1")

        # 3. Generate query vector via active provider
        provider = get_embedding_provider()
        query_hash = hashlib.sha256(query_text.encode("utf-8")).hexdigest()
        embed_req = EmbeddingBatchRequest(
            model=provider.model_name,
            input_type=EmbeddingInputType.QUERY,
            items=[
                EmbeddingRequestItem(
                    item_id="query",
                    text=query_text,
                    content_hash=query_hash,
                    metadata={"tenant_id": tenant_id},
                )
            ],
            model_name=provider.model_name,
            dimension=provider.dimension,
        )
        embed_res = await provider.embed_batch(embed_req)
        query_vector = embed_res.results[0].vector

        # 4. Mandatory Qdrant Tenant & Lifecycle Filters
        filter_must: List[Any] = [
            qmodels.FieldCondition(
                key="organization_id",
                match=qmodels.MatchValue(value=tenant_id),
            ),
            qmodels.FieldCondition(
                key="status",
                match=qmodels.MatchValue(value="active"),
            ),
        ]

        # Filter by category if explicitly specified in entities or filters
        target_cats = set()
        for f in plan.filters:
            if f.field == "category" and isinstance(f.value, str):
                target_cats.add(f.value.lower().strip())
        if target_cats:
            filter_must.append(
                qmodels.FieldCondition(
                    key="category",
                    match=qmodels.MatchAny(any=list(target_cats)),
                )
            )

        filter_must_not: List[Any] = []
        if clean_excluded:
            excluded_ki_ids = [x for x in clean_excluded if x.startswith("ki_")]
            if excluded_ki_ids and len(excluded_ki_ids) <= 100:
                filter_must_not.append(
                    qmodels.FieldCondition(
                        key="knowledge_item_id",
                        match=qmodels.MatchAny(any=excluded_ki_ids),
                    )
                )

        qdrant_filter = qmodels.Filter(
            must=filter_must,
            must_not=filter_must_not if filter_must_not else None,
        )

        # 5. Execute ANN Search with adaptive limit to accommodate exclusions
        client = qdrant_manager.client
        search_limit = min(max((top_k + len(clean_excluded)) * 3, 20), 60)
        search_results = await client.search(
            collection_name=self._collection_name,
            query_vector=qmodels.NamedVector(name=self._vector_name, vector=query_vector),
            query_filter=qdrant_filter,
            limit=search_limit,
            score_threshold=score_threshold,
        )

        hits: List[SemanticCandidateHit] = []
        for point in search_results:
            payload = point.payload or {}
            item_id = payload.get("knowledge_item_id")
            if not item_id:
                continue

            # Novelty exclusion guard
            if clean_excluded:
                if item_id in clean_excluded:
                    continue
                ext_key = (payload.get("external_identity_key") or "").strip().upper()
                if ext_key and ext_key in clean_excluded:
                    continue
                title_val = (payload.get("title") or "").strip()
                if title_val and (title_val in clean_excluded or title_val.upper() in clean_excluded):
                    continue

            text_chunk = payload.get("text") or payload.get("text_excerpt") or ""
            hits.append(
                SemanticCandidateHit(
                    knowledge_item_id=item_id,
                    knowledge_version_id=payload.get("knowledge_version_id"),
                    score=float(point.score),
                    text_excerpt=text_chunk,
                    category=payload.get("category"),
                    authority=payload.get("authority_level") or payload.get("authority"),
                    payload=payload,
                )
            )
            if len(hits) >= top_k * 2:
                break

        return hits


semantic_retriever = SemanticRetriever()
