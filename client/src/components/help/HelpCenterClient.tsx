"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  IconSearch,
  IconBook,
  IconMailForward,
  IconCpu,
  IconDatabase,
  IconReceipt,
  IconAlertCircle,
  IconArrowRight,
  IconHeadset,
} from "@tabler/icons-react";
import { DOCS_ARTICLES } from "@/data/docs-content";

interface HelpTopic {
  title: string;
  desc: string;
  href: string;
  icon: React.ReactNode;
  articlesCount: number;
}

const TOPICS: HelpTopic[] = [
  {
    title: "Quick Start & Setup",
    desc: "First-time workspace onboarding, user invitations, and basic copilot settings.",
    href: "/docs/getting-started",
    icon: <IconBook size={24} color="#2563EB" />,
    articlesCount: 4,
  },
  {
    title: "Google & Microsoft Integrations",
    desc: "Connect Gmail or Outlook via OAuth, manage permissions, and re-authenticate mailboxes.",
    href: "/docs/connect-gmail",
    icon: <IconMailForward size={24} color="#0D9488" />,
    articlesCount: 5,
  },
  {
    title: "AI Automation & Prompts",
    desc: "Configure tone guidelines, isolated copilot prompts, and human-in-the-loop review rules.",
    href: "/docs/ai-automation",
    icon: <IconCpu size={24} color="#7C3AED" />,
    articlesCount: 6,
  },
  {
    title: "Knowledge Base & Grounding",
    desc: "Upload PDFs, catalog spreadsheets, and sync website URLs into vector memory.",
    href: "/docs/business-knowledge",
    icon: <IconDatabase size={24} color="#D97706" />,
    articlesCount: 4,
  },
  {
    title: "Billing & Subscriptions",
    desc: "Change plans, download tax invoices via Paddle/Lemon Squeezy, and cancel seats.",
    href: "/pricing",
    icon: <IconReceipt size={24} color="#16A34A" />,
    articlesCount: 3,
  },
  {
    title: "Troubleshooting & Health",
    desc: "Diagnose sync latency, token expiration, Redis queue delays, and error codes.",
    href: "/docs/troubleshooting",
    icon: <IconAlertCircle size={24} color="#E11D48" />,
    articlesCount: 5,
  },
];

export function HelpCenterClient() {
  const [query, setQuery] = useState("");

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const articles = Object.values(DOCS_ARTICLES);
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto" }}>
      {/* Search Input */}
      <div
        style={{
          position: "relative",
          maxWidth: 680,
          margin: "0 auto 48px",
        }}
      >
        <IconSearch
          size={20}
          color="#94A3B8"
          style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)" }}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search documentation, guides, and error codes (e.g. Gmail, vector, OAuth)..."
          style={{
            width: "100%",
            padding: "16px 20px 16px 50px",
            fontSize: 16,
            borderRadius: 12,
            border: "1px solid #CBD5E1",
            outline: "none",
            backgroundColor: "#FFFFFF",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
            boxSizing: "border-box",
          }}
        />

        {/* Live Search Results Dropdown */}
        {query.trim().length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              marginTop: 8,
              backgroundColor: "#FFFFFF",
              borderRadius: 12,
              border: "1px solid #E2E8F0",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
              zIndex: 30,
              maxHeight: 340,
              overflowY: "auto",
              padding: 8,
            }}
          >
            {searchResults.length === 0 ? (
              <div style={{ padding: "16px 20px", fontSize: 14, color: "#64748B" }}>
                No documentation articles match &quot;{query}&quot;. Try searching for &apos;Gmail&apos;, &apos;Outlook&apos;, or &apos;Knowledge&apos;.
              </div>
            ) : (
              searchResults.map((res) => (
                <Link
                  key={res.slug}
                  href={`/docs/${res.slug}`}
                  style={{
                    display: "block",
                    padding: "12px 16px",
                    borderRadius: 8,
                    textDecoration: "none",
                    color: "#0F172A",
                    transition: "background-color 0.1s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8FAFC")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#2563EB", marginBottom: 2 }}>
                    {res.title}
                  </div>
                  <div style={{ fontSize: 12.5, color: "#64748B" }}>{res.description}</div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>

      {/* Category Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 24,
          marginBottom: 48,
        }}
      >
        {TOPICS.map((t, i) => (
          <Link
            key={i}
            href={t.href}
            style={{
              display: "flex",
              flexDirection: "column",
              padding: "24px",
              borderRadius: 14,
              backgroundColor: "#FFFFFF",
              border: "1px solid #E2E8F0",
              textDecoration: "none",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              transition: "transform 0.15s ease, border-color 0.15s ease",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                backgroundColor: "#F8FAFC",
                border: "1px solid #E2E8F0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              {t.icon}
            </div>

            <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>
              {t.title}
            </h3>

            <p style={{ fontSize: 13.5, color: "#64748B", lineHeight: 1.5, margin: "0 0 16px", flex: "1 0 auto" }}>
              {t.desc}
            </p>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: 12,
                borderTop: "1px solid #F1F5F9",
                fontSize: 12.5,
                fontWeight: 600,
                color: "#2563EB",
              }}
            >
              <span>{t.articlesCount} guides</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                Explore <IconArrowRight size={13} />
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Documentation Shortcuts */}
      <div
        style={{
          padding: "28px 32px",
          borderRadius: 14,
          backgroundColor: "#F8FAFC",
          border: "1px solid #E2E8F0",
          marginBottom: 48,
        }}
      >
        <h4 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", marginBottom: 14 }}>
          Popular Guides &amp; Setup Walkthroughs
        </h4>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
          }}
        >
          <Link
            href="/docs/connect-gmail"
            style={{ fontSize: 13.5, color: "#2563EB", textDecoration: "none", fontWeight: 600 }}
          >
            → Connecting Google Workspace &amp; Gmail
          </Link>
          <Link
            href="/docs/connect-outlook"
            style={{ fontSize: 13.5, color: "#2563EB", textDecoration: "none", fontWeight: 600 }}
          >
            → Connecting Microsoft 365 Exchange
          </Link>
          <Link
            href="/docs/business-knowledge"
            style={{ fontSize: 13.5, color: "#2563EB", textDecoration: "none", fontWeight: 600 }}
          >
            → Uploading PDF Catalogs to Vector Memory
          </Link>
          <Link
            href="/docs/manage-drafts"
            style={{ fontSize: 13.5, color: "#2563EB", textDecoration: "none", fontWeight: 600 }}
          >
            → Approving &amp; Sending AI Reply Drafts
          </Link>
        </div>
      </div>
    </div>
  );
}
