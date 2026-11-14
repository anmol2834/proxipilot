# ADR-014: Authoritative Server-Side Tenant Context Resolution

## Status
Accepted (Phase 2.7 Implementation)

## Context
In multi-tenant systems, allowing the frontend to specify `X-Organization-Id` without strict server-side validation opens severe Insecure Direct Object Reference (IDOR) vulnerabilities where an attacker could access another company's data simply by sending their organization ID.

## Decision
1. All requests pass through `get_tenant_context` dependency injection.
2. The authenticated user identity is derived strictly from a cryptographically signed JWT.
3. If an organization ID is specified (via URL path, header `X-Organization-Id`, or query), the server checks `organization_members` in PostgreSQL with `status == ACTIVE`.
4. If no active membership exists for that organization, the request is rejected immediately with `403 Forbidden` / `404 Not Found`.
5. Frontend permission state is strictly for UX (hiding/disabling buttons); backend independently verifies every protected action.

## Consequences
- **Positive**: Complete defense against cross-tenant IDOR and spoofing attacks.
- **Negative**: Adds a fast, indexed lookup query to resolve membership and permissions during request handling.
