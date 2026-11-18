import type { Metadata } from "next";
import Link from "next/link";
import { GlobalNavbar } from "@/components/navigation/GlobalNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { PartnerInquiryForm } from "@/components/forms/PartnerInquiryForm";
import {
  IconUsers,
  IconBriefcase,
  IconCode,
  IconBuildingSkyscraper,
  IconCheck,
  IconSparkles,
} from "@tabler/icons-react";

export const metadata: Metadata = {
  title: "Partner Program — ProxiPilot",
  description:
    "Partner with ProxiPilot. Grow your agency, build custom integrations, or deliver enterprise email automation with our official partner tracks.",
  alternates: { canonical: "https://proxipilot.com/partners" },
};

export default function PartnersPage() {
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
              <IconUsers size={14} />
              ProxiPilot Partner Ecosystem
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
              Deliver grounded AI email automation to your clients and users.
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
              Whether you are a digital agency automating client workflows, a software vendor integrating via API, or an enterprise consultant delivering modernization, our partner program provides the tools you need.
            </p>
          </div>
        </section>

        {/* 3 Partnership Tracks */}
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
              Three Dedicated Partnership Tracks
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 28,
            }}
          >
            {/* Track 1: Agency Partners */}
            <div
              style={{
                padding: "32px 26px",
                borderRadius: 14,
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
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
                  marginBottom: 18,
                }}
              >
                <IconBriefcase size={22} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>
                Agency &amp; Consultancy Partners
              </h3>
              <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.55, marginBottom: 20 }}>
                Ideal for digital agencies, marketing consultancies, and fractional operations leaders who manage or optimize communications for multiple commercial clients.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "#334155" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <IconCheck size={16} color="#16A34A" /> Multi-tenant workspace management
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <IconCheck size={16} color="#16A34A" /> 20% recurring revenue share on client accounts
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <IconCheck size={16} color="#16A34A" /> Dedicated partner support channel
                </div>
              </div>
            </div>

            {/* Track 2: Technology Partners */}
            <div
              style={{
                padding: "32px 26px",
                borderRadius: 14,
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
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
                  marginBottom: 18,
                }}
              >
                <IconCode size={22} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>
                Technology &amp; Integration Partners
              </h3>
              <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.55, marginBottom: 20 }}>
                Designed for software platforms (CRMs, ticketing systems, ERPs, inventory databases) looking to embed or connect ProxiPilot&apos;s vector grounding capabilities.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "#334155" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <IconCheck size={16} color="#16A34A" /> Sandbox API &amp; webhook access
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <IconCheck size={16} color="#16A34A" /> Co-marketing &amp; joint integration docs
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <IconCheck size={16} color="#16A34A" /> Direct developer access to our engineering team
                </div>
              </div>
            </div>

            {/* Track 3: Solution Integrators */}
            <div
              style={{
                padding: "32px 26px",
                borderRadius: 14,
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
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
                  marginBottom: 18,
                }}
              >
                <IconBuildingSkyscraper size={22} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>
                Enterprise Solution Integrators
              </h3>
              <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.55, marginBottom: 20 }}>
                For systems integrators delivering custom enterprise IT, Microsoft 365 migrations, and SOC 2 compliant email automation for large commercial enterprises.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "#334155" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <IconCheck size={16} color="#16A34A" /> Custom enterprise SLA agreements
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <IconCheck size={16} color="#16A34A" /> Volume wholesale seat pricing
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <IconCheck size={16} color="#16A34A" /> Dedicated solution architect onboarding
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Application Form Section */}
        <section
          style={{
            padding: "60px 24px",
            backgroundColor: "#F8FAFC",
            borderTop: "1px solid #E2E8F0",
          }}
        >
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0F172A", marginBottom: 8 }}>
                Apply to the Partner Program
              </h2>
              <p style={{ fontSize: 14, color: "#64748B", margin: 0 }}>
                Submit your inquiry and our alliances team will get back to you within 2 business days.
              </p>
            </div>

            <div
              style={{
                backgroundColor: "#FFFFFF",
                padding: "32px 28px",
                borderRadius: 16,
                border: "1px solid #E2E8F0",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.03)",
              }}
            >
              <PartnerInquiryForm />
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
