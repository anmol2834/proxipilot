import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Terms of Service — ProxiPilot",
  description:
    "Official Terms & Conditions governing your use of ProxiPilot, operated by Cheldain. Read our contractual terms, subscription policies, and acceptable use requirements.",
  alternates: { canonical: "https://proxipilot.com/terms" },
};

const TOC_ITEMS = [
  { id: "acceptance", title: "1. Acceptance of Terms" },
  { id: "service", title: "2. The Service & Availability" },
  { id: "accounts", title: "3. Account Security & Responsibilities" },
  { id: "subscription", title: "4. Subscription, Billing & Refund Policy" },
  { id: "intellectual-property", title: "5. Intellectual Property & Data Ownership" },
  { id: "ai-output", title: "6. AI Email Output & Review Responsibility" },
  { id: "data-privacy", title: "7. Data Protection & Privacy" },
  { id: "acceptable-use", title: "8. Acceptable Use Summary" },
  { id: "liability", title: "9. Disclaimers & Limitation of Liability" },
  { id: "indemnification", title: "10. Indemnification" },
  { id: "termination", title: "11. Suspension & Termination" },
  { id: "governing-law", title: "12. Governing Law & Arbitration" },
  { id: "general", title: "13. General Contractual Provisions" },
  { id: "contact", title: "14. Official Contact Information" },
];

