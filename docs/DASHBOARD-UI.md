# ProxiPilot — Dashboard UI & Visual Design System

## 1. Visual Source of Truth
The visual design directly replicates the uploaded reference dashboard image:
- **Palette**:
  - Main Background: `#F8FAFC`
  - Cards & Containers: `#FFFFFF`
  - Primary Accent / Action: `#2563EB` (hover `#1D4ED8`)
  - Accent Tint: `#EFF6FF` (border `#DBEAFE`)
  - Primary Typography: `#0F172A`
  - Muted Typography: `#64748B` / `#94A3B8`
  - Success Indicator: `#16A34A` / `#22C55E`
  - Card Borders: `1px solid #EEF2F6` (active setup card `1.5px solid #2563EB`)
  - Border Radius: `16px` to `20px` for cards, `10px` for buttons.

---

## 2. Dashboard Sections & Anatomy

### 1. Dashboard Header (`DashboardHeader.tsx`)
- **Left Welcome**:
  - `Good morning, {firstName}.` (Name highlighted in `#2563EB`).
  - Subtitle: `Let's get your inbox working smarter.`
- **Right Visual Stage**:
  - Handwritten script: `Turn emails into opportunities` (`Caveat, cursive` / `Brush Script MT`).
  - Curved SVG dynamic arrow pointing downward.
  - Layered floating card graphics with blue gradient backdrop (`linear-gradient(135deg, #E0E7FF 0%, #EEF2FF 50%, #F8FAFC 100%)`).
  - Glowing pill: `✨ Smarter emails. Bigger outcomes.`

### 2. Guided Setup Checklist (`SetupChecklist.tsx`)
- Section Header: `GET STARTED` (uppercase tracking, `#64748B`).
- Title: `Complete these steps to unlock ProxiPilot`.
- Subtitle: `Finish the setup to let our AI understand your business and start working on your emails.`
- Progress indicator: `1 of 3 completed` with a dual-color progress bar.
- **Card 1 (Completed)**: `Account created` — Green circle checkmark, "You're all set!".
- **Card 2 (Active)**: `Connect your email` — Blue badge with envelope icon, "Integrate Gmail or Microsoft Workspace", blue CTA button `Connect email →`.
- **Card 3 (Pending)**: `Add business knowledge` — Book icon, "Help AI understand your products, services and FAQs".
- Connecting lines visually linking the step sequence.

### 3. Insights Preview Card (`InsightsPreviewCard.tsx`)
- Soft gradient column bars simulating upcoming metrics.
- Text: `Once you're set up, we'll show you real insights here.`
- Description: `Emails, resolutions, leads, and more — all in one place.`

### 4. Quick Actions Card (`QuickActionsCard.tsx`)
- Header: `💡 Quick actions`
- 4-card horizontal responsive grid:
  - **Connect Gmail**: Google multi-colored icon + "Use your Gmail account".
  - **Connect Outlook**: Microsoft icon + "Use Microsoft Workspace".
  - **Add knowledge**: Blue document icon + "Upload documents or add a website".
  - **Invite team**: Purple team icon + "Send invitations to your team".

### 5. Social Proof Strip (`DashboardTestimonial.tsx`)
- Quote mark icon + testimonial text.
- 4 carousel indicator dots (first dot active `#2563EB`).
- Right label: `Built for modern teams`.

---

## 3. Post-Setup Operational View (`OperationalDashboard.tsx`)
When all setup prerequisites are fulfilled, the temporary setup container transforms into the operational command center:
1. **4 KPI Stat Cards**: Total Emails (1,284), AI Handled (82.4%), Needs Attention (3), Avg Response Time (4.2 min).
2. **Today's AI Activity**: Triage items with status tags (`Response Ready`, `Draft Created`, `Lead Assigned`).
3. **Needs Your Attention**: High-priority approval items (Pricing escalation, refund review).
4. **AI Workload**: Donut / bar distribution (82% automated, 14% human review, 4% escalated).
