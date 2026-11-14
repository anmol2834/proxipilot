# Architectural Decisions Record (ADR)

**Repository:** ProxiPilot (`proxipilot`)  
**Date:** October 19, 2026  

---

## ADR-001: Pre-Persistence Email Relevance Filtering vs. Post-Ingestion Cleanup
- **Context:** The mailbox export revealed 38 records where promotional bulk campaigns, newsletters, and system notifications were stored in `email_messages` with `filter_reason: ACCEPT`, polluting conversation history and consuming unnecessary storage.
- **Decision:** Execute multi-signal relevance filtering **before** database persistence. Suppressed emails are eliminated at Phase 1 (metadata stage) or Phase 2 (MIME body stage) without inserting rows into `email_messages` or creating phantom rows in `email_threads`.
- **Consequences:** 80% reduction in database writes and storage bloat; downstream conversation processing only sees genuine business inquiries.

---

## ADR-002: Context State Storage on `email_threads` vs. Dedicated Requirements Table
- **Context:** Phase 10.1 requires tracking thread summaries, monotonic context revisions, and structured unresolved customer requirements.
- **Decision:** Store `context_revision` (Integer), `unresolved_requirements` (JSON Text), and `summary_metadata` (JSON Text) directly on the existing `email_threads` table instead of creating a new join table.
- **Rationale:**
  1. Eliminates N+1 database joins during context resolution.
  2. Enables single-statement atomic optimistic locking (`UPDATE email_threads ... WHERE id = :id AND context_revision = :expected`).
  3. Preserves database schema simplicity while fully supporting structured lifecycle tracking (`OPEN`, `PARTIALLY_FULFILLED`, `FULFILLED`).

---

## ADR-003: Dual Concurrency Strategy (Distributed Lock + Optimistic Locking)
- **Context:** Multiple worker processes consume from Redis Streams concurrently across 100+ organizations. Parallel events for the same conversation thread could cause race conditions.
- **Decision:** Combine Redis distributed locks (`email:thread_lock:{tenant_id}:{thread_id}`) with database optimistic revision checks (`context_revision`).
- **Rationale:**
  - Redis distributed lock serializes processing of messages on the same thread across multiple worker containers.
  - Database optimistic revision check guarantees data integrity even if a worker crashes, network partitions occur, or a lock expires unexpectedly.

---

## ADR-004: Two-Phase Metadata-First Ingestion with Score Carry-Over
- **Context:** Fetching full MIME bodies via Gmail API is expensive in network bandwidth and latency.
- **Decision:**
  - Phase 1 fetches lightweight metadata headers (`format="metadata"`).
  - Clear promotional/spam/automated emails are dropped immediately.
  - Accumulated score and detection reasons carry over to Phase 2 body evaluation.
- **Consequences:** Benchmarked at 9,366.7 candidates/second on a single process, easily absorbing fleet bursts of 10,000 candidates/second.
