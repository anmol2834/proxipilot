# ADR-006: PostgreSQL as Absolute Source of Truth

## Status
Accepted (Phase 0 Architecture Freeze)

## Context
ProxiPilot manages mission-critical business communications, operational knowledge, pricing, and AI audit records. An architectural boundary is required to determine which storage engine holds authoritative transactional data versus cache and vector search representations.

## Decision
PostgreSQL is frozen as the sole, authoritative source of truth for all business entities, organizations, accounts, threads, messages, knowledge item versions, AI runs, evidence records, and human review tasks.
Qdrant and Redis are strictly downstream indexed projections or operational caches. If any data discrepancy arises, PostgreSQL is authoritative.

## Consequences
- **Positive**: Full ACID transactional guarantees, reliable foreign-key constraints, keyset pagination, and zero data loss on restart.
- **Negative**: Relational updates must trigger asynchronous projection updates to Qdrant.
