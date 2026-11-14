# Audit Event Architecture — ProxiPilot

## 1. Executive Summary

ProxiPilot implements a centralized, immutable, security-first audit event system designed for accountability, multi-tenant compliance, operational diagnostics, and incident forensics. Audit events capture who did what to which resource within which organization and when.

Audit events are **domain security records**, not ephemeral application logs.

## 2. Core Principles & Non-Negotiable Invariants

1. **Zero Secret Leaks**: Passwords, hashes, OTP codes, JWT tokens, OAuth tokens, and encryption keys are strictly scrubbed by `sanitize_audit_metadata` before any database persistence.
2. **Strict Multi-Tenant Scoping**: All organization-level actions must include `organization_id`. System actions with no human actor set `actor_user_id = None` and `actor_type = "SYSTEM"`.
3. **Transactional Integrity**: Critical domain state changes write their audit record in the same database transaction, ensuring no silent write failures or ghost state transitions.
4. **Immutability**: Audit events are write-once records with indexed compound query paths: `(organization_id, created_at)` and `(resource_type, resource_id)`.

## 3. Data Schema

| Field | Type | Description |
|---|---|---|
| `id` | `VARCHAR(64)` | Unique ID prefix: `aud_` |
| `organization_id` | `VARCHAR(64)` | Owning tenant ID (Nullable for global user actions) |
| `actor_user_id` | `VARCHAR(64)` | Authenticated user ID (Nullable for SYSTEM actors) |
| `actor_type` | `VARCHAR(32)` | Enum: `USER`, `SYSTEM`, `API_KEY` |
| `action` | `VARCHAR(64)` | Canonical enum action key |
| `resource_type` | `VARCHAR(64)` | Target entity type (`organization`, `user`, etc.) |
| `resource_id` | `VARCHAR(64)` | Target entity ID |
| `metadata_` | `JSON` | Sanitized key-value context |
| `ip_address` | `VARCHAR(45)` | Client IP (supports IPv4 and IPv6) |
| `user_agent` | `VARCHAR(500)` | Client browser / device user agent |
| `created_at` | `TIMESTAMPTZ` | Immutable creation timestamp |

## 4. Canonical Action Taxonomy

- `USER_SIGNED_IN`: Successful authentication session creation.
- `USER_SIGNED_OUT`: Explicit session revocation.
- `EMAIL_VERIFIED`: Email OTP challenge completed.
- `ORGANIZATION_CREATED`: New tenant created with initial OWNER.
- `ORGANIZATION_UPDATED`: Tenant profile or settings modified.
- `MEMBERSHIP_CREATED`: User joined or invited to organization.
- `ROLE_CHANGED`: Membership role elevated or downgraded.
- `MEMBERSHIP_STATUS_CHANGED`: Membership suspended or removed.
- `BUSINESS_PROFILE_CREATED`: Onboarding step 2 initial persistence.
- `BUSINESS_PROFILE_UPDATED`: Organization business profile modified.
- `WORKSPACE_PREFERENCES_UPDATED`: Timezone, AI tone, or language updated.
- `SESSION_REVOKED`: Security session invalidated.

## 5. Metadata Sanitization

The `sanitize_audit_metadata` routine automatically detects and replaces known secret keys:
`password`, `otp`, `access_token`, `refresh_token`, `token`, `secret`, `api_key`, `credentials`, `authorization`.
Any matched key is redacted to `[REDACTED]` prior to persistence.
