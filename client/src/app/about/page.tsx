import type { Metadata } from "next";
import Link from "next/link";
import { GlobalNavbar } from "@/components/navigation/GlobalNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import {
  IconTarget,
  IconShieldLock,
  IconCpu,
  IconUsers,
  IconArrowRight,
  IconCheck,
} from "@tabler/icons-react";

export const metadata: Metadata = {
  title: "About Us — The Mission Behind ProxiPilot",
  description:
    "Learn why ProxiPilot was created: to eliminate inbox fatigue for modern commercial enterprises using grounded evidence, vector retrieval, and human-in-the-loop AI.",
  alternates: { canonical: "https://proxipilot.com/about" },
};

export default function AboutPage() {
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
              Our Mission & Philosophy
            </div>
            <h1
              style={{
                fontSize: "clamp(30px, 4.2vw, 46px)",
                fontWeight: 800,
                color: "#0F172A",
                letterSpacing: "-0.03em",
                lineHeight: 1.2,
                margin: "0 0 16px",
              }}
            >
              Intelligent email automation, <br />
              engineered with evidence and control.
            </h1>
            <p
              style={{
                fontSize: "clamp(15px, 1.8vw, 17px)",
                color: "#475569",
                lineHeight: 1.6,
                margin: "0 auto",
                maxWidth: 680,
              }}
            >
              We believe email should not run your business. ProxiPilot connects your real corporate documentation to your inboxes, turning chaotic queues into accurate, pre-drafted workflows.
            </p>
          </div>
        </section>

        {/* The Problem & The Solution */}
        <section style={{ padding: "56px 24px", maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 36, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#2563EB", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                The Problem
              </div>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: "#0F172A", lineHeight: 1.3, margin: "0 0 14px" }}>
                The inbox is modern business&rsquo;s biggest operational bottleneck.
              </h2>
              <p style={{ fontSize: 14.5, color: "#475569", lineHeight: 1.65, margin: "0 0 12px" }}>
                Every day, support agents, account executives, and operations coordinators answer the exact same questions hundreds of times: <em>What are the dimensions on this SKU? Can you send me volume pricing? How does your return policy work?</em>
              </p>
              <p style={{ fontSize: 14.5, color: "#475569", lineHeight: 1.65, margin: 0 }}>
                Meanwhile, the answers already exist — locked away inside PDF spec sheets, notion wikis, and pricing matrices. Agents waste hours copying, pasting, and searching across fragmented tools while customers wait hours for a reply.
              </p>
            </div>

            <div style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: "28px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#166534", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                The ProxiPilot Approach
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", margin: "0 0 12px" }}>
                Grounding AI in verifiable evidence.
              </h3>
              <p style={{ fontSize: 14, color: "#334155", lineHeight: 1.6, margin: "0 0 14px" }}>
                Instead of relying on generic chatbots that hallucinate plausible answers, ProxiPilot connects directly to your authorized Google Workspace or Microsoft 365 inbox.
              </p>
              <ul style={{ paddingLeft: 18, margin: 0, fontSize: 13.5, color: "#334155", lineHeight: 1.6 }}>
                <li style={{ marginBottom: 6 }}>Identifies customer intent and matches relevant catalog paragraphs with vector precision.</li>
                <li style={{ marginBottom: 6 }}>Pre-drafts contextual, brand-tailored replies in your agent&rsquo;s queue.</li>
                <li>Keeps a human team member in sovereign control with one-click review and dispatch.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 3 Core Engineering Principles */}
        <section style={{ backgroundColor: "#F8FAFC", borderTop: "1px solid #E2E8F0", borderBottom: "1px solid #E2E8F0", padding: "56px 24px" }}>
          <div style={{ maxWidth: 1160, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#2563EB", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                Our Guiding Principles
              </div>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: "#0F172A", margin: 0 }}>
                Built on Three Foundational Tenets
              </h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
              <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 10, padding: "24px" }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <IconTarget size={22} />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", margin: "0 0 8px" }}>
                  1. Evidence Over Generation
                </h3>
                <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.6, margin: 0 }}>
                  We never let an AI model guess. Every fact, quote, and policy statement generated in a draft is anchored to an indexed document in your Knowledge Base.
                </p>
              </div>

              <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 10, padding: "24px" }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <IconUsers size={22} />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", margin: "0 0 8px" }}>
                  2. Human-in-the-Loop Velocity
                </h3>
                <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.6, margin: 0 }}>
                  Speed should never come at the cost of brand trust. We focus on cutting drafting time from 10 minutes to 5 seconds while keeping approval squarely in human hands.
                </p>
              </div>

              <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 10, padding: "24px" }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <IconShieldLock size={22} />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", margin: "0 0 8px" }}>
                  3. Non-Training Data Sovereignty
                </h3>
                <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.6, margin: 0 }}>
                  Customer communications are sacred. We enforce strict commercial non-training API contracts and isolated vector storage. Your emails are never used to train public models.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Company & Entity Information */}
        <section style={{ padding: "56px 24px", maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 12, padding: "32px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }} className="about-company-grid">
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                Corporate Entity
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", margin: "0 0 10px" }}>
                Operated by Cheldain
              </h3>
              <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, margin: "0 0 12px" }}>
                ProxiPilot is engineered and operated globally by <strong>Cheldain</strong>, an enterprise software organization incorporated in India, serving customers worldwide under Delaware USA commercial terms.
              </p>
              <div style={{ fontSize: 13, color: "#64748B" }}>
                Global payments and tax remittances handled by authorized Merchant of Record partners (Paddle & Lemon Squeezy).
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                Security & Compliance
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", margin: "0 0 10px" }}>
                Transparent Standards
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13.5, color: "#334155" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <IconCheck size={16} color="#16A34A" />
                  <span>Google API Limited Use & OAuth Verification compliant</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <IconCheck size={16} color="#16A34A" />
                  <span>GDPR Art. 28 Data Processing Agreement & EU SCCs support</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <IconCheck size={16} color="#16A34A" />
                  <span>AES-256 database encryption & TLS 1.3 transit security</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <IconCheck size={16} color="#16A34A" />
                  <span>99.9% targeted uptime with enterprise SLA commitments</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <section style={{ backgroundColor: "#0F172A", color: "#FFFFFF", padding: "48px 24px", textAlign: "center" }}>
          <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <h2 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 12px" }}>
              Experience intelligent email triage today.
            </h2>
            <p style={{ fontSize: 14.5, color: "#94A3B8", lineHeight: 1.55, margin: "0 0 24px" }}>
              Connect your Google or Microsoft inbox in 2 minutes. Free trial included with zero card commitment.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
              <Link
                href="/signup"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "9px 20px",
                  fontSize: 13.5,
                  fontWeight: 600,
                  backgroundColor: "#2563EB",
                  color: "#FFFFFF",
                  borderRadius: 6,
                  textDecoration: "none",
                }}
              >
                <span>Start Free Trial</span>
                <IconArrowRight size={15} />
              </Link>
              <Link
                href="/request-demo"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "9px 20px",
                  fontSize: 13.5,
                  fontWeight: 600,
                  backgroundColor: "#1E293B",
                  color: "#FFFFFF",
                  border: "1px solid #334155",
                  borderRadius: 6,
                  textDecoration: "none",
                }}
              >
                Request Product Demo
              </Link>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media (max-width: 768px) {
          .about-company-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `,
        }}
      />
    </div>
  );
}
