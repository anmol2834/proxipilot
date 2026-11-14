# Protected Routes & Navigation Matrix

## 1. Route Classification

| Route Pattern | Access Level | Unauthenticated Action | Incomplete Onboarding Action |
|---|---|---|---|
| `/signin`, `/login` | Guest Only | Allowed | Redirected to active onboarding step |
| `/signup` | Public / Guest | Allowed | Allowed (draft preservation) |
| `/signup/organization` | Authenticated Incomplete | Redirected to `/signup` | Allowed if account verified |
| `/signup/business` | Authenticated Incomplete | Redirected to `/signup` | Allowed if org created |
| `/signup/workspace` | Authenticated Incomplete | Redirected to `/signup` | Allowed if business profile saved |
| `/dashboard/*` | Authenticated Complete | Redirected to `/signin` | Redirected to authoritative next step |

---

## 2. Server-Side Protection: Next.js Proxy Middleware

Located at `/src/middleware.ts`, the middleware performs zero-latency edge checks:
- Verifies existence of `session_id` cookie for all routes under `/dashboard/*`.
- If missing, redirects immediately to `/signin?redirect=/dashboard/...`.
- If present when accessing `/signin` or `/login`, redirects straight to `/dashboard`.

---

## 3. Client-Side Protection: `DashboardGuard`

Located at `/src/components/dashboard/DashboardGuard.tsx`:
- Validates that `authState === "AUTHENTICATED"`.
- Checks server onboarding state from `useOnboarding()`.
- If `is_completed === false`, redirects directly to the authoritative server route (`next_route`).
- Renders an elegant loader during initialization, avoiding any UI flashing.
