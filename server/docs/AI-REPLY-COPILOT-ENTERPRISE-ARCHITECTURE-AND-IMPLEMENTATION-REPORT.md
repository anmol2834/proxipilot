# AI Reply Copilot: architecture and implementation report (2026-11-17)

## 1. Audit findings (before this change)

| Area | Finding |
|---|---|
| Copilot panel (`IsolatedAiPromptBox.tsx`) | **UI only.** "Replies" were hard-coded templates picked by keywords after an 850 ms timer. They contained a fixed product code (`DSDR0099`) and a fixed tenant sign-off ("Dolphy Support Team"), with no backend call. |
| Apply | `onApplyDraft` overwrote the editor unconditionally: no revision check and no undo. Re-applying identical text was silently ignored, because injection only fired on value change. |
| Backend | No Copilot endpoint existed. |
| Reusable pieces already in place | AI #1 planner (`requirement_planner`), retrieval router (indexed PostgreSQL + Qdrant HNSW + keyword), evidence fusion (hard constraints), Minimal Evidence Package, AI #2 drafter client and pools, deterministic validator helpers, shown-item history (`thread_presented_entities`), RBAC (`require_permission`), tenant-scoped thread queries. |
| Evidence persistence | A package is **not** stored; only the items shown in a reply are (`thread_presented_entities`). Reusing evidence therefore means re-reading those items' current records, which is also the only way to guarantee freshness. |
| Pre-existing defect found | `DeterministicReplyValidator._verify_exact_prices` always accepted ₹1,000 and ₹2,500 as "verified" (`range_bounds` constants from a test fixture). The automated pipeline could therefore send an invented ₹1,000 / ₹2,500 price. The coverage check also contained fixture vocabulary ("washing machine", "microwave", "2500", "1000"). **Fixed** (see §9). |
| Cost risks a naive Copilot would have | Running planner + embedding + retrieval + drafter on every instruction, including "fix grammar". |

## 2. What is reused (no second RAG engine)

- **Planning, retrieval and evidence:** `requirement_planner_service.plan_requirements` → `retrieval_router_service.route_and_retrieve` → `evidence_fusion_service.fuse_and_verify` → `evidence_package_service.build_package`. All four are called with `dispatch_event=False`, so they produce no pipeline side effects.
- **LLM client:** `reply_drafter`'s shared OpenAI client, global and per-tenant semaphores, and `completion_params`. These use the existing `.env` model and key.
- **Validation and sign-off:** `_placeholders_in` from the reply validator, and `knowledge_search_index._price`.
- **Records and closing:** `CanonicalKnowledgeReader.get_current_items_batch` (one batch query) for current versions, and the style-memory closing (`ReplyPlannerService._resolve_closing`) when composing from an empty draft.
- **Security:** RBAC `inbox.reply`, and tenant-scoped SQL in the same pattern as `/feedback/threads/{id}/draft`.

## 3. New components

| File | Purpose |
|---|---|
| `app/services/reply_copilot/contracts.py` | Typed request, decision, fact, evidence and result contracts |
| `app/services/reply_copilot/decision.py` | AI #1: deterministic rules first; at most one structured model call; allowlisted output |
| `app/services/reply_copilot/evidence.py` | Thread snapshot, L1 context records, L2 exact cache, L3 existing pipeline |
| `app/services/reply_copilot/composer.py` | AI #2 structured proposal (evidence review, bounded extra-search request) + deterministic validator |
| `app/services/reply_copilot/service.py` | Orchestration, bounds, metrics, logging |
| `app/api/v1/routes/copilot.py` | `POST /api/v1/copilot/threads/{thread_id}/refine` |
| `client/src/services/copilot.service.ts` | Typed client and the `draftRevision` hash |
| `IsolatedAiPromptBox.tsx`, `ConversationDetailPane.tsx`, `dashboard/inbox/page.tsx` | Real calls; Cancel; revision-checked Apply; Undo; evidence, gap and issue display |

## 4. AI #1: the Copilot decision

