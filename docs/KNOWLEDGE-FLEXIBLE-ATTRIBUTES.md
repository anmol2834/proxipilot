# ProxiPilot — Flexible & Custom Attribute Architecture (Phase 7.1)
============================================================
Status: FROZEN & AUTHORITATIVE  
Phase: 7.1 (Knowledge Taxonomy + Category Schemas)  
Last Updated: 2026-09-17  

This document formalizes the flexible schema foundation and typed custom attribute architecture for ProxiPilot. It explains how diverse customer datasets (e.g. CSV/Excel sheets with varying column names) are mapped into canonical fields and strongly typed custom attributes without altering the underlying PostgreSQL database schema.

---

## 1. The Flexible Schema Philosophy

Different businesses maintain heterogeneous data models:
* **Tenant A (Commercial HVAC)** provides columns: `name`, `price`, `region`, `availability`.
* **Tenant B (IT Hardware Distro)** provides columns: `product_title`, `cost`, `service_area`, `status`, `warranty_period`, `rack_units`.

In a poorly designed system, this leads to two failure modes:
1. **Uncontrolled Giant JSON Blob**: Storing the raw dictionary inside a single `data JSONB` column. This destroys SQL range querying, eliminates indexability, allows silent data type corruption, and complicates versioning and RAG grounding.
2. **Schema Churn**: Running database DDL migrations (`ALTER TABLE ADD COLUMN`) for every customer's bespoke fields, creating hundreds of sparse columns.

### ProxiPilot's Solution: Canonical Core + Typed Relational Attributes
ProxiPilot combines a **Canonical Category Registry** with a **Tenant-Scoped Custom Attribute Engine**:
1. Common core business facts map to fixed canonical fields (`name`, `price`, `currency`, `availability`).
2. Genuinely custom domain fields map to typed rows in `knowledge_attributes` validated against tenant-defined rules in `knowledge_attribute_definitions`.

```
                    EXTERNAL CUSTOMER DATASET (CSV / UI)
                                     │
                    ┌────────────────┴────────────────┐
                    ▼                                 ▼
             Canonical Fields                  Custom Attributes
      (e.g. name, price, sku)         (e.g. warranty_period, rack_units)
                    │                                 │
                    ▼                                 ▼
             KnowledgeVersion                KnowledgeAttribute
         (content_text & core)           (Concrete Typed Value Columns)
                                                      │
                                                      ▼
                                       KnowledgeAttributeDefinition
                                       (Tenant-scoped schema rules)
```

---

## 2. Organization-Scoped Custom Attribute Definitions

Custom fields are strictly partitioned by tenant in the `knowledge_attribute_definitions` table:

```sql
CREATE TABLE knowledge_attribute_definitions (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    category VARCHAR(64) NOT NULL,
    key VARCHAR(128) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    value_type VARCHAR(32) NOT NULL DEFAULT 'string',
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    allowed_values_json TEXT NULL,
    validation_regex VARCHAR(512) NULL,
    description VARCHAR(512) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_knowledge_attr_def_tenant_cat_key UNIQUE (tenant_id, category, key)
);
```

### 2.1 Supported Attribute Value Types (`AttributeValueType`)

| Type Key | Storage Column in `knowledge_attributes` | Validation Rule | Example |
| :--- | :--- | :--- | :--- |
| `string` | `string_value VARCHAR(1024)` | Max 1024 chars; optional regex pattern | `"SR-PRO-42U"` |
| `text` | `text_value TEXT` | Multi-line text string | Extended engineering notes |
| `integer` | `number_value FLOAT` | Whole numeric value | `42` (rack units) |
| `decimal` | `number_value FLOAT` | Floating point or exact precision | `18.5` (percentage) |
| `currency` | `number_value FLOAT` | Decimal amount paired with currency code | `4999.00` |
| `boolean` | `boolean_value BOOLEAN` | Boolean (`true`, `false`) | `true` (installation required) |
| `date` | `date_value TIMESTAMPTZ` | Valid calendar date or ISO string | `2026-06-01` |
| `datetime` | `date_value TIMESTAMPTZ` | Timezone-aware ISO-8601 timestamp | `2026-06-01T09:00:00Z` |
| `enum` | `string_value VARCHAR(1024)` | Must match an item in `allowed_values` | `"platinum"` in `["gold", "platinum"]` |
| `array` | `json_value TEXT` | JSON-serialized array of strings | `["US-EAST", "AP-SOUTH"]` |

---

## 3. Storage Model in `knowledge_attributes`

Custom attribute values are attached to a specific `KnowledgeVersion`. Each attribute is stored in its concrete typed column:

```python
# Example: Custom attribute 'warranty_period' (integer = 36 months)
attr = KnowledgeAttribute(
    tenant_id=current_tenant_id,
    knowledge_version_id=version.id,
    key="warranty_period",
    value_type=AttributeValueType.INTEGER.value,
    number_value=36.0,
)
```

**Benefits**:
- Range queries like `WHERE key = 'warranty_period' AND number_value >= 24` use the standard PostgreSQL B-Tree index `ix_knowledge_attributes_numeric_range` instead of slow JSON path evaluations.
- String lookups use `ix_knowledge_attributes_tenant_key`.

---

## 4. Phase 8 Ingestion Pipeline Compatibility (Dataset Simulation)

When Phase 8 introduces CSV/Excel tabular file ingestion, the column mapping engine will execute the following two-tier resolution:

### Scenario: Mapping Dataset A vs Dataset B

#### Dataset A Input:
* `name` $\rightarrow$ Maps to Canonical Field `name`
* `price` $\rightarrow$ Maps to Canonical Field `price`
* `region` $\rightarrow$ Maps to Canonical Field `region`
* `availability` $\rightarrow$ Maps to Canonical Field `availability`

#### Dataset B Input:
* `product_title` $\rightarrow$ Column alias maps to Canonical Field `name`
* `cost` $\rightarrow$ Column alias maps to Canonical Field `price`
* `service_area` $\rightarrow$ Column alias maps to Canonical Field `service_area`
* `status` $\rightarrow$ Column alias maps to Canonical Field `availability`
* `warranty_period` $\rightarrow$ Maps to Custom Attribute `warranty_period` (stored in `knowledge_attributes` after validation against tenant definition)

### Validation Pre-Flight Endpoint
Before persisting imported rows or UI drafts, clients call:
`POST /api/v1/knowledge/validate`
```json
{
  "category": "products_services",
  "data": {
    "name": "Server Rack 42U",
    "entity_type": "PRODUCT",
    "price": 1299.50,
    "currency": "USD",
    "warranty_period": 36
  },
  "strict_custom": false
}
```
**Response**:
```json
{
  "is_valid": true,
  "category": "products_services",
  "errors": [],
  "cleaned_canonical_data": {
    "name": "Server Rack 42U",
    "entity_type": "PRODUCT",
    "price": 1299.5,
    "currency": "USD"
  },
  "cleaned_custom_attributes": {
    "warranty_period": 36
  }
}
```
If an error occurs (e.g. invalid currency code `"US Dollars"` instead of `"USD"`, or negative price), `is_valid` is `false` with a descriptive message in `errors`.
