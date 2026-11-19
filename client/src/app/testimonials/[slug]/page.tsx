import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GlobalNavbar } from "@/components/navigation/GlobalNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { CASE_STUDIES_DATA } from "@/data/testimonials-data";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconClock,
  IconMail,
  IconDatabase,
  IconBuildingStore,
  IconShieldCheck,
  IconCircleCheckFilled,
  IconFileText,
  IconUsers,
} from "@tabler/icons-react";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return CASE_STUDIES_DATA.map((study) => ({
    slug: study.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const study = CASE_STUDIES_DATA.find((c) => c.slug === slug);

  if (!study) {
    return {
      title: "Case Study Not Found | ProxiPilot",
    };
  }

  return {
    title: `${study.company} Case Study: ${study.title} | ProxiPilot`,
    description: study.summary,
    alternates: { canonical: `https://proxipilot.com/testimonials/${study.slug}` },
    openGraph: {
      title: `${study.company} Case Study — ${study.title}`,
      description: study.summary,
      url: `https://proxipilot.com/testimonials/${study.slug}`,
      siteName: "ProxiPilot",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${study.company} Case Study — ProxiPilot`,
      description: study.summary,
    },
  };
}

export default async function CaseStudyPage({ params }: Props) {
  const { slug } = await params;
  const study = CASE_STUDIES_DATA.find((c) => c.slug === slug);

  if (!study) {
    notFound();
  }

  const otherStudies = CASE_STUDIES_DATA.filter((c) => c.slug !== slug);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#FFFFFF" }}>
      <GlobalNavbar />

      <main style={{ flex: "1 0 auto" }}>
        {/* =========================================================
            HEADER & BREADCRUMBS
            ========================================================= */}
        <section
          style={{
            padding: "48px 24px 44px",
            backgroundColor: "#FBFDFF",
            borderBottom: "1px solid #E2E8F0",
          }}
        >
          <div style={{ maxWidth: 1040, margin: "0 auto" }}>
            {/* Breadcrumb & Back Link */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "#64748B",
                marginBottom: 20,
                flexWrap: "wrap",
              }}
            >
              <Link
                href="/testimonials"
                style={{
                  color: "#635BFF",
                  textDecoration: "none",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <IconArrowLeft size={14} />
                <span>All Testimonials &amp; Stories</span>
              </Link>
              <span>/</span>
              <span>Case Studies</span>
              <span>/</span>
              <span style={{ color: "#0F172A", fontWeight: 600 }}>{study.company}</span>
            </div>

            {/* Badges */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#635BFF",
                  backgroundColor: "#F5F3FF",
                  border: "1px solid #DDD6FE",
                  padding: "4px 12px",
                  borderRadius: 6,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {study.industry}
              </span>
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 800,
                  color: "#059669",
                  backgroundColor: "#ECFDF5",
                  border: "1px solid #A7F3D0",
                  padding: "4px 10px",
                  borderRadius: 6,
                }}
              >
                Verified Pilot Outcome
              </span>
            </div>

            {/* Title */}
            <h1
              style={{
                fontSize: "clamp(28px, 4.2vw, 46px)",
                fontWeight: 800,
                color: "#0F172A",
                lineHeight: 1.18,
                letterSpacing: "-0.03em",
                margin: "0 0 16px",
                maxWidth: 900,
              }}
            >
              {study.title}
            </h1>

            <p
              style={{
                fontSize: "clamp(16px, 2.2vw, 19px)",
                color: "#475569",
                lineHeight: 1.6,
                maxWidth: 820,
                margin: "0 0 32px",
              }}
            >
              {study.summary}
            </p>

            {/* Fast Stats Bar */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 16,
                padding: "20px 24px",
                backgroundColor: "#FFFFFF",
                borderRadius: 14,
                border: "1px solid #E2E8F0",
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>
                  Primary Outcome
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: "#635BFF" }}>
                  {study.heroMetric}
                </div>
                <div style={{ fontSize: 12.5, color: "#475569" }}>{study.heroMetricLabel}</div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>
                  Monthly Volume
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", marginTop: 4 }}>
                  {study.emailVolume.split(" ")[0]}
                </div>
                <div style={{ fontSize: 12.5, color: "#475569" }}>Inbound emails/month</div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>
                  Mailbox Client
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", marginTop: 6 }}>
                  {study.mailboxSync.split(" ")[0]}
                </div>
                <div style={{ fontSize: 12.5, color: "#475569" }}>Native two-way sync</div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>
                  Team Size
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", marginTop: 6 }}>
                  {study.teamSize.split(" ")[0]} Reps
                </div>
                <div style={{ fontSize: 12.5, color: "#475569" }}>Active human reviewers</div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            SECTION 1: COMPANY OVERVIEW & TECH STACK
            ========================================================= */}
        <section style={{ padding: "52px 24px", maxWidth: 1040, margin: "0 auto" }}>
          <div
            style={{
              padding: "28px 30px",
              borderRadius: 16,
              backgroundColor: "#F8FAFC",
              border: "1px solid #E2E8F0",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 24,
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                Company Profile
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", marginTop: 4 }}>
                {study.company}
              </div>
              <div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>{study.industry}</div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                Mailbox Integration
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginTop: 4 }}>
                {study.mailboxSync}
              </div>
              <div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>OAuth 2.0 with draft injection</div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                Grounded Knowledge Base
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginTop: 4 }}>
                {study.databaseSync}
              </div>
              <div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>Sub-50ms Qdrant vector retrieval</div>
            </div>
          </div>
        </section>

        {/* =========================================================
            SECTION 2: THE CHALLENGE
            ========================================================= */}
        <section style={{ padding: "0 24px 52px", maxWidth: 1040, margin: "0 auto" }}>
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#DC2626",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 8,
              }}
            >
              The Operational Challenge
            </div>
            <h2
              style={{
                fontSize: "clamp(24px, 3.2vw, 32px)",
                fontWeight: 800,
                color: "#0F172A",
                lineHeight: 1.25,
                margin: "0 0 16px",
              }}
            >
              {study.challenge.heading}
            </h2>
            <p style={{ fontSize: 16, color: "#475569", lineHeight: 1.65, margin: 0 }}>
              {study.challenge.description}
            </p>
          </div>

          <div style={{ display: "grid", gap: 14, marginTop: 24 }}>
            {study.challenge.painPoints.map((pt, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: "16px 20px",
                  borderRadius: 12,
                  backgroundColor: "#FFF5F5",
                  border: "1px solid #FED7D7",
                }}
              >
                <span
                  style={{
                    color: "#DC2626",
                    fontWeight: 900,
                    fontSize: 16,
                    lineHeight: 1.2,
                    marginTop: 1,
                  }}
                >
                  ✕
                </span>
                <span style={{ fontSize: 14.5, color: "#7F1D1D", lineHeight: 1.55 }}>{pt}</span>
              </div>
            ))}
          </div>
        </section>

        {/* =========================================================
            SECTION 3: THE PROXIPILOT SOLUTION
            ========================================================= */}
        <section style={{ padding: "0 24px 60px", maxWidth: 1040, margin: "0 auto" }}>
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#635BFF",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 8,
              }}
            >
              The ProxiPilot Implementation
            </div>
            <h2
              style={{
                fontSize: "clamp(24px, 3.2vw, 32px)",
                fontWeight: 800,
                color: "#0F172A",
                lineHeight: 1.25,
                margin: "0 0 16px",
              }}
            >
              {study.solution.heading}
            </h2>
            <p style={{ fontSize: 16, color: "#475569", lineHeight: 1.65, margin: 0 }}>
              {study.solution.description}
            </p>
          </div>

          <div style={{ display: "grid", gap: 18, marginTop: 24 }}>
            {study.solution.steps.map((st, i) => (
              <div
                key={i}
                style={{
                  padding: "24px 26px",
                  borderRadius: 14,
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    backgroundColor: "#EDE9FE",
                    color: "#635BFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: 15,
                    flexShrink: 0,
                  }}
                >
                  0{i + 1}
                </div>
                <div>
                  <h4 style={{ fontSize: 17, fontWeight: 700, color: "#0F172A", margin: "0 0 6px" }}>
                    {st.title}
                  </h4>
                  <p style={{ fontSize: 14.5, color: "#475569", lineHeight: 1.55, margin: 0 }}>
                    {st.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* =========================================================
            SECTION 4: MEASURABLE RESULTS & BEFORE/AFTER TABLE
            ========================================================= */}
        <section
          style={{
            padding: "64px 24px",
            backgroundColor: "#F8FAFC",
            borderTop: "1px solid #E2E8F0",
            borderBottom: "1px solid #E2E8F0",
          }}
        >
          <div style={{ maxWidth: 1040, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 44 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#059669",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 8,
                }}
              >
                Documented Results
              </div>
              <h2
                style={{
                  fontSize: "clamp(24px, 3.2vw, 34px)",
                  fontWeight: 800,
                  color: "#0F172A",
                  lineHeight: 1.25,
                  margin: "0 0 12px",
                }}
              >
                Quantifiable Operational Impact
              </h2>
              <p style={{ fontSize: 15.5, color: "#64748B", maxWidth: 600, margin: "0 auto" }}>
                {study.results.summary}
              </p>
            </div>

            {/* 4 Outcome Metrics */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 18,
                marginBottom: 44,
              }}
            >
              {study.results.metrics.map((m, i) => (
                <div
                  key={i}
                  style={{
                    padding: "26px 22px",
                    borderRadius: 14,
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                  }}
                >
                  <div style={{ fontSize: 32, fontWeight: 900, color: "#635BFF", lineHeight: 1, marginBottom: 8 }}>
                    {m.value}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>
                    {m.label}
                  </div>
                  <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.5 }}>
                    {m.subtext}
                  </div>
                </div>
              ))}
            </div>

            {/* Before vs. After Detailed Breakdown */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 16,
                border: "1px solid #E2E8F0",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "18px 24px",
                  borderBottom: "1px solid #E2E8F0",
                  backgroundColor: "#F1F5F9",
                  fontWeight: 700,
                  fontSize: 14,
                  color: "#0F172A",
                  display: "grid",
                  gridTemplateColumns: "1.5fr 1fr 1fr 1.2fr",
                  gap: 16,
                }}
              >
                <div>Operating Metric</div>
                <div>Before ProxiPilot</div>
                <div>With ProxiPilot</div>
                <div>Net Outcome</div>
              </div>

              {study.results.beforeAfter.map((row, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "16px 24px",
                    borderBottom: idx === study.results.beforeAfter.length - 1 ? "none" : "1px solid #F1F5F9",
                    display: "grid",
                    gridTemplateColumns: "1.5fr 1fr 1fr 1.2fr",
                    gap: 16,
                    fontSize: 14,
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontWeight: 600, color: "#0F172A" }}>{row.metric}</div>
                  <div style={{ color: "#DC2626" }}>{row.before}</div>
                  <div style={{ fontWeight: 700, color: "#059669" }}>{row.after}</div>
                  <div>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#059669",
                        backgroundColor: "#ECFDF5",
                        padding: "3px 8px",
                        borderRadius: 6,
                      }}
                    >
                      {row.impact}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* =========================================================
            SECTION 5: EXECUTIVE QUOTE SPOTLIGHT
            ========================================================= */}
        <section style={{ padding: "64px 24px", maxWidth: 940, margin: "0 auto" }}>
          <div
            style={{
              padding: "44px 40px",
              borderRadius: 22,
              backgroundColor: "#FBFDFF",
              border: "1px solid #E2E8F0",
              boxShadow: "0 8px 24px -4px rgba(15, 23, 42, 0.04)",
              position: "relative",
            }}
          >
            <div
              style={{
                color: "#2563EB",
                fontSize: 48,
                fontWeight: 900,
                fontFamily: "Georgia, serif",
                lineHeight: 1,
                marginBottom: 16,
              }}
            >
              ““
            </div>

            <p
              style={{
                fontSize: "clamp(17px, 2.4vw, 22px)",
                color: "#0F172A",
                lineHeight: 1.55,
                fontWeight: 500,
                margin: "0 0 28px",
              }}
            >
              {study.quote.text}
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <img
                src={study.quote.avatar}
                alt={study.quote.author}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "2px solid #E2E8F0",
                }}
              />
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>
                  {study.quote.author}
                </div>
                <div style={{ fontSize: 13.5, color: "#64748B" }}>{study.quote.role}</div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            SECTION 6: PILOT DEPLOYMENT TIMELINE
            ========================================================= */}
        <section style={{ padding: "0 24px 64px", maxWidth: 1040, margin: "0 auto" }}>
          <h3
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#0F172A",
              marginBottom: 24,
              textAlign: "center",
            }}
          >
            Pilot Deployment Timeline
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 20,
            }}
          >
            {study.timeline.map((step, idx) => (
              <div
                key={idx}
                style={{
                  padding: "24px 22px",
                  borderRadius: 14,
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
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
                    fontWeight: 700,
                    marginBottom: 10,
                  }}
                >
                  {step.week}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>
                  {step.milestone}
                </div>
                <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.5, margin: 0 }}>
                  {step.detail}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* =========================================================
            SECTION 7: MORE CASE STUDIES
            ========================================================= */}
        <section
          style={{
            padding: "64px 24px",
            backgroundColor: "#F8FAFC",
            borderTop: "1px solid #E2E8F0",
          }}
        >
          <div style={{ maxWidth: 1040, margin: "0 auto" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 32,
                flexWrap: "wrap",
                gap: 16,
              }}
            >
              <div>
                <h3 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: "0 0 4px" }}>
                  Explore More Customer Stories
                </h3>
                <p style={{ fontSize: 14, color: "#64748B", margin: 0 }}>
                  See how other organizations eliminate draft bottlenecks with ProxiPilot.
                </p>
              </div>

              <Link
                href="/testimonials"
                style={{
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: "#635BFF",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span>View All Reviews</span>
                <IconArrowRight size={14} />
              </Link>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 22,
              }}
            >
              {otherStudies.slice(0, 3).map((other) => (
                <div
                  key={other.slug}
                  style={{
                    padding: "24px 22px",
                    borderRadius: 16,
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: "#635BFF",
                        textTransform: "uppercase",
                        marginBottom: 8,
                      }}
                    >
                      {other.company}
                    </div>
                    <h4 style={{ fontSize: 16.5, fontWeight: 700, color: "#0F172A", margin: "0 0 10px", lineHeight: 1.35 }}>
                      {other.title}
                    </h4>
                    <p style={{ fontSize: 13.5, color: "#64748B", lineHeight: 1.55, margin: "0 0 16px" }}>
                      {other.summary.slice(0, 110)}...
                    </p>
                  </div>

                  <Link
                    href={`/testimonials/${other.slug}`}
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#635BFF",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span>Read Study</span>
                    <IconArrowRight size={13} />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* =========================================================
            SECTION 8: CLOSING CTA
            ========================================================= */}
        <section
          style={{
            padding: "80px 24px",
            background: "linear-gradient(135deg, #0F172A 0%, #1E1B4B 100%)",
            color: "#FFFFFF",
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <h2
              style={{
                fontSize: "clamp(26px, 3.8vw, 42px)",
                fontWeight: 800,
                color: "#FFFFFF",
                letterSpacing: "-0.03em",
                margin: "0 0 16px",
              }}
            >
              Achieve the same results for your organization
            </h2>
            <p style={{ fontSize: 16, color: "#CBD5E1", lineHeight: 1.6, margin: "0 0 32px" }}>
              Start your free pilot today. Connect your team mailbox in under 5 minutes with zero MX changes.
            </p>

            <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
              <Link
                href="/signup"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: "#635BFF",
                  color: "#FFFFFF",
                  fontSize: 15,
                  fontWeight: 700,
                  padding: "12px 28px",
                  borderRadius: 8,
                  textDecoration: "none",
                  boxShadow: "0 4px 16px rgba(99, 91, 255, 0.4)",
                }}
              >
                <span>Start Free Trial</span>
                <IconArrowRight size={16} />
              </Link>

              <Link
                href="/contact"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  color: "#FFFFFF",
                  fontSize: 15,
                  fontWeight: 600,
                  padding: "12px 24px",
                  borderRadius: 8,
                  textDecoration: "none",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                }}
              >
                Talk to Sales
              </Link>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />

      {/* JSON-LD Schema for Case Study / Article */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: study.title,
            description: study.summary,
            author: {
              "@type": "Organization",
              name: "ProxiPilot",
              url: "https://proxipilot.com",
            },
            publisher: {
              "@type": "Organization",
              name: "ProxiPilot",
              logo: {
                "@type": "ImageObject",
                url: "https://proxipilot.com/proxipilot-logo.svg",
              },
            },
            mainEntityOfPage: {
              "@type": "WebPage",
              "@id": `https://proxipilot.com/testimonials/${study.slug}`,
            },
          }),
        }}
      />
    </div>
  );
}
