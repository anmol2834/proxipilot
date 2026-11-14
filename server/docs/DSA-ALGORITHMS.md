# ProxiPilot Algorithms & Data Structures (DSA) Toolkit

> **Architecture Rule**: Every algorithm in `app/algorithms/` must have documented time complexity, space complexity, and clear guidelines on when to use and when NOT to use.

---

## 1. Catalog of Implemented Algorithms

### A. Priority Queue (`app/algorithms/heaps/priority_queue.py`)
- **Structure**: Thread-safe Binary Min-Heap with FIFO tie-breaking counter.
- **Time Complexity**:
  - Insert (`push`): $O(\log n)$
  - Extract-Min (`pop`): $O(\log n)$
  - Peek: $O(1)$
- **Space Complexity**: $O(n)$
- **When to Use**: In-process SLA prioritization of urgent customer emails over bulk automations.
- **When NOT to Use**: Across distributed nodes where persistence across process restarts is required (use Redis Streams).

---

### B. Token Bucket Rate Limiter (`app/algorithms/rate_limiting/token_bucket.py`)
- **Structure**: Continuous mathematical time-elapsed refill token bucket.
- **Time Complexity**: $O(1)$ per token consumption check.
- **Space Complexity**: $O(1)$ per bucket instance.
- **When to Use**: High-throughput inbound API throttling and outbound LLM / Email provider rate smoothing.
- **When NOT to Use**: Strict zero-burst windows where smooth leaky bucket pacing is demanded.

---

### C. LRU + TTL Dual-Eviction Cache (`app/algorithms/caching/lru_ttl_cache.py`)
- **Structure**: `OrderedDict` with monotonic timestamp expiration tracking.
- **Time Complexity**:
  - Lookup (`get`): $O(1)$
  - Insertion / Update (`put`): $O(1)$
  - Eviction: $O(1)$
- **Space Complexity**: $O(n)$ where $n = \text{capacity}$.
- **When to Use**: High-frequency ephemeral in-memory caching of model pricing, static schemas, and active conversation contexts.
- **When NOT to Use**: Multi-instance shared caching (use Redis).

---

### D. Probabilistic Bloom Filter (`app/algorithms/deduplication/bloom_filter.py`)
- **Structure**: Bytearray with Kirsch-Mitzenmacher double-hashing (MD5 128-bit partitioned).
- **Time Complexity**:
  - Add: $O(k)$ where $k = \text{num\_hashes}$.
  - Contains: $O(k)$
- **Space Complexity**: $O(m)$ bits where $m = -\frac{n \ln p}{(\ln 2)^2}$.
- **When to Use**: Fast-path rejection of duplicate webhook deliveries before performing DB or Redis roundtrips.
- **When NOT to Use**: When zero false-positive tolerance is mandatory (always verify positive matches against the DB).
