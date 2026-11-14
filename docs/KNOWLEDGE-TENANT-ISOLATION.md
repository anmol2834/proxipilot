# ProxiPilot — Knowledge Multi-Tenant Isolation & IDOR Defense (Phase 7.3)
============================================================
Status: FROZEN & AUTHORITATIVE  
Phase: 7.3 (Knowledge CRUD + Tenant Isolation)  
Last Updated: 2026-09-17  

This document details the multi-tenant isolation guarantees, authorization dependencies, and IDOR protection across all knowledge base operations.

---

## 1. The Core Security Invariant

> **CRITICAL RULE**: The frontend is NEVER a security boundary. The backend MUST independently verify user identity, organization membership, active status, fine-grained RBAC permissions, and resource ownership on EVERY request.

```
REQUEST (Authorization: Bearer <jwt>)
              │
              ▼
   get_tenant_context()
   - Decodes JWT sub -> user_id
   - Resolves target_org_id (Path > Header > Query > Default)
   - PostgreSQL join: OrganizationMember + Organization + Role + Permissions
   - Verifies OrganizationMember.status == ACTIVE
   - Verifies Organization.status == ACTIVE
              │
              ▼
   require_permission("knowledge.*")
   - Verifies required permission key exists in member's granted permissions
              │
              ▼
   KnowledgeCRUDService Query
   - Injects WHERE tenant_id = context.organization_id
              │
              ▼
   PostgreSQL B-Tree Index: ix_knowledge_items_tenant_created
```

---

## 2. Anti-IDOR Defense Matrix

| Attack Vector | Attacker Action | System Defense | Response |
| :--- | :--- | :--- | :--- |
| **Cross-Tenant Read** | Org A requests `/knowledge/{org_b_item_id}` | Query filters `tenant_id = org_a`. Row not found. | `404 Not Found` (Prevents enumeration) |
| **Cross-Tenant Update** | Org A submits `PATCH /knowledge/{org_b_item_id}` | Query filters `tenant_id = org_a`. Row not found. | `404 Not Found` |
| **Cross-Tenant Delete** | Org A submits `DELETE /knowledge/{org_b_item_id}` | Query filters `tenant_id = org_a`. Row not found. | `404 Not Found` |
| **Cross-Tenant History** | Org A requests `/knowledge/{org_b_item_id}/versions` | Verified against item's `tenant_id`. Row not found. | `404 Not Found` |
| **Forged Org Header** | User passes `X-Organization-Id: org_b` without membership | `get_tenant_context()` checks membership in PostgreSQL. | `403 Forbidden` |
| **Suspended Org** | Member attempts access while organization is suspended | `get_tenant_context()` verifies `organization.is_active`. | `403 Forbidden` |

---

## 3. RBAC Permission Matrix

| Operation | Required Permission | Allowed Roles |
| :--- | :--- | :--- |
| Create Knowledge Item | `knowledge.create` | `OWNER`, `ADMIN`, `MEMBER` |
| Read Knowledge Item | `knowledge.read` | `OWNER`, `ADMIN`, `MEMBER`, `VIEWER` |
| List Knowledge Items | `knowledge.read` | `OWNER`, `ADMIN`, `MEMBER`, `VIEWER` |
| Update Knowledge Item | `knowledge.update` | `OWNER`, `ADMIN`, `MEMBER` |
| Archive / Delete Item | `knowledge.delete` | `OWNER`, `ADMIN` |
| Custom Attribute Creation | `knowledge.create` (Admin) | `OWNER`, `ADMIN` |
| Schema Profile Creation | `knowledge.create` (Admin) | `OWNER`, `ADMIN` |
