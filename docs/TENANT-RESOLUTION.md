# Secure Tenant Resolution Architecture

## 1. The Core Security Rule

Every authenticated, organization-scoped request must follow this strict sequence:

```
REQUEST
  ↓
SESSION COOKIE
  ↓
AUTHENTICATED USER
  ↓
TARGET ORGANIZATION RESOLUTION (Header / Query / Path / Default Single Org)
  ↓
ACTIVE MEMBERSHIP VERIFICATION (PostgreSQL / Cached Membership)
  ↓
ROLE LOOKUP
  ↓
RESOLVED PERMISSIONS MATRIX
  ↓
TENANT CONTEXT INSTANTIATED
  ↓
BUSINESS LOGIC / REPOSITORY ACCESS
```

### Insecure Anti-Pattern (PROHIBITED)
```
REQUEST ➔ Read organization_id from body/query ➔ Trust blindly ➔ Query Database
```
Trusting client-supplied IDs without verifying active membership allows trivial cross-tenant IDOR attacks.

## 2. Abstraction: `TenantContext`

All tenant-aware FastAPI dependencies inject `TenantContext`:

```python
class TenantContext(BaseModel):
    user_id: str
    organization_id: str
    membership_id: str
    role: str
    permissions: List[str]
```

### Dependency Chain:
1. `get_current_user_id`: Extracts and validates session from Redis/PostgreSQL.
2. `get_tenant_context`:
   - Checks client-provided `X-Organization-ID` header or route parameter.
   - If missing and user belongs to exactly one organization, resolves that organization automatically.
   - If user belongs to multiple organizations and none is specified, raises `400 Bad Request (ORGANIZATION_CONTEXT_REQUIRED)`.
   - Queries `OrganizationMember` where `user_id == current_user` and `organization_id == target_org` and `status == "ACTIVE"`.
   - If not found or inactive, raises `403 Forbidden (ORGANIZATION_ACCESS_DENIED)`.
   - Resolves role and permission bitmask/matrix from `AuthorizationService`.
   - Returns immutable `TenantContext`.

## 3. Single-Org vs. Multi-Org Support

- **Single Org Member**: Seamless zero-configuration access. The system resolves the single active organization automatically.
- **Multi-Org Member**: The client passes `X-Organization-ID` header. The server verifies membership for that specific tenant. No cross-tenant bleeding is possible.
