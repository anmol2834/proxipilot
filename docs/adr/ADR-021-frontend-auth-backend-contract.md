# ADR-021: Frontend-Backend Auth & Onboarding Contract

## Status
Accepted

## Context
Connecting the existing frontend onboarding screens to the FastAPI backend requires a unified API contract that respects server-authoritative onboarding state, avoids client duplicate state divergence, and securely manages session lifecycles without persisting credentials in client storage.

## Decision
1. Implement a centralized, typed API client module `client/src/lib/api/auth.ts` wrapping all auth and onboarding endpoints.
2. In the Next.js frontend:
   - On successful sign-in, query `/api/v1/onboarding/state` to dynamically direct the user either to `/dashboard` (if all steps completed) or to the exact uncompleted onboarding route.
   - Pydantic models on the backend use `AliasChoices` to accommodate both camelCase form fields and snake_case API conventions.
   - Sessions are maintained via `HttpOnly` cookie and Bearer tokens; secrets are never stored in client persistence layers.

## Consequences
- Single source of truth for onboarding progression residing on the backend.
- Seamless user resumption across page refreshes, browser closures, or multi-device sessions.
