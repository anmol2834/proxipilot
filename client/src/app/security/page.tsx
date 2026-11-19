import type { Metadata } from "next";
import Link from "next/link";
import { GlobalNavbar } from "@/components/navigation/GlobalNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import {
  IconShieldLock,
  IconLock,
  IconServer,
  IconEyeOff,
  IconKey,
  IconFileCheck,
  IconArrowRight,
  IconAlertCircle,
  IconBrandGoogle,
  IconBrandWindows,
  IconCheck,
} from "@tabler/icons-react";

export const metadata: Metadata = {
  title: "Security & Trust Center — ProxiPilot",
  description:
    "Enterprise security architecture, encryption standards, OAuth token vaulting, tenant isolation, and zero-training guarantees protecting ProxiPilot customers.",
  alternates: { canonical: "https://proxipilot.com/security" },
};

export default function SecurityTrustCenterPage() {
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
          <div style={{ maxWidth: 880, margin: "0 auto" }}>
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
              <IconShieldLock size={14} />
              Enterprise Security &amp; Trust Center
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
              Built from the ground up for strict corporate data protection.
            </h1>

            <p
              style={{
                fontSize: "clamp(15px, 2vw, 17px)",
                color: "#475569",
                lineHeight: 1.55,
                maxWidth: 720,
                margin: "0 auto",
              }}
            >
              Operating email infrastructure demands uncompromising security. Learn how ProxiPilot safeguards OAuth tokens, enforces multi-tenant isolation, and guarantees zero AI model training.
            </p>
          </div>
        </section>

        {/* 6 Security Pillars Grid */}
        <section style={{ padding: "64px 24px", maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#2563EB",
                marginBottom: 8,
              }}
            >
              Verified Controls
            </div>
            <h2
              style={{
                fontSize: "clamp(24px, 3vw, 32px)",
                fontWeight: 800,
                color: "#0F172A",
                letterSpacing: "-0.02em",
              }}
            >
              Our Core Security Architecture
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 24,
            }}
          >
            {/* Pillar 1 */}
            <div
              style={{
                padding: "28px 24px",
                borderRadius: 14,
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
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
                <IconLock size={22} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>
                End-to-End Cryptography
              </h3>
              <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.55, margin: 0 }}>
                All network transit is protected via mandatory TLS 1.3 with modern cipher suites. Stored data, vector embeddings, and database snapshots are encrypted at rest using industry-standard AES-256 encryption.
              </p>
            </div>

            {/* Pillar 2 */}
            <div
              style={{
                padding: "28px 24px",
                borderRadius: 14,
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  backgroundColor: "#FEF2F2",
                  color: "#DC2626",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <IconEyeOff size={22} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>
                Zero AI Model Training
              </h3>
              <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.55, margin: 0 }}>
                We contractually commit that customer email bodies, sender addresses, attachments, and indexed knowledge documents are NEVER used to train foundational AI models or shared with third parties for fine-tuning.
              </p>
            </div>

            {/* Pillar 3 */}
            <div
              style={{
                padding: "28px 24px",
                borderRadius: 14,
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
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
                <IconServer size={22} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>
                Strict Multi-Tenant Isolation
              </h3>
              <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.55, margin: 0 }}>
                Customer vector knowledge is partitioned in logical namespaces within Qdrant. Database queries enforce tenant-scoped foreign key filtering at the ORM layer, preventing any cross-tenant data leaks.
              </p>
            </div>

            {/* Pillar 4 */}
            <div
              style={{
                padding: "28px 24px",
                borderRadius: 14,
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
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
                <IconKey size={22} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>
                OAuth Token Vaulting
              </h3>
              <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.55, margin: 0 }}>
                Google Workspace and Microsoft 365 OAuth refresh tokens are encrypted using envelope encryption with automated key rotation. Tokens are unsealed only in memory during authenticated synchronization tasks.
              </p>
            </div>

            {/* Pillar 5 */}
            <div
              style={{
                padding: "28px 24px",
                borderRadius: 14,
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  backgroundColor: "#FFFBEB",
                  color: "#D97706",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <IconShieldLock size={22} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>
                Least-Privilege Scopes
              </h3>
              <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.55, margin: 0 }}>
                We request only the minimum required OAuth scopes (e.g. gmail.readonly, gmail.compose). We never request Google Drive ownership, contact deletion, or administrative tenant privileges.
              </p>
            </div>

            {/* Pillar 6 */}
            <div
              style={{
                padding: "28px 24px",
                borderRadius: 14,
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  backgroundColor: "#F0FDFA",
                  color: "#0D9488",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <IconFileCheck size={22} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>
                72-Hour Incident Response
              </h3>
              <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.55, margin: 0 }}>
                We maintain automated infrastructure monitoring and immutable audit logging. In the event of any security incident affecting customer data, verified notice is dispatched within 72 hours per GDPR standards.
              </p>
            </div>
          </div>
        </section>

        {/* Legal & Governance Documents Link Directory */}
        <section
          style={{
            padding: "56px 24px",
            backgroundColor: "#F8FAFC",
            borderTop: "1px solid #E2E8F0",
            borderBottom: "1px solid #E2E8F0",
          }}
        >
          <div style={{ maxWidth: 1160, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0F172A", marginBottom: 8 }}>
                Compliance &amp; Legal Framework
              </h2>
              <p style={{ fontSize: 14, color: "#64748B", margin: 0 }}>
                Explore our formal contractual commitments and legal policies.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 16,
              }}
            >
              {[
                { title: "Data Processing Agreement (DPA)", href: "/dpa", desc: "Standard Contractual Clauses & GDPR compliance" },
                { title: "Subprocessors List", href: "/subprocessors", desc: "List of authorized cloud hosting & vector providers" },
                { title: "Data Retention & Deletion", href: "/data-retention", desc: "Cryptographic erasure upon account closure" },
                { title: "Third-Party Integrations", href: "/integrations", desc: "Authorized Google & Microsoft API terms" },
                { title: "Privacy Request Portal", href: "/privacy-request", desc: "Self-service GDPR data export and erasure" },
              ].map((doc, i) => (
                <Link
                  key={i}
                  href={doc.href}
                  style={{
                    padding: "18px 20px",
                    borderRadius: 12,
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    textDecoration: "none",
                    color: "#0F172A",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>
                      {doc.title}
                    </div>
                    <div style={{ fontSize: 12.5, color: "#64748B" }}>{doc.desc}</div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#2563EB",
                      marginTop: 12,
                    }}
                  >
                    View Document <IconArrowRight size={13} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Responsible Vulnerability Disclosure */}
        <section style={{ padding: "64px 24px", maxWidth: 840, margin: "0 auto" }}>
          <div
            style={{
              padding: "28px 32px",
              borderRadius: 16,
              backgroundColor: "#FFFFFF",
              border: "1px solid #E2E8F0",
              boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
            }}
          >
            <h3 style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", marginBottom: 12 }}>
              Responsible Vulnerability Disclosure
            </h3>
            <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, marginBottom: 16 }}>
              We welcome security researchers and ethical hackers who help us identify vulnerabilities. If you discover a potential security bug in our web application or API endpoints, please report it to our engineering security team:
            </p>
            <div
              style={{
                padding: "12px 18px",
                backgroundColor: "#F1F5F9",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 700,
                color: "#1E293B",
                display: "inline-block",
                marginBottom: 16,
              }}
            >
              security@proxipilot.com
            </div>
            <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
              Please include reproduction steps and avoid testing techniques that could degrade service availability for our customers. We commit to acknowledging reports within 24 business hours.
            </p>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