1. **Rules (no model call).** A draft exists, and the instruction contains no identifier and no commercial-fact vocabulary (price, spec, warranty, delivery, discount, alternatives, contact, policy, add/include…). Result: `WRITING_ONLY`.
2. **Otherwise, one structured call** (`json_schema`, strict) returns:
   - an `operation` (`WRITING_ONLY | EVIDENCE_REUSE | NEW_RETRIEVAL | MIXED | CLARIFY`);
   - up to three **standalone fact requests**, each with `request`, `attributes`, `entity_codes` and `about_context_items`.

   The model sees the instruction, the previous Copilot instructions, the codes and titles of items already in the conversation, the customer message and the draft. Customer text and draft are fenced as untrusted data.
3. **Backend validation.** Unknown operations degrade to writing-only. Requests are capped at 3 and 400 characters each. Codes must match `^[A-Za-z0-9][A-Za-z0-9._/-]{1,39}$`, so injected SQL-like strings are dropped (unit-tested). The output never carries SQL, filters, tenant IDs or tool names.
4. **No model available:** a conservative fallback that never invents facts.

Mixed instructions ("make it professional and add delivery charges to Mumbai") produce one fact request for the delivery charge only. The wording change needs no retrieval.

## 5. AI #2: evidence-reviewing composer

- **Inputs:**
  - the instruction;
  - the verified facts, each with an id, code, title, attribute, value and authority;
  - known gaps;
  - requested codes not in the catalogue, with their closest codes;
  - a search-incomplete flag;
  - a short thread brief, the customer message, and the draft.
- **Outputs (strict schema):**
  - `revised_draft`, `changes_summary`, `used_fact_ids`;
  - `rejected_evidence` (facts about the wrong product, size or category);
  - `unresolved`;
  - `needs_more_evidence` (a standalone question, or null).
- **Rules:** facts come only from verified facts or the existing draft. No model memory. Discounts, warranties and contacts are never invented. Missing facts are listed and phrased as "the team will confirm". It never says a code does not exist when the search was incomplete, and never claims attachments, sends, bookings or hand-overs.
- **Bounded extra search:** at most `MAX_EXTRA_RETRIEVALS = 1`. The request is validated like AI #1's output, resolved through L1→L2→L3, and the proposal is recomposed. A second request is ignored (unit-tested).

## 6. Retrieval decision and evidence-reuse policy

Each fact request is resolved independently and concurrently (at most 3, one DB session each):

| Level | When | Cost |
|---|---|---|
| **L1 context records** | Every referenced code is an item already in the conversation (draft, customer message, or shown in an earlier reply) **and** its current record contains the requested attributes (generic name match: `price`/`cost`/`rate`→price; `warranty`→`warranty_*`; "specs/details" → any). | One B-tree lookup by `code_upper` plus one batch version read: O(k log n). No embedding, no LLM. |
| **L2 exact cache** | Same tenant, thread, thread context revision, catalogue revision, algorithm version and normalised request (text + attributes + codes). | One Redis GET, average O(1), plus a **version re-check** of every cached fact (one batch query). Any changed or deactivated item means a miss. |
| **L3 primary retrieval** | Otherwise. Uses the existing pipeline (planner, then indexed PostgreSQL / Qdrant HNSW / keyword, then fusion with hard constraints, then package). | Planner LLM + embedding + indexed queries. |

- **Failure handling:** a source error becomes `search_incomplete` plus an unresolved note ("Could not search the catalogue right now"). It never becomes "does not exist".
- **What is cached:** only clean results (facts or unknown-code suggestions, with an exhaustive search).

## 7. Cache identity and invalidation

- **Key:** `copilot:ev:cpv1:{tenant}:{thread}:{thread_context_revision}:{catalogue_revision}:{sha256(normalised request)}`.
- **Budgets:** different budgets, sizes, codes, threads (customers), tenants or catalogue states give different keys (unit-tested).
- **Catalogue revision:** `copilot:catrev:{tenant}` is incremented by `invalidate_catalogue_overview`. That hook already runs on every manual knowledge change (`knowledge_sync.sync_after_commit`) and on every import completion. Prices, status, policy and contacts all live in knowledge items, so every such change invalidates.
- **TTL:** 600 s, as a bound.
- **Hit re-validation:** per-fact `version_id` must equal the current version. So even a missed revision bump cannot serve a stale price.
- **Authorisation scope:** pricing in ProxiPilot is tenant-wide (there are no per-retailer price lists today), so tenant plus thread is the full scope. When per-customer price lists are added, their scope id must be added to the key.
- **Without Redis:** the revision is `na`, and the cache is bypassed entirely, never shared.

