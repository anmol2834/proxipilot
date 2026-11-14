# ProxiPilot Backend V1 — AI Contracts

## Status: Frozen (Phase 0 Complete)

---

## 1. Overview & Separation of Concerns
The AI execution pipeline is split into distinct, inspectable phases. Raw LLM outputs are never directly piped to outbound email delivery without passing validation:

```text
Incoming Email Message
        │
        ▼
[Phase 1: Understanding & Intent Extraction]
        │
        ▼
[Phase 2: Requirement Planning & Tool Retrieval]
        │
        ▼
[Phase 3: Factual Grounding & Evidence Collection]
        │
        ▼
[Phase 4: Response Synthesis]
        │
        ▼
[Phase 5: Policy & Safety Validation]
       ╱ ╲
Pass  ╱   ╲ Fail (or Low Confidence)
     ▼     ▼
Outbound   Human Review Queue
```

---

## 2. Typed Pipeline Contracts

### 2.1 Email Understanding Payload (`EmailUnderstandingResult`)
```json
{
  "schema_version": 1,
  "message_id": "msg_abc123",
  "thread_id": "th_xyz789",
  "language": "en",
  "sentiment": "positive",
  "urgency": "medium",
  "intent": {
    "primary": "partnership_inquiry",
    "secondary": ["meeting_request"],
    "confidence": 0.94
  },
  "entities": [
    {
      "name": "Sarah Chen",
      "entity_type": "person",
      "value": "Sarah Chen"
    },
    {
      "name": "GrowthCo",
      "entity_type": "organization",
      "value": "GrowthCo"
    },
    {
      "name": "next week",
      "entity_type": "time_reference",
      "value": "2024-09-23T00:00:00Z"
    }
  ],
  "lead_signal": {
    "temperature": "hot",
    "rationale": "Direct B2B partnership proposal from prospective agency client"
  }
}
```

### 2.2 Requirement Plan (`RequirementPlan`)
Describes the factual requirements needed to draft an accurate response:
```json
{
  "schema_version": 1,
  "plan_id": "plan_9988",
  "thread_id": "th_xyz789",
  "requirements": [
    {
      "key": "req_agency_partnership_policy",
      "description": "Determine if ProxiPilot accepts agency consulting partnerships",
      "source_type": "knowledge_version",
      "category": "policies"
    },
    {
      "key": "req_calendar_availability",
      "description": "Retrieve executive booking link for exploratory calls",
      "source_type": "structured_entity",
      "category": "contacts"
    }
  ]
}
```

### 2.3 Evidence Record Contract (`EvidenceAttribution`)
```json
{
  "requirement_key": "req_agency_partnership_policy",
  "source_type": "knowledge_version",
  "source_id": "kver_4455",
  "authority_score": 1.0,
  "relevance_score": 0.92,
  "content_snippet": "Agency partners are eligible for our Tier-1 collaboration program, providing revenue share and co-marketing.",
  "effective_status": "current"
}
```

### 2.4 Response Generation Contract (`ResponseDraft`)
```json
{
  "schema_version": 1,
  "ai_run_id": "run_556677",
  "thread_id": "th_xyz789",
  "recipient_email": "sarah@growthco.com",
  "subject": "Re: Partnership opportunity",
  "draft_body": "Hi Sarah,\n\nThank you for reaching out! We would be delighted to explore a partnership with GrowthCo...\n\nBest,\nAnmol",
  "confidence_score": 0.95,
  "evidence_keys_used": ["req_agency_partnership_policy", "req_calendar_availability"],
  "ai_summary": {
    "intent": "Consulting partnership and strategic collaboration request",
    "bullet_points": [
      "Sarah is interested in a partnership between GrowthCo and ProxiPilot.",
      "They are impressed with your product.",
      "They'd like to schedule a quick call next week to discuss further."
    ]
  }
}
```

### 2.5 Validation & Safety Policy (`ResponseValidationResult`)
```json
{
  "passed": true,
  "policy_version": "v1.2",
  "checks": {
    "hallucination_check": "passed",
    "unsupported_claims": "none",
    "pii_leakage": "none",
    "tone_brand_alignment": "passed",
    "confidence_threshold_met": true
  },
  "action": "allow_dispatch",
  "fallback_reason": null
}
```

### 2.6 Human Handoff Trigger Contract (`HumanReviewTrigger`)
When `passed` is `false` or confidence falls below threshold (default $< 0.85$):
```json
{
  "trigger": "create_human_review",
  "thread_id": "th_xyz789",
  "reason": "low_confidence",
  "priority": "high",
  "system_notes": "Confidence 0.72 is below required 0.85 threshold for automatic dispatch."
}
```
