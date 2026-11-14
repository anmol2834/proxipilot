# Tenant Context Resolution & Request Pipeline

## 1. Request Lifecycle & Context Flow

Every request entering the application follows this strictly audited flow:

```text
HTTP Request
  ↓
API Gateway / Router
  ↓
Authentication Verification (`get_current_user`)
  ↓ [Yields validated TokenPayload]
Tenant Context Resolution (`get_tenant_context`)
  ├─ 1. Determine Target Org: Path param (`id`) > Header (`X-Organization-Id`) > Query > Default Org
  ├─ 2. Query PostgreSQL with composite index `(user_id, organization_id, status)`
  ├─ 3. Enforce `status == ACTIVE` and `org.is_active == True`
  └─ 4. Eager-load Role and Permissions in a single query
  ↓
FastAPI Dependency Injection (`TenantContext`)
  ↓
Permission Requirement (`require_permission("...")`)
  ↓
Route Handler / Domain Service
  ↓
Tenant-Scoped Database Query (`WHERE organization_id = context.organization_id`)
```

---

## 2. Insecure Direct Object Reference (IDOR) Protection

1. **Never trust client-supplied headers**: If a client passes `X-Organization-Id: org_victim`, the server checks whether the authenticated caller has an active record in `organization_members`. If not, `403 Forbidden` is returned immediately.
2. **Resource-Level Tenancy Checks**: When fetching an entity (e.g. `knowledge_items`, `email_threads`), query filters **must** include `organization_id = context.organization_id`. Accidental cross-tenant reads are prevented at the query level.
3. **Consistent Error Masking**: Attempts to manipulate tenant IDs or probe non-member organizations return uniform `403 Forbidden` or `404 Not Found` responses to eliminate account/tenant enumeration vectors.

---

## 3. Dependency Injection in Endpoints

```python
from fastapi import APIRouter, Depends
from app.core.context import TenantContext, require_permission

router = APIRouter()

# Simple tenant context extraction
@router.get("/profile")
async def get_profile(context: TenantContext = Depends(get_tenant_context)):
    return {"tenant": context.organization.name, "role": context.role_name}

# Fine-grained RBAC enforcement via dependency factory
@router.post("/items")
async def create_item(context: TenantContext = Depends(require_permission("knowledge.create"))):
    return {"status": "created", "tenant": context.organization_id}
```
