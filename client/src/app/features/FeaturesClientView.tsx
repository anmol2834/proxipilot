"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  IconMail,
  IconInbox,
  IconUser,
  IconEdit,
  IconDots,
  IconArrowBackUp,
  IconCalendar,
  IconTrash,
  IconCheck,
  IconDatabase,
  IconSparkles,
  IconLock,
  IconUserCheck,
  IconChartBar,
  IconFileText,
  IconLayersIntersect,
  IconPlayerPlay,
  IconArrowRight,
  IconChevronDown,
  IconChevronUp,
  IconShieldLock,
  IconWand,
  IconBolt,
  IconShieldCheck,
  IconRotateClockwise,
} from "@tabler/icons-react";

interface FeatureDetail {
  problem: string;
  solution: string;
  value: string;
}

const FEATURE_SPECS: Record<string, FeatureDetail> = {
  sync: {
    problem: "Teams don't want to abandon their existing email addresses or manage another disconnected ticketing platform.",
    solution: "ProxiPilot runs as a transparent intelligence proxy. Emails arrive in Gmail/Outlook and sync smoothly to your ProxiPilot queue.",
    value: "Zero disruption to existing team workflows, email clients, or customer-facing domain identities.",
  },
  classification: {
    problem: "High-volume inboxes require manual reading just to categorize which emails need immediate attention.",
    solution: "Real-time classification tags threads into Hot/Warm/Cold leads, billing escalations, or product inquiries within 10 seconds of arrival.",
    value: "Critical inquiries are immediately prioritized while repetitive questions are pre-drafted automatically.",
  },
  qdrant: {
    problem: "Language models hallucinate plausible-sounding prices, dates, or specifications when they don't know the answer.",
    solution: "Semantic vector matching with cosine similarity thresholding (>0.82) pulls exact source paragraphs into temporary inference prompts.",
    value: "Zero factual hallucinations. If evidence is missing, the copilot explicitly prompts for clarification.",
  },
  copilot: {
    problem: "Generic chat windows lose thread context or accidentally reference unrelated customer conversations.",
    solution: "A sliding copilot panel that locks strictly to the active message thread, applying tone presets (concise, executive, warm) and verified business rules.",
    value: "80% reduction in draft composition time with zero prompt-engineering overhead for agents.",
  },
  review: {
    problem: "Autonomous chatbots firing uninspected emails directly to customers create severe brand and legal risks.",
    solution: "AI drafts appear in the inbox as pending suggestions. Agents inspect, make optional micro-edits, and click Send with full audit tracking.",
    value: "Preserves 100% brand safety and customer empathy while accelerating response speed tenfold.",
  },
  analytics: {
    problem: "Managers cannot measure team email productivity or identify which customer questions consume the most hours.",
    solution: "Interactive dashboards track thread volumes, agent approval rates, and common knowledge gaps across your organization.",
    value: "Data-driven insights to continually refine your company documentation and support operations.",
  },
};

const COPILOT_TONE_DRAFTS: Record<string, string> = {
  Warm: "Hi Sarah, thank you for reaching out! You can easily return the jacket from order #2048 within 30 days of delivery, as per our return policy. Would you like me to send a pre-paid return label?",
  Concise: "Order #2048 return accepted. Unworn items are eligible for return within 30 days. Reply to receive your shipping label.",
  Executive: "Regarding order #2048: The jacket qualifies for a full return under our 30-day customer satisfaction agreement. Our logistics team is ready to process the authorization upon your confirmation.",
};

