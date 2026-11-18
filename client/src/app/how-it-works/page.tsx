import type { Metadata } from "next";
import Link from "next/link";
import { GlobalNavbar } from "@/components/navigation/GlobalNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import {
  IconMailCheck,
  IconDatabase,
  IconCpu,
  IconSearch,
  IconEdit,
  IconSend,
  IconArrowRight,
  IconShieldCheck,
  IconEye,
  IconBolt,
} from "@tabler/icons-react";

export const metadata: Metadata = {
  title: "How It Works — The ProxiPilot Email Intelligence Workflow",
  description:
    "See the step-by-step product journey: connect your mailbox, index corporate knowledge, retrieve evidence, and review AI drafts with full human oversight.",
  alternates: { canonical: "https://proxipilot.com/how-it-works" },
};

const STEPS = [
  {
    num: "01",
    title: "Connect Your Business Mailbox",
    badge: "1-Click OAuth",
    description: "Authorize ProxiPilot via official Google Workspace or Microsoft 365 OAuth 2.0. No application passwords or insecure IMAP/SMTP credentials are required.",
    details: "ProxiPilot establishes a secure background synchronization listener, ingesting active conversation threads with zero disruption to your existing email clients.",
    icon: <IconMailCheck size={22} color="#2563EB" />,
  },
  {
    num: "02",
    title: "Upload Company Knowledge & Policies",
    badge: "Vector Embedding",
    description: "Upload product catalogues, warranty terms, SLA guidelines, or FAQ documents in PDF, CSV, or Markdown formats.",
    details: "Documents are segmented into semantic chunks and stored in an isolated, multi-tenant Qdrant vector collection assigned exclusively to your workspace.",
    icon: <IconDatabase size={22} color="#2563EB" />,
  },
  {
    num: "03",
    title: "Understand Incoming Inquiries",
    badge: "Intent Classification",
    description: "When an email arrives, ProxiPilot's language model identifies customer sentiment, product models, order IDs, and urgency.",
    details: "Threads are automatically tagged (e.g., Hot Lead, Support Escalation, Billing Query) to ensure high-priority messages receive immediate attention.",
    icon: <IconCpu size={22} color="#2563EB" />,
  },
  {
    num: "04",
    title: "Retrieve Verifiable Knowledge Snippets",
    badge: "Cosine Similarity",
    description: "The engine runs a semantic similarity search across your vector database to extract the exact paragraphs that answer the customer's question.",
    details: "Only high-confidence paragraphs (cosine similarity &gt;0.82) are retrieved. If relevant documentation doesn't exist, the system flags the missing information.",
    icon: <IconSearch size={22} color="#2563EB" />,
  },
  {
    num: "05",
    title: "Generate an Evidence-Gated Draft",
    badge: "Zero-Training AI",
    description: "A tailored, empathetic response is pre-drafted and queued directly in your agent's inbox view.",
    details: "The model is strictly constrained to the retrieved context. It cannot invent delivery timelines, fabricate prices, or promise unauthorized discounts.",
    icon: <IconEdit size={22} color="#2563EB" />,
  },
  {
    num: "06",
    title: "Review, Polish & Dispatch",
    badge: "Human Oversight",
    description: "Your team member inspects the drafted reply, adjusts tone using one-click presets, and clicks Send.",
    details: "The message is dispatched directly through your connected Google or Microsoft account. A full audit log records review timestamps and agent identities.",
    icon: <IconSend size={22} color="#2563EB" />,
  },
];

