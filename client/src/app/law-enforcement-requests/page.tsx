import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Law Enforcement & Government Requests Policy — ProxiPilot",
  description:
    "Standards, verification procedures, MLAT requirements, and customer notification guidelines for government and law enforcement data requests.",
  alternates: { canonical: "https://proxipilot.com/law-enforcement-requests" },
};

const TOC_ITEMS = [
  { id: "principles", title: "1. Guiding Principles" },
  { id: "legal-process", title: "2. Requirements for Valid Legal Process" },
  { id: "international-requests", title: "3. International Requests & MLAT Procedure" },
  { id: "customer-notice", title: "4. Customer Notification Policy" },
  { id: "emergency-requests", title: "5. Emergency Requests" },
  { id: "service-instructions", title: "6. How to Serve Legal Process" },
  { id: "cost-reimbursement", title: "7. Statutory Cost Reimbursement" },
];

export default function LawEnforcementPage() {
  return (
    <LegalPageShell policyKey="law-enforcement-requests" tocItems={TOC_ITEMS}>
      <section id="principles" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          1. Guiding Principles
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          At ProxiPilot (operated by <strong>Cheldain</strong>), we are committed to safeguarding customer data confidentiality against overbroad or unlawful governmental intrusion. We disclose customer information only when strictly compelled by valid, binding legal process issued by a court of competent jurisdiction.
        </p>
      </section>

      <section id="legal-process" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          2. Requirements for Valid Legal Process
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          We scrutinize every government request to ensure it meets statutory standards:
        </p>
        <ul style={{ paddingLeft: 20, margin: "0 0 10px", fontSize: 14, color: "#334155" }}>
          <li style={{ marginBottom: 4 }}><strong>Subpoenas / Court Orders:</strong> Required for the disclosure of non-content subscriber records (such as account creation dates, names, IP addresses, and billing identifiers).</li>
          <li style={{ marginBottom: 4 }}><strong>Search Warrants:</strong> A valid search warrant issued under the Federal Rules of Criminal Procedure or equivalent statutory probable cause standard is required for the disclosure of stored communications content (such as email drafts or prompt bodies).</li>
          <li style={{ marginBottom: 4 }}><strong>Narrow Scope:</strong> We reject requests that are vague, overbroad, or lack clear relevance to a specific criminal proceeding.</li>
        </ul>
      </section>

      <section id="international-requests" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          3. International Requests &amp; MLAT Procedure
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Cheldain is an entity incorporated and operating in India. Non-Indian and non-US law enforcement agencies seeking customer data must follow diplomatic channels via a <strong>Mutual Legal Assistance Treaty (MLAT)</strong> or letters rogatory to domestic judicial authorities.
        </p>
      </section>

      <section id="customer-notice" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          4. Customer Notification Policy
        </h2>
        <div style={{ backgroundColor: "#F8FAFC", borderLeft: "3px solid #2563EB", padding: "10px 14px", margin: "12px 0", fontSize: 13, color: "#334155" }}>
          <strong>Notice Default:</strong> It is our standard policy to notify the affected customer before disclosing any customer data, providing them an opportunity to seek protective judicial relief. We withhold notice only when legally prohibited by a valid statutory non-disclosure order signed by a judge, or in extraordinary circumstances involving imminent danger.
        </div>
      </section>

      <section id="emergency-requests" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          5. Emergency Requests
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          In emergencies involving imminent threat of death or serious physical harm to any person, law enforcement may submit an expedited emergency disclosure request detailing the nature of the emergency, the identity of the person in danger, and the specific information needed to prevent the threat.
        </p>
      </section>

      <section id="service-instructions" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          6. How to Serve Legal Process
        </h2>
        <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 6, padding: "14px 16px", marginTop: 10, maxWidth: 500 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Legal Process Service Desk</div>
          <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>Cheldain — Legal Operations</div>
          <div style={{ fontSize: 13, color: "#2563EB", marginTop: 6 }}>
            Official Email: <a href="mailto:legal@proxipilot.com" style={{ color: "#2563EB", fontWeight: 600 }}>legal@proxipilot.com</a>
          </div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>
            Subject line: <code>[Legal Process / Government Request]</code>
          </div>
        </div>
      </section>

      <section id="cost-reimbursement" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          7. Statutory Cost Reimbursement
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Where permitted by law (such as 18 U.S.C. § 2706), Cheldain reserves the right to seek reimbursement for costs incurred in responding to subpoenas and court orders.
        </p>
      </section>
    </LegalPageShell>
  );
}
