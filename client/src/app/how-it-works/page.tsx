import type { Metadata } from "next";
import { GlobalNavbar } from "@/components/navigation/GlobalNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { HowItWorksClientView } from "./HowItWorksClientView";

export const metadata: Metadata = {
  title: "How It Works — The ProxiPilot Email Intelligence Workflow",
  description:
    "See the step-by-step product journey: connect your mailbox, index corporate knowledge, retrieve evidence, and review AI drafts with full human oversight.",
  alternates: { canonical: "https://proxipilot.com/how-it-works" },
};

export default function HowItWorksPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#FFFFFF" }}>
      <GlobalNavbar />

      <main style={{ flex: "1 0 auto" }}>
        <HowItWorksClientView />
      </main>

      <LandingFooter />
    </div>
  );
}
