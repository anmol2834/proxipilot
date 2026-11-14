# Inbox UI Documentation

## 1. Visual Composition & Hierarchy
The Inbox UI strictly mirrors the approved reference design. It emphasizes calm, uncluttered native desktop software styling over crowded webmail interfaces.

```text
Dashboard Layout (Persistent AppShell)
  ├── Existing AppTopbar (Unchanged)
  ├── Existing AppSidebar (Unchanged, "Inbox" active)
  └── Inbox Page Content
        ├── InboxHeader ("Inbox", "Your emails, powered by AI. Focus on what matters.")
        └── 2-Pane Content Grid
              ├── Left Pane: ConversationList (Latest-first infinite scroll)
              └── Right Pane: ConversationDetailPane
                    ├── Action Toolbar (Delete, Star, Mark as lead: Hot / Warm / Cold)
                    ├── Subject Header & Sender Card (Avatar, Name, Email, Timestamp, •••)
                    ├── Message Body
                    └── AI Summary Card (Sparkle star, 3 key bullet points)
```

---

## 2. Component Specifications

### 2.1 Inbox Header (`InboxHeader.tsx`)
- Title: 28px font-weight 700 `#0F172A`, letter spacing `-0.025em`.
- Subtitle: 14.5px `#64748B`.

### 2.2 Conversation List (`ConversationList.tsx` & `ConversationListItem.tsx`)
- **Row Styling**:
  - Selected item: `#F0F5FF` light blue surface, `1.5px solid #BFDBFE` border, rounded `12px`.
  - Checkbox indicator: Subtle square on hover or selection.
  - Unread indicator: Deep blue dot `●` (`#2563EB`).
  - Circular avatar: 40x40px with pastel backgrounds (lavender for SC, turquoise for JD, purple for PR, sky blue for MT, pink for EL, amber for DK, mint for AR).
  - Star action: Outlined or gold-filled (`#F59E0B`) icon.

### 2.3 Conversation Detail Pane (`ConversationDetailPane.tsx`)
- **Action Toolbar**:
  - `Delete`: Accessible button with trash icon.
  - `Star`: Instant toggle with gold fill state.
  - `Mark as lead:`:
    - `Hot`: Pill badge with flame icon, `#FEF2F2` background, `#DC2626` text, `#FECACA` border.
    - `Warm`: Pill badge with sun icon, `#FFFBEB` background, `#D97706` text, `#FDE68A` border.
    - `Cold`: Pill badge with snowflake icon, `#F0F9FF` background, `#0284C7` text, `#BAE6FD` border.
- **AI Summary**:
  - Clean card with 4-pointed blue star sparkle `✦`.
  - Displays high-confidence distilled bullet points (intent, interest level, recommended action).

---

## 3. Keyboard Shortcuts
- `J` / `ArrowDown`: Move to next conversation.
- `K` / `ArrowUp`: Move to previous conversation.
- `S`: Toggle star status.
