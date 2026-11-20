# Knowledge Architecture — Phase 7.0 Specification

## 1. System Purpose & Architectural Objective
The ProxiPilot **Knowledge System** serves as the authoritative, multi-tenant knowledge substrate for the organization. It enables business operators to curate, verify, and maintain business truth (products, services, pricing, policies, operational workflows, and contact points) that downstream automation and AI pipelines safely project and retrieve without halluncination.

Phase 7.0 freezes the canonical data model, domain contracts, lifecycle state machine, source lineage, and database schema **before** any file ingestion (Phase 8), versioning UI (Phase 9), or Qdrant/RAG pipelines (Phase 10) are built.

---

## 2. Target Knowledge Domain Architecture

```
                       ORGANIZATION (tenant_id)
                                  │
                                  ▼
                         KNOWLEDGE ITEM (ki_...)
                   [Stable logical business identity]
                                  │
            ┌─────────────────────┴─────────────────────┐
            ▼                                           ▼
     KNOWLEDGE SOURCE (ks_...)                 KNOWLEDGE VERSION (kv_...)
[Origin, Authority, Lineage]              [Immutable content & state snapshot]
                                                        │
                      ┌─────────────────────────────────┼─────────────────────────────────┐
                      ▼                                 ▼                                 ▼
               Structured Facts                 Typed Attributes                 Semantic Text Content
            (Direct SQL queryable)             (knowledge_attributes)             (Human-readable text)
```

---

## 3. Core Conceptual Entities & Invariants

### 3.1 KnowledgeItem — Stable Logical Identity
- **Concept**: Represents an ongoing business entity or asset (e.g. `ProxiPilot Enterprise`, `Cancellation & Refund Policy`, `Ahmedabad Branch Office`).
- **Identity Invariant**: The `id` (`ki_<hex>`) and logical identity persist across updates. A KnowledgeItem is **never** deleted or recreated merely because its price, policy, or text changes.
- **Tenant Scope**: Strictly partitioned by `tenant_id` (`org_<hex>`). Organization A can never query, mutate, or link to Organization B's knowledge items.

### 3.2 KnowledgeVersion — Content State & Temporal Validity
- **Concept**: Represents the exact content and structured facts of a KnowledgeItem at a specific point in time.
- **Immutability Invariant**: Once transitioned to `active`, a version is **immutable**. Subsequent modifications create version $N+1$.
- **Temporal Range**: Contains `effective_from` and `effective_until` (UTC timestamps) to support time-sensitive business knowledge (e.g. seasonal pricing, promotional offers).
- **Dual Representation**:
  1. **Structured Facts & Typed Attributes**: Exact key-value data (e.g. `price=9999`, `currency='INR'`, `warranty='1 year'`) stored in `knowledge_attributes` for direct, high-speed SQL range filtering.
  2. **Semantic / Narrative Content**: Plain-text human-readable narrative stored in `content_text` ready for Phase 10 semantic chunking and embedding.

### 3.3 KnowledgeSource — Lineage & Authority
- **Concept**: Captures the origin and pedigree of every knowledge record.
- **Source Types**:
  - `manual`: Manually authored in dashboard UI.
  - `csv`: Ingested via tabular CSV file.
  - `xlsx`: Ingested via Microsoft Excel workbook.
  - `api`: Ingested via programmatic REST API.
  - `system`: Seeded or system-generated invariants.
  - `connector`: Ingested via external third-party integration (e.g. Zendesk, Notion).
- **Source Authority Hierarchy**:
  1. `system`: System-level facts and compliance rules.
  2. `owner`: Organization Owner verified entries.
  3. `admin`: Organization Admin operational entries.
  4. `business_profile`: Primary verified organizational profile.
  5. `imported_data`: Automated file imports (Phase 8).
  6. `manual`: General member manual entries.
  7. `external_source`: Unverified external web scrapes or third-party webhooks.

### 3.4 KnowledgeCategory — Centralized 6-Category Taxonomy
The system enforces a centralized, non-extensible 6-category taxonomy (see `KNOWLEDGE-TAXONOMY.md`):
1. `company_info`: Company-level facts, industry, headquarters, and the company's contact details (email, phone, address, business hours).
2. `products_services`: Products, services, specifications, tiers, availability, and **pricing**.
   > **CRITICAL RULE**: There is **NO** independent `pricing` category. Pricing is strictly an attribute of `products_services`.
3. `policies`: Legal agreements, cancellation terms, refund policies, warranties.
4. `support_faqs`: Frequently asked questions and canonical answers.
5. `offers_promotions`: Active campaigns, discount percentages, promo codes, eligibility windows.
6. `processes_timelines`: How things work and how long they take — PO/order confirmation, quotation turnaround, dispatch and delivery lead times, payment/refund processing, onboarding and installation steps.

### 3.5 KnowledgeAttribute — Strongly Typed Fact Storage
To prevent the **giant unstructured JSONB anti-pattern**, attributes are stored as typed rows in `knowledge_attributes`:
- `string_value` (`VARCHAR(1024)`)
- `text_value` (`TEXT`)
- `number_value` (`DOUBLE PRECISION`): Used for integers, decimals, and currency amounts. Indexed with `(tenant_id, key, number_value)` for fast numeric range filtering (e.g. `price BETWEEN 1000 AND 5000`).
- `boolean_value` (`BOOLEAN`)
- `date_value` (`TIMESTAMPTZ`)
- `json_value` (`TEXT`): Serialized arrays or enum values only.

---

## 4. Multi-Tenant Isolation & Security Boundary
1. **Database Schema Enforcment**:
   - `knowledge_items`, `knowledge_versions`, `knowledge_sources`, and `knowledge_attributes` all inherit `TenantAwareMixin`.
   - All unique constraints and primary query indexes are compound prefixed with `tenant_id`.
2. **Authoritative Request Resolution**:
   - All operations require `TenantContext` injected via `get_tenant_context()`.
   - The caller's `organization_id` is extracted from verified JWT session cookies and validated against PostgreSQL `organization_members`.
   - Client headers (`X-Organization-Id`) or query params cannot bypass the user's active membership.
3. **Role-Based Access Control (RBAC)**:
   - `knowledge.read`: Permitted for `OWNER`, `ADMIN`, `MEMBER`.
   - `knowledge.create`: Permitted for `OWNER`, `ADMIN`, `MEMBER`.
   - `knowledge.update`: Permitted for `OWNER`, `ADMIN`, `MEMBER`.
   - `knowledge.delete`: Restricted to `OWNER`, `ADMIN`.

---

## 5. Future Phase Compatibility

### Phase 8 Compatibility (Tabular & Document Ingestion)
- The ingestion worker in Phase 8 will accept CSV/XLSX files, generate a `KnowledgeSource` row with `source_type='csv'`, and create `KnowledgeItem` + `KnowledgeVersion` rows.
- Column mapping rules will map arbitrary header names (e.g. `Rate`, `Cost`, `MRP`) into canonical `KnowledgeAttribute` keys (`price`) with `value_type='currency'`.

### Phase 9 Compatibility (Version History & Diffing)
- `KnowledgeVersion` stores monotonic `version_number` with `change_summary`.
- Rollback is non-destructive: activating version $K$ marks version $K$ as `active` and archives version $N$, preserving complete audit lineage.

### Phase 10 Compatibility (Semantic Vector Projection & RAG)
- `KnowledgeVersion` already contains `vector_ids`, `chunk_count`, and `embedding_model` columns.
- When Phase 10 runs, workers will chunk `content_text`, compute dense embeddings, push vectors to Qdrant, and populate `vector_ids` without any schema migrations.
