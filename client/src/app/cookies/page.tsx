import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Cookie Policy — ProxiPilot",
  description:
    "Learn how ProxiPilot uses essential session cookies and privacy-preserving analytics to secure and operate our email automation platform.",
  alternates: { canonical: "https://proxipilot.com/cookies" },
};

const TOC_ITEMS = [
  { id: "overview", title: "1. What Are Cookies" },
  { id: "categories", title: "2. Categories of Cookies We Use" },
  { id: "table", title: "3. Cookie Inventory Table" },
  { id: "third-party", title: "4. Third-Party Analytics & Tracking" },
  { id: "management", title: "5. How to Manage Cookies" },
  { id: "contact", title: "6. Questions & Contact" },
];

export default function CookiesPage() {
  return (
    <LegalPageShell policyKey="cookies" tocItems={TOC_ITEMS}>
      <section id="overview" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          1. What Are Cookies
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Cookies and local storage are small text files placed on your browser or device when you visit ProxiPilot (&ldquo;the Service&rdquo;). They allow us to authenticate your session, maintain security, remember user interface preferences, and understand how our SaaS platform is functioning.
        </p>
      </section>

      <section id="categories" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          2. Categories of Cookies We Use
        </h2>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1E293B", margin: "14px 0 6px" }}>2.1 Strictly Necessary Cookies</h3>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Essential cookies are necessary for ProxiPilot to operate. They enable core functions such as user login, cryptographic session validation, CSRF defense, and workspace tenant isolation. The platform cannot function without these cookies.
        </p>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1E293B", margin: "14px 0 6px" }}>2.2 Performance &amp; Analytics Cookies</h3>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          These cookies collect aggregated, anonymized metrics on page response times, API load, and feature usage to help us optimize software performance. They do not identify individuals or record email contents.
        </p>
        <div style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 6, padding: "10px 14px", margin: "12px 0", fontSize: 13, color: "#166534" }}>
          <strong>No Advertising or Tracking Pixels:</strong> ProxiPilot does not use third-party advertising cookies, social media tracking pixels, or cross-site surveillance beacons.
        </div>
      </section>

      <section id="table" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          3. Cookie Inventory Table
        </h2>
        <div style={{ overflowX: "auto", border: "1px solid #E2E8F0", borderRadius: 6, marginBottom: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
            <thead>
              <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                <th style={{ padding: "8px 12px", color: "#475569", fontWeight: 600 }}>Identifier</th>
                <th style={{ padding: "8px 12px", color: "#475569", fontWeight: 600 }}>Type</th>
                <th style={{ padding: "8px 12px", color: "#475569", fontWeight: 600 }}>Purpose</th>
                <th style={{ padding: "8px 12px", color: "#475569", fontWeight: 600 }}>Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                <td style={{ padding: "8px 12px", fontFamily: "monospace", color: "#0F172A" }}>pp_session</td>
                <td style={{ padding: "8px 12px" }}>Essential</td>
                <td style={{ padding: "8px 12px", color: "#334155" }}>Cryptographic JWT authentication token for authorized session maintenance.</td>
                <td style={{ padding: "8px 12px", color: "#64748B" }}>7 days (or logout)</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                <td style={{ padding: "8px 12px", fontFamily: "monospace", color: "#0F172A" }}>pp_csrf_token</td>
                <td style={{ padding: "8px 12px" }}>Essential</td>
                <td style={{ padding: "8px 12px", color: "#334155" }}>Prevents Cross-Site Request Forgery (CSRF) attacks on authenticated mutation endpoints.</td>
                <td style={{ padding: "8px 12px", color: "#64748B" }}>Session</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                <td style={{ padding: "8px 12px", fontFamily: "monospace", color: "#0F172A" }}>pp_org_context</td>
                <td style={{ padding: "8px 12px" }}>Essential</td>
                <td style={{ padding: "8px 12px", color: "#334155" }}>Maintains active workspace tenant selection across browser page loads.</td>
                <td style={{ padding: "8px 12px", color: "#64748B" }}>30 days</td>
              </tr>
              <tr>
                <td style={{ padding: "8px 12px", fontFamily: "monospace", color: "#0F172A" }}>pp_telemetry</td>
                <td style={{ padding: "8px 12px" }}>Analytics</td>
                <td style={{ padding: "8px 12px", color: "#334155" }}>Anonymized error monitoring and synthetic latency telemetry.</td>
                <td style={{ padding: "8px 12px", color: "#64748B" }}>30 days</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="third-party" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          4. Third-Party Analytics &amp; Tracking
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Our payment processors, <strong>Paddle</strong> and/or <strong>Lemon Squeezy</strong>, may issue transient cookies solely on checkout screens to prevent credit card fraud and satisfy PCI-DSS obligations. These cookies are governed by their respective privacy disclosures.
        </p>
      </section>

      <section id="management" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          5. How to Manage Cookies
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          You can adjust your web browser settings to delete or block cookies. However, disabling strictly necessary cookies will prevent you from signing in to your ProxiPilot workspace or utilizing automated email drafting.
        </p>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          To clear existing cookies, consult the privacy and settings menu of your web browser (Chrome, Edge, Safari, Firefox).
        </p>
      </section>

      <section id="contact" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          6. Questions &amp; Contact
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          For inquiries regarding cookie deployment or our technical safeguards, reach out to <a href="mailto:privacy@proxipilot.com" style={{ color: "#2563EB" }}>privacy@proxipilot.com</a> or review our <Link href="/privacy" style={{ color: "#2563EB", fontWeight: 600 }}>Privacy Policy</Link>.
        </p>
      </section>
    </LegalPageShell>
  );
}
