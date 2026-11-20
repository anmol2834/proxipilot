# ProxiPilot — Knowledge Data Contracts (Phase 7.0)
============================================================
Status: FROZEN  
Phase: 7.0 (Knowledge Architecture Freeze)  
Last Updated: 2026-09-17  

This document formalizes the canonical data contracts for ProxiPilot's Knowledge Architecture. All schemas, field types, ownership constraints, temporal behaviors, and validation rules are frozen as the foundation for future ingestion (Phase 8), versioning (Phase 9), and semantic projection (Phase 10).

---

## 1. Core Domain Taxonomy & Enums

### 1.1 KnowledgeCategory (Taxonomy)
Categorical classification defining the business context and organizational role of each knowledge item.

| Value | UI Label | Purpose & Semantic Scope |
| :--- | :--- | :--- |
| `company_info` | Company Info | Identity, overview, founded year, registration facts, and contact details (email, phone, address, business hours). |
| `products_services` | Products & Services | Products, services, SKUs, specifications, availability, and **all pricing**. |
| `policies` | Policies | Terms of service, refund rules, SLA commitments, compliance standards. |
| `support_faqs` | Support & FAQs | Frequently asked questions, customer problem resolution guides. |
| `offers_promotions` | Offers & Promotions | Active discounts, promotional campaigns, seasonal sales, promo codes. |
| `processes_timelines` | Processes & Timelines | How things work and how long they take: order/PO confirmation, dispatch and delivery lead times, processing and refund times, onboarding steps. |

> [!IMPORTANT]  
> **No Standalone Pricing Category:** There is NO `pricing` category. All pricing facts (rates, tiers, hourly fees, currency) belong strictly inside `products_services`.

---

### 1.2 KnowledgeSourceType (Lineage Medium)
Defines how a knowledge item or version was introduced into ProxiPilot.

| Value | Description |
| :--- | :--- |
| `manual` | Hand-authored directly through the dashboard UI. |
| `csv` | Ingested via structured tabular CSV upload. |
| `xlsx` | Ingested via Microsoft Excel workbook sheet. |
| `api` | Programmatically pushed via API integration. |
| `system` | Seeded automatically by the platform during tenant onboarding. |
| `connector` | Synced continuously from external 3rd-party SaaS integrations. |

---

### 1.3 SourceAuthorityLevel (Truth Hierarchy)
Determines precedence when resolving conflicting knowledge statements across sources during retrieval grounding.

| Authority Level | Hierarchy Rank | Intended Use Case |
| :--- | :--- | :--- |
| `system` | 1 (Highest) | Platform-enforced immutable guardrails and system seeds. |
| `owner` | 2 | Business owner explicit overrides. |
| `admin` | 3 | Organization workspace admin inputs. |
| `business_profile` | 4 | Canonical company profile facts established at onboarding. |
| `imported_data` | 5 | Bulk-uploaded operational datasets (CSV, Excel). |
| `manual` | 6 | Regular team member notes or draft knowledge entries. |
| `external_source` | 7 (Lowest) | Unverified web crawlers or external scraping. |

---

### 1.4 KnowledgeLifecycleStatus (State Machine)
Represents the publication state of a KnowledgeVersion.

| State | Retrievable by AI / Chat | Editable | Description |
| :--- | :--- | :--- | :--- |
| `draft` | No | Yes | Initial authoring / parsing state; unreviewed. |
| `validated` | No | Yes | Passed structural and domain schema validation. |
| `active` | **Yes** | No (append new ver) | Published as authoritative source of truth. |
| `archived` | No | No | Deprecated / superseded by newer version. |
| `revoked` | No | No | Invalidated due to inaccuracy or legal retraction. |

---

### 1.5 AttributeValueType (Typed Value Schema)
Defines the concrete column representation used to store machine-readable structured facts in `knowledge_attributes`.

