# KNOWLEDGE STORAGE OWNERSHIP & SYNC ARCHITECTURE
## Phase 9.6 — PostgreSQL as Source of Truth & Qdrant Search Synchronization

---

## 1. System Responsibilities

| System | Role | Authority | Storage Model |
|---|---|---|---|
| **PostgreSQL** | Authoritative Source of Truth | Master | Relational + Normalized `canonical_data` (JSONB) |
| **Qdrant Vector DB** | Semantic Search & Retrieval Index | Derived / Replica | Multi-vector collections with semantic payload filters |

### Guiding Principles
1. **Never write directly to Qdrant without PostgreSQL:** Every entity, version, and chunk originates in PostgreSQL.
2. **PostgreSQL holds full fidelity:** Complex business datasets (prices, repair catalog items, clothing sizes, quantities, nested attributes) are normalized and stored in PostgreSQL `canonical_data`.
3. **Qdrant holds search projections:** Chunks and vector payloads in Qdrant store semantic text, tenant boundary identifiers, semantic hashes, and search filters.
4. **Deterministic Synchronization:** When PostgreSQL records change or are soft/hard deleted, Qdrant vectors are automatically synchronized via projection pipelines and tombstone cleanup.

---

## 2. Schema Normalization & Domain Diversity

Businesses span vastly different domains:
- **Product Catalog (Retail/Fashion):** SKU, name, title, base price, currency, sizes (`S`, `M`, `L`, `XL`), colors, stock quantities, material, care instructions.
- **Repair Services:** Service name, diagnostic fee, labor charge, parts warranty, common symptoms, device compatibility, turnaround time.
- **Policies / FAQs:** Question, answer, conditions, effective dates, exceptions, escalation contacts.

### Canonical Data Standard in `knowledge_versions.canonical_data`
To support infinite schema variability while ensuring rigorous normalization:
```json
{
  "entity_type": "product | service | faq | policy | custom",
  "title": "Cotton Oversized T-Shirt",
  "price": {
    "amount": 499.00,
    "currency": "INR",
    "is_negotiable": false
  },
  "variants": [
    {"size": "M", "color": "Navy Blue", "stock": 15},
    {"size": "L", "color": "Navy Blue", "stock": 8}
  ],
  "attributes": {
    "material": "100% Combed Cotton",
    "care": "Machine wash cold"
  },
  "raw_source": { ... }
}
```

Every service normalizes incoming formats into `canonical_data`, ensuring mandatory fields (like pricing for products/services) are cleanly populated.

---

## 3. Projection & Synchronization Pipeline

1. **Ingest / Update:**
   - Write to `knowledge_items` + `knowledge_versions` (with `canonical_data`).
   - Version marked with `projection_status = 'pending'`, `sync_status = 'pending'`.
2. **Semantic Projection:**
   - Builds content chunk representations (`knowledge_chunks`).
   - Normalizes text representation including price, size, variant, and service details so embedding models capture high-relevance semantic context.
3. **Qdrant Vector Upsert:**
   - Chunks are embedded and upserted to Qdrant with tenant filter payload.
   - On success, `knowledge_versions.projection_status = 'synced'` and `semantic_status = 'synced'`.
4. **Deletions & Revisions:**
   - Deleted or archived items delete vector points via Qdrant point IDs tracked in `knowledge_chunks`.
