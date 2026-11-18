import type { Metadata } from "next";
import Link from "next/link";
import { GlobalNavbar } from "@/components/navigation/GlobalNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import {
  IconCpu,
  IconDatabase,
  IconShieldLock,
  IconMailCheck,
  IconChartBar,
  IconSparkles,
  IconArrowRight,
  IconCheck,
  IconBolt,
  IconLayersLinked,
} from "@tabler/icons-react";

export const metadata: Metadata = {
  title: "Features — Enterprise AI Email Automation Platform | ProxiPilot",
  description:
    "Explore ProxiPilot features: Isolated AI Reply Copilot, hybrid Qdrant vector RAG, intent classification, Gmail & Microsoft Outlook sync, and human-in-the-loop review queues.",
  alternates: { canonical: "https://proxipilot.com/features" },
};

const FEATURE_MODULES = [
  {
    icon: <IconSparkles size={22} color="#2563EB" />,
    badge: "Core Copilot",
    title: "Isolated AI Reply Copilot",
    description: "Thread-scoped intelligent assistant that generates high-fidelity replies without risking cross-customer context leakage.",
    problem: "Generic chat windows lose thread context or accidentally reference unrelated customer conversations.",
    solution: "A sliding copilot panel that locks strictly to the active message thread, applying tone presets (concise, executive, warm) and verified business rules.",
    value: "80% reduction in draft composition time with zero prompt-engineering overhead for agents.",
  },
  {
    icon: <IconDatabase size={22} color="#2563EB" />,
    badge: "Vector RAG",
    title: "Hybrid Knowledge Retrieval (Qdrant)",
    description: "Indexes product spec sheets, pricing matrices, and return policies into high-dimensional vector embeddings.",
    problem: "Language models hallucinate plausible-sounding prices, dates, or specifications when they don't know the answer.",
    solution: "Semantic vector matching with cosine similarity thresholding (&gt;0.82) pulls exact source paragraphs into temporary inference prompts.",
    value: "Zero factual hallucinations. If evidence is missing, the copilot explicitly prompts for clarification.",
  },
  {
    icon: <IconCpu size={22} color="#2563EB" />,
    badge: "Triage Engine",
    title: "Intent & Entity Classification",
    description: "Automated parsing of incoming email bodies to identify customer sentiment, SKU numbers, order IDs, and urgency.",
    problem: "High-volume inboxes require manual reading just to categorize which emails need immediate attention.",
    solution: "Real-time classification tags threads into Hot/Warm/Cold leads, billing escalations, or product inquiries within 10 seconds of arrival.",
    value: "Critical inquiries are immediately prioritized while repetitive questions are pre-drafted automatically.",
  },
  {
    icon: <IconLayersLinked size={22} color="#2563EB" />,
    badge: "Dual Mailbox Sync",
    title: "Gmail & Outlook Bi-Directional Integration",
    description: "Native OAuth 2.0 connection to Google Workspace and Microsoft 365 with background thread synchronization.",
    problem: "Teams don't want to abandon their existing email addresses or manage another disconnected ticketing platform.",
    solution: "ProxiPilot runs as a transparent intelligence proxy. Emails arrive in Gmail/Outlook and sync smoothly to your ProxiPilot queue.",
    value: "Zero disruption to existing team workflows, email clients, or customer-facing domain identities.",
  },
  {
    icon: <IconMailCheck size={22} color="#2563EB" />,
    badge: "Control & Governance",
    title: "Human-in-the-Loop Review Queue",
    description: "A frictionless draft approval interface that pairs machine velocity with human oversight.",
    problem: "Autonomous chatbots firing uninspected emails directly to customers create severe brand and legal risks.",
    solution: "AI drafts appear in the inbox as pending suggestions. Agents inspect, make optional micro-edits, and click Send with full audit tracking.",
    value: "Preserves 100% brand safety and customer empathy while accelerating response speed tenfold.",
  },
  {
    icon: <IconChartBar size={22} color="#2563EB" />,
    badge: "Operational Telemetry",
    title: "Inbox Velocity & Accuracy Analytics",
    description: "Real-time visibility into deflection rates, average first response times, and AI draft acceptance rates.",
    problem: "Managers cannot measure team email productivity or identify which customer questions consume the most hours.",
    solution: "Interactive dashboards track thread volumes, agent approval rates, and common knowledge gaps across your organization.",
    value: "Data-driven insights to continually refine your company documentation and support operations.",
  },
];

