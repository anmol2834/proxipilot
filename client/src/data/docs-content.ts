export interface DocSection {
  id: string;
  title: string;
}

export interface DocArticle {
  slug: string;
  title: string;
  category: string;
  description: string;
  updatedAt: string;
  readTime: string;
  sections: DocSection[];
  content: string; // HTML-safe structured body
  prevSlug?: string;
  nextSlug?: string;
  relatedSlugs: string[];
}

export const DOCS_NAVIGATION = [
  {
    group: "Overview & Setup",
    items: [
      { title: "Documentation Overview", slug: "docs", href: "/docs" },
      { title: "Quick Start Guide", slug: "getting-started", href: "/docs/getting-started" },
    ],
  },
  {
    group: "Mailbox Integrations",
    items: [
      { title: "Connect Google Gmail", slug: "connect-gmail", href: "/docs/connect-gmail" },
      { title: "Connect Microsoft Outlook", slug: "connect-outlook", href: "/docs/connect-outlook" },
    ],
  },
  {
    group: "Intelligence & Workflow",
    items: [
      { title: "AI Automation & Rules", slug: "ai-automation", href: "/docs/ai-automation" },
      { title: "Business Knowledge Base", slug: "business-knowledge", href: "/docs/business-knowledge" },
      { title: "Managing & Approving Drafts", slug: "manage-drafts", href: "/docs/manage-drafts" },
    ],
  },
  {
    group: "Maintenance & Diagnostics",
    items: [
      { title: "Troubleshooting & Health", slug: "troubleshooting", href: "/docs/troubleshooting" },
      { title: "Customer Support Portal", slug: "support", href: "/support" },
    ],
  },
];

