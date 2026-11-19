"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  IconMail,
  IconCheck,
  IconSearch,
  IconFileText,
  IconUser,
  IconBolt,
  IconArrowRight,
  IconChevronDown,
  IconChevronUp,
  IconEye,
  IconPlayerPause,
  IconDatabase,
  IconShieldCheck,
  IconLock,
} from "@tabler/icons-react";

interface StepSpec {
  problem: string;
  solution: string;
  value: string;
}

const STEP_SPECS: Record<string, StepSpec> = {
  "01": {
    problem: "Traditional email automation requires sharing root IMAP/SMTP passwords or migrating away from your current mailbox client.",
    solution: "Official Google Workspace and Microsoft 365 OAuth 2.0 scoped synchronization listener running transparently in the background.",
    value: "Zero disruption to existing team workflows, email clients, or customer-facing domain identities.",
  },
  "02": {
    problem: "Static knowledge bases get outdated quickly and language models hallucinate unsupported claims when answering customers.",
    solution: "Documents are segmented into semantic vector embeddings stored in an isolated, multi-tenant Qdrant collection assigned exclusively to your workspace.",
    value: "Deterministic, evidence-backed answers. Missing documentation is immediately flagged instead of fabricated.",
  },
  "03": {
    problem: "High-volume inboxes require manual reading just to categorize urgency, customer sentiment, and product references.",
    solution: "Real-time classification tags threads into Hot/Warm leads, billing escalations, or product inquiries within 10 seconds of arrival.",
    value: "Immediate prioritization of high-value business threads with automatic routing to the appropriate agent queue.",
  },
  "04": {
    problem: "Generic AI chatbots guess answers or reference outdated pricing matrices without factual proof.",
    solution: "High-precision vector similarity matching using cosine distance thresholding (>0.82) pulls exact verified paragraphs into temporary inference prompts.",
    value: "Zero factual hallucinations. Every answer is grounded directly in uploaded policy, pricing, or spec documents.",
  },
  "05": {
    problem: "Unchecked AI generators create significant legal liabilities by promising unauthorized discounts or invalid return timelines.",
    solution: "Draft generation is constrained by strict context guardrails. Prices, delivery dates, and return windows require explicit verified source evidence.",
    value: "Complete brand protection and legal compliance while reducing composition time by 80%.",
  },
  "06": {
    problem: "Autonomous chatbots firing uninspected emails directly to customers create severe brand risks and lack empathy.",
    solution: "Frictionless human-in-the-loop review queue where agents inspect, fine-tune tone with one click, and dispatch with recorded audit logs.",
    value: "100% brand safety and customer empathy paired with 10x accelerated response speeds.",
  },
};

