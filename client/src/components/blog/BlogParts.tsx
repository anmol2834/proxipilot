import type React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  IconHome,
  IconCalendarEvent,
  IconClock,
  IconArrowRight,
  IconArrowLeft,
  IconSparkles,
  IconHeadset,
  IconShieldLock,
  IconPlugConnected,
  IconInbox,
  IconStarFilled,
  type Icon as TablerIcon,
} from "@tabler/icons-react";
import type { BlogPost } from "@/data/blog-posts";
import b from "./blog.module.css";

/** Marketing artwork quality; must be listed in images.qualities (next.config.ts). */
export const BLOG_IMG_Q = 95;

export const CATEGORY_ICONS: Record<string, TablerIcon> = {
  "ai-automation": IconSparkles,
  "customer-support": IconHeadset,
  "security-compliance": IconShieldLock,
  integrations: IconPlugConnected,
  "email-productivity": IconInbox,
};

export function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Newest first, with the featured post leading. */
export function sortPosts(posts: BlogPost[]) {
  return [...posts].sort(
    (a, c) => Number(!!c.featured) - Number(!!a.featured) || c.publishedAt.localeCompare(a.publishedAt),
  );
}

/* ------------------------------------------------------------------ */

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className={b.crumb}>
      <IconHome size={14} stroke={1.8} aria-hidden="true" />
      {items.map((it, i) => (
        <span key={it.label} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {i > 0 && <span className={b.crumbSep}>/</span>}
          {it.href ? (
            <Link href={it.href}>{it.label}</Link>
          ) : (
            <span className={b.crumbCurrent} aria-current="page">
              {it.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function SectionHead({
  label,
  title,
  text,
  id,
}: {
  label: string;
  title: React.ReactNode;
  text?: string;
  id?: string;
}) {
  return (
    <div className={b.sectionHead}>
      <h2 id={id} className={b.sectionTitle}>
        <span className={b.sectionLabel}>{label}</span>
        {title}
      </h2>
      {text && <p className={b.sectionText}>{text}</p>}
    </div>
  );
}

export function CategoryNav({
  categories,
  posts,
  active,
}: {
  categories: { slug: string; name: string }[];
  posts: BlogPost[];
  active?: string;
}) {
  return (
    <nav aria-label="Blog categories" className={b.catNav}>
      <Link href="/blog" className={`${b.catLink} ${!active ? b.catLinkActive : ""}`} aria-current={!active ? "page" : undefined}>
        All articles <span className={b.catCount}>{posts.length}</span>
      </Link>
      {categories.map((c) => {
        const count = posts.filter((p) => p.category.slug === c.slug).length;
        const isActive = c.slug === active;
        return (
          <Link
            key={c.slug}
            href={`/blog/category/${c.slug}`}
            className={`${b.catLink} ${isActive ? b.catLinkActive : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            {c.name} <span className={b.catCount}>{count}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function PostCard({ post, priority = false }: { post: BlogPost; priority?: boolean }) {
  return (
    <Link href={`/blog/${post.slug}`} className={b.card}>
      <div className={b.cardMeta}>
        <span>
          <IconCalendarEvent size={15} stroke={1.7} aria-hidden="true" />
          <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
        </span>
        <i className={b.dot} aria-hidden="true" />
        <span>
          <IconClock size={14} stroke={1.7} aria-hidden="true" />
          {post.readTime}
        </span>
      </div>
      <h3 className={b.cardTitle}>{post.title}</h3>
      <p className={b.cardExcerpt}>{post.excerpt}</p>
      <div className={b.cardMedia}>
        {post.coverImage && (
          <Image
            src={post.coverImage}
            alt={post.coverAlt ?? ""}
            fill
            quality={BLOG_IMG_Q}
            sizes="(max-width: 640px) 100vw, (max-width: 960px) 50vw, 400px"
            preload={priority}
          />
        )}
        <span className={b.cardChip}>{post.category.name}</span>
        {post.featured && (
          <span className={b.cardFeatured}>
            <IconStarFilled size={11} aria-hidden="true" /> Featured
          </span>
        )}
        <span className={b.readMore} aria-hidden="true">
          Read More <IconArrowRight size={14} stroke={2.2} />
        </span>
      </div>
    </Link>
  );
}

export function PostGrid({ posts }: { posts: BlogPost[] }) {
  return (
    <div className={b.grid}>
      {posts.map((p, i) => (
        <PostCard key={p.slug} post={p} priority={i < 3} />
      ))}
    </div>
  );
}

export function TopicGrid({
  categories,
  posts,
}: {
  categories: { slug: string; name: string; description: string }[];
  posts: BlogPost[];
}) {
  return (
    <div className={b.topics}>
      {categories.map((c, i) => {
        const Icon = CATEGORY_ICONS[c.slug] ?? IconSparkles;
        const count = posts.filter((p) => p.category.slug === c.slug).length;
        // Desktop grid is 6 tracks: five topics → 3 + 2 (last two wider); four → 2 × 2.
        const n = categories.length;
        const wide = (n === 5 && i >= 3) || n === 4 || n === 2;
        return (
          <Link key={c.slug} href={`/blog/category/${c.slug}`} className={`${b.topic} ${wide ? b.topicWide : ""}`}>
            <div className={b.topicTop}>
              <span className={b.topicIcon}>
                <Icon size={21} stroke={1.9} />
              </span>
              <span className={b.topicCount}>
                {count} {count === 1 ? "article" : "articles"}
              </span>
            </div>
            <h3 className={b.topicName}>{c.name}</h3>
            <p className={b.topicText}>{c.description}</p>
            <span className={b.topicLink}>
              Explore topic <IconArrowRight size={15} stroke={2.2} />
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function PlaneMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 140" fill="none" aria-hidden="true">
      <path d="M8 70 L192 8 L140 132 L96 86 Z" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
      <path d="M96 86 L192 8" stroke="#fff" strokeWidth="3" />
      <path d="M96 86 L104 124 L120 104" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}

export function BlogCta() {
  return (
    <section className={b.cta} aria-labelledby="blog-cta-title">
      <PlaneMark className={b.ctaPlane} />
      <div className={b.container}>
        <h2 id="blog-cta-title" className={b.ctaTitle}>
          <span className={b.ctaLabel}>Put it to work</span>
          Ready to turn your knowledge base into replies you can trust?
          <IconArrowLeft className={b.ctaArrow} size={44} stroke={1.6} aria-hidden="true" />
        </h2>
        <p className={b.ctaText}>
          Connect your Google Workspace or Microsoft 365 inbox in minutes. ProxiPilot drafts evidence-grounded replies
          from your own documents, and your team reviews and sends.
        </p>
        <div className={b.ctaActions}>
          <Link href="/signup" className={b.btnWhite}>
            Start Free Trial <IconArrowRight size={16} stroke={2.2} />
          </Link>
          <Link href="/request-demo" className={b.btnOutline}>
            Request a Demo
          </Link>
        </div>
      </div>
    </section>
  );
}
