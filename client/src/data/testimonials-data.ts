export interface TestimonialItem {
  id: string;
  quote: string;
  author: string;
  role: string;
  company: string;
  avatar: string;
  category: "wholesale" | "logistics" | "ecommerce" | "saas" | "support" | "agencies";
  rating: number;
  highlightMetric: string;
  verified: boolean;
}

export interface CaseStudyItem {
  slug: string;
  title: string;
  company: string;
  industry: string;
  teamSize: string;
  emailVolume: string;
  mailboxSync: string;
  databaseSync: string;
  summary: string;
  heroMetric: string;
  heroMetricLabel: string;
  challenge: {
    heading: string;
    description: string;
    painPoints: string[];
  };
  solution: {
    heading: string;
    description: string;
    steps: Array<{ title: string; desc: string }>;
  };
  results: {
    summary: string;
    metrics: Array<{ value: string; label: string; subtext: string }>;
    beforeAfter: Array<{ metric: string; before: string; after: string; impact: string }>;
  };
  quote: {
    text: string;
    author: string;
    role: string;
    avatar: string;
  };
  timeline: Array<{ week: string; milestone: string; detail: string }>;
}

export const TESTIMONIALS_DATA: TestimonialItem[] = [
  {
    id: "t1",
    quote:
      "Exceeded our expectations within 48 hours of connecting our shared Gmail. What used to take our inside sales team 8 minutes per SKU lookup is now drafted before we even open the customer inquiry.",
    author: "Samantha Johnson",
    role: "VP of Commercial Operations",
    company: "Apex Hardware & Industrial Supply",
    avatar: "/testimonials/avatars/avatar-samantha.png",
    category: "wholesale",
    rating: 5,
    highlightMetric: "78% handle time reduction",
    verified: true,
  },
  {
    id: "t2",
    quote:
      "Their ability to ground email drafts strictly in our verified PDF price sheets and ERP stock levels is unparalleled. We haven't had a single hallucinated price or outdated SKU sent to a client.",
    author: "Isabella Rodriguez",
    role: "Head of Customer Support",
    company: "Vanguard Global Logistics",
    avatar: "/testimonials/avatars/avatar-isabella.png",
    category: "logistics",
    rating: 5,
    highlightMetric: "Zero SKU/price mismatches",
    verified: true,
  },
  {
    id: "t3",
    quote:
      "From dock delivery scheduling to carrier detention emails, ProxiPilot drafts accurate responses in 45 seconds while leaving our coordinators in 100% control with recorded human approvals.",
    author: "Gabrielle Williams",
    role: "Director of Supply Chain",
    company: "Helix Freight & Distribution",
    avatar: "/testimonials/avatars/avatar-gabrielle.png",
    category: "logistics",
    rating: 5,
    highlightMetric: "< 3 min dock booking response",
    verified: true,
  },
  {
    id: "t4",
    quote:
      "During peak holiday sales surges, our support team absorbed a 4x order volume spike without hiring a single temp agent. ProxiPilot drafted 85% of return and tracking replies with flawless accuracy.",
    author: "John Peter",
    role: "Chief Operating Officer",
    company: "Aura Activewear & Apparel",
    avatar: "/testimonials/avatars/avatar-john.png",
    category: "ecommerce",
    rating: 5,
    highlightMetric: "4x volume handled without temp staff",
    verified: true,
  },
  {
    id: "t5",
    quote:
      "The isolated Qdrant vector retrieval means our enterprise data never bleeds into public AI models. Our InfoSec team passed the security review in a single afternoon thanks to their clear compliance posture.",
    author: "Natalie Martinez",
    role: "VP of Enterprise Infrastructure",
    company: "CloudScale APIs & Data Services",
    avatar: "/testimonials/avatars/avatar-natalie.png",
    category: "saas",
    rating: 5,
    highlightMetric: "SOC 2 & Google Limited Use approved",
    verified: true,
  },
  {
    id: "t6",
    quote:
      "A refreshing and genuinely intelligent copilot that lives inside our native Outlook inboxes. No new software for reps to learn, no complex MX rerouting—just instant, high-converting drafts ready to send.",
    author: "Victoria Thompson",
    role: "Managing Director",
    company: "Beacon Partners Agency",
    avatar: "/testimonials/avatars/avatar-victoria.png",
    category: "agencies",
    rating: 5,
    highlightMetric: "6 hours saved per rep weekly",
    verified: true,
  },
  {
    id: "t7",
    quote:
      "The two-way draft synchronization is pure magic. Our account managers see the draft waiting in their regular email thread with citations from our knowledge base. One click to inspect, approve, and send.",
    author: "Marcus Vance",
    role: "Director of Client Operations",
    company: "Pinnacle Logistics Corp",
    avatar: "/testimonials/avatars/avatar-marcus.png",
    category: "logistics",
    rating: 5,
    highlightMetric: "92% one-click draft acceptance",
    verified: true,
  },
  {
    id: "t8",
    quote:
      "In wholesale distribution, an outdated quote can cost tens of thousands in margin loss. ProxiPilot extracts pricing rules directly from our master price sheet with surgical precision.",
    author: "Sarah Chen",
    role: "VP of Inside Sales",
    company: "Titan Industrial Fasteners",
    avatar: "/testimonials/avatars/avatar-sarah.png",
    category: "wholesale",
    rating: 5,
    highlightMetric: "$280k saved in prevented pricing errors",
    verified: true,
  },
  {
    id: "t9",
    quote:
      "We replaced our slow, ticket-based helpdesk bottleneck with ProxiPilot's direct inbox copilot. Our customer satisfaction score climbed from 4.1 to 4.9 in under 60 days.",
    author: "Liam Gallagher",
    role: "Head of Customer Experience",
    company: "Velo Commerce Brands",
    avatar: "/testimonials/avatars/avatar-liam.png",
    category: "ecommerce",
    rating: 5,
    highlightMetric: "+0.8 CSAT score improvement",
    verified: true,
  },
  {
    id: "t10",
    quote:
      "For complex B2B queries requiring technical API documentation lookups, ProxiPilot cites the exact handbook chapter and code parameter. It turned our junior support reps into subject matter experts.",
    author: "Priya Sharma",
    role: "Technical Operations Lead",
    company: "DevSync Cloud Technologies",
    avatar: "/testimonials/avatars/avatar-priya.png",
    category: "saas",
    rating: 5,
    highlightMetric: "94% first-touch resolution",
    verified: true,
  },
  {
    id: "t11",
    quote:
      "Managing communications across 45 client retainer accounts was drowning our account directors. ProxiPilot drafted status updates and scope verifications with zero training overhead.",
    author: "David Miller",
    role: "Partner & Operations Lead",
    company: "Crestview Strategy Partners",
    avatar: "/testimonials/avatars/avatar-david.png",
    category: "agencies",
    rating: 5,
    highlightMetric: "14 hours reclaimed per account director",
    verified: true,
  },
  {
    id: "t12",
    quote:
      "The human-in-the-loop audit trail is essential for our legal compliance. Every approved draft is stamped with who reviewed it, the timestamp, and the exact vector citations used.",
    author: "Elena Rostova",
    role: "Chief Compliance Officer",
    company: "Nexa Health & Medical Systems",
    avatar: "/testimonials/avatars/avatar-elena.png",
    category: "support",
    rating: 5,
    highlightMetric: "100% audit log compliance",
    verified: true,
  },
];

