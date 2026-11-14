"""High-Performance In-Memory Dual LRU + TTL Cache.

Specification:
- Purpose: Ephemeral in-process cache with size bounding and expiration.
- Input: Key-value entries with optional individual TTL in seconds.
- Output: Cached values or None if expired/evicted.

Complexity:
- Get: O(1) average
- Put: O(1) average
- Delete / Evict: O(1)
- Space: O(n) where n is capacity.

When to use:
- Fast in-memory caching of static metadata (pricing tables, model context limits, schema definitions).
- Short-lived caching of active email thread summaries during active conversation generation.

When NOT to use:
- Shared multi-instance distributed state (use Redis).
- Persistent data storage.
"""

from collections import OrderedDict
import time
from typing import Generic, Optional, Tuple, TypeVar

K = TypeVar("K")
V = TypeVar("V")


class LruTtlCache(Generic[K, V]):
    """OrderedDict-based LRU Cache with automatic TTL expiration."""

    def __init__(self, capacity: int = 1000, default_ttl_seconds: Optional[float] = 300.0):
        assert capacity > 0, "Capacity must be greater than 0"
        self.capacity = capacity
        self.default_ttl = default_ttl_seconds
        # Stores key -> (value, expire_at_monotonic or None)
        self._cache: OrderedDict[K, Tuple[V, Optional[float]]] = OrderedDict()

    def get(self, key: K) -> Optional[V]:
        """Retrieve value if key exists and has not expired. Moves item to MRU end."""
        if key not in self._cache:
            return None

        val, expire_at = self._cache[key]
        now = time.monotonic()

        # Check expiration
        if expire_at is not None and now >= expire_at:
            del self._cache[key]
            return None

        # Move to end (most recently used)
        self._cache.move_to_end(key)
        return val

    def put(self, key: K, value: V, ttl_seconds: Optional[float] = None) -> None:
        """Insert or update value. Evicts LRU item if capacity is exceeded."""
        ttl = ttl_seconds if ttl_seconds is not None else self.default_ttl
        expire_at = (time.monotonic() + ttl) if ttl is not None else None

        if key in self._cache:
            self._cache.move_to_end(key)
        self._cache[key] = (value, expire_at)

        if len(self._cache) > self.capacity:
            # Pop oldest (first) item
            self._cache.popitem(last=False)

    def delete(self, key: K) -> bool:
        """Remove key from cache."""
        if key in self._cache:
            del self._cache[key]
            return True
        return False

    def clear(self) -> None:
        """Clear all cached entries."""
        self._cache.clear()

    def __len__(self) -> int:
        return len(self._cache)
