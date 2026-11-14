# ProxiPilot Event-Driven Messaging Architecture

---

## 1. Event Bus Selection: Redis Streams

ProxiPilot leverages **Redis Streams** as the default event bus:
- **Zero Additional Cost**: Runs directly on existing Upstash Redis infrastructure.
- **Consumer Groups**: Multiple worker instances share load without duplicate delivery.
- **Durable Replay & Acknowledgment**: Unacknowledged messages remain in the Pending Entries List (PEL) until acknowledged (`XACK`).
- **Low Latency**: Sub-millisecond publish and read latency.

---

## 2. Event Specification & Versioning

All events inherit from `DomainEvent` (`app/core/messaging.py`):
```json
{
  "event_id": "evt_ab4f83345ab34750b0ac6f1c6a7c7df7",
  "event_type": "email.received",
  "tenant_id": "tenant_12345",
  "occurred_at": "2026-09-16T18:47:04.123456+00:00",
  "schema_version": 1,
  "producer": "proxipilot-backend",
  "payload": {
    "mailbox_id": "mbx_gmail_sales",
    "provider_message_id": "msg_xyz789"
  }
}
```

---

## 3. Delivery Guarantees & Idempotency

- **At-Least-Once Delivery**: Network partitions or worker crashes may cause redelivery.
- **Idempotent Consumers**: Every worker must verify `event_id` or `source_message_id` against a deduplication filter (BloomFilter / Redis / DB) before applying external side effects.

---

## 4. Dead Letter Queue (DLQ) Strategy

When a worker fails to process an event after $N$ attempts (or encounters corrupt payloads):
1. Event is published to `proxipilot:stream:dlq:{stream_name}` with error reason and timestamp.
2. Original message is acknowledged in the main consumer group.
3. System alerts operators; messages can be debugged and replayed safely.

---

## 5. Transactional Outbox Pattern

When state updates and event publishing must be atomic:
```text
PostgreSQL Transaction
  ├── Write business entity (e.g. EmailThread updated)
  └── Insert outbox record into `outbox_events` table
COMMIT
  ↓
Outbox Relayer Worker reads table & publishes to Redis Stream
```
Prevents dual-write failures (DB saved but event lost, or event published but DB failed).
