# ProxiPilot — Phase 10 Hybrid Retrieval & Fact Verification Contract

**Document:** `docs/KNOWLEDGE-RETRIEVAL-CONTRACT.md`  
**Status:** Implemented, Tested & Verified (100% Pass)  
**Date:** October 18, 2026  
**Auditor:** ProxiPilot Core Systems Engineering  
**Scope:** RAG Multi-Stage Retrieval Specification, Fact Verification Invariants, and Fallback Hand-off Policies  

---

## 1. Architectural Philosophy: Qdrant for Discovery, PostgreSQL for Truth

A core failure mode of naive RAG architectures is relying on vector database payloads or LLM memory to recite critical commercial facts (pricing, warranties, SLAs, and coverage).

In ProxiPilot:
- **Qdrant Vector Engine:** Operates strictly as a **semantic candidate generator**. It identifies potentially relevant knowledge items from natural language queries.
- **PostgreSQL Relational Storage:** Operates as the **immutable single source of truth**. Every price, qualifier, discount, currency, and warranty period presented to a customer must be re-hydrated directly from the current active `knowledge_versions.canonical_data` record.
- **Zero Hallucination Policy:** If a service has `commercial_price_type = "estimate"` or `"starting_price"`, the response generation engine is strictly forbidden from quoting it as a guaranteed fixed price. If required commercial evidence is missing or conflicting, the system triggers a clarification or human hand-off.

---

## 2. End-to-End Retrieval Pipeline Specification

```
                          [ Incoming Customer Email / Message ]
                                            │
                                            ▼
                    [ Stage 1: Requirement & Entity Extraction ]
                    ├── Appliance Type: "Split AC"
                    ├── Service Need: "Cooling issue / general service"
                    ├── Location / Area: "Satellite, Ahmedabad"
                    └── Intent: "Inquiry on pricing and availability"
                                            │
                                            ▼
                          [ Stage 2: Dual Search Planner ]
                         ┌──────────────────┴──────────────────┐
                         │                                     │
                         ▼                                     ▼
           [ Fast Filtered Candidate Search ]    [ Exact Structured Lookup ]
           └── Qdrant: Dense Vector Query         └── PostgreSQL: Exact SKU/Key
               ├── Payload Filter:                    ├── Tenant: org_id
               │   organization_id = tenant_id        └── external_identity_key
               │   status = "active"
               └── Top-K Candidates (k=10)
                         │                                     │
                         └──────────────────┬──────────────────┘
                                            │
                                            ▼
                    [ Stage 3: Candidate Merge & Deduplication ]
                    └── Groups candidate chunks by knowledge_item_id
                                            │
                                            ▼
                       [ Stage 4: Bounded Semantic Reranking ]
                       └── Cross-Encoder / Cohere Rerank (Top-3)
                                            │
                                            ▼
               [ Stage 5: PostgreSQL Authoritative Re-hydration ]
               ├── Look up current_version_id from knowledge_items
               ├── Fetch canonical_data JSONB from knowledge_versions
               ├── Validate Temporal Bounds:
               │   effective_from <= NOW <= effective_until
               └── Verify Authority: authority_level >= tenant_threshold
                                            │
                                            ▼
                    [ Stage 6: Evidence Object Construction ]
                    ├── Base Price, Diagnostic Fee, Estimated Parts
                    ├── Calculated Total & Commercial Type
                    ├── Warranty Terms, SLA, Service Area
                    └── Confidence & Provenance Score
                                            │
                                            ▼
                 [ Stage 7: Requirement-Coverage Validation Gate ]
                 ├── Do we have verified pricing for requested service?
                 ├── Is customer location within verified service_area?
                 └── If NO -> Trigger Clarification / Agent Hand-off
                                            │ (If YES)
                                            ▼
                    [ Stage 8: Verified Response Generation ]
                    └── Generates natural email with verified facts
```

---

## 3. Detailed Stage Contracts

### Stage 1: Requirement & Entity Extraction
- Extracts user constraints: `appliance_category`, `brand`, `model`, `symptom_description`, `customer_municipality`, `commercial_urgency`.
- Identifies missing critical constraints (e.g. customer wants gas refilling but didn't specify whether it's Inverter or Non-Inverter).

### Stage 2: Dual Search Plan Execution
1. **Semantic Candidate Search (Qdrant):**
   - Query embedded via dense 1024-dimension embedding model.
   - Filter predicates applied at Qdrant search time:
     ```json
     {
       "must": [
         {"key": "organization_id", "match": {"value": "tenant_uuid"}},
         {"key": "status", "match": {"value": "active"}}
       ]
     }
     ```
