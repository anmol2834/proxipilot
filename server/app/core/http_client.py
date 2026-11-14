"""Centralized Async HTTP Client Layer (httpx).

Provides:
- Reusable connection pool across requests
- Keep-alive connection management
- Standard timeouts
- Resource cleanup on shutdown
"""

from typing import Optional
import httpx
from app.core.logging import logger


class HttpClientManager:
    """Manages a shared, pooled httpx.AsyncClient instance."""

    def __init__(self, timeout_seconds: float = 30.0, max_connections: int = 100):
        self._timeout = timeout_seconds
        self._max_connections = max_connections
        self._client: Optional[httpx.AsyncClient] = None

    def initialize(self) -> None:
        """Initialize the shared AsyncClient with connection limits."""
        if self._client is not None:
            return

        limits = httpx.Limits(
            max_connections=self._max_connections,
            max_keepalive_connections=20,
            keepalive_expiry=30.0,
        )
        timeout = httpx.Timeout(self._timeout, connect=10.0)

        self._client = httpx.AsyncClient(
            limits=limits,
            timeout=timeout,
            follow_redirects=True,
        )
        logger.info("HttpClientManager initialized with connection pooling.")

    async def close(self) -> None:
        """Close HTTP client connections cleanly."""
        if self._client is not None:
            await self._client.aclose()
            self._client = None
            logger.info("HttpClientManager connections closed.")

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self.initialize()
        assert self._client is not None
        return self._client


http_client_manager = HttpClientManager()


async def get_http_client() -> httpx.AsyncClient:
    """Dependency or accessor for the shared HTTP client."""
    return http_client_manager.client
