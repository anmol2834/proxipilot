# PROXIPILOT — PHASE 10.0 INGESTION ARCHITECTURE AUDIT
## Enterprise Gmail Ingestion, Durable Event Processing & Idempotent Email Persistence

**Audit Date:** 2026-10-18  
**Scope:** Incoming Email Pipeline — Stage 1 Ingress Boundary & Mailbox Synchronization  
**Status:** Completed Root-Cause Audit & Corrective Architecture Plan  

---

## 1. Executive Summary

This root-cause audit investigates ProxiPilot's Stage 1 Incoming Email Pipeline:
$$\text{Gmail} \longrightarrow \text{Google Pub/Sub} \longrightarrow \text{Webhook Ingress} \longrightarrow \text{Durable Acceptance} \longrightarrow \text{Redis Streams} \longrightarrow \text{Worker Pool} \longrightarrow \text{PostgreSQL}$$

The performance objective for Phase 10.0 is to design, implement, and benchmark the ingress architecture for a **burst of 10,000 Pub/Sub event deliveries in one second across the service fleet**, guaranteeing:
1. **Zero Unbounded Memory Growth**: Webhook thread memory remains constant $O(1)$ under load.
2. **Zero Silent Event Loss**: All legitimate events are durably persisted before HTTP acknowledgement; retriable HTTP 503 is returned if the database is unavailable.
3. **Zero Duplicate Persistent Records**: Dual-layer ingress deduplication and PostgreSQL unique constraints on `(provider, provider_event_id)`, `(tenant_id, integration_account_id, external_thread_id)`, and `(integration_account_id, external_message_id)`.
4. **Coalesced Synchronization**: Decoupling the 10,000 notification ingress burst from actual Gmail API consumption via account-scoped distributed locking and atomic integer high-watermark tracking.

---

## 2. Component-by-Component Architectural Audit

### 2.1 Google Cloud Pub/Sub Webhook (`server/app/api/v1/routes/webhooks.py`)

| Feature / Requirement | Current Implementation State | Finding / Gap Analysis | Severity |
|---|---|---|---|
| **Google OIDC Token Validation** | Lines 117–122 contain `if expected_audience and authorization: pass` placeholder. | **High Risk**: Webhook does not cryptographically verify Google's signed JWT signature, token expiry, token issuer (`https://accounts.google.com`), or configured audience. Unauthorized callers could forge push notifications. | **CRITICAL** |
| **Payload Extraction & Base64 Decoding** | Enforces `PubSubPushEnvelope`, decodes base64 payload into `emailAddress` and `historyId`. | **Sound**: Safely handles base64 decoding errors with HTTP 400. Extracts messageId and publishTime cleanly. | **PASS** |
| **Account Resolution & Tenant Scope** | `_resolve_account_info` caches in Redis (`gmail:account_cache:`) with 300s TTL; falls back to DB query. | **Edge Case Gap**: Uses `res.first()` with `order_by(created_at.desc())`. If multiple active connections share an email address across organizations, it could arbitrarily bind to one. Must detect ambiguity and fail safely. | **MEDIUM** |
| **Ingress Acceptance Durability** | Webhook publishes to Redis Stream (`email_events`) **before** inserting into PostgreSQL (`ProviderEvent`). Catch-block around DB insert logs warning and does not abort. | **Architectural Violation**: If PostgreSQL fails or is unreachable, the webhook returns HTTP 200, creating volatile, unrecorded events. Furthermore, dual-write failure between Redis and PostgreSQL is possible. | **CRITICAL** |
| **HTTP Response Policy** | Returns 200 OK after publish. | If DB transaction fails, must return retriable 5xx (HTTP 503) so Google Pub/Sub redelivers. | **HIGH** |

### 2.2 Ingress Deduplication & Transactional Outbox

| Feature / Requirement | Current Implementation State | Finding / Gap Analysis | Severity |
|---|---|---|---|
| **Layer 1 Fast-Path Deduplication** | Redis `SET gmail:pubsub:dedupe:{message_id} 1 EX 172800 NX`. | **Sound**: Catches immediate retries within 48 hours without hitting PostgreSQL. If Redis is down, safely falls through to Layer 2 DB check. | **PASS** |
| **Layer 2 Durable Deduplication** | PostgreSQL table `provider_events` with `UniqueConstraint("provider", "provider_event_id")`. | **Sound**: Database-level unique constraint prevents duplicate acceptance across Redis evictions and restarts. | **PASS** |
| **Transactional Outbox Pattern** | Documented in `server/docs/EVENT-ARCHITECTURE.md` (§5), but no `outbox_events` table or relay loop currently implemented. | **Gap**: Ingress relies on direct Redis `XADD` in HTTP thread. If Redis is degraded during a 10k burst, webhooks experience backpressure or dual-write inconsistency. Atomic outbox table commits with `ProviderEvent` and relays asynchronously. | **HIGH** |

