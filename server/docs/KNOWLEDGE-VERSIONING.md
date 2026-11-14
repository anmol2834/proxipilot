# Knowledge Versioning Architecture (Phases 9.0 – 9.3)

## 1. Executive Summary & Core Invariant

The ProxiPilot Knowledge Base enforces strict identity-snapshot separation:

```
KnowledgeItem (Stable Identity, e.g. "Enterprise Support Policy")
    │
    ├── Version 1 (Immutable Snapshot, v1)
    ├── Version 2 (Immutable Snapshot, v2)
    └── Version 3 (Immutable Snapshot, v3, Current Authoritative State)
```

- **Stable Identity (`KnowledgeItem`)**: Contains tenant ID, category, cross-cutting metadata, tags, and foreign key reference `current_version_id`. Updating a knowledge item **never** generates a new `KnowledgeItem` identity or changes its primary key ID.
- **Immutable State (`KnowledgeVersion`)**: Each update captures an authoritative snapshot of content, typed canonical attributes, tenant custom attributes, temporal validity bounds, and change narrative. Historical versions are never mutated in place.

---

## 2. Monotonic Version Sequencing & Pessimistic Concurrency

To ensure race-condition-free version incrementing in concurrent enterprise environments:

1. **Pessimistic Row Locking (`SELECT ... FOR UPDATE`)**:
   During `update_item`, `publish_version`, and `rollback_to_version`, the parent `KnowledgeItem` record is queried with `with_for_update()`.
2. **Deterministic Sequence Computation**:
   ```python
   next_version_num = max((v.version_number for v in item.versions), default=0) + 1
   ```
3. **Serial Execution**: Concurrent transactions targeting the same knowledge item queue cleanly on the row lock, preventing duplicate version numbers or split-brain states.

---

## 3. Deterministic Field-Level Diff Engine (`VersionDiffEngine`)

Before generating a new version snapshot, the incoming payload is compared against the current version using the deterministic zero-I/O diff engine:

- **Semantic Value Normalization**: Strings are whitespace-trimmed, numeric types (floats and ints) are normalized (e.g. `100.0 == 100`), datetimes are converted to UTC ISO 8601 strings, and JSON objects are sorted by keys.
- **Diff Categories**:
  - `header`: `title`, `description`, `tags`, `is_active`
  - `content`: `content_text` narrative
  - `canonical`: Category-specific structured fields (`price`, `sku`, `terms_conditions`, etc.)
  - `custom`: Tenant-defined attributes
  - `temporal`: `effective_from`, `effective_until`
- **No-Op Update Suppression**:
  If all fields match the current active version (`diff.is_no_op == True`) and no lifecycle status change is requested, the system returns the existing active version without incrementing `version_number` or persisting redundant database rows.

---

## 4. Rollback Architecture (Approach B: Monotonic Append-Only)

ProxiPilot adopts **Approach B** for rollbacks:

```
v1 (Initial) ──> v2 (Erroneous Edit) ──> v3 (Rollback to v1 State)
```

1. **Preservation of History**: Historical version `v2` is **not** deleted or modified.
2. **Monotonic Progression**: Rollback creates a new version `v3` (`version_number = max + 1`) mirroring the exact attributes, content narrative, and source lineage of `v1`.
3. **Audit Compliance**: An explicit `KNOWLEDGE_ROLLED_BACK` audit entry is recorded documenting `previous_version: 2`, `target_version: 1`, `new_version: 3`, and user-provided rollback reason.
4. **Vector Compatibility**: Downstream semantic projection and vector indices (Phase 10) treat `v3` as a standard update without having to perform destructive historical re-indexing.

---

## 5. API Endpoints

| Method | Endpoint | Description | Permission |
|---|---|---|---|
| `GET` | `/api/v1/knowledge/{id}/versions` | List all historical version snapshots | `knowledge.read` |
| `GET` | `/api/v1/knowledge/{id}/versions/{v}` | Retrieve a specific historical snapshot | `knowledge.read` |
| `GET` | `/api/v1/knowledge/{id}/versions/{v}/diff?compare_to={u}` | Compute field-level diff between versions | `knowledge.read` |
| `POST` | `/api/v1/knowledge/{id}/publish` | Transition a draft version to active state | `knowledge.update` |
| `POST` | `/api/v1/knowledge/{id}/rollback` | Monotonically rollback item to a target version | `knowledge.update` |