| Value Type | Storage Column | Description / Example |
| :--- | :--- | :--- |
| `string` | `string_value VARCHAR(512)` | Short identifiers, SKUs, names (`"ProxiPilot Enterprise"`). |
| `text` | `text_value TEXT` | Multi-line specifications, extended notes. |
| `integer` | `number_value NUMERIC(14,4)` | Whole counts, stock units, duration in days (`30`). |
| `decimal` | `number_value NUMERIC(14,4)` | Exact precision numbers, percentages (`18.50`). |
| `currency` | `number_value NUMERIC(14,4)` | Money amounts (`4999.00`). Accompanied by currency code key. |
| `boolean` | `boolean_value BOOLEAN` | Flags (`true`, `false`). |
| `date` | `date_value DATE` | Calendar dates (`2026-01-01`). |
| `datetime` | `date_value DATE` / ISO string | Timestamps with timezone. |
| `enum` | `string_value VARCHAR(512)` | Closed option sets (`"monthly"`, `"annual"`). |
| `array` | `json_value JSONB` | List of items (`["Ahmedabad", "Mumbai"]`). |

---

## 2. Relational Entity Specifications

### 2.1 `KnowledgeSource` (`knowledge_sources`)
Tracks the origin, provenance, authority, and temporal validity of knowledge ingests.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(64)` | Primary Key, Default `ks_<hex>` | Unique source identifier. |
| `tenant_id` | `VARCHAR(64)` | Foreign Key `organizations.id` (CASCADE), NOT NULL | Owning organization boundary. |
| `name` | `VARCHAR(255)` | NOT NULL | Human-readable label (e.g. `"Catalog_Q3.csv"`). |
| `source_type` | `VARCHAR(32)` | Enum `KnowledgeSourceType`, NOT NULL | `manual`, `csv`, `xlsx`, `api`, `import`, `system`, `connector`. |
| `authority_level` | `VARCHAR(32)` | Enum `SourceAuthorityLevel`, NOT NULL, Default `'manual'` | Relative truth arbitration ranking (`system` down to `external_source`). |
| `status` | `VARCHAR(32)` | Enum `KnowledgeSourceStatus`, NOT NULL, Default `'active'` | `active`, `inactive`, `archived`, `revoked`. |
| `source_reference` | `VARCHAR(255)` | Nullable | External reference, batch identifier, or connector stream ID. |
| `dataset_name` | `VARCHAR(255)` | Nullable | Logical dataset name (e.g. `"Q3 Master Catalog"`). |
| `file_name` | `VARCHAR(255)` | Nullable | Original uploaded filename (e.g. `"inventory_2026.csv"`). |
| `checksum` | `VARCHAR(128)` | Nullable | Cryptographic hash (SHA-256) for deterministic deduplication. |
| `schema_fingerprint`| `VARCHAR(64)` | Nullable | Deterministic schema fingerprint from flexible schema engine. |
| `effective_from` | `TIMESTAMPTZ` | Nullable | Timestamp when source becomes active/valid. |
| `effective_until` | `TIMESTAMPTZ` | Nullable | Timestamp when source expires (NULL = indefinite). |
| `origin_uri` | `VARCHAR(2048)` | Nullable | Storage reference key, API endpoint, or external doc URI (never secrets). |
| `metadata_json` | `TEXT` | Nullable | Technical metadata (row count, encoding, delimiter, etc.). |
| `created_by_user_id`| `VARCHAR(64)` | Foreign Key `users.id` (SET NULL), Nullable | User who uploaded or created the source. |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, Default `NOW()` | Creation timestamp in UTC. |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, Default `NOW()` | Last modification timestamp in UTC. |

**Indexes & Deduplication Constraints:**
- `ix_knowledge_sources_tenant_id` on `(tenant_id)`
- `ix_knowledge_sources_tenant_type` on `(tenant_id, source_type)`
- `ix_knowledge_sources_tenant_authority` on `(tenant_id, authority_level)`
- `ix_knowledge_sources_tenant_created` on `(tenant_id, created_at)`
- `ix_knowledge_sources_tenant_status` on `(tenant_id, status)`
- `ix_knowledge_sources_tenant_checksum` on `(tenant_id, checksum)`
- `ix_knowledge_sources_tenant_type_ref` on `(tenant_id, source_type, source_reference)`

---

### 2.2 `KnowledgeItem` (`knowledge_items`)
Represents the persistent logical identity of a business fact, product, FAQ, or policy. Identity persists indefinitely across content updates.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(64)` | Primary Key, Default `ki_<hex>` | Unique item identifier. |
| `tenant_id` | `VARCHAR(64)` | Foreign Key `organizations.id` (CASCADE), NOT NULL | Owning organization boundary. |
| `title` | `VARCHAR(255)` | NOT NULL | Canonical name / title (e.g. `"Enterprise Plan"`). |
| `category` | `VARCHAR(64)` | Enum `KnowledgeCategory`, NOT NULL | One of the 6 frozen domain categories. |
| `tags` | `ARRAY(VARCHAR(50))` | NOT NULL, Default `'{}'` | Fast filtering tags (`["pricing", "sla"]`). |
| `business_entity_id` | `VARCHAR(64)` | Foreign Key `business_entities.id` (SET NULL), Nullable | Optional link to physical product/service entity. |
| `source_id` | `VARCHAR(64)` | Foreign Key `knowledge_sources.id` (SET NULL), Nullable | Originating source descriptor. |
| `current_version_id`| `VARCHAR(64)` | Nullable | Pointer to currently published active version. |
| `is_active` | `BOOLEAN` | NOT NULL, Default `TRUE` | Soft-state toggle for the entire item. |
| `created_by` | `VARCHAR(64)` | Foreign Key `users.id` (SET NULL), Nullable | Original author user ID. |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, Default `NOW()` | Creation timestamp in UTC. |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, Default `NOW()` | Last modification timestamp in UTC. |

