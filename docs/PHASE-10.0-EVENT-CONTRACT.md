# PROXIPILOT — PHASE 10.0 EVENT CONTRACT SPECIFICATION
## Enterprise Gmail Ingestion, Durable Acceptance & Asynchronous Processing

**Status:** Canonical & Enforced  
**Applicability:** Inbound Gmail Pipeline, Webhook Ingress, Transactional Outbox, Redis Streams, Worker Execution  

---

## 1. Architectural Principles & Invariants

1. **Mailbox-Change Semantic Invariant**: A Gmail Pub/Sub notification is a **mailbox-change hint**, NOT an individual email message. It contains `emailAddress` and `historyId`.
2. **Never Create Email Rows Directly from Webhook**: Webhooks never create `EmailMessage` or `EmailThread` records directly. Actual message changes are retrieved via Gmail history synchronization.
3. **No LLM / Semantic Search on Ingress**: Ingress is strictly $O(1)$ acceptance; no AI or embedding operations occur on webhook receipt.
4. **Tenant Isolation**: All database operations and events are server-authoritative and scoped by `tenant_id` (Organization ID). Tenant IDs supplied by callers in headers or bodies are untrusted.
5. **No Secrets in Events**: Event envelopes, payloads, and logs must **never** contain OAuth access tokens, refresh tokens, client secrets, or raw email bodies.
6. **Numeric History ID Comparison**: Gmail history IDs are 64-bit monotonically increasing integers. All comparison logic MUST evaluate history IDs as numeric integers (`int(history_id)`), never lexicographically or as floating-point numbers.
7. **Three-Tier Idempotency**:
   - *Tier 1 (Ingress Delivery Deduplication)*: Enforced by Redis `SETNX` fast-path and PostgreSQL `UniqueConstraint("provider", "provider_event_id")` on `provider_events`.
   - *Tier 2 (Account Coalescing)*: Enforced by Redis single-flight distributed lock + atomic high-watermark tracking (`_LUA_ATOMIC_MAX`).
   - *Tier 3 (Persistence Idempotency)*: Enforced by PostgreSQL unique constraints on `email_threads` and `email_messages` via `ON CONFLICT DO NOTHING`.

---

## 2. Inbound External Push Contract (Google Cloud Pub/Sub → Webhook)

### 2.1 HTTP Request Specification
- **Method**: `POST`
- **Path**: `/api/v1/webhooks/gmail/pubsub`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <Google-Signed-OIDC-JWT>` (Mandatory when push authentication is enabled)
- **Status Responses**:
  - `200 OK` / `202 Accepted`: Event successfully accepted and durably persisted to PostgreSQL outbox, or already accepted duplicate.
  - `400 Bad Request`: Corrupted payload, invalid JSON, or missing `emailAddress`/`historyId`.
  - `401 Unauthorized`: Invalid, expired, or forged Google OIDC JWT.
  - `503 Service Unavailable`: PostgreSQL or durable storage unavailable; triggers Pub/Sub automatic exponential backoff redelivery.

### 2.2 External Envelope Schema
```json
{
  "message": {
    "data": "eyJlbWFpbEFkZHJlc3MiOiAiamFuZUBhY21lLmNvbSIsICJoaXN0b3J5SWQiOiAiMzkxMzg0OSJ9",
    "messageId": "pubsub_msg_987654321012345",
    "publishTime": "2026-10-18T19:00:00.123Z",
    "attributes": {}
  },
  "subscription": "projects/proxipilot-prod/subscriptions/gmail-push-sub"
}
```

### 2.3 Decoded Base64 Data Payload Schema
```json
{
  "emailAddress": "jane@acme.com",
  "historyId": "3913849"
}
```

### 2.4 Cryptographic Authentication Verification
The `Authorization: Bearer <JWT>` header is validated against Google's public JSON Web Key Set (`https://www.googleapis.com/oauth2/v3/certs`):
- `iss`: Must match `https://accounts.google.com` or `accounts.google.com`.
- `aud`: Must match configured `GMAIL_PUBSUB_PUSH_AUDIENCE`.
- `email`: Must match configured `GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT` (if configured).
- `exp`: Must be in the future.

---

## 3. Durable Ingress & Transactional Outbox Contract

### 3.1 `provider_events` Record (Audit & Ingress Deduplication)
Atomic record created in PostgreSQL within the webhook transaction:

```sql
CREATE TABLE provider_events (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    integration_account_id VARCHAR(64) REFERENCES connected_integration_accounts(id) ON DELETE CASCADE,
    provider VARCHAR(32) NOT NULL DEFAULT 'gmail',
    provider_event_id VARCHAR(128) NOT NULL,
    event_type VARCHAR(64) NOT NULL DEFAULT 'gmail.mailbox_change',
    event_payload_hash VARCHAR(64) NULL,
    provider_timestamp VARCHAR(64) NULL,
    received_at VARCHAR(64) NOT NULL,
    processed_at VARCHAR(64) NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'received',
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_code VARCHAR(64) NULL,
    created_at VARCHAR(64) NOT NULL,
    updated_at VARCHAR(64) NOT NULL,
    CONSTRAINT uq_provider_events_provider_event_id UNIQUE (provider, provider_event_id)
);
```

