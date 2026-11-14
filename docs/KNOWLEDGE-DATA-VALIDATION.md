# ProxiPilot — Enterprise Data Quality & Row Validation Architecture (Phase 8.4)
============================================================
Status: IMPLEMENTED & VERIFIED  
Phase: 8.4 (Data Quality, Row-Level Validation & Error Diagnostics)  
Last Updated: 2026-09-17  

---

## 1. Executive Summary

Phase 8.4 consumes the deterministic `CompiledMappingPlanDTO` (Phase 8.3) and streams raw dataset rows into typed, validated, and normalized records ready for AI canonical ingestion.

Data quality is enforced under the **Correct & Deterministic over Aggressive Auto-Cleaning** principle:
- If a record cannot be safely interpreted, it is classified as `WARNING` or `INVALID` rather than silently modified with assumed business semantics.
- A single bad row does not crash the entire dataset import (Error Isolation).
- Zero database queries are performed per row (O(1) database complexity relative to dataset size).

---

## 2. Centralized Data Quality States

Every row evaluated by `RowQualityService` resolves to one of three authoritative states:

| Status | Definition | downstream Action |
| :--- | :--- | :--- |
| **`VALID`** | All required canonical fields are populated, all type constraints pass, bounds and regexes are satisfied, and zero warnings exist. | Approved for Phase 8.5 persistence into canonical knowledge. |
| **`WARNING`** | All required fields and types pass, but non-fatal quality issues exist (e.g. duplicate identical record, conflicting duplicate, non-standard formatting). | Ingested into canonical knowledge, but flagged with diagnostic audit warnings for reviewer visibility. |
| **`INVALID`** | One or more fatal errors occurred (e.g. missing required canonical field, unparseable numeric/decimal type, invalid enum option, out-of-bounds value). | Rejected from canonical knowledge; structured error diagnostics logged in `ImportJob.metadata_json["quality_summary"]`. |

---

## 3. Structured Error Diagnostics (`RowQualityIssueDTO`)

Generic error messages like `"Invalid row"` are strictly forbidden. Every observed defect produces a structured diagnostic:

```json
{
  "row_number": 17,
  "field": "price",
  "source_field": "Cost",
  "error_code": "INVALID_DECIMAL",
  "severity": "ERROR",
  "message": "Cannot parse 'FREE_OF_CHARGE' as a valid decimal number.",
  "invalid_value": "FREE_OF_CHARGE"
}
```

### Machine-Readable Error Codes (`RowQualityErrorCode`)
- `REQUIRED_FIELD_MISSING`: Mandatory canonical or custom attribute is null or blank.
- `INVALID_DECIMAL`: Unparseable numeric value in decimal/currency amount column.
- `INVALID_INTEGER`: Non-integer character in integer column.
- `INVALID_BOOLEAN`: Value outside deterministic boolean set (`true/false`, `1/0`, `yes/no`).
- `INVALID_ENUM`: Value does not match category `allowed_values`.
- `INVALID_EMAIL`: Email does not conform to RFC-5322 syntax.
- `INVALID_DATE` / `INVALID_DATETIME`: Date does not match standard ISO-8601 formatting.
- `INVALID_CURRENCY`: Currency does not match 3-letter ISO-4217 code.
- `OUT_OF_BOUNDS`: Value violates `min_value` or `max_value` numeric bounds.
- `REGEX_MISMATCH`: String fails field `validation_regex`.
- `DUPLICATE_RECORD`: Compatible duplicate of an earlier row in the same dataset.
- `CONFLICTING_DUPLICATE`: Conflicting duplicate with conflicting attribute values.
- `CUSTOM_ATTRIBUTE_INVALID`: Custom attribute fails tenant-scoped validation rules.

---

## 4. Null vs. Empty Semantics

The engine strictly preserves semantic distinctions between data absence states:
- `missing`: Column not mapped or cell omitted $\rightarrow$ Preserved as `None` or omitted from `canonical_data`.
- `empty string`: Cell present but empty (`""`) $\rightarrow$ Preserved as `None`.
- `zero`: Explicit numeric `0` or `0.0` $\rightarrow$ Preserved as numeric zero.
- `false`: Explicit boolean False $\rightarrow$ Preserved as boolean `False`.

> [!CAUTION]
> The engine **never** silently coerces empty prices to `0.0` or empty availability to `False`. Doing so would invent false business realities (e.g. free services or nonexistent stock).

---

## 5. Category-Aware Constraint Validation

Validation rules are loaded dynamically from the Phase 7.1 `category_registry`:
- **`products_services`**: Validates commercial `price` ($\ge 0.0$), ISO `currency`, and `availability` enum.
- **`contacts`**: Validates RFC `email`, E.164-compatible `phone`, and functional `contact_type`.
- **`policies`**: Validates mandatory `details` narrative text and ISO-8601 `effective_from` / `effective_until`.
- **`support_faqs`**: Validates non-empty `question` and authoritative `answer`.

---

## 6. Multi-Tenant Isolation

Custom attribute validation rules are strictly organization-scoped:
- Tenant A's definitions cannot validate or influence Tenant B's data.
- If Tenant A defines `grade` as an integer (`1-5`) and Tenant B defines `grade` as an enum (`gold, silver`), both validate independently without cross-tenant collision.
