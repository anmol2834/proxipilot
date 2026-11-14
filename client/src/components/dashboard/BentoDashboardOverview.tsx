"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  IconMail,
  IconSparkles,
  IconCheck,
  IconAlertTriangle,
  IconArrowRight,
  IconClock,
  IconDatabase,
  IconShieldCheck,
  IconBolt,
  IconUsers,
  IconRefresh,
  IconBrandGmail,
  IconBrandOffice,
  IconFileText,
  IconBrain,
  IconChartBar,
} from "@tabler/icons-react";
import { useRegistrationStore } from "@/stores/registration.store";
import { useDashboardStore } from "@/stores/dashboard.store";
import { useSetupStatus } from "@/hooks/use-setup-status";

export function BentoDashboardOverview() {
  const router = useRouter();
  const { accountDraft, organizationDraft } = useRegistrationStore();
  // resetSetup is kept for dev/testing convenience only
  const { resetSetup } = useDashboardStore();

  // Real server-derived setup status — never phantom local flags
  const {
    accountCreated,
    emailConnected,
    knowledgeAdded,
    isSetupComplete,
  } = useSetupStatus();

  const userGreeting = accountDraft.firstName || "Anmol";
  const orgName = organizationDraft.organizationName || "Your Organization";

  // Checklist calculation
  const totalSteps = 3;
  let completedCount = 0;
  if (accountCreated) completedCount++;
  if (emailConnected) completedCount++;
  if (knowledgeAdded) completedCount++;
  const progressPercent = Math.round((completedCount / totalSteps) * 100);

  // Simulated AI response style selection for live test-drive
  const [selectedTone, setSelectedTone] = useState<"Professional" | "Friendly" | "Concise">("Professional");

  return (
    <div className="bento-dashboard-container">
      {/* ==================================================================== */}
      {/* 1. TOP BENTO ROW: Executive Welcome & AI Health Station              */}
      {/* ==================================================================== */}
      <div className="bento-grid">
        {/* HERO WELCOME BENTO CARD (Span 3 cols on desktop) */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.2 }}
          className="bento-card bento-col-span-3 glow-blue"
          style={{
            background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
            minHeight: "160px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "3px 9px",
                    borderRadius: "9999px",
                    backgroundColor: isSetupComplete ? "#ecfdf5" : "#eff6ff",
                    color: isSetupComplete ? "#059669" : "#2563EB",
                    fontSize: "0.74rem",
                    fontWeight: 700,
                  }}
                >
                  <span
                    className="bento-pulse-dot"
                    style={{ backgroundColor: isSetupComplete ? "#10b981" : "#3562f5" }}
                  />
                  {isSetupComplete ? "AUTONOMOUS PIPELINE LIVE" : "ONBOARDING IN PROGRESS"}
                </span>

                <span
                  style={{
                    fontSize: "0.74rem",
                    color: "#64748b",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    backgroundColor: "#f1f5f9",
                    fontWeight: 600,
                  }}
                >
                  {orgName}
                </span>
              </div>

              <h1
                style={{
                  fontSize: "1.75rem",
                  fontWeight: 800,
                  color: "#0f172a",
                  letterSpacing: "-0.025em",
                  lineHeight: 1.2,
                  margin: 0,
                }}
              >
                Welcome back, {userGreeting} 👋
              </h1>
              <p style={{ fontSize: "0.88rem", color: "#64748b", marginTop: "6px", marginBottom: 0 }}>
                {isSetupComplete
                  ? "ProxiPilot is actively triaging your incoming customer inquiries with zero hallucinations."
                  : "Complete your setup checklist below to connect your inbox and activate autonomous email AI."}
              </p>
            </div>

            {/* Quick Actions in Header */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                onClick={() => router.push("/dashboard/inbox")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  borderRadius: "10px",
                  backgroundColor: "#3562f5",
                  color: "#ffffff",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(53, 98, 245, 0.25)",
                  transition: "all 0.15s ease",
                }}
              >
                <IconMail size={16} />
                <span>Go to Inbox</span>
              </button>

              {isSetupComplete && (
                <button
                  type="button"
                  onClick={resetSetup}
                  title="Reopen setup checklist for testing"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 12px",
                    borderRadius: "10px",
                    backgroundColor: "#f8fafc",
                    color: "#475569",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    border: "1px solid #e2e8f0",
                    cursor: "pointer",
                  }}
                >
                  <IconRefresh size={15} />
                  <span>Reset Setup</span>
                </button>
              )}
            </div>
          </div>

          {/* Bottom Metric Tags */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              marginTop: "18px",
              paddingTop: "12px",
              borderTop: "1px solid #f1f5f9",
              fontSize: "0.78rem",
              color: "#64748b",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <IconShieldCheck size={16} color="#059669" />
              <span>Multi-Tenant AES-256 Isolation</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <IconDatabase size={16} color="#2563EB" />
              <span>Qdrant Vector DB Synced</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <IconBolt size={16} color="#7c3aed" />
              <span>Hybrid LLM Router: Active</span>
            </div>
          </div>
        </motion.div>

        {/* AI ACCURACY & ENGINE GAUGE CARD (Span 1 col) */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.2 }}
          className="bento-card bento-col-span-1 glow-green"
          style={{
            background: "linear-gradient(145deg, #ffffff 0%, #f0fdf4 100%)",
            minHeight: "160px",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#166534", textTransform: "uppercase" }}>
              Accuracy Score
            </span>
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "8px",
                backgroundColor: "#dcfce7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#15803d",
              }}
            >
              <IconBrain size={18} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: "2.1rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em" }}>
              99.4%
            </div>
            <div style={{ fontSize: "0.78rem", color: "#15803d", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
              <IconCheck size={14} stroke={3} />
              <span>Zero Hallucination Retrieval</span>
            </div>
          </div>

          <div
            style={{
              fontSize: "0.72rem",
              color: "#64748b",
              paddingTop: "8px",
              borderTop: "1px solid rgba(22, 101, 52, 0.1)",
            }}
          >
            Vector ground truth verified across all company docs.
          </div>
        </motion.div>
      </div>

      {/* ==================================================================== */}
      {/* 2. MAIN BENTO GRID: Setup Mode vs Operational Mode                   */}
      {/* ==================================================================== */}
      {!isSetupComplete ? (
        /* SETUP MODE BENTO GRID */
        <div className="bento-grid">
          {/* INTERACTIVE CHECKLIST BENTO CARD (Span 2 cols on desktop, Row Span 2) */}
          <motion.div
            whileHover={{ y: -2 }}
            transition={{ duration: 0.2 }}
            className="bento-card bento-col-span-2 bento-row-span-2 glow-blue"
            style={{ minHeight: "340px" }}
          >
            <div>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <div>
                  <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "#3562f5", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    GET STARTED
                  </span>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", margin: "4px 0 0 0" }}>
                    Complete setup to activate ProxiPilot
                  </h2>
                </div>

                {/* Progress Pill */}
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#0f172a" }}>
                    {completedCount} of {totalSteps} done
                  </span>
                  <div
                    style={{
                      width: "120px",
                      height: "6px",
                      backgroundColor: "#e2e8f0",
                      borderRadius: "9999px",
                      overflow: "hidden",
                      marginTop: "6px",
                    }}
                  >
                    <div
                      style={{
                        width: `${progressPercent}%`,
                        height: "100%",
                        backgroundColor: "#3562f5",
                        borderRadius: "9999px",
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 3 Step Interactive Rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {/* Step 1: Account */}
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: "14px",
                    backgroundColor: accountCreated ? "#f8fafc" : "#ffffff",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        backgroundColor: accountCreated ? "#22c55e" : "#f1f5f9",
                        color: "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <IconCheck size={16} stroke={3} />
                    </div>
                    <div>
                      <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#0f172a" }}>
                        1. Create your account
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                        Verified email & workspace initialized
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#16a34a" }}>
                    Completed
                  </span>
                </div>

                {/* Step 2: Email Connection */}
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: "14px",
                    backgroundColor: emailConnected ? "#f8fafc" : "#ffffff",
                    border: emailConnected ? "1px solid #e2e8f0" : "1px solid #bfdbfe",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    boxShadow: emailConnected ? "none" : "0 4px 12px rgba(37, 99, 235, 0.06)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        backgroundColor: emailConnected ? "#22c55e" : "#eff6ff",
                        color: emailConnected ? "#ffffff" : "#2563eb",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: "0.8rem",
                      }}
                    >
                      {emailConnected ? <IconCheck size={16} stroke={3} /> : "2"}
                    </div>
                    <div>
                      <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#0f172a" }}>
                        2. Connect business email
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                        Sync Gmail or Microsoft Outlook in 30 seconds
                      </div>
                    </div>
                  </div>

                  {emailConnected ? (
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#16a34a" }}>
                      Connected
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => router.push("/dashboard/integrations")}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "8px",
                        backgroundColor: "#3562f5",
                        color: "#ffffff",
                        border: "none",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Connect now
                    </button>
                  )}
                </div>

                {/* Step 3: Knowledge Base */}
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: "14px",
                    backgroundColor: knowledgeAdded ? "#f8fafc" : "#ffffff",
                    border: knowledgeAdded ? "1px solid #e2e8f0" : "1px solid #bfdbfe",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    boxShadow: knowledgeAdded ? "none" : "0 4px 12px rgba(37, 99, 235, 0.06)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        backgroundColor: knowledgeAdded ? "#22c55e" : "#eff6ff",
                        color: knowledgeAdded ? "#ffffff" : "#2563eb",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: "0.8rem",
                      }}
                    >
                      {knowledgeAdded ? <IconCheck size={16} stroke={3} /> : "3"}
                    </div>
                    <div>
                      <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#0f172a" }}>
                        3. Add company knowledge
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                        Upload docs, FAQ, pricing, or web URL
                      </div>
                    </div>
                  </div>

                  {knowledgeAdded ? (
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#16a34a" }}>
                      Indexed
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => router.push("/dashboard/knowledge")}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "8px",
                        backgroundColor: "#3562f5",
                        color: "#ffffff",
                        border: "none",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Add knowledge
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Tip */}
            <div style={{ marginTop: "14px", fontSize: "0.74rem", color: "#64748b", display: "flex", alignItems: "center", gap: "6px" }}>
              <IconSparkles size={15} color="#3562f5" />
              <span>Tip: Once both steps are completed, your operational dashboard unlocks automatically.</span>
            </div>
          </motion.div>

          {/* QUICK ACTIONS BENTO CARD (Span 1 col) */}
          <motion.div
            whileHover={{ y: -2 }}
            transition={{ duration: 0.2 }}
            className="bento-card bento-col-span-1"
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                <IconBolt size={18} color="#3562f5" />
                <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                  Quick Launch
                </h3>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <Link
                  href="/dashboard/integrations"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    textDecoration: "none",
                    color: "#0f172a",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <IconBrandGmail size={18} color="#ea4335" />
                    <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>Connect Gmail</span>
                  </div>
                  <IconArrowRight size={14} color="#94a3b8" />
                </Link>

                <Link
                  href="/dashboard/integrations"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    textDecoration: "none",
                    color: "#0f172a",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <IconBrandOffice size={18} color="#00a4ef" />
                    <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>Connect Outlook</span>
                  </div>
                  <IconArrowRight size={14} color="#94a3b8" />
                </Link>

                <Link
                  href="/dashboard/knowledge"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    textDecoration: "none",
                    color: "#0f172a",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <IconFileText size={18} color="#3562f5" />
                    <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>Add Knowledge</span>
                  </div>
                  <IconArrowRight size={14} color="#94a3b8" />
                </Link>

                <Link
                  href="/dashboard/team"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    textDecoration: "none",
                    color: "#0f172a",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <IconUsers size={18} color="#7c3aed" />
                    <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>Invite Teammates</span>
                  </div>
                  <IconArrowRight size={14} color="#94a3b8" />
                </Link>
              </div>
            </div>

            <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "12px", textAlign: "center" }}>
              Fast 1-click workspace actions
            </div>
          </motion.div>

          {/* INSIGHTS PREVIEW BENTO CARD (Span 1 col) */}
          <motion.div
            whileHover={{ y: -2 }}
            transition={{ duration: 0.2 }}
            className="bento-card bento-col-span-1"
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <IconChartBar size={18} color="#3562f5" />
                <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                  Realtime Metrics
                </h3>
              </div>

              {/* Animated Mini Bars Visual */}
              <div
                style={{
                  height: "80px",
                  borderRadius: "12px",
                  backgroundColor: "#f8fafc",
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "12px",
                  marginBottom: "12px",
                }}
              >
                {[40, 65, 95, 75, 50, 85].map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ duration: 0.8, delay: i * 0.1 }}
                    style={{
                      width: "12px",
                      borderRadius: "4px",
                      backgroundColor: i === 2 ? "#3562f5" : "#bfdbfe",
                    }}
                  />
                ))}
              </div>

              <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "#0f172a" }}>
                Realtime analytics unlock here
              </div>
              <div style={{ fontSize: "0.74rem", color: "#64748b", marginTop: "4px" }}>
                Resolution times, customer satisfaction, and auto-dispatched inquiries.
              </div>
            </div>

            <div style={{ paddingTop: "10px", borderTop: "1px solid #f1f5f9", fontSize: "0.72rem", color: "#3562f5", fontWeight: 600 }}>
              Live pipeline streaming
            </div>
          </motion.div>

          {/* AI LIVE SIMULATOR / TEST DRIVE BENTO CARD (Span 3 cols) */}
          <motion.div
            whileHover={{ y: -2 }}
            transition={{ duration: 0.2 }}
            className="bento-card bento-col-span-3 glow-blue"
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <IconSparkles size={18} color="#3562f5" />
                <h3 style={{ fontSize: "0.98rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                  Live Autonomous Response Simulator
                </h3>
              </div>

              {/* Tone Switcher */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "0.74rem", color: "#64748b", fontWeight: 600 }}>Test Tone:</span>
                {(["Professional", "Friendly", "Concise"] as const).map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => setSelectedTone(tone)}
                    style={{
                      padding: "4px 9px",
                      borderRadius: "6px",
                      border: "1px solid",
                      borderColor: selectedTone === tone ? "#3562f5" : "#e2e8f0",
                      backgroundColor: selectedTone === tone ? "#eff6ff" : "#ffffff",
                      color: selectedTone === tone ? "#3562f5" : "#64748b",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </div>

            {/* Split Inbound & AI Outbound bubbles */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                marginBottom: "12px",
              }}
            >
              {/* Inbound Customer Query */}
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "12px",
                  backgroundColor: "#f8fafc",
                  border: "1px solid #f1f5f9",
                }}
              >
                <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                  INCOMING EMAIL (Michael Vance)
                </div>
                <div style={{ fontSize: "0.82rem", color: "#0f172a", marginTop: "4px", lineHeight: 1.45 }}>
                  &ldquo;Hi team, we need to expedite our annual renewal contract and add 15 more seats before Thursday. Can you send the pricing sheet?&rdquo;
                </div>
              </div>

              {/* Live AI Drafted Answer */}
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "12px",
                  backgroundColor: "#eff6ff",
                  border: "1px solid #dbeafe",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontSize: "0.7rem", color: "#1e40af", fontWeight: 700, textTransform: "uppercase" }}>
                    PROXIPILOT AUTO-DRAFT ({selectedTone.toUpperCase()})
                  </span>
                  <span style={{ fontSize: "0.68rem", color: "#2563eb", fontWeight: 700 }}>
                    Confidence: 98%
                  </span>
                </div>
                <div style={{ fontSize: "0.82rem", color: "#1e3a8a", lineHeight: 1.45 }}>
                  {selectedTone === "Friendly"
                    ? "Hi Michael! Absolutely, happy to help you upgrade. I've attached your custom enterprise tier breakdown with the 15 additional seats for Thursday."
                    : selectedTone === "Concise"
                    ? "Hello Michael. Contract updated with 15 seats. Attached pricing sheet reflects enterprise annual discount for Thursday."
                    : "Dear Michael, thank you for reaching out. We have expedited your contract update for 15 additional seats. Attached is your revised enterprise pricing."}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.74rem", color: "#64748b" }}>
              <span>Autonomous guardrails ensure human approval before sending when confidence is below 90%.</span>
              <span style={{ color: "#3562f5", fontWeight: 700 }}>Safe Mode: Enabled</span>
            </div>
          </motion.div>

          {/* TRUST / SECURITY BENTO CARD (Span 1 col) */}
          <motion.div
            whileHover={{ y: -2 }}
            transition={{ duration: 0.2 }}
            className="bento-card bento-col-span-1"
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                <IconShieldCheck size={18} color="#059669" />
                <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                  Enterprise Trust
                </h3>
              </div>

              <p style={{ fontSize: "0.8rem", color: "#475569", lineHeight: 1.45, fontStyle: "italic", margin: 0 }}>
                &ldquo;ProxiPilot handled 84% of our routine service scheduling in week one with zero false responses.&rdquo;
              </p>

              <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    backgroundColor: "#3562f5",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                  }}
                >
                  EK
                </div>
                <div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#0f172a" }}>
                    Elena Rostova
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "#64748b" }}>
                    VP Ops, Apex Systems
                  </div>
                </div>
              </div>
            </div>

            <div style={{ paddingTop: "10px", borderTop: "1px solid #f1f5f9", fontSize: "0.72rem", color: "#059669", fontWeight: 700 }}>
              SOC2 Type II & GDPR Compliant
            </div>
          </motion.div>
        </div>
      ) : (
        /* OPERATIONAL VIEW BENTO GRID (When setup is complete) */
        <>
          {/* 4 BENTO METRIC CARDS ROW */}
          <div className="bento-grid">
            {/* Metric 1 */}
            <motion.div
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2 }}
              className="bento-card bento-col-span-1"
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Total Inbound
                </span>
                <IconMail size={16} color="#64748b" />
              </div>
              <div style={{ fontSize: "1.9rem", fontWeight: 800, color: "#0f172a", margin: "6px 0 2px 0" }}>
                1,284
              </div>
              <div style={{ fontSize: "0.75rem", color: "#16a34a", fontWeight: 700 }}>
                +18% from last week
              </div>
            </motion.div>

            {/* Metric 2 */}
            <motion.div
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2 }}
              className="bento-card bento-col-span-1 glow-blue"
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#2563eb", textTransform: "uppercase" }}>
                  AI Autonomous Handled
                </span>
                <IconSparkles size={16} color="#2563eb" />
              </div>
              <div style={{ fontSize: "1.9rem", fontWeight: 800, color: "#2563eb", margin: "6px 0 2px 0" }}>
                82.4%
              </div>
              <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>
                1,058 automated drafts
              </div>
            </motion.div>

            {/* Metric 3 */}
            <motion.div
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2 }}
              className="bento-card bento-col-span-1 glow-amber"
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#ea580c", textTransform: "uppercase" }}>
                  Needs Attention
                </span>
                <IconAlertTriangle size={16} color="#ea580c" />
              </div>
              <div style={{ fontSize: "1.9rem", fontWeight: 800, color: "#ea580c", margin: "6px 0 2px 0" }}>
                3
              </div>
              <div style={{ fontSize: "0.75rem", color: "#ea580c", fontWeight: 700 }}>
                Human approval required
              </div>
            </motion.div>

            {/* Metric 4 */}
            <motion.div
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2 }}
              className="bento-card bento-col-span-1"
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Avg Response Time
                </span>
                <IconClock size={16} color="#64748b" />
              </div>
              <div style={{ fontSize: "1.9rem", fontWeight: 800, color: "#0f172a", margin: "6px 0 2px 0" }}>
                4.2 min
              </div>
              <div style={{ fontSize: "0.75rem", color: "#16a34a", fontWeight: 700 }}>
                -68% faster than baseline
              </div>
            </motion.div>
          </div>

          {/* MAIN OPERATIONAL BENTO GRID */}
          <div className="bento-grid">
            {/* TODAY'S AI ACTIVITY (Span 2 cols on desktop, Row Span 2) */}
            <motion.div
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2 }}
              className="bento-card bento-col-span-2 bento-row-span-2 glow-blue"
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <IconMail size={18} color="#3562f5" />
                    <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                      Today&apos;s Live Autonomous Activity
                    </h3>
                  </div>

                  <Link
                    href="/dashboard/inbox"
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      color: "#3562f5",
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span>View Inbox</span>
                    <IconArrowRight size={14} />
                  </Link>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {[
                    {
                      title: "Pricing Inquiry & Tier Recommendation",
                      company: "Acme Corp (Sarah Jenkins)",
                      status: "Response ready",
                      badgeBg: "#eff6ff",
                      badgeColor: "#2563eb",
                      time: "8m ago",
                    },
                    {
                      title: "Appliance Repair Maintenance Schedule",
                      company: "Metro Facilities (David Miller)",
                      status: "Knowledge matched",
                      badgeBg: "#ecfdf5",
                      badgeColor: "#16a34a",
                      time: "24m ago",
                    },
                    {
                      title: "High Intent Enterprise Lead",
                      company: "Global Logistics Group",
                      status: "Assigned to Sales",
                      badgeBg: "#faf5ff",
                      badgeColor: "#9333ea",
                      time: "1h ago",
                    },
                    {
                      title: "Product Return Policy Clarification",
                      company: "Nordic Retail (Hannah Schmidt)",
                      status: "Auto-Resolved",
                      badgeBg: "#ecfdf5",
                      badgeColor: "#16a34a",
                      time: "2h ago",
                    },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "12px",
                        border: "1px solid #f1f5f9",
                        backgroundColor: "#fafafa",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#fafafa")}
                    >
                      <div>
                        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#0f172a" }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "2px" }}>
                          {item.company} &bull; {item.time}
                        </div>
                      </div>

                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: "6px",
                          backgroundColor: item.badgeBg,
                          color: item.badgeColor,
                          fontSize: "0.72rem",
                          fontWeight: 700,
                        }}
                      >
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ paddingTop: "12px", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.74rem", color: "#64748b" }}>
                <span>Real-time webhook sync: 100% operational</span>
                <span style={{ color: "#16a34a", fontWeight: 700 }}>Latency: 142ms</span>
              </div>
            </motion.div>

            {/* NEEDS ATTENTION BENTO CARD (Span 1 col) */}
            <motion.div
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2 }}
              className="bento-card bento-col-span-1 glow-amber"
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                  <IconAlertTriangle size={18} color="#d97706" />
                  <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                    Human Attention Required
                  </h3>
                </div>

                <div
                  style={{
                    padding: "12px",
                    borderRadius: "12px",
                    backgroundColor: "#fffbeb",
                    border: "1px solid #fef3c7",
                    marginBottom: "10px",
                  }}
                >
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#92400e" }}>
                    Refund Request &bull; Manual Review
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "#b45309", marginTop: "4px", lineHeight: 1.4 }}>
                    Confidence score below 75% threshold. ProxiPilot drafted a response and paused dispatch.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard/inbox")}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    backgroundColor: "#d97706",
                    color: "#ffffff",
                    border: "none",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Review 3 Pending Drafts →
                </button>
              </div>

              <div style={{ fontSize: "0.72rem", color: "#92400e", fontWeight: 600, marginTop: "10px" }}>
                Zero unauthorized outbound actions.
              </div>
            </motion.div>

            {/* AI WORKLOAD SUMMARY (Span 1 col) */}
            <motion.div
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2 }}
              className="bento-card bento-col-span-1"
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                  <IconBrain size={18} color="#3562f5" />
                  <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                    AI Autonomous Workload
                  </h3>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Triage & Dispatch</span>
                  <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#2563eb" }}>82%</span>
                </div>

                <div style={{ width: "100%", height: "8px", borderRadius: "9999px", backgroundColor: "#e2e8f0", overflow: "hidden", marginBottom: "14px" }}>
                  <div style={{ width: "82%", height: "100%", backgroundColor: "#3562f5", borderRadius: "9999px" }} />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.75rem", color: "#64748b" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Model Engine:</span>
                    <strong style={{ color: "#0f172a" }}>Sonnet 3.5 / GPT-4o</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Vector Grounding:</span>
                    <strong style={{ color: "#16a34a" }}>100% Verified</strong>
                  </div>
                </div>
              </div>

              <div style={{ paddingTop: "10px", borderTop: "1px solid #f1f5f9", fontSize: "0.72rem", color: "#64748b" }}>
                Capacity: 50,000 emails/month
              </div>
            </motion.div>

            {/* QUICK ACTIONS ROW (Span 2 cols) */}
            <motion.div
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2 }}
              className="bento-card bento-col-span-2"
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <IconBolt size={18} color="#3562f5" />
                <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                  Quick Launchpad
                </h3>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
                <Link
                  href="/dashboard/inbox"
                  style={{
                    padding: "10px",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    textDecoration: "none",
                    textAlign: "center",
                    color: "#0f172a",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <IconMail size={20} color="#3562f5" />
                  <span style={{ fontSize: "0.76rem", fontWeight: 700 }}>Inbox</span>
                </Link>

                <Link
                  href="/dashboard/knowledge"
                  style={{
                    padding: "10px",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    textDecoration: "none",
                    textAlign: "center",
                    color: "#0f172a",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <IconDatabase size={20} color="#059669" />
                  <span style={{ fontSize: "0.76rem", fontWeight: 700 }}>Knowledge</span>
                </Link>

                <Link
                  href="/dashboard/integrations"
                  style={{
                    padding: "10px",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    textDecoration: "none",
                    textAlign: "center",
                    color: "#0f172a",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <IconBrandGmail size={20} color="#ea4335" />
                  <span style={{ fontSize: "0.76rem", fontWeight: 700 }}>Mailboxes</span>
                </Link>

                <Link
                  href="/dashboard/team"
                  style={{
                    padding: "10px",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    textDecoration: "none",
                    textAlign: "center",
                    color: "#0f172a",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <IconUsers size={20} color="#7c3aed" />
                  <span style={{ fontSize: "0.76rem", fontWeight: 700 }}>Team</span>
                </Link>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </div>
  );
}
