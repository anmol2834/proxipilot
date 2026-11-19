"""Retry transient OpenAI failures for interactive / inbound-filter calls.

The shared drafter client is created with ``max_retries=0`` so long pipeline calls never stack retries
on top of their own repair logic. Short interactive calls (Copilot, inbound mail check) are different:
one transient 5xx / rate limit / timeout would fail the user's whole request although a retry a second
later almost always succeeds (2026-11-19: three Copilot requests failed on single OpenAI 500s).
Only transient errors are retried; 4xx request errors are raised at once.
"""

from __future__ import annotations

import asyncio
import random
from typing import Any, Dict

from app.core.logging import logger

ATTEMPTS = 3
BASE_DELAY_S = 0.7


class TransientLLMError(RuntimeError):
    """The model service failed temporarily on every attempt (worth retrying later)."""


def is_transient(exc: BaseException) -> bool:
    try:
        import openai
    except Exception:  # noqa: BLE001
        return False
    if isinstance(exc, (openai.APITimeoutError, openai.APIConnectionError, openai.RateLimitError,
                        openai.InternalServerError)):
        return True
    status = getattr(exc, "status_code", None)
    return isinstance(status, int) and (status >= 500 or status in (408, 409, 429))


async def create_with_retry(client: Any, kwargs: Dict[str, Any], *, label: str, attempts: int = ATTEMPTS) -> Any:
    """``client.chat.completions.create(**kwargs)`` with jittered exponential backoff on transient errors."""
    last: BaseException | None = None
    for attempt in range(1, attempts + 1):
        try:
            return await client.chat.completions.create(**kwargs)
        except Exception as exc:  # noqa: BLE001
            if not is_transient(exc):
                raise
            last = exc
            logger.warning("transient LLM error, retrying", call=label, attempt=attempt,
                           error=f"{type(exc).__name__}: {str(exc)[:160]}")
            if attempt < attempts:
                await asyncio.sleep(BASE_DELAY_S * (2 ** (attempt - 1)) * (0.8 + 0.4 * random.random()))
    raise TransientLLMError(f"{label}: model service unavailable after {attempts} attempts") from last
