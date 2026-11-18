import type { Metadata } from "next";
import Link from "next/link";
import { GlobalNavbar } from "@/components/navigation/GlobalNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { DemoRequestForm } from "@/components/forms/DemoRequestForm";
import {
  IconCheck,
  IconShieldLock,
  IconSparkles,
  IconClock,
  IconDeviceDesktopAnalytics,
  IconMailForward,
  IconBrandGoogle,
  IconBrandWindows,
} from "@tabler/icons-react";

export const metadata: Metadata = {
  title: "Request a Product Walkthrough — ProxiPilot",
  description:
    "Schedule a live, 15-minute product demonstration of ProxiPilot. See real-time inbox synchronization, grounding vector retrieval, and human-in-the-loop AI reply copilot in action.",
  alternates: { canonical: "https://proxipilot.com/request-demo" },
};

export default function RequestDemoPage() {
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
              Live Product Walkthrough
            </div>

            <h1
              style={{
                fontSize: "clamp(28px, 4vw, 42px)",
                fontWeight: 800,
                color: "#0F172A",
                lineHeight: 1.18,
                letterSpacing: "-0.025em",
                marginBottom: 14,
                maxWidth: 820,
              }}
            >
              See how ProxiPilot cuts email response time by 80% without hallucinations.
            </h1>

            <p
              style={{
                fontSize: "clamp(15px, 2vw, 17px)",
                color: "#475569",
                lineHeight: 1.55,
                maxWidth: 780,
                margin: 0,
              }}
            >
              Join an engineer for a high-signal 15-minute walkthrough. We will connect test email threads, index your sample product catalog, and demonstrate evidence-gated drafting in real time.
            </p>
          </div>
        </section>

        {/* Two-Column Form & Agenda Section */}
        <section style={{ padding: "64px 24px", maxWidth: 1160, margin: "0 auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 44,
              alignItems: "start",
            }}
          >
            {/* Left Column: What the Walkthrough Covers */}
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#2563EB",
                  marginBottom: 10,
                }}
              >
                15-Minute Technical Agenda
              </div>
              <h2
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  color: "#0F172A",
                  letterSpacing: "-0.02em",
                  marginBottom: 18,
                }}
              >
                What we will cover during your session
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 32 }}>
                {[
                  {
                    icon: <IconMailForward size={20} color="#2563EB" />,
                    title: "Live Inbox Synchronization",
                    desc: "Demonstration of bi-directional synchronization via Gmail OAuth or Microsoft 365 Graph without polling latency.",
                  },
                  {
                    icon: <IconDeviceDesktopAnalytics size={20} color="#0D9488" />,
                    title: "Knowledge Grounding in Action",
                    desc: "Uploading catalog specs, PDFs, or FAQs and watching how Qdrant vector retrieval retrieves exact facts before the LLM generates a syllable.",
                  },
                  {
                    icon: <IconSparkles size={20} color="#7C3AED" />,
                    title: "Human-in-the-Loop Review vs. Auto-pilot",
                    desc: "How your team retains 100% oversight with one-click approval, tone adjustment presets, and audit logs.",
                  },
                  {
                    icon: <IconShieldLock size={20} color="#E11D48" />,
                    title: "Security, Privacy & Data Isolation",
                    desc: "Architecture deep-dive: zero LLM model training on your data, tenant-isolated vector namespaces, and full GDPR compliance.",
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 14,
                      padding: "16px 18px",
                      borderRadius: 12,
                      border: "1px solid #E2E8F0",
                      backgroundColor: "#F8FAFC",
                    }}
                  >
                    <div
                      style={{
                        padding: 8,
                        borderRadius: 8,
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {item.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 3 }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.45 }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Verified Trust Badges */}
              <div
                style={{
                  padding: "18px 20px",
                  borderRadius: 12,
                  backgroundColor: "#F1F5F9",
                  border: "1px solid #CBD5E1",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B", marginBottom: 8 }}>
                  Zero Commitment Required
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#475569" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <IconCheck size={14} color="#16A34A" /> No credit card required to schedule or test
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <IconCheck size={14} color="#16A34A" /> Official Google & Microsoft authorized integration scopes
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <IconCheck size={14} color="#16A34A" /> 14-day free trial activated upon account onboarding
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Form */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 16,
                border: "1px solid #E2E8F0",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03)",
                padding: "32px 28px",
              }}
            >
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", marginBottom: 6 }}>
                  Schedule Your 15-Minute Session
                </h3>
                <p style={{ fontSize: 14, color: "#64748B", margin: 0 }}>
                  Tell us a bit about your workflow. An engineer will reach out within 2 business hours with direct calendar booking links.
                </p>
              </div>

              <DemoRequestForm />
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
