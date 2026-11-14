# Membership Architecture & Lifecycle

## 1. Overview

Membership acts as the join entity connecting a global `User` to a tenant `Organization`, carrying the assigned `Role` and current lifecycle `Status`.

```text
users (id)
  ▲
  │ (FK user_id)
organization_members (id, organization_id, user_id, role_id, status)
  │ (FK organization_id)
  ▼
organizations (id)
```

---

## 2. Model Specification (`organization_members`)

| Column | Type | Constraints / Invariants |
| :--- | :--- | :--- |
| `id` | VARCHAR(64) | Primary key, prefixed with `mem_`. |
| `organization_id` | VARCHAR(64) | Foreign key to `organizations.id` (CASCADE). |
| `user_id` | VARCHAR(64) | Foreign key to `users.id` (CASCADE). |
| `role_id` | VARCHAR(64) | Foreign key to `roles.id` (RESTRICT). |
| `status` | VARCHAR(32) | `ACTIVE`, `INVITED`, `SUSPENDED`, `REMOVED`. |
| `invited_by_user_id` | VARCHAR(64) | Nullable tracking of inviter. |
| `created_at` | TIMESTAMP TZ | Membership creation timestamp. |
| `updated_at` | TIMESTAMP TZ | Membership last updated timestamp. |

### Database Constraints:
- **`uq_org_user_membership`**: `UNIQUE(organization_id, user_id)` — A user can have at most one membership record in any given organization.
- **`ix_org_member_lookup`**: Composite index on `(user_id, organization_id, status)` for sub-millisecond authorization and tenant resolution.

---

## 3. Membership Lifecycle Statuses

```text
[INVITED] ────> [ACTIVE] ────> [SUSPENDED]
                   │                │
                   ▼                ▼
               [REMOVED] <──────────┘
```

1. **`ACTIVE`**: Fully authorized. Can authenticate, switch to this organization, and exercise granted permissions.
2. **`INVITED`**: Pending invitation acceptance. Cannot access tenant resources or data until accepted.
3. **`SUSPENDED`**: Temporarily barred by administrator or security policy. All access rejected with `403 Forbidden`.
4. **`REMOVED`**: Soft-deleted/archived membership. Retained for audit and historical event attribution.

---

## 4. Multi-Organization Support & Switching

Because users do not store an `organization_id` on their account record:
- A user querying `GET /api/v1/organizations` receives all organizations where `status == 'ACTIVE'`.
- Organization switching is accomplished by passing `X-Organization-Id` in API requests.
- The server independently validates membership before granting access to that tenant's context.
