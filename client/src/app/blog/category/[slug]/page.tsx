import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { GlobalNavbar } from "@/components/navigation/GlobalNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import {
  getAllCategories,
  getBlogPostsByCategory,
} from "@/data/blog-posts";
import {
  IconArrowLeft,
  IconArrowRight,
  IconChevronRight,
  IconClock,
  IconFolder,
} from "@tabler/icons-react";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const categories = getAllCategories();
  return categories.map((c) => ({
    slug: c.slug,
  }));
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const categories = getAllCategories();
  const cat = categories.find((c) => c.slug === slug);

  if (!cat) {
    return { title: "Category Not Found — ProxiPilot Blog" };
  }

  return {
    title: `${cat.name} Articles — ProxiPilot Blog`,
    description: cat.description,
    alternates: { canonical: `https://proxipilot.com/blog/category/${cat.slug}` },
  };
}

export default async function BlogCategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const categories = getAllCategories();
  const cat = categories.find((c) => c.slug === slug);

  if (!cat) {
    notFound();
  }

  const posts = getBlogPostsByCategory(cat.slug);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#FFFFFF" }}>
      <GlobalNavbar />

      <main style={{ flex: "1 0 auto" }}>
        {/* Category Header */}
        <section
          style={{
            padding: "56px 24px 44px",
            backgroundColor: "#F8FAFC",
            borderBottom: "1px solid #E2E8F0",
          }}
        >
          <div style={{ maxWidth: 1160, margin: "0 auto" }}>
            {/* Breadcrumbs */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                color: "#64748B",
                marginBottom: 16,
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
              <span style={{ color: "#0F172A", fontWeight: 600 }}>{cat.name}</span>
            </div>

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
              <IconFolder size={14} />
              Topic Category
            </div>

            <h1
              style={{
                fontSize: "clamp(28px, 4vw, 40px)",
                fontWeight: 800,
                color: "#0F172A",
                lineHeight: 1.18,
                letterSpacing: "-0.025em",
                marginBottom: 12,
              }}
            >
              {cat.name}
            </h1>

            <p
              style={{
                fontSize: "clamp(15px, 2vw, 17px)",
                color: "#475569",
                lineHeight: 1.55,
                maxWidth: 680,
                margin: 0,
              }}
            >
              {cat.description}
            </p>
          </div>
        </section>

        {/* Article Grid / Empty State */}
        <section style={{ padding: "56px 24px 64px", maxWidth: 1160, margin: "0 auto" }}>
          {posts.length === 0 ? (
            <div
              style={{
                padding: "56px 24px",
                textAlign: "center",
                backgroundColor: "#F8FAFC",
                borderRadius: 14,
                border: "1px solid #E2E8F0",
              }}
            >
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>
                No articles published in this category yet.
              </h3>
              <p style={{ fontSize: 14, color: "#64748B", marginBottom: 20 }}>
                Check back soon or explore other engineering topics in our blog.
              </p>
              <Link
                href="/blog"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  color: "#2563EB",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                <IconArrowLeft size={16} /> View all articles
              </Link>
            </div>
          ) : (
            <div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                  gap: 24,
                }}
              >
                {posts.map((post) => (
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
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 12,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#2563EB",
                          backgroundColor: "#EFF6FF",
                          padding: "3px 8px",
                          borderRadius: 4,
                        }}
                      >
                        {post.category.name}
                      </span>
                      <span style={{ fontSize: 12, color: "#94A3B8" }}>{post.readTime}</span>
                    </div>

                    <h2
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
                    </h2>

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
                  <IconArrowLeft size={16} /> Back to all categories
                </Link>
              </div>
            </div>
          )}
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
