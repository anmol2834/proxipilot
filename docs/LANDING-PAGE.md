# ProxiPilot — Public Landing Page Architecture & System Guide

This document establishes the architecture, conventions, and implementation guidelines for the **ProxiPilot Public Landing Page** (`/` route).

---

## 1. Executive Summary & Core Rules

1. **Light Theme Only**: The landing page visual language is strictly light mode:
   - Primary Background: `#FFFFFF`
   - Soft Background: `#F8FAFC`
   - Primary Text: `#111827`
   - Secondary Text: `#64748B`
   - Subtle Border: `#E6EAF0`
   - Primary Accent: `#635BFF` (Indigo Accent)
   - Secondary Accent: `#4F7CFF` (Electric Blue)
   - Success Accent: `#16A36A`
2. **Modular Section Architecture**: Every section is an isolated, independently maintainable component in `src/components/landing/`.
3. **Reference-Image Workflow Ready**: Every section exposes a standardized [`VisualStage`](file:///src/components/landing/layout/VisualStage.tsx) component with defined boundaries, ready to be populated when a reference design image is provided.
4. **Performance First**:
   - Zero large raster backgrounds.
   - GPU-accelerated CSS textures and transitions (`transform`, `opacity`).
   - Server-rendered markup by default; `"use client"` is isolated strictly to interactive triggers and animation observers.
   - Zero layout shifts (CLS = 0).

---

## 2. Section Hierarchy & Identification

All sections must preserve their exact stable DOM `id` attributes for navigation anchors and telemetry:

| Order | Section Component | DOM ID | Background Variant | Texture Variant | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **0** | `LandingNavbar` | — | Blur / `#FFFFFF` | — | Sticky responsive navigation, mobile drawer, action CTAs |
| **1** | `HeroSection` | `#hero` | White (`#FFFFFF`) | Ambient Gradient | Value proposition, primary CTA, interactive hero visual stage |
| **2** | `TrustStripSection` | `#trust` | Soft (`#F8FAFC`) | Clean | Enterprise customer logos, compliance badges |
| **3** | `ProblemSection` | `#problem` | White (`#FFFFFF`) | Faint Grid | The inbox chaos / response latency pain points |
| **4** | `HowItWorksSection` | `#how-it-works` | Soft (`#F8FAFC`) | Clean | 4-step ingest → retrieve → gate → send pipeline |
| **5** | `ProductShowcaseSection`| `#product` | White (`#FFFFFF`) | Ambient Gradient | Interactive command center & inbox thread monitor mockup |
| **6** | `AIIntelligenceSection` | `#intelligence` | Soft (`#F8FAFC`) | Clean | Qdrant vector retrieval + Postgres business context grounding |
| **7** | `AIControlSection` | `#control` | White (`#FFFFFF`) | Clean | Dual-path confidence slider & human handoff governance |
| **8** | `OrganizationSection` | `#organization` | Soft (`#F8FAFC`) | Clean | Cryptographic tenant isolation & RBAC team permissions |
| **9** | `SecuritySection` | `#security` | White (`#FFFFFF`) | Faint Grid | SOC 2 readiness, zero model training on customer data |
| **10** | `UseCasesSection` | `#use-cases` | Soft (`#F8FAFC`) | Clean | Industry solutions: E-Commerce, B2B SaaS, Logistics |
| **11** | `IntegrationsSection` | `#integrations` | White (`#FFFFFF`) | Subtle Dots | Native connectors: Gmail, Outlook 365, Qdrant, Postgres |
| **12** | `AnalyticsSection` | `#analytics` | Soft (`#F8FAFC`) | Clean | Real-time resolution velocity & AI cost metrics |
| **13** | `SocialProofSection` | `#social-proof` | White (`#FFFFFF`) | Clean | Operations leader testimonials and case summaries |
| **14** | `PricingSection` | `#pricing` | Soft (`#F8FAFC`) | Clean | Transparent volume-based tiers & Enterprise SLA |
| **15** | `FAQSection` | `#faq` | White (`#FFFFFF`) | Clean | Architecture, privacy, and implementation answers |
| **16** | `FinalCTASection` | `#cta` | Soft (`#F8FAFC`) | Ambient Gradient | Bottom conversion trigger & 14-day trial invitation |
| **17** | `LandingFooter` | — | White (`#FFFFFF`) | Clean | Site links, legal terms, security documentation, copyright |

---

## 3. Directory Layout

```text
client/src/
├── app/
│   └── page.tsx                         # Root landing route with Schema.org JSON-LD & OpenGraph metadata
├── components/
│   └── landing/
│       ├── animations/                  # High-performance animation primitives
│       │   ├── FadeIn.tsx
│       │   ├── FadeUp.tsx
│       │   ├── ScaleIn.tsx
│       │   ├── Stagger.tsx
│       │   └── index.ts
│       ├── layout/                      # Standardized layout system
│       │   ├── Container.tsx            # Max-width & responsive padding wrapper
│       │   ├── Section.tsx              # Semantic <section> with spacing & backgrounds
│       │   ├── SectionHeader.tsx        # Unified badge, h2 title, and subtitle
│       │   ├── SectionBackground.tsx    # Lightweight GPU-accelerated CSS textures
│       │   ├── VisualStage.tsx          # Dedicated container for reference image mockups
│       │   └── index.ts
│       ├── LandingNavbar.tsx            # Sticky header with mobile drawer
│       ├── HeroSection.tsx              # #hero
│       ├── TrustStripSection.tsx        # #trust
│       ├── ProblemSection.tsx           # #problem
│       ├── HowItWorksSection.tsx        # #how-it-works
│       ├── ProductShowcaseSection.tsx   # #product
│       ├── AIIntelligenceSection.tsx    # #intelligence
│       ├── AIControlSection.tsx         # #control
│       ├── OrganizationSection.tsx      # #organization
│       ├── SecuritySection.tsx          # #security
│       ├── UseCasesSection.tsx          # #use-cases
│       ├── IntegrationsSection.tsx      # #integrations
│       ├── AnalyticsSection.tsx         # #analytics
│       ├── SocialProofSection.tsx       # #social-proof
│       ├── PricingSection.tsx           # #pricing
│       ├── FAQSection.tsx               # #faq
│       ├── FinalCTASection.tsx          # #cta
│       ├── LandingFooter.tsx            # Global landing footer
│       ├── LandingPage.tsx              # Top-level composition
│       └── index.ts
├── config/
│   └── landing.ts                       # Centralized marketing text, navigation, and section configs
├── lib/
│   └── animations/
│       ├── useInView.ts                 # Native IntersectionObserver trigger hook
│       ├── useReducedMotion.ts          # useSyncExternalStore reduced-motion hook
│       └── index.ts
├── styles/
│   ├── globals.scss                     # Global reset & CSS variable tokens
│   ├── variables.scss                   # SCSS brand & neutral color tokens
│   └── landing/
│       ├── textures.scss                # Pure CSS background patterns (grid, dots, ambient, glow)
│       └── animations.scss              # Hardware-accelerated CSS transitions & reduced motion
└── theme/
    ├── colors.ts                        # Centralized TypeScript color tokens
    └── palette.ts                       # MUI lightPalette aligned with design tokens
```

---

## 4. Layout & Spacing System

All sections adhere to a central vertical and horizontal rhythm:

### Horizontal Container
- **Default Max-Width**: `1280px` (`Container size="xl"`).
- **Horizontal Padding**: `px: { xs: 2.5, sm: 4, md: 6, lg: 8 }` (20px mobile -> 64px desktop).

### Vertical Rhythm
- `Section spacing="sm"`: `{ xs: 48px, md: 64px, lg: 80px }` (tight utility strips like TrustStrip).
- `Section spacing="md"`: `{ xs: 80px, md: 112px, lg: 144px }` (standard feature sections).
- `Section spacing="lg"`: `{ xs: 112px, md: 160px, lg: 208px }` (Hero and Final CTA).

---

## 5. Workflow: How to Attach a Reference Image to a Section

When the user provides a reference design image for a specific section (e.g., `HeroSection` or `ProductShowcaseSection`):

1. **Inspect the Target Component**:
   Open the corresponding file in `src/components/landing/<SectionName>.tsx`.
2. **Locate the `<VisualStage>` / Layout Boundary**:
   Replace or augment the `<VisualStage>` placeholder inside the `<Container>` with the exact visual elements from the reference image.
3. **Preserve Section Identifiers**:
   Do NOT alter the section's DOM `id` (e.g., `#hero`, `#how-it-works`).
4. **Use Established Design Tokens**:
   Import `colors` from `@/theme` or use SCSS variables. Do not invent arbitrary neon or dark gradients.
5. **Add Section-Level Animation Primitives**:
   Wrap elements in `<FadeUp>`, `<FadeIn>`, `<ScaleIn>`, or `<Stagger>` from `@/components/landing/animations`.
6. **Validate Responsive Behavior**:
   Verify mobile (`375px`), tablet (`768px`), and desktop (`1280px+`) layouts.
7. **Run Verification Gates**:
   ```bash
   npm run lint
   npm run typecheck
   npm run build
   ```
