import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import { PrivacyRequestForm } from "@/components/legal/PrivacyRequestForm";

export const metadata: Metadata = {
  title: "Privacy Request Portal — ProxiPilot",
  description:
    "Exercise your GDPR, CCPA, and data privacy rights. Submit requests for data access, deletion, rectification, or token revocation directly to our Privacy Office.",
  alternates: { canonical: "https://proxipilot.com/privacy-request" },
};

const TOC_ITEMS = [
  { id: "portal-form", title: "1. Data Subject Request Form" },
  { id: "statutory-rights", title: "2. Your Rights Under Global Privacy Laws" },
  { id: "identity-verification", title: "3. Identity Verification Process" },
  { id: "response-timelines", title: "4. Statutory Response Timelines" },
  { id: "authorized-agents", title: "5. Requests by Authorized Agents" },
];

export default function PrivacyRequestPage() {
  return (
    <LegalPageShell policyKey="privacy-request" tocItems={TOC_ITEMS}>
      <section id="portal-form" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          1. Data Subject Request Form
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 16px", lineHeight: 1.62 }}>
          Use the secure portal below to submit a formal Data Subject Request (DSR) under the General Data Protection Regulation (GDPR), California Consumer Privacy Act (CCPA/CPRA), or India&rsquo;s Digital Personal Data Protection Act (DPDPA).
        </p>
        <PrivacyRequestForm />
      </section>

      <section id="statutory-rights" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          2. Your Rights Under Global Privacy Laws
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "12px 0" }}>
          <div style={{ padding: "12px", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Right to Access &amp; Portability</div>
            <p style={{ fontSize: 12, color: "#64748B", margin: "4px 0 0" }}>
              Request a machine-readable JSON export of your personal information, active prompt metadata, and connected mailbox status.
            </p>
          </div>
          <div style={{ padding: "12px", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Right to Erasure (Deletion)</div>
            <p style={{ fontSize: 12, color: "#64748B", margin: "4px 0 0" }}>
              Request permanent deletion of your account, email drafts, vector embeddings in Qdrant, and revocation of all OAuth credentials.
            </p>
          </div>
          <div style={{ padding: "12px", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Right to Rectification</div>
            <p style={{ fontSize: 12, color: "#64748B", margin: "4px 0 0" }}>
              Correct inaccurate or incomplete corporate registration details or contact information.
            </p>
          </div>
          <div style={{ padding: "12px", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Right to Object &amp; Restrict</div>
            <p style={{ fontSize: 12, color: "#64748B", margin: "4px 0 0" }}>
              Restrict or object to specific automated processing pipelines where applicable under local data protection laws.
            </p>
          </div>
        </div>
      </section>

      <section id="identity-verification" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          3. Identity Verification Process
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          To prevent unauthorized disclosures, our Privacy Team will verify that the requester is the authorized owner of the associated ProxiPilot workspace. We may send a cryptographic verification link to the registered business email before executing access or deletion requests.
        </p>
      </section>

      <section id="response-timelines" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          4. Statutory Response Timelines
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          In accordance with GDPR Article 12(3) and CCPA § 1798.130, we respond to and fulfill all verified requests within <strong>30 calendar days</strong>. For complex requests, we may extend this period by an additional 60 days, notifying you in writing of the extension and rationale within the initial 30 days.
        </p>
      </section>

      <section id="authorized-agents" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          5. Requests by Authorized Agents
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          If you are submitting a request on behalf of a data subject or enterprise customer, you must submit written proof of power of attorney or authorization signed by the registered account owner.
        </p>
      </section>
    </LegalPageShell>
  );
}
