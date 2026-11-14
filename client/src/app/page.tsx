import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";
import { landingConfig } from "@/config/landing";

export const metadata: Metadata = {
  title: landingConfig.meta.title,
  description: landingConfig.meta.description,
  keywords: landingConfig.meta.keywords,
  alternates: {
    canonical: landingConfig.meta.canonical,
  },
  openGraph: {
    title: landingConfig.meta.title,
    description: landingConfig.meta.description,
    url: landingConfig.meta.canonical,
    siteName: "ProxiPilot",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ProxiPilot — Autonomous AI Email Automation Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: landingConfig.meta.title,
    description: landingConfig.meta.description,
    images: ["/og-image.png"],
  },
};

export default function RootLandingPage() {
  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "ProxiPilot",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Email Automation & AI Operations",
    operatingSystem: "Cloud, Web Browser",
    url: landingConfig.meta.canonical,
    description: landingConfig.meta.description,
    screenshot: "https://proxipilot.com/og-image.png",
    featureList: [
      "Bidirectional Gmail & Microsoft Outlook OAuth synchronization",
      "Real-time hybrid RAG with Qdrant vector database",
      "Evidence-gated reply planner ensuring zero hallucinations",
      "Transactional outbox with human-in-the-loop approval workflows",
      "Multi-tenant cryptographic workspace data isolation",
    ],
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: "49",
      highPrice: "399",
      offerCount: "3",
      offers: [
        {
          "@type": "Offer",
          name: "Starter Pilot",
          price: "49",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
        },
        {
          "@type": "Offer",
          name: "Growth",
          price: "149",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
        },
        {
          "@type": "Offer",
          name: "Enterprise",
          price: "399",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
        },
      ],
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      bestRating: "5",
      ratingCount: "128",
    },
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: landingConfig.sections.faq.questions.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <LandingPage />
    </>
  );
}
