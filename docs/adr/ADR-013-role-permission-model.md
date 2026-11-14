# ADR-013: Extensible Role-Permission RBAC Model and Central Authorization

## Status
Accepted (Phase 2.6-2.7 Implementation)

## Context
Applications commonly authorize actions using hardcoded role checks (e.g. `if role == 'owner'`). As features expand (knowledge base, inbox, integrations, automated replies), hardcoded checks create fragile code, duplicate security rules, and make custom enterprise roles impossible.

## Decision
1. Implement a 3-table RBAC model: `roles`, `permissions`, and `role_permissions`.
2. Membership references `role_id` (foreign key) instead of arbitrary strings.
3. System roles (`OWNER`, `ADMIN`, `MEMBER`) have `is_system_role=True` and `organization_id=NULL`.
4. Tenant-scoped custom roles can be added by populating `organization_id`.
5. All backend authorization logic flows through a central `AuthorizationService` evaluating discrete permission keys (e.g. `organization.update`, `inbox.reply`), with zero hardcoded role checks in route handlers.

## Consequences
- **Positive**: Strict security boundaries; fine-grained permissions; future enterprise custom roles supported with zero schema modifications.
- **Negative**: Requires permission seeding and eager-loading of roles and permissions during tenant context resolution.
