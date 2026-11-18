"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GlobalNavbar } from "@/components/navigation/GlobalNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { DOCS_NAVIGATION, DOCS_ARTICLES, DocSection } from "@/data/docs-content";
import {
  IconBook,
  IconChevronRight,
  IconSearch,
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconMenu2,
  IconX,
} from "@tabler/icons-react";

export interface DocsLayoutProps {
  currentSlug: string;
  title: string;
  description: string;
  category: string;
  updatedAt?: string;
  readTime?: string;
  sections?: DocSection[];
  children: React.ReactNode;
  prevSlug?: string;
  nextSlug?: string;
  relatedSlugs?: string[];
}

export function DocsLayout({
  currentSlug,
  title,
  description,
  category,
  updatedAt = "June 2025",
  readTime = "5 min read",
  sections = [],
  children,
  prevSlug,
  nextSlug,
  relatedSlugs = [],
}: DocsLayoutProps) {
  const pathname = usePathname();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState<"yes" | "no" | null>(null);

  const prevDoc = prevSlug ? (prevSlug === "docs" ? { slug: "docs", title: "Documentation Overview" } : DOCS_ARTICLES[prevSlug]) : null;
  const nextDoc = nextSlug ? DOCS_ARTICLES[nextSlug] : null;
  const relatedArticles = relatedSlugs.map((slug) => DOCS_ARTICLES[slug]).filter(Boolean);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#FFFFFF" }}>
      <GlobalNavbar />

      {/* Docs Header Banner */}
      <div
        style={{
          borderBottom: "1px solid #E2E8F0",
          backgroundColor: "#F8FAFC",
          padding: "16px 24px",
        }}
      >
        <div
          style={{
            maxWidth: 1320,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          {/* Breadcrumbs */}
          <nav
            aria-label="Breadcrumb"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: "#64748B",
            }}
          >
            <Link href="/" style={{ color: "#64748B", textDecoration: "none" }}>
              Home
            </Link>
            <span>/</span>
            <Link href="/docs" style={{ color: "#64748B", textDecoration: "none" }}>
              Documentation
            </Link>
            <span>/</span>
            <span style={{ color: "#0F172A", fontWeight: 600 }}>{category}</span>
          </nav>

          {/* Mobile Sidebar Toggle */}
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            style={{
              display: "none",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: 600,
              color: "#1E293B",
              backgroundColor: "#FFFFFF",
              border: "1px solid #CBD5E1",
              borderRadius: 6,
              cursor: "pointer",
            }}
            className="mobile-docs-toggle"
          >
            {mobileSidebarOpen ? <IconX size={16} /> : <IconMenu2 size={16} />}
            <span>Docs Navigation</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div
        style={{
          flex: "1 0 auto",
          maxWidth: 1320,
          margin: "0 auto",
          width: "100%",
          padding: "28px 24px 60px",
          display: "flex",
          gap: 40,
          alignItems: "flex-start",
        }}
        className="docs-main-container"
      >
        {/* Left Sidebar */}
        <aside
          style={{
            width: 260,
            flexShrink: 0,
            position: "sticky",
            top: 96,
            maxHeight: "calc(100vh - 120px)",
            overflowY: "auto",
            paddingRight: 12,
          }}
          className={`docs-sidebar ${mobileSidebarOpen ? "docs-sidebar-open" : ""}`}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {DOCS_NAVIGATION.map((group) => (
              <div key={group.group}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#64748B",
                    marginBottom: 8,
                  }}
                >
                  {group.group}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {group.items.map((item) => {
                    const isActive = currentSlug === item.slug || pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        style={{
                          fontSize: 13.5,
                          fontWeight: isActive ? 600 : 400,
                          color: isActive ? "#2563EB" : "#334155",
                          backgroundColor: isActive ? "#EFF6FF" : "transparent",
                          padding: "6px 10px",
                          borderRadius: 6,
                          textDecoration: "none",
                          display: "block",
                          transition: "all 120ms ease",
                        }}
                      >
                        {item.title}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Center Main Article */}
        <main
          style={{
            flex: "1 1 0%",
            minWidth: 0,
            maxWidth: 760,
          }}
          className="docs-content-area"
        >
          {/* Header */}
          <div style={{ marginBottom: 24, borderBottom: "1px solid #E2E8F0", paddingBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  padding: "2px 8px",
                  borderRadius: 4,
                  backgroundColor: "#F1F5F9",
                  color: "#475569",
                }}
              >
                {category}
              </span>
              <span style={{ fontSize: 12, color: "#94A3B8" }}>•</span>
              <span style={{ fontSize: 12, color: "#64748B" }}>Updated {updatedAt}</span>
              <span style={{ fontSize: 12, color: "#94A3B8" }}>•</span>
              <span style={{ fontSize: 12, color: "#64748B" }}>{readTime}</span>
            </div>

            <h1
              style={{
                fontSize: "clamp(24px, 3.2vw, 32px)",
                fontWeight: 800,
                color: "#0F172A",
                letterSpacing: "-0.025em",
                margin: "0 0 8px",
                lineHeight: 1.25,
              }}
            >
              {title}
            </h1>

            <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.55, margin: 0 }}>
              {description}
            </p>
          </div>

          {/* Article Body */}
          <article className="docs-prose">{children}</article>

          {/* Feedback Widget */}
          <div
            style={{
              marginTop: 40,
              padding: "16px 20px",
              backgroundColor: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "#0F172A" }}>
                Was this documentation helpful?
              </span>
            </div>
            {feedbackSent ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#166534", fontSize: 13, fontWeight: 600 }}>
                <IconCheck size={16} />
                <span>Thank you for your feedback!</span>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setFeedbackSent("yes")}
                  style={{
                    padding: "5px 12px",
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "#334155",
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #CBD5E1",
                    borderRadius: 5,
                    cursor: "pointer",
                  }}
                >
                  Yes, helpful
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackSent("no")}
                  style={{
                    padding: "5px 12px",
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "#334155",
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #CBD5E1",
                    borderRadius: 5,
                    cursor: "pointer",
                  }}
                >
                  Could be improved
                </button>
              </div>
            )}
          </div>

          {/* Next / Previous Page Links */}
          <div
            style={{
              marginTop: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            {prevDoc ? (
              <Link
                href={prevDoc.slug === "docs" ? "/docs" : `/docs/${prevDoc.slug}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#1E293B",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: 6,
                  textDecoration: "none",
                }}
              >
                <IconArrowLeft size={16} />
                <span>Previous: {prevDoc.title}</span>
              </Link>
            ) : <div />}

            {nextDoc ? (
              <Link
                href={`/docs/${nextDoc.slug}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#FFFFFF",
                  backgroundColor: "#2563EB",
                  borderRadius: 6,
                  textDecoration: "none",
                }}
              >
                <span>Next: {nextDoc.title}</span>
                <IconArrowRight size={16} />
              </Link>
            ) : <div />}
          </div>
        </main>

        {/* Right Sticky On-Page TOC */}
        {sections.length > 0 && (
          <aside
            style={{
              width: 220,
              flexShrink: 0,
              position: "sticky",
              top: 96,
              maxHeight: "calc(100vh - 120px)",
              overflowY: "auto",
            }}
            className="docs-toc"
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#64748B",
                marginBottom: 8,
              }}
            >
              On this page
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {sections.map((sec) => (
                <a
                  key={sec.id}
                  href={`#${sec.id}`}
                  style={{
                    fontSize: 12.5,
                    color: "#64748B",
                    textDecoration: "none",
                    lineHeight: 1.4,
                    transition: "color 120ms ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#2563EB")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#64748B")}
                >
                  {sec.title}
                </a>
              ))}
            </div>
          </aside>
        )}
      </div>

      <LandingFooter />

      {/* Docs Styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .docs-prose section {
          margin-bottom: 28px;
          scroll-margin-top: 80px;
        }
        .docs-prose h2 {
          font-size: 19px;
          font-weight: 700;
          color: #0F172A;
          margin: 0 0 10px;
          padding-bottom: 6px;
          border-bottom: 1px solid #F1F5F9;
        }
        .docs-prose h3 {
          font-size: 15px;
          font-weight: 600;
          color: #1E293B;
          margin: 14px 0 6px;
        }
        .docs-prose p {
          font-size: 14.5px;
          color: #334155;
          line-height: 1.62;
          margin: 0 0 12px;
        }
        .docs-prose ul, .docs-prose ol {
          margin: 0 0 14px;
          padding-left: 20px;
          font-size: 14px;
          color: #334155;
        }
        .docs-prose li {
          margin-bottom: 5px;
          line-height: 1.55;
        }
        .docs-prose code {
          font-family: monospace;
          background: #F1F5F9;
          padding: 2px 5px;
          border-radius: 4px;
          font-size: 13px;
          color: #0F172A;
        }
        .docs-prose a {
          color: #2563EB;
          text-decoration: underline;
        }
        @media (max-width: 1024px) {
          .docs-toc {
            display: none !important;
          }
        }
        @media (max-width: 768px) {
          .docs-sidebar {
            display: none !important;
          }
          .docs-sidebar.docs-sidebar-open {
            display: block !important;
            position: fixed !important;
            top: 68px !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100% !important;
            max-height: calc(100vh - 68px) !important;
            background: #FFFFFF !important;
            z-index: 999 !important;
            padding: 20px !important;
          }
          .mobile-docs-toggle {
            display: inline-flex !important;
          }
          .docs-main-container {
            padding: 20px 16px 40px !important;
          }
        }
      `,
        }}
      />
    </div>
  );
}
