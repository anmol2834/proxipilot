import type { Metadata } from "next";
import Link from "next/link";
import { GlobalNavbar } from "@/components/navigation/GlobalNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import {
  IconMailCheck,
  IconBrandGoogle,
  IconBrandWindows,
  IconDatabase,
  IconWebhook,
  IconArrowRight,
  IconShieldCheck,
  IconExternalLink,
  IconLock,
  IconCheck,
} from "@tabler/icons-react";

export const metadata: Metadata = {
  title: "Integrations Directory — Connect Gmail, Outlook & Vector RAG | ProxiPilot",
  description:
    "Explore ProxiPilot native email integrations for Google Workspace, Microsoft 365 Outlook, Qdrant vector databases, and custom CRM event webhooks.",
  alternates: { canonical: "https://proxipilot.com/integrations" },
};

const INTEGRATIONS = [
  {
    name: "Google Workspace & Gmail",
    category: "Mailbox Provider",
    status: "Native • Production Ready",
    badgeColor: "#166534",
    badgeBg: "#DCFCE7",
    icon: <IconBrandGoogle size={26} color="#EA4335" />,
    summary: "Native bi-directional OAuth synchronization for Google Workspace business mailboxes.",
    capabilities: [
      "Real-time incoming email thread synchronization via Google APIs",
      "Automatic creation and editing of drafts directly in your Gmail draft folder",
      "Explicit user-authorized dispatch through Google's official SMTP/API transport",
      "Full compliance with Google API Services User Data Policy (Limited Use)",
    ],
    permissions: "https://www.googleapis.com/auth/gmail.modify, https://www.googleapis.com/auth/gmail.send",
    docsUrl: "/docs/connect-gmail",
  },
  {
    name: "Microsoft 365 & Outlook",
    category: "Mailbox Provider",
    status: "Native • Production Ready",
    badgeColor: "#166534",
    badgeBg: "#DCFCE7",
    icon: <IconBrandWindows size={26} color="#0078D4" />,
    summary: "Enterprise Microsoft Graph integration for Microsoft 365, Exchange Online, and Outlook accounts.",
    capabilities: [
      "Delegated OAuth 2.0 authorization with optional Azure AD tenant admin consent",
      "Draft composition directly in your Microsoft Outlook web and desktop clients",
      "Support for shared mailboxes and distribution groups across your corporate tenant",
      "End-to-end token encryption utilizing AES-256 envelope key vaulting",
    ],
    permissions: "Mail.ReadWrite, Mail.Send, User.Read (via Microsoft Graph)",
    docsUrl: "/docs/connect-outlook",
  },
  {
    name: "Qdrant Vector Database",
    category: "AI & Vector Search",
    status: "Core Infrastructure",
    badgeColor: "#1E40AF",
    badgeBg: "#EFF6FF",
    icon: <IconDatabase size={26} color="#2563EB" />,
    summary: "High-performance vector search engine powering grounded Retrieval-Augmented Generation.",
    capabilities: [
      "Semantic chunking and embedding of corporate PDFs, CSV catalogs, and FAQs",
      "Strict payload namespace filtering enforcing absolute workspace tenant isolation",
      "Sub-20ms cosine distance retrieval across millions of knowledge paragraphs",
      "Zero foundation model training: vectors are queried exclusively during live inference",
    ],
    permissions: "Managed internal VPC cluster / Isolated Tenant Collections",
    docsUrl: "/docs/business-knowledge",
  },
  {
    name: "Custom Webhooks & REST API",
    category: "Developer Platform",
    status: "API • Production Ready",
    badgeColor: "#374151",
    badgeBg: "#F1F5F9",
    icon: <IconWebhook size={26} color="#475569" />,
    summary: "Event-driven webhooks to sync ProxiPilot intelligence with your internal ERP or CRM.",
    capabilities: [
      "Real-time event notifications for `draft.created`, `email.sent`, and `lead.classified`",
      "HMAC-SHA256 signature verification on every inbound and outbound payload",
      "Configurable retry schedules with exponential backoff on endpoint failures",
      "Direct payload mapping to Salesforce, HubSpot, and custom internal backends",
    ],
    permissions: "Workspace API Key / Bearer Authentication",
    docsUrl: "/docs",
  },
];

