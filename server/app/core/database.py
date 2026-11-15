"""Relational Database Layer (SQLAlchemy 2.0 + asyncpg).

Optimized for:
- Async I/O non-blocking execution
- Serverless connection pooling (Neon PostgreSQL pooler)
- Short transaction boundaries (never hold DB transaction during LLM/external I/O)
- Health check probes
"""

import asyncio
from contextlib import asynccontextmanager
import socket
from typing import Any, AsyncGenerator, Optional
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
import app.core.dns_patch  # noqa: F401 - Resilient IPv4 DNS for Neon serverless pooler
from app.core.config import DatabaseSettings, get_settings
from app.core.logging import logger


class DatabaseManager:
    """Manages AsyncEngine and sessionmaker lifecycles."""

    def __init__(self, settings: Optional[DatabaseSettings] = None):
        self._settings = settings or get_settings().db
        self._engine: Optional[AsyncEngine] = None
        self._session_factory: Optional[async_sessionmaker[AsyncSession]] = None

    def initialize(self) -> None:
        """Initialize connection pool and sessionmaker."""
        if self._engine is not None:
            return

        # Ensure ssl mode and pooler compatibility for asyncpg with cloud providers (Neon/AWS RDS)
        connect_args: dict[str, Any] = {}
        if (
            "neon.tech" in self._settings.database_url
            or "sslmode=require" in self._settings.database_url
            or "ssl=require" in self._settings.async_database_url
        ):
            connect_args["ssl"] = "require"
            connect_args["statement_cache_size"] = 0

        self._engine = create_async_engine(
            self._settings.async_database_url,
            pool_size=self._settings.pool_size,
            max_overflow=self._settings.max_overflow,
            pool_timeout=self._settings.pool_timeout_seconds,
            pool_recycle=self._settings.pool_recycle_seconds,
            # Discards stale serverless pooler connections (configurable: costs ~240 ms per
            # checkout on a cross-region link, see DatabaseSettings.pool_pre_ping).
            pool_pre_ping=self._settings.pool_pre_ping,
            # LIFO keeps reusing the few warm (keepalive-pinged) connections instead of
            # rotating through every idle one, so requests rarely hit a cold connection.
            pool_use_lifo=True,
            connect_args=connect_args,
        )

        self._session_factory = async_sessionmaker(
            bind=self._engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )
        logger.info("DatabaseManager initialized with asyncpg engine.")

    async def close(self) -> None:
        """Dispose of the connection pool cleanly during application shutdown."""
        if self._engine is not None:
            await self._engine.dispose()
            self._engine = None
            self._session_factory = None
            logger.info("DatabaseManager connection pool disposed.")

    @property
    def session_factory(self) -> async_sessionmaker[AsyncSession]:
        if self._session_factory is None:
            self.initialize()
        assert self._session_factory is not None
        return self._session_factory

    @property
    def engine(self) -> AsyncEngine:
        if self._engine is None:
            self.initialize()
        assert self._engine is not None
        return self._engine

    async def warm_pool(self, connections: Optional[int] = None, timeout_seconds: float = 90.0) -> int:
        """Open N pooled connections concurrently and leave them idle in the pool.

        Connection setup to a remote serverless Postgres (DNS + TCP + TLS + auth, plus a
        compute wake-up after suspension) can take several seconds on slow links. Doing
        it once at startup, in parallel, means the first user requests reuse warm
        connections instead of timing out in the browser.
        """
        n = self._settings.warm_connections if connections is None else connections
        if n <= 0:
            return 0

        async def _one() -> bool:
            async with self.session_factory() as session:
                await session.execute(text("SELECT 1"))
            return True

        try:
            results = await asyncio.wait_for(
                asyncio.gather(*[_one() for _ in range(n)], return_exceptions=True),
                timeout=timeout_seconds,
            )
        except asyncio.TimeoutError:
            logger.warning("Database pool warm-up timed out", connections=n)
            return 0
        ok = sum(1 for r in results if r is True)
        logger.info("Database pool warmed", requested=n, ready=ok)
        return ok

    async def keepalive_forever(self) -> None:
        """Periodically ping the warm connections.

        Keeps pooled connections from being dropped as idle and keeps the serverless
        compute from auto-suspending while the API runs, so the next request does not
        pay a multi-second cold start.
        """
        interval = self._settings.keepalive_interval_seconds
        if interval <= 0:
            return
        while True:
            await asyncio.sleep(interval)
            try:
                await self.warm_pool(timeout_seconds=min(30.0, float(interval)))
            except asyncio.CancelledError:
                raise
            except Exception as err:
                logger.warning("Database keepalive failed", error=str(err))

    async def check_health(self) -> bool:
        """Ping database with 1-second timeout."""
        try:
            async with self.session_factory() as session:
                await session.execute(text("SELECT 1;"))
                return True
        except Exception as err:
            logger.error("Database health check failed", error=str(err))
            return False

    @asynccontextmanager
    async def transaction(self) -> AsyncGenerator[AsyncSession, None]:
        """Scoped transaction context manager enforcing atomic commit or rollback.

        CRITICAL: Keep transactions short. Do not execute LLM or external HTTP calls inside this block.
        """
        async with self.session_factory() as session:
            async with session.begin():
                yield session


db_manager = DatabaseManager()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding an async database session."""
    async with db_manager.session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
