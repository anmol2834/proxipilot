# Onboarding Architecture & State Resolution

## 1. Overview & Single Source of Truth

The onboarding process transitions an authenticated user into an active tenant operator within ProxiPilot:

```
[ Signup / Account ] ➔ [ Email OTP Verification ] ➔ [ Organization Creation ] ➔ [ Business Profile ] ➔ [ Workspace Preferences ] ➔ [ Completed / Dashboard ]
```

### Server-Authoritative Principle
- **No Duplicate Authority**: Onboarding progress is **derived dynamically** from authoritative PostgreSQL domain tables rather than maintained in a separate flag column that can desynchronize.
- **Client Drafts for UX Resilience**: The frontend Zustand store (`proxipilot-registration-draft-v1`) persists in-progress form drafts across browser sessions, but the backend API (`GET /api/v1/onboarding/state`) is the sole arbiter of completed steps and allowed next routes.

## 2. Derivation Hierarchy & Resolution Strategy

`OnboardingService.resolve_onboarding_state(user_id, organization_id=None)` evaluates domain state in order:

| Step | State Evaluated | Authoritative Entity | Condition |
| :--- | :--- | :--- | :--- |
| **ACCOUNT** | Email verification | `User.is_verified` | Must be `True` |
| **ORGANIZATION** | Active tenancy & membership | `OrganizationMember` | Active membership with `status == "ACTIVE"` |
| **BUSINESS** | Company profile | `BusinessProfile` | Record exists with non-empty `description` & `products_services` |
| **WORKSPACE** | Operational defaults | `WorkspacePreferences` | Record exists with non-empty `timezone` |
| **COMPLETED** | Finished onboarding | All above fulfilled | `is_complete = True`, route: `/dashboard` |

## 3. Resume & Browser Close Resilience

When a user closes their browser at any step:
1. Upon logging in or refreshing, the frontend calls `GET /api/v1/onboarding/state`.
2. The server queries domain entities and responds with:
   ```json
   {
     "current_step": "BUSINESS",
     "completed_steps": ["ACCOUNT", "ORGANIZATION"],
     "is_complete": false,
     "next_route": "/signup/business",
     "organization_id": "0194...",
     "active_role": "OWNER"
   }
   ```
3. `RegistrationRouteGuard` checks the authoritative state:
   - If the user is on an incomplete step ahead of the server state, it redirects them to `next_route`.
   - If `is_complete` is `true`, it redirects directly to `/dashboard`.
   - Populates `organizationId` and `activeRole` in client context for subsequent domain requests.

## 4. API Endpoints

- `GET /api/v1/onboarding/state`
  - Requires authenticated session cookie (`session_id`).
  - Optional query parameter: `?organization_id=...` for multi-tenant context switching.
  - Returns `OnboardingStateResponse` contract.
