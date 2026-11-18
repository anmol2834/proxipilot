import type { Metadata } from "next";
import Link from "next/link";
import { GlobalNavbar } from "@/components/navigation/GlobalNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { ContactForm } from "@/components/forms/ContactForm";
import {
  IconHeadset,
  IconClock,
  IconShieldCheck,
  IconAlertTriangle,
  IconLifebuoy,
  IconMailForward,
  IconBook,
  IconReceipt,
} from "@tabler/icons-react";

export const metadata: Metadata = {
  title: "Support Portal & Incident Escalation — ProxiPilot",
  description:
    "Open a support ticket with ProxiPilot engineering. Access SLA severity tiers, mailbox integration diagnostics, and billing support.",
  alternates: { canonical: "https://proxipilot.com/support" },
};

export default function SupportPortalPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#FFFFFF" }}>
      <GlobalNavbar />

      <main style={{ flex: "1 0 auto" }}>
        {/* Hero Section */}
        <section
          style={{
            padding: "56px 24px 44px",
            backgroundColor: "#F8FAFC",
            borderBottom: "1px solid #E2E8F0",
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: 840, margin: "0 auto" }}>
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
                marginBottom: 14,
              }}
            >
              <IconHeadset size={14} />
              ProxiPilot Customer Support Desk
            </div>

            <h1
              style={{
                fontSize: "clamp(28px, 4vw, 42px)",
                fontWeight: 800,
                color: "#0F172A",
                lineHeight: 1.18,
                letterSpacing: "-0.025em",
                marginBottom: 14,
              }}
            >
              Direct engineering support for your mission-critical inboxes.
            </h1>

            <p
              style={{
                fontSize: "clamp(15px, 2vw, 17px)",
                color: "#475569",
                lineHeight: 1.55,
                maxWidth: 680,
                margin: "0 auto",
              }}
            >
              Every support ticket is handled directly by systems engineers and technical product specialists. Standard hours: Monday through Friday, 09:00 – 18:00 EST.
            </p>
          </div>
        </section>

        {/* Severity Tiers Grid */}
        <section style={{ padding: "56px 24px 36px", maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <h2
              style={{
                fontSize: "clamp(22px, 3vw, 28px)",
                fontWeight: 800,
                color: "#0F172A",
                letterSpacing: "-0.02em",
                marginBottom: 8,
              }}
            >
              Issue Severity &amp; Escalation Levels
            </h2>
            <p style={{ fontSize: 14, color: "#64748B", margin: 0 }}>
              Classify your ticket accurately to ensure appropriate routing to on-call infrastructure engineers.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 20,
            }}
          >
            {/* Severity 1 */}
            <div
              style={{
                padding: "24px 20px",
                borderRadius: 14,
                backgroundColor: "#FFFFFF",
                border: "1px solid #FCA5A5",
                boxShadow: "0 1px 3px rgba(220, 38, 38, 0.05)",
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  padding: "3px 8px",
                  borderRadius: 6,
                  backgroundColor: "#FEF2F2",
                  color: "#DC2626",
                  fontSize: 12,
                  fontWeight: 800,
                  marginBottom: 12,
                }}
              >
                Severity 1 — Critical Outage
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>
                Mailbox Disconnection / Ingestion Failure
              </h3>
              <p style={{ fontSize: 13.5, color: "#64748B", lineHeight: 1.5, margin: 0 }}>
                Complete interruption of mailbox synchronization or catastrophic failure affecting all workspace users. Response target: Within 2 business hours.
              </p>
            </div>

            {/* Severity 2 */}
            <div
              style={{
                padding: "24px 20px",
                borderRadius: 14,
                backgroundColor: "#FFFFFF",
                border: "1px solid #FED7AA",
                boxShadow: "0 1px 3px rgba(234, 88, 12, 0.05)",
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  padding: "3px 8px",
                  borderRadius: 6,
                  backgroundColor: "#FFF7ED",
                  color: "#EA580C",
                  fontSize: 12,
                  fontWeight: 800,
                  marginBottom: 12,
                }}
              >
                Severity 2 — Degraded Service
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>
                Vector Search Latency / Draft Delays
              </h3>
              <p style={{ fontSize: 13.5, color: "#64748B", lineHeight: 1.5, margin: 0 }}>
                Intermittent sync delays, vector indexing lag, or slow copilot draft assembly with workaround available. Response target: Within 6 business hours.
              </p>
            </div>

            {/* Severity 3 */}
            <div
              style={{
                padding: "24px 20px",
                borderRadius: 14,
                backgroundColor: "#FFFFFF",
                border: "1px solid #BFDBFE",
                boxShadow: "0 1px 3px rgba(37, 99, 235, 0.05)",
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  padding: "3px 8px",
                  borderRadius: 6,
                  backgroundColor: "#EFF6FF",
                  color: "#2563EB",
                  fontSize: 12,
                  fontWeight: 800,
                  marginBottom: 12,
                }}
              >
                Severity 3 — General &amp; Billing
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>
                Setup Questions, Knowledge Uploads, Invoicing
              </h3>
              <p style={{ fontSize: 13.5, color: "#64748B", lineHeight: 1.5, margin: 0 }}>
                Standard questions regarding feature configuration, team permissions, invoice receipts, and plan adjustments. Response target: Within 1 business day.
              </p>
            </div>
          </div>
        </section>

        {/* Ticket Submission Form Section */}
        <section style={{ padding: "44px 24px 64px", maxWidth: 1160, margin: "0 auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 40,
              alignItems: "start",
            }}
          >
            {/* Left: Direct Support Channels */}
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", marginBottom: 12 }}>
                Specialized Support Channels
              </h2>
              <p style={{ fontSize: 14.5, color: "#475569", lineHeight: 1.55, marginBottom: 28 }}>
                Select the channel matching your inquiry for faster resolution.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 32 }}>
                <div
                  style={{
                    padding: "18px 20px",
                    borderRadius: 12,
                    backgroundColor: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>
                    Technical &amp; API Support
                  </div>
                  <div style={{ fontSize: 13, color: "#64748B", marginBottom: 8 }}>
                    OAuth integration scopes, Redis sync queues, and Qdrant vector retrieval.
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#2563EB" }}>
                    support@proxipilot.com
                  </div>
                </div>

                <div
                  style={{
                    padding: "18px 20px",
                    borderRadius: 12,
                    backgroundColor: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>
                    Billing &amp; Merchant of Record Desk
                  </div>
                  <div style={{ fontSize: 13, color: "#64748B", marginBottom: 8 }}>
                    Paddle / Lemon Squeezy receipts, EU VAT numbers, seat additions, and refunds.
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#2563EB" }}>
                    billing@proxipilot.com
                  </div>
                </div>

                <div
                  style={{
                    padding: "18px 20px",
                    borderRadius: 12,
                    backgroundColor: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>
                    Data Privacy &amp; GDPR Portal
                  </div>
                  <div style={{ fontSize: 13, color: "#64748B", marginBottom: 8 }}>
                    Submit formal Subject Access Requests (SAR) or cryptographic data deletion orders.
                  </div>
                  <Link
                    href="/privacy-request"
                    style={{ fontSize: 13, fontWeight: 600, color: "#2563EB", textDecoration: "none" }}
                  >
                    Open Privacy Request Portal →
                  </Link>
                </div>
              </div>

              {/* Self-Service Documentation Card */}
              <div
                style={{
                  padding: "18px 20px",
                  borderRadius: 12,
                  backgroundColor: "#EFF6FF",
                  border: "1px solid #BFDBFE",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1E3A8A", marginBottom: 4 }}>
                  Self-Service Diagnostic Guides
                </div>
                <div style={{ fontSize: 13, color: "#1E40AF", marginBottom: 12 }}>
                  Most connection hiccups can be resolved in under 2 minutes using our diagnostic walkthroughs.
                </div>
                <Link
                  href="/docs/troubleshooting"
                  style={{ fontSize: 13, fontWeight: 700, color: "#2563EB", textDecoration: "none" }}
                >
                  View Troubleshooting Guide →
                </Link>
              </div>
            </div>

            {/* Right: Ticket Submission Form */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 16,
                border: "1px solid #E2E8F0",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.03)",
                padding: "32px 28px",
              }}
            >
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", marginBottom: 6 }}>
                  Submit a Support Ticket
                </h3>
                <p style={{ fontSize: 14, color: "#64748B", margin: 0 }}>
                  Fill out the details below. Our engineering desk will confirm receipt and initiate troubleshooting.
                </p>
              </div>

              <ContactForm />
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
