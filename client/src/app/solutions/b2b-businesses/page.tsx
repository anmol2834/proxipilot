import type { Metadata } from "next";
import { SolutionPageShell } from "@/components/solutions/SolutionPageShell";
import {
  IconBuildingSkyscraper,
  IconFileText,
  IconShieldCheck,
} from "@tabler/icons-react";

export const metadata: Metadata = {
  title: "AI Email Copilot for B2B Enterprises — ProxiPilot",
  description:
    "Accelerate B2B corporate communications, vendor correspondence, and procurement reviews. Ground every outbound draft in verified commercial terms and compliance standards.",
  alternates: { canonical: "https://proxipilot.com/solutions/b2b-businesses" },
};

export default function B2BBusinessesSolutionPage() {
  return (
    <SolutionPageShell
      badge="B2B Commercial Enterprises"
      title="Navigate complex commercial emails with grounded corporate precision."
      subtitle="B2B deals involve procurement teams, legal reviews, and stringent commercial terms. ProxiPilot ensures your team replies with exact contract terms, delivery milestones, and payment requirements without risky improvisation."
      highlightStats={[
        { value: "4x", label: "Faster response to RFPs & procurement" },
        { value: "0", label: "Commercial term discrepancies" },
        { value: "100%", label: "Compliance with corporate governance" },
      ]}
      painPointsTitle="Commercial hazards in enterprise email communication"
      painPoints={[
        {
          title: "Misstated payment or warranty terms",
          desc: "Sales reps casually agreeing to Net 90 payment terms or unlimited indemnification in an email chain can legally bind the organization.",
          icon: <IconFileText size={20} />,
        },
        {
          title: "Multi-party procurement stalls",
          desc: "Procurement, InfoSec, and Finance ask overlapping questions across 15-message email threads, leading to lost momentum.",
          icon: <IconBuildingSkyscraper size={20} />,
        },
        {
          title: "Repetitive vendor compliance questionnaires",
          desc: "Drafting the same answers for vendor onboarding forms, tax certifications (W-9), and data privacy practices consumes senior management time.",
          icon: <IconShieldCheck size={20} />,
        },
      ]}
      workflowTitle="How ProxiPilot powers B2B commercial inboxes"
      workflowSubtitle="Grounded governance that protects enterprise margins and legal posture."
      workflowSteps={[
        {
          step: "01",
          title: "Index Corporate Policies & MSAs",
          desc: "Upload Master Services Agreements (MSAs), standard Net-30 payment terms, insurance certificates, and W-9 information.",
        },
        {
          step: "02",
          title: "Inbound Commercial Request Ingestion",
          desc: "ProxiPilot analyzes vendor onboarding, RFQ, or procurement emails, mapping questions to indexed legal guidelines.",
        },
        {
          step: "03",
          title: "Strict Evidence-Gated Draft Assembly",
          desc: "A polished corporate response is drafted quoting exact standard terms, insurance coverage limits, and payment instructions.",
        },
        {
          step: "04",
          title: "Executive Review & Dispatch",
          desc: "The commercial director reviews the prepared response in seconds, confident that all contractual boundaries remain protected.",
        },
      ]}
      scenario={{
        title: "Typical Scenario: Enterprise Procurement Onboarding",
        sender: "Arthur Pendelton <procurement@vanguardlogistics.com>",
        subject: "Vendor Onboarding Packet & Payment Term Clarification — ProxiPilot / Vanguard",
        inquiry:
          "Dear Vendor Team,\n\nBefore issuing our purchase order for the annual enterprise rollout, our finance department requires confirmation of standard Net 60 payment terms, your ACH bank routing details, and a Certificate of Insurance (COI) naming Vanguard Logistics as an additional insured.\n\nPlease confirm.\n\nArthur Pendelton\nSenior Procurement Officer",
        evidenceFound: "Commercial Policy Section 2.1: Standard terms Net 30; Net 60 acceptable only for multi-year contracts with 5% finance fee; COI readily provided via insurance broker; ACH details available on secure portal.",
        generatedDraft:
          "Dear Arthur,\n\nThank you for moving forward with our enterprise partnership!\n\nRegarding the vendor onboarding requirements:\n\n1. Payment Terms:\nOur standard commercial payment term is Net 30 from invoice issuance. We can accommodate Net 60 terms under our multi-year enterprise agreement schedule. If your team requires Net 60 on an annual term, a 5% administrative fee applies to cover extended financing.\n\n2. Certificate of Insurance (COI):\nWe can gladly issue a COI naming Vanguard Logistics Services as an additional insured. Please provide your legal entity address and required coverage thresholds, and our insurance broker will furnish the certificate within 24 business hours.\n\n3. Remittance Details:\nTo prevent fraud and maintain security, our verified ACH banking details and W-9 form are securely downloadable through our vendor onboarding portal link: proxipilot.com/billing-portal.\n\nPlease let us know if you would like to proceed with the multi-year Net 60 structure or our standard Net 30 terms.\n\nSincerely,\nCorporate Accounts Management",
      }}
      capabilities={[
        {
          tag: "Commercial Safeguard",
          title: "Legal & Payment Term Defense",
          desc: "Drafts consistently cite your corporate credit terms, avoiding accidental commitments to unfavorable vendor terms.",
        },
        {
          tag: "Procurement Speed",
          title: "Instant Vendor FAQ Responses",
          desc: "Answer tax ID, corporate registration, and compliance inquiries with verified corporate data.",
        },
        {
          tag: "Thread Memory",
          title: "Multi-Party Stakeholder Tracking",
          desc: "Tracks requests from buyers, procurement leads, and CFOs in the same thread without losing context.",
        },
      ]}
      faqs={[
        {
          question: "Can ProxiPilot ensure our reps never quote unapproved discounts?",
          answer:
            "Yes. ProxiPilot’s evidence-gated drafting strictly limits pricing to your indexed price lists, refusing to fabricate discounts without explicit manager instructions.",
        },
        {
          question: "Can our legal or operations team review drafted responses before sending?",
          answer:
            "Yes. All emails are created as drafts for human review by default. No emails are sent autonomously without explicit configuration.",
        },
      ]}
      relatedSolutions={[
        { title: "Wholesale Businesses", href: "/solutions/wholesale-businesses", desc: "For bulk SKU & trade pricing" },
        { title: "Sales Teams", href: "/solutions/sales-teams", desc: "For deal acceleration" },
        { title: "Operations Teams", href: "/solutions/operations-teams", desc: "For internal procurement desks" },
      ]}
    />
  );
}