export default function FeaturesPage() {
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
              Enterprise Architecture
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
              Engineered for accuracy. <br />
              Controlled by humans.
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
              Discover the full suite of technologies powering ProxiPilot — from isolated thread copilots and Qdrant vector retrieval to bi-directional OAuth mailbox synchronization.
            </p>
          </div>
        </section>

        {/* Features Bento Grid */}
        <section style={{ padding: "56px 24px", maxWidth: 1200, margin: "0 auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
              gap: 24,
            }}
          >
            {FEATURE_MODULES.map((feat) => (
              <div
                key={feat.title}
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: 12,
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "all 140ms ease",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        backgroundColor: "#EFF6FF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {feat.icon}
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: "#F1F5F9",
                        color: "#475569",
                      }}
                    >
                      {feat.badge}
                    </span>
                  </div>

                  <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: "0 0 8px" }}>
                    {feat.title}
                  </h3>
                  <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.55, margin: "0 0 16px" }}>
                    {feat.description}
                  </p>

                  <div style={{ backgroundColor: "#F8FAFC", borderRadius: 8, padding: "12px 14px", marginBottom: 14, fontSize: 13 }}>
                    <div style={{ color: "#991B1B", fontWeight: 600, marginBottom: 4 }}>
                      Problem: {feat.problem}
                    </div>
                    <div style={{ color: "#166534", fontWeight: 600 }}>
                      Solution: {feat.solution}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    borderTop: "1px solid #F1F5F9",
                    paddingTop: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ fontSize: 12, color: "#2563EB", fontWeight: 600 }}>
                    Impact: {feat.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Roadmap Section */}
        <section
          id="roadmap"
          style={{
            backgroundColor: "#F8FAFC",
            borderTop: "1px solid #E2E8F0",
            borderBottom: "1px solid #E2E8F0",
            padding: "56px 24px",
          }}
        >
          <div style={{ maxWidth: 860, margin: "0 auto", textAlign: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#2563EB", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              Upcoming Milestones
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: "#0F172A", margin: "0 0 12px" }}>
              Product Evolution &amp; Ecosystem Roadmap
            </h2>
            <p style={{ fontSize: 14.5, color: "#475569", lineHeight: 1.6, margin: "0 0 32px" }}>
              We continuously expand ProxiPilot&rsquo;s capabilities to support enterprise multi-channel operations.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, textAlign: "left" }}>
              <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: "18px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#166534", textTransform: "uppercase" }}>Q3 2025 • Active</div>
                <h4 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "6px 0 4px" }}>Multi-Tenant Rule Chains</h4>
                <p style={{ fontSize: 12.5, color: "#64748B", margin: 0 }}>Advanced conditional branching based on customer lifetime value and SLA tags.</p>
              </div>
              <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: "18px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#2563EB", textTransform: "uppercase" }}>Q4 2025 • Beta</div>
                <h4 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "6px 0 4px" }}>WhatsApp &amp; Helpdesk Bridge</h4>
                <p style={{ fontSize: 12.5, color: "#64748B", margin: 0 }}>Extend grounded vector responses to WhatsApp Business API and Zendesk queues.</p>
              </div>
              <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: "18px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>2026 • Planned</div>
                <h4 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "6px 0 4px" }}>ERP Auto-Quoting Webhooks</h4>
                <p style={{ fontSize: 12.5, color: "#64748B", margin: 0 }}>Direct bi-directional sync with SAP, NetSuite, and QuickBooks for real-time inventory quotes.</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <section style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0F172A", margin: "0 0 10px" }}>
              Ready to eliminate email backlog?
            </h2>
            <p style={{ fontSize: 14, color: "#64748B", margin: "0 0 20px" }}>
              Explore how ProxiPilot fits your existing team stack in less than 5 minutes.
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
                href="/how-it-works"
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
                See How It Works
              </Link>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