## 8. Semantic cache: decision is **disabled**

- **Risk:** a similar-wording cache can return a different product, size or budget. Exactly that class of error (30 L vs 40 L, a missing code mapped to a neighbour) caused the incidents fixed on 2026-11-16.
- **Little to save:** the primary path is already indexed. In the read-only production probe on 2026-11-16, the full retrieval for "most expensive hand dryer" over 5,103 items took **1.4 s**, including the query embedding. Index queries at 100k rows run in **0.04–0.24 ms** (SCALE-RELIABILITY-DESIGN). The planner LLM call dominates L3 latency, and a semantic cache would not remove it safely.
- **Status:** no semantic cache benchmark was run, because the design rejects it on correctness grounds. Re-evaluate only with a measured L3 p95 problem, and only as candidate hints re-verified through fusion.

## 9. Evidence authority and validation

**`validate_proposal`** is pure and deterministic. It runs on every proposal:

| Check | Accepted only if |
|---|---|
| Codes | In verified facts, unknown-code suggestions, the draft, the conversation, or the instruction |
| Prices | Detected with or without a currency marker:<br>- ₹ / Rs / INR / $ / € / £ / "/-";<br>- price-worded amounts ("costs 999", "total amount will be 3,000");<br>- money-formatted amounts ("1199.00").<br>They must equal a verified price fact, or already be in the employee's draft. Never from the customer's message. ₹0 is always rejected. |
| Emails and phone numbers | Present in facts or the conversation |
| Discount percentages | Present in **verified facts or the employee's draft only**. A customer *asking* for "50% off" never grounds an offered 50% (this hole was found by a unit test and fixed). |
| Placeholders | `XX`, `[Your Name]`… are never accepted |

**Repair loop:**
- If validation fails, one targeted repair call lists the exact issues, then everything is revalidated (`MAX_REPAIRS = 1`).
- If it still fails, the result has `apply_allowed = false` and the panel shows the issues.
- **Validators are never weakened.**

**Fix to the existing pipeline validator:**
- The hard-coded ₹1,000 / ₹2,500 "range bounds" were replaced by the budget figures stated in this package's own requirements.
- The fixture vocabulary was removed from coverage scoring: comparisons now require all target entities to be mentioned.

## 10. API and frontend

`POST /api/v1/copilot/threads/{thread_id}/refine` (permission `inbox.reply`):

```json
// request
{ "instruction": "...", "draft_text": "...", "draft_revision": "r1a-3k2l9", "history": [{"instruction": "...", "applied": false}] }
// response
{ "request_id", "thread_id", "operation", "proposal", "changes_summary", "base_draft_revision", "apply_allowed",
  "facts_used": [...], "unresolved": [...], "issues": [...], "clarification_question", "evidence_status", "metrics": {...} }
```

- **Errors:**
  - 404: a foreign or unknown thread;
  - 429: the per-tenant concurrency limit (4) is reached;
  - 504: the request timed out (150 s);
  - 502: the model or a source failed.

  Every error message says the draft is unchanged.
- **Panel:**
  - **Actions:** cancel (AbortController); Retry re-runs the original instruction; presets.
  - **Display:** operation badge, evidence status, verified facts used, unconfirmed items, validation issues.
  - **Apply:** disabled when `apply_allowed` is false. The success toast appears only after a real Apply.

## 11. Draft revision, apply and undo