### 3.2 `outbox_events` Record (Transactional Outbox)
Created atomically in the SAME transaction as `provider_events`:

```sql
CREATE TABLE outbox_events (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    stream_name VARCHAR(64) NOT NULL DEFAULT 'email_events',
    event_type VARCHAR(64) NOT NULL,
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id VARCHAR(64) NOT NULL,
    payload TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ NULL,
    last_error TEXT NULL
);

CREATE INDEX ix_outbox_events_status_created ON outbox_events (status, created_at);
```

**Lifecycle Transitions**:
- `pending`: Inserted atomically with webhook receipt.
- `published`: Confirmed written to Redis Stream via `XADD`.
- `failed`: Failed publication after max retries; flagged for operator alerting.

---

## 4. Internal Message Queue Contract (Redis Streams)

### 4.1 Stream & Consumer Group Specification
- **Stream Name**: `proxipilot:stream:email_events`
- **Consumer Group**: `email-worker-group`
- **Consumer Name**: `email-worker-<worker_id>`
- **Delivery Guarantee**: At-least-once with manual `XACK` on successful database commit.

### 4.2 Stream Domain Event Payload
Conforms to the universal `DomainEvent` schema:

```json
{
  "event_id": "evt_01J8ABCDEF1234567890",
  "event_type": "gmail.mailbox_change",
  "schema_version": 1,
  "tenant_id": "org_31d214d315c84be29023395466af2f28",
  "aggregate_type": "integration_account",
  "aggregate_id": "int_7a8b9c0d1e2f3a4b",
  "occurred_at": "2026-10-18T19:00:00.150Z",
  "producer": "gmail-pubsub-webhook",
  "correlation_id": "req_trace_9988776655",
  "causation_id": "pubsub_msg_987654321012345",
  "payload": {
    "account_id": "int_7a8b9c0d1e2f3a4b",
    "email_address": "jane@acme.com",
    "history_id": "3913849",
    "provider_event_id": "pubsub_msg_987654321012345"
  }
}
```

---

## 5. Account Synchronization & Cursor State Machine

### 5.1 Concurrency Lock Contract
- **Key**: `gmail:sync:{integration_account_id}`
- **TTL**: 300 seconds
- **Token**: UUIDv4 ownership token
- **Release**: Atomic Lua script matching token before deletion.

### 5.2 Coalescing Watermark Contract
- **Key**: `gmail:sync:pending:{integration_account_id}`
- **TTL**: 3600 seconds
- **Update Logic**: Atomic Lua script storing $\max(\text{current\_pending}, \text{new\_history\_id})$.
- **Drain Logic**: Atomically read and delete (`GETDEL`); if value exceeds last synced history ID, execute another sync loop iteration.

### 5.3 `sync_cursors` Schema & State Transitions
- **`cursor_value`**: Monotonically advancing Gmail `historyId`.
- **States**: `idle` $\longleftrightarrow$ `syncing` $\longrightarrow$ `recovering` $\longrightarrow$ `failed`.
- **Cursor Invariant**: `cursor_value` MUST NOT advance if any unhandled message ingestion error (`stats.failed > 0`) occurs.

---

## 6. Email Persistence Idempotency Contract

### 6.1 `email_threads` Deduplication
```sql
CONSTRAINT uq_email_threads_tenant_account_thread 
UNIQUE (tenant_id, integration_account_id, external_thread_id)
```
- Upsert logic: `INSERT ... ON CONFLICT (tenant_id, integration_account_id, external_thread_id) DO NOTHING`.
- All workers resolving the same external thread obtain the identical primary key `id`.

### 6.2 `email_messages` Deduplication
```sql
CONSTRAINT uq_email_messages_account_message_id 
UNIQUE (integration_account_id, external_message_id)
```
- Upsert logic: `INSERT ... ON CONFLICT (integration_account_id, external_message_id) DO NOTHING`.
- Duplicate detection: If `rowcount == 0`, message was previously ingested; thread counts and snippets are not re-incremented.
- Message 404s: Messages deleted on Gmail before sync fetch return `None`, increment `stats.unavailable`, and are excluded from persistence without failing the batch.

---

## 7. Failure, Retry & Dead Letter Queue (DLQ) Contract

### 7.1 Transient vs. Permanent Errors
1. **Transient Errors**: Rate limits (HTTP 429), Google 5xx, or temporary network timeouts.
   - Retried with exponential backoff and jitter.
   - Event remains in Redis PEL.
2. **Permanent / Poison Errors**: Corrupt payloads, non-recoverable schema errors, or retries exceeding `max_retries` (default 5).
   - Routed to `proxipilot:stream:dlq:email_events`.
   - Message acknowledged via `XACK` to unblock stream processing.

### 7.2 DLQ Payload Structure
```json
{
  "event_id": "evt_01J8ABCDEF1234567890",
  "event_type": "gmail.mailbox_change",
  "tenant_id": "org_31d214d315c84be29023395466af2f28",
  "dlq_error": "GmailHistoryExpiredException: startHistoryId 1000 expired",
  "dlq_timestamp": "2026-10-18T19:05:00.000Z",
  "payload": { ... }
}
```
