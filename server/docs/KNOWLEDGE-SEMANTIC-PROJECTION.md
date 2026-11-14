# ProxiPilot — AI-Ready Semantic Projection Architecture (Phase 8.6)
============================================================
Status: IMPLEMENTED & FROZEN  
Phase: 8.6 (AI-Ready Semantic Projection & Chunk Storage)  
Last Updated: 2026-09-17  

---

## 1. Executive Summary

Phase 8.6 provides the **AI-Ready Semantic Projection Layer** for ProxiPilot's Enterprise Knowledge Base.

It converts persisted canonical PostgreSQL records (`KnowledgeItem`, `KnowledgeVersion`, and `KnowledgeAttribute`) into deterministic, category-aware semantic documents and logical chunks, fully enriched with tenant, lineage, authority, and temporal validity metadata.

```
PostgreSQL Canonical Knowledge (Phase 8.5)
        ↓
Semantic Projection Service (Phase 8.6)
        ↓
Semantic Document DTO
        ↓
Logical Chunks + Metadata
        ↓
PostgreSQL knowledge_semantic_chunks + knowledge_versions.content_text
        ↓
Domain Event: knowledge.semantic_projection.ready
        ↓
[PHASE 10: Embedding & Qdrant Upsert]
```

### Critical Boundaries (What Phase 8.6 Does NOT Do)
- **NO vector embeddings:** Embedding generation belongs strictly to Phase 10.
- **NO Qdrant interactions:** No vector collections or payloads are created here.
- **NO LLMs or AI generation:** Pure deterministic, zero-hallucination projection.
- **NO retrieval / RAG:** Query arbitration and reranking belong to later phases.

---

## 2. Invariants

1. **Deterministic Projection:** Identical canonical inputs produce byte-identical semantic documents, chunk texts, chunk IDs, and document IDs.
2. **Category-Aware Taxonomy:** Each of the 9 frozen domain categories adheres to a domain-specific projection template preserving narrative structure and structured facts.
3. **Natural Word Boundaries:** Chunks never break words mid-character. Long sections split cleanly on line breaks or spaces with configurable overlap.
4. **No Null Pollution:** Missing, null, empty, or placeholder values (`"None"`, `"null"`, `"n/a"`) are strictly omitted from the semantic document.
5. **Strict Multi-Tenant Scoping:** Document IDs, chunk IDs, and stored database rows carry mandatory `tenant_id` partitioning. Same business content across different tenants yields distinct, isolated identifiers.
6. **Decoupled Architecture:** The core projection engine and chunker are pure Python algorithms with zero DB or network roundtrips during transformation.

---

## 3. Database Schema Changes (Phase 8.6)

### 3.1 Migration `b8c9d0e1f2a3_phase86_semantic_chunks.py`

#### 1. `knowledge_versions` Extension:
- **`semantic_version`** (`INTEGER NULL`): Tracks the projection schema version (distinct from `version_number` which tracks business content edits).
- **`content_text`** (`TEXT NULL`): Upgraded from raw column concatenations to the full, category-aware projected document text.
- **`chunk_count`** (`INTEGER NULL`): Populated with the exact number of logical chunks produced.

#### 2. New Table: `knowledge_semantic_chunks`:
Stores decomposed, section-tagged text with rich tenant and lifecycle metadata so Phase 10 can bulk embed without re-querying or parsing canonical rows:

```sql
CREATE TABLE knowledge_semantic_chunks (
    id VARCHAR(64) PRIMARY KEY,                         -- chk_<sha256>
    tenant_id VARCHAR(64) NOT NULL,                     -- multi-tenant partition
    knowledge_item_id VARCHAR(64) NOT NULL,             -- FK -> knowledge_items.id
    knowledge_version_id VARCHAR(64) NOT NULL,          -- FK -> knowledge_versions.id
    chunk_index INTEGER NOT NULL,                       -- 0-indexed position
    section VARCHAR(64) NOT NULL,                       -- logical section tag
    text TEXT NOT NULL,                                 -- chunk text for embedding
    char_count INTEGER NOT NULL,                        -- character length
    projection_version INTEGER NOT NULL DEFAULT 1,      -- template schema version
    source_id VARCHAR(64) NULL,                         -- lineage tracking
    authority_level VARCHAR(32) NOT NULL DEFAULT 'manual',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    effective_from TIMESTAMPTZ NULL,
    effective_until TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_knowledge_semantic_chunks_ver_idx UNIQUE (knowledge_version_id, chunk_index)
);
```

