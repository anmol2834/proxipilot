# ProxiPilot — Knowledge Schema Mapping & Fingerprinting (Phase 7.2)
============================================================
Status: FROZEN & AUTHORITATIVE  
Phase: 7.2 (Flexible Schema + Typed Attribute Engine)  
Last Updated: 2026-09-17  

This document specifies the rules for source column detection, canonical alias resolution, ambiguity rejection, and persistent mapping profile reuse.

---

## 1. Mapping Resolution Hierarchy

Incoming dataset headers are classified according to a strict priority hierarchy:

1. **Exact Canonical Match** (Confidence: `1.0`):
   Source column matches canonical field name in target category.
2. **Category-Aware Canonical Alias** (Confidence: `0.95`):
   Source column matches precomputed alias for target category (e.g. `"mrp"` $\rightarrow$ `price` in `products_services`).
3. **Tenant-Scoped Custom Attribute Key** (Confidence: `0.90`):
   Source column matches normalized key of an attribute defined for this tenant in this category.
4. **Tenant-Scoped Custom Attribute Display Name** (Confidence: `0.85`):
   Source column matches normalized display name of a tenant custom attribute.
5. **Ambiguous Columns** (Confidence: `0.0`, `target_kind=UNMAPPED`):
   Generic keywords (`value`, `data`, `info`, `custom`, `field`, `val`, etc.) are never aggressively auto-mapped. They require human confirmation.
6. **Unknown Columns** (Confidence: `0.0`, `target_kind=UNMAPPED`):
   Columns not recognized by any of the above rules. The UI prompts the user to either map them to an existing field, create a custom attribute, or ignore the column.

---

## 2. Category Contextuality

A source column header's semantic meaning depends on the category context:

| Source Column Header | Category: `products_services` | Category: `offers_promotions` | Category: `company_info` |
| :--- | :--- | :--- | :--- |
| `"cost"` | `price` | `discount_value` | Unmapped |
| `"title"` | `name` | `title` | Unmapped |
| `"name"` | `name` | `title` | `trade_name` |
| `"discount"` | Custom attribute | `discount_value` | Unmapped |
| `"city"` | `region` | Unmapped | Unmapped |

---

## 3. Schema Fingerprinting & Reusable Profiles

### 3.1 Fingerprint Algorithm
To recognize identical dataset schemas without reading rows:
```python
def compute_schema_fingerprint(columns: List[str], category: str) -> str:
    normalized_cols = sorted({sanitize_attribute_key(col) for col in columns if col.strip()})
    payload = f"cat:{category.strip().lower()}|cols:{','.join(normalized_cols)}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
```

### 3.2 Mapping Profile Storage (`knowledge_schema_profiles`)
Approved mappings can be saved as persistent profiles:
- `id`: `ksp_{uuid}`
- `tenant_id`: Scoped strictly to the owning organization.
- `category`: Knowledge category key.
- `fingerprint`: SHA-256 schema hash.
- `mappings_json`: Approved list of `FieldMapping` descriptors.
- `version`: Incrementing integer version for mapping changes.

When the same organization uploads another file with the same columns in the future, the system suggests or reuses the saved profile automatically.
