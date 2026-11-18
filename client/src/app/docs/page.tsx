import type { Metadata } from "next";
import Link from "next/link";
import { DocsLayout } from "@/components/docs/DocsLayout";
import {
  IconRocket,
  IconBrandGoogle,
  IconBrandWindows,
  IconCpu,
  IconDatabase,
  IconChecklist,
  IconTool,
  IconArrowRight,
  IconShieldLock,
} from "@tabler/icons-react";

export const metadata: Metadata = {
  title: "Documentation — ProxiPilot",
  description:
    "Official developer and user documentation for ProxiPilot. Setup guides for Gmail, Microsoft 365, Qdrant vector retrieval, and AI reply automation.",
  alternates: { canonical: "https://proxipilot.com/docs" },
};

const SECTIONS = [
  { id: "getting-started", title: "1. Quick Start Walkthrough" },
  { id: "integrations", title: "2. Mailbox Integrations" },
  { id: "copilot-rag", title: "3. Vector RAG & Copilot" },
  { id: "draft-management", title: "4. Review & Approval Modes" },
  { id: "architecture", title: "5. Security & Multi-Tenant Isolation" },
];

export default function DocsOverviewPage() {
  return (
    <DocsLayout
      currentSlug="docs"
      title="ProxiPilot Platform Documentation"
      description="Comprehensive technical guides, mailbox setup instructions, and vector knowledge workflows for the ProxiPilot platform."
      category="Overview & Setup"
      sections={SECTIONS}
      nextSlug="getting-started"
    >
      {/* Introduction */}
      <section id="getting-started" style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", marginBottom: 12 }}>
          1. Quick Start Walkthrough
        </h2>
        <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.6, marginBottom: 20 }}>
          ProxiPilot is an enterprise AI email copilot and automation engine. It integrates directly with your existing corporate mailboxes (Google Workspace and Microsoft 365) to index incoming client inquiries, query your internal knowledge documents in vector memory, and generate context-aware draft replies for human review.
        </p>

        <div
          style={{
            padding: "20px 24px",
            borderRadius: 12,
            backgroundColor: "#EFF6FF",
            border: "1px solid #BFDBFE",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1E40AF", marginBottom: 4 }}>
              Ready to onboard your first mailbox?
            </div>
            <div style={{ fontSize: 13, color: "#2563EB" }}>
              Follow our 5-minute step-by-step onboarding walkthrough.
            </div>
          </div>
          <Link
            href="/docs/getting-started"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 18px",
              borderRadius: 8,
              backgroundColor: "#2563EB",
              color: "#FFFFFF",
              fontSize: 13.5,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Start Setup <IconArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* Integration Setup Cards */}
      <section id="integrations" style={{ marginBottom: 44 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", marginBottom: 12 }}>
          2. Mailbox Integrations
        </h2>
        <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.6, marginBottom: 20 }}>
          ProxiPilot uses official, granular OAuth 2.0 protocols to synchronize emails. We never require your account password or modify DNS records.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 18,
          }}
        >
          <Link
            href="/docs/connect-gmail"
            style={{
              padding: "20px",
              borderRadius: 12,
              border: "1px solid #E2E8F0",
              backgroundColor: "#FFFFFF",
              textDecoration: "none",
              color: "#0F172A",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: "#FEF2F2",
                color: "#EA4335",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <IconBrandGoogle size={20} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Google Workspace &amp; Gmail</div>
            <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.5 }}>
              Authorize gmail.readonly and gmail.compose with automatic webhook push notifications.
            </div>
          </Link>

          <Link
            href="/docs/connect-outlook"
            style={{
              padding: "20px",
              borderRadius: 12,
              border: "1px solid #E2E8F0",
              backgroundColor: "#FFFFFF",
              textDecoration: "none",
              color: "#0F172A",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: "#EFF6FF",
                color: "#0284C7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <IconBrandWindows size={20} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Microsoft 365 &amp; Exchange</div>
            <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.5 }}>
              Connect via Microsoft Graph API for single accounts or tenant-wide shared support mailboxes.
            </div>
          </Link>
        </div>
      </section>

      {/* Vector RAG & Copilot */}
      <section id="copilot-rag" style={{ marginBottom: 44 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", marginBottom: 12 }}>
          3. Vector Grounding &amp; AI Copilot
        </h2>
        <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.6, marginBottom: 20 }}>
          ProxiPilot avoids hallucinations by enforcing evidence retrieval before LLM generation. When a customer asks about a product code or warranty term, the system searches your uploaded knowledge base.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 18,
          }}
        >
          <Link
            href="/docs/business-knowledge"
            style={{
              padding: "20px",
              borderRadius: 12,
              border: "1px solid #E2E8F0",
              backgroundColor: "#FFFFFF",
              textDecoration: "none",
              color: "#0F172A",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: "#FFFBEB",
                color: "#D97706",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <IconDatabase size={20} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Business Knowledge Base</div>
            <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.5 }}>
              Upload PDFs, CSV catalogs, Excel price sheets, and scrape website documentation.
            </div>
          </Link>

          <Link
            href="/docs/ai-automation"
            style={{
              padding: "20px",
              borderRadius: 12,
              border: "1px solid #E2E8F0",
              backgroundColor: "#FFFFFF",
              textDecoration: "none",
              color: "#0F172A",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: "#FAF5FF",
                color: "#7C3AED",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <IconCpu size={20} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>AI Automation &amp; Prompts</div>
            <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.5 }}>
              Configure company tone guidelines, prompt rules, and thread-isolated refinement.
            </div>
          </Link>
        </div>
      </section>

      {/* Draft Management & Human-in-the-Loop */}
      <section id="draft-management" style={{ marginBottom: 44 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", marginBottom: 12 }}>
          4. Review &amp; Approval Modes
        </h2>
        <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.6, marginBottom: 16 }}>
          Learn how to approve drafts, fine-tune responses with one-click tone presets, and safely enable autonomous sending for routine inquiries.
        </p>
        <Link
          href="/docs/manage-drafts"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 14,
            fontWeight: 700,
            color: "#2563EB",
            textDecoration: "none",
          }}
        >
          Read the Draft Management Guide <IconArrowRight size={15} />
        </Link>
      </section>

      {/* Architecture & Multi-Tenant Isolation */}
      <section id="architecture" style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", marginBottom: 12 }}>
          5. Security &amp; Multi-Tenant Isolation
        </h2>
        <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.6, marginBottom: 16 }}>
          ProxiPilot is engineered with defense-in-depth security:
        </p>
        <ul style={{ fontSize: 14.5, color: "#475569", lineHeight: 1.65, paddingLeft: 20 }}>
          <li><strong>Zero Model Training:</strong> Your business emails and customer data are never used to train public LLMs.</li>
          <li><strong>Tenant Isolation:</strong> Qdrant vector memory is partitioned in isolated logical namespaces.</li>
          <li><strong>Token Vaulting:</strong> OAuth refresh tokens are encrypted at rest with AES-256 and unsealed only in volatile memory.</li>
        </ul>
        <div style={{ marginTop: 16 }}>
          <Link
            href="/security"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 14,
              fontWeight: 700,
              color: "#2563EB",
              textDecoration: "none",
            }}
          >
            Visit the Security &amp; Trust Center <IconArrowRight size={15} />
          </Link>
        </div>
      </section>
    </DocsLayout>
  );
}
