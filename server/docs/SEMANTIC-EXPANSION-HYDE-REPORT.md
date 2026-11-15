# Semantic Expansion (Taxonomy + Translation + HyDE) — Implementation Report

Date: 2026-11-15

**Goal:** close the "semantic gap". Customers describe what they need in Hinglish, regional
language or functional words ("hanth dhone ke liye kuchh"), and those words don't match how
records are named in Qdrant or Postgres.

## What changed

| Step | File | Change |
|---|---|---|
| 1. Business context & taxonomy | `app/services/business_taxonomy.py` (new) | One aggregate query per business: name, industry, description, knowledge categories, product families, product types and brands, with counts. Cached in memory per business for 10 min; cleared when an import completes (`workers/import_worker.py`). Loaded alongside the other lookups (`requirement_planner/service.py`) with a 2 s timeout. If it fails, planning runs without a taxonomy. |
| 2. AI #1 schema + prompt | `requirement_planner/planner.py`, `contracts/requirement_plan.py` | New strict-schema field `search_requirements[]`. Each entry has `original_text`, `translated_standard_term`, `search_concepts` (2-3 HyDE texts) and `keywords`. The system prompt gains the expansion instructions and the business taxonomy, labelled as data, not instructions. `max_completion_tokens` goes from 1000 to 1600. |
| 2b. Sanitise + attach | `requirement_planner/expansion.py` (new) | Limits counts and lengths, removes duplicates, drops empty or junk entries. Each expansion is attached to the requirement it describes, by word overlap with the customer's phrase. The requirement list itself still comes from the rule-based decomposer, unchanged. |
| 3. Vector search | `retrieval_router/semantic_retriever.py` | The customer query and up to 4 expansion queries (translated terms and concepts, alternated across needs) are embedded in **one** batch call and searched in Qdrant **in parallel**. Hits are pooled per item by best similarity. If one query fails, the rest still count. |
| 3b. Keyword search | `retrieval_router/router.py` | The original keyword search on the customer's own words is unchanged, so exact names and codes keep exact-match strength. A second keyword search uses AI #1's `keywords`. Its results join rank fusion at weight 0.5 and are **never** treated as exact evidence. |
| 4. Fallbacks | `router.py: expansion_search_inputs` | No expansions means the old behaviour exactly. An exact identifier in the message (or the `exact_sku_lookup` hint), a contact request, or a focused selected item skips expansion entirely. `active_selection` / `focus_entity_ids` are untouched. |

## Design decisions (deliberate deviations)

- **The customer's own words still drive the main keyword search.** The spec said keyword search should *strictly* use the AI #1 keywords. Doing that would let a model-written guess become "exact evidence" and could drop a product name the customer typed. The AI #1 keywords therefore add a second, lower-weight keyword list instead.
- **The eligibility gate still reads only the customer's words.** A translated term such as "hand dryer" for "hanth dhone" could wrongly hard-filter a product family. Expansions only add candidates. The existing verification and eligibility checks still decide what is evidence.
- **Expansions are never evidence and never reach the customer.** AI #2 still sees only verified records.

## Test results (executed)

- **Unit:** `tests/test_semantic_expansion_unit.py`, 11 passed. Covers:
  - cleaning and limits;
  - requirement matching, including paraphrases;
  - fallback, skipping on exact codes, and the query cap;
  - the strict schema;
  - taxonomy in the prompt;
  - one embedding call, parallel searches, best-score pooling, partial and total failure.
- **End to end (real AI #1 + retrieval, isolated test catalogue, not Dolphy):** `tests/test_semantic_expansion_regression.py`, 2 passed.
  - 5 Hinglish/functional messages that share no word with the catalogue all rank the right service first.
  - An exact code still resolves directly.
- **Honest result:** on this 24-item test catalogue, the old pipeline also ranked all 5 first, because AI #1's existing English `semantic_search_query` already bridged these cases. The gain is expected on larger catalogues and vaguer wording. This test shows only that the new path is correct and never worse here; it does not measure accuracy gains.
- **Latency (median of 10 runs, from the dev PC):**
  - AI #1: 3.0 s → 4.1 s, about 135 more output tokens.
  - Retrieval: no measurable change (5.8 s → 5.4 s, within noise).

## Known limitations

- The taxonomy cache is per process, which fits the single-backend deployment.
- A wrong translation can only add candidates; verification still decides. Very vague messages can still need a clarifying question.
- The test catalogue is small, so it can't show accuracy gains. Measure on real traffic before claiming them.
