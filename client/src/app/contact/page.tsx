import type { Metadata } from "next";
import { GlobalNavbar } from "@/components/navigation/GlobalNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { ContactClientView } from "./ContactClientView";

export const metadata: Metadata = {
  title: "Get in Touch — Enterprise Sales, Support & Pilot Assistance | ProxiPilot",
  description:
    "Connect with ProxiPilot sales, technical operations, security, or billing desks. Guaranteed sub-2 hour response for pilot inquiries, live walkthroughs, and custom enterprise evaluations.",
  alternates: { canonical: "https://proxipilot.com/contact" },
  openGraph: {
    title: "Get in Touch with ProxiPilot — Sales & Technical Support",
    description:
      "Whether you have questions about autonomous email drafting, need help connecting Gmail or Outlook, or want enterprise pricing, our team is ready to assist.",
    url: "https://proxipilot.com/contact",
    siteName: "ProxiPilot",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Get in Touch with ProxiPilot",
    description:
      "Guaranteed sub-2 hour response for enterprise pilot inquiries, technical operations, and custom pricing.",
  },
};

export default function ContactPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#FFFFFF" }}>
      <GlobalNavbar />

      <main style={{ flex: "1 0 auto" }}>
        <ContactClientView />
      </main>

      <LandingFooter />
    </div>
  );
}
