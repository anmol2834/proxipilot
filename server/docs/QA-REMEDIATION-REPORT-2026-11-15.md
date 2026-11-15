# ProxiPilot — Enterprise QA & Remediation Report

Date: 2026-11-15. This is a code-level and runtime audit of the backend, the workers, the AI/RAG pipeline and the client API layer. Every number below comes from a test or measurement that was actually run. Anything that was **not** executed is listed in section 9.

## 1. Inventory

| Area | What exists |
|---|---|
| HTTP API | **121 operations** under `/api/v1`. By area: knowledge 35, inbox 14, feedback 11, auth 10, organizations 9, integrations 9, practices 6, contacts 6, commitments 5, style 4, conversations 4, onboarding 2, and webhooks, health, ready, metrics, dashboard and context 1 each. |
| Auth model | JWT bearer token or `session_id` cookie. Tenant comes from `get_tenant_context` / `require_permission(key)` or `_resolve_tenant_id`, with membership verified against `organization_members`. RBAC uses Owner, Admin and Member plus custom roles (`rbac_seed.py`). |
| Workers (embedded in the single API process) | email-worker → `email_events`; ai-worker → `ai_processing`; knowledge-import-worker → `knowledge_import_events`; knowledge-indexer → `knowledge-events`. Each stream has **one** consumer group. `automation_events` has a consumer class but it isn't started in production; its only reference is the consumer itself. |
| Event path | Gmail Pub/Sub → webhook (OIDC, Redis + DB dedupe, transactional outbox) → `email_events` → sync / filter / store → `email.context.resolve` → context resolver → AI #1 planner → `ai_processing` → retrieval → fusion → package → AI #2 → policy gate → Gmail delivery. |
| LLM calls per email | AI #1 planner (skipped on the fast path), AI #2 drafter (plus at most one repair), and the commitment-memory extractor (runs on inbound **and** outbound messages, off the reply's critical path). Embeddings: one batched query call per retrieval. |
| Client | Next.js 16. One `ApiClient` (`client/src/lib/api/client.ts`) with timeout and cancellation, error normalisation, and no false success on non-2xx responses. |

## 2. Test environment

- **Backend:** Python 3.14, run locally against the **shared Neon PostgreSQL (the production database)**. Tests use throwaway organisations and are cleaned up afterwards (section 7).
- **Redis:** an **isolated** `redis:alpine` 8.x container on `127.0.0.1:6390`, removed afterwards. The local Windows Redis is 3.0.504: too old for Streams (no `HELLO`).
- **Qdrant:** local Docker. **OpenAI:** real API (gpt-6-luna) for the AI #1 / AI #2 tests.
- **Production observations:** read-only `journalctl` analysis and read-only `SELECT 1` latency probes on EC2.

## 3. Baseline metrics (production, 2026-11-14 → 15)

**Per-stage latency** (from prod logs):

| Stage | n | p50 | p95 | p99 |
|---|---|---|---|---|
| Webhook accept (of which DB commit) | 83 | 774 ms (657) | 1,294 ms (800) | 1,333 ms |
| AI #1 planner | 8 | 3,106 ms | 4,145 ms | 4,145 ms |
| Retrieval router | 13 | 1,752 ms | 3,161 ms | 3,214 ms |
| Context engine | 8 | 864 ms | 989 ms | – |
| AI #2 drafter (LLM) | 10 | 5,237 ms | 7,821 ms | – |
| Reply plan total | 8 | 9,084 ms | 12,745 ms | – |
| Gmail delivery (API 677 ms, DB commit 696 ms) | 4 | 2,671 ms | 4,053 ms | – |

**One real email, end to end:** 22.6 s from Pub/Sub push to the reply being sent.
- Webhook 1.1 s, sync/store 3.7 s, context 1.2 s, AI #1 3.1 s, retrieval 1.5 s, fusion + package 0.9 s, context engine 0.7 s, draft 7.8 s, validate/save 1.0 s, send 2.7 s.
- About **11 s is LLM**; most of the rest is **database round trips**.

**Root cause of the DB cost (measured on EC2):**
- EC2 is in `ap-south-1` and Neon is in `ap-southeast-1`: **65 ms** per round trip.
- A pooled session running one query costs **431 ms with `pool_pre_ping`** and **192 ms without it**, so the pre-ping adds about **240 ms to every session checkout**.
- One email's AI path alone (planner → reply) opens **14 sessions**: retrieval 3, fusion 2, reply planner 9.

## 4. Tests executed and results

