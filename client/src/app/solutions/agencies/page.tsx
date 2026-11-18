import type { Metadata } from "next";
import { SolutionPageShell } from "@/components/solutions/SolutionPageShell";
import {
  IconBriefcase,
  IconClock,
  IconShieldCheck,
} from "@tabler/icons-react";

export const metadata: Metadata = {
  title: "AI Email Assistant for Digital & Creative Agencies — ProxiPilot",
  description:
    "Streamline client communications for marketing, design, and development agencies. Guard project scope, answer repetitive onboarding questions, and maintain premium agency polish.",
  alternates: { canonical: "https://proxipilot.com/solutions/agencies" },
};

export default function AgenciesSolutionPage() {
  return (
    <SolutionPageShell
      badge="Agencies & Consultancies"
      title="Maintain premium client communication without sacrificing billable hours."
      subtitle="Account managers spend half their week drafting client updates, fielding revision requests, and explaining scope boundaries. ProxiPilot grounds your emails in client contracts, deliverables schedules, and agency policies."
      highlightStats={[
        { value: "5+ hrs", label: "Billable time reclaimed per account manager" },
        { value: "0", label: "Accidental scope creep giveaways" },
        { value: "100%", label: "Brand tone consistency across reps" },
        { value: "< 1 min", label: "Client status update draft creation" },
      ]}
      painPointsTitle="Common communication friction in agency client management"
      painPoints={[
        {
          title: "Scope creep via casual email requests",
          desc: "Clients casually request 'quick additions' that fall outside the agreed Statement of Work (SOW), which team members accidentally agree to.",
          icon: <IconShieldCheck size={20} />,
        },
        {
          title: "Juggling 20+ active client communication chains",
          desc: "Account managers lose context between different brand guidelines, past approvals, and deliverable deadlines across disparate clients.",
          icon: <IconBriefcase size={20} />,
        },
        {
          title: "Repetitive onboarding & asset requests",
          desc: "Sending repeated emails chasing logos, brand books, DNS access, and staging credentials consumes valuable creative time.",
          icon: <IconClock size={20} />,
        },
      ]}
      workflowTitle="How ProxiPilot protects agency workflows"
      workflowSubtitle="Deliver responsive, high-touch client service without draining your creative team."
      workflowSteps={[
        {
          step: "01",
          title: "Upload SOWs & Rate Cards",
          desc: "Upload approved client Statements of Work, change-order hourly rates, and standard client onboarding checklists.",
        },
        {
          step: "02",
          title: "Inbound Client Request Processing",
          desc: "ProxiPilot matches incoming emails against the specific client project scope and milestone timeline.",
        },
        {
          step: "03",
          title: "Polite, Scope-Guarded Draft",
          desc: "A warm, professional draft is assembled confirming progress or clearly quoting change-order rates for out-of-scope tasks.",
        },
        {
          step: "04",
          title: "Account Lead Review & Send",
          desc: "The account director reviews the draft, adjusts any sensitive nuances, and sends in one click.",
        },
      ]}
      scenario={{
        title: "Typical Scenario: Out-of-Scope Revision Request",
        sender: "Amanda Cross <across@harborbrands.com>",
        subject: "Brand Identity Refresh — Additional 3 landing page variants?",
        inquiry:
          "Hi Agency Team,\n\nWe loved the initial 2 homepage concepts! Could the design team quickly mock up 3 additional landing page templates for our upcoming summer campaign before Thursday’s review?\n\nAmanda",
        evidenceFound: "SOW #2026-HB: Includes 2 homepage concepts and 1 round of revisions. Additional page templates classified as Phase 2 change order ($140/hr, approx 6 hrs per page).",
        generatedDraft:
          "Hi Amanda,\n\nWe are thrilled you loved the initial homepage concepts!\n\nRegarding the 3 additional summer campaign landing page templates: because our current SOW covers the core homepage exploration and one revision round, creating 3 new landing page templates is categorized under our additional digital collateral add-on.\n\nWe can easily accommodate this! At our contracted change-order rate of $140/hour, we estimate approximately 16–18 design hours for all three templates. If you’d like us to proceed, reply with your approval and we’ll fold them into this week’s design sprint for Thursday’s review.\n\nWarm regards,\nAgency Account Team",
      }}
      capabilities={[
        {
          tag: "Scope Defense",
          title: "Contract & SOW Grounding",
          desc: "Prevents accidental commitments by referencing contracted deliverables, revision limits, and change-order pricing.",
        },
        {
          tag: "Client Polish",
          title: "Agency Tone Refinements",
          desc: "Maintains an enthusiastic, collaborative tone while clearly defining commercial boundaries and project timelines.",
        },
        {
          tag: "Asset Checklists",
          title: "Client Onboarding Automation",
          desc: "Drafts detailed asset-collection emails reminding clients of missing vector logos, typography licenses, or access credentials.",
        },
      ]}
      faqs={[
        {
          question: "Can we upload separate contracts for different clients?",
          answer:
            "Yes. You can organize your knowledge base with distinct folders or tags, allowing the Copilot to reference client-specific agreements.",
        },
        {
          question: "Will our clients know we use AI to draft our emails?",
          answer:
            "No. ProxiPilot drafts emails in your regular inbox for human review. Replies come directly from your email address with your agency signature.",
        },
        {
          question: "Can multiple team members collaborate on the same client thread?",
          answer:
            "Yes. Team members with access to the shared mailbox or workspace can review, refine, and dispatch drafts cooperatively.",
        },
      ]}
      relatedSolutions={[
        { title: "B2B Businesses", href: "/solutions/b2b-businesses", desc: "For corporate client communications" },
        { title: "Sales Teams", href: "/solutions/sales-teams", desc: "For winning new agency pitches" },
        { title: "Small Business", href: "/solutions/small-business", desc: "For boutique agency owners" },
      ]}
    />
  );
}
