"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  IconCheck,
  IconArrowRight,
  IconArrowUpRight,
  IconLock,
  IconShieldCheck,
  IconMail,
} from "@tabler/icons-react";

export function IntegrationsClientView() {
  const [activeTab, setActiveTab] = useState<string>("mailbox-providers");

  const scrollToSection = (id: string) => {
    setActiveTab(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div style={{ width: "100%", overflowX: "hidden", backgroundColor: "#FFFFFF" }}>
      <style>{`
        @media (max-width: 768px) {
          .connectors-hero-copy {
            position: static !important;
            max-width: 100% !important;
            padding: 32px 20px 20px !important;
            background: linear-gradient(180deg, #FBF8FF 0%, #EDE9FE 100%) !important;
          }
          .connectors-cta-copy {
            position: static !important;
            width: 100% !important;
            padding: 36px 20px !important;
            background: linear-gradient(180deg, #EDE9FE 0%, #FAF5FF 100%) !important;
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
          backgroundColor: "#F7F2FE",
        }}
      >
        {/* Applied directly in parent section - covers 100% full width of device */}
        <img
          src="/integrations/connectors-hero-box.jpg"
          alt="Connect your tools in minutes. Keep your existing email clients."
          style={{
            width: "100%",
            height: "auto",
            display: "block",
            objectFit: "cover",
          }}
        />

        {/* Typography overlaid directly in parent section */}
        <div
          className="connectors-hero-copy"
          style={{
            position: "absolute",
            top: "12%",
            left: "5%",
            maxWidth: "42%",
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
              backgroundColor: "rgba(237, 233, 254, 0.9)",
              border: "1px solid #DDD6FE",
              color: "#635BFF",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 16,
              backdropFilter: "blur(4px)",
            }}
          >
            Native Connectors
          </div>

          <h1
            style={{
              fontSize: "clamp(24px, 3.2vw, 44px)",
              fontWeight: 800,
              letterSpacing: "-0.035em",
              lineHeight: 1.15,
              color: "#0F172A",
              margin: "0 0 16px",
            }}
          >
            Connect your tools in minutes. Keep your{" "}
            <em style={{ fontStyle: "italic", fontFamily: "Georgia, serif", fontWeight: 700 }}>
              existing email clients.
            </em>
          </h1>

          <p
            style={{
              fontSize: "clamp(13.5px, 1.25vw, 16px)",
              color: "#475569",
              lineHeight: 1.55,
              margin: 0,
              maxWidth: 480,
            }}
          >
            ProxiPilot connects to Google Workspace and Microsoft 365. Your team keeps its mailboxes and works in the email clients it already knows.
          </p>
        </div>
      </section>

      {/* =========================================================
          SECTION 2: NAVIGATION TABS BAR
          ========================================================= */}
      <div
        style={{
          borderBottom: "1px solid #E2E8F0",
          backgroundColor: "#FFFFFF",
          position: "sticky",
          top: 64,
          zIndex: 20,
          backdropFilter: "blur(8px)",
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 0,
            overflowX: "auto",
          }}
        >
          <button
            onClick={() => scrollToSection("mailbox-providers")}
            style={{
              padding: "16px 16px",
              background: "none",
              border: "none",
              borderBottom: activeTab === "mailbox-providers" ? "2.5px solid #635BFF" : "2.5px solid transparent",
              color: activeTab === "mailbox-providers" ? "#635BFF" : "#64748B",
              fontWeight: activeTab === "mailbox-providers" ? 700 : 500,
              fontSize: 13.5,
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 120ms ease",
            }}
          >
            Mailbox providers
          </button>

          <span style={{ color: "#E2E8F0", margin: "0 14px", userSelect: "none" }}>|</span>

          <button
            onClick={() => scrollToSection("infrastructure")}
            style={{
              padding: "16px 16px",
              background: "none",
              border: "none",
              borderBottom: activeTab === "infrastructure" ? "2.5px solid #635BFF" : "2.5px solid transparent",
              color: activeTab === "infrastructure" ? "#635BFF" : "#64748B",
              fontWeight: activeTab === "infrastructure" ? 700 : 500,
              fontSize: 13.5,
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 120ms ease",
            }}
          >
            Infrastructure
          </button>

          <span style={{ color: "#E2E8F0", margin: "0 14px", userSelect: "none" }}>|</span>

          <button
            onClick={() => scrollToSection("developer-api")}
            style={{
              padding: "16px 16px",
              background: "none",
              border: "none",
              borderBottom: activeTab === "developer-api" ? "2.5px solid #635BFF" : "2.5px solid transparent",
              color: activeTab === "developer-api" ? "#635BFF" : "#64748B",
              fontWeight: activeTab === "developer-api" ? 700 : 500,
              fontSize: 13.5,
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 120ms ease",
            }}
          >
            Developer API
          </button>

          <span style={{ color: "#E2E8F0", margin: "0 14px", userSelect: "none" }}>|</span>

          <button
            onClick={() => scrollToSection("access-policies")}
            style={{
              padding: "16px 16px",
              background: "none",
              border: "none",
              borderBottom: activeTab === "access-policies" ? "2.5px solid #635BFF" : "2.5px solid transparent",
              color: activeTab === "access-policies" ? "#635BFF" : "#64748B",
              fontWeight: activeTab === "access-policies" ? 700 : 500,
              fontSize: 13.5,
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 120ms ease",
            }}
          >
            Access &amp; policies
          </button>
        </div>
      </div>

      {/* =========================================================
          SECTION 3: CHOOSE YOUR MAILBOX PROVIDER
          ========================================================= */}
      <section
        id="mailbox-providers"
        style={{
          padding: "56px 24px 64px",
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
            margin: "0 0 32px",
          }}
        >
          Choose your mailbox provider
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
            gap: 28,
            alignItems: "stretch",
          }}
        >
          {/* Card 1: Google Workspace & Gmail */}
          <div
            style={{
              backgroundColor: "#FAFAFA",
              border: "1px solid #E2E8F0",
              borderRadius: 20,
              padding: "26px 24px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 4px 18px rgba(0, 0, 0, 0.03)",
            }}
          >
            <div>
              {/* Card Header with Mini Inbox */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                {/* Provider Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <img
                      src="/logos/gmail.png"
                      alt="Gmail"
                      style={{ width: 26, height: 26, objectFit: "contain" }}
                    />
                    <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", margin: 0 }}>
                      Google Workspace &amp; Gmail
                    </h3>
                  </div>

                  <span
                    style={{
                      display: "inline-block",
                      backgroundColor: "#DCFCE7",
                      color: "#166534",
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 12,
                      padding: "2px 10px",
                      marginBottom: 12,
                    }}
                  >
                    Native · Production ready
                  </span>

                  <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.5, margin: "0 0 16px" }}>
                    Two-way OAuth sync for Google Workspace mailboxes.
                  </p>
                </div>

                {/* Right Mini Gmail UI Card */}
                <div
                  style={{
                    width: 150,
                    backgroundColor: "#FFFFFF",
                    borderRadius: 12,
                    border: "1px solid #E2E8F0",
                    boxShadow: "0 6px 18px rgba(0, 0, 0, 0.05)",
                    padding: "10px 12px",
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 10, color: "#94A3B8" }}>☰</span>
                    <img src="/logos/gmail.png" alt="Gmail" style={{ width: 13, height: 13, objectFit: "contain" }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#0F172A" }}>Gmail</span>
                  </div>

                  <div
                    style={{
                      backgroundColor: "#E0F2FE",
                      borderRadius: 16,
                      padding: "3px 8px",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ fontSize: 9.5, color: "#0284C7" }}>✏</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#0284C7" }}>Compose</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10, color: "#475569" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <IconMail size={11} color="#64748B" />
                        Inbox
                      </span>
                      <span style={{ fontWeight: 700, color: "#0F172A" }}>12</span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: 10,
                        backgroundColor: "#F3E8FF",
                        color: "#635BFF",
                        padding: "2px 6px",
                        borderRadius: 6,
                        fontWeight: 700,
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span>🗎</span>
                        Drafts
                      </span>
                      <span>3</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#475569" }}>
                      <span style={{ fontSize: 9 }}>➤</span>
                      Sent
                    </div>
                  </div>
                </div>
              </div>

              {/* Feature Checkmarks */}
              <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155" }}>
                  <IconCheck size={15} color="#166534" stroke={3} />
                  <span>Real-time thread sync via Google APIs</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155" }}>
                  <IconCheck size={15} color="#166534" stroke={3} />
                  <span>Create and edit drafts in Gmail</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155" }}>
                  <IconCheck size={15} color="#166534" stroke={3} />
                  <span>User-authorized sending via Google SMTP/API</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155" }}>
                  <IconCheck size={15} color="#166534" stroke={3} />
                  <span>Google API Services Limited Use policy</span>
                </div>
              </div>
            </div>

            <div>
              {/* Scopes Pill Bar */}
              <div
                style={{
                  backgroundColor: "#F1F5F9",
                  borderRadius: 8,
                  padding: "8px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 14,
                  fontSize: 11.5,
                  overflowX: "auto",
                }}
              >
                <span style={{ fontWeight: 700, color: "#334155" }}>OAuth scopes</span>
                <span style={{ color: "#CBD5E1" }}>|</span>
                <span style={{ fontFamily: "monospace", color: "#635BFF", fontWeight: 600 }}>gmail.modify</span>
                <span style={{ fontFamily: "monospace", color: "#635BFF", fontWeight: 600 }}>gmail.send</span>
              </div>

              {/* Documentation Link */}
              <Link
                href="/docs/connect-gmail"
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "#635BFF",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span>View setup documentation</span>
                <IconArrowUpRight size={14} />
              </Link>
            </div>
          </div>

          {/* Card 2: Microsoft 365 & Outlook */}
          <div
            style={{
              backgroundColor: "#FAFAFA",
              border: "1px solid #E2E8F0",
              borderRadius: 20,
              padding: "26px 24px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 4px 18px rgba(0, 0, 0, 0.03)",
            }}
          >
            <div>
              {/* Card Header with Mini Inbox */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                {/* Provider Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <img
                      src="/logos/outlook.png"
                      alt="Outlook"
                      style={{ width: 26, height: 26, objectFit: "contain" }}
                    />
                    <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", margin: 0 }}>
                      Microsoft 365 &amp; Outlook
                    </h3>
                  </div>

                  <span
                    style={{
                      display: "inline-block",
                      backgroundColor: "#DCFCE7",
                      color: "#166534",
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 12,
                      padding: "2px 10px",
                      marginBottom: 12,
                    }}
                  >
                    Native · Production ready
                  </span>

                  <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.5, margin: "0 0 16px" }}>
                    Microsoft Graph connects Microsoft 365, Exchange Online and Outlook.
                  </p>
                </div>

                {/* Right Mini Outlook UI Card */}
                <div
                  style={{
                    width: 150,
                    backgroundColor: "#FFFFFF",
                    borderRadius: 12,
                    border: "1px solid #E2E8F0",
                    boxShadow: "0 6px 18px rgba(0, 0, 0, 0.05)",
                    padding: "10px 12px",
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 10, color: "#94A3B8" }}>☰</span>
                    <img src="/logos/outlook.png" alt="Outlook" style={{ width: 13, height: 13, objectFit: "contain" }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#0F172A" }}>Outlook</span>
                  </div>

                  <div
                    style={{
                      backgroundColor: "#E0F2FE",
                      borderRadius: 16,
                      padding: "3px 8px",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ fontSize: 10, color: "#0284C7" }}>+</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#0284C7" }}>New mail</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10, color: "#475569" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <IconMail size={11} color="#64748B" />
                        Inbox
                      </span>
                      <span style={{ fontWeight: 700, color: "#0F172A" }}>18</span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        fontSize: 10,
                        backgroundColor: "#E0F2FE",
                        color: "#0369A1",
                        padding: "2px 6px",
                        borderRadius: 6,
                        fontWeight: 700,
                        gap: 4,
                      }}
                    >
                      <span style={{ fontSize: 9.5 }}>👥</span>
                      Shared inbox
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#475569" }}>
                      <span style={{ fontSize: 9.5 }}>🗎</span>
                      Drafts
                    </div>
                  </div>
                </div>
              </div>

              {/* Feature Checkmarks */}
              <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155" }}>
                  <IconCheck size={15} color="#166534" stroke={3} />
                  <span>Delegated OAuth 2.0 and optional admin consent</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155" }}>
                  <IconCheck size={15} color="#166534" stroke={3} />
                  <span>Draft in Outlook on web and desktop</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155" }}>
                  <IconCheck size={15} color="#166534" stroke={3} />
                  <span>Support for shared mailboxes and distribution groups</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155" }}>
                  <IconCheck size={15} color="#166534" stroke={3} />
                  <span>AES-256 envelope encryption for tokens</span>
                </div>
              </div>
            </div>

            <div>
              {/* Scopes Pill Bar */}
              <div
                style={{
                  backgroundColor: "#F1F5F9",
                  borderRadius: 8,
                  padding: "8px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 14,
                  fontSize: 11.5,
                  overflowX: "auto",
                }}
              >
                <span style={{ fontWeight: 700, color: "#334155" }}>OAuth scopes</span>
                <span style={{ color: "#CBD5E1" }}>|</span>
                <span style={{ fontFamily: "monospace", color: "#635BFF", fontWeight: 600 }}>Mail.ReadWrite</span>
                <span style={{ fontFamily: "monospace", color: "#635BFF", fontWeight: 600 }}>Mail.Send</span>
                <span style={{ fontFamily: "monospace", color: "#635BFF", fontWeight: 600 }}>User.Read</span>
              </div>

              {/* Documentation Link */}
              <Link
                href="/docs/connect-outlook"
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "#635BFF",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span>View setup documentation</span>
                <IconArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          SECTION 4: QDRANT VECTOR DATABASE (INFRASTRUCTURE)
          ========================================================= */}
      <section
        id="infrastructure"
        style={{
          padding: "56px 24px 64px",
          maxWidth: 1180,
          margin: "0 auto",
          borderTop: "1px solid #F1F5F9",
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
          {/* Left Visual: 3D Qdrant Glowing Particle Cube */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              borderRadius: 20,
              overflow: "hidden",
            }}
          >
            <img
              src="/integrations/qdrant-vector-cube.png"
              alt="Qdrant Vector Database"
              style={{
                width: "100%",
                maxWidth: 480,
                height: "auto",
                display: "block",
                objectFit: "contain",
              }}
            />
          </div>

          {/* Right Copy */}
          <div>
            <h2
              style={{
                fontSize: "clamp(24px, 3vw, 34px)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: "#0F172A",
                margin: "0 0 6px",
              }}
            >
              Qdrant Vector Database
            </h2>

            <div style={{ fontSize: 13.5, fontWeight: 600, color: "#64748B", marginBottom: 14 }}>
              Core infrastructure · AI &amp; vector search
            </div>

            <p style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "0 0 18px", lineHeight: 1.45 }}>
              Find source passages in your company&apos;s PDFs, CSV catalogs and FAQs.
            </p>

            {/* Checkmarks */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#334155" }}>
                <IconCheck size={16} color="#166534" stroke={3} />
                <span>Workspace-isolated collections and namespace filtering</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#334155" }}>
                <IconCheck size={16} color="#166534" stroke={3} />
                <span>Sub-20 ms cosine retrieval across millions of passages</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#334155" }}>
                <IconCheck size={16} color="#166534" stroke={3} />
                <span>Queried during inference, with no foundation-model training</span>
              </div>
            </div>

            {/* Deployment Badge Bar */}
            <div
              style={{
                backgroundColor: "#F1F5F9",
                borderRadius: 8,
                padding: "8px 12px",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 16,
                fontSize: 11.5,
              }}
            >
              <span style={{ fontWeight: 700, color: "#334155" }}>Deployment</span>
              <span style={{ color: "#CBD5E1" }}>|</span>
              <span style={{ fontFamily: "monospace", color: "#475569", fontWeight: 600 }}>
                Managed VPC · Isolated tenant collections
              </span>
            </div>

            <br />

            {/* Link */}
            <Link
              href="/docs/business-knowledge"
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: "#635BFF",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span>View setup documentation</span>
              <IconArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================
          SECTION 5: CUSTOM WEBHOOKS & REST API (DEVELOPER API)
          ========================================================= */}
      <section
        id="developer-api"
        style={{
          padding: "56px 24px 64px",
          maxWidth: 1180,
          margin: "0 auto",
          borderTop: "1px solid #F1F5F9",
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
          {/* Left Copy */}
          <div>
            <h2
              style={{
                fontSize: "clamp(24px, 3vw, 34px)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: "#0F172A",
                margin: "0 0 6px",
              }}
            >
              Custom Webhooks &amp; REST API
            </h2>

            <div style={{ fontSize: 13.5, fontWeight: 600, color: "#64748B", marginBottom: 14 }}>
              Developer platform · Production ready
            </div>

            <p style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "0 0 18px", lineHeight: 1.45 }}>
              Sync events with your CRM, ERP or internal backend.
            </p>

            {/* Checkmarks */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#334155" }}>
                <IconCheck size={16} color="#166534" stroke={3} />
                <span>HMAC-SHA256 signatures on inbound and outbound payloads</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#334155" }}>
                <IconCheck size={16} color="#166534" stroke={3} />
                <span>Configurable retries with exponential backoff</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#334155" }}>
                <IconCheck size={16} color="#166534" stroke={3} />
                <span>Map payloads to Salesforce, HubSpot or internal systems</span>
              </div>
            </div>

            {/* Authentication Badge Bar */}
            <div
              style={{
                backgroundColor: "#F1F5F9",
                borderRadius: 8,
                padding: "8px 12px",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 16,
                fontSize: 11.5,
              }}
            >
              <span style={{ fontWeight: 700, color: "#334155" }}>Authentication</span>
              <span style={{ color: "#CBD5E1" }}>|</span>
              <span style={{ fontFamily: "monospace", color: "#475569", fontWeight: 600 }}>
                Workspace API key · Bearer authentication
              </span>
            </div>

            <br />

            {/* Link */}
            <Link
              href="/docs"
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: "#635BFF",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span>View setup documentation</span>
              <IconArrowUpRight size={14} />
            </Link>
          </div>

          {/* Right Visual: 3D Webhook Glass Terminal Plaque */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              borderRadius: 20,
              overflow: "hidden",
            }}
          >
            <img
              src="/integrations/webhook-glass-card.png"
              alt="Custom Webhooks & REST API Event Delivery"
              style={{
                width: "100%",
                maxWidth: 480,
                height: "auto",
                display: "block",
                objectFit: "contain",
              }}
            />
          </div>
        </div>
      </section>

      {/* =========================================================
          SECTION 6: ACCESS & POLICIES
          ========================================================= */}
      <section
        id="access-policies"
        style={{
          padding: "56px 24px 72px",
          maxWidth: 1180,
          margin: "0 auto",
          borderTop: "1px solid #F1F5F9",
        }}
      >
        <h2
          style={{
            fontSize: "clamp(24px, 3vw, 34px)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "#0F172A",
            margin: "0 0 32px",
          }}
        >
          Access &amp; policies
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 36,
            alignItems: "start",
          }}
        >
          {/* Column 1: Instant revocation */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: "#F3E8FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <IconLock size={20} color="#635BFF" stroke={2} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>
                Instant revocation
              </h3>
              <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.5, margin: 0 }}>
                Disconnect in workspace settings to revoke access and purge stored tokens.
              </p>
            </div>
          </div>

          {/* Column 2: Google Limited Use */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: "#F3E8FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <IconShieldCheck size={20} color="#635BFF" stroke={2} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>
                Google Limited Use
              </h3>
              <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.5, margin: 0 }}>
                Email data is never shared with advertisers or used to train third-party AI models.
              </p>
            </div>
          </div>

          {/* Column 3: Legal integration terms */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: "#F3E8FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <IconArrowUpRight size={20} color="#635BFF" stroke={2.5} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>
                Legal integration terms
              </h3>
              <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.5, margin: "0 0 8px" }}>
                Review the terms governing mailbox connections.
              </p>
              <Link
                href="/terms"
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "#635BFF",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <span>Terms of Service</span>
                <IconArrowUpRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          SECTION 7: CLOSING CTA (FULL DEVICE WIDTH - ZERO PADDING)
          ========================================================= */}
      <section
        style={{
          position: "relative",
          width: "100%",
          overflow: "hidden",
          margin: 0,
          padding: 0,
          backgroundColor: "#F7F2FE",
        }}
      >
        {/* Applied directly in parent section - covers 100% full width of device */}
        <img
          src="/integrations/connectors-cta-cable.jpg"
          alt="Connect your team mailbox now"
          style={{
            width: "100%",
            height: "auto",
            display: "block",
            objectFit: "cover",
          }}
        />

        {/* Typography overlaid directly in parent section */}
        <div
          className="connectors-cta-copy"
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
              margin: "0 0 20px",
              lineHeight: 1.15,
            }}
          >
            Connect your team mailbox now
          </h2>

          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
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
                padding: "11px 26px",
                borderRadius: 8,
                textDecoration: "none",
                boxShadow: "0 4px 14px rgba(99, 91, 255, 0.35)",
                transition: "all 140ms ease",
              }}
            >
              <span>Get Started</span>
              <IconArrowRight size={16} stroke={2.5} />
            </Link>

            <Link
              href="/demo"
              style={{
                fontSize: 14.5,
                fontWeight: 700,
                color: "#635BFF",
                textDecoration: "none",
                borderBottom: "1.5px solid #DDD6FE",
                paddingBottom: 2,
                transition: "all 140ms ease",
              }}
            >
              Request Demo
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
