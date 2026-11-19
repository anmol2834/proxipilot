export const HELP_EMAIL = "support@proxipilot.com";

export const HELP_TOPICS = [
  {
    slug: "getting-started",
    title: "Get started with ProxiPilot",
    description: "Set up your workspace and review your first AI email draft.",
    icon: "rocket",
    steps: [
      [
        "Connect a test mailbox",
        "Open Integrations in your dashboard and connect the Gmail or Outlook account you want to use for your first test.",
      ],
      [
        "Add a source of business knowledge",
        "Start with a current FAQ or policy your team uses to answer customer questions. Use a question you can verify against that source.",
      ],
      [
        "Review a draft end to end",
        "Open the draft in ProxiPilot and check the recipient, facts, and tone. Make any edits before approving it for sending.",
      ],
    ],
    links: [
      ["Full setup walkthrough", "/docs/getting-started"],
      ["Add business knowledge", "/docs/business-knowledge"],
    ],
  },
  {
    slug: "connect-mailbox",
    title: "Connect Gmail or Outlook",
    description: "Authorize a mailbox and resolve common sign-in issues.",
    icon: "mail",
    steps: [
      [
        "Choose your email provider",
        "In Dashboard → Integrations, choose Google Workspace for Gmail or Microsoft 365 for Outlook.",
      ],
      [
        "Review the consent screen",
        "Sign in to the intended mailbox and review the requested permissions. If your organization blocks consent, ask your email administrator to review the request.",
      ],
      [
        "Confirm the connection",
        "Return to Integrations and check the connected address. Look for a recent thread in the inbox to verify that the expected account is syncing.",
      ],
    ],
    links: [
      ["Gmail connection guide", "/docs/connect-gmail"],
      ["Outlook connection guide", "/docs/connect-outlook"],
    ],
  },
  {
    slug: "review-ai-drafts",
    title: "Review and send AI drafts",
    description: "Check suggested replies, make edits, and approve them for sending.",
    icon: "sparkles",
    steps: [
      [
        "Read the original thread",
        "Open the conversation and identify the question the draft needs to answer, including any details from earlier messages.",
      ],
      [
        "Check claims against your sources",
        "Verify details such as prices, dates, and policies against the knowledge your team uses. Edit the reply or ask for more information if the thread is ambiguous.",
      ],
      [
        "Approve the final reply",
        "Check who will receive the reply and read the final text before approving or sending it from the draft workflow.",
      ],
    ],
    links: [
      ["Manage and approve drafts", "/docs/manage-drafts"],
      ["Configure automation rules", "/docs/ai-automation"],
    ],
  },
  {
    slug: "business-knowledge",
    title: "Set up business knowledge",
    description: "Give draft replies a reliable source for policies and product details.",
    icon: "books",
    steps: [
      [
        "Choose a source your team trusts",
        "Start with a maintained product FAQ, return policy, or another document that answers recurring customer questions.",
      ],
      [
        "Add it to the Knowledge Base",
        "Open the Knowledge Base in your dashboard, add the source, and check its status before testing it in a draft.",
      ],
      [
        "Test and maintain your sources",
        "Try a customer question with a known answer. If the draft uses stale information, review the source and update conflicting or outdated material.",
      ],
    ],
    links: [["Business Knowledge Base guide", "/docs/business-knowledge"]],
  },
  {
    slug: "troubleshooting",
    title: "Troubleshoot inbox sync",
    description: "Work through missing messages, expired connections, and delayed drafts.",
    icon: "tool",
    steps: [
      [
        "Check the mailbox connection",
        "Confirm that Integrations lists the expected mailbox. If ProxiPilot asks you to reconnect, sign in to the same account and review the permissions.",
      ],
      [
        "Narrow down the issue",
        "Check whether one thread or the whole mailbox is affected. If the thread is visible but no draft appears, review the applicable automation rules.",
      ],
      [
        "Share details with support",
        "Include the provider, approximate time with time zone, affected workflow, and a redacted error message. Keep passwords, access tokens, and private email contents out of the request.",
      ],
    ],
    links: [
      ["Troubleshooting documentation", "/docs/troubleshooting"],
      ["Review automation rules", "/docs/ai-automation"],
    ],
  },
  {
    slug: "billing",
    title: "Plans and billing",
    description: "Find pricing information and get help with an invoice or subscription.",
    icon: "receipt",
    steps: [
      [
        "Review plan details",
        "Use the pricing page to compare the current plans and check which features match your team's inbox workflow.",
      ],
      [
        "Gather your billing references",
        "For an existing subscription, locate your workspace email and invoice or order reference so support can identify the account.",
      ],
      [
        "Contact ProxiPilot",
        "Choose Plans and billing in the Help Center form and describe the change or charge you want to discuss. Keep full card numbers and other payment credentials out of the message.",
      ],
    ],
    links: [["Compare ProxiPilot plans", "/pricing"]],
  },
] as const;

export const HELP_FAQS = [
  {
    question: "Can I use ProxiPilot with Gmail and Outlook?",
    answer:
      "ProxiPilot has integrations for Google Workspace and Microsoft 365. Connect your mailbox from the dashboard, then verify that the expected address and recent threads appear.",
    slug: "connect-mailbox",
  },
  {
    question: "How do I check an AI reply before it goes out?",
    answer:
      "Open the draft to compare it with the original conversation. Verify details against your business knowledge, edit the wording as needed, and use the draft approval workflow to send it.",
    slug: "review-ai-drafts",
  },
  {
    question: "What should I include when reporting a sync issue?",
    answer:
      "Share your mailbox provider, when the issue happened with a time zone, what you expected to see, and any redacted error text. Note whether the issue affects one thread or the whole mailbox.",
    slug: "troubleshooting",
  },
] as const;
