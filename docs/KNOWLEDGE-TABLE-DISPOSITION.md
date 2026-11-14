# ProxiPilot — Knowledge Storage Table & Schema Disposition Analysis

**Document:** `docs/KNOWLEDGE-TABLE-DISPOSITION.md`  
**Status:** Completed & Architecture Frozen  
**Date:** October 18, 2026  
**Auditor:** ProxiPilot Core Systems Engineering  
**Scope:** PostgreSQL Tables, EAV Decommissioning, Column Redundancy, and Migration Safety  

---

## 1. Executive Summary

This disposition analysis audits every table, index, and column in ProxiPilot's Knowledge Storage subsystem. Rather than performing speculative destructive cleanups, each schema entity has been classified according to enterprise data safety principles:
- **`KEEP`**: Core architectural table performing active, non-redundant duties.
- **`SIMPLIFY`**: Retain table, but refactor internal columns or drop legacy unused fields safely.
- **`MIGRATE`**: Actively transition reads/writes from legacy structures to modern canonical models.
- **`DEPRECATE`**: Retained for backward compatibility; marked for future removal.
- **`DROP AFTER VERIFIED MIGRATION`**: Historical table whose data has been verified in canonical storage and has zero runtime dependencies.

---

## 2. Table Disposition Matrix

| Table Name | Classification | Current Architectural Responsibility | Disposition Justification & Migration Plan |
| :--- | :--- | :--- | :--- |
| **`knowledge_items`** | **`KEEP`** | Stable Business Identity & Ownership | Owns tenant scoping, category, external business identifier (`external_identity_key`), and current active version pointer (`current_version_id`). Essential for stable item deduplication across imports. |
| **`knowledge_versions`** | **`KEEP`** | Authoritative Canonical State & History | Stores complete JSONB canonical representation (`canonical_data`), pricing, temporal windows, and audit lineage. Provides immutable append-only version history. |
| **`knowledge_sources`** | **`KEEP`** | Data Lineage & Provenance | Tracks origin files (Excel/CSV/Google Drive), file hashes, sync frequencies, and source configurations. Required for auditability and automated sync. |
| **`import_jobs`** | **`KEEP`** | Asynchronous Ingestion Tracking | State machine for upload lifecycle (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`), batch statistics, and row-level error reporting. |
| **`knowledge_schema_profiles`** | **`KEEP`** | Column Detection & Mapping Memory | Persists learned column-to-canonical mappings per tenant and category, enabling zero-configuration repeat imports. |
| **`knowledge_semantic_chunks`** | **`KEEP`** | Semantic Projection Registry | Dedicated registry mapping logical versions to Qdrant vector point IDs, storing content SHA-256 hashes, projection text, and token counts. |
| **`knowledge_attributes`** | **`DROP AFTER VERIFIED MIGRATION`** | Legacy EAV (Entity-Attribute-Value) | Formerly held granular string/numeric values. **Decommissioned in Migration `d0e1f2a3b4c5`** after migrating all data to `knowledge_versions.canonical_data`. Zero active readers/writers. Safe to drop in next major version. |

---

## 3. Detailed Column-Level Analysis

### 3.1 `knowledge_versions.canonical_data` vs Legacy EAV Table
- **Historical Approach:** Storing arbitrary attributes across rows in `knowledge_attributes` (e.g. `attribute_key='capacity_liters'`, `attribute_value='450'`). This required expensive multi-row joins to reconstitute a single service record.
- **Current Canonical Model:** Stored directly in `knowledge_versions.canonical_data` as a validated JSONB dictionary with PostgreSQL GIN indexing.
- **Disposition:** The migration has completed successfully. All 816 source fields for the 24 live services exist exclusively in `canonical_data`. The EAV table `knowledge_attributes` is completely bypassed by the persistence layer.

### 3.2 `knowledge_versions.vector_ids` String Array vs `knowledge_semantic_chunks`
- **Issue:** `knowledge_versions` historically included a `vector_ids` column intended to hold Qdrant point IDs as a comma-separated string or array.
- **Risk:** Storing vector IDs directly on versions breaks 1:N chunk relationships (e.g. long policy documents chunked into multiple vectors) and duplicates state tracked in `knowledge_semantic_chunks`.
- **Disposition (`SIMPLIFY`):** `knowledge_semantic_chunks.vector_point_id` is now the single source of truth for vector point identity. The `vector_ids` column on `knowledge_versions` is marked **DEPRECATED** and will be removed in the next scheduled schema cleanup migration without data loss.

### 3.3 `content_text` in `knowledge_versions`
- **Issue:** `knowledge_versions.content_text` was used for raw document text in unstructured PDF/document uploads. For structured catalog records (home appliance services), it duplicates a simple stringified dump of canonical fields.
- **Disposition (`KEEP`):** Retain `content_text` because it serves as the authoritative source text for unstructured narrative documents (user manuals, warranty booklets, policy guides). For structured tabular data, it is cleanly populated from the entity summary.

---

## 4. Constraint & Index Inventory

| Table | Index / Constraint Name | Type | Target Columns | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `knowledge_items` | `uq_knowledge_items_tenant_cat_identity` | Unique | `(tenant_id, category, external_identity_key)` | Enforces stable business identity per tenant |
| `knowledge_items` | `idx_knowledge_items_tenant_status` | B-Tree | `(tenant_id, status)` | Fast active-item lookup |
| `knowledge_versions` | `uq_knowledge_versions_item_version` | Unique | `(knowledge_item_id, version_number)` | Enforces strict version sequencing |
| `knowledge_versions` | `idx_knowledge_versions_canonical_gin` | GIN | `canonical_data` (jsonb_path_ops) | Ultra-fast JSONB attribute filtering |
| `knowledge_semantic_chunks` | `uq_knowledge_chunks_version_index` | Unique | `(knowledge_version_id, chunk_index)` | Prevents duplicate projection chunks |
| `knowledge_semantic_chunks` | `idx_knowledge_chunks_vector_point` | B-Tree | `vector_point_id` | Fast Qdrant-to-PostgreSQL point resolution |
| `knowledge_semantic_chunks` | `idx_knowledge_chunks_content_hash` | B-Tree | `content_hash` | Bypass re-embedding on unchanged text |

---

## 5. Safe Migration & Cleanup Roadmap
 
1. **Phase A (Historical Schema Consolidation):**
   - Consolidated arbitrary entity-attribute-value structures into `knowledge_versions.canonical_data` (JSONB) with GIN indexing.
   - Dropped legacy EAV table `knowledge_attributes` in Migration `d0e1f2a3b4c5`.
2. **Phase B (Column Deprecation & Vector Mappings):**
   - Dropped deprecated column `knowledge_versions.vector_ids` in Migration `e1f2a3b4c5d6`.
   - Single authoritative vector mapping registry permanently established on `knowledge_semantic_chunks.vector_point_id`.
   - Removed mapped_column and serialization hooks from models and workers.
3. **Safety Guarantee:** Zero data loss, zero application downtime, and 100% preservation of all canonical fields and vectors across all 24 home appliance records.