- **Revision id:** the client sends `draft_revision = FNV-1a(editor text)`, and the server echoes it as `base_draft_revision`.
- **Apply:** recomputes the revision of the *current* editor text. If it differs (the user typed while the Copilot was working), nothing is replaced. The panel shows "The editor changed…" with **Regenerate from current draft** or **Replace anyway**.
- **Undo:** each Apply pushes the replaced text on an undo stack (10 entries). **Undo** restores it. An injection nonce ensures repeated identical texts are still delivered to the editor.
- **No sending:** the Copilot never sends. The endpoint has no delivery code path, and tests replace `send_draft`, `send_manual_reply` and `deliver_reply` with functions that fail if called.

## 12. Tenant isolation and security

- **Server-side resolution:** the tenant comes only from the authenticated context. The thread is resolved with `WHERE id = :th AND tenant_id = :t`, so another tenant's thread is a 404. All reads (messages, shown items, records, index) filter by tenant. Cache keys start with the tenant.
- **Prompt injection:** customer messages and drafts are fenced as data with an explicit rule. Deterministic validation does not depend on the model obeying it (the discount test covers an injected "IGNORE ALL RULES… 50% discount").
- **Bounded input:** instruction ≤ 2,000 characters, draft ≤ 20,000, history ≤ 8 turns.
- **Logging:** ids, operation, levels, counts, issue codes and timings only. No email content, no keys.

## 13. Performance and complexity

| Step | Time | Space |
|---|---|---|
| Rule decision | O(len(instruction)) regex | O(1) |
| Thread snapshot | 3 indexed queries (thread PK; messages by `(tenant, thread)` ordered, LIMIT 8; shown items LIMIT 12) | O(8 + 12) |
| L1 records | B-tree `code_upper` = ANY: O(k log n); one batch version read | O(k × 30 fields) |
| L2 lookup | Redis GET, average O(1); version re-check O(k log n) | O(cached facts) |
| L3 | Existing pipeline: indexed SQL O(log n + k); HNSW ANN ~O(log n); fusion over a bounded candidate set | Bounded by the retrieval budget |
| Validation | Linear in proposal length plus a hash set of allowed values | O(facts + text) |

**Model calls per instruction:**

| Instruction type | Calls |
|---|---|
| Writing-only | 1 (compose); plus 1 only on a repair |
| Fact requests | 1 decision + 1 planner per L3 request + 1 compose; + ≤1 extra search + ≤1 repair |

**Worst case:** 1 + 3 + 1 + 1 + 1 + 1 = 8 calls (three L3 requests, one extra search, one repair). The typical "add the price of X" with X already in the thread uses **2 calls and no embedding**.

**Measured model-call latency** (2026-11-17, live OpenAI, configured model, 3 runs each; database not involved):

| Call | Runs (s) | Median |
|---|---|---|
| AI #1 decision (fact instruction) | 7.38, 2.73, 4.20 / 6.11, 2.27, 6.57 | ≈ 4–6 s |
| AI #2 compose, writing-only | 3.41, 2.91, 8.81 / 2.74, 2.03, 2.27 | ≈ 2.3–3.4 s |
| AI #2 compose with facts | 3.20, 2.83, 2.38 / 1.81, 7.43, 2.36 | ≈ 2.4–2.8 s |

**Expected end-to-end latency per path:**

| Path | Expected |
|---|---|
| Writing-only (1 call) | ≈ 2–4 s typical, up to ~9 s on a slow call |
| L1 reuse (decision + compose; the database part is milliseconds) | ≈ 5–9 s |
| L3 (adds planner ≈ 2–5 s and retrieval ≈ 1.4 s) | ≈ 9–15 s |

End-to-end p50/p95 with the database are not yet measured (§15).

**Next latency levers (not implemented):**
1. Stream the composer output.
2. A smaller model for the decision call.
3. A deterministic L1 fast path for "add the price/spec of <code in context>", which skips the decision call.

## 14. API usage before and after

- **Before:** 0 calls, but the output was a hard-coded mock (not a functioning feature).
- **Naive design (planner + retrieval + drafter for every instruction):** 2 LLM calls + 1 embedding + Qdrant/PostgreSQL per instruction.
- **This design:**
  - writing-only: **1 LLM call, 0 embeddings, 0 retrieval**;
  - L1 reuse: 2 LLM calls, 0 embeddings, 0 retrieval;
  - L2 hit: 2 LLM calls, 0 embeddings;
  - L3: equal to the naive design plus the decision call.
