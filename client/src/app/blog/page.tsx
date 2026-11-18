import type { Metadata } from "next";
import Link from "next/link";
import { GlobalNavbar } from "@/components/navigation/GlobalNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import {
  getAllBlogPosts,
  getFeaturedPost,
  getAllCategories,
} from "@/data/blog-posts";
import {
  IconBook,
  IconClock,
  IconCalendar,
  IconArrowRight,
  IconSparkles,
  IconTag,
} from "@tabler/icons-react";

export const metadata: Metadata = {
  title: "Blog & Engineering Insights — ProxiPilot",
  description:
    "Engineering insights, guides, and architectural breakdowns on AI email automation, RAG vector retrieval, inbox productivity, and data privacy.",
  alternates: { canonical: "https://proxipilot.com/blog" },
};

export default function BlogHomePage() {
  const posts = getAllBlogPosts();
  const featured = getFeaturedPost();
  const categories = getAllCategories();
  const regularPosts = posts.filter((p) => p.slug !== featured.slug);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#FFFFFF" }}>
      <GlobalNavbar />

      <main style={{ flex: "1 0 auto" }}>
        {/* Blog Hero Section */}
        <section
          style={{
            padding: "56px 24px 40px",
            backgroundColor: "#F8FAFC",
            borderBottom: "1px solid #E2E8F0",
          }}
        >
          <div style={{ maxWidth: 1160, margin: "0 auto" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 10px",
                borderRadius: 20,
                backgroundColor: "#EFF6FF",
                border: "1px solid #BFDBFE",
                color: "#2563EB",
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 14,
              }}
            >
              <IconBook size={14} />
              ProxiPilot Engineering Journal
            </div>

            <h1
              style={{
                fontSize: "clamp(28px, 4vw, 42px)",
                fontWeight: 800,
                color: "#0F172A",
                lineHeight: 1.18,
                letterSpacing: "-0.025em",
                marginBottom: 12,
                maxWidth: 820,
              }}
            >
              Insights on AI email copilot engineering, vector RAG, and inbox automation.
            </h1>

            <p
              style={{
                fontSize: "clamp(15px, 2vw, 17px)",
                color: "#475569",
                lineHeight: 1.55,
                maxWidth: 720,
                marginBottom: 28,
              }}
            >
              Practical technical breakdowns, design principles, and enterprise security frameworks written by the team building ProxiPilot.
            </p>

            {/* Category Navigation Pills */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link
                href="/blog"
                style={{
                  padding: "6px 14px",
                  fontSize: 13,
                  fontWeight: 700,
                  borderRadius: 20,
                  backgroundColor: "#2563EB",
                  color: "#FFFFFF",
                  textDecoration: "none",
                }}
              >
                All Articles
              </Link>
              {categories.map((c) => (
                <Link
                  key={c.slug}
                  href={`/blog/category/${c.slug}`}
                  style={{
                    padding: "6px 14px",
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: 20,
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #CBD5E1",
                    color: "#475569",
                    textDecoration: "none",
                    transition: "border-color 0.15s ease",
                  }}
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Featured Post Card */}
        <section style={{ padding: "48px 24px 32px", maxWidth: 1160, margin: "0 auto" }}>
          <div
            style={{
              padding: "36px 32px",
              borderRadius: 16,
              backgroundColor: "#F8FAFC",
              border: "1px solid #E2E8F0",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "2px 8px",
                borderRadius: 4,
                backgroundColor: "#FEF3C7",
                color: "#B45309",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 12,
              }}
            >
              <IconSparkles size={12} /> Featured Insight
            </div>

            <h2
              style={{
                fontSize: "clamp(22px, 3vw, 30px)",
                fontWeight: 800,
                color: "#0F172A",
                lineHeight: 1.25,
                letterSpacing: "-0.02em",
                marginBottom: 12,
              }}
            >
              <Link
                href={`/blog/${featured.slug}`}
                style={{ color: "#0F172A", textDecoration: "none" }}
              >
                {featured.title}
              </Link>
            </h2>

            <p
              style={{
                fontSize: 15,
                color: "#475569",
                lineHeight: 1.6,
                maxWidth: 820,
                marginBottom: 20,
              }}
            >
              {featured.excerpt}
            </p>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 16,
                paddingTop: 16,
                borderTop: "1px solid #E2E8F0",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 13, color: "#64748B" }}>
                <span style={{ fontWeight: 600, color: "#1E293B" }}>{featured.author.name}</span>
                <span>•</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <IconCalendar size={14} /> {featured.publishedAt}
                </span>
                <span>•</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <IconClock size={14} /> {featured.readTime}
                </span>
              </div>

              <Link
                href={`/blog/${featured.slug}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  color: "#2563EB",
                  fontSize: 14,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Read Article <IconArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>

        {/* Regular Articles Grid */}
        <section style={{ padding: "24px 24px 64px", maxWidth: 1160, margin: "0 auto" }}>
          <h3
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: "#0F172A",
              letterSpacing: "-0.02em",
              marginBottom: 24,
            }}
          >
            Recent Engineering &amp; Operational Guides
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 24,
            }}
          >
            {regularPosts.map((post) => (
              <article
                key={post.slug}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "24px",
                  borderRadius: 14,
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                  transition: "border-color 0.15s ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <Link
                    href={`/blog/category/${post.category.slug}`}
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#2563EB",
                      backgroundColor: "#EFF6FF",
                      padding: "3px 8px",
                      borderRadius: 4,
                      textDecoration: "none",
                    }}
                  >
                    {post.category.name}
                  </Link>
                  <span style={{ fontSize: 12, color: "#94A3B8" }}>{post.readTime}</span>
                </div>

                <h4
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#0F172A",
                    lineHeight: 1.35,
                    marginBottom: 10,
                    letterSpacing: "-0.015em",
                  }}
                >
                  <Link
                    href={`/blog/${post.slug}`}
                    style={{ color: "#0F172A", textDecoration: "none" }}
                  >
                    {post.title}
                  </Link>
                </h4>

                <p
                  style={{
                    fontSize: 14,
                    color: "#64748B",
                    lineHeight: 1.55,
                    margin: "0 0 20px",
                    flex: "1 0 auto",
                  }}
                >
                  {post.excerpt}
                </p>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: 14,
                    borderTop: "1px solid #F1F5F9",
                    fontSize: 12,
                    color: "#94A3B8",
                  }}
                >
                  <span>{post.publishedAt}</span>
                  <Link
                    href={`/blog/${post.slug}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      color: "#2563EB",
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    Read <IconArrowRight size={13} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
