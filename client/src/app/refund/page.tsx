import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy — ProxiPilot",
  description:
    "Official refund, cancellation, and subscription billing policies for ProxiPilot, operated by Cheldain. Learn about trial evaluations, annual plans, and cancellation terms.",
  alternates: { canonical: "https://proxipilot.com/refund" },
};

const TOC_ITEMS = [
  { id: "overview", title: "1. Policy Overview & Scope" },
  { id: "free-trial", title: "2. Free Trial & Evaluation Period" },
  { id: "no-refunds", title: "3. Strict No-Refund Policy" },
  { id: "annual-plans", title: "4. Annual Subscription Commitments" },
  { id: "cancellation", title: "5. How to Cancel Your Subscription" },
  { id: "mor", title: "6. Merchant of Record (Paddle & Lemon Squeezy)" },
  { id: "billing-errors", title: "7. Duplicate Charges & Technical Billing Errors" },
  { id: "contact", title: "8. Billing Department Contact" },
];

export default function RefundPage() {
  return (
    <LegalPageShell policyKey="refund" tocItems={TOC_ITEMS}>
      <section id="overview" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          1. Policy Overview &amp; Scope
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          This Refund &amp; Cancellation Policy governs all paid subscriptions, license upgrades, and recurring billing transactions for ProxiPilot, operated by <strong>Cheldain</strong> (&ldquo;Company,&rdquo; &ldquo;we,&rdquo; or &ldquo;our&rdquo;). As a specialized B2B productivity software platform, we maintain clear, transparent, and fair billing terms.
        </p>
      </section>

      <section id="free-trial" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          2. Free Trial &amp; Evaluation Period
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          We provide all new business customers with a comprehensive <strong>Free Trial</strong> prior to requiring payment credentials or recurring billing activation. During this trial period, customers can test mailbox integrations, verify AI drafting accuracy, and experience daily workflow automation.
        </p>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Activating or upgrading to a paid subscription confirms that your organization has evaluated ProxiPilot, determined that it satisfies your commercial requirements, and agreed to our binding no-refund terms.
        </p>
      </section>

      <section id="no-refunds" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          3. Strict No-Refund Policy
        </h2>
        <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, padding: "12px 14px", margin: "12px 0", color: "#991B1B", fontSize: 13 }}>
          <strong>All Sales Are Final:</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            <li>We do not offer refunds, credits, or fee prorations once a paid subscription period has commenced.</li>
            <li>We do not issue refunds for mid-billing-cycle cancellations, lack of platform usage, changes in business strategy, or employee turnover.</li>
            <li>No refunds are provided if your account is suspended or terminated due to violations of our <Link href="/acceptable-use" style={{ color: "#991B1B", textDecoration: "underline" }}>Acceptable Use Policy</Link>.</li>
          </ul>
        </div>
      </section>

      <section id="annual-plans" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          4. Annual Subscription Commitments
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Annual plans are discounted heavily to reflect a 12-month contractual commitment. <strong>Annual subscription fees are non-refundable under any circumstances.</strong> In the event of early cancellation of an annual plan, your service remains fully accessible through the expiration of the prepaid 12-month term, but no partial or prorated refund will be issued.
        </p>
      </section>

      <section id="cancellation" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          5. How to Cancel Your Subscription
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          You may cancel your recurring subscription at any time without penalty or cancellation fees:
        </p>
        <ol style={{ paddingLeft: 20, margin: "0 0 10px", fontSize: 14, color: "#334155" }}>
          <li style={{ marginBottom: 4 }}>Log in to your ProxiPilot workspace at <a href="https://proxipilot.com" style={{ color: "#2563EB" }}>proxipilot.com</a>.</li>
          <li style={{ marginBottom: 4 }}>Navigate to <strong>Settings &rarr; Billing &amp; Subscription</strong>.</li>
          <li style={{ marginBottom: 4 }}>Click <strong>Manage Subscription</strong> and select <strong>Cancel Subscription</strong>.</li>
        </ol>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Upon cancellation, your subscription will not renew at the next billing date. You will retain full operational access to ProxiPilot through the end of your current prepaid period.
        </p>
      </section>

      <section id="mor" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          6. Merchant of Record (Paddle &amp; Lemon Squeezy)
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          All customer billing transactions are processed securely by our authorized Merchant of Record partners, <strong>Paddle</strong> and/or <strong>Lemon Squeezy</strong>. They handle global sales tax compliance (including US sales tax, EU VAT, and UK VAT), currency conversions, and fraud monitoring. Your official invoice and tax receipt are issued directly by the applicable Merchant of Record.
        </p>
      </section>

      <section id="billing-errors" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          7. Duplicate Charges &amp; Technical Billing Errors
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          If you believe an erroneous or duplicate transaction has occurred due to a technical glitch, please contact us at <a href="mailto:billing@proxipilot.com" style={{ color: "#2563EB", fontWeight: 600 }}>billing@proxipilot.com</a> within <strong>7 calendar days</strong> of the transaction. Please include your invoice number, account email, and receipt details. Confirmed technical duplicate charges will be refunded promptly to the original payment method.
        </p>
      </section>

      <section id="contact" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          8. Billing Department Contact
        </h2>
        <div style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "14px 16px", marginTop: 10, maxWidth: 480 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>ProxiPilot Billing &amp; Finance Team</div>
          <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>Operated by Cheldain</div>
          <div style={{ fontSize: 13, color: "#2563EB", marginTop: 6 }}>
            Inquiries: <a href="mailto:billing@proxipilot.com" style={{ color: "#2563EB", fontWeight: 600 }}>billing@proxipilot.com</a>
          </div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 6 }}>
            Average response time: Within 24-48 business hours.
          </div>
        </div>
      </section>
    </LegalPageShell>
  );
}
