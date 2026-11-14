# ProxiPilot Frontend Architecture Specification

> **Status**: Active & Mandatory  
> **Target Audience**: Core Engineers, Frontend Contributors, and AI Coding Agents  
> **Enforcement**: Strict code reviews, CI lint/typecheck gates, and architectural compliance

---

## 1. Executive Summary & Core Principles

ProxiPilot is an enterprise-grade autonomous AI proxy SaaS platform designed to manage high-volume customer communications, workflows, integrations, and intelligent automation. The frontend is engineered with a strict hierarchy of values:

```text
PERFORMANCE
     ↓
CORRECT ARCHITECTURE
     ↓
RELIABILITY
     ↓
ACCESSIBILITY
     ↓
USER EXPERIENCE
     ↓
VISUAL POLISH
```

A visually polished interface that is slow, bloated, or architecturally fragile is strictly unacceptable.

---

## 2. Technology Stack

| Layer                  | Technology             | Version / Specification           | Rationale                                                                      |
| :--------------------- | :--------------------- | :-------------------------------- | :----------------------------------------------------------------------------- |
| **Framework**          | Next.js (App Router)   | `16.3.x`                          | Streaming SSR, Server Components, automatic code splitting, optimized routing  |
| **Language**           | TypeScript             | `5.x` (`strict: true`)            | Complete type safety, zero unchecked `any` types                               |
| **UI Primitives**      | Material UI (MUI)      | `@mui/material 9.x`               | Battle-tested accessible UI primitives, design consistency                     |
| **SSR Style Engine**   | `@mui/material-nextjs` | `AppRouterCacheProvider`          | Emotion SSR style extraction preventing Flash of Unstyled Content (FOUC)       |
| **Styling**            | SCSS Modules           | `sass 1.x`                        | Scoped component styling, design tokens, zero runtime CSS injection overhead   |
| **Server State**       | TanStack Query         | `@tanstack/react-query 5.x`       | Predictable caching, stale-while-revalidate, deduplication, optimistic updates |
| **Client UI State**    | Zustand                | `zustand 5.x`                     | Lightweight, unopinionated client-side state for transient UI concerns         |
| **Forms & Validation** | React Hook Form + Zod  | `react-hook-form 7.x`, `zod 4.x`  | Performant uncontrolled form inputs, composable schema validation              |
| **Code Quality**       | ESLint 9 + Prettier    | Flat config (`eslint.config.mjs`) | Strict formatting, import sanity, dead-code detection                          |

---

## 3. Directory & Folder Architecture

