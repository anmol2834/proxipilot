import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Data Processing Agreement (DPA) — ProxiPilot",
  description:
    "Data Processing Agreement (DPA) incorporating GDPR Article 28, UK GDPR, and Standard Contractual Clauses (SCCs). Customer is Data Controller; Cheldain is Data Processor.",
  alternates: { canonical: "https://proxipilot.com/dpa" },
};

const TOC_ITEMS = [
  { id: "preamble", title: "1. Scope & Application" },
  { id: "roles", title: "2. Controller & Processor Roles" },
  { id: "processing-details", title: "3. Scope & Nature of Processing" },
  { id: "processor-obligations", title: "4. Obligations of ProxiPilot (Processor)" },
  { id: "subprocessors", title: "5. Authorized Subprocessors" },
  { id: "toms", title: "6. Technical & Organizational Measures (TOMs)" },
  { id: "data-breach", title: "7. Personal Data Breach Notification" },
  { id: "dsr-assistance", title: "8. Data Subject Rights Assistance" },
  { id: "deletion-return", title: "9. Deletion & Return of Personal Data" },
  { id: "international", title: "10. International Transfers & EU SCCs" },
  { id: "audits", title: "11. Audits & Compliance Reviews" },
];

export default function DpaPage() {
  return (
    <LegalPageShell policyKey="dpa" tocItems={TOC_ITEMS}>
      <section id="preamble" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          1. Scope &amp; Application
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          This Data Processing Agreement (&ldquo;DPA&rdquo;) supplements the <Link href="/terms" style={{ color: "#2563EB", fontWeight: 600 }}>Terms of Service</Link> between the business entity using ProxiPilot (&ldquo;Customer&rdquo;) and <strong>Cheldain</strong> (&ldquo;ProxiPilot,&rdquo; &ldquo;Company,&rdquo; or &ldquo;Processor&rdquo;). This DPA applies where and to the extent that Cheldain processes Personal Data on behalf of the Customer in the course of providing the ProxiPilot SaaS platform, pursuant to European Data Protection Legislation (GDPR Art. 28), UK GDPR, the Swiss FADP, and the California Consumer Privacy Act (&ldquo;CCPA&rdquo; / &ldquo;CPRA&rdquo;).
        </p>
      </section>

      <section id="roles" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          2. Controller &amp; Processor Roles
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          The parties acknowledge and agree that:
        </p>
        <ul style={{ paddingLeft: 20, margin: "0 0 10px", fontSize: 14, color: "#334155" }}>
          <li style={{ marginBottom: 4 }}><strong>Customer is the Data Controller</strong> (or Business under the CCPA) of Personal Data uploaded, connected, or synced with ProxiPilot.</li>
          <li style={{ marginBottom: 4 }}><strong>Cheldain is the Data Processor</strong> (or Service Provider under the CCPA) processing Personal Data solely on the documented commercial instructions of Customer.</li>
        </ul>
      </section>

      <section id="processing-details" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          3. Scope &amp; Nature of Processing
        </h2>
        <div style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "12px 14px", margin: "12px 0", fontSize: 13, color: "#334155" }}>
          <p style={{ margin: "0 0 6px" }}><strong>Subject Matter:</strong> Provision of AI-driven email productivity, drafting, vector context retrieval, and mailbox automation.</p>
          <p style={{ margin: "0 0 6px" }}><strong>Duration:</strong> The active term of the Customer&rsquo;s subscription plus 30 days post-termination retention.</p>
          <p style={{ margin: "0 0 6px" }}><strong>Categories of Data Subjects:</strong> Customer employees, contractors, commercial clients, leads, and email correspondents.</p>
          <p style={{ margin: 0 }}><strong>Categories of Personal Data:</strong> Business contact details, message thread text, prompts, drafts, and system authorization tokens.</p>
        </div>
      </section>

      <section id="processor-obligations" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          4. Obligations of ProxiPilot (Processor)
        </h2>
        <ul style={{ paddingLeft: 20, margin: "0 0 10px", fontSize: 14, color: "#334155" }}>
          <li style={{ marginBottom: 4 }}><strong>Documented Instructions:</strong> Process Personal Data solely in accordance with Customer&rsquo;s documented instructions as set forth in the Terms and this DPA.</li>
          <li style={{ marginBottom: 4 }}><strong>Confidentiality:</strong> Ensure all personnel authorized to access Customer Data have committed themselves to confidentiality.</li>
          <li style={{ marginBottom: 4 }}><strong>Non-Training Commitment:</strong> ProxiPilot enforces non-training API agreements with AI providers. Customer email data is never used to train generalized foundation language models.</li>
          <li style={{ marginBottom: 4 }}><strong>No Sale / Share:</strong> ProxiPilot shall not &ldquo;sell&rdquo; or &ldquo;share&rdquo; Customer Personal Data as defined under CCPA/CPRA.</li>
        </ul>
      </section>

      <section id="subprocessors" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          5. Authorized Subprocessors
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Customer grants general written authorization to Cheldain to engage the third-party subprocessors enumerated on our official <Link href="/subprocessors" style={{ color: "#2563EB", fontWeight: 600 }}>Subprocessors List</Link>. We enforce contractual data protection terms with each subprocessor that are no less restrictive than those in this DPA. We notify customers of subprocessor updates at least 14 days in advance via our trust center or email.
        </p>
      </section>

      <section id="toms" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          6. Technical &amp; Organizational Measures (TOMs)
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Processor maintains state-of-the-art technical safeguards (Schedule 1) including:
        </p>
        <ul style={{ paddingLeft: 20, margin: "0 0 10px", fontSize: 14, color: "#334155" }}>
          <li style={{ marginBottom: 4 }}><strong>Cryptographic Encryption:</strong> TLS 1.3 encryption in transit; AES-256 encryption at rest for databases and token secrets.</li>
          <li style={{ marginBottom: 4 }}><strong>Multi-Tenant Isolation:</strong> Logical database boundary segregation preventing cross-workspace data leakage.</li>
          <li style={{ marginBottom: 4 }}><strong>Access Governance:</strong> Role-based access control (RBAC), multi-factor authentication, and privileged credential rotation.</li>
        </ul>
      </section>

      <section id="data-breach" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          7. Personal Data Breach Notification
        </h2>
        <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, padding: "12px 14px", margin: "12px 0", color: "#991B1B", fontSize: 13 }}>
          <strong>72-Hour Notification Commitment:</strong> In the event of a confirmed Personal Data Breach affecting Customer Personal Data, ProxiPilot shall notify Customer without undue delay and in any event within <strong>72 hours</strong> of becoming aware of the incident. We will supply relevant technical forensic details to assist Customer in fulfilling statutory notification obligations.
        </div>
      </section>

      <section id="dsr-assistance" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          8. Data Subject Rights Assistance
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Taking into account the nature of the processing, Processor provides reasonable technical assistance to enable Customer to respond to requests from Data Subjects exercising rights of access, rectification, erasure, or portability through our <Link href="/privacy-request" style={{ color: "#2563EB", fontWeight: 600 }}>Privacy Request Portal</Link>.
        </p>
      </section>

      <section id="deletion-return" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          9. Deletion &amp; Return of Personal Data
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Upon termination of the Service, Processor shall, at Customer&rsquo;s election, delete or return all Customer Personal Data within <strong>30 calendar days</strong>, deleting existing copies unless applicable law mandates continued retention.
        </p>
      </section>

      <section id="international" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          10. International Transfers &amp; EU SCCs
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Where Personal Data originating from the European Economic Area or UK is transferred to countries lacking an adequacy decision, the European Commission&rsquo;s Standard Contractual Clauses (Commission Implementing Decision (EU) 2021/914, Module 2 Controller-to-Processor) are hereby incorporated by reference as an integral Schedule of this DPA.
        </p>
      </section>

      <section id="audits" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          11. Audits &amp; Compliance Reviews
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Processor shall make available to Customer information reasonably necessary to demonstrate compliance with GDPR Article 28 obligations upon written request to <a href="mailto:privacy@proxipilot.com" style={{ color: "#2563EB" }}>privacy@proxipilot.com</a>.
        </p>
      </section>
    </LegalPageShell>
  );
}
