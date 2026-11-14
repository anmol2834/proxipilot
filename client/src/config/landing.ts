// ==============================================================================
// ProxiPilot Public Landing Page Centralized Configuration
// ==============================================================================

export interface NavItem {
  label: string;
  href: string;
  isExternal?: boolean;
}

export interface SectionMeta {
  id: string;
  badge?: string;
  title: string;
  subtitle?: string;
}

export interface LandingConfig {
  meta: {
    title: string;
    description: string;
    keywords: string[];
    canonical: string;
  };
  navigation: {
    brandName: string;
    links: NavItem[];
    ctaSecondary: {
      label: string;
      href: string;
    };
    ctaPrimary: {
      label: string;
      href: string;
    };
  };
  sections: {
    hero: SectionMeta & {
      headline: string;
      subheadline: string;
      primaryCta: { label: string; href: string };
      secondaryCta: { label: string; href: string };
      trustNote: string;
    };
    trust: SectionMeta & {
      logos: Array<{ name: string; alt: string }>;
    };
    problem: SectionMeta & {
      cards: Array<{ title: string; description: string }>;
    };
    howItWorks: SectionMeta & {
      steps: Array<{ step: number; title: string; description: string }>;
    };
    productShowcase: SectionMeta & {
      tabLabels: string[];
    };
    aiIntelligence: SectionMeta & {
      capabilities: Array<{ title: string; description: string }>;
    };
    aiControl: SectionMeta & {
      features: Array<{ title: string; description: string }>;
    };
    organization: SectionMeta & {
      teamFeatures: Array<{ title: string; description: string }>;
    };
    security: SectionMeta & {
      guarantees: Array<{ title: string; description: string }>;
    };
    useCases: SectionMeta & {
      industries: Array<{ title: string; description: string }>;
    };
    integrations: SectionMeta & {
      providers: Array<{ name: string; category: string }>;
    };
    analytics: SectionMeta & {
      metrics: Array<{ label: string; value: string; description: string }>;
    };
    socialProof: SectionMeta & {
      testimonials: Array<{ quote: string; author: string; role: string; company: string }>;
    };
    pricing: SectionMeta & {
      billingCycles: string[];
      plans: Array<{ name: string; price: string; description: string; features: string[] }>;
    };
    faq: SectionMeta & {
      questions: Array<{ q: string; a: string }>;
    };
    cta: SectionMeta & {
      headline: string;
      subheadline: string;
      buttonText: string;
      buttonHref: string;
      guaranteeNote: string;
    };
  };
  footer: {
    copyright: string;
    columns: Array<{
      title: string;
      links: Array<{ label: string; href: string }>;
    }>;
    legalLinks: Array<{ label: string; href: string }>;
  };
}

