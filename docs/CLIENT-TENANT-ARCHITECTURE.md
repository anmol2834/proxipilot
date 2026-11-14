# Client Multi-Tenant Architecture & Cache Isolation

## 1. Multi-Tenant Philosophy

In ProxiPilot, users can belong to multiple organizations with distinct roles and granular permissions.
However, **the client never trusts client-supplied organization context as an authorization token.**

The client acts as a context selector:
- The current organization determines the active view in the dashboard.
- The client sends `X-Organization-Id` in requests.
- The backend independently authenticates the session, verifies membership in the specified organization, and enforces permission gates on every request.

---

## 2. Multi-Tenant Cache Isolation

To guarantee that User B2 in Organization B2 never accidentally sees data cached from Organization B3, all tenant-specific server data in TanStack Query is isolated by key:

```typescript
// Query Key Factory
queryKeys.inbox.lists(organizationId)       // ["inbox", orgId, "list"]
queryKeys.knowledge.collections(organizationId) // ["knowledge", orgId, "collections"]
queryKeys.tenant.businessProfile(organizationId)// ["tenant", orgId, "business-profile"]
queryKeys.tenant.preferences(organizationId)    // ["tenant", orgId, "preferences"]
```

---

## 3. Tenant Switching Protocol

When an organization switch is triggered via `TenantProvider.switchOrganization(targetOrgId)`:

1. **Cancel in-flight queries**: Prevents outstanding HTTP requests from writing stale tenant data into the cache.
2. **Purge active tenant cache**: Removes previous tenant-scoped queries via query key predicates.
3. **Switch active tenant state**: Updates `selectedOrgId` and triggers loading transitions.
4. **Targeted query priming**: Preloads foundational context for the new tenant.

---

## 4. B2 vs B3 Verification Matrix

| Action | Tenant B2 Attempt on B3 | Result |
|---|---|---|
| Direct API access to B3 Org | `GET /api/v1/organizations/{b3_id}` | `403 Forbidden` (Verified via automated test) |
| Spoofed `X-Organization-Id` Header | `GET /api/v1/onboarding/state` with B3 ID | Rebuffed to user's authorized org or rejected (Verified) |
| Cross-tenant Vector Search | Search with B2 org filter | Qdrant restricts payload filter to B2 vectors (Verified) |
| Client Query Cache | Switching between B2 and B3 | Previous tenant state evicted; no stale leak (Verified) |
