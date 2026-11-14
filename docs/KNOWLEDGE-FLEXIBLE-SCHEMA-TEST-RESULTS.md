# ProxiPilot — Flexible Schema Ingestion & Custom Attributes Test Results

**Document:** `docs/KNOWLEDGE-FLEXIBLE-SCHEMA-TEST-RESULTS.md`  
**Status:** Tested & Passed  
**Date:** October 18, 2026  
**Auditor:** ProxiPilot Core Systems Engineering  
**Scope:** Dynamic Schema Profiling, Canonical Field Normalization, and Arbitrary Custom Attribute Preservation  

---

## 1. Executive Summary

ProxiPilot's flexible-schema engine enables enterprise ingestion of arbitrary customer datasets without requiring schema migrations or custom database tables. This audit documents the automated validation of flexible-schema ingestion across three distinct data profiles:
1. **Dataset A (Product Catalog):** Physical goods with electrical/mechanical specifications, SKU identification, warranties, and supply chain references.
2. **Dataset B (Service Catalog):** Professional services with SLA guarantees, coverage areas, hourly rates, technician grades, and contract types.
3. **Dataset C (Previously Unseen Fields):** Complex and polymorphic data structures, including nested JSON objects, primitive arrays, booleans, high-precision decimals, ISO-8601 dates, enums, and unstructured free-text attributes.

All tests were executed against isolated test tenants in PostgreSQL with 100% type preservation, zero data loss, and deterministic semantic projection generation.

---

## 2. Ingestion & Storage Architecture

```
Source Data (CSV / XLS / XLSX / JSON)
               │
               ▼
   [Schema Profiler & Detection]
   ├── Detects Field Names & Types (Decimal, Date, Bool, Array, Object)
   ├── Discovers Primary Identifiers (SKU, ID, Code)
   └── Validates Required Fields
               │
               ▼
       [Canonical Normalizer]
       ├── Maps standard entity attributes (title, description, pricing, category)
       └── Encapsulates non-standard fields into typed custom attributes
               │
               ▼
    [PostgreSQL JSONB Ingestion]
    ├── knowledge_items (identity, tenant_id, category, external_key)
    └── knowledge_versions (canonical_data JSONB, version_number, status)
               │
               ▼
    [Deterministic Semantic Projection]
    └── Flattened structured narrative embedding canonical + custom attributes
```

### Architectural Principles:
1. **No Table-per-Customer Anti-Pattern:** Customer attributes are stored in `knowledge_versions.canonical_data` (JSONB) using validated keys and types, indexed via PostgreSQL GIN indexes (`idx_knowledge_versions_canonical_gin`).
2. **Type Preservation:** Numerics (rates, voltages, capacities) are parsed to Python `Decimal`/`float`; timestamps to ISO-8601 UTC strings; lists and dicts preserved natively without string truncation.
3. **Transparent Recovery:** Custom attributes are immediately accessible via standard CRUD endpoints and API response payloads (`GET /api/v1/knowledge/{item_id}`).

---

## 3. Test Dataset Specifications & Verification Results

### 3.1 Dataset A — Product Catalog (Physical Goods)

#### Input Schema & Fields:
- `product_name`: Inverter Frost-Free Double Door Refrigerator
- `SKU`: PROD-REF-450X
- `unit_cost`: 45999.00
- `voltage`: 230V AC
- `capacity_liters`: 450
- `warranty_months`: 36
- `energy_rating`: 5-Star BEE
- `vendor_reference`: VEND-SAMS-NORTH

#### Processing Results:
| Source Field | Target Mapping | Canonical Storage Path | Preserved Type | Status |
| :--- | :--- | :--- | :--- | :--- |
| `product_name` | Canonical Title | `canonical_data["title"]` | String | **Passed** |
| `SKU` | External Business Key | `external_identity_key` & `canonical_data["sku"]` | String | **Passed** |
| `unit_cost` | Pricing Struct | `canonical_data["pricing"]["base_price"]` | Decimal(45999.00) | **Passed** |
| `voltage` | Custom Attribute | `canonical_data["custom_attributes"]["voltage"]` | String ("230V AC") | **Passed** |
| `capacity_liters` | Custom Attribute | `canonical_data["custom_attributes"]["capacity_liters"]` | Integer (450) | **Passed** |
| `warranty_months` | Warranty Struct | `canonical_data["warranty"]["duration_months"]` | Integer (36) | **Passed** |
| `energy_rating` | Custom Attribute | `canonical_data["custom_attributes"]["energy_rating"]` | String ("5-Star BEE") | **Passed** |
| `vendor_reference` | Custom Attribute | `canonical_data["custom_attributes"]["vendor_reference"]` | String ("VEND-SAMS-NORTH") | **Passed** |

**Verification Outcome:** 100% field retention (8/8). Semantic projection incorporates specifications into searchable text:
`"Product Inverter Frost-Free Double Door Refrigerator [SKU: PROD-REF-450X]. Capacity: 450L, Voltage: 230V AC, Energy Rating: 5-Star BEE..."`

---

### 3.2 Dataset B — Service Catalog with SLAs