### 2.3 Internal Event Contracts (`server/app/contracts/events.py` & `server/app/core/messaging.py`)

| Feature / Requirement | Current Implementation State | Finding / Gap Analysis | Severity |
|---|---|---|---|
| **Universal Event Envelope** | `DomainEvent` with `event_id`, `event_type`, `tenant_id`, `schema_version`, `correlation_id`, `payload`. | **Sound**: Strict tenant scoping, immutable serialization, and correlation tracing. | **PASS** |
| **No Secrets in Payloads** | Payloads contain `account_id`, `email_address`, `history_id`, `provider_event_id`. | **Sound**: Zero OAuth credentials, access tokens, refresh tokens, or raw bodies in stream events. | **PASS** |
| **Pub/Sub Notification Semantic** | Event type `gmail.mailbox_change` represents mailbox delta hint, NOT individual email row. | **Sound**: Handled as a change notification triggering Gmail history sync. | **PASS** |

### 2.4 Queue Durability & Redis Streams (`server/app/workers/base.py` & `messaging.py`)

| Feature / Requirement | Current Implementation State | Finding / Gap Analysis | Severity |
|---|---|---|---|
| **Stream Naming & Consumer Groups** | Stream `proxipilot:stream:email_events`, group `email-worker-group`. | **Sound**: `xgroup_create` with `mkstream=True` and `BUSYGROUP` idempotency. | **PASS** |
| **Acknowledgment Timing (`XACK`)** | `BaseWorker._handle_message` invokes `XACK` only **after** `process_event()` completes successfully. | **Sound**: At-least-once delivery; failed events remain in Pending Entry List (PEL). | **PASS** |
| **Retry & Dead Letter Queue (DLQ)** | Inquires `xpending_range` for `times_delivered`; routes to `proxipilot:stream:dlq:email_events` when exceeding `max_retries`. | **Sound**: Poisoned events do not loop indefinitely; DLQ retains full context and error message. | **PASS** |
| **Stream Backlog & PEL Recovery** | Windows / Linux compatible worker loop with graceful shutdown. | Worker loop reads in bounded batches with semaphore concurrency guard. | **PASS** |

### 2.5 Mailbox Synchronization & Concurrency Control (`server/app/services/gmail_sync.py`)

| Feature / Requirement | Current Implementation State | Finding / Gap Analysis | Severity |
|---|---|---|---|
| **Single-Flight Lock per Account** | Redis distributed lock `gmail:sync:{account_id}` with UUID token and atomic Lua release. | **Sound**: Prevents concurrent workers from modifying the same cursor simultaneously. | **PASS** |
| **Event Coalescing (High Watermark)** | Redis Lua script `_LUA_ATOMIC_MAX` updates `gmail:sync:pending:{account_id}` atomically. | **Sound**: Notifications arriving while lock is held are not dropped; worker loops until watermark is satisfied. | **PASS** |
| **Numeric History ID Comparison** | History IDs parsed as `int(history_id)` in Python. | **Sound**: Prevents lexicographical truncation or float precision loss. | **PASS** |
| **History Expiration Fallback** | `GmailHistoryExpiredException` (HTTP 404 on `history.list`) catches expired cursor and triggers `execute_full_sync()`. | **Sound**: Self-healing recovery without manual user reconnection. | **PASS** |
| **Cursor Safety on Message Failure** | `execute_incremental_sync` advances cursor to `latest_history_id`. | **Caution**: If `stats.failed > 0` (non-404 unhandled message errors), advancing cursor would skip uncommitted changes. Must gate cursor commit on zero unhandled processing failures. | **HIGH** |
| **Individual Message 404 Handling** | `get_message_metadata` and `get_messages_batch` return `None` on 404. | **Sound**: Messages deleted by user before sync fetch do not abort the sync batch; counted as `unavailable`. | **PASS** |

### 2.6 Persistence Idempotency (`server/app/models/inbox.py` & `gmail_sync.py`)

| Feature / Requirement | Current Implementation State | Finding / Gap Analysis | Severity |
|---|---|---|---|
| **Thread Upsert Race Safety** | `uq_email_threads_tenant_account_thread` unique constraint on `(tenant_id, integration_account_id, external_thread_id)` with `on_conflict_do_nothing()`. | **Sound**: Concurrent workers for the same external thread safely resolve to identical primary key. | **PASS** |
| **Message Ingestion Idempotency** | `uq_email_messages_account_message_id` unique constraint on `(integration_account_id, external_message_id)` with `on_conflict_do_nothing()`. | **Sound**: Reprocessing history range yields `rowcount == 0` (duplicate skip); thread denormalized counters are not double-incremented. | **PASS** |
| **Atomicity of Thread Updates** | Message insertion and thread denormalized updates are committed in one transaction. | **Sound**: Thread snippet, counts, and latest timestamps update atomically with new message. | **PASS** |