2. **Exact Attribute Lookup (PostgreSQL):**
   - If user email cites a specific job reference, SKU, or service code (`HA-001`), PostgreSQL directly fetches the target item without vector lookup.

### Stage 3 & 4: Deduplication & Bounded Reranking
- Deduplicates chunk matches belonging to the same logical `knowledge_item_id`.
- Retains top $N \le 5$ candidate items to ensure deterministic LLM context and prevent context bloat.

### Stage 5: Authoritative PostgreSQL Verification (CRITICAL)
- **Current Version Verification:** Vector hits point to specific version IDs. The pipeline joins `knowledge_items.current_version_id` to ensure the vector hit is not an outdated, deprecated, or superseded version.
- **Temporal Validity Rule:**
  $$\text{effective\_from} \le T_{\text{current}} \land (\text{effective\_until} \text{ IS NULL} \lor \text{effective\_until} > T_{\text{current}})$$
- If an item fails temporal validity, it is immediately discarded.

### Stage 6: Evidence Object Structure
The retrieval engine must assemble a typed, immutable Evidence Object passed to the response synthesizer:

```json
{
  "item_id": "893c528f-...",
  "external_key": "HA-001",
  "title": "Split AC General Service",
  "pricing": {
    "currency": "INR",
    "base_price": 599.00,
    "visit_diagnostic_charge": 199.00,
    "estimated_parts_cost": 0.00,
    "discount_percentage": 0.00,
    "tax_percentage": 18.00,
    "calculated_total": 941.62,
    "commercial_price_type": "not_specified",
    "pricing_notes": "Parts and gas extra if required"
  },
  "service_area": "Ahmedabad",
  "warranty": {
    "duration_days": 30,
    "scope": "Service guarantee on workmanship"
  },
  "sla": {
    "response_time_hours": 24
  },
  "authority_level": "imported_data",
  "provenance": {
    "source_file": "ProxiPilot_Home_Appliance_Service_Enterprise_Dataset.xlsx",
    "version_number": 1
  }
}
```

---

## 4. Response Generation & Safety Invariants

### 4.1 Commercial Pricing Qualifiers
- **If `commercial_price_type == "fixed"`:** System may state: *"The price is fixed at INR 941.62 inclusive of taxes."*
- **If `commercial_price_type in ("estimate", "starting_price", "not_specified")`:** System is **strictly mandated** to include the qualifying language:
  > *"The estimated starting cost is INR 941.62 (Base: INR 599 + Visit: INR 199 + 18% GST). Final price may vary based on inspection and parts required."*

### 4.2 Handling Missing or Conflicting Facts
- If the customer requests emergency support on Sunday, but `canonical_data["availability"]["emergency_support"]` is `false` or missing, the system **must not invent a commitment**.
- The system responds: *"Our standard service operates Monday through Saturday. I will escalate your inquiry to our field dispatch team for urgent assistance."*

### 4.3 Out-of-Area Inquiries
- If customer's location cannot be mapped to the item's `service_area`, the response clarifies service coverage boundaries rather than booking an unserviceable appointment.

---

## 5. Implementation & Verification Status
 
The Phase 10 Hybrid Retrieval & Fact Verification pipeline is fully implemented and tested:
- **Service Implementation:** `server/app/services/hybrid_retrieval.py` (`HybridRetrievalService`)
- **API Endpoint:** `POST /api/v1/knowledge/retrieve` in `server/app/api/v1/routes/knowledge.py`
- **Pydantic Contracts:** `HybridRetrievalRequestDTO`, `HybridRetrievalResponseDTO`, `AuthoritativeEvidenceObject`, `AuthoritativePricingEvidence`, `RequirementValidationResult` in `server/app/contracts/rag.py`
- **Automated Regression Suite:** `server/tests/test_hybrid_retrieval.py`
  - Exact SKU/Code Lookup (`HA-001`) with authoritative PostgreSQL canonical pricing: **PASSED**
  - Semantic Vector ANN Candidate Search via Qdrant: **PASSED**
  - Geographic Boundary Mismatch Detection (`CLARIFY` prompt trigger): **PASSED**
  - Unserviceable Query Handling (`HUMAN_HANDOFF` trigger / zero hallucination): **PASSED**
  - Temporal Validity Filtering (Superseded & future exclusions): **PASSED**
