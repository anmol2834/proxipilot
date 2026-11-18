import type { Metadata } from "next";
import { SolutionPageShell } from "@/components/solutions/SolutionPageShell";
import {
  IconSettingsAutomation,
  IconClock,
  IconCheckbox,
} from "@tabler/icons-react";

export const metadata: Metadata = {
  title: "AI Email Automation for Operations Teams — ProxiPilot",
  description:
    "Organize high-volume operational inboxes, freight coordination, and internal workflows. Ground replies in Standard Operating Procedures (SOPs) and logistical parameters.",
  alternates: { canonical: "https://proxipilot.com/solutions/operations-teams" },
};

export default function OperationsTeamsSolutionPage() {
  return (
    <SolutionPageShell
      badge="Operations & Logistics Teams"
      title="Turn high-volume operational chaos into grounded, synchronized workflows."
      subtitle="Operational inboxes (ops@, logistics@, facilities@) are bombarded with delivery windows, freight BOLs, and vendor inquiries. ProxiPilot references your warehouse SOPs, dock schedules, and operational rules to draft replies in seconds."
      highlightStats={[
        { value: "80%", label: "Faster operational inbox triage" },
        { value: "0", label: "Missed delivery or dock appointments" },
        { value: "100%", label: "Adherence to company SOPs" },
        { value: "Delaware", label: "Corporate compliance assurance" },
      ]}
      painPointsTitle="Operational friction in multi-department email chains"
      painPoints={[
        {
          title: "Buried freight BOLs & delivery appointment requests",
          desc: "Carriers and freight brokers email urgent appointment requests that get buried under internal operational threads, causing dock bottlenecks.",
          icon: <IconSettingsAutomation size={20} />,
        },
        {
          title: "Inconsistent vendor SLA communication",
          desc: "Operations coordinators give varying dock instructions or warehouse receiving hours, causing carrier detention charges and delays.",
          icon: <IconClock size={20} />,
        },
        {
          title: "Repetitive internal status check emails",
          desc: "Sales, account management, and finance repeatedly email ops asking 'What is the status of Order X?', pulling coordinators away from fulfillment.",
          icon: <IconCheckbox size={20} />,
        },
      ]}
      workflowTitle="How ProxiPilot coordinates operational email"
      workflowSubtitle="From carrier email notification to verified dock schedule in 2 minutes."
      workflowSteps={[
        {
          step: "01",
          title: "Index Facility SOPs & Dock Rules",
          desc: "Upload warehouse receiving guidelines, driver check-in protocols, cutoff times, and safety equipment requirements.",
        },
        {
          step: "02",
          title: "Incoming Dispatch Parsing",
          desc: "ProxiPilot extracts carrier names, BOL numbers, pallet counts, and requested delivery dates from incoming messages.",
        },
        {
          step: "03",
          title: "SOP-Grounded Draft Assembly",
          desc: "A clear operational reply is drafted with exact receiving dock numbers, scheduled time slots, and check-in phone numbers.",
        },
        {
          step: "04",
          title: "Coordinator 1-Click Dispatch",
          desc: "The logistics manager reviews the draft, confirms dock availability, and sends the confirmation immediately.",
        },
      ]}
      scenario={{
        title: "Typical Scenario: LTL Freight Delivery Appointment Request",
        sender: "Dispatch Desk <dispatch@midwestfreight.com>",
        subject: "Delivery Appointment Request — PO #94022 / Carrier Tracking #MW-88219",
        inquiry:
          "Hello Ops,\n\nWe have a 4-pallet LTL delivery scheduled for your Chicago distribution center under PO #94022. Can you provide the receiving appointment window for this Friday, October 24th, and confirm if liftgate service is required at your dock?\n\nDispatch Coordinator,\nMidwest Freight Express",
        evidenceFound: "Chicago Facility SOP v3: Dock 2 & 4 equipped with hydraulic levelers (no liftgate required for 53ft trailers); Receiving hours: 07:30 - 13:00 CST; Driver check-in via security gate intercom.",
        generatedDraft:
          "Hello Midwest Freight Dispatch,\n\nThank you for coordinating delivery for PO #94022 (Tracking #MW-88219).\n\nHere are the receiving appointment details for our Chicago Distribution Center for this Friday, October 24th:\n\n• Delivery Window: 08:30 AM – 10:30 AM CST (Receiving docks open at 07:30 AM and close strictly at 13:00 PM CST).\n• Dock Specifications: Our facility features standard elevated loading bays (Docks 2 & 4) with hydraulic levelers. Liftgate service is NOT required for standard 53ft trailers.\n• Driver Check-in: Driver must check in at Security Gate 1 intercom with BOL and PO #94022.\n\nPlease reply to confirm this 08:30 AM time slot so our dock master can reserve bay 4.\n\nBest regards,\nProxiPilot Logistics Desk",
      }}
      capabilities={[
        {
          tag: "SOP Strictness",
          title: "Facility Rule Grounding",
          desc: "Ensures external freight operators and internal staff receive exact, consistent receiving cutoff times and security check-in protocols.",
        },
        {
          tag: "Carrier Coordination",
          title: "BOL & Tracking Number Extraction",
          desc: "Automatically extracts purchase order references and freight tracking IDs for rapid verification.",
        },
        {
          tag: "Audit Trail",
          title: "Complete Interaction Logging",
          desc: "Maintains clear records of all scheduled delivery windows, mitigating carrier detention fee disputes.",
        },
      ]}
      faqs={[
        {
          question: "Can ProxiPilot integrate with shared distribution center inboxes?",
          answer:
            "Yes. ProxiPilot connects natively to Google Workspace shared inboxes and Microsoft 365 shared mailboxes (e.g. receiving@company.com).",
        },
        {
          question: "Can we configure different rules for multiple warehouse locations?",
          answer:
            "Yes. You can separate your knowledge base documents by facility (e.g. Chicago DC, Dallas Facility, Reno Hub) to ensure location-specific dock instructions.",
        },
        {
          question: "Does ProxiPilot send emails without review?",
          answer:
            "By default, all emails are created as drafts for human review. Operations coordinators retain full authority before anything is sent.",
        },
      ]}
      relatedSolutions={[
        { title: "Wholesale Businesses", href: "/solutions/wholesale-businesses", desc: "For distributor SKU and catalog inboxes" },
        { title: "Customer Support", href: "/solutions/customer-support", desc: "For customer-facing ticket management" },
        { title: "B2B Businesses", href: "/solutions/b2b-businesses", desc: "For corporate procurement workflows" },
      ]}
    />
  );
}
