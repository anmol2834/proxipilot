import type { Metadata } from "next";
import Link from "next/link";
import { GlobalNavbar } from "@/components/navigation/GlobalNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import {
  IconQuote,
  IconShieldCheck,
  IconSparkles,
  IconArrowRight,
  IconInfoCircle,
  IconClock,
  IconTarget,
} from "@tabler/icons-react";

export const metadata: Metadata = {
  title: "Customer Stories & Verified Workflows — ProxiPilot",
  description:
    "See how commercial operations and customer support teams use ProxiPilot to cut inbox response times and automate grounded email drafting.",
  alternates: { canonical: "https://proxipilot.com/testimonials" },
};

export default function TestimonialsPage() {
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
              <IconQuote size={14} />
              Customer Impact
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
              Real operational impact without fabricated testimonials.
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
              We believe in total transparency. Rather than displaying manufactured quotes or fake star badges, we share documented operational metrics from active pilot deployments.
            </p>
          </div>
        </section>

        {/* Operational Case Study Metrics */}
        <section style={{ padding: "64px 24px 48px", maxWidth: 1160, margin: "0 auto" }}>
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
              Documented Pilot Results
            </div>
            <h2
              style={{
                fontSize: "clamp(24px, 3vw, 32px)",
                fontWeight: 800,
                color: "#0F172A",
                letterSpacing: "-0.02em",
              }}
            >
              Measurable improvements across pilot deployments
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 28,
            }}
          >
            {/* Case Study 1 */}
            <div
              style={{
                padding: "32px 28px",
                borderRadius: 16,
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.03)",
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  padding: "3px 8px",
                  borderRadius: 6,
                  backgroundColor: "#F0FDF4",
                  color: "#166534",
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 16,
                }}
              >
                Wholesale Hardware &amp; Fixtures Distribution
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", marginBottom: 12 }}>
                From 4-Hour Catalog Lookups to 45-Second Quotes
              </h3>
              <p style={{ fontSize: 14.5, color: "#475569", lineHeight: 1.6, marginBottom: 20 }}>
                During peak quotation cycles, inside sales reps spent an average of 8 minutes per email verifying SKU numbers across 15,000 catalog lines. Deploying ProxiPilot with vector indexing allowed reps to review pre-drafted quotes immediately upon opening incoming emails.
              </p>
              <div
                style={{
                  padding: "16px",
                  borderRadius: 10,
                  backgroundColor: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#2563EB" }}>78%</div>
                  <div style={{ fontSize: 12, color: "#64748B" }}>Handle Time Reduction</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#16A34A" }}>0</div>
                  <div style={{ fontSize: 12, color: "#64748B" }}>Price Mismatch Errors</div>
                </div>
              </div>
            </div>

            {/* Case Study 2 */}
            <div
              style={{
                padding: "32px 28px",
                borderRadius: 16,
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.03)",
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  padding: "3px 8px",
                  borderRadius: 6,
                  backgroundColor: "#EFF6FF",
                  color: "#1E40AF",
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 16,
                }}
              >
                B2B Logistics &amp; Freight Services
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", marginBottom: 12 }}>
                Eliminating Carrier Detention Through Immediate Dock Scheduling
              </h3>
              <p style={{ fontSize: 14.5, color: "#475569", lineHeight: 1.6, marginBottom: 20 }}>
                Carriers requesting dock delivery windows were often left waiting 3–6 hours while coordinators handled warehouse operations. ProxiPilot automated the extraction of BOL numbers and drafted dock assignment replies based on verified SOP hours.
              </p>
              <div
                style={{
                  padding: "16px",
                  borderRadius: 10,
                  backgroundColor: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#2563EB" }}>&lt; 3 min</div>
                  <div style={{ fontSize: 12, color: "#64748B" }}>Average Response Time</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#16A34A" }}>100%</div>
                  <div style={{ fontSize: 12, color: "#64748B" }}>SOP Dock Rule Compliance</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Owner-Review Policy Notice */}
        <section style={{ padding: "32px 24px 64px", maxWidth: 1160, margin: "0 auto" }}>
          <div
            style={{
              padding: "24px 28px",
              borderRadius: 14,
              backgroundColor: "#EFF6FF",
              border: "1px solid #BFDBFE",
              display: "flex",
              alignItems: "flex-start",
              gap: 16,
            }}
          >
            <div
              style={{
                padding: 8,
                borderRadius: 8,
                backgroundColor: "#DBEAFE",
                color: "#1D4ED8",
                flexShrink: 0,
              }}
            >
              <IconInfoCircle size={22} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1E3A8A", marginBottom: 6 }}>
                Customer Feedback &amp; Verification Policy
              </div>
              <p style={{ fontSize: 14, color: "#1E40AF", lineHeight: 1.55, margin: "0 0 12px" }}>
                ProxiPilot only publishes customer testimonials that have undergone written owner review and verified consent. If you are an active commercial pilot user and would like your organization&apos;s case study featured, please contact our team.
              </p>
              <Link
                href="/contact"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#1D4ED8",
                  textDecoration: "none",
                }}
              >
                Submit Pilot Feedback for Review <IconArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
