# Conversation intelligence & follow-ups

AI #2 reassesses every new business message (inbound customer mail and mail the team actually sent)
and ProxiPilot turns that into an effective follow-up decision: temperature, outcome, who owes the
next step, when, team reminders and — only where a teammate explicitly allowed it — a gated customer
email. The model decides *meaning*; application code validates, does the calendar math, applies
overrides/permissions and executes side effects.

## 1. Architecture map

| Workflow | Entry point | First DB write | Queue publication | Provider call |
| --- | --- | --- | --- | --- |
| Gmail ingestion (inbound business / outbound from mailbox) | `services/gmail_sync.py::_normalize_and_store` | `email_messages` insert, then in the **same transaction** `followups/triggers.on_message_stored` → fence upsert on `thread_followup_states` + `outbox_events(followup.assess)` (SAVEPOINT, never blocks ingestion) | `OutboxService.dispatch_fast_path` after commit; `outbox_relay_forever` (new, 10 s, ≤ 6 h old rows) as the durable fallback | none |
| ProxiPilot sends (AI draft, manual reply, follow-up email) | `reply_planner/delivery.py` (main path + `_deliver_in_thread`), `delivery_reconciler._finalise_sent` | outbound `email_messages` insert + same-transaction trigger | same | Gmail (existing dispatcher) |
| Assessment (AI #2) | `workers/followup_worker.FollowupWorker` (stream `followup_events`) → `followups/service.process_assessment` | `message_assessments`: the thread keeps only its latest assessment (older rows are replaced; superseded messages store nothing) | — | OpenAI (`create_with_retry`, strict JSON schema), **no transaction open** |
| Apply decision | `followups/engine.apply_assessment` (one short transaction) | `thread_followup_states` (row-locked, revision fence), `contact_suppressions`, `followup_occurrences`, `email_threads.lead_intent` | — | none |
| Scheduler | `followups/scheduler.FollowupScheduler` (embedded loop, 60 s) | lease on `followup_occurrences` (`FOR UPDATE SKIP LOCKED`) | — | — |
| Team notices | `followups/notify.deliver` | one `followup_notice_deliveries` row per occurrence/notice type/address | — | transactional email (`send_email`), per recipient |
| Customer follow-up email | `scheduler._customer_send` → `gate.evaluate` → `composer.compose` → `gate.evaluate` again → `_deliver_in_thread(idem_key="fu_<occurrence>")` | `outbound_messages` (SEND_ATTEMPTED before the call) | — | Gmail |
| Resend after verified failure | `delivery_reconciler._resend_blocker` → `gate.evaluate(for_resend=True)` for `fu_` keys | — | — | Gmail only if the gate passes |

Modules: `services/followups/{flags,contracts,timing,assessor,engine,gate,composer,notify,scheduler,triggers,service}.py`,
API `api/v1/routes/followups.py`, worker `workers/followup_worker.py`, models `models/followup.py`,
migration `e3f4a5b6c7d8_followup_intelligence.py`. UI: `components/inbox/FollowUpPanel.tsx`,
`components/followups/{FollowUpPanel,FollowUpSheetControl,ScheduleDialog}.tsx`, `components/settings/FollowupSettings.tsx`, `hooks/useFollowups.ts`.

### Invariants enforced in code
* **Latest assessment only.** One stored assessment per conversation (plus at most one in-flight row);
  the panel reads one assessment and the current plan, never a history list. AI #2 reasons at
  `medium` effort over the conversation, must cite message ids for any action-driving decision (else
  `needs_review`) and must quote a customer-given date verbatim (else it is held for review).
* **Revision fence.** Each new message bumps `revision` and marks the state stale *in the ingestion
  transaction*. Only the newest message's assessment can change effective state; a late or
  reverse-order result is stored with `not_applied_reason` (`superseded_by_newer_message`,
  `older_than_current_decision`). Occurrences carry the revision they were planned under; the
  gate rejects any mismatch.
* **Three separate controls** (thread overrides inherit the workspace policy): assessment,
  planning + team reminders, customer email. Customer email is `false` for every thread (never
  backfilled), can be enabled only by a member with `inbox.send`, only for a verified participant
  who wrote in the thread, never by the AI, never by a temperature.
* **Do-not-contact.** Evidenced refusals create a tenant-scoped `contact_suppressions` row
  (`all` / `email` / `until`, partial-unique while active). It overrides labels, schedules, retries
  and other threads for the same recipient in the same tenant. `email` still allows internal tasks.
  Lifting needs `settings.update` and is audited.
* **Timing priority:** explicit user schedule → customer date accepted by AI #2 → AI window → tenant
  cadence (Hot/Warm/Cold = 1/3/7 business days) only when the decision warrants follow-up. A neutral
  message never resets a still-valid customer date or user schedule. A customer "not before" date
  moves contact after it; a manual time earlier than it is surfaced as a conflict and external
  contact is held.
* **Time:** due and team-notice are separate instants; DST gaps shift forward, folds take the first
  occurrence; unknown/ambiguous zones and numeric dates such as 03/04 hold exact external contact and
  go to review with the alternatives; customer-promised weekend dates are never silently moved.
* **Team notices:** individual emails to every ACTIVE member (re-checked right before each send),
  deduplicated by address; log mode is `logged`, never `accepted`; definite rejection is `failed`
  (retried ≤ 3, only that member); connection-level uncertainty is `unknown` (not retried).
  Roles without `inbox.read` get a generic notice.
* **Customer send gate** (fresh reads at the boundary): kill switch, due & scheduled, state not stale,
  revision match, AI decision `schedule`/`defer`, no review flag, consent + recipient, permitting user
  still has `inbox.send`, recipient is a verified participant **and** the exact address the threaded
  reply goes to (never reply-all, never inferred), no suppression (any participant), workspace
  active, Gmail mailbox healthy with automation enabled, no newer message, attempts left, min
  spacing, send window. Composed text must be grounded (every number / email / link already in the
  thread). One idempotency key per occurrence across retries.
* **No launch burst:** only mail ≤ 48 h old triggers; the relay replays only ≤ 6 h old pending rows;
  due notices > 7 days late are skipped; cadence never lands in the past.

## 2. Worked decision timeline (frozen clock, production code path)

Tenant zone Asia/Kolkata, Mon–Fri, notice 1 business day at 10:00, customer email OFF.

| Step | Source | Result |
| --- | --- | --- |
| T1 Tue 1 Dec 06:00Z | `msg_fu_83585edb39ce4a16883c` “We intend to book the workshop on 15 December 2026 … 3 PM IST.” | fence → revision 1; `asm_d2f1263873d4499490e09b23e2dcf9ab` hot / schedule / applied → revision 2; occurrence `fuo_193e08e5…` origin `customer_date`, due **2026-12-15 09:30Z** (15:00 IST), notice **2026-12-14 04:30Z** (Mon 10:00 IST), customer `not_applicable` |
| T2 Thu 3 Dec 06:00Z | `msg_fu_51f0986c96a942ab9936` “Jan 8 at the same time instead.” | fence → revision 3; `asm_9faae87c…` applied (changed_date) → revision 4; `fuo_193e08e5…` **superseded**; new `fuo_5e038f4e…` due **2027-01-08 09:30Z**, notice **2027-01-07 04:30Z** |
| T3 Mon 14 Dec 04:30Z | scheduler | 0 notices (December work superseded) |
| T4 Thu 7 Jan 04:30Z | scheduler | 4 individual advance notices (owner, admin, member + generic one for the no-inbox role); removed / invited / suspended excluded |
| T5 Fri 8 Jan 09:30Z | scheduler | 4 due notices stating the customer has **not** been emailed; 0 Gmail calls; occurrence `done`; `attempts_used` = 1 |

## 3a. Workspace controls (dashboard)

Settings → Follow-ups & reminders (owners/admins, `settings.update`):

* **Automation mode** — *Observe only* (default for every workspace: AI #2 assesses and records, nothing
  is scheduled, reminded or sent) or *Active*. Stored in `followup_policies.mode` (migration
  `0f1a2b3c4d5e`). In an active workspace a conversation whose latest assessment was only recorded can
  be applied from its panel ("Apply"), never retroactively in bulk.
* **Allow automatic customer emails** — workspace allowance (`customer_email_allowed`, default off). A
  member with send permission must still enable it per conversation and recipient (consent dialog).
* Timing, working days, send hours, advance notice, limits and time zone.

The UI surfaces: the Follow-up button in the conversation toolbar (opens the panel as a sheet under
the toolbar), the guided date/time scheduler, inbox list badges and the inbox Follow-up filter.
`FOLLOWUP_SHADOW_MODE=true` on the server still forces observe-only for every workspace, and
`FOLLOWUP_CUSTOMER_SEND_ENABLED` remains the platform kill switch.

## 3. Rollout, startup, rollback

Flags (process env, `services/followups/flags.py`):

| Flag | Default | Effect |
| --- | --- | --- |
| `FOLLOWUP_ASSESSMENT_ENABLED` | true | AI #2 assessment of new messages |
| `FOLLOWUP_SHADOW_MODE` | false | store assessments only; never change state or act |
| `FOLLOWUP_REMINDERS_ENABLED` | true | team notice delivery (off = notices skipped, no backlog burst later) |
| `FOLLOWUP_CUSTOMER_SEND_ENABLED` | **false** | kill switch for proactive customer email **and** its resends; reconciliation of already-attempted sends continues |
| `FOLLOWUP_SCHEDULER_TICK_SECONDS` | 60 | 0 disables the embedded scheduler |

Recommended rollout: deploy with `FOLLOWUP_SHADOW_MODE=true` → review assessments → shadow off
(reminders on, customer send off) → enable `FOLLOWUP_CUSTOMER_SEND_ENABLED` only after reviewing
held/eligible occurrences.

Startup: embedded in the API process (`app/main.py`: FollowupWorker, scheduler, outbox relay).
Standalone: `python -m app.workers.cli --worker followup|followup_scheduler|outbox_relay`
(compose profile `standalone-followups`). Migration: `alembic upgrade head` (`e3f4a5b6c7d8`, additive).

Rollback without schema change: set the flags above (shadow on / reminders off / customer send off).
Schema rollback: `alembic downgrade d2e3f4a5b6c7` drops the seven follow-up tables (follow-up data
is lost; messages, threads and `lead_intent` are untouched — verified with data). Note that
`f4a5b6c7d8e9` (permanent deletion work) is chained after this revision and is rolled back first.

## 4. Verification results

Reliability (deterministic, frozen clocks, provider spies, real Postgres 16):
* `tests/test_followup_timing_unit.py` + `tests/test_followup_contract_unit.py`: 52 passed.
* `tests/test_followup_integration.py`: 27 passed — the 8 scenarios, reverse-order results,
  model failure → stale + retry, refusal between claim and send (0 provider calls), kill switch /
  revocation / mailbox flag at send **and** reconciler resend, crash before/after provider
  acceptance, uncertain send not retried, partial team failure retries only that member, membership
  removal mid fan-out, leases, disabled assessment, shadow mode, no historical burst, manual and
  legacy labels, API RBAC / versions / participant validation / tenant isolation, status classification.
* Full regression (all unit suites + reconciler, inbox-thread, permanent-deletion integration):
  547 passed, 0 failed.
* Migration: base → head, `downgrade d2e3f4a5b6c7` with data, `upgrade head` again.
* Isolated end-to-end run (own Postgres/Redis): relay published committed-but-unpublished events,
  the embedded worker consumed them; UI panel, controls and Settings verified in a browser.

Semantic accuracy (live model, reported separately, `python -m tests.evals.followup_live_eval`):
47 / 47 annotated checks on 14 synthetic conversations (8 spec scenarios + 5 unseen businesses;
English and Hinglish; refusals, deferral, email-only, short replies, changed and ambiguous dates).
This is a small fixture set, not a statistically powered held-out benchmark.

## 5. Limitations / not yet verified
* Automatic customer email is Gmail-only (capability is reported to the UI; other providers keep
  reminders only).
* No order/subscription integration: completion comes from credible customer confirmation, AI #2
  reading the conversation, or a user marking completed.
* Live-model accuracy is measured on 47 checks only; expand the annotated set before relying on it
  for broad claims. Prompt version `followup-assess-v1` is stored with every assessment.
* SMTP acceptance after a connection drop is unknowable; such notices are recorded `unknown`.
* Pre-existing schema drift (not from this change): `connected_integration_accounts.automation_enabled`,
  `outbound_messages.{reply_plan_id,evidence_package_id,presented_entity_ids}` and
  `thread_presented_entities` exist in the models/production but in no migration `upgrade()`.
* `migrations/env.py` currently forces `ssl=require` and no longer strips Neon's `-pooler` host
  (uncommitted change from the concurrent deletion work) — review before running migrations in
  production.
