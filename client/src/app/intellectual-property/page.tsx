import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Intellectual Property & Copyright Policy — ProxiPilot",
  description:
    "Intellectual property rights, Customer data ownership, AI output copyrights, DMCA takedown procedures, and trademark guidelines for ProxiPilot.",
  alternates: { canonical: "https://proxipilot.com/intellectual-property" },
};

const TOC_ITEMS = [
  { id: "platform-ip", title: "1. ProxiPilot Platform Ownership" },
  { id: "customer-data", title: "2. Customer Data & AI Output Ownership" },
  { id: "trademarks", title: "3. Trademarks & Brand Guidelines" },
  { id: "dmca-takedown", title: "4. DMCA Notice & Takedown Procedure" },
  { id: "designated-agent", title: "5. Designated Copyright Agent" },
  { id: "counter-notice", title: "6. Counter-Notification Procedure" },
  { id: "repeat-infringers", title: "7. Repeat Infringer Policy" },
];

export default function IntellectualPropertyPage() {
  return (
    <LegalPageShell policyKey="intellectual-property" tocItems={TOC_ITEMS}>
      <section id="platform-ip" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          1. ProxiPilot Platform Ownership
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          <strong>Cheldain</strong> retains exclusive worldwide right, title, and interest in and to the ProxiPilot platform, including all proprietary source code, software architecture, UI components, designs, visual assets, documentation, and database schemas. No ownership or patent rights are transferred to customers under any circumstances.
        </p>
      </section>

      <section id="customer-data" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          2. Customer Data &amp; AI Output Ownership
        </h2>
        <div style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 6, padding: "12px 14px", margin: "12px 0", color: "#166534", fontSize: 13 }}>
          <strong>You Own Your Data &amp; Drafts:</strong>
          <p style={{ margin: "6px 0 0", lineHeight: 1.5 }}>
            Customers retain 100% intellectual property ownership of all uploaded corporate documents, customer messages, email templates, and AI-generated drafts created within ProxiPilot. We claim zero copyright, patent, or proprietary interest in your generated email output.
          </p>
        </div>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          You grant Cheldain a limited, royalty-free license to host, parse, and process Customer Data strictly to the extent required to execute the Service on your behalf.
        </p>
      </section>

      <section id="trademarks" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          3. Trademarks &amp; Brand Guidelines
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          &ldquo;ProxiPilot,&rdquo; the ProxiPilot logo, and associated stylized marks are proprietary trademarks of Cheldain. You may not use our brand assets, trade dress, or logos without prior written authorization.
        </p>
      </section>

      <section id="dmca-takedown" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          4. DMCA Notice &amp; Takedown Procedure
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          If you believe in good faith that content hosted or processed through ProxiPilot infringes your copyright under the Digital Millennium Copyright Act (17 U.S.C. § 512), please submit a formal written notice containing:
        </p>
        <ul style={{ paddingLeft: 20, margin: "0 0 10px", fontSize: 14, color: "#334155" }}>
          <li style={{ marginBottom: 4 }}>Physical or electronic signature of the copyright owner or authorized representative.</li>
          <li style={{ marginBottom: 4 }}>Identification of the copyrighted work claimed to have been infringed.</li>
          <li style={{ marginBottom: 4 }}>Identification of the infringing material and information reasonably sufficient to allow us to locate it.</li>
          <li style={{ marginBottom: 4 }}>Your contact information (name, address, telephone number, and email address).</li>
          <li style={{ marginBottom: 4 }}>A statement that you have a good-faith belief that the disputed use is not authorized by the copyright owner, its agent, or the law.</li>
          <li style={{ marginBottom: 4 }}>A statement under penalty of perjury that the information in the notification is accurate.</li>
        </ul>
      </section>

      <section id="designated-agent" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          5. Designated Copyright Agent
        </h2>
        <div style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "14px 16px", marginTop: 10, maxWidth: 480 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Copyright &amp; DMCA Agent</div>
          <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>Cheldain — Legal Operations</div>
          <div style={{ fontSize: 13, color: "#2563EB", marginTop: 6 }}>
            Notice Desk: <a href="mailto:legal@proxipilot.com" style={{ color: "#2563EB", fontWeight: 600 }}>legal@proxipilot.com</a>
          </div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>
            Subject line: <code>[DMCA Takedown Notice]</code>
          </div>
        </div>
      </section>

      <section id="counter-notice" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          6. Counter-Notification Procedure
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          If content you uploaded was removed due to a DMCA notice and you believe this was in error or misidentification, you may submit a formal counter-notification to our Copyright Agent pursuant to 17 U.S.C. § 512(g).
        </p>
      </section>

      <section id="repeat-infringers" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          7. Repeat Infringer Policy
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Cheldain enforces a strict policy of terminating the accounts of subscribers who are identified as repeat infringers of intellectual property rights.
        </p>
      </section>
    </LegalPageShell>
  );
}
