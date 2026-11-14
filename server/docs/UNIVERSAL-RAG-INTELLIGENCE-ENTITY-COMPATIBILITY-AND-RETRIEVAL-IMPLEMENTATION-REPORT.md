# Universal RAG Intelligence — Entity Eligibility, Compatibility & Retrieval Report

Date: 2026-11-13 · Scope: knowledge retrieval for customer email replies (all tenants)

## 1. Executive summary

A customer asked to **buy air curtains for a 4-foot door**. ProxiPilot replied with three
**hand-dryer spare parts** (bodies / motor covers / filters for models `DAHD0012`, `DAHD0042`,
`DAHD0057`). The uploaded catalogue contains 22 complete Air Curtain products.

The failure was reproduced read-only on the real tenant data and traced to four defects in the
shared pipeline (none related to that specific catalogue). All four are fixed in code, with a
new business-agnostic **eligibility layer** that compares *what a candidate is* (role, family,
compatibility, specs) with *what the customer asked for* before any ranking happens.

Measured on the real 5,103-product catalogue (118 queries, read-only):

| metric (5 results per query) | before | after |
|---|---|---|
| precision@5 (role-correct **and** in requested family) | 0.646 | **0.919** |
| top-1 correct | 0.678 | **0.907** |
| hit@5 | 0.873 | **0.958** |
| wrong-role items returned (parts/accessories/raw material for a product request, or vice versa) | 168 / 590 | **0 / 558** |

