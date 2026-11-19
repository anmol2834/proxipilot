import type { Metadata } from "next";
import Link from "next/link";
import { GlobalNavbar } from "@/components/navigation/GlobalNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import {
  IconBuildingStore,
  IconTrendingUp,
  IconHeadset,
  IconShoppingCart,
  IconCode,
  IconBriefcase,
  IconBuildingCommunity,
  IconTruckDelivery,
  IconAdjustmentsAlt,
  IconArrowRight,
  IconSparkles,
} from "@tabler/icons-react";

export const metadata: Metadata = {
  title: "Industry & Team Solutions — ProxiPilot Email Automation",
  description:
    "Explore tailored email automation workflows for Customer Support, Sales Teams, Wholesale Distributors, E-commerce, SaaS, Agencies, and Operations.",
  alternates: { canonical: "https://proxipilot.com/solutions" },
};

const SOLUTIONS_DIRECTORY = [
  {
    slug: "small-business",
    title: "Small Businesses",
    tagline: "Solo founders & small teams managing daily customer inquiries.",
    icon: <IconBuildingStore size={24} color="#2563EB" />,
    painPoint: "Founders spend 3 hours every morning answering repetitive questions instead of building their business.",
    workflow: "Connect one mailbox, upload your product FAQ, and receive pre-drafted replies ready to approve in 3 seconds.",
  },
  {
    slug: "sales-teams",
    title: "Sales Teams",
    tagline: "Inbound SDRs & Account Executives accelerating lead velocity.",
    icon: <IconTrendingUp size={24} color="#2563EB" />,
    painPoint: "Lead qualification decays by 80% if inbound prospect emails are not answered within 15 minutes.",
    workflow: "ProxiPilot identifies buying intent, tags hot prospects, and drafts customized qualification pitches immediately.",
  },
  {
    slug: "customer-support",
    title: "Customer Support",
    tagline: "Support agents deflecting repetitive tickets with zero hallucinations.",
    icon: <IconHeadset size={24} color="#2563EB" />,
    painPoint: "Support queues drown under identical questions regarding returns, shipping windows, and login resets.",
    workflow: "Vector RAG retrieves verified help center documentation and drafts empathetic answers held for one-click review.",
  },
  {
    slug: "ecommerce",
    title: "E-commerce Brands",
    tagline: "Direct-to-consumer stores managing seasonal order inquiries.",
    icon: <IconShoppingCart size={24} color="#2563EB" />,
    painPoint: "Holiday order surges lead to angry customer chargebacks and delayed response times.",
    workflow: "Automate policy delivery, exchange procedures, and size-guide recommendations with strict grounding.",
  },
  {
    slug: "saas-companies",
    title: "SaaS Companies",
    tagline: "Product-led software companies converting trials and handling bugs.",
    icon: <IconCode size={24} color="#2563EB" />,
    painPoint: "Technical inquiries and API questions overwhelm engineers, stalling high-value enterprise trial signups.",
    workflow: "Index developer documentation and release notes to pre-draft accurate technical answers for customer success teams.",
  },
  {
    slug: "agencies",
    title: "Agencies & Consultancies",
    tagline: "Client services firms managing multiple brand inboxes concurrently.",
    icon: <IconBriefcase size={24} color="#2563EB" />,
    painPoint: "Account managers struggle to switch between distinct client brand tones without making tone errors.",
    workflow: "Enforce separate tone rules and knowledge collections per connected client inbox to guarantee white-glove consistency.",
  },
  {
    slug: "b2b-businesses",
    title: "B2B Enterprises",
    tagline: "Commercial organizations managing complex relationship threads.",
    icon: <IconBuildingCommunity size={24} color="#2563EB" />,
    painPoint: "Long sales cycles and multiple stakeholders cause context to be lost across 40-message email chains.",
    workflow: "Thread memory retains historical negotiation terms, commitments, and past agreed deliverables automatically.",
  },
  {
    slug: "wholesale-businesses",
    title: "Wholesale & Distribution",
    tagline: "Distributors handling large SKU catalogues and volume RFQ quotes.",
    icon: <IconTruckDelivery size={24} color="#2563EB" />,
    painPoint: "Manually cross-referencing ERP tables for 20,000 SKUs creates quoting delays of 2-3 business days.",
    workflow: "Auto-extract SKU codes, pull bulk tier pricing and packaging specifications, and draft formal quotation emails in minutes.",
  },
  {
    slug: "operations-teams",
    title: "Operations Teams",
    tagline: "Logistics managers and internal operations processing vendor traffic.",
    icon: <IconAdjustmentsAlt size={24} color="#2563EB" />,
    painPoint: "Operational dispatchers lose critical supplier updates among hundreds of unread administrative notifications.",
    workflow: "Categorize inbound vendor invoices, shipping confirmations, and inventory warnings into prioritized triage queues.",
  },
];

