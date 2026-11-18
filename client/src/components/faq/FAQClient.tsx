"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  IconSearch,
  IconChevronDown,
  IconChevronUp,
  IconQuestionMark,
  IconMailForward,
  IconSparkles,
  IconShieldLock,
  IconReceipt,
  IconBook,
  IconArrowRight,
} from "@tabler/icons-react";

interface FAQItem {
  id: string;
  category: "general" | "features" | "integrations" | "knowledge" | "security" | "pricing";
  question: string;
  answer: string | React.ReactNode;
}

const FAQ_DATA: FAQItem[] = [
  // General
  {
    id: "what-is-proxipilot",
    category: "general",
    question: "What is ProxiPilot and how does it work?",
    answer: (
      <span>
        ProxiPilot is an enterprise AI email copilot and automation platform. It connects to your existing email inbox
        (Google Workspace or Microsoft 365) and indexes your company&apos;s product catalogs, internal knowledge bases, and
        service documentation. When customer inquiries arrive, ProxiPilot retrieves grounded factual context and generates
        production-grade draft replies for human review or automated delivery.
      </span>
    ),
  },
  {
    id: "replace-email-client",
    category: "general",
    question: "Does ProxiPilot replace my current email client or inbox?",
    answer: (
      <span>
        No. ProxiPilot is not a separate email provider. You continue using Gmail or Outlook just as you do today. ProxiPilot
        works alongside your workflow via OAuth API synchronization, drafting responses directly into your drafts folder or
        providing an isolated triage copilot inside the ProxiPilot dashboard.
      </span>
    ),
  },
  {
    id: "human-in-the-loop",
    category: "general",
    question: "Does ProxiPilot send emails automatically without my review?",
    answer: (
      <span>
        By default, ProxiPilot operates in <strong>Human-in-the-Loop Review Mode</strong>. All generated responses are created
        as drafts requiring human approval or one-click sending. You can selectively enable autonomous auto-sending only for
        specific high-confidence routine scenarios (e.g., standard business hour questions, order tracking inquiries).
      </span>
    ),
  },

  // Features & AI Copilot
  {
    id: "ai-hallucinations",
    category: "features",
    question: "How does ProxiPilot prevent AI hallucinations and fabricated details?",
    answer: (
      <span>
        Unlike generic chatbots that guess when they lack data, ProxiPilot enforces <strong>evidence-gated retrieval</strong>.
        Before an LLM generates a response, our vector retrieval engine searches your verified company documentation in Qdrant.
        If verified facts are not found, ProxiPilot explicitly flags the missing information (e.g., &quot;Product code DSDR0099
        not found in catalog&quot;) rather than inventing prices or specifications.
      </span>
    ),
  },
  {
    id: "isolated-thread-copilot",
    category: "features",
    question: "What is the Isolated AI Reply Copilot?",
    answer: (
      <span>
        The Isolated Copilot focuses exclusively on the currently open email thread. It evaluates the exact sender, incoming
        attachments, quotation requests, and past conversation history in that specific thread without cross-pollinating
        confidential context from unrelated client threads.
      </span>
    ),
  },
  {
    id: "tone-tuning",
    category: "features",
    question: "Can I customize the tone and style of generated drafts?",
    answer: (
      <span>
        Yes. You can configure company-wide voice guidelines (e.g., formal corporate, warm &amp; conversational, concise executive)
        as well as use quick one-click presets like &quot;Make it concise&quot;, &quot;Professional polish&quot;, or custom natural-language
        instructions.
      </span>
    ),
  },

  // Integrations
  {
    id: "how-to-connect-gmail",
    category: "integrations",
    question: "How do I connect my Gmail or Google Workspace inbox?",
    answer: (
      <span>
        Connecting Gmail takes less than 60 seconds. In the Integrations tab, click &quot;Connect Google Workspace&quot;. You will be
        directed to Google&apos;s official OAuth 2.0 consent screen where you grant limited permissions (<code style={{ background: "#F1F5F9", padding: "2px 6px", borderRadius: 4 }}>gmail.readonly</code>, <code style={{ background: "#F1F5F9", padding: "2px 6px", borderRadius: 4 }}>gmail.compose</code>). We never request administrative ownership or access to unrelated Google Drive files. Learn more in our{" "}
        <Link href="/docs/connect-gmail" style={{ color: "#2563EB", fontWeight: 600 }}>Gmail Integration Guide</Link>.
      </span>
    ),
  },
  {
    id: "how-to-connect-outlook",
    category: "integrations",
    question: "Does ProxiPilot support Microsoft 365 and Exchange Online?",
    answer: (
      <span>
        Yes. ProxiPilot connects to Microsoft 365 via the official Microsoft Graph API with granular OAuth permissions
        (<code style={{ background: "#F1F5F9", padding: "2px 6px", borderRadius: 4 }}>Mail.ReadWrite</code>). See our{" "}
        <Link href="/docs/connect-outlook" style={{ color: "#2563EB", fontWeight: 600 }}>Outlook Integration Guide</Link>.
      </span>
    ),
  },
  {
    id: "revoke-access",
    category: "integrations",
    question: "Can I disconnect or revoke ProxiPilot&apos;s access at any time?",
    answer: (
      <span>
        Yes, immediately. You can disconnect your inbox with a single click in your ProxiPilot settings, or revoke the OAuth
        token directly from your Google Account Security page or Microsoft Entra ID admin center. Once revoked, all active tokens
        are destroyed.
      </span>
    ),
  },

  // Knowledge Base & Grounding
  {
    id: "what-documents-supported",
    category: "knowledge",
    question: "What types of business documents can I upload to ProxiPilot?",
    answer: (
      <span>
        ProxiPilot supports PDF documents, CSV/Excel spreadsheets (catalogs, price lists, SKU databases), Word documents (.docx),
        plain text (.txt, .md), and direct URL web crawl scraping. All uploaded data is chunked, embedded, and stored in
        tenant-isolated vector namespaces.
      </span>
    ),
  },
  {
    id: "update-catalog",
    category: "knowledge",
    question: "How quickly do updates to my product catalog reflect in AI drafts?",
    answer: (
      <span>
        Updates are re-indexed within seconds. When you upload a new price sheet or edit a policy document in your Knowledge Base,
        the vector index updates immediately. Subsequent draft generations will cite the latest uploaded parameters.
      </span>
    ),
  },

  // Security, Privacy & Compliance
  {
    id: "llm-training",
    category: "security",
    question: "Does ProxiPilot use our emails or business data to train public AI models?",
    answer: (
      <span>
        <strong>Never.</strong> Under our contractual zero-training guarantee and enterprise API agreements, your customer emails,
        inbox data, and uploaded documents are strictly confidential and are NEVER used to train foundational LLMs or shared
        with third parties for model fine-tuning. Review our complete{" "}
        <Link href="/ai-transparency" style={{ color: "#2563EB", fontWeight: 600 }}>AI Transparency Policy</Link> and{" "}
        <Link href="/security" style={{ color: "#2563EB", fontWeight: 600 }}>Security Center</Link>.
      </span>
    ),
  },
  {
    id: "data-encryption",
    category: "security",
    question: "How is our data encrypted and secured?",
    answer: (
      <span>
        All data in transit is encrypted using modern TLS 1.3 encryption. All stored data, including OAuth tokens and vector
        embeddings, is encrypted at rest using AES-256 encryption. Authentication tokens are vaulted in encrypted key stores
        with automatic rotation.
      </span>
    ),
  },
  {
    id: "gdpr-compliance",
    category: "security",
    question: "Is ProxiPilot compliant with GDPR and international privacy regulations?",
    answer: (
      <span>
        Yes. ProxiPilot is fully compliant with GDPR regulations. We offer a standardized{" "}
        <Link href="/dpa" style={{ color: "#2563EB", fontWeight: 600 }}>Data Processing Agreement (DPA)</Link>, a transparent{" "}
        <Link href="/subprocessors" style={{ color: "#2563EB", fontWeight: 600 }}>Subprocessors List</Link>, and a self-service{" "}
        <Link href="/privacy-request" style={{ color: "#2563EB", fontWeight: 600 }}>Privacy Request Portal</Link> for data access and erasure.
      </span>
    ),
  },

  // Pricing & Billing
  {
    id: "free-trial-details",
    category: "pricing",
    question: "Is there a free trial available?",
    answer: (
      <span>
        Yes. All new accounts include a 14-day free trial on the Starter or Growth tier with full feature access, allowing your
        team to test inbox synchronization and catalog grounding with no upfront payment or long-term commitment.
      </span>
    ),
  },
  {
    id: "change-cancel-plan",
    category: "pricing",
    question: "Can I change or cancel my plan at any time?",
    answer: (
      <span>
        Yes. You can upgrade, downgrade, or cancel your subscription at any time directly through your billing portal. Upgrades
        take effect immediately with prorated billing, while cancellations remain active until the end of your prepaid billing period.
        See our <Link href="/refund" style={{ color: "#2563EB", fontWeight: 600 }}>Refund &amp; Cancellation Policy</Link>.
      </span>
    ),
  },
  {
    id: "billing-entity",
    category: "pricing",
    question: "What entity processes payments and invoices?",
    answer: (
      <span>
        Subscriptions are securely processed via Paddle or Lemon Squeezy acting as our Merchant of Record (MOR), handling global
        sales tax, VAT, and secure invoicing compliant with Delaware corporate entity governance.
      </span>
    ),
  },
];

