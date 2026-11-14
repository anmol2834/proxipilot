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

### Authoritative Tenant Resolution
- The frontend CANNOT specify `tenant_id` in unverified request headers.
- `get_current_tenant_id` extracts `tenant_id` exclusively from cryptographically signed, verified JWT access tokens.

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
- `email.send`: Owner, Admin, Manager, Member
- `email.read`: Owner, Admin, Manager, Member, Viewer