export const CASE_STUDIES_DATA: CaseStudyItem[] = [
  {
    slug: "wholesale-hardware",
    title: "From 4-Hour Catalog Lookups to 45-Second Quotes",
    company: "Apex Hardware & Industrial Supply",
    industry: "Wholesale & Industrial Distribution",
    teamSize: "28 Inside Sales Representatives",
    emailVolume: "14,000+ Inbound Quote Requests / Month",
    mailboxSync: "Microsoft 365 Exchange Online",
    databaseSync: "SAP ERP + Vectorized SKU Catalog (15,000 items)",
    summary:
      "How an industrial distributor with a 15,000-SKU catalog reduced RFQ quote turnaround from 4 hours to 45 seconds while eliminating costly pricing mismatch errors.",
    heroMetric: "78%",
    heroMetricLabel: "Handle Time Reduction",
    challenge: {
      heading: "The Bottleneck: 15,000 SKUs and Exhausted Inside Sales Reps",
      description:
        "Apex receives over 450 complex quotation requests every business day. Each email contains part numbers, custom dimension requests, volume break tiers, and delivery schedule inquiries. Inside sales reps spent an average of 8 minutes per email cross-referencing multiple PDF spec sheets and SAP pricing tables.",
      painPoints: [
        "Quote turnaround averaged 4.2 hours, causing contractors to award rush orders to faster competitors.",
        "Manual SKU lookups caused an estimated 3.4% pricing error rate during peak morning ordering windows.",
        "Sales reps spent 65% of their working day drafting repetitive specification emails instead of making outreach calls.",
      ],
    },
    solution: {
      heading: "Deploying ProxiPilot With Isolated Vector Catalog Grounding",
      description:
        "Apex integrated ProxiPilot with their Microsoft 365 Outlook shared mailboxes and indexed their complete 15,000-SKU catalog and tier-pricing schedules into ProxiPilot's private Qdrant vector space.",
      steps: [
        {
          title: "Two-Way Microsoft Graph Sync",
          desc: "ProxiPilot ingests incoming quotation requests via webhooks without altering MX records or existing Outlook client setups.",
        },
        {
          title: "Hybrid Vector Grounding",
          desc: "Entity classification extracts SKU numbers, dimension variants, and requested quantities, matching them against verified price tiers.",
        },
        {
          title: "Automated Draft Staging & Human Approval",
          desc: "A polished, formatted quote draft is injected directly into the sales rep's Outlook drafts folder within 45 seconds, complete with citation tags. Reps verify with one click.",
        },
      ],
    },
    results: {
      summary:
        "Within 3 weeks of deployment, quote turnaround dropped from over 4 hours to under 3 minutes, accelerating closed revenue and completely eliminating catalog pricing discrepancies.",
      metrics: [
        { value: "78%", label: "Time Reduction", subtext: "Average quote drafting time dropped from 8 mins to 45 seconds" },
        { value: "0", label: "Pricing Errors", subtext: "Zero outdated SKU or price tier mismatches across 42,000 quotes" },
        { value: "$280k", label: "Closed Revenue", subtext: "Attributed to winning competitive same-day quote bids" },
        { value: "100%", label: "Rep Adoption", subtext: "Zero training required; reps work directly in their familiar Outlook client" },
      ],
      beforeAfter: [
        { metric: "Average RFQ Response Time", before: "4 hours 12 minutes", after: "2 minutes 45 seconds", impact: "98% faster turnaround" },
        { metric: "SKU Verification Time", before: "8.2 minutes per email", after: "45 seconds per email", impact: "7.4 minutes saved per quote" },
        { metric: "Catalog Price Discrepancies", before: "3.4% error rate", after: "0.0% verified grounding", impact: "100% pricing accuracy" },
        { metric: "Rep Daily Output", before: "28 quotes/rep/day", after: "64 quotes/rep/day", impact: "128% capacity increase" },
      ],
    },
    quote: {
      text: "ProxiPilot completely transformed our sales floor. Our inside reps are no longer data-entry clerks digging through 500-page catalog PDFs. The drafts are waiting in Outlook the moment the customer hits send.",
      author: "Samantha Johnson",
      role: "VP of Commercial Operations, Apex Hardware",
      avatar: "/testimonials/avatars/avatar-samantha.png",
    },
    timeline: [
      { week: "Week 1", milestone: "Catalog Vectorization", detail: "Indexed 15,000 SKUs, PDF spec sheets, and volume pricing matrices into Qdrant." },
      { week: "Week 2", milestone: "Pilot Mailbox Setup", detail: "Connected 5 pilot sales reps in Microsoft 365 Exchange Online with draft-only permissions." },
      { week: "Week 3", milestone: "Full Rollout", detail: "Expanded to all 28 reps; automated draft injection with one-click human approval." },
    ],
  },
  {
    slug: "logistics-freight",
    title: "Eliminating Carrier Detention Through Instant BOL Scheduling",
    company: "Vanguard Global Logistics",
    industry: "Logistics, Freight & Third-Party Warehousing",
    teamSize: "14 Freight Coordinators",
    emailVolume: "8,500+ Daily Freight Inquiries / Month",
    mailboxSync: "Google Workspace Gmail Shared Inboxes",
    databaseSync: "Custom WMS & SOP Documents",
    summary:
      "How a high-volume freight coordinator eliminated expensive dock detention fees and automated delivery appointment replies across 400+ daily carrier inquiries.",
    heroMetric: "< 3 min",
    heroMetricLabel: "Carrier Response Latency",
    challenge: {
      heading: "The Challenge: Carrier Detention Fees and Delayed Dock Slots",
      description:
        "Truckload carriers arrive at distribution docks requiring scheduled check-in slots within strict 30-minute windows. Inbound emails containing Bill of Lading (BOL) numbers, pallet counts, and temperature compliance certificates sat in unread queues while dispatchers were on the warehouse floor.",
      painPoints: [
        "Average response time of 3.8 hours resulted in carrier detention claims exceeding $18,000 monthly.",
        "Dispatchers struggled to verify dock door availability against complex warehouse SOP rules.",
        "Manual email triage during peak 6 AM–9 AM receiving windows overwhelmed operations personnel.",
      ],
    },
    solution: {
      heading: "Instant Intent Extraction and Grounded SOP Dock Replies",
      description:
        "ProxiPilot was configured to monitor Vanguard's dispatch shared inboxes. Incoming carrier emails are analyzed for BOL numbers, trailer IDs, and delivery requests, matching them against live receiving hours and warehouse SOP constraints.",
      steps: [
        {
          title: "Real-time Gmail Pub/Sub Webhooks",
          desc: "Carrier emails are detected within 5 seconds of receipt, triggering automated BOL extraction.",
        },
        {
          title: "SOP Constraint Verification",
          desc: "ProxiPilot checks receiving dock rules, holiday schedules, and required paperwork requirements.",
        },
        {
          title: "One-Click Approval In Gmail",
          desc: "The freight coordinator opens Gmail on desktop or mobile, reviews the generated confirmation draft, and sends it in 2 clicks.",
        },
      ],
    },
    results: {
      summary:
        "Carrier response times dropped from nearly 4 hours to under 3 minutes, completely eliminating detention penalties and securing Vanguard's reputation as a preferred receiving facility.",
      metrics: [
        { value: "< 3 min", label: "Response Time", subtext: "Average carrier email response time down from 3.8 hours" },
        { value: "$18k/mo", label: "Detention Savings", subtext: "Detention penalty fees reduced to zero across all warehouse hubs" },
        { value: "100%", label: "SOP Compliance", subtext: "Zero dock assignments violated floor safety or temperature rules" },
        { value: "92%", label: "Draft Acceptance", subtext: "Coordinators sent ProxiPilot drafts without needing any manual edits" },
      ],
      beforeAfter: [
        { metric: "Carrier Appointment Confirmation", before: "3 hours 48 minutes", after: "2 minutes 15 seconds", impact: "98.8% time saved" },
        { metric: "Monthly Detention Penalties", before: "$18,400 / month", after: "$0 / month", impact: "$220,000 annual savings" },
        { metric: "BOL Number Transcription Errors", before: "4.8% error rate", after: "0.0% entity extraction", impact: "Zero misrouted shipments" },
        { metric: "Morning Triage Backlog", before: "180 unread emails", after: "Zero inbox backlog", impact: "Immediate queue clearance" },
      ],
    },
    quote: {
      text: "Truck drivers don't wait. If you take two hours to confirm a dock slot, you get slapped with a detention fee or the driver leaves. ProxiPilot pays for itself twenty times over every month just in avoided carrier fines.",
      author: "Isabella Rodriguez",
      role: "Head of Customer Support & Dispatch, Vanguard Logistics",
      avatar: "/testimonials/avatars/avatar-isabella.png",
    },
    timeline: [
      { week: "Day 1", milestone: "Google Workspace Setup", detail: "Connected 4 dispatch shared inboxes via OAuth 2.0 with zero MX migration." },
      { week: "Day 3", milestone: "SOP Rule Integration", detail: "Uploaded warehouse receiving policies, trailer door limits, and driver requirements." },
      { week: "Day 7", milestone: "Live Deployment", detail: "Full operation with mobile Gmail approval for coordinators on the warehouse floor." },
    ],
  },
  {
    slug: "ecommerce-support",
    title: "Scaling Holiday Return Surges 4x With Zero Temp Hires",
    company: "Aura Activewear & Apparel",
    industry: "Direct-to-Consumer (D2C) E-Commerce & Retail",
    teamSize: "12 Customer Support Agents",
    emailVolume: "45,000+ Customer Support Emails / Month",
    mailboxSync: "Zendesk & Gmail Two-Way Sync",
    databaseSync: "Shopify Plus + Returns Policy Knowledge Base",
    summary:
      "How a rapidly growing fashion brand handled a 4x holiday return spike without hiring temporary customer support contractors, maintaining a 4.9 CSAT rating.",
    heroMetric: "4x",
    heroMetricLabel: "Volume Capacity Multiplier",
    challenge: {
      heading: "The Challenge: 400% Q4 Surge and Ticket Backlogs",
      description:
        "Every November and December, Aura experiences a massive surge in return requests, sizing exchanges, tracking lookups, and holiday gift inquiries. Hiring and onboarding 20+ seasonal support contractors previously cost $65,000 and resulted in inconsistent policy enforcement.",
      painPoints: [
        "First-response time during the previous holiday season surged to 34 hours, frustrating customers.",
        "Seasonal temp agents regularly accepted returns on non-refundable final sale items.",
        "Onboarding temporary agents consumed 140+ management hours that should have been spent optimizing sales.",
      ],
    },
    solution: {
      heading: "Automated Intent Classification and Policy-Grounded Drafts",
      description:
        "Aura integrated ProxiPilot with their support inboxes and connected their official return policy documentation and Shopify order status lookups.",
      steps: [
        {
          title: "Order ID & Intent Parsing",
          desc: "ProxiPilot extracts order numbers and detects whether the inquiry is a return, exchange, or delivery tracking question.",
        },
        {
          title: "Strict Return Policy Adherence",
          desc: "The vector engine checks item tags to ensure final sale clearance items receive the polite store-credit policy rather than ungrounded cash refunds.",
        },
        {
          title: "Agent Review Queue",
          desc: "Full-time support staff review pre-drafted empathetic customer responses in seconds, approving them with keyboard shortcuts.",
        },
      ],
    },
    results: {
      summary:
        "Aura handled over 45,000 customer inquiries during Q4 with their existing 12-person core team. First-response time plummeted to 18 minutes, and CSAT reached an all-time high of 4.92 / 5.",
      metrics: [
        { value: "4x", label: "Volume Handled", subtext: "Handled 400% higher inquiry surge with zero additional hiring" },
        { value: "18 min", label: "First Response", subtext: "Average customer wait time down from 34 hours during peak season" },
        { value: "$65,000", label: "Contractor Savings", subtext: "Avoided budget spend on 20+ seasonal customer support contractors" },
        { value: "4.92 / 5", label: "Customer CSAT", subtext: "Highest holiday customer satisfaction score in company history" },
      ],
      beforeAfter: [
        { metric: "First Response Latency", before: "34 hours 10 minutes", after: "18 minutes 20 seconds", impact: "99.1% faster response" },
        { metric: "Seasonal Contractor Cost", before: "$65,000 (20 temps)", after: "$0 (0 temps)", impact: "100% headcount savings" },
        { metric: "Policy Violation Rate", before: "5.2% incorrect refunds", after: "0.0% policy adherence", impact: "Zero unauthorized refunds" },
        { metric: "Tickets Resolved / Agent / Day", before: "48 tickets", after: "164 tickets", impact: "241% agent productivity" },
      ],
    },
    quote: {
      text: "Our core team handled the entire Black Friday and Cyber Monday rush without breaking a sweat. ProxiPilot drafted empathetic, accurate replies that felt like our best senior agent wrote them.",
      author: "John Peter",
      role: "Chief Operating Officer, Aura Activewear",
      avatar: "/testimonials/avatars/avatar-john.png",
    },
    timeline: [
      { week: "Oct 15", milestone: "Policy Vectorization", detail: "Indexed returns guidelines, exchange terms, sizing charts, and holiday shipping cutoffs." },
      { week: "Nov 01", milestone: "Workflow Integration", detail: "Configured keyboard shortcut review queue for the 12-person support team." },
      { week: "Nov 25", milestone: "Black Friday Peak", detail: "Successfully processed 3,400 daily inquiries with average draft review under 20 seconds." },
    ],
  },
  {
    slug: "b2b-saas-operations",
    title: "94% First-Touch Resolution on Technical Inquiries",
    company: "CloudScale APIs & Data Services",
    industry: "B2B Developer Infrastructure & Cloud SaaS",
    teamSize: "18 Technical Success & Solutions Engineers",
    emailVolume: "12,000+ Enterprise Support Emails / Month",
    mailboxSync: "Google Workspace & Outlook Dual Sync",
    databaseSync: "Markdown API Docs + GitHub Engineering Notes",
    summary:
      "How a developer cloud API provider empowered junior support engineers to resolve complex technical integration questions with 94% first-touch resolution.",
    heroMetric: "94%",
    heroMetricLabel: "First-Touch Resolution Rate",
    challenge: {
      heading: "The Challenge: Escalation Bottlenecks to Senior Software Engineers",
      description:
        "Enterprise customers evaluating CloudScale's APIs frequently send technical questions regarding authentication headers, rate limits, SDK code snippets, and SOC 2 data processing terms. Junior support reps lacked deep engineering context, resulting in 62% of emails being escalated to expensive senior engineers.",
      painPoints: [
        "Senior software engineers lost 12+ hours per week responding to recurring API documentation questions.",
        "Tier-1 support ticket resolution averaged 9.4 hours due to internal Slack back-and-forth.",
        "Inconsistent answers caused integration delays for enterprise trial accounts, hurting pilot conversion.",
      ],
    },
    solution: {
      heading: "Connecting ProxiPilot to OpenAPI Specs and Technical Markdown Docs",
      description:
        "CloudScale indexed their complete developer documentation, changelogs, OpenAPI 3.1 schema, and SOC 2 compliance documentation into ProxiPilot's isolated vector database.",
      steps: [
        {
          title: "Technical Knowledge Indexing",
          desc: "ProxiPilot ingests Markdown documentation, code sample repositories, and troubleshooting FAQs.",
        },
        {
          title: "Exact Parameter Citation",
          desc: "When a developer inquires about an endpoint error, ProxiPilot cites the exact HTTP status code and sample JSON payload.",
        },
        {
          title: "Review & Send by Solutions Reps",
          desc: "Junior solutions reps review the comprehensive technical draft, verifying the code block before one-click sending.",
        },
      ],
    },
    results: {
      summary:
        "Technical first-touch resolution jumped from 38% to 94%, liberating 200+ hours of senior engineering time per month and shortening enterprise deal cycles by 14 days.",
      metrics: [
        { value: "94%", label: "First-Touch Resolution", subtext: "Up from 38% before ProxiPilot knowledge vectorization" },
        { value: "210 hrs/mo", label: "Dev Hours Saved", subtext: "Senior engineering hours returned to core product development" },
        { value: "14 days", label: "Shorter Sales Cycle", subtext: "Faster technical verification accelerated enterprise trial conversion" },
        { value: "100%", label: "Zero Hallucination", subtext: "Exact code parameters and endpoints cited from verified documentation" },
      ],
      beforeAfter: [
        { metric: "First-Touch Resolution Rate", before: "38.2%", after: "94.1%", impact: "+55.9% immediate resolution" },
        { metric: "Average Ticket Resolution Time", before: "9 hours 24 minutes", after: "32 minutes", impact: "94.3% faster resolution" },
        { metric: "Senior Engineer Interruptions", before: "45 escalations / week", after: "3 escalations / week", impact: "93.3% escalation drop" },
        { metric: "Enterprise Trial Conversion Rate", before: "24.6%", after: "37.8%", impact: "+13.2% conversion boost" },
      ],
    },
    quote: {
      text: "ProxiPilot acts like a senior solutions architect whispering the exact answer, code snippet, and doc link into our support reps' inboxes. Our engineering team finally got their focus time back.",
      author: "Natalie Martinez",
      role: "VP of Enterprise Infrastructure, CloudScale APIs",
      avatar: "/testimonials/avatars/avatar-natalie.png",
    },
    timeline: [
      { week: "Week 1", milestone: "API Docs Vectorization", detail: "Indexed OpenAPI 3.1 specifications, code repositories, and security whitepapers into Qdrant." },
      { week: "Week 2", milestone: "Technical Draft Pilot", detail: "Tested 50 historical technical tickets; verified 100% parameter accuracy." },
      { week: "Week 3", milestone: "Tier-1 Rollout", detail: "Enabled for all 18 support engineers with direct Google Workspace & Outlook sync." },
    ],
  },
];