export default function IntegrationsDirectoryPage() {
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
              Native Connectors
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
              Connect your tools in minutes. <br />
              Keep your existing email clients.
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
              ProxiPilot operates as a transparent intelligence layer on top of Google Workspace and Microsoft 365. No complex migrations, no new mailboxes to buy.
            </p>
          </div>
        </section>

        {/* Integrations Grid */}
        <section style={{ padding: "56px 24px", maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 28 }}>
            {INTEGRATIONS.map((item) => (
              <div
                key={item.name}
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: 12,
                  padding: "28px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                  display: "grid",
                  gridTemplateColumns: "300px 1fr",
                  gap: 32,
                  alignItems: "flex-start",
                }}
                className="integration-card-grid"
              >
                {/* Left Column */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 10,
                        backgroundColor: "#F8FAFC",
                        border: "1px solid #E2E8F0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {item.icon}
                    </div>
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: 0 }}>
                        {item.name}
                      </h3>
                      <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{item.category}</div>
                    </div>
                  </div>

                  <span
                    style={{
                      display: "inline-block",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      padding: "2px 8px",
                      borderRadius: 4,
                      backgroundColor: item.badgeBg,
                      color: item.badgeColor,
                      marginBottom: 12,
                    }}
                  >
                    {item.status}
                  </span>

                  <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.5, margin: "0 0 16px" }}>
                    {item.summary}
                  </p>

                  <Link
                    href={item.docsUrl}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#2563EB",
                      textDecoration: "none",
                    }}
                  >
                    <span>View Setup Documentation</span>
                    <IconArrowRight size={14} />
                  </Link>
                </div>

                {/* Right Column: Capabilities & Permissions */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#64748B", letterSpacing: "0.04em", marginBottom: 10 }}>
                    Supported Capabilities:
                  </div>
                  <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {item.capabilities.map((cap) => (
                      <li key={cap} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13.5, color: "#334155", lineHeight: 1.45 }}>
                        <IconCheck size={16} color="#16A34A" style={{ flexShrink: 0, marginTop: 2 }} />
                        <span>{cap}</span>
                      </li>
                    ))}
                  </ul>

                  <div style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "10px 12px", fontSize: 12, color: "#475569" }}>
                    <strong>Required OAuth Scopes:</strong> <code>{item.permissions}</code>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Disconnection & Revocation Guarantees */}
        <section style={{ backgroundColor: "#F8FAFC", borderTop: "1px solid #E2E8F0", borderBottom: "1px solid #E2E8F0", padding: "48px 24px" }}>
          <div style={{ maxWidth: 1080, margin: "0 auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
              <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#0F172A", fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
                  <IconLock size={18} color="#2563EB" />
                  <span>Instant Revocation</span>
                </div>
                <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.55 }}>
                  Clicking <em>Disconnect</em> in workspace settings immediately triggers provider revocation endpoints and purges all cryptographic tokens from our database.
                </p>
              </div>

              <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#0F172A", fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
                  <IconShieldCheck size={18} color="#16A34A" />
                  <span>Google Limited Use</span>
                </div>
                <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.55 }}>
                  ProxiPilot strictly complies with Google&rsquo;s Limited Use requirements. Your email data is never transferred to advertisers or used to train third-party AI models.
                </p>
              </div>

              <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#0F172A", fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
                  <IconExternalLink size={18} color="#475569" />
                  <span>Legal Integration Terms</span>
                </div>
                <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.55 }}>
                  Review our complete contractual terms governing mailbox connections in our{" "}
                  <Link href="/terms#service" style={{ color: "#2563EB", fontWeight: 600 }}>Terms of Service</Link>.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0F172A", margin: "0 0 10px" }}>
              Connect your team mailbox now
            </h2>
            <p style={{ fontSize: 14, color: "#64748B", margin: "0 0 20px" }}>
              Get started with a 14-day free trial. Setup takes under 2 minutes.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
              <Link
                href="/signup"
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
                Connect Inbox Free
              </Link>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media (max-width: 820px) {
          .integration-card-grid {
            grid-template-columns: 1fr !important;
            gap: 20px !important;
          }
        }
      `,
        }}
      />
    </div>
  );
}