---

## 3. Mathematical Complexity & Throughput Analysis

### Ingress Complexity (per Webhook Delivery)
1. **OIDC Token Verification**: $O(1)$ cryptographic signature verification using cached Google JWKS (cached in-memory for 1 hour).
2. **Envelope & Base64 Decode**: $O(B)$ where $B$ is payload byte size ($\approx 200$ bytes, $< 0.05\text{ ms}$).
3. **Layer 1 Redis SETNX**: $O(1)$ in-memory atomic key check ($\approx 0.5\text{ ms}$ over localhost/VPC).
4. **Layer 2 PostgreSQL Transaction**: $O(\log N)$ B-Tree index seek on `uq_provider_events_provider_event_id` + $O(1)$ append on `provider_events` and `outbox_events` ($\approx 2\text{–}8\text{ ms}$).
5. **Total Ingress Latency**: Expected $5\text{–}15\text{ ms}$ per event.

### Fleet Scalability for 10,000 Burst in 1 Second
To accept 10,000 requests in 1.0 second:
- **Total Fleet Throughput Required**: $10,000\text{ req/sec}$.
- **Average Service Latency per Request**: $10\text{ ms}$.
- **Required Concurrency Across Fleet**:
  $$\text{Concurrency} = \text{Throughput} \times \text{Latency} = 10,000 \times 0.010 = 100 \text{ concurrent connections}$$
- **Fleet Allocation**: 10 Uvicorn worker processes handling 10 concurrent requests each, or 20 processes handling 5 concurrent requests each.
- **Database Connection Pool**: PgBouncer or serverless transaction pooler multiplexing 100 active clients into $20\text{–}30$ PostgreSQL backend connections with connection reuse.
- **Provider Limit Reality**: Google Gmail watch notifications are rate-limited by Google to at most **1 notification per watched mailbox per second**. A burst of 10,000 notifications in 1 second across the fleet naturally represents either:
  1. A multi-tenant fleet with 10,000 distinct connected mailboxes experiencing simultaneous changes.
  2. Google Pub/Sub push batching / catch-up delivery after backlog release.
  In both scenarios, account-level coalescing guarantees that repeated notifications for identical mailboxes collapse into a single incremental synchronization loop.

---

## 4. Root-Cause Gaps & Required Corrections

```
┌────────────────────────────────────────────────────────────────────────┐
│                        IDENTIFIED DEFICIENCIES                         │
├────────────────────────────────┬───────────────────────────────────────┤
│ 1. Missing Google OIDC Auth    │ Webhook does not enforce Google OIDC  │
│                                │ JWT signatures, audience, or issuer.  │
├────────────────────────────────┼───────────────────────────────────────┤
│ 2. Unsafe Ingress Durability   │ Webhook publishes to Redis before DB; │
│                                │ DB failure does not abort with 503.   │
├────────────────────────────────┼───────────────────────────────────────┤
│ 3. Missing Transactional Outbox│ No outbox table or relay loop to      │
│                                │ decouple DB commit from Redis write.  │
├────────────────────────────────┼───────────────────────────────────────┤
│ 4. Ambiguous Account Lookup    │ `res.first()` selects first matching  │
│                                │ email across tenants without check.   │
├────────────────────────────────┼───────────────────────────────────────┤
│ 5. Cursor Safety on Failure    │ Sync engine must not advance cursor   │
│                                │ if unhandled message failures occur.  │
└────────────────────────────────┴───────────────────────────────────────┘
```

---

## 5. Safe Architecture Correction Plan

1. **Implement `GoogleTokenVerifier`**: Cryptographic JWT validation with Google's public JWKS keys, verifying `iss`, `aud`, and `email`.
2. **Create `outbox_events` Table**: Reversible Alembic migration adding `outbox_events` with composite index `(status, created_at)`.
3. **Atomic Webhook Transaction**:
   ```python
   async with db_manager.session_factory() as db:
       # 1. Insert provider_events (Layer 2 Dedupe)
       # 2. Insert outbox_events
       await db.commit()
   # 3. Fast-path relay or background outbox relay publishes to Redis Stream
   ```
4. **Outbox Relayer Service**:
   - Immediate asynchronous dispatch attempt on fast-path.
   - Background periodic sweeper for failed / un-relayed outbox records with exponential backoff.
5. **Strict Account Ambiguity Protection**: Reject multi-account ambiguity; ensure tenant scope is 100% server-authoritative.
6. **Cursor Advancement Guard**: Gate cursor advancement on `stats.failed == 0`.
7. **Comprehensive Load Testing & Benchmarking**:
   - 10,000 in-memory payload verification test.
   - 10,000 burst HTTP ingress load test measuring p50, p95, p99 latencies, zero duplicate persistence, and queue drain behavior.
