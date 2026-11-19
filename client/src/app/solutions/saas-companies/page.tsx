import type { Metadata } from "next";
import { SolutionPageShell } from "@/components/solutions/SolutionPageShell";
import {
  IconCpu,
  IconCode,
  IconShieldLock,
} from "@tabler/icons-react";

export const metadata: Metadata = {
  title: "AI Email Assistant for SaaS Companies — ProxiPilot",
  description:
    "Accelerate technical support and product inquiries for B2B SaaS. Ground email responses in developer docs, API references, security whitepapers, and tier entitlements.",
  alternates: { canonical: "https://proxipilot.com/solutions/saas-companies" },
};

export default function SaaSCompaniesSolutionPage() {
  return (
    <SolutionPageShell
      badge="SaaS Companies"
      title="Turn technical product and billing inquiries into precise, developer-grade replies."
      subtitle="Free engineers from customer inbox interruptions. ProxiPilot grounds every reply in the facts you import, such as API limits, release notes, compliance answers, and plan tiers, to draft technically precise email replies."
      highlightStats={[
        { value: "85%", label: "First-contact resolution rate" },
        { value: "4 hrs", label: "Dev time saved per engineer weekly" },
        { value: "100%", label: "Accuracy on API & rate limit details" },
        { value: "0", label: "Model training on confidential code" },
      ]}
      painPointsTitle="Bottlenecks in modern SaaS customer communications"
      painPoints={[
        {
          title: "Developers distracted by repetitive technical emails",
          desc: "Engineers constantly context-switch from sprint work to explain webhook setups, rate limits, or CORS errors to customer developers.",
          icon: <IconCode size={20} />,
        },
        {
          title: "Tier limit & billing tier confusion",
          desc: "Customers email about plan feature availability, overages, and seat expansions that customer success reps have to cross-reference.",
          icon: <IconCpu size={20} />,
        },
        {
          title: "Security reviews & compliance delays",
          desc: "Enterprise prospects request repetitive security architecture details, stalling sales cycles while waiting on InfoSec responses.",
          icon: <IconShieldLock size={20} />,
        },
      ]}
      workflowTitle="How ProxiPilot handles technical SaaS emails"
      workflowSubtitle="From incoming developer question to verified code snippet in seconds."
      workflowSteps={[
        {
          step: "01",
          title: "Index Docs & API Specs",
          desc: "Connect your OpenAPI/Swagger specs, developer documentation, security FAQs, and plan comparison matrices.",
        },
        {
          step: "02",
          title: "Technical Query Analysis",
          desc: "ProxiPilot identifies the exact endpoints, error codes, or SDK methods mentioned in incoming customer emails.",
        },
        {
          step: "03",
          title: "Code-Aware Draft Assembly",
          desc: "Drafts include properly formatted curl examples, webhook headers, and specific dashboard navigation links.",
        },
        {
          step: "04",
          title: "Review & Outbound Send",
          desc: "Support engineers or CSMs verify the draft in seconds and dispatch it directly to the customer.",
        },
      ]}
      scenario={{
        title: "Typical Scenario: Webhook Secret Rotation & Rate Limits",
        sender: "Devon Reed <d.reed@finmetrics.io>",
        subject: "Question regarding Webhook Signature Rotation & API Rate Limits",
        inquiry:
          "Hi Engineering Support,\n\nWe are preparing for our quarterly security key rotation. How do we rotate our production webhook signing secret without dropping incoming event deliveries? Also, what is our current rate limit on the /v1/transactions batch endpoint?\n\nDevon Reed\nSenior Backend Engineer",
        evidenceFound: "API Docs v2.4: Dual-secret rotation mode supported (24hr grace period); Growth tier endpoint limit: 1,200 req/min with burst up to 2,000.",
        generatedDraft:
          "Hi Devon,\n\nThanks for reaching out! Here are the details for zero-downtime webhook secret rotation and your batch API limits:\n\n1. Webhook Secret Rotation:\nProxiPilot supports zero-downtime rotation. When you generate a new signing secret under Dashboard > Developers > Webhooks > 'Rotate Secret', our servers will sign payloads with both the old and new secret for a 24-hour overlap window, allowing you to deploy your updated verification code safely.\n\n2. Rate Limits:\nOn your current Growth plan, the /v1/transactions endpoint has a baseline limit of 1,200 requests/minute with a burst allowance of up to 2,000 requests/minute. Standard HTTP 429 headers will indicate remaining quota.\n\nLet us know if you need our team to monitor your deployment window!\n\nBest regards,\nProxiPilot Engineering Support",
      }}
      capabilities={[
        {
          tag: "Dev-Centric",
          title: "Formatted Code & Markdown",
          desc: "Drafts include clean markdown formatting, curl requests, and exact header specifications.",
        },
        {
          tag: "Security Ready",
          title: "InfoSec Architecture Grounding",
          desc: "Answer customer questionnaires regarding encryption standards, tenant isolation, and subprocessor locations with verified facts.",
        },
        {
          tag: "Tier Entitlements",
          title: "Feature Matrix Enforcement",
          desc: "Ensure sales and support reps accurately represent plan boundaries without promising custom enterprise features on starter tiers.",
        },
      ]}
      faqs={[
        {
          question: "Can we upload our internal private API documentation?",
          answer:
            "Yes. All uploaded documentation is encrypted at rest with AES-256 and stored in your tenant-isolated vector partition. It is never exposed or used to train external models.",
        },
        {
          question: "Does ProxiPilot support markdown formatting for technical replies?",
          answer:
            "Yes. Drafts automatically preserve code blocks, lists, and formatted tables when sent through compatible email clients.",
        },
        {
          question: "Can we connect multiple support inboxes (e.g. dev-support@ and billing@)?",
          answer:
            "Yes. You can connect multiple mailboxes and assign different knowledge bases or tone configurations to each.",
        },
      ]}
      relatedSolutions={[
        { title: "Sales Teams", href: "/solutions/sales-teams", desc: "For closing enterprise software contracts" },
        { title: "Customer Support", href: "/solutions/customer-support", desc: "For scaling customer happiness" },
        { title: "Operations Teams", href: "/solutions/operations-teams", desc: "For internal IT helpdesks" },
      ]}
    />
  );
}
