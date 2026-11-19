import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { GlobalNavbar } from "@/components/navigation/GlobalNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { getAllBlogPosts, getAllCategories, getBlogPostsByCategory } from "@/data/blog-posts";
import { IconSparkles } from "@tabler/icons-react";
import {
  Breadcrumb,
  SectionHead,
  CategoryNav,
  PostGrid,
  TopicGrid,
  BlogCta,
  CATEGORY_ICONS,
  sortPosts,
} from "@/components/blog/BlogParts";
import b from "@/components/blog/blog.module.css";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllCategories().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const cat = getAllCategories().find((c) => c.slug === slug);

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

  const allPosts = getAllBlogPosts();
  const posts = sortPosts(getBlogPostsByCategory(cat.slug));
  const others = categories.filter((c) => c.slug !== cat.slug);
  const Icon = CATEGORY_ICONS[cat.slug] ?? IconSparkles;

  return (
    <div className={b.page}>
      <GlobalNavbar />

      <main className={b.main}>
        <section className={b.catHero} aria-labelledby="cat-title">
          <div className={b.container}>
            <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Blog", href: "/blog" }, { label: cat.name }]} />
            <div className={b.catIcon} aria-hidden="true">
              <Icon size={28} stroke={1.8} />
            </div>
            <span className={b.pill} style={{ marginTop: 18 }}>
              Topic Category
            </span>
            <h1 id="cat-title" className={b.catTitle}>
              {cat.name}
            </h1>
            <p className={b.heroText}>{cat.description}</p>
            <div className={b.catMeta}>
              {posts.length} {posts.length === 1 ? "article" : "articles"} in this topic
            </div>
          </div>
        </section>

        <section className={b.section} style={{ paddingTop: 24 }} aria-label={`${cat.name} articles`}>
          <div className={b.container}>
            <CategoryNav categories={categories} posts={allPosts} active={cat.slug} />
            {posts.length === 0 ? (
              <div className={b.empty}>
                <h3>New articles coming soon</h3>
                <p style={{ margin: 0 }}>
                  We&rsquo;re writing for this topic now. Meanwhile, <Link href="/blog">browse all articles</Link>.
                </p>
              </div>
            ) : (
              <PostGrid posts={posts} />
            )}
          </div>
        </section>

        <section className={b.section} aria-labelledby="cat-more-title">
          <div className={b.container}>
            <SectionHead
              id="cat-more-title"
              label="Keep exploring"
              title="Other Topics"
              text="Every track is written by the team building ProxiPilot."
            />
            <TopicGrid categories={others} posts={allPosts} />
          </div>
        </section>

        <BlogCta />
      </main>

      <LandingFooter />
    </div>
  );
}
