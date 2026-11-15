"""Best-effort Redis caching of login sessions.

Postgres (`sessions` table) is the source of truth for sessions;
`get_current_user` falls back to it on a cache miss or Redis error. A Redis
outage must therefore never fail a sign-in: the cache write is attempted with
a short timeout and any failure is logged and ignored.
"""

import asyncio
import json

from app.core.logging import logger
from app.core.redis import redis_manager

CACHE_WRITE_TIMEOUT_SECONDS = 2.0


async def cache_session(
    *, jti: str, session_id: str, user_id: str, expires_at_iso: str, ttl_seconds: int
) -> bool:
    """Cache a freshly created session. Returns False (never raises) on failure."""
    try:
        client = redis_manager.client
        await asyncio.wait_for(
            asyncio.gather(
                client.set(f"session:{jti}", user_id, ex=ttl_seconds),
                client.set(
                    f"session:id:{session_id}",
                    json.dumps({"user_id": user_id, "expires_at": expires_at_iso}),
                    ex=ttl_seconds,
                ),
            ),
            timeout=CACHE_WRITE_TIMEOUT_SECONDS,
        )
        return True
    except Exception as exc:  # Redis down, quota exceeded, not initialised, timeout
        logger.warning(
            "Session cache write skipped; session is persisted in the database",
            session_id=session_id,
            error=str(exc)[:200],
        )
        return False
