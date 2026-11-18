import type { Metadata } from "next";
import Link from "next/link";
import { GlobalNavbar } from "@/components/navigation/GlobalNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import {
  IconBriefcase,
  IconSparkles,
  IconCpu,
  IconWorld,
  IconShieldCheck,
  IconArrowRight,
  IconMail,
} from "@tabler/icons-react";

export const metadata: Metadata = {
  title: "Careers & Culture — ProxiPilot",
  description:
    "Explore engineering culture and career opportunities at ProxiPilot. We are building the future of grounded enterprise email automation.",
  alternates: { canonical: "https://proxipilot.com/careers" },
};

export default function CareersPage() {
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
              <IconBriefcase size={14} />
              Join Our Team
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
              Build the future of intelligent enterprise communication.
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
              We are an engineering-driven team solving the hardest problem in enterprise productivity: making AI assistants reliably truthful, context-aware, and secure.
            </p>
          </div>
        </section>

        {/* Culture & Engineering Values */}
        <section style={{ padding: "64px 24px 48px", maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <h2
              style={{
                fontSize: "clamp(24px, 3vw, 32px)",
                fontWeight: 800,
                color: "#0F172A",
                letterSpacing: "-0.02em",
              }}
            >
              How We Work
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 24,
            }}
          >
            <div
              style={{
                padding: "28px 24px",
                borderRadius: 14,
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  backgroundColor: "#EFF6FF",
                  color: "#2563EB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <IconCpu size={22} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>
                Grounded Truth Over Hype
              </h3>
              <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.55, margin: 0 }}>
                We don’t build generic chatbots that make up facts. We build deterministic RAG systems with rigorous evidence gating, vector embeddings, and zero model hallucinations.
              </p>
            </div>

            <div
              style={{
                padding: "28px 24px",
                borderRadius: 14,
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  backgroundColor: "#F0FDF4",
                  color: "#16A34A",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <IconWorld size={22} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>
                Async-First Remote Culture
              </h3>
              <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.55, margin: 0 }}>
                We prioritize deep work, written documentation, and minimal meetings. Our team collaborates asynchronously with high autonomy and clear ownership.
              </p>
            </div>

            <div
              style={{
                padding: "28px 24px",
                borderRadius: 14,
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  backgroundColor: "#FAF5FF",
                  color: "#7C3AED",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <IconShieldCheck size={22} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>
                Rigorous Security &amp; Ethics
              </h3>
              <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.55, margin: 0 }}>
                Working with enterprise communications means our security standards are non-negotiable. Privacy, encryption, and zero-training guarantees are central to every pull request.
              </p>
            </div>
          </div>
        </section>

        {/* Current Openings State */}
        <section
          style={{
            padding: "56px 24px 64px",
            backgroundColor: "#F8FAFC",
            borderTop: "1px solid #E2E8F0",
          }}
        >
          <div style={{ maxWidth: 840, margin: "0 auto", textAlign: "center" }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0F172A", marginBottom: 12 }}>
              Current Openings
            </h2>
            <p style={{ fontSize: 15, color: "#64748B", marginBottom: 32 }}>
              We are currently fully staffed and have no active openings at this moment. However, we are always interested in connecting with exceptional systems engineers, full-stack developers, and AI researchers.
            </p>

            <div
              style={{
                padding: "32px",
                borderRadius: 16,
                backgroundColor: "#FFFFFF",
                border: "1px solid #CBD5E1",
                boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>
                Want to join us in the future?
              </div>
              <p style={{ fontSize: 14, color: "#64748B", maxWidth: 540, margin: "0 auto 20px", lineHeight: 1.5 }}>
                Send your GitHub profile, portfolio, and a brief note describing what you love building to our engineering team.
              </p>
              <Link
                href="/contact"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 20px",
                  borderRadius: 8,
                  backgroundColor: "#2563EB",
                  color: "#FFFFFF",
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                <IconMail size={16} /> Submit General Interest
              </Link>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
