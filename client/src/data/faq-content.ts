/**
 * ProxiPilot FAQ content — powers /faq and /faq/[topic] (and their FAQPage structured data).
 *
 * Answers are arrays of paragraphs. Inline links use [label](/path) and are rendered as <Link>s;
 * faqPlainText() strips them for search and JSON-LD.
 *
 * Keep answers factual and in line with the product: Gmail scopes live in
 * server/app/services/gmail_oauth.py, knowledge sources in server/app/models/knowledge.py,
 * plan limits in src/app/pricing/page.tsx.
 */

export interface FaqItem {
  id: string;
  q: string;
  a: string[];
}

export interface FaqTopic {
  slug: string;
  name: string;
  /** <title>/H1 for the topic page. */
  heading: string;
  /** Meta description and on-page intro for the topic. */
  intro: string;
  items: FaqItem[];
}

export const FAQ_TOPICS: FaqTopic[] = [
  {
    slug: "getting-started",
    name: "Getting Started",
    heading: "Getting started with ProxiPilot",
    intro:
      "What ProxiPilot is, who it is built for, and what it takes to connect your first inbox and review your first AI-drafted reply.",
    items: [
      {
        id: "what-is-proxipilot",
        q: "What is ProxiPilot and how does it work?",
        a: [
          "ProxiPilot is an AI email copilot for business inboxes. It connects to your existing Google Workspace or Microsoft 365 mailbox, reads incoming customer emails, finds the relevant facts in your company knowledge base, and drafts a reply grounded in those facts.",
          "Your team reviews each draft, adjusts it if needed, and sends it from the same mailbox your customers already write to.",
        ],
      },
      {
        id: "who-is-it-for",
        q: "Who is ProxiPilot built for?",
        a: [
          "Teams that answer the same kinds of questions over and over: customer support, sales and account management, and operations teams in B2B, wholesale, e-commerce and SaaS companies.",
          "If your inbox is full of questions about product specs, pricing, availability, orders or policies, ProxiPilot is designed for you. See how teams use it on our [solutions pages](/solutions).",
        ],
      },
      {
        id: "how-long-to-set-up",
        q: "How long does it take to get started?",
        a: [
          "Most teams connect their first mailbox in a few minutes. You sign in with Google or Microsoft, add your core business knowledge, and open your first drafted reply.",
          "Once a mailbox is connected, ProxiPilot syncs the last 24 hours of active conversations so you have real emails to work with straight away. The [Quick Start guide](/docs/getting-started) walks through every step.",
        ],
      },
      {
        id: "replace-email-client",
        q: "Does ProxiPilot replace my current email client or inbox?",
        a: [
          "No. ProxiPilot is not a separate email provider. You keep using Gmail or Outlook exactly as you do today, with the same addresses and the same history.",
          "ProxiPilot works alongside your mailbox through official OAuth APIs, and adds a review queue and AI copilot in the ProxiPilot dashboard.",
        ],
      },
      {
        id: "technical-skills",
        q: "Do I need technical skills or IT help to set it up?",
        a: [
          "No code, DNS changes or server setup are required. You connect a mailbox by signing in with Google or Microsoft, and add knowledge by importing a spreadsheet.",
          "Some Microsoft 365 organisations require an administrator to approve new apps. If yours does, your IT team can grant consent in a couple of clicks, as described in the [Outlook guide](/docs/connect-outlook).",
        ],
      },
    ],
  },
  {
    slug: "ai-drafts",
    name: "AI Drafts & Copilot",
    heading: "AI drafts and the reply copilot",
    intro:
      "How ProxiPilot writes replies, keeps them grounded in your own facts, and lets your team adjust tone before anything is sent.",
    items: [
      {
        id: "prevent-hallucinations",
        q: "How does ProxiPilot prevent AI hallucinations and made-up details?",
        a: [
          "ProxiPilot retrieves evidence before it writes. When an email arrives, it searches your knowledge base for the facts that answer it, and the draft is built from those facts rather than from the model's general knowledge.",
          "If the information is not in your knowledge base, the draft says so instead of inventing a price, date or specification, so a person can fill the gap.",
        ],
      },
      {
        id: "missing-information",
        q: "What happens when the answer isn't in our knowledge base?",
        a: [
          "ProxiPilot flags what is missing, for example a product code it could not find in your catalog, and leaves that part for your team to complete.",
          "Adding the missing fact to your knowledge base means future drafts can answer the same question on their own.",
        ],
      },
      {
        id: "isolated-copilot",
        q: "What is the Isolated AI Reply Copilot?",
        a: [
          "It is the assistant that opens beside an email thread when you review or improve a draft. It works only with the conversation you have open: the sender, the earlier messages in that thread and your knowledge base.",
          "It never pulls context from other customers' threads, so confidential details from one conversation cannot leak into another.",
        ],
      },
      {
        id: "tone-and-style",
        q: "Can I customise the tone and style of drafts?",
        a: [
          "Yes. Set company-wide voice guidelines, then fine-tune individual replies with one-click presets such as Make it concise, Professional polish and Warm & customer-first.",
          "You can also type your own instruction, for example “Ask politely for their order number and serial number”, and the copilot rewrites the draft accordingly.",
        ],
      },
      {
        id: "edit-before-sending",
        q: "Can my team edit a draft before it is sent?",
        a: [
          "Always. Every draft opens in an editor where you can change any word, apply a tone preset, or ask the copilot to rework it. Nothing in Draft & Review mode is sent until a person clicks Send.",
        ],
      },
    ],
  },
  {
    slug: "knowledge-base",
    name: "Knowledge Base",
    heading: "Knowledge base and business facts",
    intro:
      "What information ProxiPilot can use to answer customers, how to import it, and how changes reach new drafts.",
    items: [
      {
        id: "what-can-i-add",
        q: "What business information can I add to ProxiPilot?",
        a: [
          "Anything your team looks up when answering customers: product details and specifications, price lists, SKU tables, stock and lead-time information, return and warranty policies, and standard answers.",
          "Import it from spreadsheets in CSV, XLS or XLSX format into one of nine categories, such as Products & Services or Policies. ProxiPilot detects the columns in your file and shows a preview before import, and you can edit individual entries afterwards.",
        ],
      },
      {
        id: "how-updates-reach-drafts",
        q: "How do changes to our catalog or policies reach new drafts?",
        a: [
          "Edit or re-import the information and publish the new version. Drafts created after you publish use the updated facts, so a price change or new policy is reflected in the very next reply.",
        ],
      },
      {
        id: "version-history",
        q: "Can we see what changed, or undo a change?",
        a: [
          "Yes. Knowledge entries keep a version history. You can compare any two versions side by side and roll back to an earlier one if a change was made by mistake.",
        ],
      },
      {
        id: "organise-knowledge",
        q: "How should we organise our knowledge for the best drafts?",
        a: [
          "Group information into categories, such as pricing, technical support and warranty, and keep one current version of each fact. Clear, specific entries lead to precise answers.",
          "The [Business Knowledge Base guide](/docs/business-knowledge) explains how to structure entries and keep them up to date.",
        ],
      },
      {
        id: "knowledge-private",
        q: "Can other ProxiPilot customers see our knowledge base?",
        a: [
          "No. Each workspace's knowledge is stored separately and is only ever retrieved for that workspace's own emails.",
        ],
      },
    ],
  },
  {
    slug: "integrations",
    name: "Gmail & Outlook",
    heading: "Gmail and Outlook integration",
    intro:
      "Connecting Google Workspace and Microsoft 365 mailboxes, the permissions ProxiPilot asks for, and how to disconnect.",
    items: [
      {
        id: "connect-gmail",
        q: "How do I connect a Gmail or Google Workspace inbox?",
        a: [
          "Go to Dashboard → Integrations and choose Google Workspace. Google's own sign-in screen asks you to approve access, and the mailbox is connected as soon as you accept.",
          "ProxiPilot asks only for the Gmail permissions it needs to read your messages, manage drafts and labels, and send the replies you approve, plus your basic profile to identify the account. It never asks for Google Drive, Contacts or Calendar. Details are in the [Gmail guide](/docs/connect-gmail).",
        ],
      },
      {
        id: "connect-outlook",
        q: "Does ProxiPilot support Microsoft 365 and Exchange Online?",
        a: [
          "Yes. ProxiPilot connects through Microsoft Graph with delegated permissions to read mail and save drafts (Mail.ReadWrite), send replies you approve (Mail.Send), and confirm your account (User.Read).",
          "See the [Outlook guide](/docs/connect-outlook) for individual and organisation-wide setup.",
        ],
      },
      {
        id: "shared-inbox",
        q: "Can I connect a shared inbox such as support@ or sales@?",
        a: [
          "Yes, and it is the best place to start. Connecting a shared team mailbox lets you try ProxiPilot on real customer questions before connecting individual accounts.",
          "The number of mailboxes you can connect depends on your plan, from one on Starter to unlimited on Enterprise.",
        ],
      },
      {
        id: "password-dns",
        q: "Does ProxiPilot need my email password or DNS changes?",
        a: [
          "No. ProxiPilot never sees or stores your password. Access is granted through Google's and Microsoft's official OAuth sign-in, and no DNS records need to change.",
        ],
      },
      {
        id: "it-approval",
        q: "Our IT team must approve third-party apps. What do they need to do?",
        a: [
          "For Microsoft 365, a Global Administrator can approve ProxiPilot for the whole organisation, either by ticking “Consent on behalf of your organization” during sign-in or from the Enterprise Applications page in the Azure portal.",
        ],
      },
      {
        id: "revoke-access",
        q: "Can I disconnect or revoke ProxiPilot's access at any time?",
        a: [
          "Yes, immediately. Disconnect the mailbox in ProxiPilot's Integrations settings, or revoke access from your Google Account security page or the Microsoft Entra admin center. Once access is revoked, ProxiPilot's tokens stop working.",
        ],
      },
    ],
  },
  {
    slug: "review-automation",
    name: "Review & Automation",
    heading: "Review queue and automated sending",
    intro:
      "How human review works by default, when replies can be sent automatically, and the safeguards that keep you in control.",
    items: [
      {
        id: "auto-send",
        q: "Does ProxiPilot send emails automatically without my review?",
        a: [
          "Not by default. ProxiPilot starts in Draft & Review mode: every reply is created as a draft and nothing is sent until a team member approves it.",
          "You can choose to turn on automatic sending for specific, routine kinds of email, such as order confirmations, while everything else stays in review.",
        ],
      },
      {
        id: "confidence-threshold",
        q: "How does ProxiPilot decide whether a reply is safe to send automatically?",
        a: [
          "Each draft gets a confidence score based on how closely your knowledge base matches the question. Automatic sending only happens for emails that match the rules you set and score above your threshold.",
          "If the score falls below 85%, automatic sending is blocked and the email goes to a person for review. Learn more in the [AI automation guide](/docs/ai-automation).",
        ],
      },
      {
        id: "pause-automation",
        q: "Can we stop all automated sending instantly?",
        a: [
          "Yes. Administrators can turn on Pause All Automations from the Automations dashboard, which stops every automated send immediately. Drafts keep arriving in the review queue as usual.",
        ],
      },
      {
        id: "audit-trail",
        q: "Is there a record of who approved and sent each reply?",
        a: [
          "Yes. Every sent reply is recorded with the team member who reviewed it, the time it was sent and the final content, so you can always see what went out and who approved it.",
        ],
      },
      {
        id: "lead-tags",
        q: "Can ProxiPilot prioritise the most important emails?",
        a: [
          "Yes. Incoming emails are classified by intent, and leads can be tagged Hot, Warm or Cold, so your team can work through the most valuable conversations first. Intent classification is included from the Growth plan.",
        ],
      },
    ],
  },
  {
    slug: "security-privacy",
    name: "Security & Privacy",
    heading: "Security, privacy and compliance",
    intro:
      "How ProxiPilot protects your emails and business data, who can access them, and our commitments on AI training and GDPR.",
    items: [
      {
        id: "no-training",
        q: "Does ProxiPilot use our emails or data to train AI models?",
        a: [
          "Never. Your emails, inbox data and knowledge base are not used to train public AI models or shared with anyone for model training. This is a contractual commitment, explained in our [Privacy Policy](/privacy) and [Security Center](/security).",
        ],
      },
      {
        id: "encryption",
        q: "How is our data encrypted?",
        a: [
          "Data is encrypted in transit with TLS 1.3 and at rest with AES-256, including stored OAuth tokens. Tokens are kept in encrypted storage and decrypted only in memory when needed.",
        ],
      },
      {
        id: "gdpr",
        q: "Is ProxiPilot GDPR compliant?",
        a: [
          "Yes. We sign a GDPR Article 28 [Data Processing Agreement](/dpa), support EU Standard Contractual Clauses, publish our [subprocessors](/subprocessors), and offer a [privacy request portal](/privacy-request) for data access and erasure requests.",
        ],
      },
      {
        id: "roles-access",
        q: "Who in our team can read or send from connected mailboxes?",
        a: [
          "Access follows team roles: Owner, Admin, Manager, Member and Viewer. Viewers can read but cannot reply or send; replying and sending are limited to Members and above. Owners and Admins manage team roles and workspace settings, and only the Owner manages billing.",
        ],
      },
      {
        id: "tenant-isolation",
        q: "Is our data kept separate from other customers?",
        a: [
          "Yes. Each workspace's data, including its knowledge base and search index, is isolated, and the reply copilot only ever works within a single conversation thread.",
        ],
      },
    ],
  },
  {
    slug: "billing-plans",
    name: "Billing & Plans",
    heading: "Pricing, plans and billing",
    intro:
      "Plans, the free trial, upgrading or cancelling, and how payments and invoices are handled.",
    items: [
      {
        id: "free-trial",
        q: "Is there a free trial?",
        a: [
          "Yes. The Starter, Growth and Business plans all start with a 14-day free trial with full access, so your team can connect a mailbox and test grounded drafts before paying.",
        ],
      },
      {
        id: "pricing",
        q: "How much does ProxiPilot cost?",
        a: [
          "Plans start at $29 per month for Starter, then $99 for Growth and $249 for Business. Enterprise is priced to your needs. Annual billing is also available. See all details on the [pricing page](/pricing).",
        ],
      },
      {
        id: "plan-limits",
        q: "What is included in each plan?",
        a: [
          "Starter includes 1 connected mailbox and 500 AI-assisted drafts per month. Growth includes up to 3 mailboxes, 2,500 drafts, automation rules and 3 team seats. Business includes up to 10 mailboxes, 10,000 drafts and 10 seats. Enterprise has no mailbox limit and custom volume.",
        ],
      },
      {
        id: "change-cancel",
        q: "Can I change or cancel my plan at any time?",
        a: [
          "Yes. Upgrade, downgrade or cancel from your billing portal whenever you like. Upgrades apply immediately with prorated billing; cancellations take effect at the end of the period you have already paid for. See our [Refund & Cancellation Policy](/refund).",
        ],
      },
      {
        id: "payments",
        q: "Who processes payments and invoices?",
        a: [
          "Payments are handled by our Merchant of Record partners, Paddle and Lemon Squeezy, which take care of global sales tax, VAT and invoicing. ProxiPilot is operated by Cheldain under Delaware, USA commercial terms.",
        ],
      },
    ],
  },
  {
    slug: "troubleshooting",
    name: "Troubleshooting",
    heading: "Troubleshooting common issues",
    intro:
      "Quick fixes for sync delays, expired connections, sign-in errors and email deliverability.",
    items: [
      {
        id: "email-not-showing",
        q: "A new email hasn't appeared in ProxiPilot. What should I check?",
        a: [
          "New emails normally appear within about a minute. If one is missing, refresh the conversation list, check that the mailbox shows as connected in Settings → Integrations, and make sure the sender isn't on your blocked list.",
        ],
      },
      {
        id: "authentication-expired",
        q: "My mailbox shows “Authentication Expired”. How do I fix it?",
        a: [
          "This happens when Google or Microsoft ends the session, for example after a password reset. Click Reconnect in Integrations settings and sign in again; your history and settings stay as they were.",
        ],
      },
      {
        id: "replies-in-spam",
        q: "Replies sent through ProxiPilot are landing in spam. Why?",
        a: [
          "Replies are sent from your own mailbox, so deliverability depends on your domain's setup. Check that your domain publishes valid SPF and DKIM records (and ideally DMARC) for Google Workspace or Microsoft 365. Our [Email Sending Policy](/email-sending-policy) lists the requirements.",
        ],
      },
      {
        id: "outlook-mfa-error",
        q: "Outlook sign-in fails with error AADSTS50076. What does it mean?",
        a: [
          "Your organisation requires multi-factor authentication for this sign-in. Start the connection again and complete the prompt in Microsoft Authenticator to refresh your session.",
        ],
      },
      {
        id: "more-help",
        q: "Where can I get more help?",
        a: [
          "Browse the [documentation](/docs) for step-by-step guides, or [contact our support team](/contact) with your workspace name and a short description of the issue.",
        ],
      },
    ],
  },
];

export function getFaqTopic(slug: string) {
  return FAQ_TOPICS.find((t) => t.slug === slug);
}

/** Strip [label](href) link markup, keeping the label. */
export function faqPlainText(text: string) {
  return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
}

export function faqJsonLd(topics: FaqTopic[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: topics.flatMap((t) =>
      t.items.map((it) => ({
        "@type": "Question",
        name: it.q,
        acceptedAnswer: { "@type": "Answer", text: it.a.map(faqPlainText).join(" ") },
      })),
    ),
  };
}
