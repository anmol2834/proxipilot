import type { Metadata } from "next";
import { GlobalNavbar } from "@/components/navigation/GlobalNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { FaqBrowser } from "@/components/faq/FaqBrowser";
import { FAQ_TOPICS, faqJsonLd } from "@/data/faq-content";
import f from "@/components/faq/faq.module.css";

export const metadata: Metadata = {
  title: "Frequently Asked Questions — ProxiPilot",
  description:
    "Answers about ProxiPilot AI email automation: Gmail and Outlook setup, grounded AI drafts, the knowledge base, human review and automation, security, GDPR, pricing and troubleshooting.",
  alternates: { canonical: "https://proxipilot.com/faq" },
  openGraph: {
    title: "ProxiPilot FAQ",
    description:
      "Clear answers about connecting Gmail and Outlook, evidence-grounded AI drafts, security, pricing and more.",
    url: "https://proxipilot.com/faq",
    type: "website",
  },
};

export default function FAQPage() {
  const nav = FAQ_TOPICS.map((t) => ({ slug: t.slug, name: t.name, count: t.items.length }));

  return (
    <div className={f.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQ_TOPICS)) }} />
      <GlobalNavbar />
      <main className={f.main}>
        <FaqBrowser
          title="Frequently Asked Questions"
          subtitle="Clear answers about how ProxiPilot connects to your inbox, drafts replies from your own knowledge, protects your data, and scales with your team."
          topics={FAQ_TOPICS}
          nav={nav}
        />
      </main>
      <LandingFooter />
    </div>
  );
}
