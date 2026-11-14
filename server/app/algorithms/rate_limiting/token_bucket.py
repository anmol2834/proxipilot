"""Token Bucket Rate Limiter for Tenant API & Provider Throttling.

Specification:
- Purpose: Enforce smooth token-based throughput limits with burst tolerance.
- Input: Capacity (maximum burst size), refill_rate (tokens added per second), requested tokens.
- Output: Boolean indicating whether consumption was approved.

Complexity:
- Time: O(1) per check/consume calculation.
- Space: O(1) per bucket instance.

When to use:
- Throttling incoming API requests per tenant / IP.
- Rate-limiting outbound LLM requests to adhere to provider RPM/TPM limits.
- Gmail / Microsoft Graph outbound rate smoothing.

When NOT to use:
- Strict window quotas where bursts must not occur at all (use Leaky Bucket or Fixed Window).
"""

import time
from typing import Optional


class TokenBucket:
    """Thread-safe in-memory Token Bucket rate limiter."""

    def __init__(self, capacity: float, refill_rate: float):
        """
        Args:
            capacity: Maximum burst capacity in tokens.
            refill_rate: Number of tokens added per second.
        """
        assert capacity > 0, "Capacity must be greater than 0"
        assert refill_rate > 0, "Refill rate must be greater than 0"

        self.capacity = float(capacity)
        self.refill_rate = float(refill_rate)
        self._tokens = float(capacity)
        self._last_refill = time.monotonic()

    def _refill(self, now: Optional[float] = None) -> None:
        current_time = now if now is not None else time.monotonic()
        elapsed = current_time - self._last_refill
        if elapsed > 0:
            self._tokens = min(self.capacity, self._tokens + (elapsed * self.refill_rate))
            self._last_refill = current_time

    def consume(self, tokens: float = 1.0) -> bool:
        """Attempt to consume the specified number of tokens.

        Returns True if successful, False if insufficient tokens.
        """
        now = time.monotonic()
        self._refill(now)

        if self._tokens >= tokens:
            self._tokens -= tokens
            return True
        return False

    @property
    def available_tokens(self) -> float:
        self._refill()
        return self._tokens
