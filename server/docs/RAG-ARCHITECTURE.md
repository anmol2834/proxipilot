# ProxiPilot RAG & Knowledge Retrieval Architecture

---

## 1. Division of Responsibility: PostgreSQL vs. Qdrant

| Data Category | Storage Engine | Query Method | Examples |
| :--- | :--- | :--- | :--- |
| **Structured Business Data** | PostgreSQL (Neon) | Deterministic SQL | Order status, tracking numbers, invoices, account balances, subscription tiers |
| **Semantic Company Knowledge** | Qdrant Vector DB | Cosine Vector Distance | FAQs, product manuals, refund policies, SOPs, support documentation |

**Rule**: Never perform vector similarity searches for deterministic data that has an exact primary key or foreign key in PostgreSQL.

---

## 2. Strict Tenant Isolation in Qdrant

Every payload stored in Qdrant includes mandatory tenant metadata:
```json
{
  "tenant_id": "tenant_acme_corp",
  "document_id": "doc_refund_policy_v2",
  "version": 2,
  "status": "active"
}
```
All retrieval queries MUST append `QdrantManager.build_tenant_filter(tenant_id)`.

---

## 3. Retrieval Orchestrator Workflow

```text
Query from Email Requirements
  ↓
Query Planner (Classifies required evidence sources)
  ├── Structured -> SQL query against Neon Postgres
  └── Semantic -> Hybrid Vector search against Qdrant
  ↓
Candidate Pool (Top 20-30 chunks)
  ↓
Reranker (Top 3-6 high-relevance chunks)
  ↓
Context Pruning (Truncate excessive tokens)
  ↓
Evidence Injection into LLM Prompt
```

---

## 4. Knowledge Versioning & Cache Invalidation

Knowledge is versioned monotonically per tenant:
- Cache key format: `tenant:{tenant_id}:knowledge:v{version}:{query_hash}`
- When document updates are published, the tenant knowledge version increments from $v$ to $v+1$.
- Old cached entries naturally expire or are ignored without requiring expensive global cache flushes.