export const DOCS_ARTICLES: Record<string, DocArticle> = {
  "getting-started": {
    slug: "getting-started",
    title: "Getting Started with ProxiPilot",
    category: "Overview & Setup",
    description: "Learn how to configure your organization workspace, connect your first mailbox, and review your first AI-drafted reply in less than 5 minutes.",
    updatedAt: "June 2025",
    readTime: "4 min read",
    prevSlug: "docs",
    nextSlug: "connect-gmail",
    relatedSlugs: ["connect-gmail", "connect-outlook", "business-knowledge"],
    sections: [
      { id: "prerequisites", title: "1. Prerequisites & Account Setup" },
      { id: "connect-inbox", title: "2. Connecting Your First Mailbox" },
      { id: "knowledge-base", title: "3. Uploading Core Business Knowledge" },
      { id: "first-draft", title: "4. Reviewing Your First AI Draft" },
      { id: "team-invites", title: "5. Inviting Team Members" },
    ],
    content: `
      <section id="prerequisites">
        <h2>1. Prerequisites & Account Setup</h2>
        <p>Before connecting your mailbox to ProxiPilot, ensure you have an active workspace account. If you haven't created one, navigate to <a href="/signup">Sign Up</a> and register using your business email address.</p>
        <div style="background: #EFF6FF; border-left: 3px solid #2563EB; padding: 12px 14px; border-radius: 6px; margin: 12px 0; font-size: 13.5px; color: #1E3A8A;">
          <strong>Tip:</strong> We recommend using a dedicated shared inbox account (such as <code>support@company.com</code> or <code>sales@company.com</code>) to evaluate team workflows before connecting individual executive accounts.
        </div>
      </section>

      <section id="connect-inbox">
        <h2>2. Connecting Your First Mailbox</h2>
        <p>ProxiPilot natively supports Google Workspace (Gmail) and Microsoft 365 (Outlook):</p>
        <ol>
          <li>Navigate to <strong>Dashboard &rarr; Integrations</strong>.</li>
          <li>Select either <strong>Google Workspace</strong> or <strong>Microsoft 365</strong>.</li>
          <li>Click <strong>Connect Mailbox</strong> to initiate the secure OAuth authorization flow.</li>
          <li>Grant the requested message-read and draft-composition permissions.</li>
        </ol>
        <p>Once authorized, ProxiPilot will synchronize the last 24 hours of active email conversation threads to populate your Inbox dashboard.</p>
      </section>

      <section id="knowledge-base">
        <h2>3. Uploading Core Business Knowledge</h2>
        <p>To ground AI replies in your company's actual products, return policies, and pricing:</p>
        <ol>
          <li>Go to <strong>Dashboard &rarr; Knowledge Base</strong>.</li>
          <li>Click <strong>Upload Document</strong> or <strong>Add Snippet</strong>.</li>
          <li>Upload your product FAQs, service agreements, or catalog PDF files.</li>
          <li>ProxiPilot automatically parses, chunks, and creates vector embeddings stored securely in your private Qdrant collection.</li>
        </ol>
      </section>

      <section id="first-draft">
        <h2>4. Reviewing Your First AI Draft</h2>
        <p>When an incoming inquiry arrives, click on the thread in <strong>Dashboard &rarr; Inbox</strong>. You will notice the <strong>AI Reply Copilot</strong> has analyzed the customer's intent and surfaced a drafted response based on your uploaded documentation.</p>
        <p>You can:</p>
        <ul>
          <li>Edit the text directly in the reply editor.</li>
          <li>Click quick presets like <em>Make concise</em> or <em>Executive polish</em> to tune the tone.</li>
          <li>Click <strong>Send</strong> to dispatch the approved message directly through your connected email account.</li>
        </ul>
      </section>

      <section id="team-invites">
        <h2>5. Inviting Team Members</h2>
        <p>To add colleagues to your workspace, navigate to <strong>Dashboard &rarr; Team</strong> and send invitations by email. ProxiPilot supports granular roles including Owner, Admin, and Support Agent.</p>
      </section>
    `,
  },

  "connect-gmail": {
    slug: "connect-gmail",
    title: "Connecting Google Workspace & Gmail",
    category: "Mailbox Integrations",
    description: "Step-by-step instructions for connecting Google Workspace accounts to ProxiPilot, least-privilege OAuth scopes, and Google API Limited Use compliance.",
    updatedAt: "June 2025",
    readTime: "5 min read",
    prevSlug: "getting-started",
    nextSlug: "connect-outlook",
    relatedSlugs: ["getting-started", "connect-outlook", "troubleshooting"],
    sections: [
      { id: "scopes", title: "1. Required OAuth Scopes" },
      { id: "connection-steps", title: "2. Authorization Workflow" },
      { id: "admin-consent", title: "3. Google Workspace Domain-Wide Installation" },
      { id: "limited-use", title: "4. Google API Limited Use Compliance" },
      { id: "disconnection", title: "5. Disconnecting & Token Purging" },
    ],
    content: `
      <section id="scopes">
        <h2>1. Required OAuth Scopes</h2>
        <p>ProxiPilot adheres strictly to least-privilege security principles. When connecting a Google account, we request only the following scopes:</p>
        <ul>
          <li><code>https://www.googleapis.com/auth/gmail.modify</code>: Allows reading email subject lines and thread history, and saving AI-generated drafts in your Gmail drafts folder.</li>
          <li><code>https://www.googleapis.com/auth/gmail.send</code>: Allows sending emails when you explicitly click "Send" or when an approved automation rule triggers.</li>
        </ul>
        <div style="background: #FEF2F2; border-left: 3px solid #DC2626; padding: 12px 14px; border-radius: 6px; margin: 12px 0; font-size: 13.5px; color: #991B1B;">
          <strong>Security Guarantee:</strong> We do NOT request access to Google Drive, Google Contacts, Google Calendar, or full account deletion permissions.
        </div>
      </section>

      <section id="connection-steps">
        <h2>2. Authorization Workflow</h2>
        <ol>
          <li>Open your ProxiPilot workspace and go to <strong>Settings &rarr; Integrations</strong>.</li>
          <li>Click <strong>Connect Gmail</strong>. You will be redirected to Google's official OAuth consent screen.</li>
          <li>Select the Google account corresponding to your business mailbox.</li>
          <li>Review the permissions requested and click <strong>Allow</strong>.</li>
          <li>Google will redirect you back to ProxiPilot. The connection status will indicate <em>Connected & Operational</em>.</li>
        </ol>
      </section>

      <section id="admin-consent">
        <h2>3. Google Workspace Domain-Wide Installation</h2>
        <p>If your organization enforces Google Workspace OAuth app whitelisting, your Workspace Super Admin may need to authorize the ProxiPilot client ID under <strong>Google Admin Console &rarr; Security &rarr; Access and data control &rarr; API controls</strong>.</p>
      </section>

      <section id="limited-use">
        <h2>4. Google API Limited Use Compliance</h2>
        <p>ProxiPilot strictly complies with Google's Limited Use requirements. We do not use Google email data for advertising, we do not transfer data to unauthorized third parties, and human employees cannot read your private emails without explicit troubleshooting permission.</p>
      </section>

      <section id="disconnection">
        <h2>5. Disconnecting & Token Purging</h2>
        <p>You can disconnect your mailbox at any time. Clicking <strong>Disconnect</strong> in ProxiPilot settings revokes the OAuth token with Google and purges the encrypted credentials from our database immediately.</p>
      </section>
    `,
  },

  "connect-outlook": {
    slug: "connect-outlook",
    title: "Connecting Microsoft Outlook & Office 365",
    category: "Mailbox Integrations",
    description: "Guide to connecting Microsoft 365 and Outlook inboxes via Microsoft Graph API with Azure AD enterprise consent.",
    updatedAt: "June 2025",
    readTime: "5 min read",
    prevSlug: "connect-gmail",
    nextSlug: "ai-automation",
    relatedSlugs: ["connect-gmail", "getting-started", "troubleshooting"],
    sections: [
      { id: "graph-scopes", title: "1. Microsoft Graph Permissions" },
      { id: "user-connection", title: "2. Individual Mailbox Connection" },
      { id: "tenant-consent", title: "3. Enterprise Admin Consent" },
      { id: "troubleshooting-m365", title: "4. Troubleshooting Authentication Failures" },
    ],
    content: `
      <section id="graph-scopes">
        <h2>1. Microsoft Graph Permissions</h2>
        <p>ProxiPilot interfaces with Microsoft 365 via Microsoft Graph API. We request the following delegated enterprise scopes:</p>
        <ul>
          <li><code>Mail.ReadWrite</code>: Enables thread message synchronization and draft saving.</li>
          <li><code>Mail.Send</code>: Enables message dispatch when confirmed by the user.</li>
          <li><code>User.Read</code>: Validates the user's primary corporate email address.</li>
        </ul>
      </section>

      <section id="user-connection">
        <h2>2. Individual Mailbox Connection</h2>
        <ol>
          <li>Navigate to <strong>Dashboard &rarr; Integrations</strong> and click <strong>Connect Microsoft 365</strong>.</li>
          <li>Sign in using your corporate Microsoft account (e.g., Office 365 Enterprise, Business Standard).</li>
          <li>Accept the requested permissions.</li>
        </ol>
      </section>

      <section id="tenant-consent">
        <h2>3. Enterprise Admin Consent</h2>
        <p>If your enterprise requires IT approval for third-party cloud apps, check the box labeled <em>"Consent on behalf of your organization"</em> during login or have an Azure AD Global Administrator approve the ProxiPilot Enterprise Application in the Azure Portal.</p>
      </section>

      <section id="troubleshooting-m365">
        <h2>4. Troubleshooting Authentication Failures</h2>
        <p>If authorization fails with error <code>AADSTS50076</code> (MFA required), re-authenticate using Microsoft Authenticator to refresh your conditional access session.</p>
      </section>
    `,
  },

  "ai-automation": {
    slug: "ai-automation",
    title: "AI Automation Rules & Workflows",
    category: "Intelligence & Workflow",
    description: "Configure conditional automated replies, confidence thresholds, SLA escalations, and human review safeguards.",
    updatedAt: "June 2025",
    readTime: "6 min read",
    prevSlug: "connect-outlook",
    nextSlug: "business-knowledge",
    relatedSlugs: ["business-knowledge", "manage-drafts", "getting-started"],
    sections: [
      { id: "workflow-types", title: "1. Understanding Automation Tiers" },
      { id: "creating-rules", title: "2. Creating a Conditional Rule" },
      { id: "confidence-scores", title: "3. Confidence Score Thresholds" },
      { id: "kill-switch", title: "4. Emergency Kill Switch & Safety Controls" },
    ],
    content: `
      <section id="workflow-types">
        <h2>1. Understanding Automation Tiers</h2>
        <p>ProxiPilot provides two distinct operating modes:</p>
        <ul>
          <li><strong>Draft & Review Mode (Default):</strong> AI drafts complete replies and surfaces them in your inbox queue. No email is sent without human approval.</li>
          <li><strong>Autonomous Send Mode (Configurable):</strong> Pre-approved automated sending triggers only when incoming inquiries match deterministic criteria and confidence scores exceed your set threshold (e.g. &gt;95%).</li>
        </ul>
      </section>

      <section id="creating-rules">
        <h2>2. Creating a Conditional Rule</h2>
        <p>To configure an automated workflow:</p>
        <ol>
          <li>Navigate to <strong>Dashboard &rarr; Automations</strong>.</li>
          <li>Click <strong>New Automation Rule</strong>.</li>
          <li>Define triggers based on customer intent (e.g., <em>Returns & Refunds</em>, <em>Product Inquiries</em>, <em>Billing Receipts</em>).</li>
          <li>Attach knowledge scope filters to restrict context to specific document categories.</li>
        </ol>
      </section>

      <section id="confidence-scores">
        <h2>3. Confidence Score Thresholds</h2>
        <p>Every draft generated by ProxiPilot receives a mathematical confidence score based on vector semantic distance and document relevance. If the score falls below 85%, autonomous execution is automatically blocked, routing the thread to human review.</p>
      </section>

      <section id="kill-switch">
        <h2>4. Emergency Kill Switch & Safety Controls</h2>
        <p>Administrators can pause all automated sending immediately by clicking the global <strong>Pause All Automations</strong> toggle in the top bar of the Automations dashboard.</p>
      </section>
    `,
  },

  "business-knowledge": {
    slug: "business-knowledge",
    title: "Business Knowledge Base & RAG Indexing",
    category: "Intelligence & Workflow",
    description: "How to upload documents, configure vector chunking, and ensure accurate evidence-gated responses without hallucinations.",
    updatedAt: "June 2025",
    readTime: "5 min read",
    prevSlug: "ai-automation",
    nextSlug: "manage-drafts",
    relatedSlugs: ["ai-automation", "getting-started", "troubleshooting"],
    sections: [
      { id: "supported-formats", title: "1. Supported File Formats" },
      { id: "chunking-strategy", title: "2. Vector Chunking & Semantic Search" },
      { id: "document-tags", title: "3. Organizing with Tags & Namespaces" },
      { id: "updating-docs", title: "4. Updating & Deleting Documents" },
    ],
    content: `
      <section id="supported-formats">
        <h2>1. Supported File Formats</h2>
        <p>ProxiPilot's ingestion pipeline supports:</p>
        <ul>
          <li>PDF documents (spec sheets, user manuals, policy agreements).</li>
          <li>Plain text and Markdown (<code>.txt</code>, <code>.md</code>).</li>
          <li>CSV product catalogues and SKU tables.</li>
          <li>Direct text snippet input via the web dashboard.</li>
        </ul>
      </section>

      <section id="chunking-strategy">
        <h2>2. Vector Chunking & Semantic Search</h2>
        <p>When you upload a document, ProxiPilot segments the text into 500-token semantic chunks with 10% overlap to preserve contextual continuity. Chunks are converted into high-dimensional vector embeddings and indexed in your isolated Qdrant vector collection.</p>
      </section>

      <section id="document-tags">
        <h2>3. Organizing with Tags & Namespaces</h2>
        <p>Tag documents by department (e.g., <code>sales-pricing</code>, <code>technical-support</code>, <code>warranty-policy</code>). Automation rules can restrict their retrieval scope to specific tags, preventing internal pricing sheets from surfacing in technical support drafts.</p>
      </section>

      <section id="updating-docs">
        <h2>4. Updating & Deleting Documents</h2>
        <p>When company policies change, simply upload the new document version and delete the outdated file. Qdrant immediately prunes old vectors, ensuring all future drafts reflect current policy.</p>
      </section>
    `,
  },

  "manage-drafts": {
    slug: "manage-drafts",
    title: "Managing & Approving Drafts in Inbox",
    category: "Intelligence & Workflow",
    description: "Learn how to triage conversations, refine draft tone with AI copilots, track thread history, and dispatch emails.",
    updatedAt: "June 2025",
    readTime: "4 min read",
    prevSlug: "business-knowledge",
    nextSlug: "troubleshooting",
    relatedSlugs: ["ai-automation", "getting-started", "troubleshooting"],
    sections: [
      { id: "inbox-overview", title: "1. Navigating the Unified Inbox" },
      { id: "isolated-copilot", title: "2. The Isolated AI Reply Copilot" },
      { id: "tone-tuning", title: "3. Quick Tone Presets & Custom Prompts" },
      { id: "audit-trail", title: "4. Dispatching & Audit Trail" },
    ],
    content: `
      <section id="inbox-overview">
        <h2>1. Navigating the Unified Inbox</h2>
        <p>The ProxiPilot Inbox displays active threads synchronized from your connected mailboxes. Inquiries are prioritized into <em>All, Unread, Starred, and Priority</em> tabs, with lead temperature badges (Hot, Warm, Cold).</p>
      </section>

      <section id="isolated-copilot">
        <h2>2. The Isolated AI Reply Copilot</h2>
        <p>When you click <strong>Improve with AI</strong> or inspect a draft, the Isolated AI Reply Copilot slides open from the right. The copilot is strictly scoped to the active conversation thread to prevent cross-customer data bleeding.</p>
      </section>

      <section id="tone-tuning">
        <h2>3. Quick Tone Presets & Custom Prompts</h2>
        <p>One-click presets allow agents to instantly rephrase replies:</p>
        <ul>
          <li><strong>Make it concise:</strong> Trims unnecessary conversational filler.</li>
          <li><strong>Professional polish:</strong> Elevates tone to corporate executive standards.</li>
          <li><strong>Warm & customer-first:</strong> Adds empathetic customer support phrasing.</li>
          <li><strong>Custom instruction:</strong> Enter specific directions like <em>"Add a polite request for their order ID and serial number."</em></li>
        </ul>
      </section>

      <section id="audit-trail">
        <h2>4. Dispatching & Audit Trail</h2>
        <p>Clicking <strong>Send</strong> dispatches the message via your mailbox's official OAuth API connection. An immutable audit record records which team member reviewed the draft, the timestamp, and the final sent content.</p>
      </section>
    `,
  },

  "troubleshooting": {
    slug: "troubleshooting",
    title: "Troubleshooting & Health Diagnostics",
    category: "Maintenance & Diagnostics",
    description: "Diagnose common connection errors, resolve mailbox sync delays, fix SPF/DKIM email delivery issues, and verify system status.",
    updatedAt: "June 2025",
    readTime: "6 min read",
    prevSlug: "manage-drafts",
    nextSlug: "support",
    relatedSlugs: ["connect-gmail", "connect-outlook", "support"],
    sections: [
      { id: "sync-delays", title: "1. Resolving Mailbox Sync Delays" },
      { id: "oauth-reauth", title: "2. OAuth Token Expiration & Re-Authentication" },
      { id: "deliverability", title: "3. SPF, DKIM & DMARC Deliverability Check" },
      { id: "system-status", title: "4. Checking Real-Time System Health" },
    ],
    content: `
      <section id="sync-delays">
        <h2>1. Resolving Mailbox Sync Delays</h2>
        <p>ProxiPilot synchronizes new emails via webhooks and polling cycles. If an incoming message does not appear in your inbox within 60 seconds:</p>
        <ol>
          <li>Click the <strong>Refresh</strong> icon at the top of the conversation list.</li>
          <li>Verify your mailbox connection status in <strong>Settings &rarr; Integrations</strong>.</li>
          <li>Check that the sender's email address is not in your blocked contacts list.</li>
        </ol>
      </section>

      <section id="oauth-reauth">
        <h2>2. OAuth Token Expiration & Re-Authentication</h2>
        <p>If Google Workspace or Microsoft 365 forces a password reset or session invalidation, your mailbox connection will display an <em>Authentication Expired</em> warning. Simply click <strong>Reconnect</strong> in Integrations settings to refresh the OAuth credential.</p>
      </section>

      <section id="deliverability">
        <h2>3. SPF, DKIM & DMARC Deliverability Check</h2>
        <p>If outbound emails sent via ProxiPilot land in recipient spam folders, verify that your domain's DNS publishes valid SPF and DKIM records aligned with Google Workspace or Microsoft 365. Review our <a href="/email-sending-policy">Email Sending Policy</a> for exact threshold requirements.</p>
      </section>

      <section id="system-status">
        <h2>4. Checking Real-Time System Health</h2>
        <p>Visit <a href="https://status.proxipilot.com" target="_blank" rel="noopener noreferrer">status.proxipilot.com</a> to view real-time API uptime, vector engine latency, and scheduled maintenance announcements.</p>
      </section>
    `,
  },
};
