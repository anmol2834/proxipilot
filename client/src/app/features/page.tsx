import type { Metadata } from "next";
import { GlobalNavbar } from "@/components/navigation/GlobalNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { FeaturesClientView } from "./FeaturesClientView";

export const metadata: Metadata = {
  title: "Features — Enterprise AI Email Automation Platform | ProxiPilot",
  description:
    "Explore ProxiPilot features: Two-way Gmail & Outlook sync, intent & entity classification, hybrid Qdrant vector retrieval, isolated AI reply copilot, human-in-the-loop review queues, and velocity analytics.",
  alternates: { canonical: "https://proxipilot.com/features" },
};

export default function FeaturesPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#FFFFFF" }}>
      <GlobalNavbar />

      <main style={{ flex: "1 0 auto" }}>
        <FeaturesClientView />
      </main>

      <LandingFooter />
    </div>
  );
}
