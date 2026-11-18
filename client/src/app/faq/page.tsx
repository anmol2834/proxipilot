import type { Metadata } from "next";
import Link from "next/link";
import { GlobalNavbar } from "@/components/navigation/GlobalNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { FAQClient } from "@/components/faq/FAQClient";
import { IconHelp, IconArrowRight, IconBook, IconReceipt, IconMailForward } from "@tabler/icons-react";

export const metadata: Metadata = {
  title: "Frequently Asked Questions — ProxiPilot",
  description:
    "Find answers to common questions about ProxiPilot AI email automation, Gmail/Outlook inbox synchronization, vector knowledge grounding, security, and pricing.",
  alternates: { canonical: "https://proxipilot.com/faq" },
};

export default function FAQPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is ProxiPilot and how does it work?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "ProxiPilot is an enterprise AI email copilot and automation platform. It connects to your existing email inbox (Google Workspace or Microsoft 365) and indexes your company product catalogs and knowledge bases to generate production-grade draft replies grounded in factual data.",
        },
      },
      {
        "@type": "Question",
        name: "Does ProxiPilot send emails automatically without my review?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "By default, ProxiPilot operates in Human-in-the-Loop Review Mode. All generated responses are created as drafts requiring human approval or one-click sending.",
        },
      },
      {
        "@type": "Question",
        name: "How does ProxiPilot prevent AI hallucinations?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "ProxiPilot enforces evidence-gated retrieval using Qdrant vector search. If verified facts are not found in your uploaded knowledge base, ProxiPilot explicitly flags the missing information rather than inventing details.",
        },
      },
    ],
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#FFFFFF" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
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
              <IconHelp size={14} />
              Knowledge Base & Support
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
              Frequently Asked Questions
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
              Clear, transparent answers about how ProxiPilot synchronizes inboxes, retrieves verified knowledge, safeguards customer data, and scales with your team.
            </p>
          </div>
        </section>

        {/* Content Section */}
        <section style={{ padding: "56px 24px 64px" }}>
          <FAQClient />
        </section>

        {/* Quick Resource Links Footer Banner */}
        <section
          style={{
            padding: "44px 24px",
            backgroundColor: "#F8FAFC",
            borderTop: "1px solid #E2E8F0",
          }}
        >
          <div
            style={{
              maxWidth: 940,
              margin: "0 auto",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 20,
            }}
          >
            <Link
              href="/docs"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "16px 20px",
                backgroundColor: "#FFFFFF",
                borderRadius: 12,
                border: "1px solid #E2E8F0",
                textDecoration: "none",
                color: "#0F172A",
              }}
            >
              <div
                style={{
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor: "#EFF6FF",
                  color: "#2563EB",
                  display: "flex",
                }}
              >
                <IconBook size={20} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Read Documentation</div>
                <div style={{ fontSize: 12, color: "#64748B" }}>Step-by-step technical setup guides</div>
              </div>
            </Link>

            <Link
              href="/pricing"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "16px 20px",
                backgroundColor: "#FFFFFF",
                borderRadius: 12,
                border: "1px solid #E2E8F0",
                textDecoration: "none",
                color: "#0F172A",
              }}
            >
              <div
                style={{
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor: "#F0FDF4",
                  color: "#16A34A",
                  display: "flex",
                }}
              >
                <IconReceipt size={20} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Pricing &amp; Plans</div>
                <div style={{ fontSize: 12, color: "#64748B" }}>Transparent tiers, 14-day free trial</div>
              </div>
            </Link>

            <Link
              href="/contact"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "16px 20px",
                backgroundColor: "#FFFFFF",
                borderRadius: 12,
                border: "1px solid #E2E8F0",
                textDecoration: "none",
                color: "#0F172A",
              }}
            >
              <div
                style={{
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor: "#FAF5FF",
                  color: "#7C3AED",
                  display: "flex",
                }}
              >
                <IconMailForward size={20} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Still Have Questions?</div>
                <div style={{ fontSize: 12, color: "#64748B" }}>Reach our engineering support team</div>
              </div>
            </Link>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