export function HowItWorksClientView() {
  const [expandedSpec, setExpandedSpec] = useState<string | null>(null);
  const [oauthConnected, setOauthConnected] = useState<boolean>(true);
  const [selectedTone, setSelectedTone] = useState<string>("Warm");
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [emergencyPause, setEmergencyPause] = useState<boolean>(false);

  const toggleSpec = (key: string) => {
    setExpandedSpec(expandedSpec === key ? null : key);
  };

  return (
    <div style={{ width: "100%", overflowX: "hidden", backgroundColor: "#FFFFFF" }}>
      <style>{`
        @media (max-width: 768px) {
          .hero-integrated-copy {
            position: static !important;
            max-width: 100% !important;
            padding: 24px 20px 10px !important;
          }
          .hero-floating-card-1 {
            top: 35% !important;
            left: 50% !important;
            max-width: 220px !important;
          }
          .hero-floating-card-2 {
            top: 15% !important;
            right: 5% !important;
            max-width: 220px !important;
          }
          .cta-integrated-copy {
            position: static !important;
            width: 100% !important;
            padding: 24px 20px !important;
          }
        }
      `}</style>

      {/* =========================================================
          SECTION 1: HERO SECTION (FULL DEVICE WIDTH - ZERO PADDING)
          ========================================================= */}
      <section
        style={{
          position: "relative",
          width: "100%",
          overflow: "hidden",
          margin: 0,
          padding: 0,
          backgroundColor: "#EBDCFE",
          borderBottom: "1px solid rgba(226, 232, 240, 0.7)",
        }}
      >
        {/* Applied directly in parent section - covers 100% full width of device */}
        <img
          src="/how-it-works/hero-pipeline-cable.jpg"
          alt="From raw customer email to verified response pipeline"
          style={{
            width: "100%",
            height: "auto",
            display: "block",
            objectFit: "cover",
          }}
        />

        {/* Typography positioned cleanly inside the open space on the left */}
        <div
          className="hero-integrated-copy"
          style={{
            position: "absolute",
            top: "8%",
            left: "5%",
            maxWidth: "38%",
            zIndex: 10,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 12px",
              borderRadius: 20,
              backgroundColor: "rgba(237, 233, 254, 0.85)",
              border: "1px solid #DDD6FE",
              color: "#635BFF",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 14,
              backdropFilter: "blur(4px)",
            }}
          >
            The Product Journey
          </div>

          <h1
            style={{
              fontSize: "clamp(22px, 2.7vw, 42px)",
              fontWeight: 800,
              letterSpacing: "-0.035em",
              lineHeight: 1.15,
              color: "#0F172A",
              margin: "0 0 14px",
            }}
          >
            From raw customer
            <br />
            email to{" "}
            <em style={{ fontStyle: "italic", fontFamily: "Georgia, serif", fontWeight: 700 }}>
              verified
            </em>
            <br />
            <em style={{ fontStyle: "italic", fontFamily: "Georgia, serif", fontWeight: 700 }}>
              response
            </em>{" "}
            in seconds.
          </h1>

          <p
            style={{
              fontSize: "clamp(13px, 1.15vw, 15px)",
              color: "#475569",
              lineHeight: 1.5,
              margin: 0,
              maxWidth: 420,
            }}
          >
            Connect your inbox and company knowledge. See how one customer question becomes a reply your team can review.
          </p>
        </div>

        {/* Overlaid Floating Card 1: Incoming Question */}
        <div
          className="hero-floating-card-1"
          style={{
            position: "absolute",
            top: "22%",
            left: "38%",
            transform: "translate(-50%, -50%)",
            backgroundColor: "#FFFFFF",
            borderRadius: 14,
            border: "1px solid #E2E8F0",
            boxShadow:
              "0 15px 35px -8px rgba(0, 0, 0, 0.15), 0 6px 14px -4px rgba(0, 0, 0, 0.08)",
            padding: "12px 16px",
            maxWidth: 240,
            zIndex: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <IconMail size={14} color="#635BFF" />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#635BFF" }}>
              Incoming question
            </span>
          </div>
          <p style={{ fontSize: 12.5, fontWeight: 600, color: "#0F172A", margin: 0, lineHeight: 1.35 }}>
            Is the hinge on my Arc lamp covered?
          </p>
        </div>

        {/* Overlaid Floating Card 2: Reply Ready for Review */}
        <div
          className="hero-floating-card-2"
          style={{
            position: "absolute",
            top: "8%",
            right: "4%",
            backgroundColor: "#FFFFFF",
            borderRadius: 14,
            border: "1px solid #E2E8F0",
            boxShadow:
              "0 15px 35px -8px rgba(0, 0, 0, 0.15), 0 6px 14px -4px rgba(0, 0, 0, 0.08)",
            padding: "12px 16px",
            maxWidth: 250,
            zIndex: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                backgroundColor: "#EDE9FE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconCheck size={11} stroke={3} color="#635BFF" />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#635BFF" }}>
              Reply ready for review
            </span>
          </div>
          <p style={{ fontSize: 12.5, fontWeight: 600, color: "#0F172A", margin: 0, lineHeight: 1.35 }}>
            Your Arc lamp hinge is covered for 12 months.
          </p>
        </div>
      </section>

      {/* =========================================================
          SECTION 2: SET UP YOUR WORKSPACE (STEPS 01 & 02)
          ========================================================= */}
      <section
        style={{
          padding: "72px 24px",
          maxWidth: 1180,
          margin: "0 auto",
          borderBottom: "1px solid #F1F5F9",
        }}
      >
        {/* Section Heading with Line */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 44 }}>
          <h2
            style={{
              fontSize: "clamp(24px, 3vw, 34px)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "#0F172A",
              margin: 0,
              whiteSpace: "nowrap",
            }}
          >
            Set up your workspace
          </h2>
          <div style={{ flex: 1, height: 1, backgroundColor: "#E2E8F0" }} />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: 48,
            alignItems: "start",
          }}
        >
          {/* Step 01: Connect your business mailbox */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span
                style={{
                  backgroundColor: "#EDE9FE",
                  color: "#635BFF",
                  fontWeight: 800,
                  fontSize: 13,
                  borderRadius: 8,
                  padding: "4px 10px",
                }}
              >
                01
              </span>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: 0 }}>
                Connect your business mailbox
              </h3>
            </div>

            <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.55, margin: "0 0 20px" }}>
              Connect Google Workspace or Microsoft 365 with scoped OAuth 2.0. Active threads sync in the background while your team keeps its existing inbox.
            </p>

            {/* Architecture Details Toggle */}
            <button
              onClick={() => toggleSpec("01")}
              style={{
                background: "none",
                border: "none",
                color: "#635BFF",
                fontSize: 12,
                fontWeight: 600,
                padding: "0 0 16px",
                display: "flex",
                alignItems: "center",
                gap: 4,
                cursor: "pointer",
              }}
            >
              {expandedSpec === "01" ? "Hide OAuth specs" : "View OAuth architecture"}
              {expandedSpec === "01" ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
            </button>

            {expandedSpec === "01" && (
              <div
                style={{
                  marginBottom: 18,
                  padding: "12px 14px",
                  backgroundColor: "#F8FAFC",
                  borderRadius: 8,
                  border: "1px solid #E2E8F0",
                  fontSize: 12.5,
                }}
              >
                <div style={{ color: "#991B1B", marginBottom: 4 }}>
                  <strong>Security Rule:</strong> {STEP_SPECS["01"].problem}
                </div>
                <div style={{ color: "#166534", marginBottom: 4 }}>
                  <strong>OAuth Protocol:</strong> {STEP_SPECS["01"].solution}
                </div>
                <div style={{ color: "#2563EB" }}>
                  <strong>Zero Disruption:</strong> {STEP_SPECS["01"].value}
                </div>
              </div>
            )}

            {/* Step 01 Visual: Connected Mailboxes UI */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 16,
                border: "1px solid #E2E8F0",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)",
                padding: "20px 22px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              {/* Mailbox Providers Stack */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
                {/* Google Workspace */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: 10,
                    backgroundColor: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <img src="/logos/gmail.png" alt="Google" style={{ width: 16, height: 16, objectFit: "contain" }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>Google Workspace</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>Sign in</span>
                </div>

                {/* Microsoft 365 */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: 10,
                    backgroundColor: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <img src="/logos/outlook.png" alt="Microsoft" style={{ width: 16, height: 16, objectFit: "contain" }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>Microsoft 365</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>Sign in</span>
                </div>
              </div>

              {/* Connecting Branch Lines & Connected Pill */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="24" height="48" viewBox="0 0 24 48" fill="none">
                  <path d="M 0 12 Q 12 12 16 24 T 24 24" stroke="#A855F7" strokeWidth="1.5" fill="none" />
                  <path d="M 0 36 Q 12 36 16 24 T 24 24" stroke="#A855F7" strokeWidth="1.5" fill="none" />
                </svg>

                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: "#ECFDF5",
                    border: "1px solid #A7F3D0",
                    color: "#065F46",
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "6px 12px",
                    borderRadius: 20,
                  }}
                >
                  <IconCheck size={13} stroke={3} color="#065F46" />
                  <span>Connected</span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 02: Upload company knowledge & policies */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span
                style={{
                  backgroundColor: "#EDE9FE",
                  color: "#635BFF",
                  fontWeight: 800,
                  fontSize: 13,
                  borderRadius: 8,
                  padding: "4px 10px",
                }}
              >
                02
              </span>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: 0 }}>
                Upload company knowledge &amp; policies
              </h3>
            </div>

            <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.55, margin: "0 0 20px" }}>
              Upload catalogues, warranty terms, SLAs and FAQs. ProxiPilot indexes passages in a Qdrant collection isolated to your workspace.
            </p>

            {/* Architecture Details Toggle */}
            <button
              onClick={() => toggleSpec("02")}
              style={{
                background: "none",
                border: "none",
                color: "#635BFF",
                fontSize: 12,
                fontWeight: 600,
                padding: "0 0 16px",
                display: "flex",
                alignItems: "center",
                gap: 4,
                cursor: "pointer",
              }}
            >
              {expandedSpec === "02" ? "Hide Qdrant specs" : "View Qdrant vector specs"}
              {expandedSpec === "02" ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
            </button>

            {expandedSpec === "02" && (
              <div
                style={{
                  marginBottom: 18,
                  padding: "12px 14px",
                  backgroundColor: "#F8FAFC",
                  borderRadius: 8,
                  border: "1px solid #E2E8F0",
                  fontSize: 12.5,
                }}
              >
                <div style={{ color: "#991B1B", marginBottom: 4 }}>
                  <strong>Hallucination Risk:</strong> {STEP_SPECS["02"].problem}
                </div>
                <div style={{ color: "#166534", marginBottom: 4 }}>
                  <strong>Qdrant Isolation:</strong> {STEP_SPECS["02"].solution}
                </div>
                <div style={{ color: "#2563EB" }}>
                  <strong>Deterministic RAG:</strong> {STEP_SPECS["02"].value}
                </div>
              </div>
            )}

            {/* Step 02 Visual: 3D Acrylic Workspace Knowledge Tray */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: "10px 0",
              }}
            >
              <img
                src="/how-it-works/workspace-knowledge-tray.png"
                alt="Workspace Knowledge tray with PDF, CSV, and Markdown"
                style={{
                  width: "100%",
                  maxWidth: 420,
                  height: "auto",
                  display: "block",
                  objectFit: "contain",
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          SECTION 3: WHEN A CUSTOMER WRITES (STEPS 03, 04, 05)
          ========================================================= */}
      <section
        style={{
          padding: "72px 24px",
          maxWidth: 1180,
          margin: "0 auto",
          borderBottom: "1px solid #F1F5F9",
        }}
      >
        {/* Section Heading with Line */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 44 }}>
          <h2
            style={{
              fontSize: "clamp(24px, 3vw, 34px)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "#0F172A",
              margin: 0,
              whiteSpace: "nowrap",
            }}
          >
            When a customer writes
          </h2>
          <div style={{ flex: 1, height: 1, backgroundColor: "#E2E8F0" }} />
        </div>

        {/* Three Connected Cards Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))",
            gap: 28,
            alignItems: "stretch",
          }}
        >
          {/* Step 03: Understand the inquiry */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 16,
              border: "1px solid #E2E8F0",
              boxShadow: "0 4px 20px -5px rgba(0, 0, 0, 0.05)",
              padding: 24,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span
                  style={{
                    backgroundColor: "#EDE9FE",
                    color: "#635BFF",
                    fontWeight: 800,
                    fontSize: 12,
                    borderRadius: 6,
                    padding: "3px 8px",
                  }}
                >
                  03
                </span>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", margin: 0 }}>
                  Understand the inquiry
                </h3>
              </div>
              <p style={{ fontSize: 13.5, color: "#64748B", lineHeight: 1.5, margin: "0 0 20px" }}>
                Identify sentiment, product, order ID and urgency to prioritise each thread.
              </p>

              {/* Step 3 Simulated Inbox Card */}
              <div
                style={{
                  backgroundColor: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: 12,
                  padding: "14px 16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#EF4444" }} />
                  <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#F59E0B" }} />
                  <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#10B981" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", marginLeft: 4 }}>Inbox</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        backgroundColor: "#EDE9FE",
                        color: "#635BFF",
                        fontSize: 10,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      C
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>Customer</span>
                  </div>
                  <span style={{ fontSize: 10.5, color: "#94A3B8" }}>10:24 AM</span>
                </div>

                <p style={{ fontSize: 12.5, fontWeight: 600, color: "#1E293B", margin: "0 0 10px", lineHeight: 1.4 }}>
                  Is the hinge on my Arc lamp covered?
                </p>

                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span
                    style={{
                      backgroundColor: "#F3E8FF",
                      color: "#635BFF",
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 10,
                    }}
                  >
                    Warranty inquiry
                  </span>
                  <span
                    style={{
                      backgroundColor: "#F1F5F9",
                      color: "#475569",
                      fontSize: 10.5,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 10,
                    }}
                  >
                    Arc lamp
                  </span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <button
                onClick={() => toggleSpec("03")}
                style={{
                  background: "none",
                  border: "none",
                  color: "#635BFF",
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {expandedSpec === "03" ? "Hide triage specs" : "View triage architecture →"}
              </button>
            </div>
          </div>

          {/* Step 04: Find the evidence */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 16,
              border: "1px solid #E2E8F0",
              boxShadow: "0 4px 20px -5px rgba(0, 0, 0, 0.05)",
              padding: 24,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span
                  style={{
                    backgroundColor: "#EDE9FE",
                    color: "#635BFF",
                    fontWeight: 800,
                    fontSize: 12,
                    borderRadius: 6,
                    padding: "3px 8px",
                  }}
                >
                  04
                </span>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", margin: 0 }}>
                  Find the evidence
                </h3>
              </div>
              <p style={{ fontSize: 13.5, color: "#64748B", lineHeight: 1.5, margin: "0 0 20px" }}>
                Retrieve passages with cosine similarity above 0.82. Flag missing documentation.
              </p>

              {/* Step 4 Retrieved Passage Card */}
              <div
                style={{
                  backgroundColor: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: 12,
                  padding: "14px 16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <IconSearch size={14} color="#635BFF" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#635BFF" }}>
                    Retrieved source (0.86)
                  </span>
                </div>

                <div
                  style={{
                    backgroundColor: "#FEF3C7",
                    borderRadius: 6,
                    padding: "8px 10px",
                    marginBottom: 10,
                  }}
                >
                  <p style={{ fontSize: 12.5, fontWeight: 700, color: "#0F172A", margin: 0 }}>
                    &ldquo;Hinges are covered for 12 months.&rdquo;
                  </p>
                </div>

                <div style={{ fontSize: 11, color: "#64748B", display: "flex", alignItems: "center", gap: 4 }}>
                  <IconFileText size={12} color="#64748B" />
                  <span>Warranty guide · §4</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <button
                onClick={() => toggleSpec("04")}
                style={{
                  background: "none",
                  border: "none",
                  color: "#635BFF",
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {expandedSpec === "04" ? "Hide vector specs" : "View vector similarity specs →"}
              </button>
            </div>
          </div>

          {/* Step 05: Draft a grounded reply */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 16,
              border: "1px solid #E2E8F0",
              boxShadow: "0 4px 20px -5px rgba(0, 0, 0, 0.05)",
              padding: 24,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span
                  style={{
                    backgroundColor: "#EDE9FE",
                    color: "#635BFF",
                    fontWeight: 800,
                    fontSize: 12,
                    borderRadius: 6,
                    padding: "3px 8px",
                  }}
                >
                  05
                </span>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", margin: 0 }}>
                  Draft a grounded reply
                </h3>
              </div>
              <p style={{ fontSize: 13.5, color: "#64748B", lineHeight: 1.5, margin: "0 0 20px" }}>
                Use retrieved facts to queue a draft in the agent&apos;s inbox. Prices, dates and discounts need supporting evidence.
              </p>

              {/* Step 5 Draft Reply Card */}
              <div
                style={{
                  backgroundColor: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: 12,
                  padding: "14px 16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <IconMail size={14} color="#635BFF" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#635BFF" }}>
                    Draft reply
                  </span>
                </div>

                <p style={{ fontSize: 12.5, fontWeight: 600, color: "#1E293B", margin: "0 0 10px", lineHeight: 1.45 }}>
                  Your Arc lamp hinge is covered for 12 months.
                </p>

                <div style={{ fontSize: 11, color: "#635BFF", display: "flex", alignItems: "center", gap: 4 }}>
                  <IconFileText size={12} color="#635BFF" />
                  <span>Warranty guide · §4</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <button
                onClick={() => toggleSpec("05")}
                style={{
                  background: "none",
                  border: "none",
                  color: "#635BFF",
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {expandedSpec === "05" ? "Hide drafting specs" : "View zero-training specs →"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          SECTION 4: 06 REVIEW, POLISH & DISPATCH (HERO BANNER)
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
            gap: 48,
            alignItems: "center",
          }}
        >
          {/* Left Visual: Woman reviewing at Monitor with Floating UI */}
          <div
            style={{
              position: "relative",
              borderRadius: 20,
              overflow: "hidden",
              border: "1px solid rgba(226, 232, 240, 0.9)",
              boxShadow:
                "0 20px 45px -12px rgba(99, 91, 255, 0.15), 0 8px 20px -8px rgba(0, 0, 0, 0.05)",
            }}
          >
            <img
              src="/how-it-works/step6-review-woman.jpg"
              alt="Review, polish and dispatch interface"
              style={{
                width: "100%",
                height: "auto",
                display: "block",
                objectFit: "cover",
              }}
            />
          </div>

          {/* Right Column: Step 06 Copy */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span
                style={{
                  backgroundColor: "#EDE9FE",
                  color: "#635BFF",
                  fontWeight: 800,
                  fontSize: 14,
                  borderRadius: 8,
                  padding: "4px 10px",
                }}
              >
                06
              </span>
              <h3 style={{ fontSize: "clamp(22px, 2.5vw, 30px)", fontWeight: 800, color: "#0F172A", margin: 0 }}>
                Review, polish &amp; dispatch
              </h3>
            </div>

            <p style={{ fontSize: 15, color: "#64748B", lineHeight: 1.6, margin: "0 0 24px" }}>
              An agent edits the tone and sends through the connected mailbox. The audit log records who reviewed the reply and when.
            </p>

            {/* Feature Bullets */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    backgroundColor: "#ECFDF5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  <IconCheck size={13} color="#065F46" stroke={2.5} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
                    One-Click Tone Presets
                  </div>
                  <div style={{ fontSize: 13, color: "#64748B" }}>
                    Quickly polish replies into Warm, Concise, or Executive formats.
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    backgroundColor: "#ECFDF5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  <IconCheck size={13} color="#065F46" stroke={2.5} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
                    Cryptographic Audit Trail
                  </div>
                  <div style={{ fontSize: 13, color: "#64748B" }}>
                    Every approval is logged with reviewer email, timestamp, and edit deltas.
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    backgroundColor: "#ECFDF5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  <IconCheck size={13} color="#065F46" stroke={2.5} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
                    Native Domain Sending
                  </div>
                  <div style={{ fontSize: 13, color: "#64748B" }}>
                    Replies dispatch via official Google or Microsoft APIs from your exact mailbox address.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          SECTION 5: HUMAN REVIEW VS AUTONOMOUS WORKFLOWS
          ========================================================= */}
      <section
        style={{
          padding: "72px 24px",
          maxWidth: 1180,
          margin: "0 auto",
          borderBottom: "1px solid #F1F5F9",
        }}
      >
        {/* Section Heading with Line */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 44 }}>
          <h2
            style={{
              fontSize: "clamp(24px, 3vw, 34px)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "#0F172A",
              margin: 0,
              whiteSpace: "nowrap",
            }}
          >
            Human review vs autonomous workflows
          </h2>
          <div style={{ flex: 1, height: 1, backgroundColor: "#E2E8F0" }} />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: 32,
            alignItems: "stretch",
          }}
        >
          {/* Card 1: Draft & Review (Default) */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: 18,
              padding: "28px 26px",
              boxShadow: "0 4px 20px -5px rgba(0, 0, 0, 0.05)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              {/* Card Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      backgroundColor: "#EDE9FE",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <IconUser size={18} color="#635BFF" />
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: 0 }}>
                    Draft &amp; Review
                  </h3>
                </div>
                <span
                  style={{
                    backgroundColor: "#EDE9FE",
                    color: "#635BFF",
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 12,
                    padding: "3px 10px",
                  }}
                >
                  Default
                </span>
              </div>

              {/* Checkmark Bullets */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#334155" }}>
                  <IconCheck size={16} color="#635BFF" stroke={2.5} />
                  <span>For inquiries, negotiations and escalations.</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#334155" }}>
                  <IconCheck size={16} color="#635BFF" stroke={2.5} />
                  <span>An agent checks every reply and chooses when to send.</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#334155" }}>
                  <IconCheck size={16} color="#635BFF" stroke={2.5} />
                  <span>Concise, Polish and Warm tone presets.</span>
                </div>
              </div>
            </div>

            {/* Right Mini-Graphic inside Card: Reviewer Approval Window Mockup */}
            <div
              style={{
                backgroundColor: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: 14,
                padding: "12px 16px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.03)",
              }}
            >
              {/* Window Controls */}
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#EF4444" }} />
                <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#F59E0B" }} />
                <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#10B981" }} />
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <img
                    src="/how-it-works/reviewer-user-avatar.jpg"
                    alt="Human Reviewer"
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "2px solid #EDE9FE",
                      boxShadow: "0 2px 6px rgba(99, 91, 255, 0.15)",
                    }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <div style={{ width: 85, height: 7, backgroundColor: "#94A3B8", borderRadius: 4 }} />
                    <div style={{ width: 120, height: 6, backgroundColor: "#CBD5E1", borderRadius: 4 }} />
                    <div style={{ width: 65, height: 6, backgroundColor: "#E2E8F0", borderRadius: 4 }} />
                  </div>
                </div>

                <div style={{ position: "relative" }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      backgroundColor: "#635BFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 4px 12px rgba(99, 91, 255, 0.4)",
                    }}
                  >
                    <IconCheck size={18} stroke={3} color="#FFFFFF" />
                  </div>
                  {/* Cursor Arrow */}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="#0F172A"
                    style={{
                      position: "absolute",
                      bottom: -4,
                      right: -4,
                      filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))",
                    }}
                  >
                    <path d="M3 3l7 18 3-7 7-3L3 3z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Autonomous Send (Configurable) */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: 18,
              padding: "28px 26px",
              boxShadow: "0 4px 20px -5px rgba(0, 0, 0, 0.05)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              {/* Card Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      backgroundColor: "#DCFCE7",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <IconBolt size={18} color="#166534" />
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: 0 }}>
                    Autonomous Send
                  </h3>
                </div>
                <span
                  style={{
                    backgroundColor: "#DCFCE7",
                    color: "#166534",
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 12,
                    padding: "3px 10px",
                  }}
                >
                  Configurable
                </span>
              </div>

              {/* Checkmark Bullets */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#334155" }}>
                  <IconCheck size={16} color="#166534" stroke={2.5} />
                  <span>For receipts, returns policies and scheduling links.</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#334155" }}>
                  <IconCheck size={16} color="#166534" stroke={2.5} />
                  <span>Admin-defined rules and confidence above 95%.</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#334155" }}>
                  <IconCheck size={16} color="#166534" stroke={2.5} />
                  <span>24/7 dispatch with a global emergency pause.</span>
                </div>
              </div>
            </div>

            {/* Right Mini-Graphic inside Card: Config Panel */}
            <div
              style={{
                backgroundColor: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: 12,
                padding: "16px 18px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <IconBolt size={14} color="#166534" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>Auto-send rule</span>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#166534",
                    backgroundColor: "#DCFCE7",
                    padding: "2px 8px",
                    borderRadius: 6,
                  }}
                >
                  ✓ Confidence ≥ 95%
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11.5, color: "#64748B", display: "flex", alignItems: "center", gap: 4 }}>
                  <IconPlayerPause size={13} />
                  Global emergency pause
                </span>
                <div
                  onClick={() => setEmergencyPause(!emergencyPause)}
                  style={{
                    width: 36,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: emergencyPause ? "#EF4444" : "#CBD5E1",
                    position: "relative",
                    cursor: "pointer",
                    transition: "all 140ms ease",
                  }}
                >
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      backgroundColor: "#FFFFFF",
                      position: "absolute",
                      top: 2,
                      left: emergencyPause ? 18 : 2,
                      transition: "all 140ms ease",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          SECTION 6: CLOSING CTA (FULL DEVICE WIDTH - ZERO PADDING)
          ========================================================= */}
      <section
        style={{
          position: "relative",
          width: "100%",
          overflow: "hidden",
          margin: 0,
          padding: 0,
          backgroundColor: "#D0BEF8",
          borderTop: "1px solid #F1F5F9",
        }}
      >
        {/* Applied directly in parent section - covers 100% full width of device */}
        <img
          src="/how-it-works/cta-cable-logo.jpg"
          alt="Ready to see ProxiPilot in action"
          style={{
            width: "100%",
            height: "auto",
            display: "block",
            minHeight: 260,
            objectFit: "cover",
          }}
        />

        {/* Typography overlaid directly in parent section in the open space on the right */}
        <div
          className="cta-integrated-copy"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            width: "58%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-start",
            padding: "24px 60px 24px 20px",
            zIndex: 10,
          }}
        >
          <h2
            style={{
              fontSize: "clamp(24px, 3.2vw, 42px)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "#0F172A",
              margin: "0 0 12px",
              lineHeight: 1.2,
            }}
          >
            Ready to see ProxiPilot in action?
          </h2>

          <p
            style={{
              fontSize: "clamp(14px, 1.3vw, 16px)",
              color: "#475569",
              margin: "0 0 24px",
              lineHeight: 1.5,
              maxWidth: 480,
            }}
          >
            Set up your workspace and connect a mailbox in under 5 minutes.
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <Link
              href="/signup"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
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
            </Link>

            <Link
              href="/request-demo"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
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
              <span>Request Product Demo</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
