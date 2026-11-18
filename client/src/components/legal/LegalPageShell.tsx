import React from "react";
import Link from "next/link";
import { LEGAL_METADATA } from "@/config/legal";
import { LegalNavbar } from "./LegalNavbar";
import { LegalBreadcrumbs } from "./LegalBreadcrumbs";
import { LegalTableOfContents, TocItem } from "./LegalTableOfContents";
import { LandingFooter } from "@/components/landing/LandingFooter";
import {
  IconDownload,
  IconExternalLink,
  IconFileText,
  IconArrowUp,
  IconMail,
  IconShieldCheck,
  IconArrowRight,
} from "@tabler/icons-react";

export interface LegalPageShellProps {
  policyKey: string;
  tocItems: TocItem[];
  children: React.ReactNode;
}

export function LegalPageShell({ policyKey, tocItems, children }: LegalPageShellProps) {
  const policy = LEGAL_METADATA[policyKey];

  if (!policy) {
    return <div>Policy not found</div>;
  }

  const relatedPolicies = (policy.relatedSlugs || [])
    .map((slug) => LEGAL_METADATA[slug])
    .filter(Boolean);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#FAFAFA" }}>
      <LegalNavbar />

      <main style={{ flex: "1 0 auto", width: "100%" }}>
        {/* Compact Document Header */}
        <section
          style={{
            backgroundColor: "#FFFFFF",
            borderBottom: "1px solid #E2E8F0",
            padding: "24px 20px 20px",
          }}
        >
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <LegalBreadcrumbs currentTitle={policy.title} />

            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 16,
              }}
            >
              <div style={{ maxWidth: 760 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: policy.category === "legal" ? "#F1F5F9" : "#EFF6FF",
                      color: policy.category === "legal" ? "#475569" : "#2563EB",
                      border: `1px solid ${policy.category === "legal" ? "#CBD5E1" : "#BFDBFE"}`,
                    }}
                  >
                    {policy.category === "legal" ? "Legal Agreement" : "Trust & Compliance"}
                  </span>
                  <span style={{ fontSize: 12, color: "#94A3B8" }}>•</span>
                  <span style={{ fontSize: 12, color: "#64748B" }}>
                    Effective: {policy.effectiveDate}
                  </span>
                  <span style={{ fontSize: 12, color: "#94A3B8" }}>•</span>
                  <span style={{ fontSize: 12, color: "#64748B" }}>
                    Last Updated: {policy.lastUpdated}
                  </span>
                </div>

                <h1
                  style={{
                    fontSize: "clamp(22px, 3.2vw, 30px)",
                    fontWeight: 800,
                    color: "#0F172A",
                    letterSpacing: "-0.025em",
                    margin: "0 0 6px",
                    lineHeight: 1.25,
                  }}
                >
                  {policy.title}
                </h1>

                <p
                  style={{
                    fontSize: 14,
                    color: "#475569",
                    lineHeight: 1.5,
                    margin: 0,
                  }}
                >
                  {policy.summary}
                </p>
              </div>

              {/* PDF Actions (Terms and Privacy) */}
              {policy.pdfUrl && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                  }}
                >
                  <a
                    href={policy.pdfUrl}
                    download
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "#FFFFFF",
                      backgroundColor: "#2563EB",
                      padding: "6px 12px",
                      borderRadius: 6,
                      textDecoration: "none",
                      transition: "background-color 140ms ease",
                    }}
                  >
                    <IconDownload size={14} stroke={2.2} />
                    <span>Download PDF</span>
                  </a>

                  <a
                    href={policy.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "#334155",
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #CBD5E1",
                      padding: "6px 12px",
                      borderRadius: 6,
                      textDecoration: "none",
                      transition: "all 140ms ease",
                    }}
                  >
                    <IconExternalLink size={14} stroke={2} />
                    <span>View in Browser</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Content Section with Sticky TOC Sidebar */}
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "24px 20px 48px",
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 36,
          }}
          className="legal-content-container"
        >
          {/* Table of Contents */}
          <LegalTableOfContents items={tocItems} />

          {/* Main Legal Content Article */}
          <article
            className="legal-prose-article"
            style={{
              flex: "1 1 0%",
              minWidth: 0,
              maxWidth: 820,
              color: "#1E293B",
              fontSize: 14.5,
              lineHeight: 1.65,
            }}
          >
            {children}

            {/* Official Legal Contact Box */}
            <div
              style={{
                marginTop: 36,
                padding: "16px 20px",
                borderRadius: 10,
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconMail size={17} color="#2563EB" />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>
                  Legal & Privacy Inquiries
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "#475569", lineHeight: 1.5 }}>
                For inquiries regarding this document, contractual terms, or compliance, contact Cheldain
                (operating ProxiPilot) at{" "}
                <a href="mailto:legal@proxipilot.com" style={{ color: "#2563EB", fontWeight: 600, textDecoration: "none" }}>
                  legal@proxipilot.com
                </a>{" "}
                or for privacy matters at{" "}
                <a href="mailto:privacy@proxipilot.com" style={{ color: "#2563EB", fontWeight: 600, textDecoration: "none" }}>
                  privacy@proxipilot.com
                </a>
                .
              </p>
            </div>

            {/* Related Policies Grid */}
            {relatedPolicies.length > 0 && (
              <div style={{ marginTop: 32 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                  <IconFileText size={16} color="#2563EB" />
                  <span style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#64748B" }}>
                    Related Policies & Agreements
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: 12,
                  }}
                >
                  {relatedPolicies.map((rel) => (
                    <Link
                      key={rel.slug}
                      href={`/${rel.slug}`}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        padding: "12px 14px",
                        borderRadius: 8,
                        background: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                        textDecoration: "none",
                        transition: "all 140ms ease",
                      }}
                      className="related-policy-card"
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
                          {rel.shortTitle}
                        </span>
                        <IconArrowRight size={13} color="#94A3B8" />
                      </div>
                      <span
                        style={{
                          fontSize: 11.5,
                          color: "#64748B",
                          lineHeight: 1.4,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {rel.summary}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </article>
        </div>
      </main>

      <LandingFooter />

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .legal-prose-article section {
          margin-bottom: 24px;
          scroll-margin-top: 88px;
        }
        .legal-prose-article h2 {
          font-size: 18px;
          font-weight: 700;
          color: #0F172A;
          letter-spacing: -0.015em;
          margin: 0 0 8px;
          line-height: 1.35;
        }
        .legal-prose-article h3 {
          font-size: 15px;
          font-weight: 600;
          color: #1E293B;
          margin: 12px 0 6px;
          line-height: 1.4;
        }
        .legal-prose-article p {
          margin: 0 0 10px;
          color: #334155;
          line-height: 1.62;
        }
        .legal-prose-article ul,
        .legal-prose-article ol {
          margin: 0 0 12px;
          padding-left: 20px;
          color: #334155;
        }
        .legal-prose-article li {
          margin-bottom: 5px;
          line-height: 1.55;
        }
        .legal-prose-article strong {
          color: #0F172A;
        }
        .legal-prose-article a {
          color: #2563EB;
          text-decoration: none;
        }
        .legal-prose-article a:hover {
          text-decoration: underline;
        }
        .legal-prose-article .legal-callout {
          margin: 14px 0;
          padding: 12px 16px;
          border-radius: 8px;
          background: #EFF6FF;
          border-left: 3px solid #2563EB;
          font-size: 13.5px;
          line-height: 1.55;
          color: #1E3A8A;
        }
        .legal-prose-article .legal-callout-warning {
          margin: 14px 0;
          padding: 12px 16px;
          border-radius: 8px;
          background: #FFFBEB;
          border-left: 3px solid #D97706;
          font-size: 13.5px;
          line-height: 1.55;
          color: #92400E;
        }
        .legal-prose-article table {
          width: 100%;
          border-collapse: collapse;
          margin: 14px 0;
          font-size: 13px;
          background: #FFFFFF;
          border-radius: 6px;
          overflow: hidden;
          border: 1px solid #E2E8F0;
        }
        .legal-prose-article th {
          background: #F8FAFC;
          padding: 9px 12px;
          text-align: left;
          font-weight: 600;
          color: #0F172A;
          border-bottom: 1px solid #E2E8F0;
        }
        .legal-prose-article td {
          padding: 9px 12px;
          border-bottom: 1px solid #F1F5F9;
          color: #334155;
          vertical-align: top;
        }
        .legal-prose-article tr:last-child td {
          border-bottom: none;
        }
        .related-policy-card:hover {
          border-color: #BFDBFE !important;
          background-color: #F8FAFC !important;
          transform: translateY(-1px);
        }
        @media (max-width: 1023px) {
          .legal-content-container {
            flex-direction: column !important;
            gap: 0 !important;
          }
          .legal-prose-article {
            max-width: 100% !important;
          }
        }
      `,
        }}
      />
    </div>
  );
}

