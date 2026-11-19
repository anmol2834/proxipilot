export interface LegalPolicyMeta {
  slug: string;
  title: string;
  shortTitle: string;
  category: "legal" | "trust";
  summary: string;
  effectiveDate: string;
  lastUpdated: string;
  pdfUrl?: string;
  docxUrl?: string;
  relatedSlugs: string[];
}

export interface SubprocessorEntry {
  name: string;
  category: string;
  purpose: string;
  dataProcessed: string;
  region: string;
  privacyUrl: string;
  status: "Active" | "Optional";
}

export const LEGAL_METADATA: Record<string, LegalPolicyMeta> = {
  terms: {
    slug: "terms",
    title: "Terms of Service",
    shortTitle: "Terms",
    category: "legal",
    summary:
      "The legally binding contract between you and Cheldain governing your access to and use of the ProxiPilot platform.",
    effectiveDate: "June 1, 2025",
    lastUpdated: "June 1, 2025",
    pdfUrl: "/ProxiPilot_Terms_and_Conditions.pdf",
    docxUrl: "/ProxiPilot_Terms_and_Conditions.docx",
    relatedSlugs: ["privacy", "acceptable-use", "refund", "dpa"],
  },
  privacy: {
    slug: "privacy",
    title: "Privacy Policy",
    shortTitle: "Privacy",
    category: "legal",
    summary:
      "Explains what personal and business data we collect, why we process it, your rights, and how we protect customer data.",
    effectiveDate: "June 1, 2025",
    lastUpdated: "June 1, 2025",
    pdfUrl: "/ProxiPilot_Privacy_Policy.pdf",
    docxUrl: "/ProxiPilot_Privacy_Policy.docx",
    relatedSlugs: ["cookies", "subprocessors", "data-retention"],
  },
  cookies: {
    slug: "cookies",
    title: "Cookie Policy",
    shortTitle: "Cookies",
    category: "legal",
    summary:
      "Details how ProxiPilot uses essential session cookies and optional privacy-focused analytics cookies.",
    effectiveDate: "June 1, 2025",
    lastUpdated: "November 14, 2026",
    relatedSlugs: ["privacy", "security", "privacy-request"],
  },
  "acceptable-use": {
    slug: "acceptable-use",
    title: "Acceptable Use Policy",
    shortTitle: "Acceptable Use",
    category: "legal",
    summary:
      "Defines prohibited conduct, anti-spam rules, AI usage limits, and platform security standards for all users.",
    effectiveDate: "June 1, 2025",
    lastUpdated: "November 14, 2026",
    relatedSlugs: ["terms", "email-sending-policy"],
  },
  "email-sending-policy": {
    slug: "email-sending-policy",
    title: "Email Sending & Anti-Spam Policy",
    shortTitle: "Email Sending Policy",
    category: "legal",
    summary:
      "Strict standards for consent, recipient permission, sender authentication, bounce rates, and anti-spam compliance.",
    effectiveDate: "June 1, 2025",
    lastUpdated: "November 14, 2026",
    relatedSlugs: ["acceptable-use", "terms", "integrations"],
  },
  refund: {
    slug: "refund",
    title: "Refund & Cancellation Policy",
    shortTitle: "Refund Policy",
    category: "legal",
    summary:
      "Details billing cycles, Merchant of Record terms (Paddle / Lemon Squeezy), subscription cancellations, and billing disputes.",
    effectiveDate: "June 1, 2025",
    lastUpdated: "November 14, 2026",
    relatedSlugs: ["terms"],
  },
  "grievance-redressal": {
    slug: "grievance-redressal",
    title: "Grievance Redressal Policy",
    shortTitle: "Grievance Redressal",
    category: "legal",
    summary:
      "Mechanism for handling user complaints, statutory grievance officer contact details, and resolution timelines.",
    effectiveDate: "June 1, 2025",
    lastUpdated: "November 14, 2026",
    relatedSlugs: ["privacy", "terms", "privacy-request"],
  },
  dpa: {
    slug: "dpa",
    title: "Data Processing Agreement",
    shortTitle: "DPA",
    category: "trust",
    summary:
      "Standard contractual clauses governing ProxiPilot as a Data Processor for customer mailbox and business data under GDPR.",
    effectiveDate: "June 1, 2025",
    lastUpdated: "November 14, 2026",
    relatedSlugs: ["subprocessors", "privacy", "security", "data-retention"],
  },
  subprocessors: {
    slug: "subprocessors",
    title: "Subprocessors List",
    shortTitle: "Subprocessors",
    category: "trust",
    summary:
      "Transparent schedule of third-party cloud infrastructure, AI models, and service providers used by ProxiPilot.",
    effectiveDate: "June 1, 2025",
    lastUpdated: "November 17, 2026",
    relatedSlugs: ["dpa", "privacy", "security"],
  },
  security: {
    slug: "security",
    title: "Security & Trust Center",
    shortTitle: "Security & Trust",
    category: "trust",
    summary:
      "Overview of ProxiPilot's technical and organizational security controls, encryption, tenant isolation, and audit protocols.",
    effectiveDate: "June 1, 2025",
    lastUpdated: "November 17, 2026",
    relatedSlugs: ["dpa", "data-retention", "subprocessors"],
  },
  "data-retention": {
    slug: "data-retention",
    title: "Data Retention & Deletion Policy",
    shortTitle: "Data Retention",
    category: "trust",
    summary:
      "Explicit lifecycle schedules for account profiles, email drafts, vector embeddings, OAuth tokens, and backup expiration.",
    effectiveDate: "June 1, 2025",
    lastUpdated: "November 17, 2026",
    relatedSlugs: ["privacy", "dpa", "privacy-request"],
  },
  "intellectual-property": {
    slug: "intellectual-property",
    title: "Intellectual Property & Copyright Policy",
    shortTitle: "Intellectual Property",
    category: "trust",
    summary:
      "Ownership boundaries between ProxiPilot's software and customer-owned email data, knowledge bases, and DMCA notice procedures.",
    effectiveDate: "June 1, 2025",
    lastUpdated: "November 17, 2026",
    relatedSlugs: ["terms", "acceptable-use"],
  },
  integrations: {
    slug: "integrations",
    title: "Third-Party Integration Terms",
    shortTitle: "Integration Terms",
    category: "trust",
    summary:
      "Governing terms for connecting Gmail (Google API Limited Use compliance) and Microsoft Outlook (Microsoft Graph API).",
    effectiveDate: "June 1, 2025",
    lastUpdated: "November 17, 2026",
    relatedSlugs: ["terms", "privacy", "security"],
  },
  "law-enforcement-requests": {
    slug: "law-enforcement-requests",
    title: "Law Enforcement & Government Requests",
    shortTitle: "Government Requests",
    category: "trust",
    summary:
      "Guidelines for how Cheldain evaluates and responds to legal process from government agencies and law enforcement bodies.",
    effectiveDate: "June 1, 2025",
    lastUpdated: "November 17, 2026",
    relatedSlugs: ["privacy", "dpa", "security"],
  },
  "privacy-request": {
    slug: "privacy-request",
    title: "Privacy Request Portal",
    shortTitle: "Privacy Requests",
    category: "trust",
    summary:
      "Exercise your rights under GDPR, CCPA, and DPDP to access, export, correct, or delete your personal data.",
    effectiveDate: "June 1, 2025",
    lastUpdated: "November 17, 2026",
    relatedSlugs: ["privacy", "dpa", "data-retention"],
  },
};

