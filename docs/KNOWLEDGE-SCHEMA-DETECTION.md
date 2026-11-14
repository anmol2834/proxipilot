# ProxiPilot — Enterprise Schema Detection Architecture (Phase 8.3)
============================================================
Status: IMPLEMENTED & VERIFIED  
Phase: 8.3 (Schema Detection, Candidate Generation & Column Classification)  
Last Updated: 2026-09-17  

---

## 1. Executive Summary

Schema Detection is the translation layer connecting raw, heterogeneous external dataset profiles (Phase 8.2) to ProxiPilot's structured canonical knowledge models and tenant-defined custom attributes.

External business spreadsheets routinely use varying terminologies for identical domain concepts:
- `product_title` or `item_name` $\rightarrow$ Canonical `name`
- `cost`, `mrp`, or `retail_price` $\rightarrow$ Canonical `price`
- `stock`, `inventory_qty`, or `available_units` $\rightarrow$ Canonical `availability`
- `warranty_period` $\rightarrow$ Tenant Custom Attribute `warranty_info`

The Schema Detection engine transforms these disparate inputs into explainable, deterministic classifications:
`CANONICAL_FIELD`, `CUSTOM_ATTRIBUTE`, `NEEDS_REVIEW`, `UNMAPPED`, or `IGNORED`.

### Key Guarantees
1. **Deterministic Resolution**: Strict priority hierarchy prevents fuzzy hallucination or non-repeatable mappings.
2. **Category Context**: Identical column names resolve differently depending on category (`cost` $\rightarrow$ `price` in `products_services`, but offer amount in `offers_promotions`).
3. **Multi-Tenant Isolation**: Tenant custom attributes and saved mapping profiles are strictly partitioned by `organization_id`.
4. **Compile-Once Invariant**: Schema mapping executes **once per dataset**, generating an immutable `CompiledMappingPlanDTO` for Phase 8.4 row validation without per-row or per-column overhead.
5. **Zero LLM Dependency**: Relies exclusively on precomputed alias indices, type compatibility matrices, and constrained string distance metrics.

---

## 2. Detection Pipeline Architecture

```
                 Profiled Dataset (Phase 8.2 Profile)
                                ↓
                 Extract & Normalize Column Names
                                ↓
               Load Tenant Metadata (Single Query)
                                ↓
               Construct ColumnMappingIndex (O(1))
                                ↓
      ┌──────────────────────────────────────────────────┐
      │          Deterministic Signal Hierarchy          │
      │                                                  │
      │  1. Exact Canonical Field Match                  │
      │  2. Category-Aware Canonical Alias Match         │
      │  3. Tenant Custom Attribute Match                │
      │  4. Constrained Token / Jaccard Similarity       │
      │  5. Ambiguity Keyword & Candidate Safety         │
      │  6. Type & Sample-Value Compatibility Filter     │
      └──────────────────────────────────────────────────┘
                                ↓
                    Calculate Explainable Confidence
                                ↓
               Target Classification Assignment:
   [CANONICAL_FIELD] | [CUSTOM_ATTRIBUTE] | [NEEDS_REVIEW] | [UNMAPPED]
                                ↓
                  Compile Immutable Mapping Plan
                                ↓
              Ready for Phase 8.4 Row Normalization
```

---

## 3. Signal Priority Hierarchy

To guarantee deterministic, explainable results, signals are evaluated in strict order:

| Priority | Signal | Confidence Range | Mapping Reason | Description |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Exact Canonical Match** | $0.90 - 1.00$ | `EXACT_CANONICAL` | Exact snake_case match against canonical field in category |
| **2** | **Category-Aware Alias Match** | $0.85 - 0.95$ | `CATEGORY_ALIAS` | Exact match against category alias registry (`products_services`, etc.) |
| **3** | **Tenant Custom Attribute** | $0.80 - 0.90$ | `CUSTOM_ATTRIBUTE_KEY` / `DISPLAY` | Matches tenant custom attribute key or sanitized display name |
| **4** | **Token / String Similarity** | $0.55 - 0.80$ | `TOKEN_SIMILARITY` | Combined Token Jaccard + Bounded Levenshtein similarity $\ge 0.55$ |
| **5** | **Ambiguous Keyword Guard** | $\le 0.40$ | `AMBIGUOUS_KEYWORD` | Catches generic words (`title`, `value`, `status`, `id`) and forces `NEEDS_REVIEW` |
| **6** | **Type / Sample Mismatch** | $\le 0.20$ | `TYPE_MISMATCH` | Demotes match to `NEEDS_REVIEW` if types are structurally incompatible |
| **7** | **Unmatched Fallback** | $0.00$ | `UNKNOWN` | No candidate meets criteria; marked as `UNMAPPED` |

---

## 4. Ambiguity & Safety Invariants

In enterprise data ingestion, **correctness and explainability supersede aggressive mapping**. A field incorrectly mapped into a canonical model will pollute downstream AI facts and vector embeddings.

### 4.1 Ambiguous Keywords
Generic column headers like `value`, `amount`, `title`, `type`, `status`, `id`, `code`, `data`, and `info` are intercepted. Unless an exact category alias or canonical field explicitly claims them, they are never mapped via similarity and immediately produce `NEEDS_REVIEW`.

### 4.2 Candidate Collision & Multiple Close Matches
When evaluating token similarity, if the top candidate score is close ($\Delta \le 0.15$) to another candidate (e.g., source column `discount` competing between `discount_amount` and `discount_percentage`), the engine rejects automatic assignment and emits `NEEDS_REVIEW` with both candidates listed in `ColumnMappingDTO.candidates`.

### 4.3 Duplicate Target Prevention
A canonical target field can only be assigned once per dataset. If multiple source columns match the same canonical target (e.g., both `name` and `product_title` present), the highest-priority/earlier match claims the target, and subsequent duplicates are flagged with `NEEDS_REVIEW`.

---

## 5. Schema Fingerprint & Profile Reuse

When a tenant uploads recurring dataset formats (e.g. daily inventory exports):
1. Phase 8.2 computes a deterministic SHA-256 `schema_fingerprint` based on sorted, normalized column headers and types.
2. The engine checks PostgreSQL for an existing, approved `KnowledgeSchemaProfile` matching `(tenant_id, category, schema_fingerprint)`.
3. **Stale Detection Invariant**: Before reusing a saved profile, the engine verifies:
   - All source columns in the profile match the dataset's current columns.
   - All mapped canonical targets still exist in the current category schema.
   - All mapped custom attributes still exist in tenant definitions and their data types have not changed.
4. If valid, the engine reuses the approved mapping with `is_reused_from_profile=True` and reason `SAVED_PROFILE_REUSE`.
5. If stale or invalidated, reuse is aborted and fresh detection executes.

---

## 6. Multi-Tenant Security & Isolation

- **Partitioned Lookups**: In-memory `ColumnMappingIndex` loads custom attributes filtered strictly by `tenant_id` and `category`.
- **Precedence Rule**: Tenant custom attributes **cannot override** canonical category fields. If a tenant creates an attribute named `price`, canonical `price` always takes precedence.
- **Cross-Tenant Barrier**: Tests verify Tenant B's custom attributes and schema profiles are invisible and inaccessible to Tenant A.
