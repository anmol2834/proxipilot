# ProxiPilot — Knowledge Persistence Architecture (Phase 8.5)
============================================================
Status: IMPLEMENTED & FROZEN  
Phase: 8.5 (Canonical Persistence + Transactional Import)  
Last Updated: 2026-09-17  

---

## 1. Executive Summary

Phase 8.5 is the **bulk canonical write layer** for ProxiPilot's Knowledge Import pipeline.

It takes the output of Phase 8.4 (validated, normalized, deduplicated records) and
persists them durably to PostgreSQL as `KnowledgeItem`, `KnowledgeVersion`, and
`KnowledgeAttribute` records — using controlled batched transactions with zero per-row
round trips.

**Invariants that can never be violated:**
1. **No per-row INSERTs or COMMITs.** Every batch is a single atomic transaction.
2. **No N+1 lookups.** One bulk `SELECT` per batch; O(1) in-memory matching thereafter.
3. **Bounded memory.** Batches are processed and released; no full-dataset accumulation.
4. **Idempotent.** The DB-level unique constraint on `external_identity_key` makes
   import restarts and worker crash+retry safe.
5. **Tenant security.** `tenant_id`, `source_id`, and `job_id` are derived from
   the authoritative `ImportJob` DB record — never from `NormalizedRecordDTO`.
6. **Source lineage.** Every `KnowledgeVersion` links to the `KnowledgeSource`
   backing the import job.

---

## 2. Input → Output Flow

```
Phase 8.4 Output
BatchQualityResultDTO (NormalizedRecordDTO[])
    ↓
KnowledgePersistenceService.persist_batch()
    ↓
  [1] Filter: INVALID / DUPLICATE / CONFLICT → skip or record outcome
  [2] Extract external_identity_keys for batch
  [3] Bulk SELECT existing KnowledgeItems (1 query per batch)
  [4] In-memory partition: new_records | update_records
  [5] Bulk INSERT new KnowledgeItems
  [6] flush → assign IDs
  [7] Bulk INSERT KnowledgeVersions (v1 for new, vN for updates)
  [8] flush → assign version IDs
  [9] Bulk INSERT KnowledgeAttributes (all canonical + custom fields)
  [10] Bulk UPDATE KnowledgeItem.current_version_id
  [11] COMMIT (atomic for this batch)
    ↓
BatchPersistenceResultDTO (inserted / versioned / duplicate / conflict / invalid / failed)
    ↓
ImportPersistenceSummaryDTO (aggregate across all batches)
    ↓
PostgreSQL — durable canonical knowledge data
```

---

## 3. Database Schema Changes (Phase 8.5)

### 3.1 New Column: `knowledge_items.external_identity_key`

| Property | Value |
| :--- | :--- |
| Type | `VARCHAR(512)` |
| Nullable | `TRUE` (NULL for manually authored items) |
| Purpose | Deterministic key derived from category-specific business fields |
| Constraint | `UNIQUE(tenant_id, category, external_identity_key) WHERE external_identity_key IS NOT NULL` |

**Design rationale:** The partial unique constraint (WHERE NOT NULL) means:
- Manual knowledge items authored via the UI (NULL identity key) are **completely unaffected**.
- Bulk-imported items get DB-enforced idempotency at the unique key level.
- Import restart or worker crash → retry → no duplicate `KnowledgeItem` created.

### 3.2 Migration

File: `migrations/versions/a7b8c9d0e1f2_phase85_canonical_persistence.py`

```sql
ALTER TABLE knowledge_items ADD COLUMN external_identity_key VARCHAR(512);

CREATE INDEX ix_knowledge_items_external_identity
    ON knowledge_items(external_identity_key);

CREATE UNIQUE INDEX uq_knowledge_items_tenant_cat_identity
    ON knowledge_items(tenant_id, category, external_identity_key)
    WHERE external_identity_key IS NOT NULL;
```

---

## 4. Identity Key Design

### 4.1 Full Key (Phase 8.4 Output)

Phase 8.4 produces a full scoped key:
```
org:{tenant_id}:cat:{category}:sku:{sku}:name:{name_normalized}
```

### 4.2 Stored Key (Phase 8.5 DB Storage)

The `org:{tenant_id}:` prefix is stripped before storing in `external_identity_key`:
```
cat:{category}:sku:{sku}:name:{name_normalized}
```

This is correct because `tenant_id` is already the database column providing
per-tenant scoping in the unique index. Storing the prefix would waste VARCHAR
space and add redundancy.

### 4.3 Lookup

The in-batch identity lookup is:
```sql
SELECT * FROM knowledge_items
WHERE tenant_id = :tenant_id
  AND category = :category
  AND external_identity_key IN (:key_1, :key_2, ..., :key_N)
```

One query per batch. O(batch_count), not O(row_count).

---

## 5. Batch Transaction Boundaries

```
Batch K (rows 1–500)
  ┌─ begin_nested (savepoint)
  │   bulk SELECT existing identities      → 1 query
  │   bulk INSERT KnowledgeItems           → 1 query (new records only)
  │   flush
  │   bulk SELECT active versions          → 1 query (update records only)
  │   bulk INSERT KnowledgeVersions        → 1 query
  │   flush
  │   bulk INSERT KnowledgeAttributes      → many rows, 1 executemany
  │   flush
  │   bulk UPDATE current_version_id       → in-memory assignments
  └─ savepoint commits
  COMMIT → durable PostgreSQL write

Batch K+1 (rows 501–1000)
  ... independent transaction
  COMMIT → durable
```

**DB round trips per batch:** ~6–8 regardless of batch size.  
**Batch failure:** rolled back independently; committed batches are preserved.

---