**Indexes:**
- `ix_knowledge_items_tenant_id` on `(tenant_id)`
- `ix_knowledge_items_category` on `(category)`
- `ix_knowledge_items_tenant_category` on `(tenant_id, category)`
- `ix_knowledge_items_tenant_active` on `(tenant_id, is_active)`
- `ix_knowledge_items_source_id` on `(source_id)`

---

### 2.3 `KnowledgeVersion` (`knowledge_versions`)
Represents an immutable snapshot of content, temporal boundaries, and state for a KnowledgeItem.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(64)` | Primary Key, Default `kv_<hex>` | Unique version identifier. |
| `tenant_id` | `VARCHAR(64)` | Foreign Key `organizations.id` (CASCADE), NOT NULL | Owning organization boundary. |
| `knowledge_item_id` | `VARCHAR(64)` | Foreign Key `knowledge_items.id` (CASCADE), NOT NULL | Parent item reference. |
| `version_number` | `INTEGER` | NOT NULL, Default `1` | Sequential integer version (1, 2, 3...). |
| `status` | `VARCHAR(32)` | Enum `KnowledgeLifecycleStatus`, NOT NULL, Default `'draft'` | Lifecycle state (`draft`, `validated`, `active`, etc.). |
| `source_id` | `VARCHAR(64)` | Foreign Key `knowledge_sources.id` (SET NULL), Nullable | Specific source that introduced this version. |
| `authority_level` | `VARCHAR(32)` | Enum `SourceAuthorityLevel`, NOT NULL, Default `'imported_data'` | Authority level of this version's content. |
| `content_text` | `TEXT` | NOT NULL, Default `''` | Semantic, human-readable narrative text. |
| `change_summary` | `VARCHAR(512)`| Nullable | Change log note (e.g. `"Updated Q3 refund window"`). |
| `effective_from` | `TIMESTAMPTZ` | Nullable | Start timestamp when this version becomes valid. |
| `effective_until`| `TIMESTAMPTZ` | Nullable | Expiry timestamp when this version ceases validity. |
| `published_at` | `TIMESTAMPTZ` | Nullable | When status transitioned to `active`. |
| `archived_at` | `TIMESTAMPTZ` | Nullable | When status transitioned to `archived` or `revoked`. |
| `vector_ids` | `ARRAY(VARCHAR(64))` | NOT NULL, Default `'{}'` | Projected Qdrant point IDs (Phase 10 placeholder). |
| `chunk_count` | `INTEGER` | NOT NULL, Default `0` | Count of semantic chunks projected (Phase 10). |
| `created_by` | `VARCHAR(64)` | Foreign Key `users.id` (SET NULL), Nullable | Version author user ID. |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, Default `NOW()` | Version creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, Default `NOW()` | Version update timestamp. |

**Constraints & Indexes:**
- Unique Constraint: `uq_knowledge_version_number` on `(knowledge_item_id, version_number)`
- Index: `ix_knowledge_versions_tenant_id` on `(tenant_id)`
- Index: `ix_knowledge_versions_item_id` on `(knowledge_item_id)`
- Index: `ix_knowledge_versions_tenant_item` on `(tenant_id, knowledge_item_id)`
- Index: `ix_knowledge_versions_item_status` on `(knowledge_item_id, status)`
- Index: `ix_knowledge_versions_temporal` on `(tenant_id, effective_from, effective_until)`

---

### 2.4 `KnowledgeAttribute` (`knowledge_attributes`)
Stores machine-readable, typed, queryable structured business facts tied to a specific `KnowledgeVersion`.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(64)` | Primary Key, Default `ka_<hex>` | Unique attribute identifier. |
| `tenant_id` | `VARCHAR(64)` | Foreign Key `organizations.id` (CASCADE), NOT NULL | Owning organization boundary. |
| `knowledge_version_id`| `VARCHAR(64)` | Foreign Key `knowledge_versions.id` (CASCADE), NOT NULL | Parent version reference. |
| `key` | `VARCHAR(128)` | NOT NULL | Normalized canonical attribute name (`"price"`, `"currency"`). |
| `value_type` | `VARCHAR(32)` | Enum `AttributeValueType`, NOT NULL | Typed discriminator (`string`, `decimal`, etc.). |
| `string_value` | `VARCHAR(512)` | Nullable | Indexed short text, SKU, enum code. |
| `text_value` | `TEXT` | Nullable | Long text or unindexed notes. |
| `number_value` | `NUMERIC(14,4)`| Nullable | Indexed high-precision numbers, prices, integers. |
| `boolean_value` | `BOOLEAN` | Nullable | Indexed boolean flags. |
| `date_value` | `DATE` | Nullable | Indexed calendar dates. |
| `json_value` | `JSONB` | Nullable | Extensible complex arrays / structures. |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, Default `NOW()` | Attribute record creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, Default `NOW()` | Attribute record update timestamp. |

