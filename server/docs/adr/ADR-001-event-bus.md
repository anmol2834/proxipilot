# ADR-001: Event Bus Selection — Redis Streams

## Status
Accepted

## Context
ProxiPilot requires an asynchronous event bus to decouple lightweight HTTP webhooks (incoming Gmail/Outlook events) from long-running AI, RAG, and email delivery workloads. The system must support at-least-once delivery, consumer groups, and dead-letter routing.

## Decision
We selected **Redis Streams** as the default event bus for ProxiPilot.
The connection is established via the existing Upstash Redis infrastructure (`rediss://...`).
The implementation is accessed through an abstract `EventBus` interface (`app/core/messaging.py`).

## Alternatives Considered
1. **RabbitMQ**: Highly capable with flexible routing keys, but introduces additional infrastructure and operational overhead when Redis is already present.
2. **Apache Kafka**: Exceptional for multi-million events/sec, but excessively complex and costly for the current stage.

## Consequences
- **Pros**: Zero additional cloud infrastructure cost; sub-millisecond latency; built-in consumer groups and pending entries list (PEL); simple local Docker development.
- **Cons**: Memory-bound retention (requires message trimming `maxlen`); high-volume message archiving must rely on PostgreSQL or S3 if permanent audit logs are needed.
- **Mitigation**: An abstract `EventBus` interface is maintained, allowing a seamless swap to RabbitMQ/Kafka if traffic reaches massive scale.