The real air-curtain email now returns five complete Air Curtain products (1200–1220 mm) with
exact catalogue prices and an explicit size caveat for each ("nominal 1200 mm is close to the
requested 1219.2 mm — please confirm clearance").

**No existing database row or Qdrant point was modified.** All inspection was read-only; all
tests use in-memory fixtures or isolated, purged test tenants.

## 2. Root-cause analysis (proven on the real email)

Trace of `msg_60c0b425…` through every stage (`scratchpad/trace_air_curtain.py`, read-only,
no persistence, no events):

| # | Defect | Where | Evidence |
|---|---|---|---|
| RC1 | **Email split line-by-line into requirements.** Greeting, soft-wrapped sentence halves, "Regards" and the sender's name each became a `product_discovery` requirement (6 requirements). Newsletters produced 150+. | `requirement_planner/decomposer.py` `_split_into_requirement_segments` (split on every newline, default category = products) | Plan: `req_1 'Hello there'`, `req_5 'Regards'`, `req_6 'Rishiraj Sinha'` |
| RC2 | **Unfiltered category listing treated as authoritative.** With >1 requirement the router's structured branch fetched 5 arbitrary `products_services` rows with no filter and no relevance order. Unlike the single-requirement path it was not marked "generic browse", so it was never demoted. | `retrieval_router/router.py` multi-requirement structured branch | The 5 results were exactly the first rows of that listing: the DAHD parts |
| RC3 | **Scoring let any structured row beat any relevant match.** `composite = (100 if path is structured else 50) + … + semantic*10` — a +50 head start that relevance (max +10) could never overcome. | `retrieval_router/verifier.py` | Semantic branch alone returned 8/8 real Air Curtains (cosine 0.56–0.60) — all buried |
| RC4 | **No eligibility check at all.** Nothing compared a candidate's role (finished good vs spare part vs raw material) or product family with the request. Correct `entity_type` values already existed in the data (PART 2,796 · PRODUCT 2,029 · RAW_MATERIAL 273 · SERVICE 1) but retrieval never used them. | entire retrieval path | DAHD parts carry `entity_type: PART`, category "Spare Parts" |

Secondary defects found while tracing:
* **Comparison hallucination** — the LLM planner flagged "suggest suitable models" as a
  *comparison* and the validator accepted **every** entity as a comparison target, including
  the door measurement and the customer's own name; evidence fusion then dropped every product
  not matching those "targets" (5 → 1). (`requirement_planner/validator.py`)
* **Fact rendering** — the drafter printed every fact as `Price: <value>` regardless of its
  attribute. (`reply_planner/drafter.py`)
* **Deadline overrun crashed retrieval** — a branch cancelled at the 25 s deadline left the
  shared session's transaction invalid; verification then raised `PendingRollbackError`
  (and, with a rollback, `MissingGreenlet` because loaded rows were expired).
  (`retrieval_router/router.py`)

Disproved hypothesis: "all products classified as SERVICE". In this dataset typing at
ingestion is correct (`row_quality_service.infer_products_services_entity_type`); only the one
genuine "Service Item" is SERVICE.

## 3. What changed (files and rationale)

| File | Change |
|---|---|
| `app/services/units.py` *(new)* | Typed quantity normalisation: length (mm/cm/m/in/ft), data size, power, weight, volume; `W x H x D` groups with *unit-assumed* flag; original text + conversion basis kept; ambiguous tokens ("5 in stock") rejected. `LengthFit.note` produces a customer-safe caveat that never claims a guaranteed fit. |
| `app/services/retrieval_router/entity_eligibility.py` *(new)* | Role taxonomy (`FINISHED_GOOD, SERVICE, SPARE_PART, ACCESSORY, RAW_MATERIAL, PACKAGING, CONSUMABLE, UNKNOWN`) classified from the record's own fields with provenance + confidence (source category role words → product type → entity type → explicit "suitable for model X" relation). Family = role-stripped source category. `TenantVocabulary` = the tenant's own families (one aggregate query, per-tenant cache, invalidated when an import completes). `build_request_spec` resolves wanted roles, families (token containment against the tenant vocabulary), compatibility targets ("parts for model X"), lengths (soft) and minimum specs (hard). `evaluate` returns eligible / unmet / satisfied / customer-safe notes / fit bonus. **No business vocabulary.** |
| `app/services/retrieval_router/verifier.py` | Eligibility gate applied **before** ranking (ineligible ⇒ never returned). New scoring: origin prior (exact identifier 100 · constrained 60 · lexical 45 · family/semantic 40 · *generic listing 0*) + relevance×40 + family/role/fit bonuses. Parent-model codes are no longer treated as requested SKUs. Role, family and match notes attached to each evidence item. |
| `app/services/retrieval_router/router.py` | Builds the spec once per plan; tags every structured candidate with its origin; unfiltered listings are "generic" in **both** single- and multi-requirement paths and are dropped when query-driven branches found anything; progressive retrieval fetches all members of a resolved family (and records naming a target model) from PostgreSQL (bounded 150); wider semantic/lexical pools (4× result count, ≥20); deadline overrun verifies on a fresh session. |
| `app/services/retrieval_router/structured_retriever.py` | `fetch_family_candidates`: tenant-scoped, parameterised word-prefix match on title + source category, bounded. |
| `app/services/retrieval_router/lexical_retriever.py` | (earlier this week) searches title + product category/type/brand; facet-only matches weighted 0.6. |
| `app/services/requirement_planner/decomposer.py` | Drops greetings, sign-off and everything after it, quoted mail; re-joins soft-wrapped lines; merges plain product-discovery segments into **one** requirement while keeping distinct asks (warranty, delivery, offers, contacts, policies, support) separate. |
| `app/services/requirement_planner/validator.py` | Comparison accepted only for comparison intent / explicit comparison wording / top-N; targets limited to offering-identifying entities (never measurements, people, places). |
| `app/services/evidence_fusion/normalizer.py` | Eligibility notes become `fit_note` facts. |
| `app/services/evidence_package/selector.py` | `fit_note` facts always travel with their items. |
| `app/services/reply_planner/drafter.py` | Facts rendered with their real labels; rule 21: convey fit notes, never upgrade to a guarantee, never offer parts/accessories unless asked. |
| `app/workers/import_worker.py` | Invalidates the tenant vocabulary when an import completes. |
| `tests/test_entity_eligibility_unit.py` *(new, 21 tests)* | Regression scenarios A/B/C/D, role classification incl. inconsistent source rows, units, decomposer, tenant isolation, unknown-intent gating. |
| `tests/test_requirement_planner.py` | Embedding-dimension assertion follows `EMBEDDING_DIMENSION` (was hard-coded 1024/1536). |

## 4. Data / entity semantics

Kept separate (never flattened into one `category`):
* tenant (`organization_id`, enforced in SQL and Qdrant filters),
* platform knowledge category (`products_services`, …),
* source/business category (`custom_attributes.category`, e.g. "Air Curtain"),
* product family (role-stripped source category, e.g. "Air Curtain Raw Material" → "Air Curtain"),
* product role (derived, with provenance: `source_category | product_type | entity_type | title_relation`),
* entity type (ingestion-time `entity_type`, unchanged),
* brand, identifiers (SKU / model), explicit relations (`suitable for model X` → compatibility target).

Conflicting source rows are handled explicitly: e.g. "Single Door Air Curtain Sensor" has
Category *Spare Parts* but Product Type *Finish Goods* → role SPARE_PART (category role words
take precedence, provenance `source_category`).

## 5. Retrieval algorithm (per requirement)

1. Plan → `RequestSpec` (wanted roles, tenant-vocabulary families, target models, length, min specs, exact ids).
2. Parallel branches (bounded): structured (exact ids / constrained listing / **family fetch**), semantic (Qdrant, tenant-filtered), lexical (title + facets, IDF).
3. Origins tagged; unranked generic listing removed when relevant matches exist.
4. Rehydrate every candidate from PostgreSQL (authoritative facts, temporal validity, tenant assertion).
5. **Hard gates**: price range, requested SKU, temporal status, **role, family, compatibility, minimum specs**.
6. Rank eligible candidates: origin prior + relevance + family/role/fit bonuses + authority.
7. Evidence items carry role, family and customer-safe notes → `fit_note` facts → drafter.

Hard vs soft: role, family (when resolved from the tenant vocabulary), compatibility and
minimum capacity specs are **hard**; length fit is **soft** (ranking + mandatory caveat); a
missing spec is eligible but explicitly *unverified* (never presented as meeting the requirement).

Functional requests ("a device that can dry my wet hands") deliberately resolve **no** family
from keywords; the semantic branch finds the family and the role gate removes parts. No static
keyword→family rules exist.

## 6. Multi-intent planning

The decomposer now produces one product requirement per email plus one requirement per
genuinely different ask. Example (test `test_multi_intent_email_keeps_every_independent_requirement`):
laptop request + warranty + delivery + offers + retailer contact + return policy → 6
requirements in the right categories; greeting, signature and quoted mail removed.

## 7. Security and tenant isolation

* Tenant scope comes only from the server-side plan; every new SQL query filters `tenant_id`
  with bound parameters; tokens are regex-escaped bound parameters (no dynamic SQL from model output).
* Vocabulary cache is keyed per tenant (test `test_vocabulary_cache_is_tenant_scoped`).
* Rehydration keeps the existing cross-tenant assertion; eligibility runs after it.
* Customer email text is never used to change tenant, filters or policy — only to build the
  spec, which can only *narrow* results.

## 8. Tests and genuine results

```
pytest tests/test_entity_eligibility_unit.py tests/test_evidence_fusion.py \
  tests/test_evidence_package.py tests/test_hybrid_retrieval.py tests/test_lexical_retrieval_unit.py \
  tests/test_qdrant_hybrid_cases.py tests/test_requirement_planner.py tests/test_retrieval_router.py \
  tests/test_reply_planner.py tests/test_zero_price_unit.py tests/test_catalogue_counts_unit.py \
  tests/test_context_engine_unit.py
-> 116 passed in 240.51s
```

### 8.1 End-to-end regressions on the real catalogue (read-only, nothing sent or saved)

| Scenario | Result |
|---|---|
| A — real air-curtain email | 5 complete Air Curtains (DACN0002/0008/0013/0011/0020, 1200–1220 mm), exact prices, per-item size caveat; 0 hand-dryer items |
| B — "a device that can dry my wet hands" | complete hand dryers + washroom dryer panels; 0 parts/filters/motors |
| D — "spare parts for model DAHD0012" | the one compatible part in the catalogue ("Body Suitable For Model DAHD0012", ₹1,150); the hand dryer itself excluded |
| C — laptop "under ₹50,000, 16GB RAM" (synthetic fixture) | 8 GB rejected, 16 GB accepted, RAM-not-stated accepted only as *unverified*, battery part rejected |

### 8.2 Accuracy evaluation (`scratchpad/eval_retrieval.py`, read-only)

* Dataset: real tenant catalogue, 5,103 items; 118 queries:
  30 families × 3 phrasings (direct / purchase / price-list), 12 "spare parts for <family>",
  16 hand-written functional queries that never name the product.
* Ground truth from the data: correct = role-correct **and** member of the requested family
  (role-stripped category or title). Same router, eligibility off vs on.

| kind | n | precision@5 off→on | top-1 off→on | wrong-role items off→on |
|---|---|---|---|---|
| direct | 30 | 0.667 → 0.960 | 0.733 → 0.933 | 44 → 0 |
| purchase | 30 | 0.653 → 0.973 | 0.600 → 0.967 | 51 → 0 |
| price list | 30 | 0.680 → 0.960 | 0.700 → 0.933 | 42 → 0 |
| parts | 12 | 0.650 → 0.700 | 0.750 → 0.750 | 10 → 0 |
| functional | 16 | 0.525 → 0.825 | 0.625 → 0.812 | 21 → 0 |
| **all** | **118** | **0.646 → 0.919** | **0.678 → 0.907** | **168 → 0** |

Top-1 misses after the change (11), analysed honestly:
* 6 come from brand-named source categories ("Dolphy Mirror", "Dolphy India Product") whose
  family is the brand itself — weak ground truth; the returned items are reasonable.
* 3 "parts for <family>" queries returned items that ARE that family's parts but named by
  model code, which the judge's family check does not see.
* 2 functional queries ("electric kettle for guest rooms", "small fridge for a hotel room")
  were won by lexical matches on "guest room"/"hotel room" (an intercom, a housekeeping
  trolley). Root cause: raw lexical IDF scores and cosine scores are on different scales;
  rank-based fusion (RRF) would fix it — see limitations.

### 8.3 Latency (same evaluation, 3 concurrent queries, home network to Neon/Upstash/OpenAI)

| | p50 | p95 | p99 |
|---|---|---|---|
| eligibility off | 4.7 s | 11.9 s | 17.4 s |
| eligibility on | 7.5 s | 18.3 s | 24.2 s |

Database-side execution of the new queries is milliseconds (lexical regex query: 8.6 ms
`EXPLAIN ANALYZE`); wall time is dominated by network round trips (150–700 ms each over the
current link). The family fetch adds 2 round trips and the vocabulary load ~1 query per tenant
per 15 min. These numbers are **not** a server benchmark and no sub-second claim is made.
Scale tests at 10k / 100k records were **not** run in this change.

## 9. Database-change statement

No `UPDATE`, `DELETE`, `INSERT`, migration, re-index, Qdrant point change or re-import was
executed against existing knowledge data for this work. All database access was read-only
SELECTs (audit, trace, evaluation). No schema change was needed: role and family are derived
at retrieval time from existing fields, so they apply to the current upload immediately.

## 10. Manual re-upload

Not required for the fixes above (they read existing fields). Re-uploading the workbook is
recommended only to refresh search text produced before earlier projection fixes (e.g. the
"price on request" wording for ₹0 rows). Re-uploading the same file updates items in place.

## 11. Remaining limitations and rollback

Not done in this change (honest list):
* Retailer / distributor price-tier selection by authorised commercial role (Scenario F) —
  tiers are stored distinctly but the reply uses the base price.
* Conflict scenario H beyond existing SKU/version handling.
* Rank-based fusion (RRF) of lexical and semantic lists (the 2 functional misses above).
* Explicit relation storage (`COMPATIBLE_WITH` edges) — relations are extracted from text at
  retrieval time, not persisted.
* Scale benchmarks at 10k/100k records and a 10-requirement end-to-end latency benchmark.

Rollback: revert the files in section 3. `entity_eligibility` is only consulted when the spec
is active; removing the `eligibility_spec` argument in `router.py` restores the previous
behaviour (minus the RC1–RC3 fixes, which should be kept).

## 12. Addendum (2026-11-13) — rank fusion and resilience

Re-upload of `dolphy_product.xlsx` (7 columns, same 5,104 products) audited read-only:
5,104 rows -> 5,103 products, every row/field matches, 66 zero-price rows rendered
"price on request", Qdrant 5,103 vectors = DB, 512-d, no orphans.

### Changes
| File | Change |
|---|---|
| `app/services/retrieval_router/rank_fusion.py` *(new)* | Reciprocal Rank Fusion (k=60) of the dense and lexical rankings. Cosine (~0.45–0.65) and lexical IDF (0–1) scores are no longer compared directly. |
| `router.py` / `verifier.py` | Verifier ranks on fused relevance (exact identifiers keep full relevance); lexical origin prior equalised with semantic (40). Verification retries transient DB errors (dropped connection) on a fresh session (max 2 retries). |
| `embedding_providers.py` | Retry log records exception type, attempt duration and input count (transport errors had empty messages). |
| `tests/test_rank_fusion_unit.py` *(new, 4 tests)* | Agreement beats a single-list winner; normalisation; duplicates; ordering. |

### Measured (same 118-query evaluation, real catalogue, read-only)
| | eligibility only | + rank fusion |
|---|---|---|
| precision@5 | 0.915 | **0.929** |
| top-1 | 0.907 | **0.932** |
| hit@5 | 0.949 | 0.949 |
| functional top-1 | 0.812 | **0.875** |
| wrong-role items | 0 / 558 | 0 / 558 |

Latency (3 concurrent, home network): p50 3.6 s, p95 6.5 s.
Tests: 106 passed across the affected suites.

Remaining top-1 misses (8): 3 queries naming the brand-category "Dolphy India Product" (ambiguous
by construction), 3 "spare parts for <family>" where the returned part is correct but named by
model code, "a small fridge for a hotel room" (catalogue calls these "Mini Bar"; a hotel-room
dustbin outranks them), and "keep insects out of a shop entrance" (PVC insect strips — arguably
also correct).

## 13. Addendum (2026-11-13) — partly-blind keyword search

**Failures.**

- "a small fridge for a hotel room" returned a hotel-room dustbin. The catalogue never
  uses the word "fridge" (it says "Mini Bar").
- "keep dust and insects out of a shop entrance" pulled in outdoor dustbins.

**Root causes.** All three are generic; none is specific to this catalogue.

1. Lexical scores were normalised over catalogue-known words only. When the unknown word
   was the asked-for thing, the keyword list ranked items on the leftover words ("hotel
   room") and could claim a *strong* match.
2. RRF rewarded "agreement": an item in the semantic list's tail plus near the top of the
   keyword list beat the semantic #1. With k=60, any keyword weight above about 0.19 makes
   this possible.
3. The verifier promoted such items to `hybrid` (prior 60 vs 40), counting the same false
   agreement twice.
4. Plain words were prefix-matched: "dust" matched "dustbin" and "out" matched "outdoor".

**Changes.**

- **`lexical_retriever.py`:**
  - `LexicalHit.query_coverage` is the share of query words this catalogue contains.
  - Alphabetic tokens match only the whole word, a plural ending (`s`/`es`), or letters that
    continue straight into a model number ("DAHD" → "DAHD0080").
  - Tokens containing digits keep the open prefix.
- **`rank_fusion.py`:** optional per-list `weights`; the result is still normalised to 0..1.
- **`router.py`:**
  - When `query_coverage < 1`, the keyword list's fusion weight is `BLIND_LEXICAL_WEIGHT = 0.05`.
    At that weight it only breaks ties within the semantic ranking.
  - A strong keyword match counts as exact evidence only if coverage is 1, or the semantic
    branch independently found the same item. Exact identifiers are unchanged.
- **`verifier.py`:** a second sighting from a blind keyword list no longer upgrades the path to `hybrid`.

**Results** (same 118-query read-only eval, real catalogue):

| metric | before | after |
|---|---|---|
| precision@5 | 0.931 | **0.939** |
| top-1 | 0.932 | **0.941** |
| hit@5 | 0.949 | **0.966** |
| functional top-1 / hit@5 | 0.875 / 0.875 | **0.938 / 1.000** |
| parts precision@5 | 0.750 | 0.733 (one result slot out of 59) |
| wrong-role items | 0 / 558 | 0 / 558 |

**Regressions checked:** "grab bar for disabled people" (unknown words "disabled" and "people")
and "electric kettle for guest rooms" both still return the correct family at every top-5 slot.
Keyword search latency is unchanged (about 450–500 ms in A/B runs on the same connection).

**Tests:** `test_lexical_retrieval_unit.py` covers the no-prefix words. `test_rank_fusion_unit.py`
covers weights, normalisation, and a blind keyword list being unable to overturn the semantic leader.
