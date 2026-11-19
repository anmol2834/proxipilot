import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  sassOptions: {
    includePaths: [path.join(process.cwd(), "src", "styles")],
  },
  images: {
    // 75 is Next's default; 95 is used for marketing artwork (About page)
    // where visible compression is not acceptable.
    qualities: [75, 95],
    formats: ["image/avif", "image/webp"],
  },
  // Pages removed from the site: send old links and indexed URLs to their closest replacement.
  async redirects() {
    return [
      { source: "/request-demo", destination: "/contact", permanent: true },
      { source: "/support", destination: "/contact", permanent: true },
      { source: "/partners", destination: "/contact", permanent: true },
      { source: "/contact/:desk(sales|support|partners|security)", destination: "/contact", permanent: true },
      { source: "/careers", destination: "/about", permanent: true },
      { source: "/sla", destination: "/security", permanent: true },
      { source: "/ai-transparency", destination: "/privacy", permanent: true },
    ];
  },
};

export default nextConfig;
