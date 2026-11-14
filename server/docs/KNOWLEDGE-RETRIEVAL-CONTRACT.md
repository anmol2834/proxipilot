# KNOWLEDGE RETRIEVAL CONTRACT
## Phase 9.6 — Vector Search & RAG Retrieval Interface

---

## 1. Overview

The retrieval layer queries Qdrant to find semantically relevant knowledge chunks, then hydrates rich domain-specific data from PostgreSQL if deep details (e.g., live pricing, inventory checks, booking constraints) are needed.

---

## 2. Qdrant Payload Contract

Each point in Qdrant represents a semantic chunk with payload fields for filtering and scoring:

```json
{
  "point_id": "uuid-v4",
  "item_id": "uuid-v4",
  "version_id": "uuid-v4",
  "business_id": "uuid-v4",
  "chunk_index": 0,
  "chunk_type": "product | service | faq | policy | table | summary",
  "entity_type": "product | service | faq | policy",
  "title": "Item title or header",
  "semantic_text": "Embedded chunk content containing full normalized context",
  "semantic_hash": "sha256 hex string",
  "metadata": {
    "price": 499.00,
    "currency": "INR",
    "category": "Apparel",
    "tags": ["cotton", "oversized", "unisex"]
  }
}
```

---

## 3. Retrieval Flow for RAG

1. **User Query Analysis:**
   - Detect intent (e.g., product search, pricing enquiry, repair quote request, policy lookup).
   - Extract filter criteria (e.g., `business_id`, `entity_type`, price ranges).

2. **Vector DB Semantic Search:**
   - Embed query with target embedding model.
   - Filter Qdrant by `business_id` (mandatory isolation) and optional entity type / tags.
   - Retrieve top-k nearest semantic chunks with similarity scores.

3. **PostgreSQL Hydration & Validation (Source of Truth):**
   - For transactional or high-volatility data (e.g., stock levels, live rates, repair slots), query PostgreSQL using `item_id` / `version_id`.
   - Combine semantic context from Qdrant with real-time authoritative attributes from `canonical_data`.

4. **Prompt Assembly:**
   - Deliver normalized, factual, high-accuracy context to LLM for response generation.
