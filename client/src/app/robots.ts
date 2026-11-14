import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://proxipilot.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/signup", "/signin", "/login", "/favicon.ico", "/site.webmanifest"],
        disallow: ["/dashboard/", "/api/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