- **Token counts:** returned per request in `metrics.decision_tokens` / `metrics.compose_tokens`.

## 15. Test results

**Unit tests:** `tests/test_reply_copilot_unit.py`, **34 passed**, covering:
- pure writing instructions take the rules path and run zero retrieval;
- fact instructions go to AI #1; AI #1 output is allowlisted (SQL-like code dropped, max 3 requests);
- number+unit tokens are not treated as codes; attribute coverage matching;
- cache keys separate budget, tenant, thread, conversation revision, catalogue revision and product;
- record facts skip internal fields;
- L1 reuse skips retrieval; a missing attribute falls to L3; a stale cache hit is rejected;
- a valid cache hit is reused; version re-check detects changed and removed items;
- a source error is reported as incomplete, not as no-match;
- the validator accepts verified and draft facts, and rejects unverified prices and codes, invented discounts, contacts and placeholders, and ₹0;
- customer-written and suggested codes are allowed;
- writing-only echoes the revision and cannot smuggle new facts (exactly one repair);
- a successful repair is accepted; AI #2's extra search is bounded to one;
- unresolved information is surfaced; L1-only requests report EVIDENCE_REUSE;
- another tenant's thread is not found (and no model is called);
- CLARIFY returns a question; prompt-injection text is fenced; request size limits hold;
- generation never calls send.

**Regression:**
- `tests/test_reply_planner.py` and `tests/test_evidence_package.py`: 22 passed after the validator fix.
- One test, `test_outbound_delivery_threading_and_idempotency`, failed with a **database connection timeout**. The machine's DNS could not resolve the Neon host (see below); it is not an assertion failure.

**Integration:** `tests/test_reply_copilot_integration.py` runs on the seeded test tenant only, live where an OpenAI key is present. It covers:
- tenant-scoped snapshot;
- L1 current-version re-read and cross-tenant emptiness;
- live writing-only (zero retrieval, zero decision calls);
- live add-price (the verified price appears in the proposal);
- live compose-from-empty (grounded, never applicable with issues).

**Status: written, not yet passed.** On 2026-11-17 the local network (mobile hotspot) could not reach the database at all:
- DNS for the Neon host timed out;
- after resolving the host over DNS-over-HTTPS, a TCP connection to port 5432 also timed out.

The run could not connect. The AI-call benchmark in §13 ran without the database. In that run, AI #1 correctly split "add the prices of both services" into two code-specific requests, and the AI #2 proposal passed validation. Re-run when DNS is healthy:
`REDIS_URL=redis://localhost:6390/0 python -m pytest -s tests/test_reply_copilot_integration.py`
(this needs a local Redis on 6390 and the Qdrant container).

## 16. Remaining limitations

- **Attachments:** the Copilot (like the pipeline) does not read email attachments. A customer saying "PO attached" cannot be checked, so the proposal must not claim to have seen or not seen it. Attachment ingestion is separate work.
- **Revision history:** Copilot sessions and proposals are not persisted server-side; undo is per browser session. A server-side revision history would need a migration (not done).
- **Live operational data:** live stock, order or tracking data is not integrated. Such questions become unresolved items, never answers.
- **Validator coverage:** the validator covers prices, codes, contacts, discounts and placeholders. Free-text specifications ("6 months warranty") are guarded by the composer's rules and fact ids, not yet by a deterministic per-attribute check.
- **Frontend linting:** ESLint could not run locally (a missing module in the ESLint install). TypeScript `tsc --noEmit` passes.
- **Live metrics:** p50/p95 and accuracy on a held-out set are not measured yet.

## 17. Rollout and rollback

- **No migration;** no schema or data changes.
- **Deploy:** pull + restart, as usual.
- **Rollback:** revert the commit. The panel would then show the previous mock, so revert the client and server together.
- **Disable without a deploy:** remove the router include in `app/main.py`; the panel then shows the 404 message and leaves drafts unchanged.
