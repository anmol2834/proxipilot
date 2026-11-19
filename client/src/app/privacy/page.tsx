import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Privacy Policy — ProxiPilot",
  description:
    "ProxiPilot Privacy Policy operated by Cheldain. Learn how we collect, process, and protect customer email data, AI prompts, OAuth tokens, and compliance with GDPR, CCPA, and Google API Limited Use requirements.",
  alternates: { canonical: "https://proxipilot.com/privacy" },
};

const TOC_ITEMS = [
  { id: "collection", title: "1. Information We Collect" },
  { id: "usage", title: "2. How We Use Customer Data" },
  { id: "ai-processors", title: "3. Third-Party AI Processors & Zero-Training" },
  { id: "integrations", title: "4. Email Integrations & Google Limited Use" },
  { id: "sharing", title: "5. Data Sharing & Third Parties" },
  { id: "cookies", title: "6. Cookies & Tracking Technologies" },
  { id: "retention", title: "7. Data Retention & Deletion Lifecycle" },
  { id: "rights", title: "8. Your Privacy Rights (GDPR, CCPA, Global)" },
  { id: "security", title: "9. Technical & Organizational Security Measures" },
  { id: "children", title: "10. Children's Privacy Notice" },
  { id: "transfers", title: "11. International Cross-Border Data Transfers" },
  { id: "changes", title: "12. Amendments & Notification" },
  { id: "contact", title: "13. Privacy Contact & DPO Office" },
];