**Full suite, per file** (isolated Redis, 420 s per-file timeout; 54 files):
- **400 passed, 7 failed, 1 skipped, 0 errors, 2 files timed out.**
- **The 7 failures** (`test_memory_api_integration` 5, `test_onboarding_authz_api` 2) were caused by **concurrent test sessions purging each other's organisations** (see F-10). Re-run alone: **8/8 and 3/3 pass**.
- **The 2 time-outs** are the 10k benchmarks (section 6).

**Regression re-run after all fixes:** 14 affected suites **105 passed**; outbox + onboarding authorization **7 passed**.

**Static checks:**
- `pyflakes` over `app/`: **no undefined names**. Only pre-existing unused imports remain.
- `mypy` on the changed modules: **no issues**.
- Client `tsc --noEmit` on `src/**`: **0 errors**. Generated `.next/dev/types` files are corrupted; they are dev artefacts that `next dev` regenerates.

**Unauthenticated sweep (all 121 operations, no credentials):**
- **107 return 401.**
- The other 14 are public by design: OAuth start/callbacks, sign-in/sign-up/OTP (422 on an empty body), health/ready, the static category catalogue, the Pub/Sub webhook (401 without OIDC, counted in the 107) and `/metrics` (F-08).

**Secrets:**
- Code: no secret values in logger calls.
- Production logs since 2026-11-14: **0** matches for OAuth/OpenAI tokens, bearer JWTs or OTP values.

**SQL injection review:** every dynamic SQL statement interpolates only generated placeholder names; all values are bound parameters.

## 5. Defects found and fixed

| ID | Sev. | Defect (root cause) | Fix | Regression test (fails before / passes after) |
|---|---|---|---|---|
| F-01 | **High** | **Silent email loss on transient failures.** `ai_worker` caught and logged every pipeline exception, so the stream entry was acknowledged: no retry, no draft. The 300 s per-message locks also blocked any retry. | A failure **before delivery** releases the lock and re-raises, so the existing retry / DLQ path takes over (`workers/ai_worker.py`). Delivery failures are still **not** retried (Gmail may already have accepted the send). | `test_worker_retry_semantics_unit.py` (2 fail before; 3/3 after) |
| F-02 | **High** | **Same loss in the email worker.** `email.context.resolve` held its lock across a failure, so the retry 60 s later was skipped as "already in progress" and then acknowledged. | Release the lock and re-raise on failure (`workers/email_worker.py`). | same file |
| F-03 | **High (latent outage)** | **Streams never shrink.** XADD has no cap and XACK never deletes, so streams grow forever. With Redis capped at 150 MB / noeviction, every XADD eventually fails and the pipeline stops. | Delete each entry **after** a successful ACK; every stream has exactly one group and nothing reads history. The DLQ is capped at about 10k entries (`core/messaging.py`). A backlog is never trimmed. | `test_stream_retention_integration.py` (fails before: 25 entries stay; passes after) |
| F-04 | **Medium (tenant isolation)** | `GET /onboarding/activation-status?organization_id=<other>` returned another tenant's mailbox and knowledge counts to any signed-in user. | Membership is checked (`organization.read`) when an organisation ID is supplied (`services/onboarding.py`). | `test_onboarding_authz_api.py` (2 fail before; 3/3 after) |
| F-05 | **Medium (authz)** | Business-profile and workspace-preference **writes** only required `organization.read`, so any read-only member could overwrite org settings. | They now require `organization.update` (Owner/Admin). Onboarding is unaffected (Owner). | same file |
| F-06 | **Medium (security)** | The fixed developer OTP `123456` was accepted on every non-production environment, **including staging**. | Accepted only in `development` / `test`; fails closed (`services/auth.py: accepts_dev_master_otp`). | `test_auth_master_otp_unit.py` |
| F-07 | **Medium (perf)** | Evidence fusion ran a tenant `GROUP BY` on **every** call: one extra DB session per email (about 0.43 s cross-region). It also made the fusion burst benchmark DB-bound. | Cached per tenant for 60 s and invalidated when an import completes (`evidence_fusion/service.py`, `import_worker.py`). Failures are not cached. | `test_fusion_category_cache_unit.py` |
| F-08 | Low | `/api/v1/metrics` is public. Only Python/process metrics are exposed, no tenant data. | **Not changed** (infra): proposed nginx `allow 127.0.0.1; deny all;` for `/metrics` and `/api/v1/metrics`. | – |
| F-09 | Low (QA safety) | The root `conftest.py` loaded `.env` with `override=True`, so tests could never be pointed at isolated infrastructure: they were always forced onto `.env` (the exhausted Upstash and the production database). | `override=False`: explicit environment variables win, and `.env` fills only unset values. | used throughout this run |
| F-10 | Low (QA safety, **open**) | The session-end safety net purges organisations by **name and time**, not by ownership, so two concurrent test sessions on the shared database delete each other's data. | Documented, not changed. Run test sessions one at a time until fixtures tag a run ID. | – |
| P-01 | **Medium (perf)** | `pool_pre_ping` costs about 240 ms per checkout over the cross-region link. | New setting `DB_POOL_PRE_PING` (default **true**, so behaviour is unchanged). Setting it to false in production is proposed, not applied. | – |

