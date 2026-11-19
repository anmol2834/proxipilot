import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://proxipilot.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/about",
          "/features",
          "/how-it-works",
          "/pricing",
          "/solutions",
          "/solutions/",
          "/integrations",
          "/contact",
          "/faq",
          "/blog",
          "/blog/",
          "/testimonials",
          "/security",
          "/help",
          "/docs",
          "/docs/",
          "/signup",
          "/signin",
          "/login",
          "/terms",
          "/privacy",
          "/cookies",
          "/acceptable-use",
          "/email-sending-policy",
          "/refund",
          "/grievance-redressal",
          "/dpa",
          "/subprocessors",
          "/data-retention",
          "/intellectual-property",
          "/law-enforcement-requests",
          "/privacy-request",
          "/favicon.ico",
          "/site.webmanifest",
        ],
        disallow: ["/dashboard/", "/api/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
