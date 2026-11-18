import type { Metadata } from "next";
import { SolutionPageShell } from "@/components/solutions/SolutionPageShell";
import {
  IconFlame,
  IconChartBar,
  IconFileInvoice,
} from "@tabler/icons-react";

export const metadata: Metadata = {
  title: "AI Email Assistant for Sales Teams — ProxiPilot",
  description:
    "Respond to inbound commercial leads within 3 minutes. Equip Account Executives and SDRs with context-aware draft replies grounded in accurate pricing and product collateral.",
  alternates: { canonical: "https://proxipilot.com/solutions/sales-teams" },
};

export default function SalesTeamsSolutionPage() {
  return (
    <SolutionPageShell
      badge="Sales Teams"
      title="Convert inbound leads faster with instant, deal-grounded drafts."
      subtitle="Speed-to-lead determines win rates. ProxiPilot evaluates incoming enterprise inquiries, checks your pitch decks, battlecards, and pricing sheets, and equips reps with high-impact draft replies in minutes."
      highlightStats={[
        { value: "3.5x", label: "Faster first-touch response time" },
        { value: "28%", label: "Increase in demo booking conversion" },
        { value: "0", label: "Fictional pricing or discount errors" },
        { value: "100%", label: "Rep review before outbound delivery" },
      ]}
      painPointsTitle="Obstacles slowing down modern revenue teams"
      painPoints={[
        {
          title: "Lagging response times on hot inbound leads",
          desc: "Prospects evaluate multiple vendors simultaneously. Taking 4 hours to draft a personalized reply often means losing the demo to a faster competitor.",
          icon: <IconFlame size={20} />,
        },
        {
          title: "Time-consuming proposal & collateral lookups",
          desc: "Reps waste 15 minutes per email searching Google Drive or Notion for case studies, security documents, and approved discounting tiers.",
          icon: <IconFileInvoice size={20} />,
        },
        {
          title: "Losing context in long thread histories",
          desc: "When multiple executives join an email chain, key requirements and previous objections get overlooked, leading to disjointed follow-ups.",
          icon: <IconChartBar size={20} />,
        },
      ]}
      workflowTitle="How ProxiPilot accelerates your sales pipeline"
      workflowSubtitle="From inbound email notification to confirmed calendar invite in 3 clicks."
      workflowSteps={[
        {
          step: "01",
          title: "Index Battlecards & Pricing",
          desc: "Sync approved product specifications, rate cards, competitor battlecards, and standard contract terms.",
        },
        {
          step: "02",
          title: "Lead Intent & Thread Analysis",
          desc: "ProxiPilot classifies incoming buyer intent (pricing question, technical question, scheduling request).",
        },
        {
          step: "03",
          title: "Grounded Value-First Draft",
          desc: "A tailored draft is prepared addressing specific prospect questions and proposing a calendar link.",
        },
        {
          step: "04",
          title: "Rep Polish & Outbound Send",
          desc: "The AE quickly tunes tone using one-click presets ('Executive Polish', 'Re-request timeline') and sends.",
        },
      ]}
      scenario={{
        title: "Typical Scenario: Inbound Enterprise Evaluation",
        sender: "Marcus Vance <m.vance@apexcloud.io>",
        subject: "Inquiry: 40-seat deployment, SOC 2, and volume discounting",
        inquiry:
          "Hi ProxiPilot team,\n\nWe are evaluating email copilot solutions for our 40-person customer operations team. Do you support Microsoft 365 Graph integration, do you have SOC 2 compliance documentation, and what does volume tiering look like at 40 seats?\n\nMarcus Vance\nDirector of IT Operations, ApexCloud",
        evidenceFound: "M365 Graph supported (Granular OAuth), SOC 2 report available under mutual NDA, Growth Tier ($49/seat/mo) with 15% annual commitment discount.",
        generatedDraft:
          "Hi Marcus,\n\nThank you for reaching out! ProxiPilot natively supports Microsoft 365 through official Microsoft Graph API with tenant-isolated data partitions.\n\nRegarding your requirements:\n• Security: Our complete SOC 2 compliance package and security whitepaper are available upon request under mutual NDA.\n• 40-Seat Deployment: For 40 seats on our Growth plan ($49/seat/month), we offer an annual commitment tier that includes dedicated vector indexing and priority support.\n\nAre you available for a brief 15-minute technical walkthrough this Thursday at 11:00 AM EST? Alternatively, you can pick a time directly on our engineering calendar here: proxipilot.com/request-demo.\n\nBest regards,\nProxiPilot Commercial Team",
      }}
      capabilities={[
        {
          tag: "Thread-Aware",
          title: "Isolated AI Reply Copilot",
          desc: "Evaluates multi-stakeholder email histories so reps never forget previous terms, objections, or stakeholder names.",
        },
        {
          tag: "Commercial Guardrails",
          title: "Pricing & Discount Controls",
          desc: "Never quotes unauthorized discounts or out-of-date rate sheets—drafts strictly adhere to indexed sales policy.",
        },
        {
          tag: "One-Click Refine",
          title: "Executive Tone Tuning",
          desc: "Quick presets allow reps to elevate phrasing, condense long replies, or emphasize urgent call-to-actions.",
        },
      ]}
      faqs={[
        {
          question: "Can ProxiPilot draft follow-ups if a prospect goes cold?",
          answer:
            "Yes. You can instruct the Copilot to prepare contextual re-engagement drafts citing the prospect's original interest and specific points discussed.",
        },
        {
          question: "Does ProxiPilot share confidential sales conversations across accounts?",
          answer:
            "Never. Each company's vector knowledge base and inbox threads are strictly isolated with dedicated encryption keys and tenant identifiers.",
        },
        {
          question: "Can our sales reps use ProxiPilot within Gmail or Outlook?",
          answer:
            "Yes. Drafts sync directly into your email provider's Drafts folder, or reps can work from the ProxiPilot web dashboard.",
        },
      ]}
      relatedSolutions={[
        { title: "B2B Businesses", href: "/solutions/b2b-businesses", desc: "For complex client relationships" },
        { title: "SaaS Companies", href: "/solutions/saas-companies", desc: "For subscription & product inquiries" },
        { title: "Agencies", href: "/solutions/agencies", desc: "For multi-client account managers" },
      ]}
    />
  );
}
