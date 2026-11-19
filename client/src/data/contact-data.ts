export interface DepartmentDesk {
  id: string;
  slug: string;
  title: string;
  email: string;
  sla: string;
  badge: string;
  badgeColor: string;
  badgeBg: string;
  badgeBorder: string;
  description: string;
  topics: string[];
}

export const DEPARTMENT_DESKS: DepartmentDesk[] = [
  {
    id: "sales",
    slug: "sales",
    title: "Enterprise Sales & Custom Pricing",
    email: "sales@proxipilot.com",
    sla: "< 2 Hour Response",
    badge: "Commercial Inquiries",
    badgeColor: "#635BFF",
    badgeBg: "#F5F3FF",
    badgeBorder: "#DDD6FE",
    description:
      "Custom volume pricing tiers, multi-brand workspace setups, dedicated VPC deployments, and RFP inquiries.",
    topics: [
      "High-volume inbound mailbox pricing (10k+ emails/mo)",
      "Multi-tenant team management and SSO rollout",
      "Custom Service Level Agreements (SLAs)",
      "Procurement contracts and vendor risk assessments",
    ],
  },
  {
    id: "support",
    slug: "support",
    title: "Customer & Technical Support Desk",
    email: "hello@proxipilot.com",
    sla: "< 4 Hour Response",
    badge: "Technical Operations",
    badgeColor: "#059669",
    badgeBg: "#ECFDF5",
    badgeBorder: "#A7F3D0",
    description:
      "OAuth 2.0 connection diagnostics, knowledge base vector tuning, draft sync troubleshooting, and workspace administration.",
    topics: [
      "Gmail & Microsoft Graph API sync diagnostics",
      "Vector catalog and PDF knowledge tuning",
      "Team member seat provisioning and permissions",
      "Webhook delivery and API integration debugging",
    ],
  },
  {
    id: "security",
    slug: "security",
    title: "Security, Privacy & Legal Office",
    email: "legal@proxipilot.com",
    sla: "Same-Day Response",
    badge: "Governance & DPA",
    badgeColor: "#475569",
    badgeBg: "#F1F5F9",
    badgeBorder: "#CBD5E1",
    description:
      "Data Processing Agreements (DPAs), SOC 2 reports, Google API Limited Use verification, and compliance reviews.",
    topics: [
      "Custom Enterprise Data Processing Agreements (DPA)",
      "SOC 2 Type II audit report requests",
      "Google API User Data Policy compliance audits",
      "Data residency and zero-retention architecture",
    ],
  },
  {
    id: "partners",
    slug: "partners",
    title: "Channel & Solution Partners",
    email: "partners@proxipilot.com",
    sla: "1 Business Day",
    badge: "Ecosystem & MSPs",
    badgeColor: "#B45309",
    badgeBg: "#FFFBEB",
    badgeBorder: "#FDE68A",
    description:
      "Agency revenue sharing, Managed Service Provider (MSP) bundles, system integration partners, and CRM co-marketing.",
    topics: [
      "Digital agency & customer support BPO partnerships",
      "ERP, WMS, and Shopify system integration consulting",
      "Certified ProxiPilot implementation partner status",
      "Revenue sharing and co-marketing opportunities",
    ],
  },
];

