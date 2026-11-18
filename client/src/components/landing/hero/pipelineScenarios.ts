export interface PipelineScenario {
  id: number;
  sender: string;
  avatarBg: string;
  avatarColor: string;
  time: string;
  subject: string;
  preview: string;
  badge: string;
  badgeBg: string;
  badgeColor: string;

  // Customer-facing business intelligence (Does not expose internal system architecture)
  intelligence: {
    inquiryType: string;
    accountContext: string;
    keySpecifics: string;
    knowledgeGrounded: string[];
    policyStatus: string;
  };

  // Draft response state
  draft: {
    greeting: string;
    body: string;
    signoff: string;
  };
}

export const PIPELINE_SCENARIOS: PipelineScenario[] = [
  {
    id: 1,
    sender: "David Miller",
    avatarBg: "#F5F3FF",
    avatarColor: "#7C3AED",
    time: "10:24 AM",
    subject: "Question about enterprise plan",
    preview: "Evaluating 500 licenses, SOC2 Type II report, and uptime SLAs...",
    badge: "Enterprise",
    badgeBg: "#EFF6FF",
    badgeColor: "#1E40AF",
    intelligence: {
      inquiryType: "Enterprise Contract & Security",
      accountContext: "Apex Capital (Enterprise Lead)",
      keySpecifics: "500 Seats, SOC2 Type II, 99.99% SLA",
      knowledgeGrounded: ["Enterprise Master Terms", "Security Whitepaper"],
      policyStatus: "100% Grounded in Company Data",
    },
    draft: {
      greeting: "Hi David,",
      body: "Our Enterprise plan includes SOC2 Type II reports, custom 99.99% uptime SLAs, and tailored compliance guarantees. I've attached our full security whitepaper and custom quote.",
      signoff: "Best regards,\nSales Team",
    },
  },
  {
    id: 2,
    sender: "Sarah Johnson",
    avatarBg: "#EEF2FF",
    avatarColor: "#4F46E5",
    time: "9:42 AM",
    subject: "Can you send me pricing for 500 licenses?",
    preview: "Looking to deploy across our regional operations next quarter...",
    badge: "Sales",
    badgeBg: "#FEF3C7",
    badgeColor: "#92400E",
    intelligence: {
      inquiryType: "Volume Tier Pricing Request",
      accountContext: "Acme Corp (Commercial Lead)",
      keySpecifics: "500 User Seats, Annual Commitment",
      knowledgeGrounded: ["Approved Rate Schedule", "Volume Discount Matrix"],
      policyStatus: "100% Grounded in Company Data",
    },
    draft: {
      greeting: "Hi Sarah,",
      body: "Thanks for your interest! For 500 licenses on our annual plan, our volume tier discount applies at $24/seat/month with dedicated support, SSO, and custom onboarding included.",
      signoff: "Best regards,\nYour Team",
    },
  },
  {
    id: 3,
    sender: "Michael Chen",
    avatarBg: "#F0FDF4",
    avatarColor: "#16A34A",
    time: "9:18 AM",
    subject: "Need help with integration",
    preview: "Setting up automated event triggers via REST API and webhooks...",
    badge: "Technical",
    badgeBg: "#F1F5F9",
    badgeColor: "#475569",
    intelligence: {
      inquiryType: "Webhook & API Integration Guide",
      accountContext: "TechFlow Ltd (Active Customer)",
      keySpecifics: "REST Endpoints & Signature Verification",
      knowledgeGrounded: ["Developer Documentation", "Webhook Security Guide"],
      policyStatus: "100% Grounded in Company Data",
    },
    draft: {
      greeting: "Hi Michael,",
      body: "You can configure webhooks under Settings > API Keys in your workspace. I've linked our webhook signature verification guide with step-by-step code samples.",
      signoff: "Best regards,\nSupport Team",
    },
  },
  {
    id: 4,
    sender: "Priya Sharma",
    avatarBg: "#FDF2F8",
    avatarColor: "#DB2777",
    time: "Yesterday",
    subject: "Partnership opportunity",
    preview: "Exploring agency partner track for our 40 enterprise clients...",
    badge: "Partner",
    badgeBg: "#F0FDF4",
    badgeColor: "#166534",
    intelligence: {
      inquiryType: "Agency Ecosystem Partnership",
      accountContext: "GrowthScale Global (Agency Track)",
      keySpecifics: "40 Client Workspaces, Revenue Share",
      knowledgeGrounded: ["Partner Program Terms", "Multi-Tenant Guidelines"],
      policyStatus: "100% Grounded in Company Data",
    },
    draft: {
      greeting: "Hi Priya,",
      body: "Thank you for reaching out! We offer a dedicated Agency track with 20% recurring revenue share and multi-tenant controls. Let's schedule an intro this Thursday at 2 PM EST.",
      signoff: "Best regards,\nPartnerships Team",
    },
  },
];
