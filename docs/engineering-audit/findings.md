# Engineering Audit Findings & Risk Register

**Repository:** ProxiPilot (`proxipilot`)  
**Audit Phase:** Phase 10.1 Review & Enterprise Readiness Audit  
**Date:** October 19, 2026  

---

## Issue Tracking Matrix

| Issue ID | Severity | Category | Component | Status | Summary |
|:---|:---:|:---:|:---|:---:|:---|
| **F-001** | Low | Code Quality / Maintainability | `app/api/v1/routes/inbox.py` | Discovered | Deprecated Pydantic V1 `class Config` used in `ThreadDTO` and `MessageDTO`. |
| **F-002** | Medium | Reliability / Startup Safety | `app/main.py` & `app/services/qdrant_service.py` | Discovered | Qdrant health check during FastAPI startup does not handle connection failure gracefully if Qdrant container is offline. |
| **F-003** | Medium | Reliability / Concurrency | `app/services/context_resolver.py` | Under Review | Distributed Redis thread lock has fixed TTL=60s without background heartbeat renewal if downstream LLM/model stages are added. |
| **F-004** | Low | API Schema Consistency | `app/contracts/` & `app/services/context_resolver.py` | Under Review | Context envelope uses string timestamps (`isoformat()`) rather than typed `datetime` objects in Pydantic serialization. |
| **F-005** | High | Data Integrity & Concurrency | `app/services/context_resolver.py` | Discovered | In-memory summary update fallback does not check if thread subject or snippet has been updated by parallel inbound message. |

---

## Detailed Findings

### F-001: Deprecated Pydantic V1 Class-Based Config in Inbox Routes
- **Severity:** Low (Deprecation warning, will break in Pydantic 3.0)
- **Affected File:** `server/app/api/v1/routes/inbox.py` lines 55 & 76.
- **Evidence:** Pytest execution warning:
  `PydanticDeprecatedSince20: Support for class-based config is deprecated, use ConfigDict instead. Deprecated in Pydantic V2.0 to be removed in V3.0.`
- **Root Cause:** DTOs declare `class Config: from_attributes = True` instead of `model_config = ConfigDict(from_attributes=True)`.
- **Remediation:** Replace with standard Pydantic V2 `ConfigDict`.

---

### F-002: Qdrant Client Initialization Resilience on Startup
- **Severity:** Medium (Availability / Reliability)
- **Affected File:** `server/app/services/qdrant_service.py` & `server/app/main.py`.
- **Evidence:** `QdrantManager` attempts connection on startup. If Qdrant is temporarily restarting or uncontactable during an email burst, email ingestion could be affected if startup hooks block.
- **Root Cause:** Need to ensure vector store connectivity is decoupled from core transactional email ingress so that email ingestion can function even during Qdrant transient unavailability.
- **Remediation:** Ensure Qdrant health checks and connections are non-blocking or lazy with circuit breaking.

---

### F-003: Redis Distributed Thread Lock Heartbeat Renewal
- **Severity:** Medium (Concurrency & Lock Expiry)
- **Affected File:** `server/app/services/context_resolver.py`.
- **Evidence:** Context resolution acquires `lock = DistributedLock(lock_key, ttl_seconds=60)`. While current in-memory resolution takes < 1ms, future downstream stages (e.g. LLM summary generation) could exceed 60s under network latency or rate limiting, leading to lock expiration and split-brain execution.
- **Root Cause:** `DistributedLock` in `gmail_sync.py` has heartbeat renewal capability (`_renew_lock_heartbeat`), but `context_resolver.py` instantiated a basic lock without the background heartbeat task.
- **Remediation:** Wire lock heartbeat renewal into `context_resolver.py`'s lock context manager.

---

### F-004: Timestamp Type Safety in Context Envelope
- **Severity:** Low (Schema Quality)
- **Affected File:** `server/app/services/context_resolver.py`.
- **Evidence:** `created_at` and `sent_at` fields in `ContextMessage` and `ContextEnvelope` are typed as `str` populated by `.isoformat()` rather than `datetime`.
- **Remediation:** Consider accepting `datetime` with Pydantic V2 field serializers to preserve type safety across both Python and JSON boundaries.
