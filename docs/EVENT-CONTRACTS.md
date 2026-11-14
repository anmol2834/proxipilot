# ProxiPilot Backend V1 — Event Contracts & Event Bus

## Status: Frozen (Phase 0 Complete)

---

## 1. Universal Event Envelope
Every event emitted across Redis Streams or message queues must conform to the immutable event envelope:

```json
{
  "event_id": "evt_01J8ABCDEF1234567890",
  "event_type": "email.received",
  "event_version": 1,
  "tenant_id": "org_acme_corp",
  "aggregate_type": "email",
  "aggregate_id": "msg_xyz987",
  "occurred_at": "2024-09-17T10:24:00.123Z",
  "producer": "inbound-email-worker",
  "correlation_id": "req_trace_112233",
  "causation_id": "evt_webhook_0099",
  "payload": {}
}
```

### Invariant Rules:
1. **Immutability**: Once an event is published, it must never be modified or republished under the same `event_id`.
2. **Tenant Scoping**: `tenant_id` is mandatory on all events. Consumers must discard any event lacking a valid `tenant_id`.
3. **No Secrets**: Event payloads must **never** contain passwords, raw OAuth refresh tokens, or unencrypted payment details.
4. **Idempotent Consumers**: Every consumer must verify whether `event_id` has already been processed using Redis `SET key 1 NX EX 86400` before applying state mutations.

---

## 2. Canonical Domain Event Catalog

| Event Name | Aggregate | Producer | Key Payload Fields |
|---|---|---|---|
| `organization.created` | `organization` | Auth Service | `org_id`, `name`, `slug`, `owner_user_id` |
| `organization.member_added` | `membership` | Auth Service | `org_id`, `user_id`, `role` |
| `gmail.account.connected` | `integration` | Integration Worker | `org_id`, `account_id`, `email`, `scopes` |
| `gmail.account.disconnected` | `integration` | Integration Service | `org_id`, `account_id`, `reason` |
| `email.received` | `email` | Ingestion Worker | `org_id`, `thread_id`, `message_id`, `provider` |
| `email.normalized` | `email` | Ingestion Worker | `org_id`, `message_id`, `subject`, `sender` |
| `thread.created` | `thread` | Inbox Service | `org_id`, `thread_id`, `initial_subject` |
| `thread.updated` | `thread` | Inbox Service | `org_id`, `thread_id`, `lead_temp`, `unread` |
| `knowledge.created` | `knowledge` | Knowledge Service | `org_id`, `item_id`, `category`, `title` |
| `knowledge.version_published`| `knowledge` | Knowledge Worker | `org_id`, `item_id`, `version_number` |
| `knowledge.archived` | `knowledge` | Knowledge Service | `org_id`, `item_id`, `version_number` |
| `ai.run.started` | `ai` | AI Worker | `org_id`, `ai_run_id`, `thread_id`, `model` |
| `ai.run.completed` | `ai` | AI Worker | `org_id`, `ai_run_id`, `latency_ms` |
| `ai.run.failed` | `ai` | AI Worker | `org_id`, `ai_run_id`, `error_code` |
| `response.generated` | `ai` | AI Worker | `org_id`, `thread_id`, `response_id` |
| `response.validated` | `ai` | AI Safety Worker | `org_id`, `response_id`, `passed: true` |
| `human_review.created` | `review` | AI Safety Worker | `org_id`, `review_id`, `thread_id`, `reason` |
| `human_review.resolved` | `review` | Review Service | `org_id`, `review_id`, `resolved_by` |
| `outbound_message.created` | `outbound` | Dispatch Worker | `org_id`, `outbound_id`, `idempotency_key` |
| `outbound_message.sent` | `outbound` | Dispatch Worker | `org_id`, `outbound_id`, `provider_msg_id` |
| `outbound_message.failed` | `outbound` | Dispatch Worker | `org_id`, `outbound_id`, `retry_count` |

---

## 3. Failure & Retry Semantics
1. **Transient Errors**: Retry with exponential backoff and jitter ($1\text{s}, 2\text{s}, 4\text{s}, 8\text{s}, 16\text{s}$). Maximum 5 retries.
2. **Permanent / Poison Errors**: Sent immediately to Dead Letter Stream (`dlq:<event_type>`) with failure reason, stack trace, and original payload.
3. **Consumer Acknowledgment**: Redis `XACK` is sent only after the database transaction has committed.
