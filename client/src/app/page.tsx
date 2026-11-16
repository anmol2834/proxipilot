import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";
import { landingConfig } from "@/config/landing";

export const metadata: Metadata = {
  metadataBase: new URL("https://proxipilot.com"),
  title: "ProxiPilot — Autonomous AI Email Automation Platform for Enterprise",
  description:
    "Transform high-volume inbox chaos into accurate, automated workflows. ProxiPilot connects Gmail and Microsoft Outlook with hybrid Qdrant vector retrieval, enterprise business context, and evidence-gated AI reply generation.",
  keywords: [
    "AI email automation",
    "autonomous email inbox",
    "enterprise customer support AI",
    "Gmail AI copilot",
    "Microsoft Outlook AI automation",
    "RAG email intelligence",
    "Qdrant vector search email",
    "evidence-gated AI reply generator",
    "human-in-the-loop email AI",
    "multi-tenant AI platform",
    "AI inbox triage",
    "automated customer support emails",
    "transactional outbox email",
    "enterprise customer communication proxy",
    "ProxiPilot",
  ],
  authors: [{ name: "ProxiPilot Inc.", url: "https://proxipilot.com" }],
  creator: "ProxiPilot Inc.",
  publisher: "ProxiPilot Inc.",
  alternates: {
    canonical: "https://proxipilot.com",
    languages: {
      "en-US": "https://proxipilot.com",
      "x-default": "https://proxipilot.com",
    },
  },
  openGraph: {
    title: "ProxiPilot — Autonomous AI Email Automation Platform for Enterprise",
    description:
      "Transform high-volume inbox chaos into accurate, automated workflows with Qdrant vector RAG and evidence-gated AI planning.",
    url: "https://proxipilot.com",
    siteName: "ProxiPilot",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ProxiPilot — Autonomous AI Email Automation Platform",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ProxiPilot — Autonomous AI Email Automation Platform for Enterprise",
    description:
      "Enterprise autonomous AI email platform. High-accuracy customer inbox intelligence powered by Qdrant vector RAG.",
    images: ["/og-image.png"],
    site: "@proxipilot",
    creator: "@proxipilot",
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "technology",
  classification: "Enterprise AI Email Operations",
  other: {
    "geo.region": "US-CA",
    "geo.placename": "San Francisco, California",
    "geo.position": "37.7749;-122.4194",
    "ICBM": "37.7749, -122.4194",
    "DC.title": "ProxiPilot — Autonomous AI Email Automation Platform",
    "DC.creator": "ProxiPilot Inc.",
    "DC.subject": "AI Email Automation, Autonomous Inbox, Enterprise Workflow RAG",
    "DC.description": "Enterprise-grade autonomous AI email automation platform with Qdrant vector retrieval.",
    "DC.publisher": "ProxiPilot Inc.",
    "DC.language": "en",
    "DC.coverage": "World",
    "rating": "General",
    "revisit-after": "7 days",
  },
};

export default function RootLandingPage() {
  const masterJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      // 1. Organization
      {
        "@type": "Organization",
        "@id": "https://proxipilot.com/#organization",
        name: "ProxiPilot",
        legalName: "ProxiPilot Inc.",
        url: "https://proxipilot.com",
        logo: {
          "@type": "ImageObject",
          "@id": "https://proxipilot.com/#logo",
          url: "https://proxipilot.com/android-chrome-512x512.png",
          contentUrl: "https://proxipilot.com/android-chrome-512x512.png",
          caption: "ProxiPilot Logo",
          width: 512,
          height: 512,
        },
        image: {
          "@id": "https://proxipilot.com/#logo",
        },
        description:
          "ProxiPilot is an enterprise-grade autonomous AI platform that automates high-volume email workflows and customer communications with vector retrieval.",
        foundingDate: "2024",
        sameAs: [
          "https://twitter.com/proxipilot",
          "https://linkedin.com/company/proxipilot",
          "https://github.com/proxipilot",
        ],
        contactPoint: [
          {
            "@type": "ContactPoint",
            contactType: "customer support",
            email: "hello@proxipilot.com",
            availableLanguage: ["English"],
            contactOption: "TollFree",
          },
        ],
        address: {
          "@type": "PostalAddress",
          streetAddress: "548 Market St",
          addressLocality: "San Francisco",
          addressRegion: "CA",
          postalCode: "94104",
          addressCountry: "US",
        },
      },

      // 2. WebSite
      {
        "@type": "WebSite",
        "@id": "https://proxipilot.com/#website",
        url: "https://proxipilot.com",
        name: "ProxiPilot",
        description: "Autonomous Multi-Tenant AI Email Automation Platform with Vector RAG.",
        publisher: {
          "@id": "https://proxipilot.com/#organization",
        },
        inLanguage: "en-US",
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: "https://proxipilot.com/search?q={search_term_string}",
          },
          "query-input": "required name=search_term_string",
        },
      },

      // 3. WebPage
      {
        "@type": "WebPage",
        "@id": "https://proxipilot.com/#webpage",
        url: "https://proxipilot.com",
        name: "ProxiPilot — Autonomous AI Email Automation Platform for Enterprise",
        isPartOf: {
          "@id": "https://proxipilot.com/#website",
        },
        about: {
          "@id": "https://proxipilot.com/#software",
        },
        description:
          "Turn high-volume inbox chaos into accurate, automated workflows. Connect Gmail and Microsoft Outlook with hybrid Qdrant vector retrieval.",
        breadcrumb: {
          "@id": "https://proxipilot.com/#breadcrumb",
        },
        primaryImageOfPage: {
          "@type": "ImageObject",
          url: "https://proxipilot.com/og-image.png",
          width: 1200,
          height: 630,
        },
        inLanguage: "en-US",
      },

      // 4. BreadcrumbList
      {
        "@type": "BreadcrumbList",
        "@id": "https://proxipilot.com/#breadcrumb",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: "https://proxipilot.com",
          },
        ],
      },

      // 5. SoftwareApplication
      {
        "@type": "SoftwareApplication",
        "@id": "https://proxipilot.com/#software",
        name: "ProxiPilot",
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "Email Automation & Enterprise AI Operations",
        operatingSystem: "Cloud, Web Browser",
        url: "https://proxipilot.com",
        description:
          "Autonomous enterprise email assistant powered by hybrid vector RAG and evidence-gated planning.",
        screenshot: "https://proxipilot.com/og-image.png",
        author: {
          "@id": "https://proxipilot.com/#organization",
        },
        publisher: {
          "@id": "https://proxipilot.com/#organization",
        },
        featureList: [
          "Bidirectional Gmail & Microsoft Outlook OAuth synchronization",
          "Real-time hybrid RAG with Qdrant vector database",
          "Evidence-gated reply planner ensuring zero hallucinations",
          "Transactional outbox with human-in-the-loop approval workflows",
          "Multi-tenant cryptographic workspace data isolation",
          "Persistent thread memory & client communication style calibration",
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
              url: "https://proxipilot.com/signup",
            },
            {
              "@type": "Offer",
              name: "Growth",
              price: "149",
              priceCurrency: "USD",
              availability: "https://schema.org/InStock",
              url: "https://proxipilot.com/signup",
            },
            {
              "@type": "Offer",
              name: "Enterprise",
              price: "399",
              priceCurrency: "USD",
              availability: "https://schema.org/InStock",
              url: "https://proxipilot.com/signup",
            },
          ],
        },
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: "4.9",
          bestRating: "5",
          worstRating: "1",
          ratingCount: "128",
          reviewCount: "128",
        },
      },

      // 6. FAQPage
      {
        "@type": "FAQPage",
        "@id": "https://proxipilot.com/#faq",
        isPartOf: {
          "@id": "https://proxipilot.com/#webpage",
        },
        mainEntity: landingConfig.sections.faq.questions.map((faq) => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.a,
          },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(masterJsonLd) }}
      />
      <LandingPage />
    </>
  );
}
