# ProxiPilot Performance & Concurrency Architecture

---

## 1. Async Non-Blocking Foundation

The entire ProxiPilot backend is built upon Python's asynchronous event loop (`asyncio`):

- **Database**: `asyncpg` native asynchronous PostgreSQL driver.
- **Cache & Messaging**: `redis.asyncio` non-blocking client.
- **Vector DB**: `AsyncQdrantClient`.
- **Outbound HTTP**: `httpx.AsyncClient` with connection pooling.
- **Rules**: Never invoke blocking operations (`time.sleep()`, synchronous `requests.get()`, heavy synchronous file I/O) on the main FastAPI event loop.

---

## 2. Connection Pooling Architecture

To prevent socket exhaustion and optimize serverless PostgreSQL performance:

| Service               | Manager             | Strategy & Sizing                                                             |
| :-------------------- | :------------------ | :---------------------------------------------------------------------------- |
| **PostgreSQL (Neon)** | `DatabaseManager`   | `pool_size=10`, `max_overflow=20`, `pool_recycle=300s`, `pool_pre_ping=True`  |
| **Redis (Upstash)**   | `RedisManager`      | `max_connections=20`, `socket_timeout=5s`                                     |
| **HTTP Clients**      | `HttpClientManager` | `max_connections=100`, `max_keepalive_connections=20`, keep-alive timeout 30s |

---

## 3. Short Transaction Boundaries (Section 136)

**Critical Anti-Pattern**:

```text
BEGIN TRANSACTION
  → Call LLM API (3 to 10 seconds!)
  → Query Qdrant (100ms)
  → Call Gmail API (500ms)
COMMIT TRANSACTION
```

Holding database transactions open during external network I/O starves connection pools and causes catastrophic cascading timeouts.

**Enforced Pattern**:

```text
Short DB Transaction (Fetch metadata / state) → COMMIT
  ↓
External Processing (LLM / Qdrant / Email API)
  ↓
Short DB Transaction (Persist generated response) → COMMIT
```

---

## 4. Layered Caching Hierarchy

```text
┌─────────────────────────────────────────────────────────────┐
│ L1: In-Process LRU+TTL Cache (`app.algorithms.LruTtlCache`) │
│     Latency: <1ms. For static metadata, pricing, schema.    │
├─────────────────────────────────────────────────────────────┤
│ L2: Distributed Redis Cache (`app.core.redis`)              │
│     Latency: 5-20ms. Tenant-scoped, shared across nodes.    │
├─────────────────────────────────────────────────────────────┤
│ L3: Authoritative Persistence (PostgreSQL & Qdrant)         │
│     Latency: 20-100ms. Indexed, ACID-compliant.             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Latency Budgets & Targets

- **Webhook Ingestion**: Target < 50ms (verify, publish event, acknowledge).
- **FastAPI Authenticated Read**: Target < 150ms.
- **Cache Hit**: Target < 10ms.
- **RAG & LLM Generation**: Asynchronous worker path (typically 2-6 seconds, never blocking API).