export const VERIFIED_SUBPROCESSORS: SubprocessorEntry[] = [
  {
    name: "OpenAI, LLC",
    category: "Artificial Intelligence",
    purpose: "Generates draft email responses and produces semantic text embeddings (text-embedding-3-large).",
    dataProcessed: "Customer prompts, referenced email snippets, and knowledge base query context.",
    region: "United States",
    privacyUrl: "https://openai.com/policies/privacy-policy",
    status: "Active",
  },
  {
    name: "Anthropic, PBC",
    category: "Artificial Intelligence",
    purpose: "Alternative AI foundation model provider for contextual reasoning and drafting.",
    dataProcessed: "Customer prompts, email thread context, and user drafting instructions.",
    region: "United States",
    privacyUrl: "https://www.anthropic.com/privacy",
    status: "Active",
  },
  {
    name: "Google LLC",
    category: "Email & OAuth Provider",
    purpose: "Gmail API integration for reading customer emails and dispatching authorized replies.",
    dataProcessed: "Email headers, thread messages, recipient addresses, and OAuth access/refresh tokens.",
    region: "United States / Global",
    privacyUrl: "https://policies.google.com/privacy",
    status: "Active",
  },
  {
    name: "Microsoft Corporation",
    category: "Email & OAuth Provider",
    purpose: "Microsoft Graph API integration for Outlook mailbox synchronization and message dispatch.",
    dataProcessed: "Email message content, recipient metadata, and OAuth delegated credentials.",
    region: "United States / Global",
    privacyUrl: "https://privacy.microsoft.com/privacystatement",
    status: "Active",
  },
  {
    name: "Neon, Inc.",
    category: "Cloud Database",
    purpose: "Serverless PostgreSQL database hosting workspace settings, account profiles, and audit records.",
    dataProcessed: "User profile data, workspace configs, encryption metadata, and billing records.",
    region: "Singapore / United States",
    privacyUrl: "https://neon.tech/privacy",
    status: "Active",
  },
  {
    name: "Upstash, Inc. / Docker Redis",
    category: "In-Memory Cache & Event Bus",
    purpose: "Distributed queueing, rate-limiting, and ephemeral pub/sub event bus streaming.",
    dataProcessed: "Ephemeral event tokens, task identifiers, and cache keys isolated by tenant ID.",
    region: "United States / Local Edge",
    privacyUrl: "https://upstash.com/trust/privacy.pdf",
    status: "Active",
  },
  {
    name: "Qdrant Solutions GmbH",
    category: "Vector Database",
    purpose: "Multi-tenant vector search engine for business document indexing and hybrid RAG context retrieval.",
    dataProcessed: "Document embeddings, text chunk vectors, and tenant isolation identifiers.",
    region: "Germany / Self-Hosted Cloud",
    privacyUrl: "https://qdrant.tech/legal/privacy-policy/",
    status: "Active",
  },
  {
    name: "Paddle.com Market Ltd / Lemon Squeezy",
    category: "Merchant of Record & Payments",
    purpose: "Payment processing, subscription billing, tax calculation, invoicing, and fraud prevention.",
    dataProcessed: "Customer billing name, business address, tax ID, payment method tokens, and invoices.",
    region: "United Kingdom / United States",
    privacyUrl: "https://www.paddle.com/legal/privacy",
    status: "Active",
  },
  {
    name: "Cloudflare, Inc.",
    category: "DNS, CDN & Security",
    purpose: "Edge traffic acceleration, TLS termination, Web Application Firewall (WAF), and DDoS protection.",
    dataProcessed: "IP addresses, HTTP request headers, and technical access logs.",
    region: "Global Edge Network",
    privacyUrl: "https://www.cloudflare.com/privacypolicy/",
    status: "Active",
  },
];

