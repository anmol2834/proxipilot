"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  IconStar,
  IconArrowRight,
  IconCheck,
  IconShieldCheck,
  IconClock,
  IconDatabase,
  IconChevronDown,
  IconChevronUp,
  IconMail,
  IconSparkles,
  IconSearch,
  IconBuildingStore,
  IconTruck,
  IconShoppingCart,
  IconCode,
  IconBriefcase,
  IconCircleCheckFilled,
} from "@tabler/icons-react";
import {
  TESTIMONIALS_DATA,
  CASE_STUDIES_DATA,
  TESTIMONIALS_FAQS,
  TestimonialItem,
} from "@/data/testimonials-data";

export function TestimonialsClientView() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [viewMode, setViewMode] = useState<"marquee" | "grid">("marquee");

  const categories = [
    { id: "all", label: "All Reviews", count: TESTIMONIALS_DATA.length, icon: IconSparkles },
    { id: "wholesale", label: "Wholesale & B2B", count: 2, icon: IconBuildingStore },
    { id: "logistics", label: "Logistics & Freight", count: 3, icon: IconTruck },
    { id: "ecommerce", label: "E-Commerce & Retail", count: 2, icon: IconShoppingCart },
    { id: "saas", label: "B2B SaaS & Tech", count: 2, icon: IconCode },
    { id: "agencies", label: "Agencies & Services", count: 2, icon: IconBriefcase },
  ];

  const filteredTestimonials =
    selectedCategory === "all"
      ? TESTIMONIALS_DATA
      : TESTIMONIALS_DATA.filter((t) => t.category === selectedCategory);

  // Divide into two rows for the dual-row marquee
  const row1 = TESTIMONIALS_DATA.slice(0, 6);
  const row2 = TESTIMONIALS_DATA.slice(6, 12);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <div style={{ width: "100%", overflowX: "hidden", backgroundColor: "#FFFFFF" }}>
      {/* Dynamic Keyframes for the Infinite Dual-Row Marquee */}
      <style>{`
        @keyframes marqueeScrollLeft {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes marqueeScrollRight {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .marquee-track-left {
          display: flex;
          gap: 24px;
          width: max-content;
          animation: marqueeScrollLeft 48s linear infinite;
        }
        .marquee-track-right {
          display: flex;
          gap: 24px;
          width: max-content;
          animation: marqueeScrollRight 48s linear infinite;
        }
        .marquee-container:hover .marquee-track-left,
        .marquee-container:hover .marquee-track-right {
          animation-play-state: paused;
        }
        .testimonial-card-hover {
          transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
        }
        .testimonial-card-hover:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 28px -6px rgba(15, 23, 42, 0.08), 0 4px 8px -2px rgba(15, 23, 42, 0.03);
          border-color: #CBD5E1 !important;
        }
        .case-study-card {
          transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease;
        }
        .case-study-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 16px 32px -8px rgba(99, 91, 255, 0.12);
          border-color: #C7D2FE !important;
        }
      `}</style>

      {/* =========================================================
          SECTION 1: HERO & WALL OF PRAISE (MATCHING USER REFERENCE)
          ========================================================= */}
      <section
        style={{
          padding: "64px 20px 48px",
          backgroundColor: "#FBFDFF",
          borderBottom: "1px solid #F1F5F9",
          textAlign: "center",
          position: "relative",
        }}
      >
        <div style={{ maxWidth: 880, margin: "0 auto", position: "relative", zIndex: 2 }}>
          {/* Top Black Floating Pill Badge (Exact match to reference image!) */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 18px 6px 8px",
              borderRadius: 9999,
              backgroundColor: "#0A0D14",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.18)",
              marginBottom: 26,
            }}
          >
            {/* Blue Star Circle Icon */}
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                backgroundColor: "#2563EB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                flexShrink: 0,
              }}
            >
              <IconStar size={14} fill="#FFFFFF" stroke={0} />
            </div>
            <span
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: "#FFFFFF",
                letterSpacing: "-0.01em",
              }}
            >
              Rated 4.9/5 by over 1,200+ Enterprise Leaders
            </span>
          </div>

          {/* Main Title (Exact geometry & sentiment of reference image) */}
          <h1
            style={{
              fontSize: "clamp(32px, 4.8vw, 54px)",
              fontWeight: 800,
              color: "#0F172A",
              letterSpacing: "-0.035em",
              lineHeight: 1.14,
              margin: "0 auto 18px",
              maxWidth: 780,
            }}
          >
            Words of praise from teams who got their time back.
          </h1>

          <p
            style={{
              fontSize: "clamp(15px, 2.2vw, 17.5px)",
              color: "#475569",
              lineHeight: 1.6,
              maxWidth: 680,
              margin: "0 auto 36px",
            }}
          >
            Discover how commercial operations, wholesale coordinators, sales reps, and customer support leaders eliminate draft fatigue and cut email turnaround times by 78% with ProxiPilot.
          </p>

          {/* Switcher & Filter Pills */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    if (cat.id !== "all") {
                      setViewMode("grid");
                    }
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 14px",
                    borderRadius: 9999,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    border: isActive ? "1px solid #635BFF" : "1px solid #E2E8F0",
                    backgroundColor: isActive ? "#635BFF" : "#FFFFFF",
                    color: isActive ? "#FFFFFF" : "#475569",
                    boxShadow: isActive
                      ? "0 4px 12px rgba(99, 91, 255, 0.25)"
                      : "0 1px 3px rgba(0,0,0,0.02)",
                    transition: "all 140ms ease",
                  }}
                >
                  <Icon size={14} stroke={2} />
                  <span>{cat.label}</span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "1px 6px",
                      borderRadius: 10,
                      backgroundColor: isActive ? "rgba(255,255,255,0.25)" : "#F1F5F9",
                      color: isActive ? "#FFFFFF" : "#64748B",
                    }}
                  >
                    {cat.count}
                  </span>
                </button>
              );
            })}

            {/* View Toggle */}
            <div
              style={{
                display: "inline-flex",
                backgroundColor: "#F1F5F9",
                borderRadius: 9999,
                padding: 3,
                marginLeft: 8,
              }}
            >
              <button
                onClick={() => setViewMode("marquee")}
                style={{
                  padding: "5px 12px",
                  borderRadius: 9999,
                  fontSize: 12,
                  fontWeight: 600,
                  border: "none",
                  backgroundColor: viewMode === "marquee" ? "#FFFFFF" : "transparent",
                  color: viewMode === "marquee" ? "#0F172A" : "#64748B",
                  boxShadow: viewMode === "marquee" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  cursor: "pointer",
                }}
              >
                Carousel Flow
              </button>
              <button
                onClick={() => setViewMode("grid")}
                style={{
                  padding: "5px 12px",
                  borderRadius: 9999,
                  fontSize: 12,
                  fontWeight: 600,
                  border: "none",
                  backgroundColor: viewMode === "grid" ? "#FFFFFF" : "transparent",
                  color: viewMode === "grid" ? "#0F172A" : "#64748B",
                  boxShadow: viewMode === "grid" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  cursor: "pointer",
                }}
              >
                Grid View
              </button>
            </div>
          </div>
        </div>

        {/* =========================================================
            INFINITE DUAL-ROW MARQUEE (EXACT UI FROM REFERENCE IMAGE)
            ========================================================= */}
        {viewMode === "marquee" && selectedCategory === "all" ? (
          <div
            className="marquee-container"
            style={{
              marginTop: 40,
              width: "100%",
              overflow: "hidden",
              position: "relative",
              padding: "12px 0",
              WebkitMaskImage:
                "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
              maskImage:
                "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
            }}
          >
            {/* ROW 1: Scrolling Left */}
            <div style={{ marginBottom: 24, overflow: "hidden" }}>
              <div className="marquee-track-left">
                {row1.concat(row1).map((item, idx) => (
                  <TestimonialCard key={`r1-${idx}`} item={item} />
                ))}
              </div>
            </div>

            {/* ROW 2: Scrolling Right */}
            <div style={{ overflow: "hidden" }}>
              <div className="marquee-track-right">
                {row2.concat(row2).map((item, idx) => (
                  <TestimonialCard key={`r2-${idx}`} item={item} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* FILTERED GRID VIEW */
          <div
            style={{
              maxWidth: 1200,
              margin: "44px auto 0",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 24,
              padding: "0 16px",
            }}
          >
            {filteredTestimonials.map((item) => (
              <TestimonialCard key={item.id} item={item} isGrid />
            ))}
          </div>
        )}
      </section>

      {/* =========================================================
          SECTION 2: DOCUMENTED PILOT RESULTS & QUANTITATIVE METRICS
          ========================================================= */}
      <section style={{ padding: "64px 24px", maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#635BFF",
              marginBottom: 10,
            }}
          >
            Verified Quantitative Outcomes
          </div>
          <h2
            style={{
              fontSize: "clamp(26px, 3.4vw, 38px)",
              fontWeight: 800,
              letterSpacing: "-0.025em",
              color: "#0F172A",
              lineHeight: 1.2,
              margin: "0 0 14px",
            }}
          >
            Measurable impact across production email operations
          </h2>
          <p style={{ fontSize: 16, color: "#64748B", maxWidth: 640, margin: "0 auto" }}>
            Operational metrics benchmarked directly from customer pilot environments across Gmail and Microsoft 365.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 20,
          }}
        >
          {[
            {
              metric: "78%",
              title: "Handle Time Reduction",
              desc: "Average time spent verifying catalog SKUs and drafting answers fell from 8.2 mins to 45 seconds.",
              color: "#635BFF",
              bg: "#F5F3FF",
              border: "#EDE9FE",
            },
            {
              metric: "< 45s",
              title: "Draft Ingestion Latency",
              desc: "Complete context-grounded drafts staged into Gmail and Outlook drafts folders within seconds.",
              color: "#2563EB",
              bg: "#EFF6FF",
              border: "#DBEAFE",
            },
            {
              metric: "0",
              title: "Price & SKU Mismatches",
              desc: "Strict vector grounding prevents hallucinations. Zero outdated pricing or SKU errors delivered.",
              color: "#059669",
              bg: "#ECFDF5",
              border: "#D1FAE5",
            },
            {
              metric: "99.8%",
              title: "Human Acceptance Rate",
              desc: "Rep-in-the-loop review recorded for every outgoing email, ensuring full governance and trust.",
              color: "#0891B2",
              bg: "#ECFEFF",
              border: "#CFFAFE",
            },
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                padding: "28px 24px",
                borderRadius: 18,
                backgroundColor: item.bg,
                border: `1px solid ${item.border}`,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "clamp(34px, 4vw, 44px)",
                    fontWeight: 900,
                    letterSpacing: "-0.03em",
                    color: item.color,
                    lineHeight: 1,
                    marginBottom: 12,
                  }}
                >
                  {item.metric}
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#0F172A",
                    marginBottom: 8,
                  }}
                >
                  {item.title}
                </div>
                <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.55, margin: 0 }}>
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* =========================================================
          SECTION 3: IN-DEPTH CASE STUDIES (NESTED PAGES SHOWCASE)
          ========================================================= */}
      <section
        style={{
          padding: "72px 24px",
          backgroundColor: "#F8FAFC",
          borderTop: "1px solid #E2E8F0",
          borderBottom: "1px solid #E2E8F0",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 12px",
                borderRadius: 20,
                backgroundColor: "#EFF6FF",
                border: "1px solid #BFDBFE",
                color: "#2563EB",
                fontSize: 11.5,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 12,
              }}
            >
              Deep Dive Stories
            </div>
            <h2
              style={{
                fontSize: "clamp(26px, 3.4vw, 38px)",
                fontWeight: 800,
                letterSpacing: "-0.025em",
                color: "#0F172A",
                lineHeight: 1.2,
                margin: "0 0 14px",
              }}
            >
              Customer Case Studies: Verified Architecture &amp; Outcomes
            </h2>
            <p style={{ fontSize: 16, color: "#64748B", maxWidth: 640, margin: "0 auto" }}>
              Explore how enterprise operations teams connect their mailboxes, index proprietary knowledge, and scale output.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
              gap: 28,
            }}
          >
            {CASE_STUDIES_DATA.map((study) => (
              <div
                key={study.slug}
                className="case-study-card"
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 20,
                  border: "1px solid #E2E8F0",
                  padding: "32px 28px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  {/* Top Metadata */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      marginBottom: 18,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: "#635BFF",
                        backgroundColor: "#F5F3FF",
                        border: "1px solid #DDD6FE",
                        padding: "3px 10px",
                        borderRadius: 6,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {study.industry.split("&")[0]}
                    </span>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 13,
                        fontWeight: 800,
                        color: "#059669",
                        backgroundColor: "#ECFDF5",
                        padding: "3px 8px",
                        borderRadius: 6,
                      }}
                    >
                      {study.heroMetric} {study.heroMetricLabel}
                    </span>
                  </div>

                  {/* Company & Title */}
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#64748B",
                      marginBottom: 6,
                    }}
                  >
                    {study.company}
                  </div>
                  <h3
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      color: "#0F172A",
                      lineHeight: 1.3,
                      margin: "0 0 14px",
                    }}
                  >
                    {study.title}
                  </h3>

                  <p
                    style={{
                      fontSize: 14,
                      color: "#475569",
                      lineHeight: 1.6,
                      margin: "0 0 20px",
                    }}
                  >
                    {study.summary}
                  </p>

                  {/* Stack Badges */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                      marginBottom: 24,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11.5,
                        color: "#475569",
                        backgroundColor: "#F1F5F9",
                        padding: "3px 8px",
                        borderRadius: 6,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <IconMail size={13} color="#635BFF" />
                      <span>{study.mailboxSync.split(" ")[0]}</span>
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: "#475569",
                        backgroundColor: "#F1F5F9",
                        padding: "3px 8px",
                        borderRadius: 6,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <IconDatabase size={13} color="#059669" />
                      <span>Qdrant Vector Retrieval</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Link */}
                <div
                  style={{
                    paddingTop: 18,
                    borderTop: "1px solid #F1F5F9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <img
                      src={study.quote.avatar}
                      alt={study.quote.author}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: "1.5px solid #E2E8F0",
                      }}
                    />
                    <div style={{ fontSize: 12, color: "#64748B" }}>
                      <div style={{ fontWeight: 700, color: "#0F172A" }}>{study.quote.author}</div>
                      <div>{study.teamSize}</div>
                    </div>
                  </div>

                  <Link
                    href={`/testimonials/${study.slug}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#635BFF",
                      textDecoration: "none",
                    }}
                  >
                    <span>Read Study</span>
                    <IconArrowRight size={14} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================
          SECTION 4: BEFORE VS. AFTER COMPARISON
          ========================================================= */}
      <section style={{ padding: "72px 24px", maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#635BFF",
              marginBottom: 10,
            }}
          >
            The Operational Difference
          </div>
          <h2
            style={{
              fontSize: "clamp(26px, 3.4vw, 38px)",
              fontWeight: 800,
              letterSpacing: "-0.025em",
              color: "#0F172A",
              lineHeight: 1.2,
              margin: "0 0 14px",
            }}
          >
            How teams conquer inbox chaos with ProxiPilot
          </h2>
          <p style={{ fontSize: 16, color: "#64748B", maxWidth: 620, margin: "0 auto" }}>
            Compare traditional email triage with ProxiPilot&apos;s automated evidence grounding and draft synchronization.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 24,
          }}
        >
          {/* Traditional Workflow */}
          <div
            style={{
              padding: "32px 28px",
              borderRadius: 20,
              backgroundColor: "#FFF5F5",
              border: "1px solid #FED7D7",
            }}
          >
            <div
              style={{
                display: "inline-block",
                padding: "4px 10px",
                borderRadius: 6,
                backgroundColor: "#FEE2E2",
                color: "#991B1B",
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: 16,
              }}
            >
              Without ProxiPilot: Manual Inbox Triage
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 14 }}>
              {[
                "Reps spend 6–10 minutes per email digging through PDF price sheets, ERP tables, and old email threads.",
                "Inbound RFQs and return requests pile up in unread queues during peak volume surges.",
                "High risk of outdated pricing, hallucinated specs, or policy violations sent to clients.",
                "Managers cannot track whether junior staff followed verified SOP guidelines.",
                "Reps suffer from chronic draft fatigue, leading to curt, low-converting responses.",
              ].map((pt, i) => (
                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span
                    style={{
                      color: "#DC2626",
                      fontSize: 16,
                      lineHeight: 1.2,
                      fontWeight: 800,
                      marginTop: 2,
                    }}
                  >
                    ✕
                  </span>
                  <span style={{ fontSize: 14, color: "#475569", lineHeight: 1.55 }}>{pt}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* With ProxiPilot */}
          <div
            style={{
              padding: "32px 28px",
              borderRadius: 20,
              backgroundColor: "#F0FDF4",
              border: "1px solid #BBF7D0",
            }}
          >
            <div
              style={{
                display: "inline-block",
                padding: "4px 10px",
                borderRadius: 6,
                backgroundColor: "#DCFCE7",
                color: "#166534",
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: 16,
              }}
            >
              With ProxiPilot: Grounded Copilot Workflow
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 14 }}>
              {[
                "Inbound emails are classified for intent, urgency, and order IDs within 10 seconds.",
                "Verified catalog prices and SOPs are retrieved from private Qdrant vector storage.",
                "A complete, empathetic draft is waiting in the rep's native Gmail or Outlook client.",
                "Human-in-the-loop: Rep inspects the draft with citations, edits if desired, and clicks send.",
                "Audit trail logs who approved the draft and the exact vector evidence used.",
              ].map((pt, i) => (
                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <IconCircleCheckFilled
                    size={18}
                    color="#16A34A"
                    style={{ flexShrink: 0, marginTop: 2 }}
                  />
                  <span style={{ fontSize: 14, color: "#166534", lineHeight: 1.55, fontWeight: 500 }}>
                    {pt}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* =========================================================
          SECTION 5: VERIFICATION & ENTERPRISE COMPLIANCE NOTICE
          ========================================================= */}
      <section style={{ padding: "0 24px 64px", maxWidth: 1160, margin: "0 auto" }}>
        <div
          style={{
            padding: "28px 32px",
            borderRadius: 18,
            backgroundColor: "#F8FAFC",
            border: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "flex-start",
            gap: 20,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: "#EDE9FE",
              color: "#635BFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <IconShieldCheck size={24} />
          </div>

          <div style={{ flex: 1 }}>
            <h4
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: "#0F172A",
                margin: "0 0 6px",
              }}
            >
              Customer Feedback &amp; Verification Policy
            </h4>
            <p
              style={{
                fontSize: 14,
                color: "#475569",
                lineHeight: 1.6,
                margin: "0 0 14px",
              }}
            >
              ProxiPilot only publishes customer testimonials and operational case studies that have undergone written owner review, metrics verification, and explicit consent. Your customer data and emails are processed strictly in isolated tenant spaces and are never used to train generalized foundation models under our Google Limited Use compliance.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <Link
                href="/contact"
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
                <span>Submit Pilot Case Study</span>
                <IconArrowRight size={13} />
              </Link>
              <span style={{ color: "#CBD5E1" }}>•</span>
              <Link
                href="/security"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#64748B",
                  textDecoration: "none",
                }}
              >
                Security &amp; Google API Compliance
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          SECTION 6: SEO FAQ ACCORDION (RICH SNIPPETS COMPLIANT)
          ========================================================= */}
      <section
        style={{
          padding: "72px 24px",
          backgroundColor: "#FBFDFF",
          borderTop: "1px solid #F1F5F9",
          borderBottom: "1px solid #F1F5F9",
        }}
      >
        <div style={{ maxWidth: 840, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#635BFF",
                marginBottom: 10,
              }}
            >
              Frequently Asked Questions
            </div>
            <h2
              style={{
                fontSize: "clamp(26px, 3.4vw, 36px)",
                fontWeight: 800,
                letterSpacing: "-0.025em",
                color: "#0F172A",
                lineHeight: 1.2,
                margin: "0 0 14px",
              }}
            >
              Questions about customer reviews &amp; pilot results
            </h2>
            <p style={{ fontSize: 15.5, color: "#64748B", margin: 0 }}>
              Learn more about how ProxiPilot documents operational improvements and protects customer confidentiality.
            </p>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {TESTIMONIALS_FAQS.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  style={{
                    borderRadius: 14,
                    border: isOpen ? "1px solid #C7D2FE" : "1px solid #E2E8F0",
                    backgroundColor: "#FFFFFF",
                    overflow: "hidden",
                    transition: "border-color 140ms ease",
                  }}
                >
                  <button
                    onClick={() => toggleFaq(idx)}
                    style={{
                      width: "100%",
                      padding: "18px 22px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      textAlign: "left",
                      border: "none",
                      backgroundColor: "transparent",
                      cursor: "pointer",
                      gap: 16,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 15.5,
                        fontWeight: 700,
                        color: isOpen ? "#635BFF" : "#0F172A",
                      }}
                    >
                      {faq.question}
                    </span>
                    <span style={{ color: isOpen ? "#635BFF" : "#94A3B8", flexShrink: 0 }}>
                      {isOpen ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
                    </span>
                  </button>

                  {isOpen && (
                    <div
                      style={{
                        padding: "0 22px 20px",
                        fontSize: 14.5,
                        color: "#475569",
                        lineHeight: 1.6,
                        borderTop: "1px solid #F1F5F9",
                        paddingTop: 14,
                      }}
                    >
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================
          SECTION 7: CLOSING CALL TO ACTION
          ========================================================= */}
      <section
        style={{
          padding: "80px 24px",
          background: "linear-gradient(135deg, #0F172A 0%, #1E1B4B 100%)",
          color: "#FFFFFF",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ maxWidth: 740, margin: "0 auto", position: "relative", zIndex: 2 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 12px",
              borderRadius: 20,
              backgroundColor: "rgba(99, 91, 255, 0.2)",
              border: "1px solid rgba(165, 180, 252, 0.3)",
              color: "#A5B4FC",
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 20,
            }}
          >
            Start Your Pilot Today
          </div>

          <h2
            style={{
              fontSize: "clamp(28px, 4.2vw, 46px)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "#FFFFFF",
              lineHeight: 1.18,
              margin: "0 0 18px",
            }}
          >
            Ready to eliminate email backlog and reclaim hours every week?
          </h2>

          <p
            style={{
              fontSize: "clamp(15px, 2vw, 17px)",
              color: "#CBD5E1",
              lineHeight: 1.6,
              maxWidth: 580,
              margin: "0 auto 34px",
            }}
          >
            Connect your Gmail or Outlook mailbox in under 5 minutes. No MX rerouting, zero staff training, and 100% human-controlled drafts.
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
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
                padding: "13px 30px",
                borderRadius: 8,
                textDecoration: "none",
                boxShadow: "0 4px 18px rgba(99, 91, 255, 0.45)",
                transition: "all 140ms ease",
              }}
            >
              <span>Start Free Trial</span>
              <IconArrowRight size={16} stroke={2.5} />
            </Link>

            <Link
              href="/contact"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                color: "#FFFFFF",
                fontSize: 15,
                fontWeight: 600,
                padding: "13px 26px",
                borderRadius: 8,
                textDecoration: "none",
                border: "1px solid rgba(255, 255, 255, 0.18)",
                transition: "all 140ms ease",
              }}
            >
              Talk to Sales
            </Link>
          </div>
        </div>
      </section>

      {/* JSON-LD Structured Data for Google Rich Snippets */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: "ProxiPilot Autonomous AI Email Platform",
            description:
              "AI email copilot that drafts grounded responses from business knowledge bases with human approval.",
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: "4.9",
              reviewCount: "1240",
              bestRating: "5",
              worstRating: "1",
            },
            review: TESTIMONIALS_DATA.slice(0, 5).map((t) => ({
              "@type": "Review",
              author: { "@type": "Person", name: t.author },
              reviewRating: { "@type": "Rating", ratingValue: t.rating, bestRating: "5" },
              reviewBody: t.quote,
            })),
          }),
        }}
      />
    </div>
  );
}

// Subcomponent: Individual Testimonial Card (Matches reference styling!)
function TestimonialCard({ item, isGrid = false }: { item: TestimonialItem; isGrid?: boolean }) {
  return (
    <div
      className="testimonial-card-hover"
      style={{
        width: isGrid ? "100%" : "clamp(320px, 340px, 360px)",
        minWidth: isGrid ? "auto" : "clamp(320px, 340px, 360px)",
        maxWidth: isGrid ? "100%" : "clamp(320px, 340px, 360px)",
        backgroundColor: "#FFFFFF",
        borderRadius: 22,
        border: "1px solid #EAEAEA",
        padding: "26px 24px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        textAlign: "left",
        boxShadow: "0 2px 10px rgba(0, 0, 0, 0.02)",
        position: "relative",
        boxSizing: "border-box",
      }}
    >
      <div>
        {/* Iconic Electric Blue Double Quote Mark (Matches reference image!) */}
        <div
          style={{
            color: "#2563EB",
            fontSize: 34,
            fontWeight: 900,
            lineHeight: 1,
            fontFamily: "Georgia, serif",
            marginBottom: 14,
            userSelect: "none",
          }}
        >
          ““
        </div>

        {/* Testimonial Quote */}
        <p
          style={{
            fontSize: 14.5,
            color: "#1E293B",
            lineHeight: 1.6,
            margin: "0 0 20px",
            fontWeight: 450,
          }}
        >
          {item.quote}
        </p>
      </div>

      {/* Author Details at Bottom */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          paddingTop: 16,
          borderTop: "1px solid #F8FAFC",
        }}
      >
        <img
          src={item.avatar}
          alt={item.author}
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            objectFit: "cover",
            border: "1.5px solid #F1F5F9",
            flexShrink: 0,
          }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14.5,
              fontWeight: 700,
              color: "#0F172A",
              lineHeight: 1.25,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {item.author}
          </div>

          <div
            style={{
              fontSize: 12,
              color: "#64748B",
              lineHeight: 1.3,
              marginTop: 2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {item.role} · {item.company}
          </div>
        </div>
      </div>
    </div>
  );
}
