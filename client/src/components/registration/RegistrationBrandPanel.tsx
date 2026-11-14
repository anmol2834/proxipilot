"use client";

import React from "react";
import { RegistrationStep, useRegistrationStore } from "@/stores/registration.store";

interface RegistrationBrandPanelProps {
  step: RegistrationStep;
}

export function RegistrationBrandPanel({ step }: RegistrationBrandPanelProps) {
  const { organizationDraft, businessDraft, workspaceDraft } = useRegistrationStore();

  const orgName = organizationDraft.organizationName || "Acme Technologies";
  const orgWebsite = organizationDraft.website || "https://acme.com";
  const orgSlug = orgName.toLowerCase().replace(/[^a-z0-9]/g, "") || "acme";

  return (
    <div className="pp-onboarding-right">
      {/* Top Header Text */}
      <div className="pp-showcase-header">
        {step === "organization" && (
          <>
            <h2 className="pp-showcase-title">
              Set up your team&apos;s autonomous workspace.
            </h2>
            <p className="pp-showcase-subtitle">
              Multi-tenant data isolation, role-based governance, and centralized routing built for modern organizations.
            </p>
          </>
        )}

        {step === "business" && (
          <>
            <h2 className="pp-showcase-title">
              Teach AI your company&apos;s core DNA.
            </h2>
            <p className="pp-showcase-subtitle">
              Your business description and services anchor vector retrieval to guarantee contextual, accurate email actions.
            </p>
          </>
        )}

        {step === "workspace" && (
          <>
            <h2 className="pp-showcase-title">
              Fine-tune autonomous dispatch preferences.
            </h2>
            <p className="pp-showcase-subtitle">
              Calibrate timezone scheduling and brand tone so outgoing AI replies represent your exact voice.
            </p>
          </>
        )}
      </div>

      {/* Center Floating Mockup Stage */}
      <div className="pp-mockup-stage" style={{ width: "100%", maxWidth: "480px" }}>
        {/* ORGANIZATION STEP MOCKUP */}
        {step === "organization" && (
          <div
            className="pp-dashboard-card"
            style={{
              padding: "20px 22px",
              boxShadow: "0 22px 50px -10px rgba(15, 23, 42, 0.35)",
            }}
          >
            {/* Mockup Topbar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "16px",
                paddingBottom: "12px",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    backgroundColor: "#eff6ff",
                    color: "#3562f5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: "0.95rem",
                  }}
                >
                  {orgName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "#0f172a" }}>
                    {orgName}
                  </div>
                  <div style={{ fontSize: "0.74rem", color: "#64748b" }}>
                    {orgSlug}.proxipilot.com
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "3px 9px",
                  borderRadius: "9999px",
                  backgroundColor: "#ecfdf5",
                  color: "#059669",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                }}
              >
                <div
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    backgroundColor: "#10b981",
                  }}
                />
                Active Tenant
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: "10px",
                  backgroundColor: "#f8fafc",
                  border: "1px solid #f1f5f9",
                }}
              >
                <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 600 }}>
                  INDUSTRY VERTICAL
                </div>
                <div style={{ fontSize: "0.82rem", color: "#0f172a", fontWeight: 700, marginTop: "2px" }}>
                  {organizationDraft.industry || "Technology & SaaS"}
                </div>
              </div>

              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: "10px",
                  backgroundColor: "#f8fafc",
                  border: "1px solid #f1f5f9",
                }}
              >
                <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 600 }}>
                  ORGANIZATION SIZE
                </div>
                <div style={{ fontSize: "0.82rem", color: "#0f172a", fontWeight: 700, marginTop: "2px" }}>
                  {organizationDraft.companySize || "11-50 employees"}
                </div>
              </div>
            </div>

            {/* Security & Access Banner */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderRadius: "10px",
                backgroundColor: "#eff6ff",
                border: "1px solid #dbeafe",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3562f5" strokeWidth="2.2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span style={{ fontSize: "0.76rem", fontWeight: 600, color: "#1e40af" }}>
                  End-to-End Workspace Isolation
                </span>
              </div>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#3562f5" }}>
                AES-256
              </span>
            </div>
          </div>
        )}

        {/* BUSINESS STEP MOCKUP */}
        {step === "business" && (
          <div
            className="pp-dashboard-card"
            style={{
              padding: "20px 22px",
              boxShadow: "0 22px 50px -10px rgba(15, 23, 42, 0.35)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "14px",
                paddingBottom: "12px",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: "#3562f5",
                    boxShadow: "0 0 0 3px rgba(53, 98, 245, 0.2)",
                  }}
                />
                <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#0f172a" }}>
                  Autonomous Knowledge Engine
                </span>
              </div>
              <span
                style={{
                  fontSize: "0.72rem",
                  padding: "3px 8px",
                  borderRadius: "6px",
                  backgroundColor: "#eff6ff",
                  color: "#3562f5",
                  fontWeight: 700,
                }}
              >
                99.4% Accuracy
              </span>
            </div>

            {/* Context Extraction Box */}
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "10px",
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                marginBottom: "14px",
              }}
            >
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", marginBottom: "4px" }}>
                SYNTHESIZED BUSINESS CONTEXT
              </div>
              <div style={{ fontSize: "0.82rem", color: "#0f172a", lineHeight: 1.45 }}>
                {businessDraft.businessDescription ||
                  "Intelligent triage for client emails, product support queries, and automated calendar dispatch."}
              </div>
            </div>

            {/* Vector Indexing Tags */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              <span
                style={{
                  padding: "4px 8px",
                  borderRadius: "6px",
                  backgroundColor: "#f1f5f9",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  color: "#334155",
                }}
              >
                Target: {businessDraft.industryServed || "Modern Businesses"}
              </span>
              <span
                style={{
                  padding: "4px 8px",
                  borderRadius: "6px",
                  backgroundColor: "#f1f5f9",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  color: "#334155",
                }}
              >
                Catalog: {businessDraft.productsServices || "Autonomous Solutions"}
              </span>
              <span
                style={{
                  padding: "4px 8px",
                  borderRadius: "6px",
                  backgroundColor: "#ecfdf5",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  color: "#059669",
                }}
              >
                ✓ Qdrant Ready
              </span>
            </div>
          </div>
        )}

        {/* WORKSPACE STEP MOCKUP */}
        {step === "workspace" && (
          <div
            className="pp-dashboard-card"
            style={{
              padding: "20px 22px",
              boxShadow: "0 22px 50px -10px rgba(15, 23, 42, 0.35)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "14px",
                paddingBottom: "12px",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#3562f5" strokeWidth="2.2">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                </svg>
                <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#0f172a" }}>
                  Live AI Tone Preview
                </span>
              </div>
              <span
                style={{
                  fontSize: "0.72rem",
                  padding: "3px 8px",
                  borderRadius: "6px",
                  backgroundColor: "#eff6ff",
                  color: "#3562f5",
                  fontWeight: 700,
                }}
              >
                Tone: {workspaceDraft.responseStyle || "Professional"}
              </span>
            </div>

            {/* Email Message Bubble Simulation */}
            <div
              style={{
                padding: "10px 12px",
                borderRadius: "10px",
                backgroundColor: "#f8fafc",
                border: "1px solid #f1f5f9",
                marginBottom: "10px",
              }}
            >
              <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 600 }}>
                INCOMING CUSTOMER QUERY:
              </div>
              <div style={{ fontSize: "0.78rem", color: "#0f172a", marginTop: "2px", fontStyle: "italic" }}>
                &ldquo;Could we get an expedited quote for enterprise onboarding next Tuesday?&rdquo;
              </div>
            </div>

            {/* AI Generated Reply */}
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "10px",
                backgroundColor: "#eff6ff",
                border: "1px solid #dbeafe",
                marginBottom: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#1e40af" }}>
                  PROXIPILOT AUTONOMOUS DRAFT:
                </span>
                <span style={{ fontSize: "0.68rem", color: "#3562f5", fontWeight: 600 }}>
                  Timezone: {workspaceDraft.timezone ? workspaceDraft.timezone.split(" ")[0] : "Local"}
                </span>
              </div>
              <div style={{ fontSize: "0.8rem", color: "#1e3a8a", lineHeight: 1.45 }}>
                {workspaceDraft.responseStyle === "Friendly"
                  ? "Hi there! Absolutely, we would love to help you get started. I've prepared our enterprise breakdown for Tuesday!"
                  : workspaceDraft.responseStyle === "Concise"
                  ? "Quote prepared. Scheduled for Tuesday morning. Let me know if you need specific SLA additions."
                  : workspaceDraft.responseStyle === "Executive"
                  ? "Enterprise onboarding summary finalized with guaranteed 99.9% SLAs. Delivery confirmed for Tuesday."
                  : "Thank you for reaching out. We have expedited your enterprise onboarding quote and confirmed scheduling for Tuesday."}
              </div>
            </div>

            {/* Status Indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#10b981" }} />
              <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                Ready to route real customer conversations
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Feature Badges */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: "14px",
          borderTop: "1px solid rgba(255, 255, 255, 0.2)",
          color: "rgba(255, 255, 255, 0.9)",
          fontSize: "0.78rem",
          fontWeight: 500,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>Multi-Tenant Architecture</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>Zero Hallucination Retrieval</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>Human Control Mode</span>
        </div>
      </div>
    </div>
  );
}
