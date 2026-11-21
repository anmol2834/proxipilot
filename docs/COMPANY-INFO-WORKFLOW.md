# Company Info — registration → knowledge → Qdrant → email evidence

Status: implemented 2026-11-20. This document records the verified design (written before the
code changes) and is kept current with the implementation.

## 1. Verified entry points (live code, 2026-11-20)

| Concern | Entry point | Commits? |
| --- | --- | --- |
| Signup step 2 (organization) | `POST /organizations` → `organization_service.create_organization` (name, website, industry, company_size) | yes, itself |
| Signup step 3 (business) | `POST/PATCH /organizations/{id}/business-profile` → `onboarding_service.save_business_profile` (description, industry_served, products_services, customer_type, additional_context) | yes, itself |
| Signup step 4 (workspace) | `.../preferences` → `save_workspace_preferences` (timezone, language, style) | yes, itself |
| Later organization edits | `PATCH /organizations/{id}` → `update_organization` (name, website, industry, company_size) | yes, itself |
| Generic knowledge writes | `knowledge_crud.{create,update,archive,delete,publish_version,rollback}` → commit → `_finalize_change` → `knowledge_sync.sync_after_commit` | yes |
| File imports | `POST /knowledge/imports/upload` → `knowledge_upload.handle_upload` → import worker | yes |
| Durable sync | inline `sync_after_commit` (20 s) → `knowledge-events` retry event → `sweep_pending` every 60 s for ACTIVE versions not `synced` after 90 s (app/main.py) | — |
| Read gate | every retrieval path re-hydrates candidates through `CanonicalKnowledgeReader.get_current_items_batch` (current ACTIVE, temporally valid) and drops Qdrant passages of other versions (`retrieval_router/verifier.py`) | — |
| Email evidence | `retrieval_router` → `evidence_fusion` (normalizer → matcher → verifier) → `evidence_package.selector` → reply drafter | — |

No dashboard Settings screen edits organization or business-profile fields today (verified by
search); signup is their only editor.

## 2. Problems found before the change

1. **Evidence bottleneck.** The drafter receives only facts the normalizer extracts (price, warranty,
   SLA, contact fields) plus ONE semantic passage cut to 200 characters. Company Info hours,
   branches, coverage, languages — and Processes & Timelines facts — mostly never reached the model.
2. **Stale sync can delete a newer generation.** `sync_item` loads version v1, a newer save publishes
   v2 and syncs it, then the slow v1 job runs `delete_item_vectors_except_version(v1)` and removes v2.
3. **Single-question Company Info mail had no evidence group** ("introduce your company" fell into the
   product fallback group whose roles exclude company records).
4. Registration facts never became knowledge; Company Info could only be typed or CSV-imported, with
   no link to the organization/business-profile values.

## 3. Field ownership (one authoritative PostgreSQL value per fact)

| Fact (canonical key) | Authoritative owner | Notes |
| --- | --- | --- |
| `company_name` | `organizations.name`, overridden by `company_info_profiles.facts.public_name` when set | workspace name may be internal → public name |
| `website` | `organizations.website` | |
| `industry` | `organizations.industry` | the company's own industry |
| `description` | `business_profiles.description` | public introduction when shared |
| `industries_served` | `business_profiles.industry_served` | sectors served, distinct from `industry` |
| `offerings_summary` | `business_profiles.products_services` | overview only; specifics live in Products & Services |
| `customer_types` | `business_profiles.customer_type` (comma list) | |
| everything else (legal name, founded year, contact routes, branches, hours, time zone, walk-in / appointment policy, coverage, service modes, languages, enquiry links, not-applicable markers) | `company_info_profiles.facts` | Company-Info-owned |
| share flags for the shared facts above | `company_info_profiles.share` | default: shared (registration asks for public business facts) |
| suggestions only | `workspace_preferences.timezone/language` | shown as "suggested", never published until saved |

Never projected: `company_size`, `additional_context` (internal notes), users/members, connected
mailbox addresses, billing/security data, credentials, arbitrary custom fields.

## 4. Convergence and indexing

* `company_info_service.refresh(db, tenant)` rebuilds the **public document** from the owners above
  (allowlist + share flags), and if its content hash changed, writes a new ACTIVE version of the
  single managed knowledge item (`category=company_info`, `external_identity_key='company_profile'`),
  archiving the previous version — all **inside the caller's transaction** (no remote I/O).
* Called by: organization create/update, business-profile save, the Company Info editor save, and
  the backfill. Signup therefore never waits on embeddings/Qdrant.
* After commit: a background `sync_after_commit` publishes vectors; the existing durable path
  (retry event + 60 s sweep of `semantic_status != synced`) closes crash windows.
* `sync_item` is generation-safe: the version it indexes was just verified as current (fast-path
  check or authoritative read), and it re-reads `current_version_id` right before deleting
  "everything except current", so a delayed job keeps the newer generation. Archive/delete purge
  without a full read, then one cheap check re-indexes the item if it was restored meanwhile.
* The managed item is read-only for the generic knowledge CRUD (update / publish / rollback / archive /
  delete return 409) and Company Info is rejected by file import and generic create, so no competing
  write path can reintroduce a stale value.
* Concurrency: `company_info_profiles.revision` (row lock + expected revision) → 409 with current state.

## 5. Projection