export const landingConfig: LandingConfig = {
  meta: {
    title: "ProxiPilot — Autonomous Multi-Tenant AI Email Automation Platform",
    description:
      "Enterprise-grade multi-tenant AI email automation platform. Securely connect Gmail and Outlook, synthesize company knowledge with Qdrant vector retrieval, and automate accurate customer workflows.",
    keywords: [
      "AI email automation",
      "multi-tenant email AI",
      "autonomous inbox",
      "RAG email automation",
      "enterprise customer support AI",
      "ProxiPilot",
    ],
    canonical: "https://proxipilot.com",
  },
  navigation: {
    brandName: "ProxiPilot",
    links: [
      { label: "Product", href: "#product" },
      { label: "Intelligence", href: "#intelligence" },
      { label: "Control", href: "#control" },
      { label: "Organization", href: "#organization" },
      { label: "Analytics", href: "#analytics" },
      { label: "Pricing", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
    ],
    ctaSecondary: {
      label: "Sign in",
      href: "/signin",
    },
    ctaPrimary: {
      label: "Get started",
      href: "/signup",
    },
  },
  sections: {
    hero: {
      id: "hero",
      badge: "Autonomous Email Infrastructure",
      title: "Autonomous AI Email Automation for Modern Business",
      headline: "Transform your inbox into an intelligent, autonomous customer response engine.",
      subheadline:
        "Connect Gmail and Microsoft Outlook in seconds. ProxiPilot combines Qdrant vector knowledge retrieval, live business context, and evidence-gated AI to resolve high-volume customer emails accurately and securely.",
      primaryCta: { label: "Start Free Pilot", href: "/signup" },
      secondaryCta: { label: "Book Technical Demo", href: "#how-it-works" },
      trustNote: "No credit card required • Enterprise SSO available • SOC 2 ready",
    },
    trust: {
      id: "trust",
      title: "Trusted by high-growth operations and support teams worldwide",
      logos: [
        { name: "Acme Corp", alt: "Acme Corp logo" },
        { name: "GlobalTech", alt: "GlobalTech logo" },
        { name: "SaaSFlow", alt: "SaaSFlow logo" },
        { name: "NextScale", alt: "NextScale logo" },
        { name: "FinEdge", alt: "FinEdge logo" },
      ],
    },
    problem: {
      id: "problem",
      badge: "THE PROBLEM",
      title: "Email is where work gets stuck.",
      subtitle:
        "Important conversations get lost, context is scattered, and your team spends hours on repetitive work instead of what really matters.",
      cards: [
        {
          title: "Resolution Delays",
          description:
            "Customers wait hours or days for straightforward transactional status answers.",
        },
        {
          title: "Fragmented Knowledge",
          description:
            "Crucial answers live scattered across outdated PDFs, Notion docs, and disparate APIs.",
        },
        {
          title: "Human Burnout & Attrition",
          description:
            "Talented customer specialists waste mental energy on routine tier-1 inbox triage.",
        },
      ],
    },
    howItWorks: {
      id: "how-it-works",
      badge: "Intelligent Pipeline",
      title: "From incoming webhook to verified response in sub-seconds",
      subtitle:
        "Our modular event-driven pipeline processes emails asynchronously with strict deterministic validation.",
      steps: [
        {
          step: 1,
          title: "Connect & Ingest",
          description:
            "Instant OAuth connection to Gmail or Microsoft Outlook with zero desktop clients.",
        },
        {
          step: 2,
          title: "Vector & Business Retrieval",
          description:
            "Query company knowledge from Qdrant with live transactional verification from PostgreSQL.",
        },
        {
          step: 3,
          title: "Evidence-Gated Generation",
          description:
            "Anti-hallucination guardrails guarantee responses cite verified company documentation.",
        },
        {
          step: 4,
          title: "Autonomous or Human-in-Loop Send",
          description: "Execute automatic replies or queue for one-click specialist review.",
        },
      ],
    },
    productShowcase: {
      id: "product",
      badge: "PRODUCT SHOWCASE",
      title: "A smarter inbox for your whole team.",
      subtitle:
        "Manage conversations, automate responses, and stay in control — all in one place.",
      tabLabels: ["Inbox", "Automation", "Knowledge", "Analytics"],
    },
    aiIntelligence: {
      id: "intelligence",
      badge: "THE INTELLIGENCE LAYER",
      title: "More than AI. Real business intelligence.",
      subtitle:
        "ProxiPilot doesn't just read emails — it understands them, connects them to your business context, verifies the information, and takes the right action within your rules.",
      capabilities: [
        {
          title: "Deterministic Evidence Gating",
          description:
            "If verified facts are missing, the engine triggers human review instead of inventing answers.",
        },
        {
          title: "Multi-Turn Thread Context",
          description:
            "Maintains full conversational thread continuity across weeks of back-and-forth emails.",
        },
        {
          title: "Intelligent Model Routing",
          description:
            "Dynamically routes simple inquiries to low-latency models to minimize operational cost.",
        },
      ],
    },
    aiControl: {
      id: "control",
      badge: "CONTROL & TRUST",
      title: "AI that knows when not to answer.",
      subtitle:
        "ProxiPilot automatically handles what it's confident about and brings your team in when it's uncertain — so every response is accurate, safe, and on-brand.",
      features: [
        {
          title: "Confidence Calibration",
          description:
            "Require human sign-off on high-value accounts or sensitive inquiry categories.",
        },
        {
          title: "Outbound Idempotency & Dedup",
          description:
            "Multi-layer hashing ensures no duplicate replies are ever dispatched to customers.",
        },
      ],
    },
    organization: {
      id: "organization",
      badge: "FOR YOUR ORGANIZATION",
      title: "One workspace. Every team.",
      subtitle:
        "ProxiPilot brings your entire organization together, so every team can work with the same intelligence, knowledge, and context.",
      teamFeatures: [
        {
          title: "Cryptographic Tenant Isolation",
          description:
            "Vector embeddings and relational data are partitioned per tenant with zero cross-leakage.",
        },
        {
          title: "Role-Based Access Control",
          description:
            "Assign Owner, Admin, Manager, and Specialist roles with audited permission scopes.",
        },
      ],
    },
    security: {
      id: "security",
      badge: "Enterprise Security",
      title: "Bank-grade encryption, privacy by design, and SOC 2 readiness",
      subtitle:
        "Your proprietary company data and customer communications remain strictly confidential.",
      guarantees: [
        {
          title: "Zero Model Training on Customer Data",
          description:
            "Customer emails and uploaded knowledge are never used to train public foundational models.",
        },
        {
          title: "End-to-End Transport & Rest Encryption",
          description:
            "TLS 1.3 in transit and AES-256 at rest across all database and vector clusters.",
        },
        {
          title: "Comprehensive Audit Trail",
          description:
            "Every automated reply, human edit, and configuration change is immutably logged.",
        },
      ],
    },
    useCases: {
      id: "use-cases",
      badge: "Proven Workflows",
      title: "Tailored for high-velocity operations across global industries",
      subtitle:
        "See how modern businesses scale customer operations without linearly adding support headcount.",
      industries: [
        {
          title: "E-Commerce & Retail",
          description:
            "Automate tracking, return policies, order modifications, and warranty inquiries.",
        },
        {
          title: "B2B SaaS & Tech",
          description:
            "Handle tier-1 technical support, billing inquiries, and onboarding questions instantly.",
        },
        {
          title: "Logistics & Supply Chain",
          description:
            "Track shipments, carrier updates, customs documentation, and schedule dispatching.",
        },
      ],
    },
    integrations: {
      id: "integrations",
      badge: "Ecosystem Integrations",
      title: "Seamlessly connects with your existing tech stack and workflows",
      subtitle: "Native deep integrations with primary email providers, CRMs, and knowledge bases.",
      providers: [
        { name: "Google Workspace / Gmail", category: "Email Ingestion" },
        { name: "Microsoft Outlook 365", category: "Email Ingestion" },
        { name: "PostgreSQL & Custom APIs", category: "Live Data" },
        { name: "Qdrant Vector DB", category: "Knowledge Base" },
        { name: "Slack & Teams", category: "Handoff & Alerts" },
      ],
    },
    analytics: {
      id: "analytics",
      badge: "ANALYTICS",
      title: "Real insights. Measurable impact.",
      subtitle: "Track performance, response times, and business impact — all in one place.",
      metrics: [
        { label: "Avg Resolution Time", value: "< 45s", description: "From hours down to seconds" },
        {
          label: "Autonomous Coverage",
          value: "78%",
          description: "Verified tier-1 inquiries answered",
        },
        {
          label: "Accuracy Rate",
          value: "99.4%",
          description: "Zero hallucinations with evidence gating",
        },
        {
          label: "Support Cost Reduction",
          value: "62%",
          description: "Measurable operational savings",
        },
      ],
    },
    socialProof: {
      id: "social-proof",
      badge: "TRUSTED BY TEAMS",
      title: "Real teams. Real results.",
      subtitle: "Forward-thinking companies use ProxiPilot to turn their inbox into a competitive advantage.",
      testimonials: [
        {
          quote:
            "ProxiPilot allowed us to handle 3x our previous Black Friday email volume without hiring seasonal contractors. The evidence gating gave our leadership team complete confidence.",
          author: "Alex Morgan",
          role: "VP of Customer Operations",
          company: "Verde Logistics",
        },
        {
          quote:
            "The multi-tenant isolation and strict Qdrant search filtering made enterprise security sign-off straightforward. It's the most reliable AI architecture we evaluated.",
          author: "Elena Rostova",
          role: "Head of Infrastructure",
          company: "CloudScale Systems",
        },
      ],
    },
    pricing: {
      id: "pricing",
      badge: "PRICING",
      title: "Simple plans for real teams.",
      subtitle: "Start small, scale as you grow. All plans include the core ProxiPilot intelligence layer.",
      billingCycles: ["Monthly", "Annual (Save 20%)"],
      plans: [
        {
          name: "Starter",
          price: "$29",
          description: "For individuals and small teams",
          features: [
            "Get started with AI-powered email assistance.",
          ],
        },
        {
          name: "Growth",
          price: "$99",
          description: "For growing teams",
          features: [
            "Automate more conversations and streamline your workflow.",
          ],
        },
        {
          name: "Business",
          price: "$249",
          description: "For established organizations",
          features: [
            "Advanced control, deeper integrations, and team collaboration.",
          ],
        },
        {
          name: "Enterprise",
          price: "Let's talk",
          description: "For large organizations",
          features: [
            "Custom setup, dedicated support, and flexible deployment.",
          ],
        },
      ],
    },
    faq: {
      id: "faq",
      badge: "FAQ",
      title: "Questions? We've got answers.",
      subtitle: "Everything you need to know about ProxiPilot.",
      questions: [
        {
          q: "Does ProxiPilot automatically send emails?",
          a: "ProxiPilot can work in draft, approval, or automated modes, depending on your organization's rules. You stay in control and can always review, edit, or set guardrails before anything is sent.",
        },
        {
          q: "What email providers are supported?",
          a: "We natively support Google Workspace / Gmail and Microsoft Outlook 365 via secure OAuth 2.0. Additional custom IMAP/SMTP and API connections are available on Enterprise plans.",
        },
        {
          q: "Is my data secure?",
          a: "Yes. Your emails, attachments, and company data are encrypted in transit (TLS 1.3) and at rest (AES-256). We maintain strict tenant isolation.",
        },
        {
          q: "Can I use ProxiPilot for internal emails?",
          a: "Yes. ProxiPilot can be routed to internal ticketing or support addresses, team inboxes, or departmental queues with separate knowledge scopes and security rules.",
        },
        {
          q: "Do I need technical expertise to get started?",
          a: "Not at all. You can connect your mailbox in under two minutes with zero code required. Upload your FAQs or documents, and ProxiPilot starts drafting verified replies immediately.",
        },
        {
          q: "Can I review and edit AI responses?",
          a: "Always. Every response can be held for one-click human review until you feel confident activating automatic sending for specific verified categories.",
        },
      ],
    },
    cta: {
      id: "cta",
      badge: "FINAL CTA",
      title: "Your inbox shouldn't run your business.",
      headline: "Your inbox shouldn't run your business.",
      subheadline: "Let your inbox become part of your system.",
      buttonText: "Get started free →",
      buttonHref: "/signup",
      guaranteeNote: "No credit card required • Set up in minutes • Cancel anytime",
    },
  },
  footer: {
    copyright: "© 2025 ProxiPilot. All rights reserved.",
    columns: [
      {
        title: "Product",
        links: [
          { label: "Features", href: "#product" },
          { label: "Integrations", href: "#integrations" },
          { label: "Pricing", href: "#pricing" },
          { label: "Security", href: "#security" },
          { label: "What's new", href: "#" },
        ],
      },
      {
        title: "Solutions",
        links: [
          { label: "Customer Support", href: "#use-cases" },
          { label: "Sales", href: "#use-cases" },
          { label: "Operations", href: "#use-cases" },
          { label: "For Teams", href: "#organization" },
          { label: "For Enterprises", href: "#organization" },
        ],
      },
      {
        title: "Resources",
        links: [
          { label: "Blog", href: "#" },
          { label: "Help Center", href: "#" },
          { label: "Documentation", href: "/docs" },
          { label: "Case Studies", href: "#social-proof" },
          { label: "Guides", href: "#" },
        ],
      },
      {
        title: "Company",
        links: [
          { label: "About", href: "/about" },
          { label: "Careers", href: "/careers" },
          { label: "Contact", href: "/contact" },
          { label: "Partners", href: "#" },
          { label: "Press", href: "#" },
        ],
      },
    ],
    legalLinks: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Security", href: "/security" },
      { label: "Status", href: "/status" },
    ],
  },
};
