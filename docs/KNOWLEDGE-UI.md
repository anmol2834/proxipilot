# Knowledge UI & Design Specification

## 1. Visual Source of Truth
The Knowledge page follows the reference interface strictly:
- **Tone**: Polished, enterprise desktop application aesthetic with native responsiveness.
- **Palette**: Neutral gray backgrounds (`#F8FAFC`, `#FFFFFF`), subtle slate borders (`#E2E8F0`, `#F1F5F9`), ProxiPilot brand primary blue (`#2563EB`), emerald green badges for `Published` (`#ECFDF5`, `#059669`), and amber badges for `Draft`/`Needs review`.
- **Proportions**: Generous whitespace without excessive padding, compact desktop table density, crisp typography using system font stacks and Inter.

---

## 2. Component Composition

### 2.1 Header & Smart Banner (`KnowledgeHeader.tsx`)
- **Breadcrumb**: Minimalist `🏠 / Knowledge` navigation indicator.
- **Title**: `Your business knowledge` (`text-2xl font-bold text-slate-900 tracking-tight`).
- **Subtitle**: `Add and manage the information ProxiPilot uses to understand your business.`
- **Right Smart Banner**: Light indigo card (`bg-gradient-to-r from-blue-50/70 to-indigo-50/50`) highlighting AI retrieval value with sparkle icon, title `Better knowledge. Smarter replies.`, descriptive copy, and a dismiss action.

### 2.2 Category Cards Grid (`CategoryCardsGrid.tsx`)
A responsive grid of the 6 knowledge categories: 1 column on phones, 2 on small screens and **3 per row**
from tablets up (two rows of three). Exactly one card is always selected; the page opens on
**Products & Services** and the list below shows the selected category's items.
1. **Products & Services** — What you offer (includes pricing) — default
2. **Company Info** — About your organization (incl. contact details, address, hours)
3. **Policies** — Refund, cancellation, etc.
4. **Support & FAQs** — Common questions
5. **Offers & Promotions** — Current campaigns
6. **Processes & Timelines** — Steps and how long they take

*Note*: As specified by strict product requirements, there is **NO separate Pricing category**. Pricing is embedded inside *Products & Services*.

### 2.3 Knowledge Toolbar (`KnowledgeToolbar.tsx`)
- **Category Header**: Displays the selected category's name with its count badge (e.g. `Products & Services 5,103 items`).
- **Subtitle**: `Manage all your business knowledge in one place.`
- **Interactive Controls**:
  - `Search knowledge...` with search icon and clear button.
  - `Filters` button opening popover with Status radio selection and quick reset.
  - `Sort` button with dropdown menu.
  - `+ Add knowledge` split button allowing instant modal opening or direct category selection.

### 2.4 Knowledge Table (`KnowledgeTable.tsx`)
Desktop table matching the reference columns:
- `Checkbox`: Accessible row selection with indeterminate header support.
- `Title`: Category-themed icon badge, primary title, and subtitle/excerpt preview.
- `Category`: Soft pastel pill badge with category color-coding.
- `Type`: Icon + type indicator (e.g., `Service`, `Policy`, `Contact`, `Offer`, `Information`).
- `Updated`: Formatted date string with relative attribution (e.g. `Sep 12, 2024 by You`).
- `Status`: Subtle dot badge (`Published`, `Draft`, `Needs review`, `Processing`, `Archived`).
- `Source`: Source icon + label (`Manual`, `Website`, `Document`, `Imported`, `Integration`).
- `Actions`: `Edit` (pencil), `Duplicate` (copy), and `More` (...) menu containing status toggles and Delete.

### 2.5 Mobile Card Transformation
On viewports `< 768px`, the data table seamlessly transforms into responsive cards displaying icon, title, excerpt, metadata pills, status badge, and an action drawer without horizontal table clipping.

### 2.6 Pagination (`KnowledgePagination.tsx`)
Footer pagination displaying `Showing X–Y of Z items` and accessible page buttons (`< 1 2 3 ... N >`).

### 2.7 Bulk Actions Bar (`BulkActionBar.tsx`)
Floats above the bottom viewport whenever 1 or more rows are selected. Provides instant bulk `Publish`, `Archive`, `Delete`, and `Deselect All` capabilities.

### 2.8 Modals & Confirmation Dialogs
- `AddKnowledgeDialog.tsx`: Two-step creation flow. Step 1: Category selection cards. Step 2: Category-specific validated form.
- `EditKnowledgeDialog.tsx`: Prepopulated form for modifying existing items.
- `DeleteConfirmationDialog.tsx`: Impact-aware confirmation modal warning that deleting will affect ProxiPilot AI generation.
