# Conversation Selection State & Decision Enforcement — Audit and Implementation Report

Date: 2026-11-15

**Scope:** the production failure in thread "Inquiry for hi speed hand dryer" (tenant Dolphy India,
14 Nov 2026). The customer chose a listed product, and the system kept listing other products. Some
drafts marked for human review were sent automatically.

## 1. Pipeline as it actually runs (audited)

```
Gmail Pub/Sub push ─▶ webhook (outbox) ─▶ email-worker: incremental sync, persist, relevance filter
   ─▶ context_resolver (ContextEnvelope: current msg, previous msgs, previously presented ids)
   ─▶ AI #1 requirement_planner (preprocess ─▶ OpenAI structured plan ─▶ deterministic validator)
   ─▶ retrieval_router (structured + Qdrant dense + lexical; eligibility gate; RRF; verifier)
   ─▶ evidence_fusion ─▶ evidence_package
   ─▶ AI #2 reply_planner (context engine ─▶ drafter ─▶ deterministic validator ─▶ policy gate)
   ─▶ ai_worker ─▶ delivery (Gmail send, presented-item tracking)
```

**Reused as is:**
- the presented-item ledger (`ThreadPresentedEntity`);
- the planner's structured output and validator;
- exact-key structured retrieval;
- the eligibility gate;
- evidence fusion and packaging;
- the drafter, validator and policy gate;
- Redis Streams workers.

No new tables, services, queues or models were added.

## 2. Root causes (evidence: production logs, 2026-11-14 17:14–17:20 UTC)

| Customer turn | What the system did | Root cause (code) |
|---|---|---|
| "Okay so i want automatic industrial jet hand dryer." | intent `more_options`: excluded every presented item (including the chosen one) and listed 5 new ones | No selection state existed. The planner/validator could only see "previously presented ids" and treated a reference to them as a continuation (`requirement_planner/validator.py`), which sets `excluded_entity_ids`. |
| "Know tell me how can i place the order?" | answered for the right product | (The model inferred it from history text, by luck rather than state.) |
| "I want 5 qty and best discount also." | `price_query` + fresh semantic discovery: 4 other dryers listed | Follow-ups were retrieved from the new message text. Nothing tied retrieval to the chosen entity. |
| (all turns) | `HUMAN_REVIEW` / `CLARIFY` drafts were emailed 2–3 s after drafting | `ai_worker` → `delivery.deliver_reply` checked only `validation_report.is_sendable`, never the disposition. |

## 3. Changes

### 3.1 Conversation selection state (`app/services/conversation_selection.py`, new, pure + one read)
- **What counts as "presented":** the items sent to the customer in the thread (tenant-scoped read
  of `thread_presented_entities`).
- **When a message selects item X:** it names X by an exact code, or by **distinguishing
  title words**, meaning words not shared by every presented option. At least 2 are needed, with a
  unique best match. Family words common to all options ("hand dryer") select nothing, and
  ambiguous mentions select nothing.
- **Active selection:** the latest customer message that selects an item. Asking for alternatives
  in a message that names no presented item clears it.
- **No hardcoding:** there are no product, category or phrase lists. The vocabulary comes from
  what this tenant's replies actually presented.

### 3.2 AI #1 plan enforcement (`requirement_planner/service.py: apply_selection_state`)
- The presented-item lookup runs in parallel with the LLM planning call, on its own session, so it
  adds no latency.
- **When a selection exists**, the plan gets:
  - `active_selection` (id, code, title), and `focus_entity_ids`;
  - `excluded_entity_ids = []`, so the chosen item is never excluded.
- **When the planner said `more_options` / `different_options` but the message names a presented
  item,** intent becomes `product_lookup`, continuation is off.

### 3.3 Retrieval enforcement (`retrieval_router/router.py: _execute_focused`)
- **The selected item** is retrieved by its exact key, with authoritative facts. No catalogue
  rediscovery.
- **Other requirements in the same email** (policies, contacts, delivery…) still retrieve, but may
  only contribute items of their own knowledge category. A category the business has no data for
  is reported as `CATEGORY_NOT_CONFIGURED` and never back-filled with catalogue products.
- **If the selected item no longer exists,** normal retrieval runs instead (it is logged).

### 3.4 AI #2 instruction (`evidence_package` → `drafter`)
- The package carries `active_selection_title`.
- The drafter is told to:
  - keep the reply about that item and the current request;
  - not list or suggest other products unless the customer asked for alternatives;
  - compute totals only from the verified unit price;
  - never promise a discount that isn't in the evidence.

### 3.5 Decision safety
- **`delivery.deliver_reply`** auto-sends only `SEND`, `PARTIAL_RESPONSE` and `CLARIFY`.
  `HUMAN_REVIEW`, `REJECTED`, `NO_REPLY_REQUIRED` and `RETRYABLE_FAILURE` stay drafts for the team.
- **`reply_planner/service.py`:** a discount or better-price request (generic commercial wording,
  incl. common Hinglish) with **no approved discount in the evidence** becomes `HUMAN_REVIEW`.
- **Validator (earlier change, still applies):** placeholder content ("₹ XX,XXX", "[price]") is
  critical.

## 4. Tests (all executed; synthetic isolated tenants, never Dolphy data)

- `tests/test_conversation_selection_unit.py` (8): selection by distinguishing words, by code,
  family words alone, ambiguous mentions, persistence across follow-ups, changing the selection,
  alternatives clearing it, and the misread "more options" case.
- `tests/test_selection_conversation_regression.py` (2): the production conversation replayed on
  the home-appliance services fixture through the real AI #1, retrieval, fusion, packaging and AI #2.
  The test fails if the system:
  - loses the selection;
  - excludes the chosen item;
  - retrieves anything else;
  - mentions another presented item;
  - says "additional options";
  - invents a discount;
  - auto-sends the discount turn.

  Asking for alternatives must clear the selection.
- **Read-only replay of the real production thread through the resolver:** messages 2–4 resolve to
  "Automatic Industrial Jet Hand Dryer Silver 1800W" among 14 presented items. Message 1 resolves
  to no selection.
- **Existing suites:** the planner, reply planner, retrieval, fusion, package and unit suites. Their
  result is recorded in the commit message.

## 5. Performance and cost
- **No extra LLM calls.**
- **One extra indexed DB read per email** (presented items for the thread), run concurrently with
  the planning call.
- **Focused retrieval is cheaper than discovery:** it is a single exact-key lookup.

## 6. Security / tenant isolation
- The presented-item read filters by `tenant_id` **and** `thread_id`.
- Focused retrieval goes through the existing tenant-checked router. A cross-tenant plan is
  rejected before any work.
- The LLM never generates SQL or IDs. The selection is computed deterministically from stored
  thread data.

## 7. Known limitations (honest)
- **Item names the customer never saw:** a selection must refer to an item already presented in the
  thread. Selecting such an item works through normal exact or semantic retrieval, not selection
  state.
- **Pronouns:** "it" / "that one" with no distinguishing words keep the most recent selection. If
  nothing was selected yet, the planner/LLM resolves them as before. This is not yet a clarification
  prompt when several items are equally plausible.
- **Multi-item selections:** "the first two" are not modelled. One active selection is kept.
- **Discount detection:** it is wording-based. Unusual phrasing may miss it. Such replies then rely
  on the drafter rule never to promise a discount.
- **AI #2 tool use / web search:** not implemented. AI #2 remains a single bounded drafting call
  with deterministic validation.
- **Accuracy claims:** none beyond the executed tests above.
