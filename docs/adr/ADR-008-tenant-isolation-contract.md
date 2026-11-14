# ADR-008: Comprehensive Multi-Tenant Data Isolation Contract

## Status
Accepted (Phase 0 Architecture Freeze)

## Context
ProxiPilot operates as a multi-tenant B2B SaaS platform. Under no circumstances may data belonging to Organization A be accessed, retrieved, cached, indexed, or exposed to Organization B.

## Decision
Tenant isolation is enforced across every layer:
1. **PostgreSQL**: Every tenant-owned table requires `organization_id VARCHAR(64) NOT NULL INDEXED`.
2. **Qdrant**: Every point payload requires `tenant_id: str`. Every search request MUST include `FieldCondition(key="tenant_id", match=MatchValue(value=tenant_id))`.
3. **Redis**: Every cache and lock key must be prefixed with `domain:{organization_id}:...`.
4. **Event Bus**: Every event envelope requires `tenant_id`.

## Consequences
- **Positive**: Complete defense-in-depth preventing cross-tenant leakage.
- **Negative**: Developers must ensure `tenant_id` is supplied in all repository and retrieval queries.