## 6. Record Outcomes

| Outcome | Trigger | DB Write? |
| :--- | :--- | :--- |
| `INSERTED` | No existing item with this identity key | ✅ New `KnowledgeItem` + `KnowledgeVersion` |
| `VERSIONED` | Existing item found by identity key | ✅ New `KnowledgeVersion`, archives old |
| `DUPLICATE` | `is_duplicate=True`, `is_conflict=False` (Phase 8.4) | ❌ Skipped |
| `CONFLICT` | `is_conflict=True` (Phase 8.4) | ❌ Logged, skipped |
| `INVALID` | `status=INVALID` (Phase 8.4) | ❌ Never persisted |
| `FAILED` | Tenant mismatch or DB error | ❌ Rolled back |

---

## 7. Idempotency & Restart Safety

| Scenario | Behaviour |
| :--- | :--- |
| Worker crashes mid-batch | Uncommitted batch is rolled back by Postgres automatically |
| Worker restarts, replays batches 1–K | Already-committed batches: `external_identity_key` conflict → `VERSIONED` (new version with same data, idempotent content) |
| Same file re-imported | Each record resolves as `VERSIONED` against the existing item; no duplicate `KnowledgeItem` |
| Two workers race on same job | Phase 8.0 distributed lock + atomic DB claim prevents concurrent execution |

---

## 8. Progress Tracking

To avoid per-row write amplification, progress is checkpointed to `import_jobs` every
`KNOWLEDGE_IMPORT_PROGRESS_INTERVAL` rows (default: 5,000).

This is **decoupled from batch size** — you can have a 500-row batch with a 5,000-row
progress interval, meaning progress is updated every 10 batches.

```python
# import_jobs table updated:
UPDATE import_jobs
SET processed_rows = :total_inserted + :total_versioned,
    failed_rows    = :total_failed,
    progress_percent = round(...),
    updated_at     = now()
WHERE id = :job_id;
```

---

## 9. Configuration

| Environment Variable | Default | Description |
| :--- | :--- | :--- |
| `KNOWLEDGE_IMPORT_BATCH_SIZE` | `500` | Records per DB transaction batch (50–5,000) |
| `KNOWLEDGE_IMPORT_PROGRESS_INTERVAL` | `5000` | Write progress every N rows |

---

## 10. Performance Characteristics

Benchmarked on synthetic datasets (mock DB session, no network):

| Dataset | Batch Size | Time | Rows/s | Peak RAM | DB Calls/batch |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1,000 | 500 | ~0.05s | ~20,000 | <5 MB | 2 |
| 10,000 | 500 | ~0.5s | ~20,000 | <12 MB | 2 |
| 100,000 | 500 | ~5s | ~20,000 | <60 MB | 2 |

**DB calls per batch are constant (2) regardless of batch size** — confirming N+1 safety.

Production throughput with a live PostgreSQL and network varies by:
- Attribute count per record (more attributes → slower `KnowledgeAttribute` inserts)
- Database connection pool saturation
- `batch_size` tuning (larger → higher throughput, larger peak memory per batch)

---

## 11. Security Model

```
HTTP Request
    → KnowledgeImportService.create_import_job()
        → ImportJob persisted with tenant_id = authenticated_org_id

Worker picks up job
    → reads ImportJob from DB → extracts tenant_id, source_id, job_id
    → NormalizedRecordDTO.organization_id is ASSERTED == job.tenant_id
    → All DB writes use job.tenant_id (not record-level org_id)
    → Mismatch → FAILED outcome, no write
```

A compromised or maliciously crafted `NormalizedRecordDTO` with a different
`organization_id` cannot write data under another tenant's namespace.

---

## 12. Files Added / Modified

| File | Change |
| :--- | :--- |
| `app/contracts/persistence.py` | [NEW] Typed persistence outcome DTOs |
| `app/services/knowledge_persistence.py` | [NEW] Bulk persistence engine |
| `app/models/knowledge.py` | [MODIFY] Added `external_identity_key` column + partial unique index |
| `migrations/versions/a7b8c9d0e1f2_phase85_canonical_persistence.py` | [NEW] Alembic migration |
| `app/core/config.py` | [MODIFY] Added `KnowledgeImportSettings` (batch_size, progress_interval) |
| `app/workers/import_worker.py` | [MODIFY] Filled in IMPORTING stage handler |
| `app/contracts/__init__.py` | [MODIFY] Exported persistence contracts |
| `tests/test_knowledge_persistence.py` | [NEW] 25-test unit suite |
| `tests/benchmark_knowledge_persistence.py` | [NEW] Throughput + N+1 benchmark |

---

## 13. Integration with Import Worker Pipeline

```
PARSING       → DatasetProfiler
SCHEMA_DETECTION → DatasetProfiler.compute_fingerprint()
MAPPING       → ColumnMappingService.detect_and_compile_mapping_plan()
VALIDATING    → DataQualityPipeline.process_file_batches() (dry-run)
IMPORTING     → DataQualityPipeline.process_file_batches() (re-stream)
                + KnowledgePersistenceService.persist_batch() per batch
PROJECTING    → [Phase 10 — Embeddings & Vector Projection]
COMPLETED / PARTIAL
```

The pipeline **re-streams** the file during IMPORTING rather than holding Phase 8.4
results in memory. This is intentional — bounded memory for arbitrarily large files.

---

## 14. What Phase 8.5 Does NOT Do

- ❌ Generate embeddings (Phase 10)
- ❌ Write to Qdrant (Phase 10)
- ❌ Perform semantic search or RAG retrieval (Phase 10+)
- ❌ Soft-delete existing knowledge not present in the import file
- ❌ Cross-tenant merge or federation
