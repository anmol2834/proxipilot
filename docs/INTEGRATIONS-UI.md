# Integrations UI Documentation

## Overview
The Integrations UI faithfully implements the ProxiPilot design language and strictly adheres to the visual reference specification. It balances native desktop application aesthetics with modern web responsiveness.

---

## 1. Visual Hierarchy & Composition

```text
Dashboard Layout (Persistent AppShell)
  ├── Existing AppTopbar (Unchanged)
  ├── Existing AppSidebar (Unchanged, "Integrations" active)
  └── Integrations Page Content
        ├── IntegrationsHeader (Breadcrumbs, Title, Subtitle, Need Help button)
        ├── GmailHeroCard (Available badge, feature chips, Connect CTA, Visual Stage)
        ├── ConnectedAccountsSection (Visible when >= 1 Gmail account connected)
        ├── IntegrationHowItWorks (3 numbered steps with connector chevrons)
        └── ComingSoonGrid (6 upcoming providers with Coming Soon badges + Request CTA)
```

---

## 2. Component Design Specifications

### 2.1 Header (`IntegrationsHeader.tsx`)
- **Breadcrumb**: `Home > Integrations` in `#64748B` with subtle hover transitions.
- **Title**: 28px font-weight 700 `#0F172A`, letter spacing `-0.025em`.
- **Subtitle**: 14.5px `#64748B`, max-width 680px.
- **Action**: Clean `Need help?` button with help outline icon, border `#E2E8F0`.

### 2.2 Gmail Hero Card (`GmailHeroCard.tsx`)
- **Container**: `linear-gradient(135deg, #FFFFFF 0%, #F6F9FE 45%, #EEF4FF 100%)`, 18px radius, border `1px solid #E2E8F0`.
- **Logo & Badge**: 60x60px surface with official Gmail SVG vector logo; `Available` green badge (`#ECFDF5` background, `#059669` text, `#A7F3D0` border).
- **Feature Chips**:
  - `Read & analyze emails`
  - `Send email replies`
  - `Sync conversations`
  - `AI-assisted responses`
  - Pill styling with `#EFF6FF` background and `#1E3A8A` text.
- **CTAs**: Primary `#2563EB` solid button with link icon and right arrow; secondary white outline button with external link icon.
- **Security Reassurance**: Lock icon with verified text: *"We use secure OAuth authorization. Your data is encrypted and you're always in control."*
- **Visual Stage (Right Column)**:
  - Tilted opportunity card: *"Turn your emails into opportunities."*
  - Floating pill badges with subtle drop-shadows:
    - `✨ Understand conversations`
    - `⚡ Save time with AI`
    - `💬 Respond with your brand voice`

### 2.3 Connected Accounts (`ConnectedAccountsSection.tsx`)
- Dynamic 2-column grid showing all connected mailboxes.
- Each card displays Gmail logo, email address, connection health (`● Connected • Healthy` or animated `● Syncing conversations...`), last synced time, and independent `[ Manage ]` & `[ Disconnect ]` actions.
- Action header with `+ Connect another Gmail` button.

### 2.4 How It Works (`IntegrationHowItWorks.tsx`)
- 3 circular numbered badges with icons:
  1. `Connect your account` (Link icon)
  2. `Choose permissions` (Shield icon)
  3. `Start automating` (Sparkle icon)
- Subtle connecting chevrons (`›`) on desktop viewports.

### 2.5 More Integrations (`ComingSoonGrid.tsx` & `ComingSoonCard.tsx`)
- Responsive 3-column layout featuring Outlook, IMAP, Salesforce, HubSpot, Slack, and Google Drive.
- Crisp vector brand logos, clean descriptions, and soft `#F1F5F9` `Coming soon` badges.
- `Request an integration` modal dialog.

---

## 3. Responsiveness & Accessibility
- **Breakpoints**: Optimized for 1440px, 1024px, 768px, and 375px viewports.
- **Mobile Stack**: Hero card visual stage is gracefully collapsed on small screens; feature chips wrap without horizontal overflow; connected accounts stack into single column.
- **Focus & Keyboard Navigation**: Full WCAG compliance with visible focus outlines and semantic dialog buttons.
