import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Email Sending & Anti-Spam Policy — ProxiPilot",
  description:
    "ProxiPilot email deliverability guidelines, anti-spam rules, DMARC/SPF authentication standards, and bounce threshold limits for connected mailboxes.",
  alternates: { canonical: "https://proxipilot.com/email-sending-policy" },
};

const TOC_ITEMS = [
  { id: "overview", title: "1. Policy Overview & Scope" },
  { id: "consent", title: "2. Recipient Consent & Contact Sourcing" },
  { id: "auth", title: "3. Email Authentication (SPF, DKIM, DMARC)" },
  { id: "thresholds", title: "4. Deliverability Metrics & Hard Thresholds" },
  { id: "unsubscribe", title: "5. Mandatory Unsubscribe & Opt-Out Handling" },
  { id: "bulk-requirements", title: "6. Compliance with Google & Yahoo 2024+ Sender Mandates" },
  { id: "remediation", title: "7. Account Pauses & Remediation Procedure" },
];

export default function EmailSendingPolicyPage() {
  return (
    <LegalPageShell policyKey="email-sending-policy" tocItems={TOC_ITEMS}>
      <section id="overview" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          1. Policy Overview &amp; Scope
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          ProxiPilot is engineered to empower legitimate B2B enterprises to draft, manage, and dispatch professional business emails. This Email Sending &amp; Anti-Spam Policy outlines deliverability standards, anti-abuse safeguards, and technical sender requirements that all customers must maintain when connecting mailboxes to ProxiPilot.
        </p>
      </section>

      <section id="consent" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          2. Recipient Consent &amp; Contact Sourcing
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          All outbound communications facilitated through ProxiPilot must be directed strictly to recipients who have an existing commercial relationship with your business or who have provided affirmative opt-in consent:
        </p>
        <ul style={{ paddingLeft: 20, margin: "0 0 10px", fontSize: 14, color: "#334155" }}>
          <li style={{ marginBottom: 4 }}><strong>Prohibition of Purchased Lists:</strong> You must not send emails to lists acquired through brokers, third-party sales directories, or automated web scrapers.</li>
          <li style={{ marginBottom: 4 }}><strong>Role-Based Addresses:</strong> Avoid sending cold outreach to shared role addresses (e.g., <em>sales@, info@, support@, admin@</em>) unless directly engaged in an active business dialogue.</li>
          <li style={{ marginBottom: 4 }}><strong>List Hygiene:</strong> Customers must actively prune obsolete contacts, invalid domains, and unresponsive recipients prior to executing automated sequences.</li>
        </ul>
      </section>

      <section id="auth" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          3. Email Authentication (SPF, DKIM, DMARC)
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          To ensure reliable inbox placement and defend against domain spoofing, connected sending domains must configure industry-standard DNS authentication:
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, margin: "12px 0" }}>
          <div style={{ border: "1px solid #E2E8F0", borderRadius: 6, padding: "12px", background: "#FFFFFF" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>SPF (Sender Policy Framework)</div>
            <p style={{ fontSize: 12, color: "#64748B", margin: "4px 0 0" }}>Authorizes Google Workspace or Microsoft 365 mail servers to transmit on your domain&rsquo;s behalf.</p>
          </div>
          <div style={{ border: "1px solid #E2E8F0", borderRadius: 6, padding: "12px", background: "#FFFFFF" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>DKIM (DomainKeys Identified Mail)</div>
            <p style={{ fontSize: 12, color: "#64748B", margin: "4px 0 0" }}>Cryptographically signs outbound message headers to prove transmission authenticity.</p>
          </div>
          <div style={{ border: "1px solid #E2E8F0", borderRadius: 6, padding: "12px", background: "#FFFFFF" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>DMARC Policy</div>
            <p style={{ fontSize: 12, color: "#64748B", margin: "4px 0 0" }}>Defines receiving server policies (none, quarantine, reject) for unauthenticated messages.</p>
          </div>
        </div>
      </section>

      <section id="thresholds" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          4. Deliverability Metrics &amp; Hard Thresholds
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          ProxiPilot enforces strict automated deliverability safety thresholds across all connected accounts:
        </p>
        <div style={{ overflowX: "auto", border: "1px solid #E2E8F0", borderRadius: 6, marginBottom: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
            <thead>
              <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                <th style={{ padding: "8px 12px", color: "#475569", fontWeight: 600 }}>Metric</th>
                <th style={{ padding: "8px 12px", color: "#475569", fontWeight: 600 }}>Acceptable Limit</th>
                <th style={{ padding: "8px 12px", color: "#475569", fontWeight: 600 }}>Action Triggered When Exceeded</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                <td style={{ padding: "8px 12px", fontWeight: 600, color: "#0F172A" }}>Spam Complaint Rate</td>
                <td style={{ padding: "8px 12px", color: "#166534" }}>&lt; 0.10% (1 per 1,000)</td>
                <td style={{ padding: "8px 12px", color: "#991B1B" }}>Immediate sequence pause; account review</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                <td style={{ padding: "8px 12px", fontWeight: 600, color: "#0F172A" }}>Hard Bounce Rate</td>
                <td style={{ padding: "8px 12px", color: "#166534" }}>&lt; 3.0%</td>
                <td style={{ padding: "8px 12px", color: "#991B1B" }}>Warning notice; list re-verification required</td>
              </tr>
              <tr>
                <td style={{ padding: "8px 12px", fontWeight: 600, color: "#0F172A" }}>Unsubscribe Rate</td>
                <td style={{ padding: "8px 12px", color: "#166534" }}>&lt; 1.0%</td>
                <td style={{ padding: "8px 12px", color: "#991B1B" }}>Content optimization recommendations</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="unsubscribe" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          5. Mandatory Unsubscribe &amp; Opt-Out Handling
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Any commercial email sequence sent through ProxiPilot must provide a clear, conspicuous mechanism for recipients to opt out of future communications:
        </p>
        <ul style={{ paddingLeft: 20, margin: "0 0 10px", fontSize: 14, color: "#334155" }}>
          <li style={{ marginBottom: 4 }}>Opt-out requests must be honored automatically or manually within <strong>24 business hours</strong> (and no later than statutory deadlines).</li>
          <li style={{ marginBottom: 4 }}>Once an address unsubscribes, ProxiPilot suppresses all automated email actions to that contact permanently.</li>
          <li style={{ marginBottom: 4 }}>You must not obscure or bury unsubscribe links with low-contrast fonts, misleading anchors, or multi-step confirmation hurdles.</li>
        </ul>
      </section>

      <section id="bulk-requirements" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          6. Compliance with Google &amp; Yahoo 2024+ Sender Mandates
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Major mail providers (Google Workspace and Yahoo Mail) mandate that high-volume senders: (a) enforce full SPF/DKIM alignment; (b) publish a valid DMARC record; (c) support RFC 8058 one-click unsubscribe headers; and (d) maintain reported spam complaint rates strictly below 0.3%. ProxiPilot automatically injects RFC-compliant headers when sending on supported connections.
        </p>
      </section>

      <section id="remediation" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          7. Account Pauses &amp; Remediation Procedure
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          If an account exceeds deliverability thresholds, ProxiPilot will trigger an automated protection pause. Account administrators will receive an email detailing the issue. To resume sending, the customer must submit verification of list hygiene, update DNS authentication records, or reconfigure campaign targeting. Repeated violations will result in permanent account termination.
        </p>
      </section>
    </LegalPageShell>
  );
}
