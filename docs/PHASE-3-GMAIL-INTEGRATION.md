# Phase 3: Connected Gmail Accounts (Enterprise Architecture)

## Executive Summary
Phase 3 establishes an enterprise-grade, multi-tenant Gmail integration engine for ProxiPilot. It delivers zero manual user reconnection after platform downtime (up to 30+ days), dual-layer idempotency, real-time Google Cloud Pub/Sub webhook synchronization, min-heap priority scheduling ($O(\log n)$ control-plane maintenance), per-account distributed concurrency locking, and full cryptographic security using AES-256-GCM.

---

## Architecture Blueprint

```
Next.js UI (Dashboard / Integrations)
   │
   ▼
FastAPI API Gateway (/api/v1/integrations)
   │
   ├─► Server-Side OAuth 2.0 (Single-Use State, PKCE-ready, AES-256-GCM Token Encryption)
   │
   ▼
PostgreSQL (Neon)
   ├── connected_integration_accounts (1..N per organization)
   ├── sync_cursors (historyId, watch_expires_at, sync_state)
   └── provider_events (Durable Pub/Sub idempotency)
   │
   ▼
Gmail watch() ──► Google Cloud Pub/Sub Topic (gmail-events)
                        │
                        ▼ (Push Webhook < 300ms Ack)
FastAPI Webhook (/api/v1/webhooks/gmail/pubsub)
   │ (JWT Validation + Fast-path Redis Idempotency + Postgres Deduplication)
   ▼
Redis Streams (email_events)
   │
   ▼
EmailWorker Daemon (Parallel Worker Pools)
   │
   ├── Distributed Per-Account Lock (gmail:sync:{account_id})
   ├── users.history.list (Incremental Mailbox Synchronization)
   └── Fallback to Full Sync on HTTP 404 (Stale History Recovery)
```

---

## Key Guarantees

| Capability | Engineering Guarantee |
|---|---|
| **Multi-Account Model** | $1..N$ Gmail accounts per tenant. Disconnecting Account A has zero impact on Accounts B and C. |
| **Zero Reconnect on Downtime** | Server/worker offline for 30 days self-heals on reboot: token refreshed, watch recreated, 404 recovered via full sync. |
| **No Inbox Polling** | Zero `while true: sleep(30)` loops. Primary pipeline is event-driven via Gmail `watch()` and Pub/Sub. |
| **Idempotency** | Dual-layer deduplication: Redis fast-path + PostgreSQL unique constraint `(provider, provider_event_id)`. |
| **Concurrency Control** | Distributed lock with Lua release prevents cursor corruption and race conditions. |
| **Algorithmic Scheduling** | Min-Heap Priority Queue ($O(\log n)$ insert/extract) backed by PostgreSQL indexed persistence. |
| **Zero Secret Exposure** | Access tokens and refresh tokens encrypted with AES-256-GCM. Never returned in frontend API responses. |