Deterministic sections, each carrying the company identity and fact label: overview, offerings,
audience, each contact route, each branch, hours & visit rules, coverage, languages, enquiry links,
company facts. Company Info is section-chunked (never collapsed) and chunk ids are version-scoped.
The embedding cache key is content-based (tenant + text hash + model, no version id), so when
`EMBEDDING_CACHE_ENABLED=true` a one-field edit embeds only the changed section.

## 6. Evidence

* Company Info and Processes & Timelines candidates yield labelled facts (`company_*`, `contact_*`,
  `branch_*`, `process_*`) so the drafter receives the actual approved values.
* Contact routes keep their purpose ("Billing: billing@…"); branches keep their name.
* A single Company Info question gets its own evidence group (not the product fallback).

## 7. Success measures

1. Registration facts appear in Company Info immediately after signup (no Qdrant dependency).
2. Editor saves persist to the owning table and show on every surface that reads it.
3. Qdrant converges to the current revision; a delayed job never deletes newer vectors.
4. Email evidence contains the right tenant's current approved facts only — measured on a labelled
   fixture set (routing and retrieval errors recorded separately), plus latency measurements for
   save, commit→index-ready, and exact/semantic retrieval.

## 8. Editor and API

* `GET /api/v1/knowledge/company-info` (knowledge.read) — revision, permissions, shared facts with
  owner + share flag, Company-Info facts, suggestions (time zone / languages from workspace
  settings), `ai_can_share` (the exact projected sections), index state, legacy item count.
* `PUT /api/v1/knowledge/company-info` — partial, revision-checked. Facts/share need
  knowledge.update; shared facts (name, website, industry, description, offerings, industries,
  customer types) need organization.update and are written to their owner. 409 = stale revision
  (the client keeps the draft and offers "Reapply my edits on the latest"); 422 = invalid value.
* Index state comes from the saved version: **Saved · Indexing** (pending < 2 min),
  **Ready for AI** (synced), **Indexing delayed** (pending ≥ 2 min; retry/sweep still running).
  Replies read PostgreSQL directly, so they are correct before indexing finishes.
* Dashboard → Knowledge → Company Info renders the editor. "Add company info" (toolbar, picker card,
  any `openAddDialog("company-info")`) opens the editor; file import is refused in the UI and API.
  The managed record is hidden from the generic table; older manual rows stay listed below it.

## 9. Results (local throwaway Postgres + local Qdrant + OpenAI embeddings, 2026-11-21)

| Measure | p50 | p95 |
|---|---|---|
| Save (service path of the PUT) | 62–72 ms | 84–124 ms |
| — of which public-document build + new version | 21–27 ms | 30–46 ms |
| Commit → index ready (inline sync, 7 sections) | 0.43–0.59 s | 0.55–0.86 s |
| Exact PostgreSQL reference lookup | 12–15 ms | 20–34 ms |
| Semantic lookup (embed query + Qdrant) | 0.37–0.41 s | 0.43–0.51 s |

* Embedding texts per one-field edit: **7** with the cache off (production setting today, one API
  request), **1** with `EMBEDDING_CACHE_ENABLED=true`.
* First PUT after a cold API start took 2.46 s (warm-up); steady state as above.
* Labelled email eval (`python -m tests.evals.company_info_email_eval`): 10/10 — paraphrase,
  Hinglish, mixed intent (company + warranty + product), branch ambiguity, billing contact route,
  revoked-before-reindex, other-tenant isolation; 0 routing errors, 0 retrieval errors, 0
  disclosure/stale. Planner (LLM) p50 ≈ 3.7–4.2 s dominates; retrieval p50 0.4–0.6 s.
* Tests: `tests/test_company_info.py` (contract, projection, ownership, 409/403/422, competing
  write paths, import refusal, tenant scoping, backfill, delayed-sync generation guard, real-Qdrant
  end-to-end, list exclusion, cache key) plus the sync unit tests; full server suite 827 passed.
  The one failure (`test_novelty_continuation_pipeline`) comes from hand-made schema drift on the
  throwaway DB (`thread_presented_entities` FK), not from this change.

## 10. Deploy, backfill, rollback

1. Deploy code, then `.venv/bin/python -m alembic upgrade head` (adds `company_info_profiles`,
   revision `2c3d4e5f6a7b`; additive, no data rewrite).
2. Backfill existing workspaces (idempotent, bounded, never touches manual Company Info rows):
   ```python
   from app.core.database import db_manager
   from app.services import company_info
   await company_info.backfill(db_manager.session_factory, dry_run=True)    # report only
   await company_info.backfill(db_manager.session_factory, dry_run=False)   # create managed items
   ```
   The report lists workspaces that also have older manual Company Info rows (`with_legacy_items`)
   for the owner to review; nothing is merged or deleted automatically.
3. Rollback: revert the code, then `alembic downgrade 1b2c3d4e5f6a` (drops `company_info_profiles`).
   The managed knowledge items stay as ordinary Company Info rows (readable, editable via generic
   CRUD again) until removed by the owner.

## 11. Not verified

* Production backfill output and real-tenant eval (needs deploy; Dolphy must not be touched by tests).
* Behaviour with real customer mail beyond the labelled fixtures; the planner is an external LLM.
* Mobile layout of the editor below ~600 px was not checked in the browser.
