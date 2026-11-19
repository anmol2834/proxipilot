/**
 * ProxiPilot subscription model — single source for /pricing (cards, comparison table, JSON-LD).
 * Plan names, prices, limits, features and checkout links are unchanged from the previous pricing page.
 */

export type BillingCycle = "monthly" | "annual";

export interface Plan {
  id: "starter" | "growth" | "business" | "enterprise";
  name: string;
  tagline: string;
  /** Display price per month; "Custom" for Enterprise. */
  monthlyPrice: string;
  annualPrice: string;
  highlight: boolean;
  badge?: string;
  ctaText: string;
  ctaHref: string;
  features: string[];
}

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "For individuals and small teams evaluating AI assistance.",
    monthlyPrice: "$29",
    annualPrice: "$24",
    highlight: false,
    ctaText: "Start 14-Day Trial",
    ctaHref: "/signup?plan=starter",
    features: [
      "1 Connected Mailbox (Gmail or Outlook)",
      "500 AI-assisted drafts per month",
      "10 Knowledge Base documents",
      "Isolated AI Reply Copilot",
      "Standard tone presets (Concise, Polish, Warm)",
      "Human-in-the-loop review queue",
      "Community & email support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "For high-volume teams automating everyday customer workflows.",
    monthlyPrice: "$99",
    annualPrice: "$79",
    highlight: true,
    badge: "Most Popular",
    ctaText: "Start 14-Day Trial",
    ctaHref: "/signup?plan=growth",
    features: [
      "Up to 3 Connected Mailboxes",
      "2,500 AI-assisted drafts per month",
      "50 Knowledge Base documents & spec sheets",
      "Automated rule chains & confidence triggers",
      "Intent classification (Hot/Warm/Cold tags)",
      "Custom prompt instructions & tone tuning",
      "Team roles: Owner, Admin, Agent (3 seats)",
      "Priority email support (under 8 hrs)",
    ],
  },
  {
    id: "business",
    name: "Business",
    tagline: "For established operations scaling wholesale and multi-brand inboxes.",
    monthlyPrice: "$249",
    annualPrice: "$199",
    highlight: false,
    ctaText: "Start 14-Day Trial",
    ctaHref: "/signup?plan=business",
    features: [
      "Up to 10 Connected Mailboxes",
      "10,000 AI-assisted drafts per month",
      "Unlimited Knowledge Base imports (CSV/Excel)",
      "Multi-tenant workspace isolation",
      "Analytics & team velocity dashboard",
      "Audit logging & compliance exports",
      "10 included team member seats",
      "Dedicated onboarding & priority SLA",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "For high-compliance organizations with custom security needs.",
    monthlyPrice: "Custom",
    annualPrice: "Custom",
    highlight: false,
    ctaText: "Contact",
    ctaHref: "/contact",
    features: [
      "Unlimited Connected Mailboxes",
      "Unlimited volume & custom throughput",
      "Dedicated private Qdrant vector cluster",
      "Custom ERP/CRM webhook connectors",
      "Custom Data Processing Agreement (DPA)",
      "99.9% Uptime SLA commitment",
      "Dedicated customer success architect",
      "Custom billing & invoicing terms",
    ],
  },
];