**Constraints & Indexes:**
- Unique Constraint: `uq_knowledge_version_attr_key` on `(knowledge_version_id, key)`
- Index: `ix_knowledge_attributes_tenant_id` on `(tenant_id)`
- Index: `ix_knowledge_attributes_version_id` on `(knowledge_version_id)`
- Index: `ix_knowledge_attributes_tenant_key` on `(tenant_id, key)`
- Index: `ix_knowledge_attributes_key_num` on `(key, number_value)` (enables fast numeric range filtering like `price BETWEEN 1000 AND 5000`)
- Index: `ix_knowledge_attributes_key_str` on `(key, string_value)` (enables exact match lookups like `currency = 'INR'`)

---

## 3. Data Integrity & Validation Rules

1. **Tenant Isolation Invariance**: Every query across `knowledge_items`, `knowledge_versions`, `knowledge_sources`, and `knowledge_attributes` MUST include `tenant_id = :current_tenant_id`. Cross-tenant foreign keys are physically rejected by organizational ownership.
2. **One Key Per Version**: A single `KnowledgeVersion` cannot have duplicate attribute keys. Uniqueness is enforced at the database level by `uq_knowledge_version_attr_key`.
3. **Structured vs Semantic Segregation**:
   - Machine-readable attributes (e.g., `price = 2999.00`, `currency = "INR"`, `billing_cycle = "annual"`) are stored in `knowledge_attributes`.
   - Explanatory, narrative text (e.g., `"Annual billing offers a 20% discount compared to monthly terms."`) is stored in `KnowledgeVersion.content_text`.
4. **Temporal Consistency**: If both `effective_from` and `effective_until` are present, application validation ensures `effective_from <= effective_until`.
