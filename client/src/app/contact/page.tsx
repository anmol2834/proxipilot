import type { Metadata } from "next";
import Link from "next/link";
import { GlobalNavbar } from "@/components/navigation/GlobalNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { ContactForm } from "@/components/forms/ContactForm";
import {
  IconMail,
  IconClock,
  IconShieldCheck,
  IconBuildingSkyscraper,
  IconHelpCircle,
} from "@tabler/icons-react";

export const metadata: Metadata = {
  title: "Contact Us — Sales, Support & Enterprise Inquiries | ProxiPilot",
  description:
    "Get in touch with ProxiPilot sales, technical support, billing, or legal teams. Guaranteed response within one business day.",
  alternates: { canonical: "https://proxipilot.com/contact" },
};

export default function ContactPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#FFFFFF" }}>
      <GlobalNavbar />

      <main style={{ flex: "1 0 auto" }}>
        {/* Header */}
        <section
          style={{
            padding: "56px 24px 36px",
            backgroundColor: "#F8FAFC",
            borderBottom: "1px solid #E2E8F0",
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 10px",
                borderRadius: 20,
                backgroundColor: "#EFF6FF",
                border: "1px solid #BFDBFE",
                color: "#2563EB",
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 16,
              }}
            >
              Get in Touch
            </div>
            <h1
              style={{
                fontSize: "clamp(30px, 4.2vw, 44px)",
                fontWeight: 800,
                color: "#0F172A",
                letterSpacing: "-0.03em",
                lineHeight: 1.2,
                margin: "0 0 14px",
              }}
            >
              How can we assist your team?
            </h1>
            <p
              style={{
                fontSize: "clamp(15px, 1.8vw, 17px)",
                color: "#475569",
                lineHeight: 1.6,
                margin: "0 auto",
                maxWidth: 640,
              }}
            >
              Whether you need product licensing guidance, technical integration support, or billing assistance, our specialized teams are ready to help.
            </p>
          </div>
        </section>

        {/* Contact Layout Grid */}
        <section style={{ padding: "56px 24px 72px", maxWidth: 1160, margin: "0 auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1.3fr",
              gap: 40,
              alignItems: "flex-start",
            }}
            className="contact-layout-grid"
          >
            {/* Left Column: Direct Department Channels */}
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", margin: "0 0 16px" }}>
                Direct Department Desks
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ border: "1px solid #E2E8F0", borderRadius: 8, padding: "16px", background: "#FFFFFF" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", textTransform: "uppercase" }}>
                    Sales &amp; Enterprise Walkthroughs
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "4px 0 2px" }}>
                    <a href="mailto:support@proxipilot.com" style={{ color: "#0F172A", textDecoration: "none" }}>
                      support@proxipilot.com
                    </a>
                  </div>
                  <p style={{ fontSize: 12.5, color: "#64748B", margin: 0 }}>
                    Custom volume pricing, multi-brand workspace setups, and RFP inquiries.
                  </p>
                </div>

                <div style={{ border: "1px solid #E2E8F0", borderRadius: 8, padding: "16px", background: "#FFFFFF" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#166534", textTransform: "uppercase" }}>
                    Customer &amp; Technical Support
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "4px 0 2px" }}>
                    <a href="mailto:support@proxipilot.com" style={{ color: "#0F172A", textDecoration: "none" }}>
                      support@proxipilot.com
                    </a>
                  </div>
                  <p style={{ fontSize: 12.5, color: "#64748B", margin: 0 }}>
                    OAuth connection diagnostics, knowledge base vector tuning, and account administration.
                  </p>
                </div>

                <div style={{ border: "1px solid #E2E8F0", borderRadius: 8, padding: "16px", background: "#FFFFFF" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#B45309", textTransform: "uppercase" }}>
                    Billing &amp; Merchant Records
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "4px 0 2px" }}>
                    <a href="mailto:billing@proxipilot.com" style={{ color: "#0F172A", textDecoration: "none" }}>
                      billing@proxipilot.com
                    </a>
                  </div>
                  <p style={{ fontSize: 12.5, color: "#64748B", margin: 0 }}>
                    Paddle and Lemon Squeezy invoice copies, VAT/GST tax receipts, and payment method updates.
                  </p>
                </div>

                <div style={{ border: "1px solid #E2E8F0", borderRadius: 8, padding: "16px", background: "#FFFFFF" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>
                    Legal &amp; Data Protection Office
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "4px 0 2px" }}>
                    <a href="mailto:legal@proxipilot.com" style={{ color: "#0F172A", textDecoration: "none" }}>
                      legal@proxipilot.com
                    </a>
                  </div>
                  <p style={{ fontSize: 12.5, color: "#64748B", margin: 0 }}>
                    Data Processing Agreements, GDPR/CCPA rights requests, and security compliance inquiries.
                  </p>
                </div>
              </div>

              {/* Operating Office Box */}
              <div style={{ marginTop: 20, padding: "16px", backgroundColor: "#F8FAFC", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
                  <IconBuildingSkyscraper size={16} color="#64748B" />
                  <span>Corporate Operations</span>
                </div>
                <p style={{ fontSize: 12.5, color: "#64748B", margin: "6px 0 0", lineHeight: 1.5 }}>
                  ProxiPilot is operated by <strong>Cheldain</strong> (India), providing global cloud services under Delaware USA commercial terms.
                </p>
              </div>
            </div>

            {/* Right Column: Contact Form */}
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", margin: "0 0 16px" }}>
                Send an Electronic Message
              </h2>
              <ContactForm />
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media (max-width: 820px) {
          .contact-layout-grid {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
          }
        }
      `,
        }}
      />
    </div>
  );
}
