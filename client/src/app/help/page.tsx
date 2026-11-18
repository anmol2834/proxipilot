import type { Metadata } from "next";
import Link from "next/link";
import { GlobalNavbar } from "@/components/navigation/GlobalNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { HelpCenterClient } from "@/components/help/HelpCenterClient";
import { IconLifebuoy, IconHeadset, IconBook, IconArrowRight } from "@tabler/icons-react";

export const metadata: Metadata = {
  title: "Help Center & Documentation Hub — ProxiPilot",
  description:
    "Find setup guides, troubleshooting steps, mailbox connection tutorials, and contact support for ProxiPilot.",
  alternates: { canonical: "https://proxipilot.com/help" },
};

export default function HelpCenterPage() {
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
              <IconLifebuoy size={14} />
              ProxiPilot Help Center
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
              How can we help your team today?
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
              Search our verified setup guides, explore technical integration tutorials, or reach out to our engineering support desk.
            </p>
          </div>
        </section>

        {/* Content Section */}
        <section style={{ padding: "56px 24px 64px" }}>
          <HelpCenterClient />
        </section>

        {/* Support Banner */}
        <section
          style={{
            padding: "44px 24px",
            backgroundColor: "#F8FAFC",
            borderTop: "1px solid #E2E8F0",
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", marginBottom: 6 }}>
              Couldn&apos;t find what you were looking for?
            </h3>
            <p style={{ fontSize: 14, color: "#64748B", marginBottom: 20 }}>
              Our engineering support team is available during standard business hours (09:00 - 18:00 EST).
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link
                href="/support"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 20px",
                  borderRadius: 8,
                  backgroundColor: "#2563EB",
                  color: "#FFFFFF",
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                <IconHeadset size={16} /> Open Support Ticket
              </Link>
              <Link
                href="/docs"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 20px",
                  borderRadius: 8,
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #CBD5E1",
                  color: "#0F172A",
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                <IconBook size={16} /> Browse Full Docs
              </Link>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
