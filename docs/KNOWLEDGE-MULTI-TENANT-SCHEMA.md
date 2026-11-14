# ProxiPilot — Multi-Tenant Knowledge Architecture & Isolation Model (Phase 7.1)
============================================================
Status: FROZEN & AUTHORITATIVE  
Phase: 7.1 (Knowledge Taxonomy + Category Schemas)  
Last Updated: 2026-09-17  

This document formalizes the multi-tenant isolation model, relational security constraints, foreign-key safety guarantees, and anti-cross-tenant-confusion mechanisms across ProxiPilot's Knowledge System.

---

## 1. Multi-Tenant Tenancy Model

ProxiPilot enforces **logical schema partitioning within a shared relational database (PostgreSQL)**. Every tenant is represented as an authoritative record in `organizations` (`tenant_id = organizations.id`).

```
                            ORGANIZATION (Tenant Root)
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           ▼                            ▼                            ▼
     KNOWLEDGE SOURCE             KNOWLEDGE ITEM            CUSTOM ATTR DEF
    (tenant_id = Org.id)       (tenant_id = Org.id)       (tenant_id = Org.id)
                                        │
                                        ▼
                                 KNOWLEDGE VERSION
                                (tenant_id = Org.id)
                                        │
                                        ▼
                               KNOWLEDGE ATTRIBUTE
                              (tenant_id = Org.id)
```

### 1.1 Redundant `tenant_id` for Defense-in-Depth
While child entities (`KnowledgeVersion`, `KnowledgeAttribute`) reference parent records via foreign keys, ProxiPilot deliberately retains `tenant_id` directly on:
1. `knowledge_sources.tenant_id`
2. `knowledge_items.tenant_id`
3. `knowledge_versions.tenant_id`
4. `knowledge_attributes.tenant_id`
5. `knowledge_attribute_definitions.tenant_id`

**Architectural Rationale**:
- **Zero-Join Tenant Scoping**: Every query across any table includes `WHERE tenant_id = :current_tenant_id`, allowing PostgreSQL B-Tree compound indexes to isolate data partitions in $O(\log N)$ time without executing multi-table joins.
- **Defense Against Query Bugs**: If an ORM query mistakenly omits a join to `knowledge_items`, the direct `WHERE tenant_id = :tenant_id` predicate on `knowledge_versions` or `knowledge_attributes` physically prevents cross-tenant data leaks.
- **Safe Cascade Deletion**: Deleting an organization cascades cleanly across all child knowledge tables.

---

## 2. Organization-Scoped Uniqueness Constraints

Global unique constraints across business titles or keys are strictly forbidden. Natural business keys are guaranteed unique **only within an organization's boundary**:

### 2.1 Constraint Matrix

| Table | Constraint Name | Scoped Columns | Purpose |
| :--- | :--- | :--- | :--- |
| `knowledge_attribute_definitions` | `uq_knowledge_attr_def_tenant_cat_key` | `(tenant_id, category, key)` | Prevents duplicate custom attribute keys per category for the same tenant. |
| `knowledge_attributes` | `uq_knowledge_attributes_version_key` | `(knowledge_version_id, key)` | Enforces single attribute key per version (version is already tenant-owned). |
| `knowledge_versions` | `uq_knowledge_versions_item_version` | `(knowledge_item_id, version_number)` | Enforces monotonic version counter per item (item is already tenant-owned). |

---

## 3. Cross-Tenant Foreign Key Protection

### 3.1 The Multi-Tenant Foreign Key Attack Vector
In multi-tenant SaaS applications, a critical vulnerability occurs when an attacker in Organization A links their record to a resource belonging to Organization B (e.g. Org A's `KnowledgeItem` references Org B's `BusinessEntity` or Org B's `KnowledgeSource`).

### 3.2 ProxiPilot Mitigation Strategy
1. **Server-Side Context Resolution**: The backend resolves `tenant_id` authoritatively from the verified session token (`user_id` $\rightarrow$ `organization_members` with `status = 'ACTIVE'`). The client's `X-Organization-Id` header is never trusted without database verification.
2. **Relational Pre-Validation**: Before associating a `source_id` or `business_entity_id`, the service layer verifies:
   ```python
   stmt = select(KnowledgeSource).where(
       KnowledgeSource.id == source_id,
       KnowledgeSource.tenant_id == current_tenant_id  # MANDATORY SCOPE
   )
   source = (await db.execute(stmt)).scalar_one_or_none()
   if not source:
       raise HTTPException(status_code=404, detail="Knowledge source not found.")
   ```
3. **Physical Isolation**: Attempting to query or modify another organization's knowledge ID returns HTTP 404 (Not Found) rather than 403 (Forbidden), eliminating resource enumeration attacks.

---

## 4. The Anti-Cross-Tenant-Confusion Guarantee (RAG Safety)

A critical failure mode in multi-tenant AI systems is **entity collision hallucination**:
* Organization A has product *"Enterprise Plan"*, price = ₹9,999.
* Organization B has product *"Enterprise Plan"*, price = ₹19,999.

If the knowledge data model or future semantic projection pools data globally or relies solely on product titles, the AI model will hallucinate Organization B's pricing into Organization A's prospect negotiations.

### 4.1 Proof of Partitioning
ProxiPilot guarantees absolute partitioning across:
1. **Relational Grounding**:
   * Org A record: `(tenant_id = "org_A", id = "ki_001", title = "Enterprise Plan", price = 9999)`.
   * Org B record: `(tenant_id = "org_B", id = "ki_002", title = "Enterprise Plan", price = 19999)`.
   * Queries are strictly parameterized by `tenant_id`:
     ```sql
     SELECT * FROM knowledge_items WHERE tenant_id = 'org_A' AND title = 'Enterprise Plan';
     -- Returns ONLY ki_001. ki_002 is completely invisible.
     ```
2. **Future Vector Partitioning (Phase 10 Foundation)**:
   * Every semantic chunk projected from `KnowledgeVersion` will embed the mandatory metadata payload:
     ```json
     {
       "tenant_id": "org_A",
       "knowledge_item_id": "ki_001",
       "category": "products_services",
       "version_number": 1,
       "status": "active"
     }
     ```
   * Qdrant vector retrieval filters will always require `must: [{"key": "tenant_id", "match": {"value": current_tenant_id}}]`. Cross-tenant vectors can never enter the cosine similarity candidate set.

---

## 5. Caching & Redis Partitioning

Whenever knowledge metadata or category definitions are cached:
* **Global Static Data**: Category definitions from `KnowledgeCategoryRegistry` are application-level immutable singletons. They contain no tenant data and are cached in-memory process-wide.
* **Tenant-Scoped Data**: Any cached custom attribute definitions or knowledge item projections MUST use the tenant-prefixed cache key helper from `app.core.tenant`:
  ```python
  cache_key = build_tenant_cache_key(
      tenant_id=tenant_id,
      namespace="knowledge",
      resource="custom_attributes",
      key=category_key
  )
  # Result: "tenant:org_123:knowledge:custom_attributes:products_services"
  ```
* Direct keys like `"custom_attributes:products_services"` are strictly prohibited.
