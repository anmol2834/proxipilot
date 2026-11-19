import type { Metadata } from "next";
import { GlobalNavbar } from "@/components/navigation/GlobalNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { TestimonialsClientView } from "./TestimonialsClientView";

export const metadata: Metadata = {
  title: "Customer Testimonials & Verified Case Studies | ProxiPilot",
  description:
    "Read real reviews and documented case studies from commercial operations, wholesale distribution, logistics, and support teams cutting email handle times by 78% with ProxiPilot.",
  alternates: { canonical: "https://proxipilot.com/testimonials" },
  openGraph: {
    title: "Customer Testimonials & Verified Case Studies | ProxiPilot",
    description:
      "See how enterprise operations and commercial support leaders eliminate draft fatigue and automate email replies with human-in-the-loop accuracy.",
    url: "https://proxipilot.com/testimonials",
    siteName: "ProxiPilot",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Customer Testimonials & Verified Case Studies | ProxiPilot",
    description:
      "Read real reviews and documented case studies from commercial operations and support teams cutting email turnaround times by 78%.",
  },
};

export default function TestimonialsPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#FFFFFF" }}>
      <GlobalNavbar />

      <main style={{ flex: "1 0 auto" }}>
        <TestimonialsClientView />
      </main>

      <LandingFooter />
    </div>
  );
}
