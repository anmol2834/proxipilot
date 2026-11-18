import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Acceptable Use Policy — ProxiPilot",
  description:
    "Standards, conduct guidelines, and prohibited activities for users of ProxiPilot. Zero-tolerance policy for spam, deceptive email practices, and AI abuse.",
  alternates: { canonical: "https://proxipilot.com/acceptable-use" },
};

const TOC_ITEMS = [
  { id: "purpose", title: "1. Purpose & Scope" },
  { id: "prohibited", title: "2. Prohibited Email & Content Activities" },
  { id: "ai-abuse", title: "3. Prohibited AI & Automation Abuse" },
  { id: "infrastructure", title: "4. System Integrity & Security Rules" },
  { id: "statutory", title: "5. Mandatory Legal Compliance (CAN-SPAM, GDPR, CASL)" },
  { id: "monitoring", title: "6. Monitoring & Automated Safeguards" },
  { id: "enforcement", title: "7. Violations & Zero-Tolerance Termination" },
  { id: "reporting", title: "8. Reporting Abuse" },
];

export default function AcceptableUsePage() {
  return (
    <LegalPageShell policyKey="acceptable-use" tocItems={TOC_ITEMS}>
      <section id="purpose" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          1. Purpose &amp; Scope
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          This Acceptable Use Policy (&ldquo;AUP&rdquo;) governs the use of ProxiPilot, operated by <strong>Cheldain</strong>. This policy protects the deliverability reputation of connected email infrastructure, prevents abusive communications, and guarantees compliance with global anti-spam statutes. Every user and organization must adhere to these rules.
        </p>
      </section>

      <section id="prohibited" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          2. Prohibited Email &amp; Content Activities
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          You may not use ProxiPilot to compose, optimize, or transmit:
        </p>
        <ul style={{ paddingLeft: 20, margin: "0 0 10px", fontSize: 14, color: "#334155" }}>
          <li style={{ marginBottom: 4 }}><strong>Unsolicited Commercial Spam:</strong> Sending unsolicited mass bulk messages to recipients who have not given verifiable affirmative consent or with whom you do not have an existing commercial relationship.</li>
          <li style={{ marginBottom: 4 }}><strong>Third-Party or Scraped Lists:</strong> Importing, uploading, or emailing contacts acquired through automated scraping, purchased databases, or rented directories.</li>
          <li style={{ marginBottom: 4 }}><strong>Phishing &amp; Social Engineering:</strong> Impersonating executives, financial institutions, government bodies, or fabricating deceptive invoices, banking alerts, or credentials requests.</li>
          <li style={{ marginBottom: 4 }}><strong>Deceptive Subject Lines &amp; Headers:</strong> Using misleading subject lines, falsified sender domains, or forged email header metadata.</li>
          <li style={{ marginBottom: 4 }}><strong>Malicious Payloads:</strong> Distributing trojans, spyware, ransomware, malicious macros, or tracking links designed to compromise recipient machines.</li>
          <li style={{ marginBottom: 4 }}><strong>Illicit or Harmful Goods:</strong> Promoting illegal pharmaceuticals, counterfeit merchandise, adult services, predatory loans, or multi-level marketing (MLM) schemes.</li>
        </ul>
      </section>

      <section id="ai-abuse" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          3. Prohibited AI &amp; Automation Abuse
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          When leveraging ProxiPilot&rsquo;s AI copilots and prompt tuning engines, you strictly agree NOT to:
        </p>
        <ul style={{ paddingLeft: 20, margin: "0 0 10px", fontSize: 14, color: "#334155" }}>
          <li style={{ marginBottom: 4 }}>Attempt prompt injections, system jailbreaks, or attacks designed to bypass foundation model safety guardrails.</li>
          <li style={{ marginBottom: 4 }}>Generate automated hate speech, defamation, harassment, or discriminatory communications.</li>
          <li style={{ marginBottom: 4 }}>Automate high-velocity synthetic spam permutations designed to evade recipient spam filters (&ldquo;filter evasion&rdquo;).</li>
          <li style={{ marginBottom: 4 }}>Use model outputs to train competing artificial intelligence algorithms or language models.</li>
        </ul>
      </section>

      <section id="infrastructure" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          4. System Integrity &amp; Security Rules
        </h2>
        <ul style={{ paddingLeft: 20, margin: "0 0 10px", fontSize: 14, color: "#334155" }}>
          <li style={{ marginBottom: 4 }}>Do not probe, scan, or test the vulnerability of ProxiPilot infrastructure without explicit written authorization.</li>
          <li style={{ marginBottom: 4 }}>Do not perform denial-of-service (DoS/DDoS) attacks, flood API gateways, or circumvent account rate limits.</li>
          <li style={{ marginBottom: 4 }}>Do not share user credentials outside your registered corporate workspace.</li>
          <li style={{ marginBottom: 4 }}>Do not attempt to access another organization&rsquo;s isolated multi-tenant data or mailbox tokens.</li>
        </ul>
      </section>

      <section id="statutory" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          5. Mandatory Legal Compliance (CAN-SPAM, GDPR, CASL)
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Customers sending commercial emails must strictly abide by all applicable national and international statutes:
        </p>
        <div style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "12px 14px", margin: "12px 0", fontSize: 13, color: "#334155" }}>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li><strong>CAN-SPAM Act (United States):</strong> Include a valid physical postal address and a functional, one-click opt-out / unsubscribe mechanism honored within 10 business days.</li>
            <li><strong>GDPR &amp; PECR (European Union / UK):</strong> Ensure lawful basis for processing (e.g., prior opt-in consent or verified legitimate interest under ePrivacy rules).</li>
            <li><strong>CASL (Canada):</strong> Maintain explicit or documented implied consent records and sender identification.</li>
          </ul>
        </div>
      </section>

      <section id="monitoring" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          6. Monitoring &amp; Automated Safeguards
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          To protect platform integrity and shared IP reputation, ProxiPilot deploys automated rate-limiting, bounce-tracking, and reputation monitoring algorithms. If an account generates abnormal hard bounce spikes (&gt;5%) or elevated spam complaint rates (&gt;0.1%), automated protective pauses may be initiated immediately.
        </p>
      </section>

      <section id="enforcement" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          7. Violations &amp; Zero-Tolerance Termination
        </h2>
        <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, padding: "12px 14px", margin: "12px 0", fontSize: 13, color: "#991B1B" }}>
          <strong>Zero Tolerance:</strong> Any confirmed violation of this Acceptable Use Policy will result in immediate suspension or permanent termination of the offending account, revocation of mailbox tokens, and forfeiture of all prepaid subscription fees.
        </div>
      </section>

      <section id="reporting" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          8. Reporting Abuse
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          If you believe a ProxiPilot customer is transmitting spam, phishing messages, or violating this policy, please forward the complete email headers to <a href="mailto:abuse@proxipilot.com" style={{ color: "#2563EB", fontWeight: 600 }}>abuse@proxipilot.com</a>. Our security team investigates all reports within 24 hours.
        </p>
      </section>
    </LegalPageShell>
  );
}