Fixed earlier this session: `json` NameError on `/feedback/threads/{id}/draft` (34 production 500s on 2026-11-14, already fixed in code), OAuth callback 500 when Redis was down (commit 9db8323), Upstash quota outage (Redis moved to EC2).

## 6. Performance: before and after

| Item | Before | After | Status |
|---|---|---|---|
| Fusion: category query per email | 1 DB session (~430 ms prod) | 0 when cached (≤1 per tenant per minute) | Code done, not deployed |
| Fusion compute per call (profiled) | – | < 1 ms, excluding I/O | Measured locally |
| Session checkout with `DB_POOL_PRE_PING=false` | 431 ms | 192 ms (EC2 measurement) | Setting added; production switch pending approval |
| Estimated saving for the 14 AI-path sessions | – | up to about 3.4 s per email (less where sessions run in parallel) | **Estimate**: verify after deploy with the same log percentiles |
| Fusion 10k burst | timed out (> 420 s) | completes in 294 s: 10,000/10,000 outcomes, 0 errors, p50 863 ms | The test's 500/s and p95 < 50 ms targets are **not met**. 5,000 items have no envelope, so each re-reads the message body from the database, 0.4–1.4 s per read over the dev PC link. The test was not weakened. |
| Retrieval router 10k burst | times out | – | **Stale test**: its mocks predate the router's own DB sessions, and its fake vector search lacks the `exclude_entity_ids` argument. Needs test maintenance. |

**Webhook intake is DB-bound.** About 620 ms per commit on a 50-connection pool allows roughly 80 events per second. A real 10k-in-1-s burst would be admitted over minutes; Pub/Sub redelivery and dedupe keep it lossless. This was **not** load-tested, because it would write 10k rows into the production database.

## 7. Cleanup verification

- **Test organisations:** 22 were left by a test run I stopped (fixture names, created 08:46–09:14 UTC today, no non-test members). All were purged with the project's tenant-scoped `purge_tenant`. Afterwards: 0 of those IDs, 0 of their knowledge items, 0 of their Qdrant points.
- **Remaining:** the 3 real organisations (Dolphy India ×2, Dolohy), untouched. 0 `usr_itest_` users.
- **Local Qdrant:** only the real Dolphy organisation's 5,103 points remain, untouched.
- **QA Redis container:** removed. Local Redis databases 13–15 are empty. Temporary test files are removed.
- **Not touched:** production Redis, production Qdrant, real emails and Dolphy data.

## 8. Remaining risks (not fixed)

1. **Cross-region database (largest latency source).** EC2 Mumbai ↔ Neon Singapore costs 65 ms per round trip and dominates non-LLM time. Moving Neon to `aws-ap-south-1`, or EC2 to Singapore, would remove most of it. That's an infra decision.
2. **Tests run against the production database.** Fixtures are isolated by organisation, but a separate Neon branch for tests is strongly advised.
3. **Delivery double-send window.** If Gmail accepts a send and the following DB commit fails, a retry could send again. It is currently avoided only because delivery is never retried. A durable "sent" marker written right after the Gmail call would close it.
4. **Membership cache.** `_resolve_tenant_id` caches a positive membership for 10 min, so a removed member keeps integration-route access for up to 10 min.
5. **Manual knowledge edits** don't clear the 60 s category cache, the 10-min taxonomy cache or the 15-min vocabulary cache; imports do.
6. **Commitment-memory LLM call** on every inbound and outbound message: cost, not latency.
7. **Two stale burst benchmarks** (section 6).
8. **`automation_events`** has no running consumer.

## 9. Not executed (honest scope)

- **Browser end-to-end UI tests:** not run. Client checks were the type check and an API-client review.
- **The 100 customer-query scenarios:** not run against Dolphy data, per your instruction. The generalised selection and semantic-gap behaviours are covered on the synthetic fixture tenant.
- **A real 10k webhook burst against production:** not run (it would write to the production database).
- **No production deploy**, no production `.env` change and no nginx change during this audit. All proposed changes need approval.

## 10. Rollback

- **Code:** revert the audit commit. All changes are additive or local, with no schema migration.
- **Pool:** `DB_POOL_PRE_PING=true`, or remove the line, then restart `proxipilot-api`.
- **Stream deletion:** reverting `core/messaging.py` restores the old behaviour. Entries already deleted were fully processed.
- **Authorization tightening:** revert `services/onboarding.py`. No data changes.
