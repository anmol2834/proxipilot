export interface NavLinkItem {
  title: string;
  href: string;
  description?: string;
  badge?: string;
  icon?: string;
}

export interface NavGroup {
  label: string;
  href?: string;
  items: NavLinkItem[];
}

export const MAIN_NAVIGATION: {
  product: NavGroup;
  solutions: NavGroup;
  resources: NavGroup;
  company: NavGroup;
} = {
  product: {
    label: "Product",
    items: [
      {
        title: "Features",
        href: "/features",
        description: "Isolated AI Reply Copilot, Evidence RAG, and automated workflow triggers.",
      },
      {
        title: "How It Works",
        href: "/how-it-works",
        description: "Visual 6-step walkthrough from incoming message to verified delivery.",
      },
      {
        title: "Integrations",
        href: "/integrations",
        description: "Native Gmail API, Microsoft 365 Graph, Qdrant vectors, and Webhooks.",
      },
      {
        title: "Pricing",
        href: "/pricing",
        description: "Transparent, predictable plans with no hidden overage fees.",
      },
    ],
  },
  solutions: {
    label: "Solutions",
    href: "/solutions",
    items: [
      {
        title: "Solutions Overview",
        href: "/solutions",
        description: "Explore email automation workflows tailored to your team.",
      },
      {
        title: "Small Businesses",
        href: "/solutions/small-business",
        description: "Triage customer inquiries rapidly without dedicated support staff.",
      },
      {
        title: "Sales Teams",
        href: "/solutions/sales-teams",
        description: "Accelerate inbound lead responses and preserve quotation context.",
      },
      {
        title: "Customer Support",
        href: "/solutions/customer-support",
        description: "Deflect repetitive questions with knowledge-grounded AI drafts.",
      },
      {
        title: "E-commerce",
        href: "/solutions/ecommerce",
        description: "Automate order tracking, exchange, and return inquiries accurately.",
      },
      {
        title: "SaaS Companies",
        href: "/solutions/saas-companies",
        description: "Handle technical onboarding, trial questions, and feature requests.",
      },
      {
        title: "Agencies",
        href: "/solutions/agencies",
        description: "Manage client email inboxes with rigorous brand-tone consistency.",
      },
      {
        title: "B2B Businesses",
        href: "/solutions/b2b-businesses",
        description: "Retain complex multi-stakeholder negotiation context effortlessly.",
      },
      {
        title: "Wholesale Businesses",
        href: "/solutions/wholesale-businesses",
        description: "Resolve high-volume SKU specifications and catalog pricing inquiries.",
      },
      {
        title: "Operations Teams",
        href: "/solutions/operations-teams",
        description: "Process internal alerts, vendor logistics, and operational approvals.",
      },
    ],
  },
  resources: {
    label: "Resources",
    items: [
      {
        title: "Blog",
        href: "/blog",
        description: "Engineering guides, AI inbox benchmarks, and deliverability research.",
      },
      {
        title: "Help Center",
        href: "/help",
        description: "Searchable guides, FAQ lookups, and account configuration help.",
      },
      {
        title: "Documentation",
        href: "/docs",
        description: "Developer & product docs for OAuth setup, API webhooks, and rules.",
      },
      {
        title: "FAQ",
        href: "/faq",
        description: "Answers to frequently asked questions about security, pricing, and AI.",
      },
    ],
  },
  company: {
    label: "Company",
    items: [
      {
        title: "About",
        href: "/about",
        description: "Our mission to liberate modern business teams from email overload.",
      },
      {
        title: "Testimonials",
        href: "/testimonials",
        description: "Real-world productivity results from commercial inbox operators.",
      },
      {
        title: "Security & Trust",
        href: "/security",
        description: "Enterprise encryption, multi-tenant isolation, and zero model training.",
      },
      {
        title: "Partners",
        href: "/partners",
        description: "Collaborate with ProxiPilot as a technology, agency, or reseller partner.",
      },
      {
        title: "Careers",
        href: "/careers",
        description: "Join our distributed engineering, AI research, and growth teams.",
      },
    ],
  },
};
