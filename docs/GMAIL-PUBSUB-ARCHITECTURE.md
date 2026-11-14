# Google Cloud Pub/Sub Webhook & Ingestion Architecture

## 1. Webhook Design Principle
The push webhook endpoint (`POST /api/v1/webhooks/gmail/pubsub`) is strictly designed for sub-300ms acknowledgement:
- **Zero LLM or RAG calls in the HTTP thread**.
- **Zero mailbox fetching or parsing in the webhook thread**.
- Performs cryptographic validation, dual-layer idempotency checks, records the durable event, dispatches to Redis Streams, and immediately returns HTTP 200/204.

## 2. Ingestion Flow
```
Google Cloud Pub/Sub
        │
        ▼ (POST /api/v1/webhooks/gmail/pubsub with Authorization: Bearer <JWT>)
FastAPI Webhook Handler
        │
        ├── 1. JWT & Audience Verification (Google Public Certificates)
        ├── 2. Decode Pub/Sub Message Payload (Base64 JSON: emailAddress, historyId)
        ├── 3. Redis Fast-Path Deduplication (SETNX pubsub:dedupe:{message_id} EX 86400)
        ├── 4. PostgreSQL Durable Idempotency (provider_events unique constraint)
        ├── 5. Enqueue event to Redis Streams (email_events)
        └── 6. Return HTTP 200 OK immediately (< 50ms)
```

## 3. Dual-Layer Idempotency Matrix
| Layer | Storage | Mechanism | Failure Action |
|---|---|---|---|
| Layer 1 | Redis | `SET pubsub:dedupe:{message_id} 1 EX 86400 NX` | If false, return HTTP 200 immediately (early exit) |
| Layer 2 | PostgreSQL | `provider_events(provider, provider_event_id)` Unique Constraint | Handles Redis evictions/restarts; duplicate catches `IntegrityError` safely |