```text
client/
├── docs/                           # Architecture, setup, and AI development rules
├── src/
│   ├── app/                        # Next.js App Router root layout & framework boundaries
│   │   ├── layout.tsx              # Root server layout (fonts, metadata, providers shell)
│   │   ├── page.tsx                # Framework root entry shell
│   │   ├── loading.tsx             # Root loading indicator boundary
│   │   ├── error.tsx               # Root route error boundary
│   │   ├── global-error.tsx        # Fallback global HTML error boundary
│   │   └── not-found.tsx           # Accessible 404 boundary
│   │
│   ├── components/                 # Presentation & UI infrastructure
│   │   ├── ui/                     # Primitives & standardized states
│   │   │   ├── feedback/           # ToastContainer, ConfirmDialog
│   │   │   ├── states/             # LoadingState, SkeletonState, EmptyState, ErrorState
│   │   │   └── index.ts
│   │   ├── layout/                 # Shell, navigation, sidebars, headers (future)
│   │   └── shared/                 # Cross-feature reusable presentation components
│   │
│   ├── features/                   # Domain-driven feature modules (future implementation)
│   │   ├── auth/                   # Authentication & session
│   │   ├── inbox/                  # Email & communication inbox
│   │   ├── automation/             # Workflow & trigger engines
│   │   ├── knowledge/              # Knowledge bases & vector ingestion
│   │   ├── analytics/              # Metrics & reporting
│   │   ├── integrations/           # Third-party integrations (Gmail, Outlook, Qdrant)
│   │   ├── billing/                # Subscriptions & invoices
│   │   └── settings/               # Organization & account settings
│   │
│   ├── config/                     # Centralized configuration & environment validation
│   │   ├── app.ts                  # App metadata, timeouts, storage keys, header names
│   │   ├── env.ts                  # Zod-validated environment config
│   │   └── index.ts
│   │
│   ├── lib/                        # Core application infrastructure & utilities
│   │   ├── api/                    # Centralized ApiClient, types, cancellation, errors
│   │   ├── query/                  # QueryClient, queryKeys factory, QueryProvider
│   │   ├── errors/                 # AppError, ErrorCode, normalizeError
│   │   ├── permissions/            # RBAC definitions & can() helper
│   │   ├── analytics/              # Vendor-agnostic event tracking
│   │   ├── logger/                 # Structured, environment-aware logger
│   │   └── utils/                  # cn, formatters, sanitize, metadata generators
│   │
│   ├── stores/                     # Zustand client UI stores
│   │   ├── ui.store.ts             # Sidebar, modal, theme mode
│   │   ├── app.store.ts            # Presentation workspace context & breadcrumbs
│   │   ├── notification.store.ts   # Global toast & alert queue
│   │   └── index.ts
│   │
│   ├── styles/                     # Global styles, SCSS variables, mixins, utilities
│   │   ├── globals.scss            # CSS reset, typography base, document styling
│   │   ├── variables.scss          # Design tokens, colors, breakpoints, z-indices
│   │   ├── mixins.scss             # Media queries, glassmorphism, flex helpers
│   │   └── utilities.scss          # Accessibility & structural utility classes
│   │
│   ├── theme/                      # Centralized MUI Theme Architecture
│   │   ├── palette.ts              # Light & Dark color definitions
│   │   ├── typography.ts           # Inter typographic scale & font weights
│   │   ├── spacing.ts              # 8pt baseline spacing system
│   │   ├── breakpoints.ts          # Responsive screen breakpoints
│   │   ├── components.ts           # MUI component overrides
│   │   ├── index.ts                # Theme factory & exports
│   │   └── ThemeRegistry.tsx       # Next.js App Router Emotion cache provider
│   │
│   ├── types/                      # Shared domain & application types
│   │   ├── user.types.ts           # User profiles, roles
│   │   ├── tenant.types.ts         # Multi-tenant definitions & memberships
│   │   └── index.ts
│   │
│   └── validation/                 # Reusable Zod schemas
│       ├── common/                 # Email, password, UUID, pagination schemas
│       └── index.ts
```

---

## 4. Server vs. Client Component Rules

Next.js App Router defaults to **React Server Components (RSC)**.

### The Client Component Rule:

> **Before adding `"use client"`, ask: Does this component actually require browser-side JavaScript?**

#### Keep as Server Component (`default`):

- Data fetching from internal services or database
- Accessing backend resources directly
- Rendering static or read-only presentation UI
- Keeping large dependencies (markdown parsers, sanitizers, date heavy libs) on the server
- Search engine critical pages & static layouts

#### Use `"use client"` ONLY when:

- Using React hooks (`useState`, `useEffect`, `useReducer`, `useMemo`, `useCallback`)
- Listening to browser events (`onClick`, `onChange`, `onKeyDown`, `onScroll`)
- Consuming browser APIs (`localStorage`, `window`, `navigator`, `ResizeObserver`)
- Using TanStack Query hooks (`useQuery`, `useMutation`)
- Using Zustand store hooks (`useUIStore`, `useAppStore`)
- Using React Hook Form (`useForm`, `Controller`)
- Wrapping third-party client providers (`ThemeRegistry`, `QueryProvider`)

---

## 5. Five-Tier State Management System

Never place all state into a single global store. State in ProxiPilot belongs to one of five distinct tiers:

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. SERVER STATE  → TanStack Query                           │
│    API responses, cache, pagination, background refetching  │
├─────────────────────────────────────────────────────────────┤
│ 2. CLIENT UI STATE → Zustand                                │
│    Sidebar toggle, active modal, theme, notification queue  │
├─────────────────────────────────────────────────────────────┤
│ 3. FORM STATE → React Hook Form + Zod                       │
│    Form input values, dirtiness, field validation errors    │
├─────────────────────────────────────────────────────────────┤
│ 4. URL STATE → Next.js URL / Search Params                  │
│    Search terms, table filters, sort order, active tab      │
├─────────────────────────────────────────────────────────────┤
│ 5. LOCAL COMPONENT STATE → React useState / useReducer      │
│    Dropdown open state, hover states, accordion toggles     │
└─────────────────────────────────────────────────────────────┘
```

### Strict Boundaries:

- **Do NOT** duplicate TanStack Query server data into Zustand.
- **Do NOT** put form inputs into Zustand.
- **Do NOT** hide shareable filters in Zustand; place them in URL query parameters.

---

## 6. Centralized API Layer & Cancellation

All HTTP communications must pass through the singleton `apiClient` (`src/lib/api/client.ts`).

### Key Capabilities:

- **Base URL & Path Normalization**: Injected from `env.NEXT_PUBLIC_API_URL`.
- **Automatic Timeouts**: Default 15-second timeout enforced via `AbortController`.
- **Request Cancellation**: Pass `signal` to cancel requests on component unmount or rapid input changes (e.g. search typeahead).
- **Normalized Errors**: Responses are automatically converted to `AppError` instances with HTTP status code, canonical error code, and field validation errors.
- **Tenant Context**: Injects `x-tenant-id` header when provided.
- **Traceability**: Injects unique `x-request-id` header for request correlation.
- **Safe Retries**: Mutations (POST, PUT, PATCH, DELETE) are **never** automatically retried.

```typescript
// Example: Standard API Query with Cancellation
import { apiClient } from "@/lib/api";

