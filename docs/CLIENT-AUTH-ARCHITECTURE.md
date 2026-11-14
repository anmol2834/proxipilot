# Client Authentication Architecture

## 1. Executive Summary

ProxiPilot enforces a zero-trust, server-authoritative client architecture. The Next.js frontend interacts with the FastAPI backend through a unified, centralized API client that leverages HttpOnly session cookies, TanStack Query server-state management, and Next.js server-side proxy route guards.

At no point does the client act as a security boundary:
- Authentication secrets, session IDs, and tokens are never persisted in browser storage (`localStorage` or `sessionStorage`).
- All tenant permissions and access boundaries are verified on the backend for every request.
- The UI handles seamless routing, dynamic progress synchronization, and strict cache isolation between organizations.

---

## 2. Authentication Lifecycle

```text
               Unauthenticated
                      │
                      ▼
             ┌─────────────────┐
             │ POST /auth/signup│
             └────────┬────────┘
                      │ Returns challenge_id
                      ▼
             ┌─────────────────┐
             │   6-Digit OTP   │
             │   Verification  │
             └────────┬────────┘
                      │ POST /auth/verify-otp
                      ▼
             ┌─────────────────┐
             │ Session Created │ (HttpOnly cookie)
             └────────┬────────┘
                      │
                      ▼
           ┌──────────────────────┐
           │ GET /onboarding/state│
           └──────────┬───────────┘
                      │
       ┌──────────────┴──────────────┐
       ▼                             ▼
Incomplete Steps             Onboarding Completed
 (Org -> Business -> WS)             │
       │                             ▼
       ▼                        /dashboard
Appropriate Step Route
```

---

## 3. Key Components

### 3.1. `useAuth` Hook (`/src/hooks/use-auth.ts`)
Canonical client hook providing reactive session awareness:
- `user`: Authenticated user entity from `GET /auth/me`.
- `authState`: Tri-state machine (`INITIALIZING` | `AUTHENTICATED` | `UNAUTHENTICATED`) preventing flash-of-unauthenticated-content (FOUC).
- `signin`: Initiates session and seeds user context.
- `signout`: Revokes the session on the backend via `POST /auth/signout`, cancels active queries, purges the query client cache, and transitions cleanly to `/signin`.

### 3.2. Secure Cookie Authentication
- Transport: All API calls execute with `credentials: "include"`.
- Token Storage: Long-lived authentication secrets and session identifiers remain in secure HttpOnly cookies set by the backend.
- CSRF & Tamper Resistance: Browser scripts cannot access or exfiltrate session credentials.

### 3.3. Error Handling and Single-Flight Retries
- `ApiClient` catches HTTP 401/403 responses and maps them into normalized `AppError` objects.
- Non-retryable status codes (400, 401, 403, 422) prevent runaway retry loops.
