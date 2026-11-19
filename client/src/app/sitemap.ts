import type { MetadataRoute } from "next";
import { LEGAL_METADATA } from "@/config/legal";
import { BLOG_POSTS, BLOG_CATEGORIES } from "@/data/blog-posts";
import { DOCS_ARTICLES } from "@/data/docs-content";
import { FAQ_TOPICS } from "@/data/faq-content";
import { HELP_TOPICS } from "@/data/help-content";
import { CASE_STUDIES_DATA } from "@/data/testimonials-data";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://proxipilot.com";
  const now = new Date();

  // Core & Main Marketing Pages
  const mainPages: MetadataRoute.Sitemap = [
    { url: `${baseUrl}`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/features`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/pricing`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/how-it-works`, lastModified: now, changeFrequency: "weekly", priority: 0.85 },
    { url: `${baseUrl}/solutions`, lastModified: now, changeFrequency: "weekly", priority: 0.85 },
    { url: `${baseUrl}/integrations`, lastModified: now, changeFrequency: "weekly", priority: 0.85 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/faq`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    ...FAQ_TOPICS.map((t) => ({
      url: `${baseUrl}/faq/${t.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];

  // Individual Solutions Pages
  const solutionSlugs = [
    "small-business",
    "sales-teams",
    "customer-support",
    "ecommerce",
    "saas-companies",
    "agencies",
    "b2b-businesses",
    "wholesale-businesses",
    "operations-teams",
  ];
  const solutionPages: MetadataRoute.Sitemap = solutionSlugs.map((slug) => ({
    url: `${baseUrl}/solutions/${slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  // Company & Trust Pages
  const companyPages: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/testimonials`, lastModified: now, changeFrequency: "monthly", priority: 0.75 },
    ...CASE_STUDIES_DATA.map((study) => ({
      url: `${baseUrl}/testimonials/${study.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    { url: `${baseUrl}/security`, lastModified: now, changeFrequency: "monthly", priority: 0.85 },
  ];

  // Blog Pages
  const blogPages: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/blog`, lastModified: now, changeFrequency: "daily", priority: 0.85 },
    ...BLOG_POSTS.map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: new Date(post.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...BLOG_CATEGORIES.map((cat) => ({
      url: `${baseUrl}/blog/category/${cat.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];

  // Support & Documentation Pages
  const docPages: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/help`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    ...HELP_TOPICS.map(({ slug }) => ({
      url: `${baseUrl}/help/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${baseUrl}/docs`, lastModified: now, changeFrequency: "weekly", priority: 0.85 },
    ...Object.values(DOCS_ARTICLES).map((doc) => ({
      url: `${baseUrl}/docs/${doc.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.75,
    })),
  ];

  // Auth & Onboarding
  const authPages: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/signin`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
  ];

  // Legal & Regulatory Center
  const legalPages: MetadataRoute.Sitemap = Object.values(LEGAL_METADATA).map((policy) => ({
    url: `${baseUrl}/${policy.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: ["terms", "privacy", "security", "dpa"].includes(policy.slug) ? 0.7 : 0.6,
  }));

  return [
    ...mainPages,
    ...solutionPages,
    ...companyPages,
    ...blogPages,
    ...docPages,
    ...authPages,
    ...legalPages,
  ];
}