export async function fetchInboxMessages(tenantId: string, signal?: AbortSignal) {
  const response = await apiClient.get<InboxMessage[]>("/inbox/messages", {
    tenantId,
    signal,
    params: { limit: 50 },
  });
  return response.data;
}
```

---

## 7. Styling & Design System Rules

1. **Material UI Primitives**: Use `@mui/material` components for core structure (`Button`, `Dialog`, `Paper`, `TextField`, `Drawer`).
2. **Central Theme Overrides**: Modify styling globally through `src/theme/components.ts` or `src/theme/palette.ts`. Never hardcode raw hex values throughout components.
3. **SCSS Modules for Component-Specific Styles**:
   Create `ComponentName.module.scss` next to `ComponentName.tsx`.
   Use `@use "variables" as *;` and `@use "mixins" as *;` to consume tokens.
4. **Tailwind CSS is Strictly Forbidden**: Do not reinstall, import, or introduce Tailwind CSS utility classes.

---

## 8. Performance Architecture

- **Bundle Size Discipline**: Before adding any npm dependency, verify whether standard React, Next.js, or CSS can fulfill the requirement.
- **Font Optimization**: Utilize `next/font/google` (`Inter` font) with `display: "swap"`. Avoid runtime external font loading.
- **Image Optimization**: Always utilize `next/image` with explicit dimensions or `fill`. Use AVIF/WebP formats. Mark only true above-the-fold hero elements with `priority`.
- **Dynamic Imports**: Use `next/dynamic` with `ssr: false` for heavy client-only widgets (e.g. chart libraries, rich-text editors).

---

## 9. Security & Untrusted Content

1. **Email Content is Untrusted**: Inbound emails frequently contain malicious script tags, tracking pixels, or phishing links.
2. **No Raw dangerouslySetInnerHTML**: Never pass un-sanitized content to `dangerouslySetInnerHTML`. Always route through `sanitizeUntrustedHtml` from `src/lib/utils/sanitize.ts`.
3. **Secrets in Environment Variables**: Never expose backend secrets, API keys, or private signing tokens in `NEXT_PUBLIC_*` variables.
4. **Tenant Isolation**: The frontend is strictly for presentation. Tenant validation and authorization checks must be enforced authoritatively on the backend.

---

## 10. Multi-Tenancy & RBAC

- Multi-tenancy is active from Day 1. The frontend assumes an organization context with roles:
  `Owner` | `Admin` | `Manager` | `Member` | `Viewer`
- Use `can(user, permission)` from `src/lib/permissions/rbac.ts` for UI presentation logic (hiding buttons or tabs).
- Remember: Frontend RBAC checks are convenience checks; the backend API must validate access on every request.

---

## 11. Forbidden Patterns

```text
❌ Installing Tailwind CSS
❌ Giant global CSS files containing component styles
❌ Giant single Zustand stores
❌ Duplicating TanStack Query data into Zustand
❌ Random bare fetch() or axios calls inside components
❌ Unnecessary "use client" directives
❌ Using `any` or `as any` without justification
❌ Hardcoding tenant IDs or user IDs
❌ Relying on client-side authorization for security
❌ Placing private secrets in NEXT_PUBLIC_* variables
❌ Marking every image with priority
❌ Layout animations that trigger costly browser reflows
❌ Duplicating UI component libraries
❌ Ignoring loading, error, or empty UI states
❌ Unsafe HTML rendering of inbound emails
```
