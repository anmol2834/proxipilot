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
  },
  twitter: {
    card: "summary_large_image",
    title: landingConfig.meta.title,
    description: landingConfig.meta.description,
  },
};

export default function RootLandingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "ProxiPilot",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Cloud / Web",
    description: landingConfig.meta.description,
    offers: {
      "@type": "Offer",
      price: "249",
      priceCurrency: "USD",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPage />
    </>
  );
}
