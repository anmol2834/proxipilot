# Prioritized Remediation Plan

**Repository:** ProxiPilot (`proxipilot`)  
**Date:** October 19, 2026  
**Status:** Approved for Implementation  

---

## Remediation Roadmap

### Priority 1: High / Medium Operational Reliability
- **[F-003] Distributed Thread Lock Heartbeat Renewal:**
  - *Goal:* Prevent lock expiration during long-running downstream stages or database latency.
  - *Fix:* Connect background renewal heartbeat task in `context_resolver.py` so the thread lock automatically extends its TTL every 15s until context resolution completes.
  - *Acceptance Criteria:* Unit test verifying that lock stays held past initial TTL without expiry.

- **[F-002] Decouple Vector Store Availability from Email Ingress:**
  - *Goal:* Email ingress and context resolution must remain 100% operational even if Qdrant vector database is restarting.
  - *Fix:* Ensure Qdrant manager uses graceful fallback and non-blocking initialization on FastAPI startup.
  - *Acceptance Criteria:* Email ingestion and context resolver tests execute successfully regardless of Qdrant connection state.

### Priority 2: Code Quality, Type Safety & Modernization
- **[F-001] Pydantic V2 ConfigDict Modernization:**
  - *Goal:* Eliminate all deprecation warnings in `app/api/v1/routes/inbox.py`.
  - *Fix:* Replace `class Config: from_attributes = True` with `model_config = ConfigDict(from_attributes=True)`.
  - *Acceptance Criteria:* `python -m pytest tests/` executes with 0 warnings.

- **[F-004] Enhanced Timestamp Serialization in ContextEnvelope:**
  - *Goal:* Improve schema contracts for downstream consumers.
  - *Fix:* Ensure clean datetime typing and serialization in `ContextEnvelope`.
