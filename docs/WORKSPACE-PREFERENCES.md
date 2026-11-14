# Workspace Preferences Architecture

## 1. Ownership Principle: User vs. Organization

When defining operational preferences, the governing rule is:
> *"Would this value be different for two users inside the same organization?"*

### Decision & Categorization
1. **Organization-Level Preferences (`workspace_preferences` table)**:
   - `timezone`: Primary business operating timezone for organization-wide SLA deadlines, business operating hours, scheduled campaigns, and automated dispatch schedules.
   - `response_style`: Company-wide default communication tone (`Professional`, `Friendly`, `Concise`, `Executive`) representing the brand in automated email generation.
   - `language`: Primary language for organizational customer communications.

2. **User-Level Preferences (`user_preferences` future expansion)**:
   - Personal UI theme (Dark/Light mode).
   - Notification channel preferences (Browser push vs. email digests).
   - Personal calendar integration links.

## 2. Tenancy & Data Model

Table: `workspace_preferences`
- `id` (VARCHAR(36), PK): UUIDv7 / ULID.
- `organization_id` (VARCHAR(36), FK, UNIQUE): Tenant scope (`REFERENCES organizations(id)`).
- `timezone` (VARCHAR(64)): Default `"Asia/Kolkata (GMT +5:30)"` or standard IANA name.
- `response_style` (VARCHAR(64)): Default `"Professional"`.
- `language` (VARCHAR(32)): Default `"English"`.
- `created_at` / `updated_at`: Timestamps.

## 3. Transactional Integrity & Completion

- Step 4 of Onboarding updates `workspace_preferences` transactionally:
  1. Validate payload (`timezone`, `response_style`, `language`).
  2. Upsert record for `organization_id`.
  3. Commit transaction.
  4. Invalidate Redis cache key `tenant:{organization_id}:config:workspace_preferences`.
  5. Mark onboarding complete in server-derived state (`is_complete = True`).
