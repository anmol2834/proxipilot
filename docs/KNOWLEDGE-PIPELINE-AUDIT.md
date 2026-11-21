# Knowledge pipeline audit — upload → storage → index → retrieval → reply

Date: 2026-11-21. Scope: every stage a business's spreadsheet passes through until the email AI uses
it, plus the knowledge UI. Method: read the code path end to end, ran read-only checks on the live
production tenant (Dolphy India, 5,103 products), and verified fixes with tests on a local database.

## 1. How the pipeline works (as implemented)

| Stage | Code | What it does |
|---|---|---|
| Upload | `knowledge_imports` route → `knowledge_upload` | Streams CSV/XLS/XLSX (≤10 MB) to storage, creates an `import_job`; Company Info is refused (it has its own editor). |
| Parse | `import_worker` (PARSING) | Streaming profiler: header detection, per-column type/sample statistics. |
| Map columns | `column_mapping_service` (SCHEMA_DETECTION) | Deterministic, no LLM: saved tenant profile → exact canonical field → category alias → tenant custom attribute → ambiguous-word guard → token similarity. **Anything unmatched is kept as a custom attribute** (no data loss); only image/media columns are ignored. |
| Validate | `row_quality_service`, `data_quality_pipeline` (VALIDATING) | Type coercion (prices as exact decimals, dates, units), required fields per category, in-file duplicate/conflict detection. |
| Identity | `algorithms/deduplication/category_identity` | One deterministic key per real-world record: explicit ID (SKU / code / record_id / id) first; otherwise a per-category business key (product name + variant attributes, policy name + region, question text, …). |
| Persist | `knowledge_persistence` (IMPORTING, 500-row batches) | Look up existing items by identity → INSERT new, new VERSION for changed, UNCHANGED for identical (no write). One transaction per batch; DB unique index `uq_knowledge_items_tenant_cat_identity (tenant, category, identity)`. |
| Project | `knowledge_projection` (inline) | Builds the searchable text and section chunks for each version (category-aware labels so "price", "warranty", custom attributes are all searchable). |
| Index | `knowledge_reconciliation` + `knowledge_sync` | Embeds chunks (OpenAI), upserts to Qdrant with deterministic point ids `uuid5(tenant:version:chunk:model)`, then deletes every vector not of the current version (generation-safe). Keyword index `knowledge_search_index` is updated per item. 60 s sweep retries anything pending. |
| Retrieve | `requirement_planner` (AI #1) → `retrieval_router` → `evidence_fusion` → `evidence_package` | AI #1 turns the email into typed requirements (strict JSON schema). Router runs structured (exact PostgreSQL), lexical (keyword index) and semantic (Qdrant) retrieval per requirement and fuses them (RRF); a verifier drops anything not current; fusion turns candidates into labelled facts. |
| Reply | `reply_planner` (AI #2 drafter → validator → policy gate) | Draft from packaged facts only (strict JSON schema with claims → fact ids), deterministic validation, one bounded repair, then a policy gate decides send vs human review. |

## 2. Production verification (read-only, Dolphy India)

* Import job: 5,104 rows, 5,104 processed, 0 failed / invalid / conflicts; 5,103 inserted + **1 row merged
  as an in-file duplicate** (same identity as an earlier row).
* Every item has a current ACTIVE version with text; all 5,104 `synced`; keyword index 5,104 rows.
* Qdrant: 5,106 points (5,103 products + 3 Company Info sections). **0 items missing vectors, 0 vectors
  of an old version, 0 orphan vectors.** No two products share identical content.
* 163 product titles repeat — all are real variants with **different SKUs and different content**
  (e.g. "Premium Luggage Cart" DLTY0031…0058). Not duplicates.
* Random product lookups by meaning returned the exact item in the top 5, all from current data.

## 3. Findings and what was done

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | High | **"Delete" did not delete.** The UI said "permanently delete", the API soft-archived: rows, identity keys and history stayed. | Fixed: DELETE is permanent (versions/chunks cascade; vectors and keyword row purged by the post-commit sync). |
| 2 | High | **Re-importing a soft-deleted/archived item broke the import.** The matcher found the item, saw no ACTIVE version, numbered the new one "2", collided with the existing v2 → the whole 500-row batch rolled back; unchanged rows stayed invisible. | Fixed: matched inactive items are reactivated and numbering continues from the real max version. Regression test added. |
| 3 | High | **"Edit" was fake.** The edit dialog only changed the browser's copy; nothing reached the database, search or AI (changes vanished on reload). | Removed (see 5). |
| 4 | Medium | **"Duplicate" created real duplicates** (a copy with no identity key) that the AI could retrieve twice. | Removed (see 5). |
| 5 | — | Requested: remove edit / duplicate / archive logic. | Done. UI: row actions → a single Delete; bulk bar → Delete only, with a confirmation step; edit dialog deleted. API: `PATCH /knowledge/{id}`, `POST /{id}/publish`, `POST /{id}/rollback` removed with their service logic. Version history stays read-only. Knowledge changes by re-importing (updates in place by identity). |
| 6 | Medium | **Manual create bypassed identity**, so the same product could exist twice (manual + import). | Fixed: manual create computes the same identity key as an import; an existing record returns 409; a later import updates it instead of duplicating. |
| 7 | Medium | Manual create stored a product's `code` as `discount_code` (offers field) for every category, so products had no SKU. | Fixed: `code` maps by category (SKU for products, discount code for offers). |
| 8 | Low | Bulk delete fired without confirmation and swallowed failures silently. | Fixed: confirm step + success/failure toasts. |
| 9 | Low | Two LLM prompts used one business's products as examples ("paper dispenser", "grab bars"), biasing the model toward that business. | Fixed: neutral placeholders. No business vocabulary exists in shared logic. |
| 10 | Medium | Records with no identifying field were keyed by **row number** (reordering would update the wrong item). Imports already require each category's key field (product name, policy name, question, …), but manual create and unknown categories could still reach this fallback. | Fixed: identity never depends on position. Such records get a **content fingerprint** (hash of all values, serial-number columns excluded); identical rows merge; the row is flagged `MISSING_IDENTIFIER` so the business can add a key column. |
| 11 | Medium | Generic / custom categories used **only the first field value** as identity, so different records sharing it overwrote each other. | Fixed: whole-content fingerprint unless an explicit id exists. |
| 12 | Medium | In-file duplicate detection compared **serial-number columns**, so a repeated row with a new S.No was treated as a conflict and dropped as INVALID instead of merged. | Fixed: positional columns never create a conflict. |
| 13 | Medium | Serial-number columns (S.No, Sr No, #, Index …) were **stored as knowledge**: they polluted the AI's search text ("s_no: 4") and made every re-ordered re-upload re-version and re-embed unchanged records. | Fixed: column mapping ignores positional columns (`POSITIONAL_IGNORED`), conservatively — "Item No", "Model No", "Part No", "Number" stay data; re-import comparison ignores positional values left by older imports. Production data has none. |

## 4. Duplicate-free guarantee (after fixes)

* **Database:** one item per (tenant, category, identity) enforced by a unique index; imports
  update in place; manual create refuses an existing identity; no copy/duplicate action exists.
* **Within one file:** repeated rows are merged (counted as duplicates), never stored twice.
* **Qdrant:** point ids are deterministic per (tenant, version, chunk, model) — re-indexing overwrites;
  after each sync every vector not of the current version is deleted; delete purges all of an item's vectors.

## 5. Any business, any spreadsheet

* Column mapping has no per-business code: canonical fields and aliases are per **category**
  (products, policies, FAQs, offers, processes, company info); anything else becomes a tenant
  custom attribute, is projected into the searchable text with its own label, and is retrievable.
* Saved schema profiles make the second upload of the same layout map identically.
* Multi-tenancy: every query, index and vector is filtered by tenant; identity keys include the
  tenant; tests verify a second tenant cannot read or delete another tenant's items.

## 6. Retrieval for direct and indirect questions

AI #1 normalises paraphrases, Hinglish and mixed requests into requirements and adds translated
search concepts; retrieval combines exact PostgreSQL lookup (codes, names, attributes), keyword search
and semantic search, fused by rank. Measured: exact lookup ~12–15 ms, semantic ~0.4 s, full retrieval
per email 0.4–0.7 s; the LLM planner (~4 s) dominates. The labelled Company Info eval scores 10/10.

## 7. Hallucination: what is guaranteed and what is not

Guaranteed by code (not by prompting):
* Both AIs return strict JSON schemas; AI #2 must map every factual claim to a packaged fact id.
* The validator rejects prices that differ from packaged facts, product codes not in the evidence,
  placeholder text, "not in our catalogue" claims without proof, unconfirmed bookings, invented
  policy terms or contact details; one repair attempt, then the policy gate sends to human review.
* Retrieval only ever returns the tenant's current, approved data.

Not guaranteeable: no language model can be proven to be correct 100% of the time on free text.
The system's guarantee is therefore **"a reply that cannot be verified is not sent automatically"**,
not "the model never errs". Wording that is not a checkable fact (tone, phrasing) is not verified.

## 8. Tests

`test_identity_fingerprint.py` (new, 27 cases: position-independent identity for every category,
serial columns ignored, code-like columns kept, duplicates vs conflicts, missing-identifier flag,
reordered re-upload → 0 new items / 0 new versions),
`test_knowledge_storage_audit.py` (new: inactive item re-import → reactivated v3, no collision),
`test_memory_api_integration.py` (create → duplicate refused 409 → edit/rollback gone 405 → tenant
isolation → viewer 403 → delete purges vectors → re-create works), `test_company_info.py`
(managed record cannot be deleted or duplicated), plus the full server suite.
