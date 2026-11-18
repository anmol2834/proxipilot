import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Data Retention & Deletion Policy — ProxiPilot",
  description:
    "ProxiPilot granular data retention schedules, automated deletion lifecycles for email threads, vector embeddings, OAuth tokens, and backup purging.",
  alternates: { canonical: "https://proxipilot.com/data-retention" },
};

const TOC_ITEMS = [
  { id: "overview", title: "1. Data Lifecycle Principles" },
  { id: "matrix", title: "2. Retention & Deletion Matrix" },
  { id: "tokens", title: "3. Immediate OAuth Token Revocation" },
  { id: "vectors", title: "4. Knowledge Base & Vector Embeddings" },
  { id: "backups", title: "5. Backup Purge Cycles" },
  { id: "account-deletion", title: "6. User-Initiated Account Deletion" },
  { id: "legal-holds", title: "7. Statutory Tax & Legal Holds" },
];

export default function DataRetentionPage() {
  return (
    <LegalPageShell policyKey="data-retention" tocItems={TOC_ITEMS}>
      <section id="overview" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          1. Data Lifecycle Principles
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          At ProxiPilot (operated by <strong>Cheldain</strong>), data minimization is a foundational engineering standard. We store customer information only for as long as is necessary to deliver automated email drafting and maintain platform integrity. This policy outlines our precise retention schedules and deletion timelines.
        </p>
      </section>

      <section id="matrix" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          2. Retention &amp; Deletion Matrix
        </h2>
        <div style={{ overflowX: "auto", border: "1px solid #E2E8F0", borderRadius: 6, marginBottom: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
            <thead>
              <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                <th style={{ padding: "8px 12px", color: "#475569", fontWeight: 600 }}>Data Category</th>
                <th style={{ padding: "8px 12px", color: "#475569", fontWeight: 600 }}>Specific Items</th>
                <th style={{ padding: "8px 12px", color: "#475569", fontWeight: 600 }}>Active Retention</th>
                <th style={{ padding: "8px 12px", color: "#475569", fontWeight: 600 }}>Post-Termination Deletion</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                <td style={{ padding: "8px 12px", fontWeight: 600, color: "#0F172A" }}>Mailbox OAuth Tokens</td>
                <td style={{ padding: "8px 12px", color: "#334155" }}>Gmail &amp; Outlook refresh/access tokens</td>
                <td style={{ padding: "8px 12px", color: "#64748B" }}>Duration of mailbox connection</td>
                <td style={{ padding: "8px 12px", color: "#166534", fontWeight: 600 }}>Immediate (0 days) upon disconnect</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                <td style={{ padding: "8px 12px", fontWeight: 600, color: "#0F172A" }}>Email Drafts &amp; Prompts</td>
                <td style={{ padding: "8px 12px", color: "#334155" }}>Generated reply drafts, tone instructions</td>
                <td style={{ padding: "8px 12px", color: "#64748B" }}>Duration of active subscription</td>
                <td style={{ padding: "8px 12px", color: "#B91C1C" }}>Within 30 calendar days</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                <td style={{ padding: "8px 12px", fontWeight: 600, color: "#0F172A" }}>Vector Embeddings</td>
                <td style={{ padding: "8px 12px", color: "#334155" }}>Qdrant vector chunks, knowledge index</td>
                <td style={{ padding: "8px 12px", color: "#64748B" }}>Duration of knowledge base upload</td>
                <td style={{ padding: "8px 12px", color: "#B91C1C" }}>Within 30 calendar days</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                <td style={{ padding: "8px 12px", fontWeight: 600, color: "#0F172A" }}>Audit &amp; Security Logs</td>
                <td style={{ padding: "8px 12px", color: "#334155" }}>IP addresses, authentication logs</td>
                <td style={{ padding: "8px 12px", color: "#64748B" }}>90 rolling days</td>
                <td style={{ padding: "8px 12px", color: "#64748B" }}>Automatically rotated &amp; purged</td>
              </tr>
              <tr>
                <td style={{ padding: "8px 12px", fontWeight: 600, color: "#0F172A" }}>Billing &amp; Tax Records</td>
                <td style={{ padding: "8px 12px", color: "#334155" }}>Invoices, subscription transaction receipts</td>
                <td style={{ padding: "8px 12px", color: "#64748B" }}>7 years (handled by Paddle/Lemon Squeezy)</td>
                <td style={{ padding: "8px 12px", color: "#64748B" }}>Retained as mandated by tax law</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="tokens" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          3. Immediate OAuth Token Revocation
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          When you disconnect a Google Workspace or Microsoft 365 mailbox from your workspace settings, ProxiPilot immediately calls upstream provider revocation endpoints and purges all cryptographic tokens from our database. We do not retain dormant email credentials.
        </p>
      </section>

      <section id="vectors" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          4. Knowledge Base &amp; Vector Embeddings
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          When you delete a business document, company policy file, or product FAQ from your Knowledge Base, the corresponding vector embeddings in Qdrant are pruned immediately using payload-scoped collection deletion commands.
        </p>
      </section>

      <section id="backups" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          5. Backup Purge Cycles
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Encrypted database backups and point-in-time recovery snapshots are maintained for <strong>30 days</strong> to ensure disaster recovery resilience. Once data is deleted from production databases, it naturally ages out and is permanently overwritten within 30 days as backups rotate.
        </p>
      </section>

      <section id="account-deletion" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          6. User-Initiated Account Deletion
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Account owners may request full account deletion at any time by visiting our <Link href="/privacy-request" style={{ color: "#2563EB", fontWeight: 600 }}>Privacy Request Portal</Link> or emailing <a href="mailto:privacy@proxipilot.com" style={{ color: "#2563EB" }}>privacy@proxipilot.com</a>. Upon verification, the 30-day permanent deletion pipeline is initiated immediately.
        </p>
      </section>

      <section id="legal-holds" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          7. Statutory Tax &amp; Legal Holds
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Certain transaction metadata (invoice IDs, billing amounts, currency, VAT/GST numbers) must be preserved by our Merchant of Record partners (Paddle/Lemon Squeezy) for up to 7 years in compliance with international commercial accounting and tax laws.
        </p>
      </section>
    </LegalPageShell>
  );
}
