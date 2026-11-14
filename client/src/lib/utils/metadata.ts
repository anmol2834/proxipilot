import type { Metadata } from "next";
import { env } from "@/config/env";
import { APP_CONFIG } from "@/config/app";

export interface ConstructMetadataParams {
  title?: string;
  description?: string;
  image?: string;
  canonicalUrl?: string;
  noIndex?: boolean;
}

export function constructMetadata({
  title,
  description = APP_CONFIG.description,
  image = "/og-image.png",
  canonicalUrl,
  noIndex = false,
}: ConstructMetadataParams = {}): Metadata {
  const fullTitle = title
    ? `${title} | ${APP_CONFIG.name}`
    : `${APP_CONFIG.name} — Autonomous AI Proxy`;
  const url = canonicalUrl ? `${env.NEXT_PUBLIC_APP_URL}${canonicalUrl}` : env.NEXT_PUBLIC_APP_URL;

  return {
    title: fullTitle,
    description,
    metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: APP_CONFIG.name,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: fullTitle,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image],
      creator: "@proxipilot",
    },
    robots: {
      index: !noIndex,
      follow: !noIndex,
      googleBot: {
        index: !noIndex,
        follow: !noIndex,
      },
    },
  };
}