/** Comparison table. A cell is text, true (included) or false (not included). Derived from the plan lists above. */
export type Cell = string | boolean;
export const COMPARISON: { group: string; rows: { label: string; cells: [Cell, Cell, Cell, Cell] }[] }[] = [
  {
    group: "Usage",
    rows: [
      { label: "Connected mailboxes", cells: ["1", "3", "10", "Unlimited"] },
      { label: "AI-assisted drafts per month", cells: ["500", "2,500", "10,000", "Unlimited"] },
      { label: "Knowledge Base documents", cells: ["10", "50", "Unlimited", "Dedicated cluster"] },
      { label: "Team member seats", cells: ["1", "3", "10", "Custom"] },
    ],
  },
  {
    group: "AI drafting",
    rows: [
      { label: "Evidence-grounded drafts", cells: [true, true, true, true] },
      { label: "Isolated AI Reply Copilot", cells: [true, true, true, true] },
      { label: "Tone presets (Concise, Polish, Warm)", cells: [true, true, true, true] },
      { label: "Custom prompt instructions & tone tuning", cells: [false, true, true, true] },
    ],
  },
  {
    group: "Workflow & automation",
    rows: [
      { label: "Human-in-the-loop review queue", cells: [true, true, true, true] },
      { label: "Automated sending triggers & rule chains", cells: [false, true, true, true] },
      { label: "Intent classification (Hot/Warm/Cold)", cells: [false, true, true, true] },
      { label: "Analytics & team velocity dashboard", cells: [false, false, true, true] },
      { label: "Custom ERP/CRM webhook connectors", cells: [false, false, false, true] },
    ],
  },
  {
    group: "Security & compliance",
    rows: [
      { label: "AES-256 encryption & zero model training", cells: [true, true, true, true] },
      { label: "Audit logging & compliance exports", cells: [false, false, true, true] },
      { label: "Dedicated private Qdrant vector cluster", cells: [false, false, false, true] },
      { label: "Custom Data Processing Agreement (DPA)", cells: [false, false, false, true] },
      { label: "99.9% uptime SLA commitment", cells: [false, false, false, true] },
    ],
  },
  {
    group: "Support",
    rows: [
      { label: "Support channel", cells: ["Standard email", "Priority email (<8h)", "Priority SLA (<2h)", "24/7 dedicated SLA"] },
      { label: "Onboarding", cells: ["Self-serve", "Self-serve", "Dedicated", "Customer success architect"] },
    ],
  },
];

export function priceFor(plan: Plan, cycle: BillingCycle) {
  return cycle === "annual" ? plan.annualPrice : plan.monthlyPrice;
}

/** "$24" → 24; NaN for "Custom". */
export function priceNumber(p: string) {
  const digits = p.replace(/[^0-9.]/g, "");
  return digits ? Number(digits) : NaN;
}

/** Billing questions for /pricing (also emitted as FAQPage JSON-LD). [label](/path) renders as a link. */
export const PRICING_FAQ: { id: string; q: string; a: string }[] = [
  {
    id: "free-trial",
    q: "How does the 14-day free trial work?",
    a: "Starter, Growth and Business all include a full-featured 14-day free trial. You can connect your mailbox, import your knowledge and test AI drafts with zero credit card commitment required up front.",
  },
  {
    id: "annual-savings",
    q: "How much do I save with annual billing?",
    a: "Annual billing lowers the monthly price to $24 for Starter, $79 for Growth and $199 for Business, around 20% less than paying month to month. Annual plans are billed once a year.",
  },
  {
    id: "change-plan",
    q: "Can I upgrade, downgrade or cancel at any time?",
    a: "Yes. Change or cancel your plan with one click under Settings → Billing in your dashboard. Upgrades take effect immediately with prorated billing. If you cancel, your access stays active until the end of your current prepaid billing cycle, with no further renewal charges. See our [Refund Policy](/refund) for details.",
  },
  {
    id: "connected-mailbox",
    q: "What counts as a connected mailbox?",
    a: "Each Gmail or Microsoft 365 mailbox you connect counts as one, including shared team inboxes such as support@ or sales@. Starter includes 1, Growth up to 3, Business up to 10 and Enterprise is unlimited.",
  },
  {
    id: "payments",
    q: "Who processes subscription payments?",
    a: "All payments are handled securely by our Merchant of Record partners, Paddle and Lemon Squeezy. They handle global sales tax compliance, including VAT and GST, and fraud protection. We never store raw payment card numbers.",
  },
  {
    id: "data-training",
    q: "Is our data used to train AI models on any plan?",
    a: "No. On every plan, your emails, inbox data and knowledge base are never used to train public AI models. Read more in our [Privacy Policy](/privacy) and [Security Center](/security).",
  },
  {
    id: "custom-plan",
    q: "Do you offer custom plans for larger teams?",
    a: "Yes. Enterprise includes unlimited mailboxes, custom volume, a dedicated vector cluster, a custom DPA and custom billing and invoicing terms. [Contact our sales team](/contact) to scope it.",
  },
];
