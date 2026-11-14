# ProxiPilot AI & LLM Engine Architecture

> **Goal**: High accuracy, zero hallucinations, minimal cost per email, sub-second routing.

---

## 1. Modular AI Processing Pipeline

The AI pipeline is strictly decoupled from the synchronous HTTP request path:

```text
Incoming Email Event
  ↓
1. Normalization & Language Detection
  ↓
2. Fast-Path Classification (e.g. "Thanks", "Got it" -> Predefined response or No Reply)
  ↓
3. Intent & Requirement Extraction
  ↓
4. Search Plan (Determines required knowledge vs live relational DB data)
  ↓
5. Hybrid Retrieval (Qdrant Vectors + Postgres Data)
  ↓
6. Evidence Validation & Confidence Gating
  ↓
7. Response Generation (Scoped prompt with minimal context)
  ↓
8. Response Validation (Policy, hallucination check, tone, duplicate check)
  ↓
9. Outbound Send Approval Event
```

---

## 2. Fast-Path Classification

Not every incoming email warrants an expensive embedding and LLM invocation.

- Common acknowledgments ("Thank you", "Received", "Will check tomorrow") are classified via fast heuristic or small local classifier.
- Bypasses Qdrant and LLM, directly acknowledging or drafting standard safe responses.
- Saves up to 40% of baseline LLM operational costs.

---

## 3. Dynamic Model Routing

| Request Class | Criteria                                                          | Model Route              | Latency Target  |
| :------------ | :---------------------------------------------------------------- | :----------------------- | :-------------- |
| **Simple**    | Standard FAQ, policy check, canned inquiries                      | `gpt-4o-mini`            | < 1.5s          |
| **Medium**    | Multi-requirement email, order status + refund request            | `gpt-4o-mini` / `gpt-4o` | < 3.0s          |
| **Complex**   | Dispute resolution, legal clauses, high-value enterprise accounts | `gpt-4o` / Human Handoff | < 6.0s / Review |

---

## 4. Evidence Gating & Hallucination Prevention

**Core Mandate**: The AI is never permitted to invent business facts.

- If required evidence is missing from Qdrant and PostgreSQL:
  - **Decision**: `ASK_CLARIFICATION` or `HUMAN_REVIEW`.
  - **Forbidden**: Guessing order statuses, prices, or policies.
- Every response must cite verified evidence chunks retrieved during the current turn.

---

## 5. Duplicate Response Prevention (3 Layers)

1. **Layer 1 (Event Idempotency)**: Ingestion stream checks `provider_message_id` via Bloom filter and unique DB constraint.
2. **Layer 2 (Outbound Idempotency)**: `hash(tenant_id + thread_id + last_message_id + response_intent)` prevents double-dispatch.
3. **Layer 3 (Semantic Duplication)**: Compares generated candidate text against recent replies in the same thread.
