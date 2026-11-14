# Canonical Temporal Read Contract & Knowledge Lifecycle Retention (Phases 9.4 – 9.5)

## 1. Phase 9.4 — Canonical Active-Version Read Contract

### The Canonical Filter Rule
All business consumers, retrieval systems, API queries, and future Phase 10 RAG vector ingest pipelines must resolve current authoritative knowledge using this frozen rule:

```sql
WHERE status = 'active'
  AND (effective_from IS NULL OR effective_from <= :as_of)
  AND (effective_until IS NULL OR effective_until > :as_of)
```

In Python / SQLAlchemy:
```python
build_current_version_filter(as_of: Optional[datetime] = None)
```

### Invariants & Guarantees
1. **Single Source of Truth**: All modules must use `CanonicalKnowledgeReader` or `build_current_version_filter` rather than implementing ad-hoc temporal SQL filters.
2. **Tenant Scoped**: All queries enforce strict multi-tenant boundaries (`tenant_id == :tenant_id`).
3. **No Full-History Scans**: Utilizes the composite index `ix_knowledge_versions_temporal` (`tenant_id, knowledge_item_id, status, effective_from, effective_until`).
4. **Deterministic Tie-Breaking**: If an overlapping active period ever occurs due to external import anomalies, the engine deterministically resolves to the highest `version_number`.
5. **Timezone Standardization**: All incoming timestamps are normalized to timezone-aware UTC via `normalize_utc_timestamp()`.

### Temporal Status Classification
Each version is temporally classified as:
- `current`: `status == ACTIVE` and currently effective.
- `future`: `effective_from > now`.
- `expired`: `effective_until <= now`.

---

## 2. Phase 9.5 — Audit & Lifecycle Event Tracking

### Audit Taxonomy
The audit subsystem records all lifecycle state changes with strict metadata hygiene:

| Audit Action | Trigger | Metadata Captured |
|---|---|---|
| `KNOWLEDGE_CREATED` | Creation of KnowledgeItem & v1 | `category, title, version, source, actor, ip_address` |
| `KNOWLEDGE_UPDATED` | Creation of subsequent version snapshot | `previous_version, new_version, changed_fields, change_summary, source, actor` |
| `KNOWLEDGE_VERSION_CREATED` | New version persisted | `item_id, version_number, status, actor` |
| `KNOWLEDGE_VERSION_PUBLISHED` | Draft published to active | `item_id, version_number, source, actor, ip_address` |
| `KNOWLEDGE_VERSION_ARCHIVED` | Soft-archiving of item or version | `title, ip_address` |
| `KNOWLEDGE_ROLLED_BACK` | Reversion to historical state (Approach B) | `previous_version, target_version, new_version, reason, source, actor` |
| `KNOWLEDGE_IMPORTED` | Bulk import job commit | `job_id, items_created, items_updated` |
| `KNOWLEDGE_REPLACED` | Authority arbitration overwrite | `source_id, old_authority, new_authority` |

### Security & Sanitization
Audit records never contain:
- Passwords, tokens, OTPs, or API secrets.
- Full un-truncated raw external file dumps.

---

## 3. Phase 9.5 — Retention & Safe Cleanup

### Separation of Concerns
Active knowledge state is decoupled from retention policy:
- **Active versions** and records referenced by `KnowledgeItem.current_version_id` are **never** eligible for retention deletion, regardless of age.
- **Historical versions** are retained indefinitely by default.
- Soft-archived versions remain queryable for audits and historical diffs unless an explicit organization retention policy purges them.

### `KnowledgeRetentionService` Safety Invariants
1. **Tenant Isolation**: Every retention query and purge is strictly constrained by `tenant_id`.
2. **Dry-Run Capability**: Administrators can inspect `RetentionEligibilityReport` before committing purges.
3. **Idempotent Batch Processing**: Purges occur in batches (default: 100) and can be re-run safely.
4. **Audit Logging**: Every executed purge generates an audit record documenting `purged_count` and purged version identifiers.