export default function HowItWorksPage() {
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
              The Product Journey
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
              From raw customer email to <br />
              verified response in seconds.
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
              See how ProxiPilot combines your company knowledge base with scoped OAuth inbox synchronization to turn high-volume queues into accurate, pre-drafted workflows.
            </p>
          </div>
        </section>

        {/* 6 Steps Visual Timeline */}
        <section style={{ padding: "56px 24px", maxWidth: 1080, margin: "0 auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {STEPS.map((step, idx) => (
              <div
                key={step.num}
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px 1fr",
                  gap: 24,
                  alignItems: "flex-start",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: 12,
                  padding: "24px 28px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                }}
                className="step-card-grid"
              >
                {/* Step Number Badge */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: 10,
                    padding: "12px 8px",
                  }}
                >
                  <span style={{ fontSize: 20, fontWeight: 800, color: "#2563EB", fontFamily: "monospace" }}>
                    {step.num}
                  </span>
                  <div style={{ marginTop: 6 }}>{step.icon}</div>
                </div>

                {/* Content */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        padding: "2px 8px",
                        borderRadius: 4,
                        backgroundColor: "#EFF6FF",
                        color: "#2563EB",
                        border: "1px solid #BFDBFE",
                      }}
                    >
                      {step.badge}
                    </span>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: 0 }}>
                      {step.title}
                    </h3>
                  </div>

                  <p style={{ fontSize: 14.5, color: "#334155", lineHeight: 1.6, margin: "0 0 8px" }}>
                    {step.description}
                  </p>

                  <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.55 }}>
                    {step.details}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Operating Modes Comparison */}
        <section
          style={{
            backgroundColor: "#F8FAFC",
            borderTop: "1px solid #E2E8F0",
            borderBottom: "1px solid #E2E8F0",
            padding: "56px 24px",
          }}
        >
          <div style={{ maxWidth: 1080, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#2563EB", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                Flexible Operating Modes
              </div>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: "#0F172A", margin: 0 }}>
                Human Review vs Autonomous Workflows
              </h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }} className="modes-comparison-grid">
              {/* Mode 1: Review */}
              <div style={{ background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: 10, padding: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <IconEye size={20} color="#2563EB" />
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0F172A", margin: 0 }}>
                    Draft &amp; Review Mode (Default)
                  </h3>
                </div>
                <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.55, margin: "0 0 14px" }}>
                  Ideal for customer inquiries, sales negotiations, and nuanced escalation threads. AI pre-drafts replies, but sending remains an explicit human action.
                </p>
                <ul style={{ paddingLeft: 18, margin: 0, fontSize: 13, color: "#334155", lineHeight: 1.6 }}>
                  <li>Every email inspected by an agent before dispatch.</li>
                  <li>Quick tone polish presets (Concise, Polish, Warm).</li>
                  <li>Zero risk of unauthorized commitments or miscommunication.</li>
                  <li>Cuts response time from minutes to 5 seconds per email.</li>
                </ul>
              </div>

              {/* Mode 2: Autonomous */}
              <div style={{ background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: 10, padding: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <IconBolt size={20} color="#166534" />
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0F172A", margin: 0 }}>
                    Autonomous Send Mode (Configurable)
                  </h3>
                </div>
                <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.55, margin: "0 0 14px" }}>
                  Ideal for repetitive, deterministic transactions like returns policy delivery, order receipt requests, or scheduling links.
                </p>
                <ul style={{ paddingLeft: 18, margin: 0, fontSize: 13, color: "#334155", lineHeight: 1.6 }}>
                  <li>Strict conditional trigger rules configured by admin.</li>
                  <li>Requires high confidence score threshold (&gt;95%).</li>
                  <li>Instant automatic dispatch 24 hours a day, 7 days a week.</li>
                  <li>Global emergency pause switch available in dashboard.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0F172A", margin: "0 0 10px" }}>
              Ready to see ProxiPilot in action?
            </h2>
            <p style={{ fontSize: 14, color: "#64748B", margin: "0 0 20px" }}>
              Set up your workspace and connect a mailbox in under 5 minutes.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
              <Link
                href="/signup"
                style={{
                  padding: "9px 18px",
                  fontSize: 13.5,
                  fontWeight: 600,
                  backgroundColor: "#2563EB",
                  color: "#FFFFFF",
                  borderRadius: 6,
                  textDecoration: "none",
                }}
              >
                Start Free Trial
              </Link>
              <Link
                href="/request-demo"
                style={{
                  padding: "9px 18px",
                  fontSize: 13.5,
                  fontWeight: 600,
                  backgroundColor: "#F1F5F9",
                  color: "#1E293B",
                  border: "1px solid #CBD5E1",
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
          .step-card-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
          .modes-comparison-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `,
        }}
      />
    </div>
  );
}
