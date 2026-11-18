import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Service Level Agreement (SLA) & Support — ProxiPilot",
  description:
    "ProxiPilot service level agreement, 99.9% uptime targets, support severity tiers, response time commitments, and maintenance procedures.",
  alternates: { canonical: "https://proxipilot.com/sla" },
};

const TOC_ITEMS = [
  { id: "commitment", title: "1. Uptime Target & Commitment" },
  { id: "severity-tiers", title: "2. Incident Severity Levels & Response Times" },
  { id: "support-channels", title: "3. Support Hours & Channels" },
  { id: "maintenance", title: "4. Maintenance Windows & Notice" },
  { id: "exclusions", title: "5. SLA Exclusions & Upstream Outages" },
  { id: "credits", title: "6. Service Credits & Claims Procedure" },
];

export default function SlaPage() {
  return (
    <LegalPageShell policyKey="sla" tocItems={TOC_ITEMS}>
      <section id="commitment" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          1. Uptime Target &amp; Commitment
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          ProxiPilot (operated by <strong>Cheldain</strong>) targets an operational uptime of <strong>99.9%</strong> during each calendar month, excluding scheduled maintenance. Uptime is calculated as total operational minutes minus unplanned downtime, divided by total minutes in the billing period.
        </p>
      </section>

      <section id="severity-tiers" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          2. Incident Severity Levels &amp; Response Times
        </h2>
        <div style={{ overflowX: "auto", border: "1px solid #E2E8F0", borderRadius: 6, marginBottom: 14 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
            <thead>
              <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                <th style={{ padding: "8px 12px", color: "#475569", fontWeight: 600 }}>Severity Level</th>
                <th style={{ padding: "8px 12px", color: "#475569", fontWeight: 600 }}>Impact Definition</th>
                <th style={{ padding: "8px 12px", color: "#475569", fontWeight: 600 }}>Target Response</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                <td style={{ padding: "8px 12px", fontWeight: 700, color: "#DC2626" }}>Severity 1 (Critical)</td>
                <td style={{ padding: "8px 12px", color: "#334155" }}>Complete platform outage; all users unable to authenticate or generate drafts.</td>
                <td style={{ padding: "8px 12px", color: "#0F172A", fontWeight: 600 }}>&lt; 2 hours (24/7)</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                <td style={{ padding: "8px 12px", fontWeight: 700, color: "#D97706" }}>Severity 2 (Major)</td>
                <td style={{ padding: "8px 12px", color: "#334155" }}>Core feature impaired (e.g., mailbox OAuth sync failure, vector retrieval delay).</td>
                <td style={{ padding: "8px 12px", color: "#0F172A", fontWeight: 600 }}>&lt; 8 business hours</td>
              </tr>
              <tr>
                <td style={{ padding: "8px 12px", fontWeight: 700, color: "#2563EB" }}>Severity 3 (Minor)</td>
                <td style={{ padding: "8px 12px", color: "#334155" }}>UI formatting defect, general product question, or non-critical feature inquiry.</td>
                <td style={{ padding: "8px 12px", color: "#0F172A", fontWeight: 600 }}>&lt; 24 business hours</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="support-channels" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          3. Support Hours &amp; Channels
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Customer support is available via email at <a href="mailto:support@proxipilot.com" style={{ color: "#2563EB", fontWeight: 600 }}>support@proxipilot.com</a>. Standard support hours operate Monday through Friday, 9:00 AM to 6:00 PM IST (Indian Standard Time). Severity 1 critical incident response is monitored 24 hours a day, 7 days a week.
        </p>
      </section>

      <section id="maintenance" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          4. Maintenance Windows &amp; Notice
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Routine maintenance is scheduled during off-peak weekend windows (typically Saturdays between 02:00 UTC and 06:00 UTC). We provide at least <strong>48 hours&rsquo; advance email notice</strong> for scheduled maintenance that may cause temporary service interruptions.
        </p>
      </section>

      <section id="exclusions" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          5. SLA Exclusions &amp; Upstream Outages
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          The 99.9% uptime target excludes downtime resulting from:
        </p>
        <ul style={{ paddingLeft: 20, margin: "0 0 10px", fontSize: 14, color: "#334155" }}>
          <li style={{ marginBottom: 4 }}>Outages or rate limiting of upstream AI inference providers (OpenAI or Anthropic).</li>
          <li style={{ marginBottom: 4 }}>Mailbox provider downtime or API service revocations by Google Workspace or Microsoft 365.</li>
          <li style={{ marginBottom: 4 }}>Customer network failures, misconfigured DNS records, or unauthorized account modifications.</li>
          <li style={{ marginBottom: 4 }}>Account suspensions executed under our <Link href="/acceptable-use" style={{ color: "#2563EB" }}>Acceptable Use Policy</Link>.</li>
          <li style={{ marginBottom: 4 }}>Force majeure events, government actions, or wide-area internet routing failures.</li>
        </ul>
      </section>

      <section id="credits" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          6. Service Credits &amp; Claims Procedure
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          If monthly availability falls below 99.0% due strictly to ProxiPilot platform faults, enterprise subscribers may claim a 10% credit towards their next billing cycle by submitting an incident claim to <a href="mailto:billing@proxipilot.com" style={{ color: "#2563EB" }}>billing@proxipilot.com</a> within 30 days of the qualifying incident. Service credits represent Customer&rsquo;s sole and exclusive remedy for availability breaches.
        </p>
      </section>
    </LegalPageShell>
  );
}