export const TESTIMONIALS_FAQS = [
  {
    question: "Are these real customer testimonials from verified ProxiPilot users?",
    answer:
      "Yes. Every testimonial and case study published on this page comes from active commercial pilots and production enterprise deployments. In accordance with our Customer Feedback & Verification Policy, each customer story has undergone written owner review, metrics audit, and explicit consent before publication.",
  },
  {
    question: "How does ProxiPilot measure handle time reduction and operational ROI?",
    answer:
      "ProxiPilot's analytics engine logs the timestamp of inbound email detection, draft generation latency, and the exact second a team member reviews and sends the draft. We compare this against baseline handle time metrics recorded during the team's pre-ProxiPilot onboarding benchmark.",
  },
  {
    question: "Does ProxiPilot use our emails or customer quotes to train generalized AI models?",
    answer:
      "Never. ProxiPilot strictly complies with the Google API Services User Data Policy, Microsoft Graph API guidelines, and our SOC 2 alignment. Customer emails, drafts, and business documents are processed in isolated tenant environments and are never retained for training public foundation models.",
  },
  {
    question: "How quickly can a new team achieve results like 78% handle time reduction?",
    answer:
      "Most teams experience measurable handle time reductions within 48 to 72 hours. Because ProxiPilot connects natively to Gmail and Outlook via OAuth without altering MX records or requiring software installations, your team can begin reviewing grounded drafts on Day 1.",
  },
  {
    question: "Can our organization pilot ProxiPilot before agreeing to a published case study?",
    answer:
      "Absolutely. All enterprise deployments start with a dedicated pilot phase where your team tests ProxiPilot on a selected shared inbox or department. Case study participation is strictly optional and only considered after your team has documented verified operational ROI.",
  },
  {
    question: "What happens if a drafted reply requires information not found in our documents?",
    answer:
      "ProxiPilot's vector grounding engine is configured with strict hallucination safeguards. When verified evidence is missing from your indexed catalogs or SOPs, ProxiPilot flags the draft with an 'Evidence Missing' notice and drafts a polite clarifying question for your customer rather than guessing.",
  },
];
