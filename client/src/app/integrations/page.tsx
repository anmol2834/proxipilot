import type { Metadata } from "next";
import { GlobalNavbar } from "@/components/navigation/GlobalNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { IntegrationsClientView } from "./IntegrationsClientView";

export const metadata: Metadata = {
  title: "Native Integrations — Connect Gmail, Outlook, Qdrant & Webhooks | ProxiPilot",
  description:
    "Connect your tools in minutes. Keep your existing email clients. ProxiPilot connects natively to Google Workspace, Microsoft 365 Outlook, Qdrant vector databases, and custom CRM event webhooks.",
  alternates: { canonical: "https://proxipilot.com/integrations" },
};

export default function IntegrationsPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#FFFFFF" }}>
      <GlobalNavbar />

      <main style={{ flex: "1 0 auto" }}>
        <IntegrationsClientView />
      </main>

      <LandingFooter />
    </div>
  );
}
