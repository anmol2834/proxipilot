# ProxiPilot Backend V1 — RAG & Retrieval Contracts

## Status: Frozen (Phase 0 Complete)

---

## 1. Hybrid Knowledge Architecture
Retrieval in ProxiPilot distinguishes **structured data** (exact SQL records) from **semantic data** (dense vector search). Semantic retrieval never replaces relational truth:

```text
                        Query / Requirement
                                │
               ┌────────────────┴────────────────┐
               ▼                                 ▼
      [PostgreSQL 16+]                  [Qdrant Vectors]
  Exact Structured Lookups          Dense Semantic Search
  - Active products & prices        - FAQs & troubleshooting
  - Contacts & operating hours      - Policy language & nuances
  - Organization configurations     - Company documentation & SOPs
               │                                 │
               └────────────────┬────────────────┘
                                ▼
                   [Evidence Attribution Layer]
                                │
                                ▼
                       AI Grounded Context
```

---

## 2. Qdrant Point Payload Contract
Every vector inserted into Qdrant must embed the following metadata payload:

```json
{
  "id": "vec_point_12345",
  "vector": [0.012, -0.045, 0.089, "... 1536 dims ..."],
  "payload": {
    "tenant_id": "org_acme_corp",
    "knowledge_item_id": "kb_item_7788",
    "knowledge_version_id": "kver_0011",
    "version_number": 2,
    "category": "policies",
    "title": "Cancellation & Refund Policy",
    "chunk_index": 0,
    "chunk_text": "Customers are eligible for a 100% refund if cancellation is requested at least 24 hours prior to appointment.",
    "source_type": "manual_kb",
    "authority_score": 1.0,
    "effective_from": "2024-01-01T00:00:00Z",
    "effective_until": null,
    "is_active": true
  }
}
```

### Retrieval Filter Invariant:
All Qdrant search calls **MUST** include:
```python
filter = Filter(
    must=[
        FieldCondition(key="tenant_id", match=MatchValue(value=current_tenant_id)),
        FieldCondition(key="is_active", match=MatchValue(value=True)),
    ]
)
```

---

## 3. Source Authority Hierarchy
When resolving conflicting information across multiple sources, the retrieval engine applies the following deterministic authority ranking:

| Rank | Source Class | Description | Authority Score |
|---|---|---|---|
| **1 (Highest)** | `live_business_api` | Real-time external system query (e.g. current inventory count) | `1.00` |
| **2** | `structured_postgres` | Database record in `business_entities` (e.g. current service price) | `0.95` |
| **3** | `approved_policy` | Published policy document version in `knowledge_versions` | `0.85` |
| **4** | `semantic_kb` | Support FAQ, website guide, or SOP in Qdrant | `0.75` |
| **5 (Lowest)** | `historical_email` | Past email thread conversation context | `0.50` |

---

## 4. Retrieval Request & Response Contracts

### 4.1 Hybrid Retrieval Request
```json
{
  "tenant_id": "org_acme_corp",
  "query_text": "Do you offer refunds for same-day service cancellations?",
  "categories": ["policies", "support_faqs"],
  "top_k": 5,
  "min_relevance_threshold": 0.70
}
```

### 4.2 Retrieval Response (Evidence Candidates)
```json
{
  "matches": [
    {
      "source_type": "knowledge_version",
      "source_id": "kver_0011",
      "category": "policies",
      "snippet": "Full refund if cancelled 24h prior to appointment. Same-day cancellations incur a $50 diagnostic dispatch fee.",
      "relevance_score": 0.91,
      "authority_score": 0.85,
      "effective_status": "current"
    }
  ]
}
```
