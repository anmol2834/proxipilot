# ProxiPilot Security Architecture Specification

> **Security Principles**: Least Privilege, Zero Trust, Defense-in-Depth, Authoritative Tenant Isolation

---

## 1. Tenant Data Isolation

ProxiPilot is a multi-tenant platform. Cross-tenant data leakage is catastrophic and strictly prohibited.

### Database Layer (PostgreSQL)
- All tenant tables inherit from `TenantAwareMixin` in `app/models/base.py`, enforcing an indexed `tenant_id` column.
- Every SELECT, UPDATE, DELETE query MUST include `WHERE tenant_id = :tenant_id`.

### Cache & Ephemeral State (Redis)
- All Redis keys MUST be generated using `RedisManager.build_tenant_key(tenant_id, namespace, key)`.
- Global keys without tenant scoping are strictly forbidden for business data.

### Vector Search (Qdrant)
- Unrestricted vector searches are strictly banned.
- All searches must enforce `QdrantManager.build_tenant_filter(tenant_id)`.

### Authoritative Tenant Resolution & IDOR Prevention
- The frontend CANNOT specify `organization_id` in unverified request headers or URLs and expect implicit trust.
- Every tenant-scoped request resolves:
  `Session ➔ User ➔ Target Org (Header/Param/Single-Org Default) ➔ Active Membership ➔ Role ➔ Permissions ➔ TenantContext`.
- If client supplies an `organization_id`, server queries `organization_members` with `user_id == current_user` and `status == "ACTIVE"`.
- Attempts to query or update other tenants' organizations, business profiles, or workspace preferences immediately return `403 Forbidden (ORGANIZATION_ACCESS_DENIED)`.
- All tenant repository operations require `organization_id == context.organization_id`.

---

## 2. Secrets Management & Cloud Secret Managers

- **Zero Secrets in Source Code**: `.env` is gitignored. `.env.example` contains placeholders only.
- **Service Scoping**: Different services consume only their required credentials (`ApiSettings`, `AiWorkerSettings`, `EmailWorkerSettings`).
- **Cloud Secret Manager Integration**:
  - AWS Secrets Manager / Azure Key Vault / GCP Secret Manager inject secrets directly into the container environment at startup.
  - The application code reads environment variables through `app/core/config.py` without requiring proprietary vendor SDKs.
- **Log Redaction**: `app/core/logging.py` automatically redacts sensitive keys (`password`, `secret`, `token`, `api_key`, `authorization`).

---

## 3. Untrusted Email & HTML Ingestion Safety

- Inbound email content (HTML, attachments, tracking pixels, links) is inherently untrusted.
- Outbound responses and parsed email content must be sanitized before rendering.
- No direct evaluation of incoming scripts or execution of arbitrary code from email attachments.

---

## 4. Role-Based Access Control (RBAC)

The platform supports 5 core roles:
`Owner` | `Admin` | `Manager` | `Member` | `Viewer`

Permissions are evaluated using `can(role, action)`:
- `billing.manage`: Owner only
- `email.delete`: Owner and Admin
- `email.read`: Owner, Admin, Manager, Member, Viewer

---

## 5. Audit Event System & Secret Scrubbing

- Centralized `AuditService.record(...)` records all state-changing identity, organization, business profile, and workspace events.
- Strict metadata scrub rule: passwords, hashes, OTP codes, session secrets, API keys, and authorization headers are scrubbed before persistence via `sanitize_audit_metadata`.
- Compound database indexes ensure performant tenant-scoped retrieval without exposing logs cross-tenant.

---

## 6. Automated Security & Isolation Testing

- Automated test suites verify:
  1. `test_tenant_security.py`: Cross-tenant IDOR defense, header spoofing rejection, Redis namespace isolation, Qdrant tenant scoping, event envelope isolation.
  2. `test_auth_security.py`: OTP single-use burn, brute-force lockout, 45s resend rate-limiting, session revocation on signout, multi-device independent login.
