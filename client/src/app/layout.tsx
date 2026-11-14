import type { Metadata, Viewport } from "next";
import { Inter, Caveat } from "next/font/google";
import { ThemeRegistry } from "@/theme/ThemeRegistry";
import { QueryProvider } from "@/lib/query/query-provider";
import { TenantProvider } from "@/hooks/use-tenant";
import { ToastContainer } from "@/components/ui/feedback/ToastContainer";
import "@/styles/globals.scss";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
});

const caveat = Caveat({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-handwritten",
  weight: ["400", "600", "700"],
});

export const viewport: Viewport = {
  themeColor: "#2563EB",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://proxipilot.com"),
  title: {
    default: "ProxiPilot — Autonomous AI Email Automation Platform",
    template: "%s | ProxiPilot",
  },
  description:
    "Enterprise-grade autonomous AI email automation platform. Securely connect Gmail and Microsoft Outlook, synthesize company knowledge with Qdrant vector retrieval, and automate accurate customer workflows.",
  applicationName: "ProxiPilot",
  authors: [{ name: "ProxiPilot Inc.", url: "https://proxipilot.com" }],
  generator: "Next.js",
  keywords: [
    "AI email automation",
    "autonomous email inbox",
    "enterprise email AI",
    "Gmail AI assistant",
    "Microsoft Outlook AI copilot",
    "RAG email intelligence",
    "Qdrant vector search email",
    "multi-tenant AI platform",
    "automated customer support emails",
    "evidence-gated email replies",
    "AI inbox triage",
    "ProxiPilot",
  ],
  referrer: "origin-when-cross-origin",
  creator: "ProxiPilot Inc.",
  publisher: "ProxiPilot Inc.",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
    languages: {
      "en-US": "https://proxipilot.com",
      "x-default": "https://proxipilot.com",
    },
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
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      {
        rel: "mask-icon",
        url: "/favicon.svg",
        color: "#2563EB",
      },
    ],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://proxipilot.com",
    siteName: "ProxiPilot",
    title: "ProxiPilot — Autonomous AI Email Automation Platform",
    description:
      "Enterprise-grade autonomous AI email automation platform. Securely connect Gmail and Microsoft Outlook, synthesize company knowledge with Qdrant vector retrieval, and automate accurate customer workflows.",
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
    title: "ProxiPilot — Autonomous AI Email Automation Platform",
    description:
      "Enterprise autonomous AI email platform. High-accuracy customer inbox intelligence powered by Qdrant vector RAG.",
    images: ["/og-image.png"],
    creator: "@proxipilot",
    site: "@proxipilot",
  },
  other: {
    "geo.region": "US-CA",
    "geo.placename": "San Francisco",
    "geo.position": "37.7749;-122.4194",
    "ICBM": "37.7749, -122.4194",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "ProxiPilot",
    legalName: "ProxiPilot Inc.",
    url: "https://proxipilot.com",
    logo: "https://proxipilot.com/android-chrome-512x512.png",
    foundingDate: "2024",
    description:
      "ProxiPilot is an enterprise autonomous AI platform automating complex email support and operations workflows with vector retrieval.",
    sameAs: [
      "https://twitter.com/proxipilot",
      "https://linkedin.com/company/proxipilot",
      "https://github.com/proxipilot",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "hello@proxipilot.com",
      availableLanguage: ["English"],
    },
    address: {
      "@type": "PostalAddress",
      streetAddress: "548 Market St",
      addressLocality: "San Francisco",
      addressRegion: "CA",
      postalCode: "94104",
      addressCountry: "US",
    },
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "ProxiPilot",
    url: "https://proxipilot.com",
    description:
      "Autonomous Multi-Tenant AI Email Automation Platform with Vector RAG.",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://proxipilot.com/search?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} ${caveat.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
      <body>
        <QueryProvider>
          <TenantProvider>
            <ThemeRegistry>
              {children}
              <ToastContainer />
            </ThemeRegistry>
          </TenantProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