export default function SolutionsOverviewPage() {
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
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
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
                marginBottom: 16,
              }}
            >
              Tailored Email Workflows
            </div>
            <h1
              style={{
                fontSize: "clamp(30px, 4.2vw, 46px)",
                fontWeight: 800,
                color: "#0F172A",
                letterSpacing: "-0.03em",
                lineHeight: 1.2,
                margin: "0 0 16px",
              }}
            >
              Built for your industry. <br />
              Configured for your team.
            </h1>
            <p
              style={{
                fontSize: "clamp(15px, 1.8vw, 17px)",
                color: "#475569",
                lineHeight: 1.6,
                margin: "0 auto",
                maxWidth: 680,
              }}
            >
              Every business communicates differently. Explore how ProxiPilot adapts knowledge retrieval, intent parsing, and review safeguards to your exact operational reality.
            </p>
          </div>
        </section>

        {/* Directory Grid */}
        <section style={{ padding: "56px 24px", maxWidth: 1200, margin: "0 auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
              gap: 24,
            }}
          >
            {SOLUTIONS_DIRECTORY.map((sol) => (
              <Link
                key={sol.slug}
                href={`/solutions/${sol.slug}`}
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: 12,
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  textDecoration: "none",
                  transition: "all 140ms ease",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                }}
                className="solution-card"
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        backgroundColor: "#EFF6FF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {sol.icon}
                    </div>
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: 0 }}>
                        {sol.title}
                      </h3>
                      <div style={{ fontSize: 12.5, color: "#64748B", marginTop: 2 }}>{sol.tagline}</div>
                    </div>
                  </div>

                  <div style={{ margin: "14px 0", fontSize: 13, lineHeight: 1.55 }}>
                    <div style={{ color: "#991B1B", marginBottom: 6 }}>
                      <strong>Challenge:</strong> {sol.painPoint}
                    </div>
                    <div style={{ color: "#166534" }}>
                      <strong>ProxiPilot Workflow:</strong> {sol.workflow}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    borderTop: "1px solid #F1F5F9",
                    paddingTop: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    color: "#2563EB",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <span>Explore Workflow &amp; Scenarios</span>
                  <IconArrowRight size={15} />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{ backgroundColor: "#F8FAFC", borderTop: "1px solid #E2E8F0", padding: "48px 24px", textAlign: "center" }}>
          <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0F172A", margin: "0 0 10px" }}>
              Don&rsquo;t see your specific industry?
            </h2>
            <p style={{ fontSize: 14, color: "#64748B", margin: "0 0 20px" }}>
              ProxiPilot&rsquo;s RAG vector engine indexes any structured corporate document. Talk to our solutions team for a custom configuration.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
              <Link
                href="/contact"
                style={{
                  padding: "9px 18px",
                  fontSize: 13.5,
                  fontWeight: 600,
                  backgroundColor: "#2563EB",
                  color: "#FFFFFF",
                  borderRadius: 6,
                  textDecoration: "none",
                }}
              >
                Schedule Solution Consultation
              </Link>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .solution-card:hover {
          border-color: #BFDBFE !important;
          transform: translateY(-2px);
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.06) !important;
        }
      `,
        }}
      />
    </div>
  );
}
