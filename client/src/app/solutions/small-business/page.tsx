import type { Metadata } from "next";
import { SolutionPageShell } from "@/components/solutions/SolutionPageShell";
import {
  IconClock,
  IconUsers,
  IconAlertTriangle,
} from "@tabler/icons-react";

export const metadata: Metadata = {
  title: "AI Email Copilot for Small Business — ProxiPilot",
  description:
    "Empower small business owners to handle customer inquiries 5x faster. Reduce manual email backlog while maintaining personal, consistent customer communication.",
  alternates: { canonical: "https://proxipilot.com/solutions/small-business" },
};

export default function SmallBusinessSolutionPage() {
  return (
    <SolutionPageShell
      badge="Small Business"
      title="Never lose another customer inquiry to an overwhelmed inbox."
      subtitle="For lean business owners wearing multiple hats: ProxiPilot reads incoming emails, checks your services and pricing guides, and crafts ready-to-send draft replies so you can respond in seconds."
      highlightStats={[
        { value: "4.2 hrs", label: "Saved weekly per founder" },
        { value: "< 2 min", label: "Average draft preparation time" },
        { value: "100%", label: "Human oversight before sending" },
        { value: "0", label: "Technical skills required" },
      ]}
      painPointsTitle="Common inbox hurdles faced by small business owners"
      painPoints={[
        {
          title: "Inbox overload during working hours",
          desc: "When you are on-site, serving clients, or managing jobs, customer inquiries sit unanswered for hours, causing leads to contact competitors.",
          icon: <IconClock size={20} />,
        },
        {
          title: "Repetitive pricing & service questions",
          desc: "Answering the same 10 questions about rates, opening hours, booking availability, and service areas drains mental energy.",
          icon: <IconAlertTriangle size={20} />,
        },
        {
          title: "Inconsistent communication tone",
          desc: "Tired late-night email replies often sound rushed or lack essential booking details, reducing client booking rates.",
          icon: <IconUsers size={20} />,
        },
      ]}
      workflowTitle="How ProxiPilot automates small business email"
      workflowSubtitle="A simple, hands-off loop that keeps you in total control."
      workflowSteps={[
        {
          step: "01",
          title: "Upload Your Services & Rates",
          desc: "Import your price list, FAQs, and service details into the ProxiPilot knowledge base from a CSV or Excel spreadsheet.",
        },
        {
          step: "02",
          title: "Connect Gmail or Outlook",
          desc: "Secure 1-click OAuth connection to your existing business email address without altering MX records.",
        },
        {
          step: "03",
          title: "Grounded Drafts Prepared",
          desc: "As inquiries arrive, ProxiPilot matches the request to your service sheet and prepares a warm draft.",
        },
        {
          step: "04",
          title: "Review & Send in 1 Click",
          desc: "Open your inbox on desktop or mobile, glance over the generated draft, and tap send with confidence.",
        },
      ]}
      scenario={{
        title: "Typical Scenario: Service & Availability Inquiry",
        sender: "Sarah Jenkins <sarah.j@gmail.com>",
        subject: "Consultation availability and pricing for next week?",
        inquiry:
          "Hi team,\n\nI’m looking to book a 60-minute site audit for our downtown retail space next Tuesday or Wednesday afternoon. Could you confirm your consultation fee and whether you service the downtown area?\n\nThanks,\nSarah",
        evidenceFound: "Verified rate card ($150/hr), Downtown travel zone covered (Zone 1, no travel surcharge).",
        generatedDraft:
          "Hi Sarah,\n\nThank you for reaching out! Yes, we actively service the downtown retail district with no additional travel surcharge.\n\nOur initial 60-minute on-site audit is $150. We currently have openings next Tuesday at 2:00 PM or Wednesday at 3:30 PM. Would either of those times work for your walkthrough?\n\nBest regards,\nProxiPilot Local Team",
      }}
      capabilities={[
        {
          tag: "Local Service Ready",
          title: "Zone & Radius Rules",
          desc: "Ground responses with your exact service areas, travel fees, and appointment windows.",
        },
        {
          tag: "Personal Voice",
          title: "Owner-Style Tone Adaptation",
          desc: "ProxiPilot writes in your preferred conversational voice so customers feel like they are chatting with you directly.",
        },
        {
          tag: "Mobile Drafts",
          title: "Review from Your Phone",
          desc: "Drafts appear directly in your standard Gmail or Outlook mobile app, ready for review anywhere.",
        },
      ]}
      faqs={[
        {
          question: "Will ProxiPilot send replies to my clients automatically?",
          answer:
            "No. ProxiPilot creates drafts in your inbox by default. You review the draft and click send. Autonomous sending can only be turned on if you explicitly configure it.",
        },
        {
          question: "How long does it take to set up?",
          answer:
            "Under 5 minutes. Connect your Gmail or Outlook account and upload your price sheet or service list. ProxiPilot is ready immediately.",
        },
        {
          question: "Can I use my existing company email domain?",
          answer:
            "Yes! ProxiPilot connects via official OAuth to your existing Google Workspace or Microsoft 365 inbox. You keep your domain and email setup exactly as it is.",
        },
      ]}
      relatedSolutions={[
        { title: "Customer Support", href: "/solutions/customer-support", desc: "For high-volume ticket inboxes" },
        { title: "B2B Businesses", href: "/solutions/b2b-businesses", desc: "For contract and proposal inquiries" },
        { title: "Operations Teams", href: "/solutions/operations-teams", desc: "For internal workflow inboxes" },
      ]}
    />
  );
}
