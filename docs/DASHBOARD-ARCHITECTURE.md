# ProxiPilot — Dashboard Architecture

## 1. Overview & Objectives
The ProxiPilot Dashboard (`/dashboard`) serves as the organization command center and guided product setup portal immediately following onboarding. It provides:
1. **First-Run State**: High-fidelity guided setup checklist focusing on core prerequisites (Account created, Connect email, Add business knowledge).
2. **Post-Setup State**: Operational intelligence view displaying high-level KPIs, real-time AI triage activity, human-in-the-loop review alerts, and workload distribution.
3. **Persistent Shell**: Seamless enterprise navigation where the sidebar, topbar, and search command palette remain mounted across sub-routes without full-page reloads.

---

## 2. Directory & Component Hierarchy

```text
src/
├── app/
│   └── dashboard/
│       ├── layout.tsx              # Persistent App Router layout with AppShell
│       ├── page.tsx                # Overview dashboard (Setup flow + Operational switch)
│       ├── inbox/page.tsx          # Unified inbox sub-route
│       ├── automations/page.tsx    # Workflow automations sub-route
│       ├── campaigns/page.tsx      # Outbound email campaigns
│       ├── leads/page.tsx          # Qualified leads CRM sub-route
│       ├── knowledge/page.tsx      # RAG business knowledge grounding
│       ├── analytics/page.tsx      # Deflection & SLA metrics
│       ├── integrations/page.tsx   # OAuth email & API connectors
│       ├── team/page.tsx           # Organization members & RBAC
│       ├── templates/page.tsx      # Response templates library
│       ├── billing/page.tsx        # Subscriptions, usage & invoices
│       ├── settings/page.tsx       # Domain, security & workspace config
│       └── help/page.tsx           # Developer docs & support
│
├── components/
│   ├── app-shell/
│   │   ├── AppShell.tsx            # Responsive desktop/mobile shell container
│   │   ├── AppSidebar.tsx          # 245px fixed desktop rail + navigation links
│   │   ├── AppTopbar.tsx           # Global search (⌘K), org switcher, user menu
│   │   ├── OrganizationSwitcher.tsx# Multi-tenant organization switcher dropdown
│   │   ├── UserProfileMenu.tsx     # Authenticated user profile & sign-out menu
│   │   ├── CommandPalette.tsx      # Cmd+K / Ctrl+K quick navigation palette
│   │   └── index.ts
│   │
│   └── dashboard/
│       ├── DashboardHeader.tsx     # Welcome greeting + floating opportunities graphic
│       ├── SetupChecklist.tsx      # 3-step setup checklist (Account, Email, Knowledge)
│       ├── InsightsPreviewCard.tsx # Pre-setup insights bar preview card
│       ├── QuickActionsCard.tsx    # 4-card quick action shortcuts (Gmail, Outlook, etc.)
│       ├── DashboardTestimonial.tsx# Social proof quote strip with carousel dots
│       ├── OperationalDashboard.tsx# Post-setup live operational metrics & AI activity
│       ├── SubroutePlaceholder.tsx # Reusable sub-route container
│       └── index.ts
│
└── stores/
    ├── dashboard.store.ts          # Setup milestones, completion state, and simulation
    └── registration.store.ts       # Onboarding session draft, org & user details
```

---

## 3. Server vs. Client Boundary Strategy

- **`layout.tsx`**: Server component providing metadata and rendering the client-enabled `<AppShell>{children}</AppShell>`.
- **`AppShell.tsx`**: Client component managing responsive drawer state and wrapping sticky navigation.
- **`AppSidebar.tsx` & `AppTopbar.tsx`**: Client components utilizing `usePathname()` for active route styling and `useRegistrationStore()` for organization/user labels.
- **`SetupChecklist.tsx` & `dashboard.store.ts`**: Centralized reactive state driving whether the setup progress bar displays `1 of 3 completed` and toggles to operational mode once prerequisites are satisfied.
- **`OperationalDashboard.tsx`**: Client component for interactive operational cards, filter tabs, and real-time activity views.

---

## 4. Setup Checklist Milestone State Architecture

Mandatory setup prerequisites strictly adhere to product functionality:
1. **Account created** (`accountCreated`): Automatically marked complete (`true`).
2. **Connect your business email** (`emailConnected`): Primary active task directing user to `/dashboard/integrations`.
3. **Add business knowledge** (`knowledgeAdded`): Context grounding task directing user to `/dashboard/knowledge`.

*Note: Per design requirements, "Invite your team" is strictly removed from the mandatory setup checklist and only lives as an optional shortcut in Quick Actions.*

When all 3 items evaluate to `true`, `isSetupComplete` automatically transitions the page from setup mode into the operational command center.