#### Performance Indexes:
- `ix_knowledge_semantic_chunks_tenant_ver` on `(tenant_id, knowledge_version_id)`
- `ix_knowledge_semantic_chunks_tenant_sec` on `(tenant_id, section)`
- `ix_knowledge_semantic_chunks_tenant_item` on `(tenant_id, knowledge_item_id)`

---

## 4. Category-Specific Projector Templates

All 9 canonical categories feature specialized section builders:

| Category | Logical Sections Generated | Key Canonical Fields Captured |
|---|---|---|
| `products_services` | `overview`, `description`, `pricing`, `availability`, `features`, `regional` | `sku`, `category_type`, `price`, `currency`, `pricing_model`, `availability`, `features`, `specifications`, `warranty_period`, `region` |
| `policies` | `overview`, `summary`, `policy_details`, `applicability` | `policy_type`, `summary`, `body`, `applies_to_region`, `effective_date`, `expiration_date` |
| `support_faqs` | `question`, `short_answer`, `answer`, `context` | `question`, `short_answer`, `answer`, `audience`, `category_tag` |
| `contacts` | `overview`, `contact_details` | `role`, `department`, `is_primary`, `email`, `phone`, `office_location` |
| `offers_promotions` | `overview`, `discount_details`, `terms`, `validity` | `promo_code`, `discount_value`, `discount_type`, `applicable_products`, `terms_and_conditions`, `valid_from`, `valid_until` |
| `company_info` | `overview`, `description`, `company_facts` | `legal_name`, `industry`, `description`, `website`, `support_email`, `support_phone`, `headquarters` |
| `operations` | `overview`, `summary`, `procedures`, `sla_escalation` | `procedure_type`, `summary`, `steps`, `sla_hours`, `escalation_contact` |
| `locations` | `overview`, `address`, `operations` | `location_type`, `address_line1/2`, `city`, `state`, `postal_code`, `country`, `operating_hours`, `contact_phone` |
| `brand_communication` | `voice_and_tone`, `key_messaging`, `approved_phrases`, `forbidden_phrases`, `guidelines` | `brand_voice`, `tone`, `key_value_propositions`, `approved_phrases`, `forbidden_phrases`, `writing_guidelines` |

*Note:* Any tenant custom attributes or unmapped fields are seamlessly formatted and appended under an `additional_attributes` section.

---

## 5. Semantic Chunker Design

Implemented in `app/services/semantic_chunker.py`:
- **Word-Boundary Splitting:** Paragraph/newline boundaries are preferred; whitespace breaks are used when sections exceed `SEMANTIC_MAX_CHARS`.
- **Configurable Settings (in `config.py`):**
  - `SEMANTIC_MAX_CHARS` (default: 2000, bounds: 200-8000)
  - `SEMANTIC_OVERLAP_CHARS` (default: 100, bounds: 0-500)
  - `SEMANTIC_PROJECTION_VERSION` (default: 1)
- **Deterministic Identifiers:**
  `chk_` + `sha256("{tenant_id}:{item_id}:{version_id}:{section}:{chunk_index}")[:16]`

---

## 6. Import Orchestration Integration

In `app/workers/import_worker.py`:
The import pipeline transitions through sequential checkpoints:
`PARSING` → `SCHEMA_DETECTION` → `MAPPING` → `VALIDATING` → `IMPORTING` → **`PROJECTING`** → `COMPLETED`

During `PROJECTING`:
1. Active `KnowledgeVersion`s persisted by Phase 8.5 are selected in memory with `selectinload(attributes)`.
2. `KnowledgeProjectionService.project_import_batch` processes records in batches of 500.
3. Chunks are persisted to `knowledge_semantic_chunks` and `content_text` is updated on `knowledge_versions`.
4. Domain event `knowledge.semantic_projection.ready` is published to Redis streams per projected item:
   ```json
   {
     "organization_id": "...",
     "knowledge_item_id": "...",
     "knowledge_version_id": "...",
     "projection_version": 1,
     "chunk_count": 3,
     "category": "products_services"
   }
   ```
5. Progress and projection summary metadata are persisted to the `import_job` row.