const CATEGORIES = [
  { id: "all", label: "All Questions" },
  { id: "general", label: "General" },
  { id: "features", label: "Features & Copilot" },
  { id: "integrations", label: "Integrations" },
  { id: "knowledge", label: "Knowledge Base" },
  { id: "security", label: "Security & Privacy" },
  { id: "pricing", label: "Pricing & Billing" },
] as const;

export function FAQClient() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({
    "what-is-proxipilot": true,
    "ai-hallucinations": true,
  });

  const toggleOpen = (id: string) => {
    setOpenIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredFAQs = useMemo(() => {
    return FAQ_DATA.filter((item) => {
      const matchesCategory = activeCategory === "all" || item.category === activeCategory;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        searchQuery === "" ||
        item.question.toLowerCase().includes(q) ||
        (typeof item.answer === "string" && item.answer.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  return (
    <div style={{ maxWidth: 940, margin: "0 auto" }}>
      {/* Search Input */}
      <div
        style={{
          position: "relative",
          marginBottom: 24,
        }}
      >
        <IconSearch
          size={18}
          color="#94A3B8"
          style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)" }}
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by keyword (e.g. Gmail, security, hallucinations, pricing)..."
          style={{
            width: "100%",
            padding: "13px 16px 13px 44px",
            fontSize: 15,
            border: "1px solid #CBD5E1",
            borderRadius: 10,
            outline: "none",
            backgroundColor: "#FFFFFF",
            color: "#0F172A",
            boxSizing: "border-box",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        />
      </div>

      {/* Category Filter Pills */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 32,
        }}
      >
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                padding: "7px 14px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 20,
                border: isActive ? "1px solid #2563EB" : "1px solid #E2E8F0",
                backgroundColor: isActive ? "#2563EB" : "#F8FAFC",
                color: isActive ? "#FFFFFF" : "#475569",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Accordion List */}
      {filteredFAQs.length === 0 ? (
        <div
          style={{
            padding: "48px 24px",
            textAlign: "center",
            backgroundColor: "#F8FAFC",
            borderRadius: 12,
            border: "1px solid #E2E8F0",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1E293B", marginBottom: 6 }}>
            No questions found matching &quot;{searchQuery}&quot;
          </div>
          <p style={{ fontSize: 14, color: "#64748B", margin: "0 0 16px" }}>
            Try searching with broader terms or reach out directly to our engineering support team.
          </p>
          <Link
            href="/contact"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 14,
              fontWeight: 600,
              color: "#2563EB",
            }}
          >
            Contact Support <IconArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredFAQs.map((item) => {
            const isOpen = !!openIds[item.id];
            return (
              <div
                key={item.id}
                style={{
                  border: "1px solid #E2E8F0",
                  borderRadius: 12,
                  backgroundColor: "#FFFFFF",
                  overflow: "hidden",
                  transition: "border-color 0.15s ease",
                }}
              >
                <button
                  onClick={() => toggleOpen(item.id)}
                  aria-expanded={isOpen}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "18px 20px",
                    textAlign: "left",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    gap: 16,
                  }}
                >
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: isOpen ? "#2563EB" : "#0F172A",
                      lineHeight: 1.4,
                    }}
                  >
                    {item.question}
                  </span>
                  <div
                    style={{
                      flexShrink: 0,
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      backgroundColor: isOpen ? "#EFF6FF" : "#F8FAFC",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: isOpen ? "#2563EB" : "#64748B",
                    }}
                  >
                    {isOpen ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                  </div>
                </button>

                {isOpen && (
                  <div
                    style={{
                      padding: "0 20px 20px",
                      fontSize: 14.5,
                      color: "#475569",
                      lineHeight: 1.6,
                      borderTop: "1px solid #F1F5F9",
                      paddingTop: 14,
                    }}
                  >
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
