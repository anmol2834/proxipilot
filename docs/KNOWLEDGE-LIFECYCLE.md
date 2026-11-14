# ProxiPilot — Knowledge Lifecycle & State Machine (Phase 7.0)
============================================================
Status: FROZEN  
Phase: 7.0 (Knowledge Architecture Freeze)  
Last Updated: 2026-09-17  

This document defines the lifecycle states, state transitions, actor permissions, temporal validity, and audit event emission for the ProxiPilot Knowledge domain model.

---

## 1. Lifecycle State Machine

Each `KnowledgeVersion` exists in exactly one state at any point in its lifecycle:

```
                  ┌──────────────────┐
                  │      DRAFT       │
                  └─────────┬────────┘
                            │
                   (Schema Validation)
                            │
                            ▼
                  ┌──────────────────┐
                  │    VALIDATED     │
                  └─────────┬────────┘
                            │
                       (Publish)
                            │
                            ▼
                  ┌──────────────────┐
                  │      ACTIVE      │◄────────── (Current Grounding Source)
                  └─────┬──────┬─────┘
                        │      │
           (Superseded) │      │ (Emergency Retract)
                        │      │
                        ▼      ▼
                 ┌──────────┐ ┌──────────┐
                 │ ARCHIVED │ │ REVOKED  │
                 └──────────┘ └──────────┘
```

### 1.1 State Definitions

| Status | Definition | Visible to Public AI Grounding? |
| :--- | :--- | :--- |
| **DRAFT** | New version created. Content text or structured attributes may be incomplete or undergoing staging. | **No** |
| **VALIDATED** | Version has passed canonical schema checks and attribute typing rules. Ready for administrative publication. | **No** |
| **ACTIVE** | Authoritative, published state. Pointed to by `KnowledgeItem.current_version_id`. Grounded in live negotiations and assistant responses. | **YES** |
| **ARCHIVED** | Deprecated or superseded by a newer `ACTIVE` version. Retained indefinitely for historical lineage, audit trails, and conversation replay. | **No** |
| **REVOKED** | Explicitly invalidated due to factual inaccuracies, legal dispute, or retracted business offer. | **No** |

---

## 2. State Transitions & Rules

### 2.1 Transition Matrix

| From State | Allowed Target State | Trigger / Action | Required Role | Audit Event |
| :--- | :--- | :--- | :--- | :--- |
| *(None)* | `DRAFT` | Create Version | `ADMIN`, `OWNER`, `MEMBER` | `KNOWLEDGE_VERSION_CREATED` |
| `DRAFT` | `VALIDATED` | Pass Validation Engine | System / Automated / User | *(Internal metric)* |
| `VALIDATED` | `ACTIVE` | Publish Version | `ADMIN`, `OWNER` | `KNOWLEDGE_VERSION_ACTIVATED` |
| `ACTIVE` | `ARCHIVED` | Activate Newer Version | System / Automated / Admin | `KNOWLEDGE_VERSION_ARCHIVED` |
| `ACTIVE` | `REVOKED` | Emergency Retraction | `ADMIN`, `OWNER` | `KNOWLEDGE_UPDATED` |
| `ARCHIVED` | *(Terminal)* | N/A (Immutable) | N/A | N/A |
| `REVOKED` | *(Terminal)* | N/A (Immutable) | N/A | N/A |

### 2.2 Activation Invariant
When a version `V2` of `KnowledgeItem` `K` is activated:
1. `V2.status` becomes `ACTIVE`.
2. `V2.published_at` is set to `NOW()`.
3. If an existing version `V1` was `ACTIVE`, `V1.status` is transitioned to `ARCHIVED`, and `V1.archived_at` is set to `NOW()`.
4. `K.current_version_id` is updated to point to `V2.id`.
5. An audit event `KNOWLEDGE_VERSION_ACTIVATED` is recorded with `actor_id`, `tenant_id`, `item_id`, and `version_id`.

---