export function FeaturesClientView() {
  const [expandedSpec, setExpandedSpec] = useState<string | null>(null);
  const [selectedTone, setSelectedTone] = useState<string>("Warm");
  const [copilotTone, setCopilotTone] = useState<"Warm" | "Concise" | "Executive">("Warm");
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [copilotApplied, setCopilotApplied] = useState<boolean>(false);

  const toggleSpec = (key: string) => {
    setExpandedSpec(expandedSpec === key ? null : key);
  };

  const handleApplyCopilot = () => {
    setCopilotApplied(true);
    setTimeout(() => setCopilotApplied(false), 2400);
  };

  return (
    <div style={{ width: "100%", overflowX: "hidden" }}>
      {/* =========================================================
          SECTION 1: HERO SECTION
          ========================================================= */}
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          padding: "56px 24px 0",
          background:
            "radial-gradient(ellipse 70% 60% at 50% 25%, rgba(243, 232, 255, 0.6) 0%, rgba(254, 243, 199, 0.25) 45%, rgba(255, 255, 255, 1) 85%)",
          borderBottom: "1px solid rgba(226, 232, 240, 0.8)",
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            alignItems: "flex-end",
            gap: 40,
          }}
        >
          {/* Hero Left Content */}
          <div style={{ paddingBottom: 56 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#635BFF",
                marginBottom: 16,
                display: "inline-block",
              }}
            >
              Enterprise Architecture
            </div>

            <h1
              style={{
                fontSize: "clamp(34px, 4.4vw, 54px)",
                fontWeight: 800,
                letterSpacing: "-0.035em",
                lineHeight: 1.12,
                color: "#0F172A",
                margin: "0 0 20px",
              }}
            >
              Engineered for
              <br />
              accuracy.
              <br />
              Controlled by <span style={{ color: "#635BFF" }}>humans.</span>
            </h1>

            <p
              style={{
                fontSize: "clamp(15px, 1.8vw, 17px)",
                color: "#475569",
                lineHeight: 1.6,
                margin: 0,
                maxWidth: 480,
              }}
            >
              AI finds the evidence and drafts a reply. Your team makes the final call.
            </p>
          </div>

          {/* Hero Right Visual: Woman Mockup Only, touching bottom */}
          <div
            style={{
              position: "relative",
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-end",
              alignSelf: "flex-end",
              width: "100%",
              maxWidth: 520,
              margin: "0 auto",
            }}
          >
            {/* Ambient soft glow aura behind woman */}
            <div
              style={{
                position: "absolute",
                top: "12%",
                left: "10%",
                right: "10%",
                bottom: "20%",
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(237, 233, 254, 0.85) 0%, rgba(254, 240, 138, 0.45) 45%, rgba(255, 255, 255, 0) 75%)",
                filter: "blur(32px)",
                zIndex: 0,
                pointerEvents: "none",
              }}
            />

            {/* Woman Mockup Image (isolated cutout, touching section bottom) */}
            <img
              src="/features/hero-woman-mockup.png"
              alt="Engineered for accuracy. Controlled by humans."
              style={{
                width: "100%",
                height: "auto",
                maxHeight: 460,
                display: "block",
                objectFit: "contain",
                verticalAlign: "bottom",
                position: "relative",
                zIndex: 1,
              }}
            />

            {/* Floating Pill on bottom right */}
            <div
              style={{
                position: "absolute",
                bottom: 24,
                right: 12,
                zIndex: 2,
                backgroundColor: "#FFFFFF",
                borderRadius: 30,
                padding: "6px 14px 6px 8px",
                boxShadow:
                  "0 12px 28px -6px rgba(0, 0, 0, 0.14), 0 6px 12px -4px rgba(0, 0, 0, 0.06)",
                border: "1px solid #E2E8F0",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <img
                src="/features/reviewer-avatar.jpg"
                alt="Reviewer"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  objectFit: "cover",
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>
                Draft ready for review
              </span>
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  backgroundColor: "#635BFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <IconCheck size={11} stroke={3} color="#FFFFFF" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          SECTION 2: STEP 1 — INSIDE THE INBOX
          ========================================================= */}
      <section
        style={{
          padding: "72px 24px",
          maxWidth: 1180,
          margin: "0 auto",
          borderBottom: "1px solid #F1F5F9",
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#635BFF",
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <span
            style={{
              width: 28,
              height: 2,
              backgroundColor: "#635BFF",
              display: "inline-block",
            }}
          />
          The Story of One Refund Email
        </div>

        <h2
          style={{
            fontSize: "clamp(28px, 3.2vw, 40px)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "#0F172A",
            margin: "0 0 40px",
          }}
        >
          Inside the inbox
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            alignItems: "center",
            gap: 48,
          }}
        >
          {/* Left Column Features */}
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {/* Feature 1 */}
            <div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    backgroundColor: "#F3E8FF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <IconMail size={22} color="#635BFF" stroke={1.8} />
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: "#0F172A",
                      margin: "0 0 6px",
                    }}
                  >
                    Gmail &amp; Outlook sync
                  </h3>
                  <p
                    style={{
                      fontSize: 14,
                      color: "#64748B",
                      lineHeight: 1.5,
                      margin: 0,
                    }}
                  >
                    Two-way OAuth sync keeps threads in your existing mailbox.
                  </p>

                  <button
                    onClick={() => toggleSpec("sync")}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#635BFF",
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "6px 0 0",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      cursor: "pointer",
                    }}
                  >
                    {expandedSpec === "sync" ? "Hide architecture details" : "View architecture specs"}
                    {expandedSpec === "sync" ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                  </button>

                  {expandedSpec === "sync" && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "10px 14px",
                        backgroundColor: "#F8FAFC",
                        borderRadius: 8,
                        border: "1px solid #E2E8F0",
                        fontSize: 12.5,
                      }}
                    >
                      <div style={{ color: "#991B1B", marginBottom: 4 }}>
                        <strong>Problem:</strong> {FEATURE_SPECS.sync.problem}
                      </div>
                      <div style={{ color: "#166534", marginBottom: 4 }}>
                        <strong>Solution:</strong> {FEATURE_SPECS.sync.solution}
                      </div>
                      <div style={{ color: "#2563EB" }}>
                        <strong>Impact:</strong> {FEATURE_SPECS.sync.value}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Feature 2 */}
            <div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    backgroundColor: "#F3E8FF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <IconLayersIntersect size={22} color="#635BFF" stroke={1.8} />
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: "#0F172A",
                      margin: "0 0 6px",
                    }}
                  >
                    Intent &amp; entity classification
                  </h3>
                  <p
                    style={{
                      fontSize: 14,
                      color: "#64748B",
                      lineHeight: 1.5,
                      margin: 0,
                    }}
                  >
                    Detect intent, urgency and order IDs within 10 seconds.
                  </p>

                  <button
                    onClick={() => toggleSpec("classification")}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#635BFF",
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "6px 0 0",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      cursor: "pointer",
                    }}
                  >
                    {expandedSpec === "classification" ? "Hide architecture details" : "View architecture specs"}
                    {expandedSpec === "classification" ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                  </button>

                  {expandedSpec === "classification" && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "10px 14px",
                        backgroundColor: "#F8FAFC",
                        borderRadius: 8,
                        border: "1px solid #E2E8F0",
                        fontSize: 12.5,
                      }}
                    >
                      <div style={{ color: "#991B1B", marginBottom: 4 }}>
                        <strong>Problem:</strong> {FEATURE_SPECS.classification.problem}
                      </div>
                      <div style={{ color: "#166534", marginBottom: 4 }}>
                        <strong>Solution:</strong> {FEATURE_SPECS.classification.solution}
                      </div>
                      <div style={{ color: "#2563EB" }}>
                        <strong>Impact:</strong> {FEATURE_SPECS.classification.value}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Simulated Mailbox & Entity Tags */}
          <div
            style={{
              position: "relative",
              borderRadius: 20,
              padding: 2,
              background:
                "radial-gradient(circle at 92% 10%, rgba(254, 240, 138, 0.45) 0%, rgba(243, 232, 255, 0.3) 30%, rgba(255, 255, 255, 0) 65%)",
            }}
          >
            {/* Mailbox Window Container */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 16,
                border: "1px solid #E2E8F0",
                boxShadow:
                  "0 20px 45px -15px rgba(99, 91, 255, 0.08), 0 10px 20px -10px rgba(0, 0, 0, 0.04)",
                display: "flex",
                overflow: "hidden",
                minHeight: 260,
              }}
            >
              {/* Mailbox Sidebar */}
              <div
                style={{
                  width: 124,
                  backgroundColor: "#FAFAFA",
                  borderRight: "1px solid #F1F5F9",
                  padding: "16px 10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {/* Apps at top */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "2px 6px" }}>
                    <img src="/logos/gmail.png" alt="Gmail" style={{ width: 15, height: 15, objectFit: "contain" }} />
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: "#334155" }}>Gmail</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "2px 6px" }}>
                    <img src="/logos/outlook.png" alt="Outlook" style={{ width: 15, height: 15, objectFit: "contain" }} />
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: "#334155" }}>Outlook</span>
                  </div>
                </div>

                <div style={{ height: 1, backgroundColor: "#E2E8F0", margin: "2px 4px" }} />

                {/* Folder list */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      backgroundColor: "#F3E8FF",
                      color: "#635BFF",
                      padding: "6px 8px",
                      borderRadius: 6,
                      fontSize: 11.5,
                      fontWeight: 700,
                    }}
                  >
                    <IconInbox size={14} color="#635BFF" />
                    <span>Inbox</span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      color: "#64748B",
                      padding: "5px 8px",
                      fontSize: 11.5,
                      fontWeight: 500,
                    }}
                  >
                    <IconUser size={14} color="#94A3B8" />
                    <span>Assigned</span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      color: "#64748B",
                      padding: "5px 8px",
                      fontSize: 11.5,
                      fontWeight: 500,
                    }}
                  >
                    <IconEdit size={14} color="#94A3B8" />
                    <span>Drafts</span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      color: "#94A3B8",
                      padding: "5px 8px",
                      fontSize: 11.5,
                      fontWeight: 500,
                    }}
                  >
                    <IconDots size={14} color="#CBD5E1" />
                    <span>More</span>
                  </div>
                </div>
              </div>

              {/* Email Pane */}
              <div style={{ flex: 1, padding: "18px 22px", display: "flex", flexDirection: "column" }}>
                {/* Header row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingBottom: 12,
                    borderBottom: "1px solid #F1F5F9",
                    marginBottom: 14,
                  }}
                >
                  <h4 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: 0 }}>
                    Refund for order #2048
                  </h4>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#94A3B8" }}>
                    <IconArrowBackUp size={15} style={{ cursor: "pointer" }} />
                    <IconCalendar size={15} style={{ cursor: "pointer" }} />
                    <IconTrash size={15} style={{ cursor: "pointer" }} />
                    <IconDots size={15} style={{ cursor: "pointer" }} />
                  </div>
                </div>

                {/* Sender row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        backgroundColor: "#EDE9FE",
                        color: "#635BFF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      CS
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Customer</div>
                      <div style={{ fontSize: 11, color: "#94A3B8" }}>to support@yourcompany.com</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>Today, 10:24 AM</div>
                </div>

                {/* Email Body with Annotated Entities */}
                <div style={{ position: "relative", paddingTop: 8, paddingBottom: 24 }}>
                  <p style={{ fontSize: 14.5, color: "#1E293B", lineHeight: 1.8, margin: 0 }}>
                    Can I{" "}
                    <span
                      style={{
                        backgroundColor: "#EDE9FE",
                        color: "#4338CA",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontWeight: 600,
                      }}
                    >
                      return the jacket
                    </span>{" "}
                    from{" "}
                    <span
                      style={{
                        backgroundColor: "#FFEDD5",
                        color: "#C2410C",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontWeight: 600,
                      }}
                    >
                      order #2048
                    </span>
                    ?
                  </p>

                  {/* Annotated Callout Pills & Curved Connectors */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 40,
                      marginTop: 18,
                      paddingLeft: 36,
                    }}
                  >
                    {/* Return Request Pill */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <svg width="24" height="18" viewBox="0 0 24 18" fill="none" style={{ marginBottom: -2 }}>
                        <path d="M12 0 V8 Q12 14 18 14 H22" stroke="#A855F7" strokeWidth="1.5" fill="none" />
                      </svg>
                      <span
                        style={{
                          backgroundColor: "#F3E8FF",
                          border: "1px solid #E9D5FF",
                          color: "#635BFF",
                          fontSize: 11,
                          fontWeight: 700,
                          borderRadius: 12,
                          padding: "3px 10px",
                          boxShadow: "0 1px 3px rgba(99, 91, 255, 0.08)",
                        }}
                      >
                        Return request
                      </span>
                    </div>

                    {/* Order #2048 Pill */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginLeft: 40 }}>
                      <svg width="24" height="18" viewBox="0 0 24 18" fill="none" style={{ marginBottom: -2 }}>
                        <path d="M12 0 V8 Q12 14 18 14 H22" stroke="#F97316" strokeWidth="1.5" fill="none" />
                      </svg>
                      <span
                        style={{
                          backgroundColor: "#FFEDD5",
                          border: "1px solid #FED7AA",
                          color: "#C2410C",
                          fontSize: 11,
                          fontWeight: 700,
                          borderRadius: 12,
                          padding: "3px 10px",
                          boxShadow: "0 1px 3px rgba(234, 88, 12, 0.08)",
                        }}
                      >
                        Order #2048
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          SECTION 3: STEP 2 — GROUND THE REPLY (REVERSED LAYOUT)
          ========================================================= */}
      <section
        style={{
          padding: "72px 24px",
          maxWidth: 1180,
          margin: "0 auto",
          borderBottom: "1px solid #F1F5F9",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            alignItems: "center",
            gap: 48,
          }}
        >
          {/* Left Column Visual: Layered Cards (Returns Policy + Reply to Customer) */}
          <div
            style={{
              position: "relative",
              backgroundColor: "#F5F3FF",
              borderRadius: 20,
              padding: "36px 24px",
              minHeight: 330,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            {/* Back Card: Returns Policy Doc */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 12,
                border: "1px solid #E2E8F0",
                padding: "16px 20px",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.05)",
                maxWidth: 390,
                position: "relative",
                zIndex: 1,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                <IconFileText size={16} color="#635BFF" />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>
                  Returns policy
                </span>
              </div>

              <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.5 }}>
                <span style={{ opacity: 0.7 }}>
                  All items requested for exchange or return must meet standard inspection criteria.
                </span>
                <br />
                <span
                  style={{
                    backgroundColor: "#FEF08A",
                    padding: "2px 6px",
                    borderRadius: 3,
                    fontWeight: 700,
                    color: "#0F172A",
                    display: "inline-block",
                    margin: "4px 0",
                  }}
                >
                  Unworn items can be returned within 30 days.
                </span>
              </div>

              <div style={{ marginTop: 12 }}>
                <span
                  style={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: 16,
                    padding: "3px 10px",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#475569",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                  }}
                >
                  🔗 Returns policy · §2
                </span>
              </div>
            </div>

            {/* Front Card: Reply to Customer composer (overlapping bottom right) */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 14,
                border: "1px solid #E2E8F0",
                padding: "16px 18px",
                boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.1)",
                maxWidth: 410,
                width: "95%",
                position: "relative",
                zIndex: 2,
                marginTop: -26,
                marginLeft: "auto",
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: "#64748B" }}>
                  Reply to customer
                </span>
                <span
                  style={{
                    backgroundColor: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: 12,
                    padding: "2px 8px",
                    fontSize: 10,
                    fontWeight: 600,
                    color: "#64748B",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <IconLock size={10} color="#64748B" />
                  Thread locked
                </span>
              </div>

              {/* Toolbar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  paddingBottom: 8,
                  borderBottom: "1px solid #F1F5F9",
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    backgroundColor: "#FAF5FF",
                    border: "1px solid #E9D5FF",
                    borderRadius: 6,
                    padding: "2px 8px",
                    color: "#635BFF",
                    fontSize: 11.5,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    setSelectedTone(selectedTone === "Warm" ? "Concise" : selectedTone === "Concise" ? "Executive" : "Warm")
                  }
                  title="Click to toggle tone preset"
                >
                  <IconSparkles size={12} color="#635BFF" />
                  <span>{selectedTone} ⌄</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#94A3B8", fontSize: 12 }}>
                  <strong style={{ cursor: "pointer", color: "#475569" }}>B</strong>
                  <em style={{ cursor: "pointer", color: "#475569" }}>I</em>
                  <span style={{ cursor: "pointer", fontSize: 10, letterSpacing: -1 }}>:::</span>
                </div>
              </div>

              {/* Draft Body */}
              <p style={{ fontSize: 13, color: "#334155", lineHeight: 1.55, margin: 0 }}>
                You can return the jacket from order #2048 within 30 days, as per our returns policy.
              </p>
            </div>
          </div>

          {/* Right Column Content */}
          <div>
            <h2
              style={{
                fontSize: "clamp(28px, 3.2vw, 40px)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: "#0F172A",
                margin: "0 0 36px",
              }}
            >
              Ground the reply
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
              {/* Feature 1: Qdrant */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    backgroundColor: "#F3E8FF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <IconDatabase size={22} color="#635BFF" stroke={1.8} />
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: "#0F172A",
                      margin: "0 0 6px",
                    }}
                  >
                    Hybrid knowledge retrieval (Qdrant)
                  </h3>
                  <p
                    style={{
                      fontSize: 14,
                      color: "#64748B",
                      lineHeight: 1.5,
                      margin: 0,
                    }}
                  >
                    Match policy, pricing and spec questions to verified passages. Ask for clarification when evidence is missing.
                  </p>

                  <button
                    onClick={() => toggleSpec("qdrant")}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#635BFF",
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "6px 0 0",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      cursor: "pointer",
                    }}
                  >
                    {expandedSpec === "qdrant" ? "Hide architecture details" : "View architecture specs"}
                    {expandedSpec === "qdrant" ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                  </button>

                  {expandedSpec === "qdrant" && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "10px 14px",
                        backgroundColor: "#F8FAFC",
                        borderRadius: 8,
                        border: "1px solid #E2E8F0",
                        fontSize: 12.5,
                      }}
                    >
                      <div style={{ color: "#991B1B", marginBottom: 4 }}>
                        <strong>Problem:</strong> {FEATURE_SPECS.qdrant.problem}
                      </div>
                      <div style={{ color: "#166534", marginBottom: 4 }}>
                        <strong>Solution:</strong> {FEATURE_SPECS.qdrant.solution}
                      </div>
                      <div style={{ color: "#2563EB" }}>
                        <strong>Impact:</strong> {FEATURE_SPECS.qdrant.value}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Feature 2: Semantic Verification */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    backgroundColor: "#F3E8FF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <IconShieldCheck size={22} color="#635BFF" stroke={1.8} />
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: "#0F172A",
                      margin: "0 0 6px",
                    }}
                  >
                    Zero-Hallucination Vector Boundary
                  </h3>
                  <p
                    style={{
                      fontSize: 14,
                      color: "#64748B",
                      lineHeight: 1.5,
                      margin: 0,
                    }}
                  >
                    Cosine similarity thresholding (&gt;0.82) pulls exact source paragraphs into temporary inference prompts. If evidence is missing, the copilot halts and prompts for clarification.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          NEW SECTION: ISOLATED AI REPLY COPILOT FEATURE SPOTLIGHT
          ========================================================= */}
      <section
        id="copilot"
        style={{
          padding: "76px 24px",
          backgroundColor: "#F8FAFC",
          borderBottom: "1px solid #E2E8F0",
        }}
      >
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#635BFF",
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <span
              style={{
                width: 28,
                height: 2,
                backgroundColor: "#635BFF",
                display: "inline-block",
              }}
            />
            Core Intelligence Architecture
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 20,
              marginBottom: 44,
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: "clamp(28px, 3.4vw, 42px)",
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  color: "#0F172A",
                  margin: "0 0 10px",
                }}
              >
                Isolated AI Reply Copilot
              </h2>
              <p
                style={{
                  fontSize: "clamp(15px, 1.8vw, 17px)",
                  color: "#475569",
                  lineHeight: 1.6,
                  margin: 0,
                  maxWidth: 620,
                }}
              >
                Thread-scoped intelligence that generates high-fidelity replies without risking cross-customer context leakage. Locks strictly to the active message session.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: "#ECFDF5",
                  border: "1px solid #A7F3D0",
                  color: "#065F46",
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "6px 14px",
                  borderRadius: 20,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    backgroundColor: "#10B981",
                  }}
                />
                Thread Privacy Sandbox Active
              </span>
            </div>
          </div>

          {/* Copilot Showcase Grid: Interactive Visual on Left, Deep Capabilities on Right */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
              alignItems: "stretch",
              gap: 40,
            }}
          >
            {/* Interactive Copilot Panel Visual */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 20,
                border: "1px solid #E2E8F0",
                boxShadow:
                  "0 20px 45px -15px rgba(99, 91, 255, 0.12), 0 8px 20px -8px rgba(0, 0, 0, 0.04)",
                padding: 24,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                {/* Copilot Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingBottom: 14,
                    borderBottom: "1px solid #F1F5F9",
                    marginBottom: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        backgroundColor: "#F3E8FF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <IconSparkles size={17} color="#635BFF" />
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0F172A" }}>
                        ProxiPilot Reply Copilot
                      </div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>
                        Session #TH-2048 · Zero-Leakage Mode
                      </div>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      backgroundColor: "#F1F5F9",
                      color: "#475569",
                      padding: "3px 8px",
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <IconLock size={11} color="#64748B" />
                    Context Locked
                  </span>
                </div>

                {/* Grounded Evidence Passages */}
                <div
                  style={{
                    backgroundColor: "#FAF5FF",
                    border: "1px solid #EDE9FE",
                    borderRadius: 10,
                    padding: "10px 12px",
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#635BFF",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      marginBottom: 4,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <IconDatabase size={13} color="#635BFF" />
                    Verified RAG Citations (Qdrant &gt;0.82)
                  </div>
                  <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.45 }}>
                    • Returns Policy §2.1: &quot;Unworn apparel eligible for 30-day return&quot;
                  </div>
                </div>

                {/* Tone Presets Selector */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "#334155", marginBottom: 8 }}>
                    Dynamic Persona &amp; Tone Preset:
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {(["Warm", "Concise", "Executive"] as const).map((tone) => (
                      <button
                        key={tone}
                        type="button"
                        onClick={() => setCopilotTone(tone)}
                        style={{
                          flex: 1,
                          padding: "7px 10px",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          transition: "all 140ms ease",
                          border: copilotTone === tone ? "1.5px solid #635BFF" : "1px solid #E2E8F0",
                          backgroundColor: copilotTone === tone ? "#FAF5FF" : "#FFFFFF",
                          color: copilotTone === tone ? "#635BFF" : "#64748B",
                          boxShadow: copilotTone === tone ? "0 2px 6px rgba(99, 91, 255, 0.15)" : "none",
                        }}
                      >
                        {tone === "Warm" && "✨ "}
                        {tone === "Concise" && "🎯 "}
                        {tone === "Executive" && "💼 "}
                        {tone}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Synthesized Draft Bubble */}
                <div
                  style={{
                    backgroundColor: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: 12,
                    padding: "14px 16px",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>
                      Synthesized Output ({copilotTone} Mode):
                    </span>
                    <span style={{ fontSize: 10, color: "#10B981", fontWeight: 700 }}>
                      ⚡ 1.2s inference
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: 13,
                      color: "#1E293B",
                      lineHeight: 1.6,
                      margin: 0,
                      fontStyle: "normal",
                    }}
                  >
                    {COPILOT_TONE_DRAFTS[copilotTone]}
                  </p>
                </div>
              </div>

              {/* Copilot Action CTA */}
              <div
                style={{
                  marginTop: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  paddingTop: 16,
                  borderTop: "1px solid #F1F5F9",
                }}
              >
                <span style={{ fontSize: 11.5, color: "#64748B" }}>
                  Zero training on customer inputs.
                </span>

                <button
                  type="button"
                  onClick={handleApplyCopilot}
                  style={{
                    backgroundColor: copilotApplied ? "#10B981" : "#635BFF",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 16px",
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: copilotApplied
                      ? "0 4px 12px rgba(16, 185, 129, 0.35)"
                      : "0 4px 12px rgba(99, 91, 255, 0.35)",
                    transition: "all 140ms ease",
                  }}
                >
                  {copilotApplied ? (
                    <>
                      <IconCheck size={14} color="#FFFFFF" />
                      Applied to Active Thread!
                    </>
                  ) : (
                    <>
                      <IconBolt size={14} color="#FFFFFF" />
                      Apply to Active Thread
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right Column: Architectural Pillars */}
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 24 }}>
              {/* Pillar 1: Zero Leakage Isolation */}
              <div
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: 14,
                  padding: "20px 22px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      backgroundColor: "#F3E8FF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <IconShieldLock size={20} color="#635BFF" stroke={1.8} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0F172A", margin: "0 0 6px" }}>
                      Strict Thread-Scoped Memory Isolation
                    </h3>
                    <p style={{ fontSize: 13.5, color: "#64748B", lineHeight: 1.5, margin: "0 0 10px" }}>
                      Every customer conversation runs in an ephemeral, memory-safe sandbox. Customer A&apos;s confidential data is never accessible or blended into Customer B&apos;s inference prompt.
                    </p>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: "#635BFF",
                        backgroundColor: "#F3E8FF",
                        padding: "3px 10px",
                        borderRadius: 6,
                      }}
                    >
                      100% ephemeral memory · Zero cross-tenant sharing
                    </span>
                  </div>
                </div>
              </div>

              {/* Pillar 2: Persona & Tone Switching */}
              <div
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: 14,
                  padding: "20px 22px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      backgroundColor: "#F3E8FF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <IconWand size={20} color="#635BFF" stroke={1.8} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0F172A", margin: "0 0 6px" }}>
                      Adaptive Tone &amp; Style Presets
                    </h3>
                    <p style={{ fontSize: 13.5, color: "#64748B", lineHeight: 1.5, margin: "0 0 10px" }}>
                      Instantly toggle between empathetic customer care, concise operational updates, and executive briefings without manual prompt-engineering overhead for agents.
                    </p>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: "#635BFF",
                        backgroundColor: "#F3E8FF",
                        padding: "3px 10px",
                        borderRadius: 6,
                      }}
                    >
                      Zero prompt-engineering overhead for agents
                    </span>
                  </div>
                </div>
              </div>

              {/* Pillar 3: Sub-2-Second Drafting Velocity */}
              <div
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: 14,
                  padding: "20px 22px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      backgroundColor: "#F3E8FF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <IconBolt size={20} color="#635BFF" stroke={1.8} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0F172A", margin: "0 0 6px" }}>
                      80% Reduction in Composition Time
                    </h3>
                    <p style={{ fontSize: 13.5, color: "#64748B", lineHeight: 1.5, margin: "0 0 10px" }}>
                      Pre-drafts contextually grounded, policy-compliant email replies in under 2 seconds. Support reps spend seconds reviewing instead of minutes drafting from scratch.
                    </p>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: "#635BFF",
                        backgroundColor: "#F3E8FF",
                        padding: "3px 10px",
                        borderRadius: 6,
                      }}
                    >
                      80% draft reduction · Sub-2s completion
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          SECTION 4: STEP 3 — PUT PEOPLE IN CONTROL
          (With Beautiful Gradient Pattern Background — No Laptop Image)
          ========================================================= */}
      <section
        style={{
          padding: "72px 24px",
          maxWidth: 1180,
          margin: "0 auto",
          borderBottom: "1px solid #F1F5F9",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            alignItems: "center",
            gap: 48,
          }}
        >
          {/* Left Column Content */}
          <div>
            <h2
              style={{
                fontSize: "clamp(28px, 3.2vw, 40px)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: "#0F172A",
                margin: "0 0 36px",
              }}
            >
              Put people in control
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
              {/* Feature 1: Human-in-the-loop */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    backgroundColor: "#FFEDD5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <IconUserCheck size={22} color="#EA580C" stroke={1.8} />
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: "#0F172A",
                      margin: "0 0 6px",
                    }}
                  >
                    Human-in-the-loop review
                  </h3>
                  <p
                    style={{
                      fontSize: 14,
                      color: "#64748B",
                      lineHeight: 1.5,
                      margin: 0,
                    }}
                  >
                    Inspect, edit and send each draft with a recorded approval.
                  </p>

                  <button
                    onClick={() => toggleSpec("review")}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#635BFF",
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "6px 0 0",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      cursor: "pointer",
                    }}
                  >
                    {expandedSpec === "review" ? "Hide architecture details" : "View architecture specs"}
                    {expandedSpec === "review" ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                  </button>

                  {expandedSpec === "review" && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "10px 14px",
                        backgroundColor: "#F8FAFC",
                        borderRadius: 8,
                        border: "1px solid #E2E8F0",
                        fontSize: 12.5,
                      }}
                    >
                      <div style={{ color: "#991B1B", marginBottom: 4 }}>
                        <strong>Problem:</strong> {FEATURE_SPECS.review.problem}
                      </div>
                      <div style={{ color: "#166534", marginBottom: 4 }}>
                        <strong>Solution:</strong> {FEATURE_SPECS.review.solution}
                      </div>
                      <div style={{ color: "#2563EB" }}>
                        <strong>Impact:</strong> {FEATURE_SPECS.review.value}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Feature 2: Analytics */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    backgroundColor: "#FFEDD5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <IconChartBar size={22} color="#EA580C" stroke={1.8} />
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: "#0F172A",
                      margin: "0 0 6px",
                    }}
                  >
                    Inbox velocity &amp; accuracy analytics
                  </h3>
                  <p
                    style={{
                      fontSize: 14,
                      color: "#64748B",
                      lineHeight: 1.5,
                      margin: 0,
                    }}
                  >
                    Track first response time, deflection and draft acceptance to find knowledge gaps.
                  </p>

                  <button
                    onClick={() => toggleSpec("analytics")}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#635BFF",
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "6px 0 0",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      cursor: "pointer",
                    }}
                  >
                    {expandedSpec === "analytics" ? "Hide architecture details" : "View architecture specs"}
                    {expandedSpec === "analytics" ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                  </button>

                  {expandedSpec === "analytics" && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "10px 14px",
                        backgroundColor: "#F8FAFC",
                        borderRadius: 8,
                        border: "1px solid #E2E8F0",
                        fontSize: 12.5,
                      }}
                    >
                      <div style={{ color: "#991B1B", marginBottom: 4 }}>
                        <strong>Problem:</strong> {FEATURE_SPECS.analytics.problem}
                      </div>
                      <div style={{ color: "#166534", marginBottom: 4 }}>
                        <strong>Solution:</strong> {FEATURE_SPECS.analytics.solution}
                      </div>
                      <div style={{ color: "#2563EB" }}>
                        <strong>Impact:</strong> {FEATURE_SPECS.analytics.value}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Velocity Line Chart */}
              <div style={{ paddingLeft: 60 }}>
                <div style={{ display: "inline-block", marginBottom: 8 }}>
                  <span
                    style={{
                      backgroundColor: "#F3E8FF",
                      color: "#635BFF",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "4px 12px",
                      borderRadius: 12,
                    }}
                  >
                    First response time
                  </span>
                </div>

                <div style={{ width: "100%", maxWidth: 320, height: 48, position: "relative" }}>
                  <svg width="100%" height="48" viewBox="0 0 300 48" fill="none">
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#635BFF" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#635BFF" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M 10 38 Q 60 32, 110 36 T 210 18 T 290 8 L 290 48 L 10 48 Z"
                      fill="url(#chartGradient)"
                    />
                    <path
                      d="M 10 38 Q 60 32, 110 36 T 210 18 T 290 8"
                      stroke="#635BFF"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <circle cx="10" cy="38" r="3.5" fill="#635BFF" />
                    <circle cx="110" cy="36" r="3.5" fill="#635BFF" />
                    <circle cx="210" cy="18" r="3.5" fill="#635BFF" />
                    <circle cx="290" cy="8" r="4.5" fill="#635BFF" stroke="#FFFFFF" strokeWidth="2" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Beautiful Gradient Pattern Card with Centered Approval Modal */}
          <div
            style={{
              position: "relative",
              borderRadius: 24,
              overflow: "hidden",
              minHeight: 380,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "36px 20px",
              background:
                "linear-gradient(135deg, #1E1B4B 0%, #312E81 35%, #4338CA 70%, #635BFF 100%)",
              border: "1px solid rgba(99, 91, 255, 0.25)",
              boxShadow:
                "0 24px 50px -15px rgba(99, 91, 255, 0.25), 0 10px 25px -10px rgba(0, 0, 0, 0.15)",
            }}
          >
            {/* Luminous Ambient Orbs */}
            <div
              style={{
                position: "absolute",
                top: "-25%",
                left: "-15%",
                width: 260,
                height: 260,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(168, 85, 247, 0.55) 0%, rgba(168, 85, 247, 0) 70%)",
                filter: "blur(40px)",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: "-25%",
                right: "-15%",
                width: 280,
                height: 280,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(251, 191, 36, 0.35) 0%, rgba(99, 91, 255, 0) 70%)",
                filter: "blur(45px)",
                pointerEvents: "none",
              }}
            />

            {/* Fine Dot Matrix Pattern Overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage:
                  "radial-gradient(rgba(255, 255, 255, 0.16) 1.2px, transparent 1.2px)",
                backgroundSize: "22px 22px",
                opacity: 0.7,
                pointerEvents: "none",
              }}
            />

            {/* Elegant SVG Tech Grid Arc */}
            <svg
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                opacity: 0.28,
                pointerEvents: "none",
              }}
              viewBox="0 0 400 350"
              fill="none"
            >
              <circle
                cx="200"
                cy="175"
                r="145"
                stroke="url(#cardRingGrad)"
                strokeWidth="1.5"
                strokeDasharray="4 6"
              />
              <circle cx="200" cy="175" r="185" stroke="url(#cardRingGrad)" strokeWidth="1" />
              <defs>
                <linearGradient id="cardRingGrad" x1="0" y1="0" x2="400" y2="350" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#C084FC" />
                  <stop offset="1" stopColor="#38BDF8" />
                </linearGradient>
              </defs>
            </svg>

            {/* Floating Approval Modal Card */}
            <div
              style={{
                position: "relative",
                zIndex: 2,
                width: "100%",
                maxWidth: 380,
                backgroundColor: "rgba(255, 255, 255, 0.98)",
                backdropFilter: "blur(16px)",
                borderRadius: 16,
                border: "1px solid rgba(255, 255, 255, 0.9)",
                boxShadow:
                  "0 25px 50px -12px rgba(15, 23, 42, 0.35), 0 4px 16px rgba(0, 0, 0, 0.08)",
                padding: "20px 22px",
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      backgroundColor: "#EDE9FE",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <IconMail size={16} color="#635BFF" />
                  </div>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>
                    Refund for order #2048
                  </span>
                </div>
                <span
                  style={{
                    backgroundColor: "#F3E8FF",
                    color: "#635BFF",
                    fontSize: 10.5,
                    fontWeight: 700,
                    borderRadius: 12,
                    padding: "3px 8px",
                  }}
                >
                  Human Review Queue
                </span>
              </div>

              {/* Draft box */}
              <div
                style={{
                  backgroundColor: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: 10,
                  padding: "12px 14px",
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#64748B",
                    marginBottom: 4,
                  }}
                >
                  Verified AI Draft:
                </div>
                <p style={{ fontSize: 13, color: "#1E293B", lineHeight: 1.55, margin: 0 }}>
                  You can return the jacket from order #2048 within 30 days, as per our returns policy.
                </p>
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  style={{
                    flex: "0 0 auto",
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #CBD5E1",
                    borderRadius: 8,
                    padding: "8px 16px",
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "#334155",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                  }}
                >
                  <IconEdit size={14} color="#64748B" />
                  <span>Edit</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsApproved(!isApproved)}
                  style={{
                    flex: 1,
                    backgroundColor: isApproved ? "#10B981" : "#635BFF",
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 18px",
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: "#FFFFFF",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    boxShadow: isApproved
                      ? "0 4px 14px rgba(16, 185, 129, 0.4)"
                      : "0 4px 14px rgba(99, 91, 255, 0.4)",
                    transition: "all 140ms ease",
                  }}
                >
                  {isApproved ? (
                    <>
                      <IconCheck size={15} color="#FFFFFF" />
                      <span>Approved &amp; Sent</span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 14 }}>🚀</span>
                      <span>Approve &amp; send</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          SECTION 5: PRODUCT EVOLUTION & ECOSYSTEM ROADMAP
          ========================================================= */}
      <section
        id="roadmap"
        style={{
          padding: "72px 24px",
          maxWidth: 1180,
          margin: "0 auto",
        }}
      >
        <h2
          style={{
            fontSize: "clamp(24px, 3vw, 34px)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "#0F172A",
            margin: "0 0 36px",
          }}
        >
          Product evolution &amp; ecosystem roadmap
        </h2>

        {/* Horizontal Connected Timeline */}
        <div style={{ position: "relative" }}>
          {/* Connector Line across milestones */}
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 12,
              right: 12,
              height: 2,
              backgroundColor: "#DDD6FE",
              zIndex: 0,
            }}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 32,
              position: "relative",
              zIndex: 1,
            }}
          >
            {/* Milestone 1: Q3 2025 · Active */}
            <div>
              {/* Outer ring node */}
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  border: "2.5px solid #635BFF",
                  backgroundColor: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: "#635BFF",
                  }}
                />
              </div>

              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#635BFF",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  marginBottom: 6,
                }}
              >
                Q3 2025 · Active
              </div>
              <h3
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: "#0F172A",
                  margin: "0 0 6px",
                }}
              >
                Multi-Tenant Rule Chains
              </h3>
              <p
                style={{
                  fontSize: 13.5,
                  color: "#64748B",
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                Branch by lifetime value and SLA tags.
              </p>
            </div>

            {/* Milestone 2: Q4 2025 · Beta */}
            <div>
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  border: "2.5px solid #635BFF",
                  backgroundColor: "#FFFFFF",
                  marginBottom: 14,
                }}
              />

              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#635BFF",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  marginBottom: 6,
                }}
              >
                Q4 2025 · Beta
              </div>
              <h3
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: "#0F172A",
                  margin: "0 0 6px",
                }}
              >
                WhatsApp &amp; Helpdesk Bridge
              </h3>
              <p
                style={{
                  fontSize: 13.5,
                  color: "#64748B",
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                Grounded replies in WhatsApp and Zendesk.
              </p>
            </div>

            {/* Milestone 3: 2026 · Planned */}
            <div>
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  border: "2.5px solid #A5B4FC",
                  backgroundColor: "#FFFFFF",
                  marginBottom: 14,
                }}
              />

              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748B",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  marginBottom: 6,
                }}
              >
                2026 · Planned
              </div>
              <h3
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: "#0F172A",
                  margin: "0 0 6px",
                }}
              >
                ERP Auto-Quoting Webhooks
              </h3>
              <p
                style={{
                  fontSize: 13.5,
                  color: "#64748B",
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                Inventory quotes from SAP, NetSuite and QuickBooks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          SECTION 6: FINAL CTA BANNER
          ========================================================= */}
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          padding: "72px 24px 84px",
          background:
            "linear-gradient(180deg, #FFFFFF 0%, #FAF5FF 40%, #F3E8FF 100%)",
          textAlign: "center",
          borderTop: "1px solid #F1F5F9",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <h2
            style={{
              fontSize: "clamp(30px, 4vw, 44px)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "#0F172A",
              margin: "0 0 14px",
            }}
          >
            Ready to eliminate email backlog?
          </h2>

          <p
            style={{
              fontSize: "clamp(15px, 1.8vw, 17px)",
              color: "#475569",
              lineHeight: 1.6,
              margin: "0 0 32px",
            }}
          >
            Explore how ProxiPilot fits your team in less than 5 minutes.
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
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
                fontSize: 14.5,
                fontWeight: 700,
                padding: "12px 26px",
                borderRadius: 8,
                textDecoration: "none",
                boxShadow: "0 4px 14px rgba(99, 91, 255, 0.35)",
                transition: "all 140ms ease",
              }}
            >
              <span>Start Free Trial</span>
              <IconArrowRight size={16} />
            </Link>

            <Link
              href="/how-it-works"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                backgroundColor: "#FFFFFF",
                color: "#0F172A",
                border: "1.5px solid #CBD5E1",
                fontSize: 14.5,
                fontWeight: 700,
                padding: "12px 24px",
                borderRadius: 8,
                textDecoration: "none",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                transition: "all 140ms ease",
              }}
            >
              <IconPlayerPlay size={15} style={{ fill: "#0F172A" }} />
              <span>See How It Works</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
