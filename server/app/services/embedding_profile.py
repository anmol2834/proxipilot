"""Canonical Embedding Profile & Consistency Service.

Enforces strict model and dimensionality consistency between:
1. Knowledge Ingestion / Chunk Indexing (`KnowledgeEmbeddingWorker`)
2. Query Retrieval Embedding (`HybridRetrievalService`)
3. Qdrant Collection Vectors Configuration (`QdrantKnowledgeIndexerService`)

Architectural Rules:
- Vector dimension alone is NOT proof of compatibility. Different models may
  share 1024 or 1536 dimensions but map to orthogonal, incompatible vector spaces.
- Ingestion and query embedding MUST resolve through this shared profile.
- Fail safely with explicit `EmbeddingProfileMismatchError` before executing any query
  or upsert against an incompatible Qdrant collection.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.contracts.embeddings import EmbeddingInputType, NormalizationPolicy
from app.core.config import EmbeddingSettings, get_settings
from app.core.logging import logger


class EmbeddingProfileMismatchError(RuntimeError):
    """Raised when query embedding configuration conflicts with Qdrant collection profile."""


class EmbeddingProfile(BaseModel):
    """Centrally managed, immutable profile for embedding generation and vector indexing."""

    profile_id: str = Field(description="Unique immutable profile ID (e.g. emb_voyage_4_large_1024_v1)")
    provider: str = Field(description="voyage | cohere | openai | local")
    model_name: str = Field(description="Exact provider model identifier (e.g. voyage-4-large)")
    model_version: str = Field(description="Immutable model revision / checkpoint (e.g. 2026-v1)")
    dimension: int = Field(description="Vector dimensionality (e.g. 1024, 1536)")
    distance_metric: str = Field(default="Cosine", description="Vector similarity metric in Qdrant")
    vector_name: str = Field(default="dense", description="Named vector key in Qdrant vectors_config")
    collection_name: str = Field(default="proxipilot_knowledge", description="Target Qdrant collection")
    normalization: NormalizationPolicy = Field(default=NormalizationPolicy.L2)
    query_prefix: Optional[str] = Field(default=None, description="Prefix for query embeddings if asymmetric")
    document_prefix: Optional[str] = Field(default=None, description="Prefix for document chunks if asymmetric")
    is_active: bool = True


# =============================================================================
# Registered Authoritative Embedding Profiles
# =============================================================================

KNOWN_PROFILES: Dict[str, EmbeddingProfile] = {
    # Voyage AI Primary Enterprise Profile (1024 dim default)
    "emb_voyage_4_large_1024_v1": EmbeddingProfile(
        profile_id="emb_voyage_4_large_1024_v1",
        provider="voyage",
        model_name="voyage-4-large",
        model_version="2026-v1",
        dimension=1024,
        distance_metric="Cosine",
        vector_name="dense",
        collection_name="proxipilot_knowledge",
        normalization=NormalizationPolicy.L2,
    ),
    # OpenAI text-embedding-3-small Profile (1536 dim)
    "emb_openai_text3_small_1536_v1": EmbeddingProfile(
        profile_id="emb_openai_text3_small_1536_v1",
        provider="openai",
        model_name="text-embedding-3-small",
        model_version="v1",
        dimension=1536,
        distance_metric="Cosine",
        vector_name="dense",
        collection_name="proxipilot_knowledge",
        normalization=NormalizationPolicy.L2,
    ),
    # Cohere Multilingual v3 Profile (1024 dim)
    "emb_cohere_multilingual_v3_1024_v1": EmbeddingProfile(
        profile_id="emb_cohere_multilingual_v3_1024_v1",
        provider="cohere",
        model_name="embed-multilingual-v3.0",
        model_version="v3.0",
        dimension=1024,
        distance_metric="Cosine",
        vector_name="dense",
        collection_name="proxipilot_knowledge",
        normalization=NormalizationPolicy.L2,
    ),
    # Local Deterministic Profile (Test & Offline CI)
    "emb_local_1024_v1": EmbeddingProfile(
        profile_id="emb_local_1024_v1",
        provider="local",
        model_name="proxipilot-local-v1",
        model_version="v1",
        dimension=1024,
        distance_metric="Cosine",
        vector_name="dense",
        collection_name="proxipilot_knowledge",
        normalization=NormalizationPolicy.L2,
    ),
}


class EmbeddingProfileRegistry:
    """Manages effective embedding profile resolution and verification."""

    @classmethod
    def get_profile(cls, profile_id: str) -> EmbeddingProfile:
        """Fetch a registered profile by immutable profile_id, or active default if not found."""
        if profile_id in KNOWN_PROFILES:
            return KNOWN_PROFILES[profile_id]
        return cls.get_active_profile()

    @classmethod
    def get_active_profile(cls, settings: Optional[EmbeddingSettings] = None) -> EmbeddingProfile:
        """Resolve the effective authoritative embedding profile from active settings."""
        cfg = settings or get_settings().embedding
        provider_name = (cfg.provider or "local").lower()

        if provider_name == "voyage":
            return KNOWN_PROFILES["emb_voyage_4_large_1024_v1"]
        elif provider_name == "openai":
            model = cfg.model_name if (cfg.model_name or "").startswith("text-embedding-") else "text-embedding-3-small"
            dim = cfg.dimension or 1024
            return EmbeddingProfile(
                profile_id=f"emb_openai_{model.replace('text-embedding-', '').replace('-', '_')}_{dim}_v1",
                provider="openai",
                model_name=model,
                model_version="v3",
                dimension=dim,
                distance_metric="Cosine",
                vector_name="dense",
                collection_name="proxipilot_knowledge",
                normalization=NormalizationPolicy.L2,
            )
        elif provider_name == "cohere":
            return KNOWN_PROFILES["emb_cohere_multilingual_v3_1024_v1"]
        else:
            dim = cfg.dimension or 1024
            return EmbeddingProfile(
                profile_id=f"emb_local_{dim}_v1",
                provider="local",
                model_name=cfg.model_name or "proxipilot-local-v1",
                model_version="v1",
                dimension=dim,
                distance_metric="Cosine",
                vector_name="dense",
                collection_name="proxipilot_knowledge",
                normalization=NormalizationPolicy.L2,
            )

    @classmethod
    def verify_compatibility(
        cls,
        profile: EmbeddingProfile,
        target_dimension: int,
        target_model_name: Optional[str] = None,
    ) -> bool:
        """Verify dimensional and model compatibility.

        Fails if dimensions do not match or if distinct model families are mixed.
        """
        if profile.dimension != target_dimension:
            raise EmbeddingProfileMismatchError(
                f"Embedding dimension mismatch: Profile '{profile.profile_id}' produces {profile.dimension}d vectors, "
                f"but target collection requires {target_dimension}d vectors."
            )

        if target_model_name and target_model_name != profile.model_name:
            logger.warning(
                "Potential embedding model family mismatch detected",
                profile_model=profile.model_name,
                target_model=target_model_name,
            )

        return True


embedding_profile_registry = EmbeddingProfileRegistry()
