# ADR-009: Universal Event Architecture & Envelope Specification

## Status
Accepted (Phase 0 Architecture Freeze)

## Context
Asynchronous processing across email ingestion, knowledge vectorization, AI agents, and outbound email requires a standardized message contract to ensure reliable delivery, observability, and decoupled modules.

## Decision
All domain events conform to an immutable envelope:
- `event_id`, `event_type`, `event_version`, `tenant_id`, `aggregate_type`, `aggregate_id`, `occurred_at`, `producer`, `correlation_id`, `payload`.
Consumers must be idempotent, deduplicating via Redis or unique database constraints. Failed events route to Dead Letter Queues (DLQ) after 5 exponential backoff retries.

## Consequences
- **Positive**: Auditable event stream, seamless async worker scaling, decoupling of heavy AI workloads from synchronous HTTP requests.
- **Negative**: Requires schema version management when event payloads evolve.
