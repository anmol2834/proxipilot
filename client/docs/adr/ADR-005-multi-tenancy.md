# ADR-005: Multi-Tenancy & Authorization — Authoritative Token-Derived Tenant Resolution

## Status

Accepted

## Context

ProxiPilot is a multi-tenant SaaS. Malicious or compromised clients must never be able to access data of other tenants simply by spoofing an `X-Tenant-ID` header.

## Decision

All authenticated endpoints MUST resolve `tenant_id` exclusively from cryptographically signed JWT access tokens verified with `JWT_SECRET_KEY` via `app.core.security.get_current_tenant_id`.
Client-provided tenant headers are strictly disregarded for authorization.

## Consequences

- **Pros**: 100% cryptographic tenant isolation; eliminates tenant spoofing attacks; seamless multi-organization user switching via token exchange.
- **Cons**: Client must refresh tokens when switching active organizations.