#### Input Schema & Fields:
- `service_name`: Commercial Chiller Annual Maintenance Contract
- `hourly_rate`: 1250.00
- `coverage_area`: Greater Metropolitan Industrial Zone
- `SLA`: 4-Hour Emergency Response
- `technician_grade`: Master HVAC Specialist
- `emergency_support`: True
- `contract_type`: B2B Enterprise

#### Processing Results:
| Source Field | Target Mapping | Canonical Storage Path | Preserved Type | Status |
| :--- | :--- | :--- | :--- | :--- |
| `service_name` | Canonical Title | `canonical_data["title"]` | String | **Passed** |
| `hourly_rate` | Pricing Struct | `canonical_data["pricing"]["base_price"]` | Decimal(1250.00) | **Passed** |
| `coverage_area` | Service Area | `canonical_data["service_area"]` | String | **Passed** |
| `SLA` | SLA Struct | `canonical_data["sla"]["description"]` | String ("4-Hour Emergency Response") | **Passed** |
| `technician_grade` | Custom Attribute | `canonical_data["custom_attributes"]["technician_grade"]` | String ("Master HVAC Specialist") | **Passed** |
| `emergency_support` | Custom Attribute | `canonical_data["custom_attributes"]["emergency_support"]` | Boolean (True) | **Passed** |
| `contract_type` | Custom Attribute | `canonical_data["custom_attributes"]["contract_type"]` | String ("B2B Enterprise") | **Passed** |

**Verification Outcome:** Boolean types are preserved without coercion to `"true"` or `1`. Structured SLA guarantees and technician qualifications are accurately extracted into canonical data and semantic projections.

---

### 3.3 Dataset C — Complex & Previously Unseen Fields

#### Input Schema & Fields:
Includes nested JSON configurations, list/array types, ISO date-times, high-precision numerics, and enumeration sets never pre-registered in any schema file.

```json
{
  "device_id": "IOT-SENSOR-NODE-88",
  "firmware_metadata": {
    "version": "v4.2.1-rc3",
    "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "build_timestamp": "2026-08-15T14:32:00Z"
  },
  "supported_frequencies_mhz": [868.1, 868.3, 868.5],
  "calibration_factor": 0.000491823,
  "operating_mode": "DEEP_SLEEP_PERIODIC",
  "is_hazardous_rated": false,
  "decommission_date": "2031-12-31"
}
```

#### Processing Results:
| Attribute | Raw Type | Canonical Preservation | Stored Representation in JSONB | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| `firmware_metadata` | Nested Object | Retained as dictionary | `{"version": "v4.2.1-rc3", "hash": "...", "build_timestamp": "..."}` | **Passed** |
| `supported_frequencies_mhz` | Float Array | Retained as JSON list | `[868.1, 868.3, 868.5]` | **Passed** |
| `calibration_factor` | High-Precision Float | Stored without truncation | `0.000491823` | **Passed** |
| `operating_mode` | Enum/Identifier | String | `"DEEP_SLEEP_PERIODIC"` | **Passed** |
| `is_hazardous_rated` | Boolean | Native JSON boolean | `false` | **Passed** |
| `decommission_date` | Date | ISO-8601 string | `"2031-12-31"` | **Passed** |

---

## 4. Edge Cases & Safety Gates

### 4.1 Missing Optional Fields
- Optional fields omitted in incoming datasets (e.g. `estimated_parts_cost`, `effective_until`) are preserved as `None` / `null` without throwing `KeyError` or schema validation exceptions.
- Default pricing qualifiers for missing fields default conservatively to `commercial_price_type: "not_specified"` rather than inferring fixed pricing.

### 4.2 Row-Level Errors & Validation Boundaries
- Invalid numeric strings (e.g., `unit_cost: "N/A"`, `hourly_rate: "$$$"`) trigger row-level error reporting in the import summary (`invalid_rows: [...]`) while valid rows continue processing without aborting the batch.
- Empty primary identifier keys result in rejected rows with explicit logging: `"MISSING_PRIMARY_IDENTIFIER"`.

### 4.3 Idempotency with Custom Attributes
- Repeated import of records containing nested custom attributes yields `PersistenceOutcome.UNCHANGED`.
- Updates to individual nested keys (e.g., updating `firmware_metadata.version` from `v4.2.1-rc3` to `v4.2.2`) correctly trigger a new version (`v2`) while preserving unchanged historical versions (`v1`).

---

## 5. Automated Test Evidence

The automated regression test suite validates flexible schema ingestion in:
`server/tests/test_knowledge_storage_audit.py::test_flexible_schema_ingestion_datasets_a_b_c`

```
PASSED server/tests/test_knowledge_storage_audit.py::test_flexible_schema_ingestion_datasets_a_b_c
- Ingested Dataset A: 1 item, 8 fields, 100% match.
- Ingested Dataset B: 1 item, 7 fields, 100% match.
- Ingested Dataset C: 1 item, 7 polymorphic fields (nested dict, array, bool, float), 100% match.
```

## 6. Conclusion

ProxiPilot's flexible-schema architecture satisfies all enterprise multi-tenant requirements. Source fields are consistently classified, mapped, or preserved as first-class custom attributes within PostgreSQL canonical JSONB storage, fully ready for deterministic semantic projection and hybrid retrieval.
