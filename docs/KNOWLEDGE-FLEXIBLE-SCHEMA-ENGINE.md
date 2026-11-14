# ProxiPilot — Flexible Schema Engine Architecture (Phase 7.2)
============================================================
Status: FROZEN & AUTHORITATIVE  
Phase: 7.2 (Flexible Schema + Typed Attribute Engine)  
Last Updated: 2026-09-17  

This document formalizes the Controlled Normalization Layer between external customer datasets and ProxiPilot's canonical knowledge models.

---

## 1. The Core Architecture

Heterogeneous external datasets cannot directly populate a relational database without either schema churn (`ALTER TABLE`) or creating unstructured JSON blobs. Phase 7.2 solves this with a multi-layered normalization engine:

```
EXTERNAL USER DATA (CSV, XLSX, API, Connectors)
                    │
                    ▼
           LAYER 1: SOURCE SCHEMA
      (Original column headers preserved)
                    │
                    ▼
      LAYER 2: SCHEMA NORMALIZATION
   (Deterministic comparison key generation)
                    │
                    ▼
         LAYER 3: FIELD MAPPING
  (Category-aware canonical and tenant custom)
                    │
                    ▼
          LAYER 4: TYPE SYSTEM
(STRING, TEXT, INTEGER, DECIMAL, BOOLEAN, DATE, etc.)
                    │
                    ▼
         LAYER 5: NORMALIZATION
(Safe coercion, null preservation, controlled ops)
                    │
                    ▼
       LAYER 6: VALIDATED RECORD
 (Canonical fields + Typed custom attributes)
                    │
                    ▼
           POSTGRESQL STORAGE
 (KnowledgeVersion.content_text + KnowledgeAttributes)
```

---

## 2. The Critical Performance Rule: CompiledSchemaPlan

> **CRITICAL INVARIANT**: The system must NEVER infer column mappings independently for each row.

### The Naive Anti-Pattern (To Avoid):
- For row 1: detect `"cost"` $\rightarrow$ `price`, query DB for custom attributes, validate.
- For row 2: detect `"cost"` $\rightarrow$ `price`, query DB for custom attributes, validate.
- Result: $O(R \times F)$ database roundtrips, CPU saturation, unusable for datasets with $>1,000$ rows.

### The ProxiPilot Compiled Architecture:
1. When a dataset is ingested or configured, its schema is inspected **once**.
2. Approved mappings are compiled into an immutable `CompiledSchemaPlan`.
3. In `CompiledSchemaPlan`, all transformers, validators, regex patterns, allowed enum sets, and type coercers are pre-bound.
4. Rows pass through `normalize_batch(rows, compiled_plan)` locally in memory:
   - **Zero database queries per row**
   - **Zero Redis queries per row**
   - **Zero LLM calls**
   - **Pure $O(R \times F)$ CPU throughput** ($>50,000$ rows/second)

---

## 3. Multi-Tenant Isolation

All custom attribute definitions, aliases, mapping rules, and schema profiles are strictly organization-scoped:
- **Org A**: `warranty_period` $\rightarrow$ `INTEGER` (e.g. 12, 24, 36)
- **Org B**: `warranty_period` $\rightarrow$ `STRING` (e.g. "Lifetime Limited", "1 Year Parts")

Neither organization can discover, resolve, or borrow the other's attribute definitions or schema profiles.
All cache keys are tenant-scoped:
```python
cache_key = (tenant_id, category, schema_fingerprint)
```

---

## 4. Category-Aware Canonical Field Aliases

Canonical aliases are strictly scoped by category:
- `"cost"` in `products_services` maps to `price` (commercial price).
- `"cost"` in `offers_promotions` maps to `discount_value` (promotional discount).
- `"amount"` in `products_services` maps to `price`.
- Canonical fields have priority; custom attributes cannot collide with canonical fields.

---

## 5. Schema Fingerprinting & Mapping Reuse

Datasets with the same columns produce an identical deterministic SHA-256 fingerprint:
```python
fingerprint = hashlib.sha256(f"cat:{category}|cols:{','.join(sorted_normalized_columns)}".encode()).hexdigest()
```
Organizations can persist an approved mapping as a `KnowledgeSchemaProfile` (table `knowledge_schema_profiles`) and automatically reuse it for recurring imports without manual reconfiguration.

---

## 6. Integration Contract with Phase 8 (Ingestion) & Phase 10 (RAG)

### Phase 8 Contract:
Phase 8 bulk ingestion workers consume the flexible schema engine via:
1. `flexible_schema_engine.detect_schema(...)`
2. `flexible_schema_engine.compile_plan(...)`
3. `flexible_schema_engine.normalize_batch(chunk, plan)`
Phase 8 never defines its own mapping or coercion logic.

### Phase 10 Contract:
The normalized output retains complete metadata required for future semantic projection and vectorization:
- `organization_id`
- `category`
- `canonical` structured dictionary
- `custom` typed dictionary
- Lineage origin
Zero tenant context is stripped.
