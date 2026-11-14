"""Async Redis Client, Connection Pool, and Tenancy Key Builder.

Features:
- Async connection pooling (Upstash / Redis 7+)
- Mandatory tenant-scoped key builder to eliminate cross-tenant cache leakage
- Distributed lock context manager with safety timeouts
- Ephemeral caching & health checking
"""

from contextlib import asynccontextmanager
import socket
from typing import AsyncGenerator, Optional
import redis.asyncio as aioredis
import app.core.dns_patch  # noqa: F401 - Resilient IPv4 DNS for Upstash Redis
from app.core.config import RedisSettings, get_settings
from app.core.logging import logger


class RedisManager:
    """Manages Redis connection pool and provides helpers."""

    def __init__(self, settings: Optional[RedisSettings] = None):
        self._settings = settings or get_settings().redis
        self._client: Optional[aioredis.Redis] = None

    def initialize(self) -> None:
        """Initialize async Redis client with connection pool."""
        if self._client is not None:
            return

        self._client = aioredis.from_url(
            self._settings.url,
            max_connections=self._settings.max_connections,
            socket_timeout=max(self._settings.socket_timeout_seconds, 15),
            socket_connect_timeout=5,
            socket_keepalive=True,
            retry_on_timeout=True,
            health_check_interval=30,
            decode_responses=True,
        )
        logger.info("RedisManager initialized with connection pool.")

    async def close(self) -> None:
        """Close Redis connection pool gracefully."""
        if self._client is not None:
            await self._client.aclose()
            self._client = None
            logger.info("RedisManager connections closed.")

    @property
    def client(self) -> aioredis.Redis:
        if self._client is None:
            self.initialize()
        assert self._client is not None
        return self._client

    @staticmethod
    def build_tenant_key(tenant_id: str, namespace: str, key: str) -> str:
        """Construct a strict tenant-isolated cache/lock key.

        Format: tenant:{tenant_id}:{namespace}:{key}
        """
        assert tenant_id and tenant_id.strip(), "tenant_id cannot be empty for tenant keys"
        return f"tenant:{tenant_id}:{namespace}:{key}"

    async def check_health(self) -> bool:
        """Ping Redis with timeout."""
        try:
            return await self.client.ping()
        except Exception as err:
            logger.error("Redis health check failed", error=str(err))
            return False

    @asynccontextmanager
    async def distributed_lock(
        self, lock_key: str, timeout_seconds: int = 10, blocking_timeout_seconds: float = 2.0
    ) -> AsyncGenerator[bool, None]:
        """Acquire a distributed lock with automatic expiration to prevent deadlocks."""
        lock = self.client.lock(
            name=f"lock:{lock_key}",
            timeout=timeout_seconds,
            blocking_timeout=blocking_timeout_seconds,
        )
        acquired = await lock.acquire()
        try:
            yield acquired
        finally:
            if acquired:
                try:
                    await lock.release()
                except Exception:
                    pass  # Lock expired or already released


redis_manager = RedisManager()


async def get_redis() -> aioredis.Redis:
    """Dependency or accessor for the Redis client."""
    return redis_manager.client
