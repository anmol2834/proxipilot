# Frontend Auth & Onboarding Integration — ProxiPilot

## 1. Architecture & Data Flow

The frontend registration and sign-in flow connects the existing Next.js screens directly to the FastAPI v1 backend endpoints via the centralized `authApi` client (`client/src/lib/api/auth.ts`).

```text
User fills Signup form (/signup)
        ↓
POST /api/v1/auth/signup
        ↓
Backend returns challenge_id & status: PENDING_VERIFICATION
        ↓
Frontend opens OtpDialog with challengeId
        ↓
User enters 6-digit OTP
        ↓
POST /api/v1/auth/verify-otp
        ↓
Backend verifies, activates user, creates Session, sets HttpOnly session_id cookie
        ↓
Navigate to /signup/organization
        ↓
POST /api/v1/organizations (Creates Org, assigns OWNER role)
        ↓
Navigate to /signup/business
        ↓
PATCH /api/v1/organizations/{id}/business-profile
        ↓
Navigate to /signup/workspace
        ↓
PATCH /api/v1/organizations/{id}/preferences
        ↓
Backend marks Onboarding complete
        ↓
Navigate to /dashboard
```

## 2. Connected Components

1. `AccountStepForm.tsx`:
   - Submits `first_name`, `last_name`, `email`, `password`, `agreed_to_terms` to `POST /api/v1/auth/signup`.
   - Captures `challenge_id` and opens `OtpDialog`.
   - Renders API error alerts cleanly without wiping user drafts.
2. `OtpDialog.tsx`:
   - Submits `email`, `challenge_id`, `otp` to `POST /api/v1/auth/verify-otp`.
   - Handles resend via `POST /api/v1/auth/resend-otp` with backend cooldown syncing.
3. `SignInForm.tsx`:
   - Submits credentials to `POST /api/v1/auth/signin`.
   - Queries `GET /api/v1/onboarding/state` to route either to `/dashboard` (if onboarding complete) or the next required onboarding step (e.g. `/signup/organization`).
4. `OrganizationStepForm.tsx`, `BusinessStepForm.tsx`, `WorkspaceStepForm.tsx`:
   - Connect to `/organizations`, `/organizations/{id}/business-profile`, and `/organizations/{id}/preferences`.
   - Persist user drafts in `useRegistrationStore` across back/forward navigation.

## 3. Sensitive Data Protection

Passwords and raw OTP codes are **never** persisted to `localStorage` or `sessionStorage`. Only safe profile drafts (`firstName`, `lastName`, `email`, `organizationDraft`, `businessDraft`, `workspaceDraft`) are stored in client Zustand drafts.
