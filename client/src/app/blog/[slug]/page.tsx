import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { GlobalNavbar } from "@/components/navigation/GlobalNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import {
  getAllBlogPosts,
  getBlogPostBySlug,
  getBlogPostsByCategory,
} from "@/data/blog-posts";
import {
  IconCalendar,
  IconClock,
  IconArrowLeft,
  IconArrowRight,
  IconChevronRight,
  IconShare,
  IconSparkles,
} from "@tabler/icons-react";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = getAllBlogPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    return { title: "Article Not Found — ProxiPilot Blog" };
  }

  return {
    title: `${post.title} — ProxiPilot Blog`,
    description: post.excerpt,
    alternates: { canonical: `https://proxipilot.com/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      url: `https://proxipilot.com/blog/${post.slug}`,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const related = getBlogPostsByCategory(post.category.slug)
    .filter((p) => p.slug !== post.slug)
    .slice(0, 2);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: {
      "@type": "Organization",
      name: post.author.name,
    },
    publisher: {
      "@type": "Organization",
      name: "ProxiPilot",
      url: "https://proxipilot.com",
    },
    mainEntityOfPage: `https://proxipilot.com/blog/${post.slug}`,
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#FFFFFF" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <GlobalNavbar />

      <main style={{ flex: "1 0 auto" }}>
        {/* Breadcrumb Header */}
        <section
          style={{
            padding: "40px 24px 32px",
            backgroundColor: "#F8FAFC",
            borderBottom: "1px solid #E2E8F0",
          }}
        >
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                color: "#64748B",
                marginBottom: 16,
                flexWrap: "wrap",
              }}
            >
              <Link href="/" style={{ color: "#64748B", textDecoration: "none" }}>
                Home
              </Link>
              <IconChevronRight size={14} />
              <Link href="/blog" style={{ color: "#64748B", textDecoration: "none" }}>
                Blog
              </Link>
              <IconChevronRight size={14} />
              <Link
                href={`/blog/category/${post.category.slug}`}
                style={{ color: "#64748B", textDecoration: "none" }}
              >
                {post.category.name}
              </Link>
            </div>

            <Link
              href={`/blog/category/${post.category.slug}`}
              style={{
                display: "inline-block",
                padding: "3px 10px",
                borderRadius: 4,
                backgroundColor: "#EFF6FF",
                color: "#2563EB",
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                textDecoration: "none",
                marginBottom: 12,
              }}
            >
              {post.category.name}
            </Link>

            <h1
              style={{
                fontSize: "clamp(26px, 4vw, 38px)",
                fontWeight: 800,
                color: "#0F172A",
                lineHeight: 1.22,
                letterSpacing: "-0.025em",
                marginBottom: 16,
              }}
            >
              {post.title}
            </h1>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                fontSize: 13,
                color: "#64748B",
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontWeight: 600, color: "#1E293B" }}>By {post.author.name}</span>
              <span>•</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <IconCalendar size={14} /> Published {post.publishedAt}
              </span>
              <span>•</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <IconClock size={14} /> {post.readTime}
              </span>
            </div>
          </div>
        </section>

        {/* Article Content */}
        <section style={{ padding: "48px 24px 64px", maxWidth: 860, margin: "0 auto" }}>
          {/* Excerpt Lead Paragraph */}
          <div
            style={{
              fontSize: 18,
              fontWeight: 500,
              color: "#334155",
              lineHeight: 1.6,
              borderLeft: "4px solid #2563EB",
              paddingLeft: 20,
              marginBottom: 36,
            }}
          >
            {post.excerpt}
          </div>

          {/* Body Content */}
          <div
            style={{
              fontSize: 16,
              color: "#334155",
              lineHeight: 1.75,
            }}
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* Tags */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              marginTop: 44,
              paddingTop: 24,
              borderTop: "1px solid #E2E8F0",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: "#64748B" }}>Tags:</span>
            {post.tags.map((tag, i) => (
              <span
                key={i}
                style={{
                  fontSize: 12,
                  padding: "4px 10px",
                  borderRadius: 14,
                  backgroundColor: "#F1F5F9",
                  color: "#475569",
                  fontWeight: 500,
                }}
              >
                #{tag}
              </span>
            ))}
          </div>

          {/* Author Bio Box */}
          <div
            style={{
              marginTop: 36,
              padding: "24px",
              borderRadius: 12,
              backgroundColor: "#F8FAFC",
              border: "1px solid #E2E8F0",
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: "#2563EB",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              PP
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>{post.author.name}</div>
              <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>{post.author.role}</div>
              <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>
                Building production-grade AI email copilots grounded in deterministic enterprise knowledge.
              </div>
            </div>
          </div>

          {/* Related Articles */}
          {related.length > 0 && (
            <div style={{ marginTop: 56 }}>
              <h3
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: "#0F172A",
                  marginBottom: 20,
                  letterSpacing: "-0.02em",
                }}
              >
                Related Reading in {post.category.name}
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: 18,
                }}
              >
                {related.map((rp) => (
                  <Link
                    key={rp.slug}
                    href={`/blog/${rp.slug}`}
                    style={{
                      padding: "18px 20px",
                      borderRadius: 12,
                      border: "1px solid #E2E8F0",
                      backgroundColor: "#FFFFFF",
                      textDecoration: "none",
                      color: "#0F172A",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, color: "#2563EB", fontWeight: 700, marginBottom: 6 }}>
                        {rp.category.name}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4, marginBottom: 8 }}>
                        {rp.title}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "#94A3B8" }}>{rp.readTime}</div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Back to Blog Button */}
          <div style={{ marginTop: 44 }}>
            <Link
              href="/blog"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 14,
                fontWeight: 600,
                color: "#2563EB",
                textDecoration: "none",
              }}
            >
              <IconArrowLeft size={16} /> Back to all articles
            </Link>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
