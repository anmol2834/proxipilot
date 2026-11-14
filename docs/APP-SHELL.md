# ProxiPilot — Authenticated App Shell

## 1. Overview
The `AppShell` component (`src/components/app-shell/AppShell.tsx`) encapsulates the primary navigation architecture for all authenticated `/dashboard/*` routes. It ensures zero layout-shift, persistent navigation rail state, and sub-second client-side page transitions.

---

## 2. Structural Dimensions & Spacing

| Area | Desktop (>=900px) | Tablet (600px - 899px) | Mobile (<600px) |
|---|---|---|---|
| **Sidebar Width** | Fixed 245px rail | Collapsible Drawer (260px) | Hidden (Hamburger Drawer) |
| **Sidebar Position** | `sticky`, `top: 0`, `height: 100vh` | Drawer | Off-canvas Drawer |
| **Topbar Height** | 56px | 56px | 56px |
| **Main Content Max-Width** | 1300px centered | 100% | 100% |
| **Main Content Padding** | 32px (`p: 4`) | 24px (`p: 3`) | 16px (`p: 2`) |
| **Background Color** | `#F8FAFC` | `#F8FAFC` | `#F8FAFC` |

---

## 3. Sidebar Navigation Groupings

### Top Brand
- **Logo**: Violet diamond sparkle icon + "ProxiPilot" (Inter 800, `#0F172A`).

### Primary Group
- **Overview**: `/dashboard` (Selected state: `#EFF6FF` background, `#2563EB` text & icon, left accent bar).
- **Inbox**: `/dashboard/inbox`
- **Automations**: `/dashboard/automations`
- **Campaigns**: `/dashboard/campaigns`
- **Leads**: `/dashboard/leads`
- **Knowledge**: `/dashboard/knowledge`
- **Analytics**: `/dashboard/analytics`

### Secondary Group (Divider separation)
- **Integrations**: `/dashboard/integrations`
- **Team**: `/dashboard/team`
- **Templates**: `/dashboard/templates`

### Utility Group (Bottom)
- **Settings**: `/dashboard/settings`
- **Billing**: `/dashboard/billing`
- **Help**: `/dashboard/help`

### Bottom Promo Card
- **Upgrade to Pro**: Crown icon, "Unlock advanced AI automations" with arrow CTA.

---

## 4. Topbar Specifications

1. **Global Search Input**:
   - Magnifying glass icon.
   - Placeholder: `"Search emails, contacts, knowledge..."`.
   - Keyboard Badge: `⌘ K` (triggers global `CommandPalette` dialog).
2. **Help Icon**: Direct link to `/dashboard/help`.
3. **Notification Bell**: Unread indicator badge.
4. **Organization Switcher**:
   - Building icon.
   - Dynamic organization name (`Acme Inc.` fallback).
   - Member count badge (`12 members`).
   - Downward chevron.
   - Dropdown with `disableScrollLock` to prevent page shift.
5. **User Profile**:
   - Dark avatar circle (`#1E293B`) with initial.
   - Dynamic user name (`Anmol Sinha` fallback) and email.
   - Dropdown menu with Profile, Preferences, Security, and Sign out.

---

## 5. Scroll Lock Prevention Rule
All Material-UI menus, popovers, and dialogs in the AppShell **must** supply `disableScrollLock` to avoid altering body padding and causing page translation.