export default function PrivacyPage() {
  return (
    <LegalPageShell policyKey="privacy" tocItems={TOC_ITEMS}>
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.62, margin: "0 0 12px" }}>
          At ProxiPilot (operated by <strong>Cheldain</strong>, &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), we take your corporate privacy and data protection seriously. This Privacy Policy details the exact categories of data we collect, why we process them, the robust safeguards we enforce, and how you may exercise your legal privacy rights.
        </p>
      </div>

      {/* 1. What We Collect */}
      <section id="collection" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          1. Information We Collect
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          We collect only the minimum data strictly required to deliver, secure, and operate ProxiPilot.
        </p>

        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1E293B", margin: "14px 0 6px" }}>1.1 Account &amp; Profile Information</h3>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          When you register, we collect your full name, business email address, company name, and encrypted account authentication credentials (passwords are hashed using industry-standard bcrypt or Argon2 &mdash; never stored in plaintext).
        </p>

        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1E293B", margin: "14px 0 6px" }}>1.2 Email Content &amp; AI Prompts</h3>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Prompts, instructions, knowledge base snippets, and draft messages you provide inside ProxiPilot. When you request AI drafting or tone refinement, relevant thread snippets are sent to vetted AI inference partners (OpenAI, Anthropic) solely to generate the requested output.
        </p>

        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1E293B", margin: "14px 0 6px" }}>1.3 Email Integration Data</h3>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          When you connect Gmail or Microsoft Outlook, we receive and store encrypted OAuth tokens required to sync, compose, draft, and dispatch messages on your behalf. We do not download or store your historical inbox archive. We access only active threads required to perform the specific automated tasks you configure.
        </p>

        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1E293B", margin: "14px 0 6px" }}>1.4 Payment &amp; Transaction Information</h3>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Payment information is handled entirely by our Merchant of Record partners, currently <strong>Paddle</strong> and/or <strong>Lemon Squeezy</strong>. We store zero raw payment card numbers or CVVs on ProxiPilot infrastructure. We retain only billing identifiers, transaction dates, and subscription tier status.
        </p>

        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1E293B", margin: "14px 0 6px" }}>1.5 Device &amp; Technical Telemetry</h3>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          IP address, browser user-agent, operating system, and system access timestamps are logged automatically for authentication verification, rate limiting, and cybersecurity auditing.
        </p>
      </section>

      {/* 2. How We Use Customer Data */}
      <section id="usage" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          2. How We Use Customer Data
        </h2>
        <ul style={{ paddingLeft: 20, margin: "0 0 10px", fontSize: 14, color: "#334155" }}>
          <li style={{ marginBottom: 4 }}>To authenticate accounts and operate the ProxiPilot web application.</li>
          <li style={{ marginBottom: 4 }}>To power AI email generation by transmitting prompt contexts to inference models.</li>
          <li style={{ marginBottom: 4 }}>To synchronize thread statuses with connected Gmail or Outlook mailboxes.</li>
          <li style={{ marginBottom: 4 }}>To detect, prevent, and mitigate cyber threats, fraud, spamming, and Acceptable Use violations.</li>
          <li style={{ marginBottom: 4 }}>To communicate transactional notices, security alerts, and customer support responses.</li>
        </ul>
        <div style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 6, padding: "10px 14px", margin: "12px 0", fontSize: 13, color: "#166534" }}>
          <strong>Zero Advertising &amp; Zero Sale Guarantee:</strong> We do not sell your personal or corporate data to data brokers or third parties. We do not use customer email contents to serve third-party ads or cross-site tracking.
        </div>
      </section>

      {/* 3. Third-Party AI Processors */}
      <section id="ai-processors" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          3. Third-Party AI Processors &amp; Zero-Training
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          ProxiPilot leverages state-of-the-art enterprise language models provided by <strong>OpenAI</strong> and <strong>Anthropic</strong>. When you invoke AI generation, email prompt snippets and context variables are processed via secured API endpoints.
        </p>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          <strong>Strict Non-Training Policy:</strong> Under our enterprise commercial API agreements with OpenAI and Anthropic, your prompts, corporate emails, and generated drafts are <strong>never used to train foundation models</strong>. Data is processed solely for inference and is subject to provider zero-retention policies.
        </p>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          For further architectural details, consult our <Link href="/security" style={{ color: "#2563EB", fontWeight: 600 }}>Security Center</Link>.
        </p>
      </section>

      {/* 4. Email Integrations & Google Limited Use */}
      <section id="integrations" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          4. Email Integrations &amp; Google API Limited Use
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          ProxiPilot integrates directly with Google Workspace and Microsoft 365. We enforce strict least-privilege OAuth scopes:
        </p>
        <div style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "12px 14px", margin: "12px 0", fontSize: 13, color: "#334155" }}>
          <strong>Google API Limited Use Disclosure:</strong>
          <p style={{ margin: "6px 0 0", lineHeight: 1.5 }}>
            ProxiPilot&rsquo;s use and transfer to any other app of information received from Google APIs will adhere to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#2563EB", textDecoration: "underline" }}
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements. Specifically:
          </p>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            <li>We only use Google user data to provide user-facing email drafting, indexing, and productivity features.</li>
            <li>We do not transfer Google user data to external parties unless necessary to provide the service or comply with law.</li>
            <li>We do not use or transfer Google user data for serving advertisements, including personalized or targeted ads.</li>
            <li>Humans are not permitted to read your email data unless you have provided explicit consent for troubleshooting or it is required for legal and security investigations.</li>
          </ul>
        </div>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          You may disconnect your Gmail or Outlook account at any time within your ProxiPilot workspace settings. Disconnection triggers immediate revocation and purge of stored OAuth tokens.
        </p>
      </section>

      {/* 5. Data Sharing */}
      <section id="sharing" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          5. Data Sharing &amp; Third Parties
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          We share data strictly on a need-to-know basis with trusted subprocessors that support core functionality:
        </p>
        <ul style={{ paddingLeft: 20, margin: "0 0 10px", fontSize: 14, color: "#334155" }}>
          <li style={{ marginBottom: 4 }}><strong>Payment Processors (Paddle / Lemon Squeezy):</strong> Functioning as Merchants of Record for billing and global tax compliance.</li>
          <li style={{ marginBottom: 4 }}><strong>AI Providers (OpenAI, Anthropic):</strong> For transient text generation under non-training terms.</li>
          <li style={{ marginBottom: 4 }}><strong>Cloud &amp; Database Infrastructure (Neon, Redis, Qdrant Cloud):</strong> For isolated multi-tenant data storage and vector search.</li>
          <li style={{ marginBottom: 4 }}><strong>Law Enforcement:</strong> Only when compelled by valid subpoena, court order, or binding legal process pursuant to our <Link href="/law-enforcement-requests" style={{ color: "#2563EB" }}>Law Enforcement Policy</Link>.</li>
        </ul>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Review the complete directory in our <Link href="/subprocessors" style={{ color: "#2563EB", fontWeight: 600 }}>Subprocessors List</Link>.
        </p>
      </section>

      {/* 6. Cookies */}
      <section id="cookies" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          6. Cookies &amp; Tracking Technologies
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          We use strictly necessary cookies to maintain secure sessions and prevent CSRF attacks. Anonymized product analytics cookies help us monitor server latencies and feature usage. We do not deploy third-party advertising or cross-site tracking cookies. Full cookie specifications are documented in our <Link href="/cookies" style={{ color: "#2563EB", fontWeight: 600 }}>Cookie Policy</Link>.
        </p>
      </section>

      {/* 7. Data Retention */}
      <section id="retention" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          7. Data Retention &amp; Deletion Lifecycle
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Account credentials and subscription metadata are retained while your account remains active. When an account is terminated or deleted:
        </p>
        <ul style={{ paddingLeft: 20, margin: "0 0 10px", fontSize: 14, color: "#334155" }}>
          <li style={{ marginBottom: 4 }}>Mailbox OAuth tokens are revoked and deleted <strong>immediately</strong>.</li>
          <li style={{ marginBottom: 4 }}>Email drafts, templates, and vector database embeddings are purged within <strong>30 days</strong>.</li>
          <li style={{ marginBottom: 4 }}>Cryptographic database backups rotate and overwrite within <strong>30 days</strong>.</li>
        </ul>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          For granular retention schedules, see our <Link href="/data-retention" style={{ color: "#2563EB", fontWeight: 600 }}>Data Retention &amp; Deletion Policy</Link>.
        </p>
      </section>

      {/* 8. Your Legal Rights */}
      <section id="rights" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          8. Your Privacy Rights (GDPR, CCPA &amp; Global)
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Depending on your jurisdiction (including the European Economic Area, UK, California, and India), you hold statutory rights regarding your personal information:
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "12px 0" }}>
          <div style={{ padding: "12px", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 6 }}>
            <strong style={{ fontSize: 13, color: "#0F172A" }}>GDPR (EEA &amp; UK):</strong>
            <ul style={{ margin: "6px 0 0", paddingLeft: 16, fontSize: 12, color: "#475569" }}>
              <li>Right of Access &amp; Portability (Art. 15, 20)</li>
              <li>Right to Erasure / Right to be Forgotten (Art. 17)</li>
              <li>Right to Rectification &amp; Restriction (Art. 16, 18)</li>
              <li>Right to Object to Processing (Art. 21)</li>
            </ul>
          </div>
          <div style={{ padding: "12px", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 6 }}>
            <strong style={{ fontSize: 13, color: "#0F172A" }}>CCPA / CPRA (California):</strong>
            <ul style={{ margin: "6px 0 0", paddingLeft: 16, fontSize: 12, color: "#475569" }}>
              <li>Right to Know categories and sources collected</li>
              <li>Right to Delete personal information</li>
              <li>Right to Opt-Out of Sale (automatically honored)</li>
              <li>Right to Non-Discrimination for exercising rights</li>
            </ul>
          </div>
        </div>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          You can exercise any of these rights directly through our self-service <Link href="/privacy-request" style={{ color: "#2563EB", fontWeight: 600 }}>Privacy Request Portal</Link> or by emailing <a href="mailto:privacy@proxipilot.com" style={{ color: "#2563EB" }}>privacy@proxipilot.com</a>. We respond to all verified statutory requests within 30 calendar days.
        </p>
      </section>

      {/* 9. Security */}
      <section id="security" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          9. Technical &amp; Organizational Security Measures
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          We employ defense-in-depth security architecture to safeguard customer data:
        </p>
        <ul style={{ paddingLeft: 20, margin: "0 0 10px", fontSize: 14, color: "#334155" }}>
          <li style={{ marginBottom: 4 }}><strong>Encryption in Transit:</strong> TLS 1.3 encryption across all public web and API endpoints.</li>
          <li style={{ marginBottom: 4 }}><strong>Encryption at Rest:</strong> AES-256 cryptographic storage for databases and token vaults.</li>
          <li style={{ marginBottom: 4 }}><strong>Tenant Isolation:</strong> Logical organization-scoped separation preventing cross-account access.</li>
          <li style={{ marginBottom: 4 }}><strong>Incident Notification:</strong> In the event of a confirmed personal data breach, we will notify affected administrators within <strong>72 hours</strong>.</li>
        </ul>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Explore our architecture at the <Link href="/security" style={{ color: "#2563EB", fontWeight: 600 }}>Security &amp; Trust Center</Link>.
        </p>
      </section>

      {/* 10. Children's Privacy */}
      <section id="children" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          10. Children&rsquo;s Privacy Notice
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          ProxiPilot is strictly an enterprise B2B product. It is not intended for use by minors or individuals under 18 years of age. We do not knowingly collect personal data from minors. If you suspect an unauthorized account has been created by a minor, notify us immediately at <a href="mailto:privacy@proxipilot.com" style={{ color: "#2563EB" }}>privacy@proxipilot.com</a> for immediate deletion.
        </p>
      </section>

      {/* 11. International Transfers */}
      <section id="transfers" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          11. International Cross-Border Data Transfers
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Cheldain operates out of India. Your data may be processed by AI inference and cloud servers located in the United States and the European Union. When transferring personal data internationally, we utilize Standard Contractual Clauses (&ldquo;SCCs&rdquo;) approved by the European Commission and enforce robust technical measures to ensure equivalent protection.
        </p>
      </section>

      {/* 12. Amendments */}
      <section id="changes" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          12. Amendments &amp; Notification
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          We may update this Privacy Policy to reflect evolving regulations, integrations, or security practices. For material revisions, we provide at least <strong>14 days&rsquo; email notification</strong> to registered account owners. The &ldquo;Last Updated&rdquo; timestamp indicates the effective date of the current version.
        </p>
      </section>

      {/* 13. Contact */}
      <section id="contact" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          13. Privacy Contact &amp; Data Protection Office
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          For inquiries or rights enforcement, contact Cheldain&rsquo;s Privacy Office:
        </p>
        <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 6, padding: "14px 16px", marginTop: 10, maxWidth: 500 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Cheldain — Privacy Office</div>
          <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>Operating ProxiPilot (proxipilot.com)</div>
          <div style={{ fontSize: 13, color: "#2563EB", marginTop: 6 }}>
            Email: <a href="mailto:privacy@proxipilot.com" style={{ color: "#2563EB", fontWeight: 600 }}>privacy@proxipilot.com</a>
          </div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 6 }}>
            Average response time for verified requests: Within 30 calendar days.
          </div>
        </div>
      </section>
    </LegalPageShell>
  );
}
