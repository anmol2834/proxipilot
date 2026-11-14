# ProxiPilot AI Development Rules

> **CRITICAL DIRECTIVE FOR ALL AI AGENTS & LLMs**:  
> Read this document BEFORE planning, modifying, or generating any code in the ProxiPilot platform.  
> **Never create architecture that conflicts with the established ProxiPilot architecture.**

---

## 1. Golden Rules for AI Agents

1. **Do Not Re-invent Foundations**: The foundation is established across both `/client` and `/server`. Always leverage existing modules in `app/core/`, `app/algorithms/`, and `@/lib/`.
2. **Frontend Styling**: No Tailwind CSS. Use Material UI + SCSS Modules.
3. **Backend Configuration**: Never call `os.getenv()` directly. Use typed settings from `app.core.config`.
4. **Backend Concurrency**: Never execute blocking calls (`time.sleep()`, synchronous network calls) inside async FastAPI route handlers.
5. **Short Transaction Rule**: Never hold an open SQLAlchemy database transaction while awaiting LLM or external HTTP APIs.
6. **Strict Tenant Isolation**: All database queries must filter by `tenant_id`; all Redis keys must be scoped; all Qdrant queries must use tenant filters.
7. **No Unauthenticated Tenant Headers**: Always resolve tenant identity from verified cryptographic tokens via `get_current_tenant_id`.
8. **No Premature Microservices**: Keep backend modules in the modular monolith; scale worker entrypoints (`--worker ai|email|automation`) independently.

---

## 2. Pre-Execution Checklist for Backend Modifications

Before writing backend code for any feature, follow this checklist:

### A. Before Adding an Endpoint
1. Thin route handlers: Route handlers ONLY validate requests, extract context, and call domain services.
2. Long-running AI/RAG tasks MUST be queued to Redis Streams via `event_bus.publish()`.
3. Never perform vector search or LLM generation synchronously inside incoming email webhook routes.

### B. Before Accessing Data
1. Does this data belong to a specific tenant?
   - Database: Verify table inherits from `TenantAwareMixin` and query filters by `tenant_id`.
   - Redis: Generate key using `RedisManager.build_tenant_key(tenant_id, namespace, key)`.
   - Qdrant: Enforce `QdrantManager.build_tenant_filter(tenant_id)`.
2. Structured relational data (customers, orders, subscriptions) belongs in PostgreSQL.
3. Semantic documents (FAQs, policies, SOPs) belong in Qdrant.

### C. Before Writing Background Jobs
1. Ensure the consumer is idempotent. Verify message IDs against `BloomFilter` or persistent DB records.
2. On unrecoverable error, route to DLQ stream (`event_bus.send_to_dlq()`) and acknowledge the main stream.

### D. Before Adding an Algorithm
1. Check `app/algorithms/` (`PriorityQueue`, `TokenBucket`, `LruTtlCache`, `BloomFilter`).
2. Document Time Complexity, Space Complexity, and justification in `docs/DSA-ALGORITHMS.md`.