export const RESPONSE_SLAS = [
  {
    tier: "Severity 1: Critical Emergency",
    responseTime: "< 1 Hour",
    availability: "24/7/365 Monitoring",
    description: "Production mail sync interruption or complete workspace failure affecting business operations.",
    color: "#DC2626",
    bg: "#FEF2F2",
    border: "#FCA5A5",
  },
  {
    tier: "Severity 2: High Operational Impact",
    responseTime: "< 4 Hours",
    availability: "Mon–Fri, 9 AM – 6 PM EST",
    description: "Specific mailbox draft delay, knowledge base indexing stall, or degradation of non-critical features.",
    color: "#D97706",
    bg: "#FFFBEB",
    border: "#FCD34D",
  },
  {
    tier: "Severity 3: General Inquiries & Sales",
    responseTime: "< 2 Hours",
    availability: "Mon–Fri, 9 AM – 6 PM EST",
    description: "Enterprise trial requests, workspace configuration guidance, licensing, and billing questions.",
    color: "#2563EB",
    bg: "#EFF6FF",
    border: "#BFDBFE",
  },
  {
    tier: "Severity 4: Feature Requests & Enhancements",
    responseTime: "< 24 Hours",
    availability: "Business Days",
    description: "Product roadmap feedback, new connector requests, documentation updates, and general feedback.",
    color: "#059669",
    bg: "#ECFDF5",
    border: "#A7F3D0",
  },
];

export const GLOBAL_OFFICES = [
  {
    city: "San Francisco, USA",
    region: "Americas Headquarters",
    address: "548 Market Street, Suite 8200, San Francisco, CA 94104",
    phone: "+1 (888) 776-9474",
    email: "us@proxipilot.com",
    timezone: "PST / EST Coverage",
  },
  {
    city: "London, United Kingdom",
    region: "EMEA Regional Desk",
    address: "100 Bishopsgate, Level 19, London EC2N 4AG",
    phone: "+44 (20) 7946 0912",
    email: "emea@proxipilot.com",
    timezone: "GMT / CET Coverage",
  },
  {
    city: "Bengaluru, India",
    region: "Asia-Pacific Engineering Hub",
    address: "Indiranagar 100ft Road, Bengaluru, Karnataka 560038",
    phone: "+91 (80) 4123 9876",
    email: "apac@proxipilot.com",
    timezone: "IST Coverage",
  },
];

export const CONTACT_FAQS = [
  {
    question: "How fast will our team receive a response to an inquiry?",
    answer:
      "Commercial and enterprise sales inquiries receive a response within 2 hours during standard business hours (Monday to Friday, 9:00 AM to 6:00 PM EST). Technical support tickets for active pilot workspaces are answered in under 4 hours, and critical Severity-1 service alerts are monitored 24/7/365 with a sub-1 hour response guarantee.",
  },
  {
    question: "Can we test ProxiPilot with our own team mailboxes before speaking with sales?",
    answer:
      "Yes. You can start a free 14-day trial without entering a credit card. ProxiPilot connects natively to your Google Workspace or Microsoft 365 environment in under 5 minutes with zero MX record alterations. If you need a guided evaluation or custom security review, our sales engineers can join your team on a live walkthrough.",
  },
  {
    question: "How does ProxiPilot sign enterprise Data Processing Agreements (DPAs)?",
    answer:
      "We provide standardized, pre-executed DPAs compliant with GDPR, CCPA, and enterprise privacy standards. For custom enterprise legal terms or procurement agreements, submit your inquiry to legal@proxipilot.com or select the 'Security, DPA & Compliance' option in our contact form.",
  },
  {
    question: "Where can we request a custom security questionnaire or SOC 2 report?",
    answer:
      "We regularly complete enterprise vendor security questionnaires (CAIQ, VSA, SIG Lite). You can upload or email your questionnaire directly to legal@proxipilot.com or visit our dedicated Security Portal at /security to view our Google Limited Use certification and architectural controls.",
  },
  {
    question: "Is dedicated live support available for our team?",
    answer:
      "Yes. Enterprise plan tiers and active commercial pilot accounts receive direct support escalation and private Slack/Teams channels with our solutions engineering team. You can reach our team directly at hello@proxipilot.com or schedule a walkthrough.",
  },
  {
    question: "What information should we include when reporting a technical sync inquiry?",
    answer:
      "To help us resolve your inquiry as quickly as possible, please include your ProxiPilot workspace ID, the affected mailbox provider (Gmail or Outlook), approximate email timestamps, and any relevant screenshot of the draft queue or error notification.",
  },
];
