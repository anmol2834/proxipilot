# Settings store — defaults provisioned at registration

Status (2026-11-21): storage, defaults, provisioning and a generic API. **The behaviour behind each
setting is not implemented yet** — each one is wired in separately, when its business logic is
specified. The Settings page UI still uses local state; connecting it to this API is a later step.

## Design

| Piece | Where | Role |
|---|---|---|
| Registry | `server/app/contracts/settings_registry.py` | The only place a setting is defined: key, scope, type, allowed values, default, edit permission |
| Tables | `user_settings`, `workspace_settings` (migration `3d4e5f6a7b8c`) | One row per (owner, key): `value` (JSONB), `is_customized`, `version`, `updated_by`, timestamps |
| Provisioning | `server/app/models/settings.py` (`before_flush` hook) | Every new `User` / `Organization` gets all default rows **in the same transaction** that creates it — password signup, Google, Microsoft, invites, tests and any future path |
| Reconcile | `settings_store.reconcile_defaults()` (runs at API start-up) | Inserts rows existing owners lack; moves rows still on the default to a changed default; never overwrites a customized value; never deletes |
| Read / write | `settings_store.get_settings / get_value / update_settings` | Effective values (stored if customized and valid, else default); validated, all-or-nothing partial writes; audit records keys only |
| API | `GET/PATCH /api/v1/settings/me`, `GET/PATCH /api/v1/settings/workspace` | Values + definitions for rendering; workspace writes need `organization.update` per key |

Why rows per key (not one JSON blob): a new setting is a new row, not a schema change; each value
has its own `is_customized`/`version`/`updated_by`; writes to different keys never conflict; the
reconcile is two set-based SQL statements per scope.

Why a registry in code (not a database table of definitions): defaults ship with the code that
understands them, are reviewed in pull requests, validated at import (duplicate keys or an invalid
default fail start-up and tests) and need no data migration.

## Adding a setting later

1. Add one `SettingDefinition(...)` to `SETTINGS` in `settings_registry.py`
   (`key` = `area.name`, permanent; choose scope, type, choices/limits, default, `edit_permission`
   for workspace settings). Anything that sends customer email or deletes data defaults to off.
2. Deploy. That's all:
   * users/workspaces created afterwards get it at registration;
   * existing ones get a default row from the start-up reconcile (and read the default even before).
3. Implement the behaviour where it applies, reading `settings_store.get_value(...)`.

Changing a default: edit `default`; the reconcile updates everyone still on the old default.
Retiring a setting: set `deprecated=True` (never delete a shipped key or reuse it).

## Settings in the registry (from the Settings page)

| Tab | User (per person) | Workspace (owners/admins change) |
|---|---|---|
| General | `notifications.mobile_push` (on), `notifications.desktop` (on), `notifications.email` (off) | `automation.auto_send_enabled` (**off**) |
| Preferences | `inbox.density` (comfortable), `inbox.auto_advance` (next_thread), `inbox.keyboard_shortcuts` (on) | `ai.draft_confidence_threshold` (85) |
| Billing | — | `billing.credit_cutoff_enabled` (on), `billing.credit_usage_ceiling` (2500), `billing.credit_cutoff_action` (pause_all), `billing.budget_alert_enabled` (on), `billing.spend_cap_enabled` (on), `billing.spend_cap_amount` (150), `billing.display_currency` (USD) |
| Security | `security.signin_alerts` (on) | `security.session_timeout_minutes` (1440) |
| Data & Privacy | — | `privacy.customer_email_retention` (indefinite), `privacy.ai_draft_retention_days` (30), `privacy.auto_purge_trash_enabled` (**off**), `privacy.auto_delete_inactive_enabled` (off), `privacy.auto_delete_inactive_days` (90) |

Defaults match the current UI except three that would act on their own once implemented: automatic
email dispatch and auto-purge of trash (UI shows on) are **off** until enabled deliberately.

**Not in the registry — they already have one owner:** Follow-ups & AI tab → `followup_policies`;
default response tone, response language, time zone → `workspace_preferences`; company facts →
`company_info_profiles`. Two-factor authentication is authentication state, billing details/payment
methods/invoices are records, deletion-dialog options are action parameters. Controls declared in
the UI but never shown (appearance, UI language, PII masking, break-glass, IP allow-list "coming
soon") are left out until they exist.

## Rollout and rollback

* Deploy order: `alembic upgrade head` (creates the two tables), then restart the API. On start the
  reconcile gives every existing user and workspace its defaults (advisory lock: one instance does
  it; it logs `settings.reconcile_completed` with counts).
* Rollback: revert the code, `alembic downgrade 2c3d4e5f6a7b` (drops both tables). Nothing else
  reads them yet.

## Tests

`server/tests/test_settings_store.py`: registry integrity and strict validation; provisioning for
new users and workspaces in the creating transaction (and nothing after a rolled-back signup);
password signup path; a setting added later reaching new and existing owners; idempotent reconcile;
changed default following through only where nobody chose a value; partial writes, reset, version
bump, 422 on unknown/invalid/forbidden keys, all-or-nothing batches, audit without values; reads
falling back to defaults for missing or invalid rows.