export default function TermsPage() {
  return (
    <LegalPageShell policyKey="terms" tocItems={TOC_ITEMS}>
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.62, margin: "0 0 12px" }}>
          Please read these Terms &amp; Conditions carefully before using ProxiPilot. By creating an account,
          connecting an email provider, or utilizing any feature of the service, you acknowledge that you have read,
          understood, and agree to be bound by these Terms. If you do not agree, do not access or use ProxiPilot.
        </p>
      </div>

      {/* 1. Acceptance of Terms */}
      <section id="acceptance" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          1. Acceptance of Terms
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          By accessing or using ProxiPilot (&ldquo;the Service&rdquo;), you agree to be bound by these Terms &amp; Conditions (&ldquo;Terms&rdquo;).
          These Terms constitute a legally binding agreement between you (&ldquo;Customer,&rdquo; &ldquo;you,&rdquo; or &ldquo;your&rdquo;) and
          <strong> Cheldain</strong> (&ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), the entity operating ProxiPilot.
        </p>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          If you are using ProxiPilot on behalf of a company, corporate enterprise, or business organization, you represent and warrant
          that you have the legal authority to bind that entity to these Terms.
        </p>
        <div style={{ backgroundColor: "#F8FAFC", borderLeft: "3px solid #2563EB", padding: "10px 14px", margin: "12px 0", fontSize: 13, color: "#334155" }}>
          <strong>B2B Service Restriction:</strong> You must be at least 18 years of age and acting strictly in a professional or commercial business capacity to use ProxiPilot. ProxiPilot is an enterprise B2B productivity tool and is not intended or marketed for personal, consumer, or domestic use.
        </div>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          We may update these Terms from time to time. We will notify you by email at least <strong>14 days</strong> before any material modifications take effect. Your continued use of ProxiPilot following the notice period constitutes acceptance of the updated Terms. If you object to any modifications, you must cancel your subscription prior to the effective date.
        </p>
      </section>

      {/* 2. The Service */}
      <section id="service" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          2. The Service &amp; Availability
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          ProxiPilot is an AI-powered email productivity and workflow automation assistant designed for B2B commercial use, operated by Cheldain, an entity based in India.
        </p>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1E293B", margin: "14px 0 6px" }}>2.1 Service Features</h3>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          ProxiPilot enables you to draft, review, polish, and automate business communications using artificial intelligence powered by vetted third-party model providers, including OpenAI and Anthropic. The Service integrates securely with mail providers including Google Gmail and Microsoft Outlook (via Microsoft Graph) to compose, draft, and dispatch messages as explicitly directed by you.
        </p>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1E293B", margin: "14px 0 6px" }}>2.2 Service Modifications &amp; Maintenance</h3>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          We reserve the right to improve, update, modify, add, or discontinue features of ProxiPilot at any time. We will provide reasonable notice for material modifications affecting core workflows. We reserve the right to perform routine scheduled maintenance and urgent emergency patches, minimizing operational disruption where practicable.
        </p>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1E293B", margin: "14px 0 6px" }}>2.3 Uptime Target &amp; External Outages</h3>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          We target <strong>99.9% uptime</strong> for the ProxiPilot platform, but do not guarantee uninterrupted, error-free availability. Cheldain is not liable for service degradation or outages resulting from upstream third-party AI provider interruptions (OpenAI, Anthropic), email host provider outages (Google Workspace, Microsoft 365), public telecommunications disruptions, or force majeure events beyond our reasonable control.
        </p>
      </section>

      {/* 3. Accounts */}
      <section id="accounts" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          3. Account Security &amp; Responsibilities
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          To access ProxiPilot, you must register an account supplying true, accurate, current, and complete corporate information.
        </p>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1E293B", margin: "14px 0 6px" }}>3.1 Account Security</h3>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          You are solely responsible for safeguarding the credentials associated with your account, including passwords and connected mailbox authorization tokens. You are fully responsible for all actions, communications, and activities that occur under your credentials. You agree to notify us immediately at <a href="mailto:support@proxipilot.com" style={{ color: "#2563EB" }}>support@proxipilot.com</a> if you discover or suspect unauthorized access.
        </p>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1E293B", margin: "14px 0 6px" }}>3.2 Account Restrictions</h3>
        <ul style={{ paddingLeft: 20, margin: "0 0 10px", fontSize: 14, color: "#334155" }}>
          <li style={{ marginBottom: 4 }}>One account per business entity unless you subscribe to an authorized team or multi-seat plan.</li>
          <li style={{ marginBottom: 4 }}>You may not share credentials with individuals outside your licensed corporate organization.</li>
          <li style={{ marginBottom: 4 }}>We reserve the right to suspend or terminate any account that violates these Terms or our Acceptable Use Policy, without prior notice and without refund.</li>
        </ul>
      </section>

      {/* 4. Subscription & Payment */}
      <section id="subscription" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          4. Subscription, Billing &amp; Refund Policy
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          ProxiPilot is offered on a commercial software-as-a-service subscription basis. All subscription payments and checkouts are managed by our Merchant of Record (&ldquo;MOR&rdquo;) partners, currently <strong>Paddle</strong> and/or <strong>Lemon Squeezy</strong>. The applicable MOR for your purchase is identified on your official invoice and payment receipt.
        </p>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1E293B", margin: "14px 0 6px" }}>4.1 Billing &amp; Automatic Renewal</h3>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Subscriptions are billed in advance on a monthly or annual billing cycle, depending on the plan selected. Your subscription automatically renews at the end of each billing term unless cancelled through your dashboard prior to the renewal date. All pricing is listed in USD. We reserve the right to adjust pricing upon providing at least <strong>30 days&rsquo; prior written email notice</strong>. Continued usage after the effective date constitutes agreement to the adjusted pricing.
        </p>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1E293B", margin: "14px 0 6px" }}>4.2 Free Trial Evaluation</h3>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          All new accounts receive a free trial period before payment is mandated. We strongly encourage all users to thoroughly test workflows, mailbox integrations, and AI generation quality during this trial period. Upgrading to or activating a paid subscription signifies that you have evaluated the software, determined that it satisfies your business requirements, and accepted our strict refund policy.
        </p>
        <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, padding: "12px 14px", margin: "12px 0", color: "#991B1B", fontSize: 13 }}>
          <strong>4.3 Strict No-Refund Policy:</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            <li>All subscription fees are final and non-refundable once a paid billing cycle has commenced.</li>
            <li>Annual subscription commitments are non-refundable under any circumstances once billed.</li>
            <li>Upon cancelling your subscription, access remains active until the expiration of the current paid billing cycle. No prorated refunds are issued for unused days.</li>
            <li>Genuine technical billing discrepancies (such as accidental duplicate charges) must be reported to <a href="mailto:billing@proxipilot.com" style={{ color: "#B91C1C", fontWeight: 600 }}>billing@proxipilot.com</a> within 7 calendar days of the transaction for prompt review and resolution.</li>
          </ul>
        </div>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1E293B", margin: "14px 0 6px" }}>4.4 Failed Payments</h3>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          If a recurring renewal payment fails, we will notify you by email. We reserve the right to suspend or restrict access to ProxiPilot features until valid billing credentials are provided.
        </p>
      </section>

      {/* 5. Intellectual Property */}
      <section id="intellectual-property" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          5. Intellectual Property &amp; Data Ownership
        </h2>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1E293B", margin: "14px 0 6px" }}>5.1 ProxiPilot Platform</h3>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Cheldain retains all worldwide right, title, and interest in and to the ProxiPilot platform, including all software code, algorithms, user interfaces, branding, trademarks, logos, domain names, and technical documentation. Nothing in these Terms conveys any ownership rights or intellectual property transfer to you.
        </p>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1E293B", margin: "14px 0 6px" }}>5.2 Your Data &amp; Generated Drafts</h3>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          You retain exclusive ownership of all data, text, templates, documents, and corporate email content that you submit or sync with ProxiPilot (&ldquo;Customer Data&rdquo;). AI-generated email drafts produced by ProxiPilot using your prompts and contextual instructions are owned by you upon creation. You grant Cheldain a worldwide, limited, non-exclusive, royalty-free license to host, process, and transmit Customer Data solely to provide, maintain, and support the Service for your account.
        </p>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1E293B", margin: "14px 0 6px" }}>5.3 Usage Restrictions</h3>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          You agree that you will not: (a) copy, modify, decompile, disassemble, or reverse-engineer the Service or attempt to extract underlying source code; (b) probe, scan, or breach system security; or (c) use the Service or its generated outputs to train, benchmark, or develop a competing artificial intelligence product or SaaS platform.
        </p>
      </section>

      {/* 6. AI Email Output */}
      <section id="ai-output" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          6. AI Email Output &amp; Review Responsibility
        </h2>
        <div style={{ backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 6, padding: "12px 14px", margin: "12px 0", fontSize: 13, color: "#1E40AF" }}>
          <strong>Human-in-the-Loop Core Architecture:</strong> ProxiPilot is an AI writing and productivity assistant. ProxiPilot does not autonomously initiate or dispatch external commercial emails without your authorization, review, or deliberate automated rule configuration.
        </div>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          All outbound communications are drafted for review and approval by you, the Customer. You remain solely and comprehensively responsible for all message content, recipient list curation, dispatch decisions, and the commercial or legal repercussions of emails sent using ProxiPilot.
        </p>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Artificial intelligence models may occasionally generate inaccurate, incomplete, biased, or inappropriate statements (&ldquo;hallucinations&rdquo;). ProxiPilot provides no representation, warranty, or guarantee regarding the accuracy, factual veracity, tone, legal compliance, or inbox deliverability of AI-generated drafts. You are obligated to inspect and verify all AI output prior to sending.
        </p>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Cheldain bears zero liability for any damages, regulatory penalties, business disputes, or lost transactions resulting from emails composed or sent via ProxiPilot.
        </p>
      </section>

      {/* 7. Data & Privacy */}
      <section id="data-privacy" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          7. Data Protection &amp; Privacy
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Your use of the Service is governed by our <Link href="/privacy" style={{ color: "#2563EB", fontWeight: 600 }}>Privacy Policy</Link>, which is incorporated into these Terms by reference.
        </p>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          ProxiPilot transmits relevant context, prompts, and drafts to third-party AI inference providers (OpenAI, Anthropic) strictly to produce requested text responses. We do not sell your corporate or personal data to any third party.
        </p>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          We enforce enterprise zero-data-retention and non-training flags with our AI infrastructure partners where available. We do not use your proprietary business email data, prompts, or confidential customer communications to train foundation AI models.
        </p>
      </section>

      {/* 8. Acceptable Use */}
      <section id="acceptable-use" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          8. Acceptable Use Summary
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Your use of ProxiPilot is conditioned on strict adherence to our <Link href="/acceptable-use" style={{ color: "#2563EB", fontWeight: 600 }}>Acceptable Use Policy</Link> and <Link href="/email-sending-policy" style={{ color: "#2563EB", fontWeight: 600 }}>Email Sending &amp; Anti-Spam Policy</Link>. Key prohibitions include:
        </p>
        <ul style={{ paddingLeft: 20, margin: "0 0 10px", fontSize: 14, color: "#334155" }}>
          <li style={{ marginBottom: 4 }}>No transmission of unsolicited bulk marketing, spam, phishing, deceptive, or fraudulent emails.</li>
          <li style={{ marginBottom: 4 }}>No emailing rented, purchased, or third-party scraped recipient lists without verifiable opt-in consent.</li>
          <li style={{ marginBottom: 4 }}>Strict compliance with all global email and privacy statutes, including the U.S. CAN-SPAM Act, EU/UK GDPR, Canadian CASL, and Australian Spam Act.</li>
          <li style={{ marginBottom: 4 }}>B2B commercial use only &mdash; no personal, abusive, harassing, or unlawful usage.</li>
          <li style={{ marginBottom: 4 }}>No reselling, white-labeling, or sublicensing access to ProxiPilot without prior written authorization.</li>
        </ul>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Any violation of these operational rules results in immediate suspension or termination of your account without refund, at Cheldain&rsquo;s sole discretion.
        </p>
      </section>

      {/* 9. Disclaimers & Limitation of Liability */}
      <section id="liability" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          9. Disclaimers &amp; Limitation of Liability
        </h2>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1E293B", margin: "14px 0 6px" }}>9.1 &ldquo;As Is&rdquo; Warranty Disclaimer</h3>
        <p style={{ fontSize: 13, textTransform: "uppercase", color: "#475569", lineHeight: 1.6, margin: "0 0 10px", letterSpacing: "0.02em" }}>
          THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE, INCLUDING WITHOUT LIMITATION WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT PROXIPILOT WILL BE UNINTERRUPTED, BUG-FREE, SECURE, OR ACCURATE, OR THAT GENERATED OUTPUTS WILL DELIVER ANY SPECIFIC BUSINESS REVENUE OR CONVERSION RESULT.
        </p>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1E293B", margin: "14px 0 6px" }}>9.2 Aggregate Liability Cap</h3>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL CHELDAIN&rsquo;S TOTAL CUMULATIVE LIABILITY ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICE EXCEED THE TOTAL AGGREGATE FEES ACTUALLY PAID BY YOU TO CHELDAIN IN THE <strong>THREE (3) MONTHS</strong> IMMEDIATELY PRECEDING THE OCCURRENCE GIVING RISE TO THE CLAIM.
        </p>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1E293B", margin: "14px 0 6px" }}>9.3 Consequential Damages Exclusion</h3>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Cheldain shall have no liability for: (a) indirect, incidental, special, consequential, or punitive damages; (b) loss of profits, revenue, anticipated savings, goodwill, or business opportunity; (c) damage resulting from external provider downtime (OpenAI, Anthropic, Google, Microsoft); or (d) regulatory fines or spam penalties assessed against your email domain.
        </p>
      </section>

      {/* 10. Indemnification */}
      <section id="indemnification" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          10. Indemnification
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          You agree to defend, indemnify, and hold harmless Cheldain, its directors, officers, employees, contractors, and agents from and against any claims, liabilities, damages, judgments, awards, losses, costs, and expenses (including reasonable attorney fees) arising from:
        </p>
        <ul style={{ paddingLeft: 20, margin: "0 0 10px", fontSize: 14, color: "#334155" }}>
          <li style={{ marginBottom: 4 }}>Your use or misuse of the Service or violation of these Terms;</li>
          <li style={{ marginBottom: 4 }}>Any emails, campaigns, or communications transmitted by you using ProxiPilot;</li>
          <li style={{ marginBottom: 4 }}>Any claims brought by recipients of emails generated or sent through your account;</li>
          <li style={{ marginBottom: 4 }}>Your violation of applicable anti-spam, marketing, or privacy legislation (such as CAN-SPAM, GDPR, or CASL); or</li>
          <li style={{ marginBottom: 4 }}>Infringement of third-party intellectual property or privacy rights within Customer Data.</li>
        </ul>
      </section>

      {/* 11. Termination */}
      <section id="termination" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          11. Suspension &amp; Termination
        </h2>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1E293B", margin: "14px 0 6px" }}>11.1 Termination by You</h3>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          You may cancel your subscription at any time directly through your dashboard settings. Cancellation takes effect at the conclusion of your current paid billing period. Cancellation does not entitle you to a refund of any prepaid fees.
        </p>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1E293B", margin: "14px 0 6px" }}>11.2 Termination by Cheldain</h3>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Cheldain may suspend or terminate your account immediately and without notice if you breach these Terms, the Acceptable Use Policy, or create security or regulatory exposure for the platform. Cheldain may discontinue or terminate any account without cause upon providing 30 days&rsquo; prior written notice. Accounts terminated for contractual or policy violations are ineligible for any refund.
        </p>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1E293B", margin: "14px 0 6px" }}>11.3 Effects of Termination &amp; Data Deletion</h3>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Upon termination, access to the platform terminates. Customer mailbox tokens are revoked immediately. Customer Data and vector representations stored in ProxiPilot databases are scheduled for permanent deletion within <strong>30 days</strong>. You may export your data prior to account closure. Provisions concerning IP, Disclaimers, Liability Caps, Indemnification, Governing Law, and Arbitration survive termination.
        </p>
      </section>

      {/* 12. Governing Law */}
      <section id="governing-law" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          12. Governing Law &amp; Arbitration
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          These Terms are governed by and construed in accordance with the laws of the <strong>State of Delaware, United States</strong>, without regard to conflict of law principles. Cheldain is incorporated and operates in India, delivering ProxiPilot globally as an enterprise cloud service. The choice of Delaware governing law is a mutual contractual agreement providing commercial certainty for our international customer base.
        </p>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Any controversy, claim, or dispute arising out of or relating to these Terms or the Service shall first be addressed through good-faith executive negotiations for at least 30 calendar days. If negotiations do not resolve the dispute, it shall be resolved by final and binding arbitration administered by the American Arbitration Association (&ldquo;AAA&rdquo;) under its Commercial Arbitration Rules, conducted in the English language.
        </p>
        <div style={{ backgroundColor: "#F8FAFC", border: "1px solid #CBD5E1", borderRadius: 6, padding: "10px 14px", margin: "12px 0", fontSize: 13, color: "#334155" }}>
          <strong>Class Action Waiver:</strong> You and Cheldain agree that all claims and disputes must be brought solely in an individual capacity, and not as a plaintiff, class member, or representative in any purported class, representative, or consolidated action.
        </div>
      </section>

      {/* 13. General Provisions */}
      <section id="general" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          13. General Contractual Provisions
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 8px", lineHeight: 1.62 }}>
          <strong>13.1 Severability:</strong> If any provision of these Terms is deemed invalid or unenforceable, that provision shall be enforced to the maximum extent permissible, and the remaining provisions shall continue in full force.
        </p>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 8px", lineHeight: 1.62 }}>
          <strong>13.2 Entire Agreement:</strong> These Terms, together with our Privacy Policy, Acceptable Use Policy, and Data Processing Agreement, constitute the entire agreement between you and Cheldain regarding the Service.
        </p>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 8px", lineHeight: 1.62 }}>
          <strong>13.3 Assignment:</strong> Cheldain may assign its rights and obligations under these Terms in connection with a merger, acquisition, corporate reorganization, or sale of assets. You may not assign these Terms without our prior written consent.
        </p>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 8px", lineHeight: 1.62 }}>
          <strong>13.4 Electronic Notices:</strong> Official notices from Cheldain will be dispatched to the email address registered with your account and are deemed received upon dispatch.
        </p>
      </section>

      {/* 14. Contact Information */}
      <section id="contact" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          14. Official Contact Information
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          For inquiries concerning these Terms &amp; Conditions or legal notices, contact our compliance team:
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 12 }}>
          <div style={{ border: "1px solid #E2E8F0", borderRadius: 6, padding: "12px", background: "#FFFFFF" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Legal &amp; Contracts</div>
            <a href="mailto:legal@proxipilot.com" style={{ fontSize: 14, fontWeight: 600, color: "#2563EB" }}>legal@proxipilot.com</a>
          </div>
          <div style={{ border: "1px solid #E2E8F0", borderRadius: 6, padding: "12px", background: "#FFFFFF" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Billing &amp; Merchant Records</div>
            <a href="mailto:billing@proxipilot.com" style={{ fontSize: 14, fontWeight: 600, color: "#2563EB" }}>billing@proxipilot.com</a>
          </div>
          <div style={{ border: "1px solid #E2E8F0", borderRadius: 6, padding: "12px", background: "#FFFFFF" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Customer Support</div>
            <a href="mailto:support@proxipilot.com" style={{ fontSize: 14, fontWeight: 600, color: "#2563EB" }}>support@proxipilot.com</a>
          </div>
        </div>
      </section>
    </LegalPageShell>
  );
}
