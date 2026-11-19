import type { Metadata } from "next";
import { GlobalNavbar } from "@/components/navigation/GlobalNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { PLANS, PRICING_FAQ, priceNumber } from "@/data/pricing-plans";
import { PricingView } from "./PricingView";
import p from "./pricing.module.css";

const SITE = "https://proxipilot.com";

export const metadata: Metadata = {
  title: "Pricing & Plans — ProxiPilot AI Email Copilot",
  description:
    "ProxiPilot pricing: Starter from $24/month, Growth $79, Business $199 billed annually, or custom Enterprise. Every plan includes a 14-day free trial, evidence-grounded AI drafts, Gmail & Outlook, and zero model training.",
  alternates: { canonical: `${SITE}/pricing` },
  openGraph: {
    title: "ProxiPilot Pricing & Plans",
    description:
      "Simple plans for teams that answer customer email. Start a 14-day free trial on Starter, Growth or Business.",
    url: `${SITE}/pricing`,
    type: "website",
  },
};

function plain(text: string) {
  return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
}

export default function PricingPage() {
  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "ProxiPilot",
    description:
      "AI email copilot that drafts evidence-grounded replies from your company knowledge in Gmail and Outlook, with human review.",
    brand: { "@type": "Brand", name: "ProxiPilot" },
    url: `${SITE}/pricing`,
    offers: PLANS.filter((plan) => !Number.isNaN(priceNumber(plan.monthlyPrice))).map((plan) => ({
      "@type": "Offer",
      name: `${plan.name} plan`,
      description: plan.tagline,
      price: priceNumber(plan.monthlyPrice).toFixed(2),
      priceCurrency: "USD",
      url: `${SITE}${plan.ctaHref}`,
      availability: "https://schema.org/InStock",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: priceNumber(plan.monthlyPrice).toFixed(2),
        priceCurrency: "USD",
        unitText: "MONTH",
      },
    })),
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: PRICING_FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: plain(f.a) },
    })),
  };

  return (
    <div className={p.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <GlobalNavbar />
      <main className={p.main}>
        <PricingView />
      </main>
      <LandingFooter />
    </div>
  );
}
