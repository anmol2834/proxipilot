# Organization Architecture & Enterprise Multi-Tenancy

## 1. Overview & Core Philosophy

ProxiPilot establishes a strict multi-tenant boundary rooted at the **Organization** entity.

```text
User (usr_...)
  ↓
Organization Membership (mem_...) [status: ACTIVE | INVITED | SUSPENDED | REMOVED]
  ↓
Organization (org_...) [status: ACTIVE | SUSPENDED | ARCHIVED]
```

### Critical Architectural Rule: Decoupled User Identity
- **Never** add `user.organization_id` as the primary tenant link.
- Users are global cross-organizational identities.
- A user can belong to Organization A (as `OWNER`), Organization B (as `MEMBER`), and Organization C (as `ADMIN`).
- All tenant-scoped resources (`knowledge_items`, `connected_integration_accounts`, `email_threads`, `email_messages`) link directly to `organization_id`.

---

## 2. Organization Domain Model

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | VARCHAR(64) | Primary key, prefixed with `org_` followed by UUID hex. |
| `name` | VARCHAR(255) | Organization legal / company name. |
| `slug` | VARCHAR(100) | Unique URL-safe identifier generated server-side with collision resolution. |
| `website` | VARCHAR(2048) | Primary website URL or domain (normalized with scheme). |
| `industry` | VARCHAR(255) | Industry categorization from onboarding step 2. |
| `company_size` | VARCHAR(64) | Company size bracket (e.g. `11-50 employees`). |
| `status` | VARCHAR(32) | Controlled lifecycle: `ACTIVE`, `SUSPENDED`, `ARCHIVED`. |
| `plan_tier` | VARCHAR(32) | Subscription tier: `free`, `starter`, `professional`, `enterprise`. |
| `is_active` | BOOLEAN | Operational toggle for instant account locking. |
| `created_by` | VARCHAR(64) | Foreign key to `users.id` identifying the creator. |
| `created_at` | TIMESTAMP TZ | ISO 8601 creation timestamp. |
| `updated_at` | TIMESTAMP TZ | ISO 8601 update timestamp. |

---

## 3. Atomic Organization Creation Flow

When a user creates an organization via `POST /api/v1/organizations`:
1. **Request Validation**: Verify required fields (`name`, `website`).
2. **Transaction Begin**:
   - Generate unique slug with collision suffix (`-2`, `-3`).
   - Insert `organizations` record (`status=ACTIVE`, `created_by=user_id`).
   - Resolve `OWNER` system role from `roles` table.
   - Insert `organization_members` record linking user to the new org with `role_id=owner_role.id` and `status=ACTIVE`.
   - Initialize/advance `organization_onboarding_states` record (`organization_complete=True`).
3. **Transaction Commit**: Guarantees zero orphan organizations. If any sub-operation fails, the entire transaction is rolled back.
4. **Audit Log**: Emit structured audit log (`actor_user_id`, `organization_id`, `action=organization.created`).
5. **Context Return**: Returns safe public organization details, membership info, and granted permissions.

---

## 4. Lifecycle & Safety

- **Suspended Organizations**: If `organization.status != 'ACTIVE'` or `is_active == False`, all authenticated requests resolving this organization are rejected with `403 Forbidden`.
- **Update Safety**: `PATCH /api/v1/organizations/{id}` allows updating only `name`, `website`, `industry`, and `company_size`. Mass assignment of billing plan, status, or owner is strictly prohibited.