export const LEGAL_NAV_GROUPS = [
  {
    title: "Legal Agreements",
    links: [
      { slug: "terms", label: "Terms of Service", href: "/terms" },
      { slug: "privacy", label: "Privacy Policy", href: "/privacy" },
      { slug: "cookies", label: "Cookie Policy", href: "/cookies" },
      { slug: "acceptable-use", label: "Acceptable Use Policy", href: "/acceptable-use" },
      { slug: "email-sending-policy", label: "Email Sending & Anti-Spam", href: "/email-sending-policy" },
      { slug: "refund", label: "Refund & Cancellation", href: "/refund" },
      { slug: "grievance-redressal", label: "Grievance Redressal", href: "/grievance-redressal" },
    ],
  },
  {
    title: "Trust & Compliance",
    links: [
      { slug: "dpa", label: "Data Processing Agreement", href: "/dpa" },
      { slug: "subprocessors", label: "Subprocessors List", href: "/subprocessors" },
      { slug: "security", label: "Security & Trust Center", href: "/security" },
      { slug: "data-retention", label: "Data Retention & Deletion", href: "/data-retention" },
      { slug: "intellectual-property", label: "Intellectual Property Policy", href: "/intellectual-property" },
      { slug: "integrations", label: "Third-Party Integration Terms", href: "/integrations" },
      { slug: "law-enforcement-requests", label: "Government & Law Enforcement", href: "/law-enforcement-requests" },
      { slug: "privacy-request", label: "Privacy Request Portal", href: "/privacy-request" },
    ],
  },
];
