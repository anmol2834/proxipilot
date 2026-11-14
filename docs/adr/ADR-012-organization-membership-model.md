# ADR-012: N:M Organization-Membership Model with Decoupled User Identity

## Status
Accepted (Phase 2.4-2.5 Implementation)

## Context
ProxiPilot requires an enterprise multi-tenant model. In simple systems, an `organization_id` column is added directly onto the `users` table (`user.organization_id`). However, this permanently locks a user to a single organization and prevents multi-workspace participation, agency workflows, and cross-team collaboration.

## Decision
1. The `users` table remains completely organization-independent.
2. The relationship is strictly managed via the `organization_members` join table (`id`, `user_id`, `organization_id`, `role_id`, `status`).
3. Database enforces uniqueness on `(organization_id, user_id)`.
4. Organization creation and creator's `OWNER` membership assignment are committed atomically in a single database transaction.

## Consequences
- **Positive**: Supports single-sign-on across multiple organizations, clean enterprise scaling, and agency/consultant workflows.
- **Negative**: Queries requiring tenant context must resolve active membership via indexed join rather than reading a static column on the user record.
