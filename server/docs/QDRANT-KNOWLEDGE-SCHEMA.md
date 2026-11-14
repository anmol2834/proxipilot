# ProxiPilot — Qdrant Production Knowledge Schema
===================================================
Status: IMPLEMENTED & VERIFIED  
Phase: 10 Foundation (Embedding Pipeline & Qdrant Indexing Foundation)  
Last Updated: 2026-09-17  

---

## 1. Logical Architecture: Shared Multi-Tenant Collection

ProxiPilot enforces a **shared logical knowledge collection** with **tenant-aware payload indexing**, strictly adhering to Qdrant's recommended multitenancy model.

```
Qdrant Cluster
└── Collection: "proxipilot_knowledge"
      ├── Tenant: Org A Points (Payload: organization_id = "org_a")
      ├── Tenant: Org B Points (Payload: organization_id = "org_b")
      └── Tenant: Org C Points (Payload: organization_id = "org_c")
```

### Invariants:
1. **Single Collection:** Zero dynamic physical collection creation per organization.
2. **Strict Multi-Tenant Partitioning:** Every single point contains `organization_id`.
3. **Pre-Write Tenant Validation:** All vector batches are validated against authoritative PostgreSQL tenant ownership *before* network upsert. An Organization A vector can never be written or indexed under Organization B.
4. **Authoritative Boundary:** PostgreSQL is the canonical source of truth for knowledge version lifecycle, active states, and temporal validity. Qdrant is an ephemeral, fully reproducible vector projection index.

---

## 2. Vector Schema (Named Vector Contract)

Vectors are stored using Qdrant's **Named Vectors** specification to ensure future retrieval models (such as sparse lexical vectors, SPLADE, or BM25) can be introduced without breaking the collection contract.

```json
{
  "vectors": {
    "dense": {
      "size": 1024,
      "distance": "Cosine",
      "on_disk": true
    }
  }
}
```

- **Vector Name:** `"dense"`
- **Dimension:** 1024
- **Distance Metric:** `Cosine`
- **HNSW Parameters:** `m = 16`, `ef_construct = 100`, `full_scan_threshold = 10000`.
- **Future Hybrid Retrieval Readiness:** When sparse vectors are added in Phase 11, the schema simply registers a `"sparse"` vector modifier without migrating or rebuilding existing `"dense"` vectors.

---

## 3. Deterministic Point Identity (RFC 4122 UUIDv5)

To guarantee idempotency, retry safety, and zero duplicate vectors from duplicate domain events, point IDs are generated deterministically using RFC 4122 UUIDv5:

$$\text{point\_id} = \text{UUIDv5}(\text{NAMESPACE\_DNS}, \text{"\{tenant\_id\}:\{version\_id\}:\{chunk\_id\}:\{model\_version\}"})$$

### Guarantees:
- Re-running the indexing worker produces identical point IDs.
- Upserts update vector coordinates in-place without increasing collection point counts.
- Tenant isolation is baked into the point identity seed.

---

## 4. Payload Schema Specification

Every Qdrant point encapsulates the complete `KnowledgeVectorPayload` DTO:

| Field Name | Type | Qdrant Index | Description |
|---|---|---|---|
| `organization_id` | `keyword` | **KEYWORD** | Mandatory tenant isolation key. Included in all queries. |
| `category` | `keyword` | **KEYWORD** | Knowledge category (e.g. `products_services`, `policies`). |
| `status` | `keyword` | **KEYWORD** | Lifecycle state (`active`, `draft`, `archived`). |
| `knowledge_item_id` | `keyword` | **KEYWORD** | Canonical parent item UUID (`ki_...`). |
| `knowledge_version_id` | `keyword` | **KEYWORD** | Immutable version UUID (`kv_...`). |
| `source_id` | `keyword` | **KEYWORD** | KnowledgeSource origin ID (`src_...`). |
| `authority` | `keyword` | **KEYWORD** | Authority rank (`live_api`, `approved_policy`, `draft`). |
| `entity_type` | `keyword` | **KEYWORD** | Optional domain sub-type (e.g. `service`, `hardware`). |
| `entity_id` | `keyword` | None | Domain reference ID (e.g. SKU, policy code). |
| `region` | `keyword` | None | Geographic applicability region (e.g. `APAC`, `NA`). |
| `language` | `keyword` | None | Primary language code (`en`, `hi`). |
| `effective_from` | `keyword` | **KEYWORD** | ISO 8601 validity start timestamp. |
| `effective_until` | `keyword` | **KEYWORD** | ISO 8601 expiration timestamp (`null` = indefinite). |
| `chunk_id` | `keyword` | None | Deterministic chunk ID (`chk_...`). |
| `chunk_index` | `integer` | None | 0-indexed position within version. |
| `section` | `keyword` | None | Logical section tag (e.g. `overview`, `pricing`). |
| `text` | `text` | None | Projected chunk text content. |
| `char_count` | `integer` | None | Character length of text. |
| `projection_version`| `integer` | None | Semantic projection template schema version. |
| `content_hash` | `keyword` | None | SHA-256 digest of normalized chunk text. |
| `embedding_model` | `keyword` | None | Model name (e.g. `voyage-4-large`). |
| `embedding_model_version` | `keyword` | None | Model checkpoint (e.g. `2026-v1`). |
| `embedding_dimension` | `integer` | None | Dimensionality (1024). |
| `created_at` | `keyword` | **KEYWORD** | ISO 8601 creation timestamp. |

> [!CAUTION]
> **No Secrets Policy**: Under no circumstances may client secrets, JWT secrets, passwords, or session tokens be stored in Qdrant payloads.

---

## 5. Payload Indexing Strategy

Payload indexes are created selectively to optimize tenant-local filtering without excessive memory overhead:

```python
# Tenant & Lifecycle Filtering (High Selectivity)
await client.create_payload_index(collection, "organization_id", PayloadSchemaType.KEYWORD)
await client.create_payload_index(collection, "category", PayloadSchemaType.KEYWORD)
await client.create_payload_index(collection, "status", PayloadSchemaType.KEYWORD)
await client.create_payload_index(collection, "knowledge_item_id", PayloadSchemaType.KEYWORD)
await client.create_payload_index(collection, "knowledge_version_id", PayloadSchemaType.KEYWORD)
await client.create_payload_index(collection, "source_id", PayloadSchemaType.KEYWORD)
await client.create_payload_index(collection, "authority", PayloadSchemaType.KEYWORD)

# Temporal Boundary Filtering
await client.create_payload_index(collection, "effective_from", PayloadSchemaType.KEYWORD)
await client.create_payload_index(collection, "effective_until", PayloadSchemaType.KEYWORD)
await client.create_payload_index(collection, "created_at", PayloadSchemaType.KEYWORD)
```

---

## 6. Verification and Health Probes

1. **Readiness Probe (`/ready`):** `QdrantManager.check_health()` validates that the Qdrant cluster is reachable and healthy.
2. **Deterministic Upsert Verification:** Re-upserting points with identical parameters does not duplicate points in collection.
3. **Tenant Boundary Enforcement:** `assert_qdrant_filter_has_tenant(filter, org_id)` guarantees every future vector retrieval operation appends mandatory tenant scoping.
