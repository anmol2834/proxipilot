import type { Metadata } from "next";
import { SolutionPageShell } from "@/components/solutions/SolutionPageShell";
import {
  IconHeadset,
  IconClock,
  IconShieldCheck,
  IconAlertTriangle,
} from "@tabler/icons-react";

export const metadata: Metadata = {
  title: "AI Email Copilot for Customer Support — ProxiPilot",
  description:
    "Resolve customer support inquiries 60% faster with grounded, accurate draft responses. Eliminate repetitive ticket fatigue while ensuring every response matches official company documentation.",
  alternates: { canonical: "https://proxipilot.com/solutions/customer-support" },
};

export default function CustomerSupportSolutionPage() {
  return (
    <SolutionPageShell
      badge="Customer Support"
      title="Empower support agents with grounded, accurate answers in seconds."
      subtitle="Reduce ticket backlog without sacrificing empathy or accuracy. ProxiPilot pulls exact troubleshooting steps and policy guidelines from your internal documentation, generating precise drafts ready for agent review."
      highlightStats={[
        { value: "65%", label: "Reduction in first-response time" },
        { value: "4.8/5", label: "Customer satisfaction rating" },
        { value: "100%", label: "Grounding in verified knowledge" },
        { value: "0", label: "Conflicting agent answers" },
      ]}
      painPointsTitle="Why support teams struggle to maintain quality at scale"
      painPoints={[
        {
          title: "Surging ticket volumes and backlog spikes",
          desc: "During product updates or seasonal surges, support queues balloon, forcing agents to rush through responses and make preventable errors.",
          icon: <IconClock size={20} />,
        },
        {
          title: "Inconsistent answers across team members",
          desc: "Different agents provide contradictory refund policies or troubleshooting advice, frustrating customers and causing escalation chains.",
          icon: <IconAlertTriangle size={20} />,
        },
        {
          title: "Repetitive Tier 1 inquiry burnout",
          desc: "Copy-pasting the same instructions for password resets, invoice downloads, and setup steps causes high agent turnover and disengagement.",
          icon: <IconHeadset size={20} />,
        },
      ]}
      workflowTitle="How ProxiPilot streamlines support workflows"
      workflowSubtitle="From incoming email to resolved ticket in half the time."
      workflowSteps={[
        {
          step: "01",
          title: "Connect Knowledge Sources",
          desc: "Import your help answers, troubleshooting steps, return policies, and standard operating procedures (SOPs) from CSV or Excel.",
        },
        {
          step: "02",
          title: "Real-time Vector Matching",
          desc: "When a customer submits a ticket, ProxiPilot identifies the exact issue and retrieves the matching verified support document.",
        },
        {
          step: "03",
          title: "Empathetic Draft Generation",
          desc: "A warm, helpful draft is created with step-by-step guidance, troubleshooting checklists, and direct links.",
        },
        {
          step: "04",
          title: "Agent Verification & 1-Click Send",
          desc: "The agent reviews the draft, makes any customer-specific tweaks, and sends—cutting handle time from 8 minutes to 45 seconds.",
        },
      ]}
      scenario={{
        title: "Typical Scenario: Account Settings & Invoicing Inquiry",
        sender: "Elena Rostova <elena@nordicdesign.co>",
        subject: "How do I update our VAT number and export past annual receipts?",
        inquiry:
          "Hello Support Team,\n\nOur accounting department needs all invoices for the past calendar year with our new EU VAT number (SE556123456701) reflected. Where can I update this in our account, and can you send the PDF receipts?\n\nElena",
        evidenceFound: "KB Section 4.2: VAT updates via Settings > Billing > Tax Information; Past receipts auto-regenerated under 'Invoices & Receipts' tab.",
        generatedDraft:
          "Hi Elena,\n\nHappy to help with your invoice and tax settings!\n\nYou can update your VAT number and download past receipts directly in your workspace:\n\n1. Go to Settings > Billing in your dashboard.\n2. Under 'Tax & Company Details', enter your VAT number: SE556123456701 and click Save.\n3. Navigate down to 'Invoice History'. You can click 'Export Annual Receipts (PDF)' to instantly download all invoices with your updated VAT number applied.\n\nPlease let me know if you run into any trouble downloading them!\n\nWarm regards,\nProxiPilot Support Team",
      }}
      capabilities={[
        {
          tag: "Evidence-Gated",
          title: "Strict Knowledge Retrieval",
          desc: "Drafts cite only what is documented in your official support guides. If an edge case is undocumented, the system alerts the agent.",
        },
        {
          tag: "Tone Guidance",
          title: "Empathy & Warmth Presets",
          desc: "Quickly adapt drafts to de-escalate frustrated customers or maintain a patient, encouraging tone for complex technical steps.",
        },
        {
          tag: "Missing Detail Detection",
          title: "Proactive Information Requests",
          desc: "Automatically detects when a customer forgot their order number, account email, or logs, drafting polite clarifying requests.",
        },
      ]}
      faqs={[
        {
          question: "Can ProxiPilot integrate with our existing shared support inbox?",
          answer:
            "Yes. ProxiPilot connects directly to Google Workspace collaborative inboxes or Microsoft 365 shared mailboxes (e.g., support@yourcompany.com).",
        },
        {
          question: "Can agents see where the AI retrieved its answers?",
          answer:
            "Yes! Every generated draft displays the exact source document, page, or knowledge article snippet used to ground the response.",
        },
        {
          question: "What happens if a customer asks something not in our documentation?",
          answer:
            "ProxiPilot flags the inquiry as 'Undocumented' and prepares a respectful placeholder draft asking the customer for more details while prompting the agent.",
        },
      ]}
      relatedSolutions={[
        { title: "SaaS Companies", href: "/solutions/saas-companies", desc: "For technical subscription support" },
        { title: "E-commerce", href: "/solutions/ecommerce", desc: "For order, shipping, and return inquiries" },
        { title: "Small Business", href: "/solutions/small-business", desc: "For lean customer service teams" },
      ]}
    />
  );
}
