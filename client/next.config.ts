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
};

export default nextConfig;
