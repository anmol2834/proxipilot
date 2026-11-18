import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import { VERIFIED_SUBPROCESSORS } from "@/config/legal";
import { IconExternalLink, IconShieldCheck } from "@tabler/icons-react";

export const metadata: Metadata = {
  title: "Subprocessors List — ProxiPilot",
  description:
    "Official directory of third-party subprocessors authorized by Cheldain to process customer data for ProxiPilot, including infrastructure, AI models, and payment providers.",
  alternates: { canonical: "https://proxipilot.com/subprocessors" },
};

const TOC_ITEMS = [
  { id: "overview", title: "1. Overview & Policy" },
  { id: "subprocessor-table", title: "2. Authorized Subprocessors Directory" },
  { id: "vetting", title: "3. Due Diligence & Security Standards" },
  { id: "updates-notification", title: "4. Notification of Changes" },
  { id: "objection", title: "5. Right to Object" },
];

export default function SubprocessorsPage() {
  return (
    <LegalPageShell policyKey="subprocessors" tocItems={TOC_ITEMS}>
      <section id="overview" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          1. Overview &amp; Policy
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          To deliver the ProxiPilot AI email platform, <strong>Cheldain</strong> engages vetted third-party vendors (&ldquo;Subprocessors&rdquo;) to provide cloud hosting, database management, AI inference, and merchant billing services. Pursuant to our <Link href="/dpa" style={{ color: "#2563EB", fontWeight: 600 }}>Data Processing Agreement (DPA)</Link>, this page provides our official, updated subprocessor directory.
        </p>
      </section>

      <section id="subprocessor-table" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          2. Authorized Subprocessors Directory
        </h2>
        <div style={{ overflowX: "auto", border: "1px solid #E2E8F0", borderRadius: 6, marginBottom: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
            <thead>
              <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                <th style={{ padding: "10px 12px", color: "#475569", fontWeight: 600 }}>Subprocessor</th>
                <th style={{ padding: "10px 12px", color: "#475569", fontWeight: 600 }}>Category</th>
                <th style={{ padding: "10px 12px", color: "#475569", fontWeight: 600 }}>Purpose</th>
                <th style={{ padding: "10px 12px", color: "#475569", fontWeight: 600 }}>Data Processed</th>
                <th style={{ padding: "10px 12px", color: "#475569", fontWeight: 600 }}>Location</th>
                <th style={{ padding: "10px 12px", color: "#475569", fontWeight: 600 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {VERIFIED_SUBPROCESSORS.map((sp) => (
                <tr key={sp.name} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 600, color: "#0F172A" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {sp.name}
                      <a
                        href={sp.privacyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#94A3B8", display: "inline-flex" }}
                        title="View Privacy Policy"
                      >
                        <IconExternalLink size={13} />
                      </a>
                    </div>
                  </td>
                  <td style={{ padding: "10px 12px", color: "#64748B" }}>{sp.category}</td>
                  <td style={{ padding: "10px 12px", color: "#334155" }}>{sp.purpose}</td>
                  <td style={{ padding: "10px 12px", color: "#475569", fontSize: 12 }}>{sp.dataProcessed}</td>
                  <td style={{ padding: "10px 12px", color: "#64748B" }}>{sp.region}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 6px",
                        fontSize: 11,
                        fontWeight: 600,
                        borderRadius: 4,
                        background: sp.status === "Active" ? "#DCFCE7" : "#F1F5F9",
                        color: sp.status === "Active" ? "#166534" : "#475569",
                      }}
                    >
                      {sp.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="vetting" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          3. Due Diligence &amp; Security Standards
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Before onboarding any subprocessor, Cheldain conducts stringent security and legal evaluations:
        </p>
        <ul style={{ paddingLeft: 20, margin: "0 0 10px", fontSize: 14, color: "#334155" }}>
          <li style={{ marginBottom: 4 }}>Execution of Data Processing Agreements with European Commission Standard Contractual Clauses (SCCs).</li>
          <li style={{ marginBottom: 4 }}>Verification of enterprise certifications (SOC 2 Type II, ISO 27001, or equivalent).</li>
          <li style={{ marginBottom: 4 }}>Enforcement of zero-training API agreements ensuring customer data is not used for model training.</li>
          <li style={{ marginBottom: 4 }}>Mandatory AES-256 data encryption at rest and TLS 1.3 in transit.</li>
        </ul>
      </section>

      <section id="updates-notification" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          4. Notification of Changes
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          We notify customers at least <strong>14 days in advance</strong> before engaging any new subprocessor. Notifications are posted directly to this page and distributed via email to subscribed workspace account administrators.
        </p>
      </section>

      <section id="objection" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          5. Right to Object
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          In accordance with our DPA, Customers may object on reasonable data protection grounds to the onboarding of a new subprocessor by emailing <a href="mailto:privacy@proxipilot.com" style={{ color: "#2563EB", fontWeight: 600 }}>privacy@proxipilot.com</a> within 14 calendar days of receiving notification.
        </p>
      </section>
    </LegalPageShell>
  );
}
