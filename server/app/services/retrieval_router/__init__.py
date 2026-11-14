"""Retrieval Router Package — Phase 4.

Exports:
- retrieval_router_service: Primary service facade
- RetrievalRouterService: Service class
- retrieval_router: Core routing engine
- structured_retriever: PostgreSQL exact structured retriever
- semantic_retriever: Qdrant semantic retriever
- fact_verifier: Authoritative fact verification engine
"""

from app.services.retrieval_router.router import RetrievalRouter, retrieval_router
from app.services.retrieval_router.semantic_retriever import (
    SemanticCandidateHit,
    SemanticRetriever,
    semantic_retriever,
)
from app.services.retrieval_router.service import (
    RetrievalRouterService,
    retrieval_router_service,
)
from app.services.retrieval_router.structured_retriever import (
    StructuredRetriever,
    structured_retriever,
)
from app.services.retrieval_router.verifier import FactVerifier, fact_verifier

__all__ = [
    "retrieval_router_service",
    "RetrievalRouterService",
    "retrieval_router",
    "RetrievalRouter",
    "structured_retriever",
    "StructuredRetriever",
    "semantic_retriever",
    "SemanticRetriever",
    "SemanticCandidateHit",
    "fact_verifier",
    "FactVerifier",
]