## 3. RBAC & Actor Permissions

ProxiPilot enforces strict tenant-level RBAC via `OrganizationMembership.role`:

| Action | Owner | Admin | Member | External / Public |
| :--- | :---: | :---: | :---: | :---: |
| View Knowledge Items / Versions | ✅ | ✅ | ✅ | ❌ |
| Create Knowledge Item | ✅ | ✅ | ✅ | ❌ |
| Author / Edit Draft Version | ✅ | ✅ | ✅ | ❌ |
| Publish / Activate Version | ✅ | ✅ | ❌ | ❌ |
| Archive / Revoke Version | ✅ | ✅ | ❌ | ❌ |
| Create Knowledge Source (Upload) | ✅ | ✅ | ❌ | ❌ |
| Delete Knowledge Item (Soft) | ✅ | ✅ | ❌ | ❌ |
| Hard Delete Knowledge Record | ❌ | ❌ | ❌ | ❌ |

> [!NOTE]  
> ProxiPilot follows an append-only, immutable versioning philosophy. Hard deletion of knowledge versions is strictly prohibited in enterprise production to preserve historical lineage for legal and negotiation audit trails. Soft deletion is accomplished via `KnowledgeItem.is_active = FALSE`.

---

## 4. Temporal Validity Handling

Business knowledge frequently has finite windows of validity (e.g., promotional campaigns, seasonal rate cards, quarterly policies).

### 4.1 Temporal Attributes on `KnowledgeVersion`
- `effective_from`: UTC timestamp indicating when the knowledge begins taking legal/operational effect.
- `effective_until`: UTC timestamp indicating when the knowledge expires.

### 4.2 Point-in-Time Resolution Query
When querying for authoritative knowledge at timestamp `$query_time` (defaults to `NOW()`):
```sql
SELECT kv.*
FROM knowledge_versions kv
JOIN knowledge_items ki ON kv.id = ki.current_version_id
WHERE ki.tenant_id = :tenant_id
  AND ki.is_active = TRUE
  AND kv.status = 'active'
  AND (kv.effective_from IS NULL OR kv.effective_from <= :query_time)
  AND (kv.effective_until IS NULL OR kv.effective_until >= :query_time);
```

If a version has expired (`effective_until < NOW()`), it is automatically excluded from active AI grounding queries without requiring destructive manual archiving.

---

## 5. Source Lineage & Provenance

Every `KnowledgeItem` and `KnowledgeVersion` links to a `KnowledgeSource`:
- **Item Origin**: `KnowledgeItem.source_id` documents what originally created the item record (e.g. initial onboarding import).
- **Version Provenance**: `KnowledgeVersion.source_id` documents the specific upload, API batch, or manual authoring session that provided this specific iteration.
- **Authority Grounding**: `KnowledgeVersion.authority_level` dictates priority if two knowledge items assert conflicting statements during AI context generation.

---

## 6. Audit Logging Contract

All knowledge lifecycle operations must emit structured events using the existing `AuditService` and `audit_events` table:

```python
await audit_service.log_event(
    db=session,
    organization_id=tenant_id,
    user_id=actor_id,
    action=AuditAction.KNOWLEDGE_VERSION_ACTIVATED,
    resource_type="knowledge_version",
    resource_id=str(version.id),
    metadata={
        "knowledge_item_id": str(item.id),
        "version_number": version.version_number,
        "category": item.category,
        "authority_level": version.authority_level
    },
    ip_address=request_ip
)
```

**Audited Domain Actions:**
- `KNOWLEDGE_CREATED`
- `KNOWLEDGE_UPDATED`
- `KNOWLEDGE_VERSION_CREATED`
- `KNOWLEDGE_VERSION_ACTIVATED`
- `KNOWLEDGE_VERSION_ARCHIVED`
- `KNOWLEDGE_SOURCE_CREATED`

No sensitive credentials, passwords, or oversized raw file blobs may be included in the audit `metadata` payload.
