"""Async Qdrant Vector Database Client.

Features:
- Mandatory tenant filter construction for vector searches
- Async non-blocking vector retrieval
- Health check probes
"""

from typing import Optional
from qdrant_client import AsyncQdrantClient
from qdrant_client.http import models as qmodels
from app.core.config import QdrantSettings, get_settings
from app.core.logging import logger


class QdrantManager:
    """Manages AsyncQdrantClient lifecycle and tenant isolation filters."""

    def __init__(self, settings: Optional[QdrantSettings] = None):
        self._settings = settings or get_settings().qdrant
        self._client: Optional[AsyncQdrantClient] = None

    def initialize(self) -> None:
        """Initialize async Qdrant client."""
        if self._client is not None:
            return

        self._client = AsyncQdrantClient(
            url=self._settings.url,
            api_key=self._settings.api_key if self._settings.api_key else None,
            timeout=self._settings.timeout_seconds,
        )
        logger.info("QdrantManager initialized.", url=self._settings.url)

    async def close(self) -> None:
        """Close Qdrant client connections."""
        if self._client is not None:
            await self._client.close()
            self._client = None
            logger.info("QdrantManager connections closed.")

    @property
    def client(self) -> AsyncQdrantClient:
        if self._client is None:
            self.initialize()
        assert self._client is not None
        return self._client

    @staticmethod
    def build_tenant_filter(tenant_id: str) -> qmodels.Filter:
        """Build mandatory Qdrant tenant filter.

        CRITICAL: Never execute an unrestricted global vector query.
        """
        assert tenant_id and tenant_id.strip(), "tenant_id cannot be empty for vector retrieval"
        return qmodels.Filter(
            must=[
                qmodels.FieldCondition(
                    key="tenant_id",
                    match=qmodels.MatchValue(value=tenant_id),
                )
            ]
        )

    async def check_health(self) -> bool:
        """Check Qdrant cluster responsiveness."""
        try:
            # Check cluster collections
            await self.client.get_collections()
            return True
        except Exception as err:
            logger.error("Qdrant health check failed", error=str(err))
            return False


qdrant_manager = QdrantManager()


async def get_qdrant() -> AsyncQdrantClient:
    """Dependency or accessor for Qdrant client."""
    return qdrant_manager.client
