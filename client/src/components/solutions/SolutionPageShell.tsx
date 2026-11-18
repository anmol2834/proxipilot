import React from "react";
import Link from "next/link";
import { GlobalNavbar } from "@/components/navigation/GlobalNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import {
  IconCheck,
  IconArrowRight,
  IconSparkles,
  IconMailForward,
  IconShieldLock,
  IconHelp,
  IconChevronRight,
} from "@tabler/icons-react";

export interface SolutionPageProps {
  badge: string;
  title: string;
  subtitle: string;
  highlightStats: { value: string; label: string }[];
  painPointsTitle: string;
  painPoints: { title: string; desc: string; icon: React.ReactNode }[];
  workflowTitle: string;
  workflowSubtitle: string;
  workflowSteps: { step: string; title: string; desc: string }[];
  scenario: {
    title: string;
    sender: string;
    subject: string;
    inquiry: string;
    evidenceFound: string;
    generatedDraft: string;
  };
  capabilities: { title: string; desc: string; tag: string }[];
  faqs: { question: string; answer: string }[];
  relatedSolutions: { title: string; href: string; desc: string }[];
}

export function SolutionPageShell({
  badge,
  title,
  subtitle,
  highlightStats,
  painPointsTitle,
  painPoints,
  workflowTitle,
  workflowSubtitle,
  workflowSteps,
  scenario,
  capabilities,
  faqs,
  relatedSolutions,
}: SolutionPageProps) {
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
          }}
        >
          <div style={{ maxWidth: 1160, margin: "0 auto" }}>
            {/* Breadcrumb */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                color: "#64748B",
                marginBottom: 16,
              }}
            >
              <Link href="/" style={{ color: "#64748B", textDecoration: "none" }}>
                Home
              </Link>
              <IconChevronRight size={14} />
              <Link href="/solutions" style={{ color: "#64748B", textDecoration: "none" }}>
                Solutions
              </Link>
              <IconChevronRight size={14} />
              <span style={{ color: "#0F172A", fontWeight: 600 }}>{badge}</span>
            </div>

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
              <IconSparkles size={14} />
              {badge}
            </div>

            <h1
              style={{
                fontSize: "clamp(28px, 4vw, 44px)",
                fontWeight: 800,
                color: "#0F172A",
                lineHeight: 1.18,
                letterSpacing: "-0.025em",
                marginBottom: 16,
                maxWidth: 900,
              }}
            >
              {title}
            </h1>

            <p
              style={{
                fontSize: "clamp(15px, 2vw, 18px)",
                color: "#475569",
                lineHeight: 1.55,
                maxWidth: 820,
                marginBottom: 28,
              }}
            >
              {subtitle}
            </p>

            {/* CTAs */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 36 }}>
              <Link
                href="/request-demo"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "11px 22px",
                  borderRadius: 10,
                  backgroundColor: "#2563EB",
                  color: "#FFFFFF",
                  fontWeight: 600,
                  fontSize: 14,
                  textDecoration: "none",
                  boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)",
                }}
              >
                Schedule 15-Min Walkthrough <IconArrowRight size={16} />
              </Link>
              <Link
                href="/pricing"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "11px 22px",
                  borderRadius: 10,
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #CBD5E1",
                  color: "#0F172A",
                  fontWeight: 600,
                  fontSize: 14,
                  textDecoration: "none",
                }}
              >
                Explore Pricing Plans
              </Link>
            </div>

            {/* Metrics Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 16,
                paddingTop: 24,
                borderTop: "1px solid #E2E8F0",
              }}
            >
              {highlightStats.map((st, i) => (
                <div key={i}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#2563EB", letterSpacing: "-0.02em" }}>
                    {st.value}
                  </div>
                  <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>{st.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section: Industry Pain Points */}
        <section style={{ padding: "64px 24px", maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#E11D48",
                marginBottom: 8,
              }}
            >
              Inbox Bottlenecks
            </div>
            <h2
              style={{
                fontSize: "clamp(24px, 3vw, 32px)",
                fontWeight: 800,
                color: "#0F172A",
                letterSpacing: "-0.02em",
              }}
            >
              {painPointsTitle}
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 24,
            }}
          >
            {painPoints.map((p, i) => (
              <div
                key={i}
                style={{
                  padding: "24px 22px",
                  borderRadius: 14,
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: "#FEF2F2",
                    color: "#DC2626",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  {p.icon}
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>{p.title}</h3>
                <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.55, margin: 0 }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section: Realistic Communication Scenario (Simulated UI) */}
        <section
          style={{
            padding: "64px 24px",
            backgroundColor: "#F8FAFC",
            borderTop: "1px solid #E2E8F0",
            borderBottom: "1px solid #E2E8F0",
          }}
        >
          <div style={{ maxWidth: 1160, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#2563EB",
                  marginBottom: 8,
                }}
              >
                Live Simulated Thread
              </div>
              <h2
                style={{
                  fontSize: "clamp(24px, 3vw, 32px)",
                  fontWeight: 800,
                  color: "#0F172A",
                  letterSpacing: "-0.02em",
                }}
              >
                {scenario.title}
              </h2>
            </div>

            <div
              style={{
                maxWidth: 900,
                margin: "0 auto",
                backgroundColor: "#FFFFFF",
                borderRadius: 16,
                border: "1px solid #CBD5E1",
                boxShadow: "0 10px 30px -10px rgba(0,0,0,0.08)",
                overflow: "hidden",
              }}
            >
              {/* Email Header */}
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid #E2E8F0",
                  backgroundColor: "#F8FAFC",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{scenario.subject}</div>
                  <div style={{ fontSize: 12, color: "#64748B" }}>From: {scenario.sender}</div>
                </div>
                <div
                  style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    backgroundColor: "#EFF6FF",
                    color: "#2563EB",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  Verified Thread
                </div>
              </div>

              {/* Incoming Customer Message */}
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", marginBottom: 6 }}>
                  Incoming Customer Email
                </div>
                <div style={{ fontSize: 14.5, color: "#334155", lineHeight: 1.6, whiteSpace: "pre-line" }}>
                  {scenario.inquiry}
                </div>
              </div>

              {/* RAG Evidence Retrieved Badge */}
              <div
                style={{
                  padding: "12px 24px",
                  backgroundColor: "#F0FDF4",
                  borderBottom: "1px solid #DCFCE7",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 12.5,
                  color: "#166534",
                }}
              >
                <IconCheck size={16} color="#16A34A" />
                <span>
                  <strong>Knowledge Grounding:</strong> {scenario.evidenceFound}
                </span>
              </div>

              {/* ProxiPilot Generated Reply */}
              <div style={{ padding: "20px 24px", backgroundColor: "#FAF5FF" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#7C3AED",
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  <IconSparkles size={14} /> ProxiPilot Evidence-Gated Draft (Ready for 1-Click Send)
                </div>
                <div style={{ fontSize: 14.5, color: "#1E1B4B", lineHeight: 1.6, whiteSpace: "pre-line" }}>
                  {scenario.generatedDraft}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section: Tailored Workflow */}
        <section style={{ padding: "64px 24px", maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#2563EB",
                marginBottom: 8,
              }}
            >
              Execution Architecture
            </div>
            <h2
              style={{
                fontSize: "clamp(24px, 3vw, 32px)",
                fontWeight: 800,
                color: "#0F172A",
                letterSpacing: "-0.02em",
                marginBottom: 8,
              }}
            >
              {workflowTitle}
            </h2>
            <p style={{ fontSize: 15, color: "#64748B", maxWidth: 650, margin: "0 auto" }}>{workflowSubtitle}</p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 20,
            }}
          >
            {workflowSteps.map((ws, i) => (
              <div
                key={i}
                style={{
                  padding: "24px 20px",
                  borderRadius: 14,
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: "#2563EB",
                    backgroundColor: "#EFF6FF",
                    padding: "3px 8px",
                    borderRadius: 6,
                    display: "inline-block",
                    marginBottom: 12,
                  }}
                >
                  {ws.step}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>{ws.title}</h3>
                <p style={{ fontSize: 13.5, color: "#64748B", lineHeight: 1.5, margin: 0 }}>{ws.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section: Tailored Capabilities */}
        <section
          style={{
            padding: "60px 24px",
            backgroundColor: "#F8FAFC",
            borderTop: "1px solid #E2E8F0",
            borderBottom: "1px solid #E2E8F0",
          }}
        >
          <div style={{ maxWidth: 1160, margin: "0 auto" }}>
            <h2
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: "#0F172A",
                marginBottom: 28,
                textAlign: "center",
              }}
            >
              Key Capabilities for Your Workflow
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: 20,
              }}
            >
              {capabilities.map((c, i) => (
                <div
                  key={i}
                  style={{
                    padding: "20px",
                    borderRadius: 12,
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#0284C7",
                      backgroundColor: "#F0F9FF",
                      padding: "2px 7px",
                      borderRadius: 4,
                      display: "inline-block",
                      marginBottom: 10,
                    }}
                  >
                    {c.tag}
                  </span>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>{c.title}</h3>
                  <p style={{ fontSize: 13.5, color: "#64748B", lineHeight: 1.5, margin: 0 }}>{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section: Industry FAQs */}
        <section style={{ padding: "64px 24px", maxWidth: 900, margin: "0 auto" }}>
          <h2
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: "#0F172A",
              marginBottom: 24,
              textAlign: "center",
            }}
          >
            Frequently Asked Questions
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {faqs.map((faq, i) => (
              <div
                key={i}
                style={{
                  padding: "18px 20px",
                  borderRadius: 12,
                  border: "1px solid #E2E8F0",
                  backgroundColor: "#FFFFFF",
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>{faq.question}</div>
                <div style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.55 }}>{faq.answer}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Section: Related Solutions Navigation */}
        <section
          style={{
            padding: "44px 24px",
            backgroundColor: "#F8FAFC",
            borderTop: "1px solid #E2E8F0",
          }}
        >
          <div style={{ maxWidth: 1160, margin: "0 auto" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 16 }}>
              Explore Other Tailored Solutions:
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 16,
              }}
            >
              {relatedSolutions.map((rs, i) => (
                <Link
                  key={i}
                  href={rs.href}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 10,
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    textDecoration: "none",
                    color: "#0F172A",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{rs.title}</div>
                    <div style={{ fontSize: 12, color: "#64748B" }}>{rs.desc}</div>
                  </div>
                  <IconArrowRight size={16} color="#2563EB" />
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA Banner */}
        <section
          style={{
            padding: "56px 24px",
            backgroundColor: "#0F172A",
            color: "#FFFFFF",
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: 740, margin: "0 auto" }}>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: 800, marginBottom: 12 }}>
              Ready to automate your team&apos;s email workflow?
            </h2>
            <p style={{ fontSize: 15, color: "#94A3B8", marginBottom: 28, lineHeight: 1.5 }}>
              Connect your inbox in under 60 seconds. Experience grounded drafting with our 14-day free trial.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link
                href="/request-demo"
                style={{
                  padding: "11px 24px",
                  borderRadius: 8,
                  backgroundColor: "#2563EB",
                  color: "#FFFFFF",
                  fontWeight: 600,
                  fontSize: 14,
                  textDecoration: "none",
                }}
              >
                Schedule Walkthrough
              </Link>
              <Link
                href="/pricing"
                style={{
                  padding: "11px 24px",
                  borderRadius: 8,
                  backgroundColor: "rgba(255,255,255,0.1)",
                  color: "#FFFFFF",
                  border: "1px solid rgba(255,255,255,0.2)",
                  fontWeight: 600,
                  fontSize: 14,
                  textDecoration: "none",
                }}
              >
                View Plans
              </Link>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
