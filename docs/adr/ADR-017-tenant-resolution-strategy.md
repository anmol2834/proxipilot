# ADR-017: Tenant Resolution and Context Strategy

## Status
Accepted

## Context
In a multi-tenant SaaS architecture where users can belong to multiple organizations, trusting client-supplied tenant identifiers (e.g. from route parameters or request bodies) without server-side validation causes critical IDOR vulnerabilities. We needed an authoritative mechanism to resolve the current tenant.

## Decision
1. **Canonical Context Chain**:
   Every tenant-scoped request resolves:
   `Session ➔ User ➔ Target Org (Header/Param/Single-Org Default) ➔ Active Membership ➔ Role ➔ Permissions ➔ TenantContext`.
2. **Pre-Logic Resolution**:
   Tenant context resolution occurs in FastAPI dependencies (`get_tenant_context`) *before* request reaches endpoint business logic.
3. **No Blind Client Trust**:
   Even when an organization ID is supplied by the client (via header `X-Organization-ID` or path parameter `{organization_id}`), the server checks `organization_members` for `status == "ACTIVE"`. Inactive, suspended, or non-existent memberships immediately reject the request with HTTP 403.
4. **Single-Org Ergonomics**:
   For users with exactly one organization membership, the system auto-resolves that tenant when no explicit header is provided.

## Consequences
- Endpoints receive a validated, immutable `TenantContext` containing `user_id`, `organization_id`, `membership_id`, `role`, and `permissions`.
- Accidental cross-tenant access is rejected before DB queries execute.
