import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { GlobalNavbar } from "@/components/navigation/GlobalNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { getAllBlogPosts, getBlogPostBySlug } from "@/data/blog-posts";
import {
  IconCalendarEvent,
  IconRefresh,
  IconClock,
  IconArrowLeft,
  IconBrandX,
  IconBrandLinkedin,
  IconMail,
} from "@tabler/icons-react";
import {
  BLOG_IMG_Q,
  Breadcrumb,
  SectionHead,
  PostGrid,
  BlogCta,
  formatDate,
  sortPosts,
} from "@/components/blog/BlogParts";
import b from "@/components/blog/blog.module.css";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

const SITE = "https://proxipilot.com";

export async function generateStaticParams() {
  return getAllBlogPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    return { title: "Article Not Found — ProxiPilot Blog" };
  }

  return {
    title: `${post.title} — ProxiPilot Blog`,
    description: post.excerpt,
    alternates: { canonical: `${SITE}/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      url: `${SITE}/blog/${post.slug}`,
      ...(post.coverImage ? { images: [{ url: `${SITE}${post.coverImage}`, alt: post.coverAlt }] } : {}),
    },
  };
}

function slugify(text: string) {
  return text
    .replace(/<[^>]+>/g, "")
    .toLowerCase()
    .replace(/&[a-z]+;/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Give every <h2> in the (trusted, in-repo) article HTML an id, and collect them for the table of contents. */
function withHeadingIds(html: string) {
  const toc: { id: string; text: string }[] = [];
  const out = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (_m, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, "").trim();
    const id = slugify(text) || `section-${toc.length + 1}`;
    toc.push({ id, text });
    return `<h2 id="${id}">${inner}</h2>`;
  });
  return { html: out, toc };
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const { html, toc } = withHeadingIds(post.content);
  const all = sortPosts(getAllBlogPosts()).filter((p) => p.slug !== post.slug);
  const related = [
    ...all.filter((p) => p.category.slug === post.category.slug),
    ...all.filter((p) => p.category.slug !== post.category.slug),
  ].slice(0, 3);

  const url = `${SITE}/blog/${post.slug}`;
  const share = [
    {
      label: "Share on X",
      href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(post.title)}`,
      Icon: IconBrandX,
    },
    {
      label: "Share on LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      Icon: IconBrandLinkedin,
    },
    {
      label: "Share by email",
      href: `mailto:?subject=${encodeURIComponent(post.title)}&body=${encodeURIComponent(url)}`,
      Icon: IconMail,
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    ...(post.coverImage ? { image: `${SITE}${post.coverImage}` } : {}),
    author: { "@type": "Organization", name: post.author.name },
    publisher: { "@type": "Organization", name: "ProxiPilot", url: SITE },
    mainEntityOfPage: url,
  };

  return (
    <div className={b.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <GlobalNavbar />

      <main className={b.main}>
        <article>
          <header className={b.postHero}>
            <div className={b.container}>
              <Breadcrumb
                items={[
                  { label: "Home", href: "/" },
                  { label: "Blog", href: "/blog" },
                  { label: post.category.name, href: `/blog/category/${post.category.slug}` },
                ]}
              />
              <div className={b.postCat}>
                <Link href={`/blog/category/${post.category.slug}`} className={b.pill}>
                  {post.category.name}
                </Link>
              </div>
              <h1 className={b.postTitle}>{post.title}</h1>
              <div className={b.byline}>
                <span className={b.author}>
                  <span className={b.authorAvatar} aria-hidden="true">
                    {initials(post.author.name)}
                  </span>
                  <span>
                    <span className={b.authorName}>{post.author.name}</span>
                    <span className={b.authorRole}>{post.author.role}</span>
                  </span>
                </span>
                <i className={b.bylineSep} aria-hidden="true" />
                <span>
                  <IconCalendarEvent size={15} stroke={1.7} aria-hidden="true" />
                  Published <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                </span>
                {post.updatedAt !== post.publishedAt && (
                  <span>
                    <IconRefresh size={15} stroke={1.7} aria-hidden="true" />
                    Updated <time dateTime={post.updatedAt}>{formatDate(post.updatedAt)}</time>
                  </span>
                )}
                <span>
                  <IconClock size={15} stroke={1.7} aria-hidden="true" />
                  {post.readTime}
                </span>
              </div>
            </div>
            {post.coverImage && (
              <div className={b.cover}>
                <Image
                  src={post.coverImage}
                  alt={post.coverAlt ?? ""}
                  fill
                  quality={BLOG_IMG_Q}
                  sizes="(max-width: 1200px) 100vw, 1160px"
                  preload
                />
              </div>
            )}
          </header>

          <div className={b.container}>
            <div className={b.postLayout}>
              <div>
                <p className={b.lead}>{post.excerpt}</p>
                <div className={b.prose} dangerouslySetInnerHTML={{ __html: html }} />

                <div className={b.authorBox}>
                  <span className={b.authorAvatar} aria-hidden="true">
                    {initials(post.author.name)}
                  </span>
                  <div>
                    <p className={b.authorBoxName}>{post.author.name}</p>
                    <p className={b.authorBoxRole}>{post.author.role}</p>
                    <p className={b.authorBoxText}>
                      Building production-grade AI email copilots grounded in deterministic enterprise knowledge.
                    </p>
                  </div>
                </div>

                <Link href="/blog" className={b.backLink}>
                  <IconArrowLeft size={16} /> Back to all articles
                </Link>
              </div>

              <aside className={b.aside} aria-label="Article tools">
                {toc.length > 0 && (
                  <nav className={b.asideCard} aria-label="On this page">
                    <p className={b.asideTitle}>On this page</p>
                    <ol className={b.toc}>
                      {toc.map((t, i) => (
                        <li key={t.id}>
                          <a href={`#${t.id}`}>
                            <span className={b.tocNum}>{String(i + 1).padStart(2, "0")}</span>
                            {t.text}
                          </a>
                        </li>
                      ))}
                    </ol>
                  </nav>
                )}
                <div className={b.asideCard}>
                  <p className={b.asideTitle}>Share</p>
                  <div className={b.share}>
                    {share.map(({ label, href, Icon }) => (
                      <a
                        key={label}
                        href={href}
                        className={b.shareBtn}
                        aria-label={label}
                        title={label}
                        target={href.startsWith("http") ? "_blank" : undefined}
                        rel="noopener noreferrer"
                      >
                        <Icon size={17} stroke={1.8} />
                      </a>
                    ))}
                  </div>
                </div>
                <div className={b.asideCard}>
                  <p className={b.asideTitle}>Tags</p>
                  <div className={b.tags}>
                    {post.tags.map((tag) => (
                      <span key={tag} className={b.tag}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </article>

        {related.length > 0 && (
          <section className={b.section} aria-labelledby="related-title">
            <div className={b.container}>
              <SectionHead
                id="related-title"
                label="Keep reading"
                title="Related Articles"
                text={`More from ${post.category.name} and across the ProxiPilot journal.`}
              />
              <PostGrid posts={related} />
            </div>
          </section>
        )}

        <BlogCta />
      </main>

      <LandingFooter />
    </div>
  );
}
