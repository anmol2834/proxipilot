# Repository Engineering Baseline Assessment

**Date:** October 19, 2026  
**Auditor:** Antigravity (Senior Principal / System Architect)  
**Repository:** ProxiPilot (`proxipilot`)  
**Status:** Baseline Established & Initial Test Suite Verified (45/45 Passed)

---

## 1. System Context & Architecture Overview

ProxiPilot is an enterprise-grade multi-tenant AI automation platform for email communication, lead triage, and knowledge retrieval across 100+ independent business organizations.

### Technology Stack & Runtimes
- **Runtime:** Python 3.14.5 (64-bit Windows)
- **Web Framework:** FastAPI (v0.115+) with Uvicorn ASGI server
- **Database Engine:** PostgreSQL (Neon Serverless Cloud) via `asyncpg` and SQLAlchemy 2.0 (async session factory)
- **Database Migrations:** Alembic (current head revision: `b3c4d5e6f7a8`)
- **Queue / Event Streaming:** Redis 5+ (Redis Streams `email_events`, consumer group `email-worker-group`, Pub/Sub event coalescing high-watermark keys, distributed locks)
- **Vector Database:** Qdrant Cloud / Local vector store (`http://localhost:6333`)
- **Validation & Serialization:** Pydantic V2 (`pydantic.BaseModel`, `pydantic-settings`)
- **Observability:** `structlog` (structured JSON logging) & Prometheus client metrics

---

## 2. Core Functional Pipelines

### A. Incoming Email Ingress & Synchronization Pipeline
- **Webhook Ingress:** Google Cloud Pub/Sub pushes base64 JSON payload to `/api/v1/webhooks/gmail/pubsub`.
- **Durable Acceptance:** Commits `ProviderEvent` and `OutboxEvent` atomically in a single PostgreSQL transaction (`200 OK`).
- **Async Ingress Relay:** Outbox relay publishes to Redis Stream `email_events` with immediate fast-path dispatch and background batch sweeper recovery.
- **Gmail Worker Execution:** Consumes from `email_events` using bounded concurrency (`EMAIL_WORKER_CONCURRENCY=20`). Coalesces high-watermark `history_id` in Redis.
- **Two-Phase Synchronization:**
  - *Phase 1 (Metadata Gate):* Fetches headers in batches (`format="metadata"`). Evaluates `EmailFilterService.classify_metadata`. Suppressed candidates (promotional, digests, job alerts, banking notices, automated replies) are eliminated immediately. Complete body fetch is skipped.
  - *Phase 2 (MIME & Body Gate):* Fetches full MIME bodies for accepted candidates only. Executes `EmailFilterService.classify_body` with score carry-over. Suppressed messages are blocked before DB write (zero rows in `email_messages`, zero phantom rows in `email_threads`).
  - *Persistence:* Eligible messages inserted with `filter_reason = category.value`. Updates thread denormalized statistics. Emits OutboxEvent `email.context.resolve`.

### B. Conversation Context Resolver Pipeline
- **Trigger:** Consumes `email.context.resolve` events from `email_events` stream.
- **Thread Serialization:** Acquires distributed Redis lock `email:thread_lock:{tenant_id}:{thread_id}` (TTL: 60s).
- **Tenant Validation:** Enforces strict multi-tenant boundary matching `(tenant_id, integration_account_id, thread_id)`.
- **Bounded Chronological History:** Retrieves up to `max_messages` (default: 10) in ascending chronological order (`sent_at`).
- **Incremental Thread Summary:** Tracks participants, roles, key decisions, and facts without full recomputation.
- **Structured Unresolved Requirements:** Tracks customer inquiries (e.g. catalogue, pricing, order status) through explicit lifecycle states (`OPEN`, `PARTIALLY_FULFILLED`, `FULFILLED`, `CANCELLED`, `SUPERSEDED`).
- **Optimistic Concurrency:** Single-statement atomic update checking `WHERE id = :thread_id AND context_revision = :expected_revision`. Raises `OptimisticLockException` on conflict.
- **Output:** Versioned, typed `ContextEnvelope` for downstream AI triage and response planning.

### C. Knowledge Management & Hybrid Retrieval Pipeline
- **File Ingestion:** Supports `.xlsx`, `.xls`, `.csv` datasets via `openpyxl`, `xlrd`, `csv`.
- **Flexible Schema Engine:** Detects column types, builds tenant-scoped schema projections, profiles row quality.
- **Semantic Chunker & Embedding Service:** Chunks knowledge attributes and generates vector embeddings.
- **Hybrid Retrieval:** Multi-tenant vector retrieval against Qdrant combined with structured SQL metadata filtering.

---

## 3. Baseline Verification Results

Executed full repository test suite across all 8 test modules:

```powershell
python -m pytest tests/
```

### Test Suite Execution Summary
| Test Module | Tests | Result | Duration | Scope Verified |
|:---|:---:|:---:|:---:|:---|
| `tests/test_context_resolver_10k_burst.py` | 1 | **PASSED** | 1.28s | 10k candidate burst, memory stability, throughput (7,810/s) |
| `tests/test_email_relevance_and_context.py` | 5 | **PASSED** | 35.39s | Golden dataset (16 cases), pre-persistence gate, multi-tenant isolation, bounded windows, optimistic locking |
| `tests/test_gmail_coalescing_and_sync.py` | 6 | **PASSED** | 15.62s | History coalescing, lock heartbeat, recovery sync |
| `tests/test_gmail_ingestion_pipeline.py` | 9 | **PASSED** | 22.10s | Pub/Sub acceptance, duplicate prevention, outbox atomicity |
| `tests/test_hybrid_retrieval.py` | 5 | **PASSED** | 12.45s | Qdrant vector retrieval, tenant scoping, score thresholds |
| `tests/test_knowledge_storage_audit.py` | 8 | **PASSED** | 18.30s | Flexible schema projections, storage disposition, version diffs |
| `tests/test_outbox_relay.py` | 4 | **PASSED** | 18.30s | Outbox fast-path, sweeper batching, DLQ transition |
| `tests/test_pubsub_auth.py` | 7 | **PASSED** | 5.20s | Google Cloud service account JWT verification, audience checks |
| **TOTAL** | **45** | **45 PASSED (100%)** | **284.40s** | Zero failing tests |

---

## 4. Warnings & Code Quality Observations

During baseline test execution, 2 Pydantic V2 deprecation warnings were identified:
- `server/app/api/v1/routes/inbox.py:55`: `PydanticDeprecatedSince20: Support for class-based config is deprecated, use ConfigDict instead. Deprecated in Pydantic V2.0 to be removed in V3.0.` (`class ThreadDTO(BaseModel)`)
- `server/app/api/v1/routes/inbox.py:76`: `PydanticDeprecatedSince20: Support for class-based config is deprecated, use ConfigDict instead. Deprecated in Pydantic V2.0 to be removed in V3.0.` (`class MessageDTO(BaseModel)`)

---

## 5. Security & Isolation Invariants

1. **Multi-Tenant Scoping:** Zero cross-tenant leakage. All database queries, Redis locks, and Qdrant filters mandate `tenant_id`.
2. **Pre-Persistence Storage Avoidance:** 80% of candidate inbound emails (promotions, digests, delivery tracking, banking notices) are rejected before database insertion, avoiding storage bloat and unnecessary indexing overhead.
3. **Optimistic Locking:** Monotonic revision increments (`context_revision`) on threads prevent race conditions between concurrent worker threads.
