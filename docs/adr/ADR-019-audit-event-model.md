# ADR-019: Centralized Audit Event Model & Metadata Scrubbing

## Status
Accepted

## Context
ProxiPilot requires an immutable, multi-tenant-scoped audit event recording mechanism for compliance, security investigation, and operational transparency. Raw database insertions scattered across domain handlers risk inconsistent event structures, unindexed queries, and accidental leakage of sensitive credentials into log tables.

## Decision
1. Introduce a dedicated `audit_events` table with compound indexes on `(organization_id, created_at)` and `(resource_type, resource_id)`.
2. Provide a single centralized abstraction `AuditService.record(...)` that enforces:
   - Mandatory resource attribution (who, what, which resource, which tenant, when).
   - Automatic metadata sanitization via `sanitize_audit_metadata` to strip passwords, tokens, hashes, and OTPs.
   - Transactional participation: audit writes occur within the active database transaction for atomic consistency.
3. System operations without a human caller explicitly set `actor_user_id = None` and `actor_type = "SYSTEM"`.

## Consequences
- Reliable, structured security event trail across all tenant domains.
- Zero secret exposure risk in audit records.
- Fast, indexed tenant-scoped audit retrieval.
