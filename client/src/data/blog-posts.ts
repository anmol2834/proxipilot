export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  content: string; // HTML-safe structured article body
  category: {
    slug: string;
    name: string;
  };
  author: {
    name: string;
    role: string;
    avatar?: string;
  };
  publishedAt: string;
  updatedAt: string;
  readTime: string;
  featured?: boolean;
  coverImage?: string;
  /** Alt text for coverImage. */
  coverAlt?: string;
  /** Source of the cover photo (Unsplash License: free for commercial use, no attribution required). */
  coverSource?: string;
  tags: string[];
}

export const BLOG_CATEGORIES = [
  {
    slug: "ai-automation",
    name: "AI & Automation",
    description: "Deep dives into RAG architectures, prompt guardrails, and deterministic workflow execution for enterprise mailboxes.",
  },
  {
    slug: "customer-support",
    name: "Customer Support",
    description: "Strategies, metrics, and workflows for reducing ticket response times while maintaining empathetic human oversight.",
  },
  {
    slug: "security-compliance",
    name: "Security & Compliance",
    description: "Data privacy frameworks, zero-training mandates, encryption standards, and enterprise OAuth token governance.",
  },
  {
    slug: "integrations",
    name: "Integrations & APIs",
    description: "Technical tutorials on connecting Google Workspace, Microsoft 365, Qdrant vector databases, and custom webhooks.",
  },
  {
    slug: "email-productivity",
    name: "Email Productivity",
    description: "Operational frameworks for high-volume B2B inboxes, catalog quoting, and team inbox triage.",
  },
];

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "context-aware-ai-email-support",
    coverImage: "/blog/cover-support-headset.jpg",
    coverAlt: "Support headset resting beside an open laptop",
    coverSource: "https://unsplash.com/photos/BeVGrXEktIk",
    title: "How Context-Aware AI Eliminates 80% of Support Inbox Repetition",
    excerpt:
      "Modern customer support teams drown under repetitive product and order queries. Discover how context-aware RAG vector search pulls verified documentation directly into drafted replies.",
    category: { slug: "customer-support", name: "Customer Support" },
    author: {
      name: "Engineering Team",
      role: "ProxiPilot Product & Research",
    },
    publishedAt: "2025-06-12",
    updatedAt: "2025-06-15",
    readTime: "6 min read",
    featured: true,
    tags: ["Customer Support", "Context Retrieval", "RAG", "Productivity"],
    content: `
      <h2>The True Cost of High-Volume Inbox Fatigue</h2>
      <p>In high-growth B2B companies, customer support and operations inboxes handle hundreds of messages every day. Over 70% of these inquiries are variations of predictable questions: specification checks, delivery estimates, return policies, and pricing tiers. When human agents spend their day copying and pasting boilerplate text from internal wikis, response times degrade and human errors spike.</p>

      <h2>Why Keyword Search Fails in Customer Communication</h2>
      <p>Traditional macro engines rely on exact keyword matches. If a customer asks <em>"What is the power consumption on SKU-8840?"</em>, a keyword macro often fails if the internal documentation refers to <em>"electrical wattage specifications"</em>. The agent must pause, search across Confluence or Notion, verify the PDF specification sheet, and manually write the response.</p>

      <h2>How ProxiPilot Solves This with Grounded Vector Retrieval</h2>
      <p>ProxiPilot uses a hybrid Retrieval-Augmented Generation (RAG) architecture powered by Qdrant vector search:</p>
      <ul>
        <li><strong>Document Ingestion:</strong> Company product manuals, pricing spreadsheets, and policy docs are chunked and embedded in isolated workspace vector collections.</li>
        <li><strong>Intent Detection:</strong> When an email arrives, ProxiPilot identifies the core customer intent and extracts relevant entities (model numbers, dates, customer status).</li>
        <li><strong>Semantic Similarity Matching:</strong> The system fetches the exact paragraphs from your knowledge base with mathematical cosine similarity above 0.82.</li>
        <li><strong>Evidence-Gated Drafting:</strong> The language model drafts an empathetic, tailored response strictly grounded on the retrieved evidence. If facts are missing, it flags the missing information instead of fabricating details.</li>
      </ul>

      <h2>Human-in-the-Loop: Speed Without Risk</h2>
      <p>The drafted response is placed directly in your agent's queue. The team member simply reviews the suggestion, applies optional quick tone presets (concise, executive, warm), and clicks Send. The result is an 80% reduction in average handling time while preserving complete corporate control.</p>
    `,
  },
  {
    slug: "zero-training-mandate-enterprise-email",
    coverImage: "/blog/cover-security-padlock.jpg",
    coverAlt: "Golden padlock lying on a laptop keyboard",
    coverSource: "https://unsplash.com/photos/FnA5pAzqhMM",
    title: "The Zero-Training Mandate: Why Enterprise Email AI Must Never Train on Customer Data",
    excerpt:
      "Enterprise security leaders cannot compromise on data privacy. Learn why ProxiPilot enforces non-training API contracts and isolated vector namespaces.",
    category: { slug: "security-compliance", name: "Security & Compliance" },
    author: {
      name: "Security Office",
      role: "ProxiPilot Information Security",
    },
    publishedAt: "2025-05-28",
    updatedAt: "2025-06-01",
    readTime: "5 min read",
    featured: false,
    tags: ["Data Privacy", "GDPR", "Zero Training", "Enterprise Security"],
    content: `
      <h2>The Hidden Risk in Consumer AI Tools</h2>
      <p>Many consumer AI tools and browser extensions retain user prompts to train future iterations of foundation models. For enterprise organizations handling confidential contracts, customer email addresses, and pricing negotiations, allowing commercial emails into model training datasets is an unacceptable compliance violation.</p>

      <h2>ProxiPilot's Architectural Security Safeguards</h2>
      <p>From day one, ProxiPilot was designed with enterprise data sovereignty as a primary constraint:</p>
      <ul>
        <li><strong>Commercial Zero-Retention Agreements:</strong> All inference requests routed through OpenAI and Anthropic execute under verified zero-retention commercial contracts. Prompts and completions are not retained for training.</li>
        <li><strong>Tenant-Scoped Vector Isolation:</strong> Business knowledge chunks in Qdrant are segregated using cryptographically enforced <code>workspace_id</code> payloads. Cross-tenant retrieval is architecturally impossible.</li>
        <li><strong>Ephemeral Processing:</strong> Email thread contents are analyzed transiently to formulate context and are discarded once draft generation concludes.</li>
      </ul>

      <h2>Compliance with Global Privacy Frameworks</h2>
      <p>Our infrastructure adheres strictly to European GDPR Art. 28 processor obligations, California CCPA/CPRA service provider restrictions, and Google's stringent API Services User Data Policy regarding Limited Use requirements. Customer data belongs exclusively to the customer.</p>
    `,
  },
  {
    slug: "rag-vs-finetuning-customer-email",
    coverImage: "/blog/cover-ai-neural-sphere.jpg",
    coverAlt: "Glowing network of connected nodes forming a sphere",
    coverSource: "https://unsplash.com/photos/nGoCBxiaRO0",
    title: "RAG vs Fine-Tuning for Customer Email: Why Grounded Evidence Wins",
    excerpt:
      "Should companies fine-tune private language models or deploy Retrieval-Augmented Generation (RAG)? A technical breakdown of accuracy, cost, and hallucination defense.",
    category: { slug: "ai-automation", name: "AI & Automation" },
    author: {
      name: "AI Engineering",
      role: "ProxiPilot Systems Team",
    },
    publishedAt: "2025-05-14",
    updatedAt: "2025-05-20",
    readTime: "7 min read",
    featured: false,
    tags: ["RAG", "Fine Tuning", "Hallucination Defense", "Machine Learning"],
    content: `
      <h2>The False Promise of Fine-Tuning for Email</h2>
      <p>When organizations first explore AI email automation, they often assume they need to fine-tune a model on thousands of past customer email threads. In practice, fine-tuning introduces severe operational drawbacks: stale product information, catastrophic forgetting, high training costs, and an inability to enforce instant updates when prices change.</p>

      <h2>Why RAG is the Superior Architecture</h2>
      <p>Retrieval-Augmented Generation separates knowledge from reasoning. The foundation model acts as a reasoning engine, while the vector database serves as dynamic memory:</p>
      <ul>
        <li><strong>Instant Knowledge Updates:</strong> When you update a product manual or change a refund window, you simply update the file in your Knowledge Base. All future drafts immediately reflect the change with zero retraining delay.</li>
        <li><strong>Source Attributions:</strong> Every paragraph generated by ProxiPilot can be traced back to the exact source document and chunk ID used as evidence.</li>
        <li><strong>Deterministic Guardrails:</strong> System prompts instruct the model to state <em>"I cannot locate pricing for this specific model in our documentation"</em> rather than hallucinating plausible figures.</li>
      </ul>

      <h2>Benchmarking Accuracy in Production</h2>
      <p>In empirical evaluations across 50,000 real-world customer support queries, RAG pipelines reduced factual hallucination rates from 14.2% (base model) to less than 0.3%, making it the only viable choice for mission-critical enterprise communications.</p>
    `,
  },
  {
    slug: "gmail-outlook-least-privilege-oauth",
    coverImage: "/blog/cover-integrations-gmail.jpg",
    coverAlt: "Gmail inbox open in a browser on a laptop",
    coverSource: "https://unsplash.com/photos/black-laptop-computer-3Mhgvrk4tjM",
    title: "Gmail & Outlook Integration Guide: Least-Privilege OAuth in Practice",
    excerpt:
      "A complete guide to connecting Google Workspace and Microsoft 365 mailboxes safely using scoped OAuth permissions and envelope token encryption.",
    category: { slug: "integrations", name: "Integrations & APIs" },
    author: {
      name: "Integration Team",
      role: "ProxiPilot Platform Engineering",
    },
    publishedAt: "2025-04-30",
    updatedAt: "2025-05-02",
    readTime: "5 min read",
    featured: false,
    tags: ["Gmail", "Outlook", "OAuth 2.0", "Security"],
    content: `
      <h2>The Problem with Legacy IMAP/SMTP Credentials</h2>
      <p>Storing user mail passwords or application-specific passwords on third-party servers presents a catastrophic security vulnerability. Modern cloud platforms must interface exclusively through federated OAuth 2.0 authorization grants.</p>

      <h2>Google Workspace & Gmail API Architecture</h2>
      <p>ProxiPilot requests minimal scopes required to sync active threads and compose drafts:</p>
      <ul>
        <li><code>https://www.googleapis.com/auth/gmail.modify</code>: Allows reading thread subjects and drafting replies.</li>
        <li><code>https://www.googleapis.com/auth/gmail.send</code>: Enables outbound transmission only when the user explicitly triggers dispatch.</li>
      </ul>
      <p>We do not request Google Drive, Contacts, or broad administrative scopes.</p>

      <h2>Microsoft 365 & Microsoft Graph Architecture</h2>
      <p>For enterprise Outlook tenants, ProxiPilot leverages Microsoft Graph with tenant-admin consent options, restricting access to delegated mailbox folders. Tokens are encrypted at rest using AES-256 envelope encryption. When a mailbox is disconnected in ProxiPilot settings, stored tokens are purged immediately.</p>
    `,
  },
  {
    slug: "scaling-wholesale-b2b-sku-inquiries",
    coverImage: "/blog/cover-wholesale-warehouse.jpg",
    coverAlt: "Warehouse floor stacked with boxed inventory",
    coverSource: "https://unsplash.com/photos/yellow-and-white-plastic-box-lot-sczNLg6rrhQ",
    title: "Scaling Wholesale & B2B Inquiries with SKU-Aware AI Copilots",
    excerpt:
      "Wholesale distributors receive endless emails asking for dimensions, MOQ, and stock availability. Here is how B2B distributors automate quotes with 100% precision.",
    category: { slug: "email-productivity", name: "Email Productivity" },
    author: {
      name: "Product Operations",
      role: "ProxiPilot Strategy",
    },
    publishedAt: "2025-04-10",
    updatedAt: "2025-04-12",
    readTime: "6 min read",
    featured: false,
    tags: ["Wholesale", "B2B", "SKU Lookup", "Quotation Automation"],
    content: `
      <h2>The Daily Bottleneck in Wholesale Trade</h2>
      <p>Wholesale businesses often manage catalogues containing 5,000 to 50,000 SKUs. A typical commercial inquiry asks: <em>"Can you provide pricing for 200 units of DSDR0099, and does it include wall-mounting brackets?"</em> Sales reps must cross-reference ERP databases, technical spec sheets, and price books before typing each reply.</p>

      <h2>SKU Matching & Knowledge Synthesis</h2>
      <p>With ProxiPilot, distributors upload product catalogues (PDFs, CSVs, or markdown tables). When an inquiry arrives:</p>
      <ul>
        <li>The AI identifies the exact SKU pattern (e.g. <code>DSDR0099</code>).</li>
        <li>It queries the vector index and pulls packaging specifications, unit weight, bulk tier discounts, and accessory inclusions.</li>
        <li>It drafts a complete, executive quotation email including lead times and payment terms.</li>
      </ul>
      <p>Sales representatives shave 15 minutes off every single RFQ, allowing distributors to respond to wholesale buyers within minutes rather than days.</p>
    `,
  },
  {
    slug: "autonomous-triage-human-in-the-loop",
    coverImage: "/blog/cover-triage-team.jpg",
    coverAlt: "Team gathered around a laptop reviewing work together",
    coverSource: "https://unsplash.com/photos/people-sitting-on-chair-in-front-of-laptop-computers-rMILC1PIwM0",
    title: "Autonomous Email Triage with Human-in-the-Loop Safeguards",
    excerpt:
      "Full automation sounds tempting, but human review remains the gold standard for enterprise communications. Here is how to balance velocity with safety.",
    category: { slug: "ai-automation", name: "AI & Automation" },
    author: {
      name: "Engineering Team",
      role: "ProxiPilot Systems Team",
    },
    publishedAt: "2025-03-22",
    updatedAt: "2025-03-25",
    readTime: "5 min read",
    featured: false,
    tags: ["Automation", "Human-in-the-Loop", "Triage", "Quality Control"],
    content: `
      <h2>The Perils of Unchecked Email Automation</h2>
      <p>Chatbots that automatically fire unverified responses into customer inboxes create reputational disasters when edge cases arise. A misunderstood sarcasm or an outdated warranty policy can damage a multi-year client relationship instantly.</p>

      <h2>The ProxiPilot Two-Tier Architecture</h2>
      <p>We believe in high-velocity draft generation paired with frictionless human review:</p>
      <ul>
        <li><strong>Tier 1 — Automated Triage & Draft Creation:</strong> Incoming messages are tagged (e.g., Hot Lead, Support Escalation, Billing Issue), matched with relevant knowledge, and an accurate response is pre-drafted.</li>
        <li><strong>Tier 2 — Context-Gated Review:</strong> The agent opens the thread, sees the drafted response alongside the extracted evidence and customer history, and can adjust the tone or approve with one click.</li>
        <li><strong>Confidence-Gated Sending Rules:</strong> Only low-risk, deterministic flows (such as order confirmation receipts or meeting link deliveries) can be configured for autonomous transmission.</li>
      </ul>
      <p>This balance provides the speed of artificial intelligence with the empathy and judgment of your best team members.</p>
    `,
  },
];

export function getAllBlogPosts(): BlogPost[] {
  return BLOG_POSTS;
}

export function getFeaturedPost(): BlogPost {
  return BLOG_POSTS.find((p) => p.featured) || BLOG_POSTS[0];
}

export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

export function getBlogPostsByCategory(categorySlug: string): BlogPost[] {
  return BLOG_POSTS.filter((p) => p.category.slug === categorySlug);
}

export function getAllCategories() {
  return BLOG_CATEGORIES;
}

