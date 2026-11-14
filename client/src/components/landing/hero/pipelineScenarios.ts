export interface PipelineScenario {
  id: number;
  sender: string;
  avatarBg: string;
  avatarColor: string;
  time: string;
  subject: string;
  badge: string;
  badgeBg: string;
  badgeColor: string;

  // Intelligence card state
  intelligence: {
    intent: string;
    customer: string;
    requirement: string;
    knowledgeTags: string[];
    sourcesMatched: string;
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
    sender: "Sarah Johnson",
    avatarBg: "#EEF2FF",
    avatarColor: "#4F46E5",
    time: "10:24 AM",
    subject: "Can you send me pricing for 500 licenses?",
    badge: "External",
    badgeBg: "#FEF3C7",
    badgeColor: "#92400E",
    intelligence: {
      intent: "Pricing Request",
      customer: "Acme Corp",
      requirement: "500 licenses",
      knowledgeTags: ["Company pricing", "Enterprise plans"],
      sourcesMatched: "3 sources matched",
    },
    draft: {
      greeting: "Hi Sarah,",
      body: "Thanks for your interest! Here's the pricing for 500 licenses as requested. Our enterprise tier includes dedicated SSO, priority 24/7 SLA, and volume discounting at $24/seat/month.",
      signoff: "Best regards,\nYour Team",
    },
  },
  {
    id: 2,
    sender: "Michael Chen",
    avatarBg: "#F0FDF4",
    avatarColor: "#16A34A",
    time: "9:18 AM",
    subject: "Need help with integration",
    badge: "Support",
    badgeBg: "#F1F5F9",
    badgeColor: "#475569",
    intelligence: {
      intent: "Integration Help",
      customer: "TechFlow Ltd",
      requirement: "Webhook & REST API",
      knowledgeTags: ["API reference", "Webhook guides"],
      sourcesMatched: "4 docs verified",
    },
    draft: {
      greeting: "Hi Michael,",
      body: "I checked our developer docs. You can configure webhooks under Settings > API Keys. Here is our step-by-step webhook verification guide with code samples.",
      signoff: "Best regards,\nSupport Team",
    },
  },
  {
    id: 3,
    sender: "Priya Sharma",
    avatarBg: "#FDF2F8",
    avatarColor: "#DB2777",
    time: "Yesterday",
    subject: "Partnership opportunity",
    badge: "Business",
    badgeBg: "#F0FDF4",
    badgeColor: "#166534",
    intelligence: {
      intent: "Partnership Inquiry",
      customer: "GrowthScale Global",
      requirement: "Co-marketing & Reseller",
      knowledgeTags: ["Partner handbook", "Revenue tiers"],
      sourcesMatched: "2 playbooks matched",
    },
    draft: {
      greeting: "Hi Priya,",
      body: "Thank you for reaching out! We would love to explore a co-marketing partnership. Let's schedule a brief 15-minute intro call this Thursday at 2 PM EST.",
      signoff: "Best regards,\nPartnerships Team",
    },
  },
  {
    id: 4,
    sender: "David Miller",
    avatarBg: "#F5F3FF",
    avatarColor: "#7C3AED",
    time: "Yesterday",
    subject: "Question about enterprise plan",
    badge: "Sales",
    badgeBg: "#F1F5F9",
    badgeColor: "#475569",
    intelligence: {
      intent: "Enterprise Contract",
      customer: "Apex Capital",
      requirement: "Custom SLA & SOC2",
      knowledgeTags: ["Compliance docs", "SLA terms"],
      sourcesMatched: "5 security audits",
    },
    draft: {
      greeting: "Hi David,",
      body: "Our Enterprise plan includes SOC2 Type II reports, custom 99.99% uptime SLAs, and tailored compliance guarantees. I've attached our full security whitepaper.",
      signoff: "Best regards,\nSales Team",
    },
  },
];
