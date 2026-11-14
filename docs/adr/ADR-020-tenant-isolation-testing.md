# ADR-020: Automated Multi-Tenant Isolation & IDOR Verification

## Status
Accepted

## Context
Multi-tenancy security cannot rely on client-side routing, hidden UI elements, or obfuscated resource IDs. Direct HTTP attacks, IDOR probing, and header manipulation must be deterministically rejected by backend authorization filters.

## Decision
1. Establish an automated integration test suite (`tests/test_tenant_security.py`) that provisions two independent organizations (Tenant A and Tenant B) with distinct users, memberships, profiles, preferences, and keys.
2. Formally test and verify:
   - Tenant A cannot access or mutate Tenant B organizations, business profiles, or preferences (`403 Forbidden`).
   - Spoofed `X-Organization-Id` headers without active membership are rejected with `403 Forbidden`.
   - Redis keys are strictly namespaced (`tenant:{org_id}:{namespace}:{key}`).
   - Qdrant queries must require tenant filtering or fail fast with `TenantScopingError`.
   - Domain event envelopes must include `tenant_id` or fail fast with `TenantScopingError`.
   - Audit events are strictly tenant-isolated.

## Consequences
- Guaranteed cross-tenant isolation enforced at the API, database, cache, vector store, and event layers.
- Regression safety during future feature development.
