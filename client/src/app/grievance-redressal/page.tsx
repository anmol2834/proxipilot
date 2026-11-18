import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Grievance Redressal Policy — ProxiPilot",
  description:
    "Grievance redressal mechanism and Grievance Officer details for ProxiPilot (Cheldain) in compliance with Information Technology Rules and the Digital Personal Data Protection Act (DPDPA).",
  alternates: { canonical: "https://proxipilot.com/grievance-redressal" },
};

const TOC_ITEMS = [
  { id: "statutory", title: "1. Statutory Mandate & Scope" },
  { id: "officer", title: "2. Designated Grievance Officer Details" },
  { id: "submission", title: "3. How to Submit a Grievance" },
  { id: "timelines", title: "4. Acknowledgment & Resolution Timelines" },
  { id: "categories", title: "5. Scope of Addressable Grievances" },
  { id: "escalation", title: "6. Regulatory Escalation & Appellate Avenues" },
];

export default function GrievanceRedressalPage() {
  return (
    <LegalPageShell policyKey="grievance-redressal" tocItems={TOC_ITEMS}>
      <section id="statutory" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          1. Statutory Mandate &amp; Scope
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          In accordance with the <strong>Information Technology Act, 2000</strong>, the <strong>Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021</strong>, and the <strong>Digital Personal Data Protection Act (DPDPA), 2023</strong>, ProxiPilot (operated by <strong>Cheldain</strong>, an entity based in India) has established this formal Grievance Redressal Mechanism to address user concerns, complaints, and statutory data protection rights.
        </p>
      </section>

      <section id="officer" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          2. Designated Grievance Officer Details
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Our designated Resident Grievance Officer appointed pursuant to Rule 3(2) of the IT Rules is available for receiving and redressing consumer and privacy grievances:
        </p>
        <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: 8, padding: "16px 20px", margin: "14px 0", maxWidth: 520, boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Designated Resident Grievance Officer
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", marginTop: 4 }}>
            Grievance Officer &amp; Compliance Lead
          </div>
          <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>
            <strong>Entity:</strong> Cheldain (Operating ProxiPilot)
          </div>
          <div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>
            <strong>Operating Jurisdiction:</strong> India
          </div>
          <div style={{ fontSize: 13, color: "#2563EB", marginTop: 6 }}>
            <strong>Grievance Desk Email:</strong>{" "}
            <a href="mailto:grievance@proxipilot.com" style={{ color: "#2563EB", fontWeight: 600 }}>grievance@proxipilot.com</a>
          </div>
          <div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>
            <strong>Secondary Legal Escalation:</strong>{" "}
            <a href="mailto:legal@proxipilot.com" style={{ color: "#2563EB" }}>legal@proxipilot.com</a>
          </div>
        </div>
      </section>

      <section id="submission" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          3. How to Submit a Grievance
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          To ensure timely investigation and verifiable documentation, grievances should be transmitted electronically to <a href="mailto:grievance@proxipilot.com" style={{ color: "#2563EB" }}>grievance@proxipilot.com</a> with the subject line <code>[Grievance] - [Your Workspace/Account Name]</code> and include:
        </p>
        <ul style={{ paddingLeft: 20, margin: "0 0 10px", fontSize: 14, color: "#334155" }}>
          <li style={{ marginBottom: 4 }}>Full name and registered business email associated with your ProxiPilot workspace.</li>
          <li style={{ marginBottom: 4 }}>A clear, factual summary of the grievance, including specific dates, URLs, affected mailboxes, or system actions.</li>
          <li style={{ marginBottom: 4 }}>Relevant supporting documentation, screenshots, or email logs.</li>
          <li style={{ marginBottom: 4 }}>A statement confirming that the facts submitted are true and accurate to the best of your knowledge.</li>
        </ul>
      </section>

      <section id="timelines" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          4. Acknowledgment &amp; Resolution Timelines
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          In accordance with statutory timelines:
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "12px 0" }}>
          <div style={{ border: "1px solid #BBF7D0", background: "#F0FDF4", padding: "14px", borderRadius: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#166534", textTransform: "uppercase" }}>Acknowledgment</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#15803D", marginTop: 4 }}>Within 24 Hours</div>
            <p style={{ fontSize: 12, color: "#166534", margin: "4px 0 0" }}>Issuance of a formal grievance ticket number and acknowledgment of receipt.</p>
          </div>
          <div style={{ border: "1px solid #BFDBFE", background: "#EFF6FF", padding: "14px", borderRadius: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1E40AF", textTransform: "uppercase" }}>Resolution</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#1D4ED8", marginTop: 4 }}>Within 15 Days</div>
            <p style={{ fontSize: 12, color: "#1E40AF", margin: "4px 0 0" }}>Substantive investigation, remediation action, and formal written response.</p>
          </div>
        </div>
      </section>

      <section id="categories" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          5. Scope of Addressable Grievances
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          The Grievance Desk investigates matters involving:
        </p>
        <ul style={{ paddingLeft: 20, margin: "0 0 10px", fontSize: 14, color: "#334155" }}>
          <li style={{ marginBottom: 4 }}>Data protection and personal data rights under DPDPA 2023 or GDPR.</li>
          <li style={{ marginBottom: 4 }}>Allegations of platform abuse, unauthorized email generation, or intellectual property infringement.</li>
          <li style={{ marginBottom: 4 }}>Security vulnerabilities or unauthorized mailbox synchronization access.</li>
          <li style={{ marginBottom: 4 }}>Compliance with intermediary guidelines and statutory notices.</li>
        </ul>
      </section>

      <section id="escalation" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          6. Regulatory Escalation &amp; Appellate Avenues
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          If an Indian resident is unsatisfied with the resolution provided by our Grievance Officer, they may appeal the decision to the <strong>Grievance Appellate Committee (GAC)</strong> established by the Central Government of India via the online portal at <a href="https://gac.gov.in" target="_blank" rel="noopener noreferrer" style={{ color: "#2563EB" }}>gac.gov.in</a> within 30 days of receipt of our communication.
        </p>
      </section>
    </LegalPageShell>
  );
}
