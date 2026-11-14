import React from "react";
import Link from "next/link";

/** Contact address shown on the legal pages (also the support address users write to). */
export const LEGAL_CONTACT_EMAIL = "hello@proxipilot.com";
export const LEGAL_EFFECTIVE_DATE = "14 November 2026";

export interface LegalSection {
  heading: string;
  body: React.ReactNode;
}

/** Plain, readable legal document layout (server component, no client JS). */
export function LegalPage({ title, intro, sections }: { title: string; intro: React.ReactNode; sections: LegalSection[] }) {
  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: "48px 20px" }}>
      <article
        style={{
          maxWidth: 820, margin: "0 auto", background: "#ffffff", border: "1px solid #e2e8f0",
          borderRadius: 16, padding: "40px 36px", color: "#0f172a", lineHeight: 1.7, fontSize: 15,
        }}
      >
        <Link href="/" style={{ color: "#2563eb", fontWeight: 600, textDecoration: "none", fontSize: 14 }}>
          ← ProxiPilot
        </Link>
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", margin: "18px 0 6px" }}>{title}</h1>
        <p style={{ color: "#64748b", margin: "0 0 24px", fontSize: 14 }}>Effective date: {LEGAL_EFFECTIVE_DATE}</p>
        <div style={{ color: "#334155" }}>{intro}</div>
        {sections.map((s, i) => (
          <section key={s.heading} style={{ marginTop: 28 }}>
            <h2 style={{ fontSize: 19, fontWeight: 700, margin: "0 0 8px", color: "#0f172a" }}>
              {i + 1}. {s.heading}
            </h2>
            <div style={{ color: "#334155" }}>{s.body}</div>
          </section>
        ))}
        <p style={{ marginTop: 36, paddingTop: 18, borderTop: "1px solid #e2e8f0", color: "#64748b", fontSize: 14 }}>
          Questions? Contact us at{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} style={{ color: "#2563eb" }}>{LEGAL_CONTACT_EMAIL}</a>.
        </p>
      </article>
    </main>
  );
}
