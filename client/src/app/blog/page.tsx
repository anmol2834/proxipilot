import type { Metadata } from "next";
import Image from "next/image";
import { GlobalNavbar } from "@/components/navigation/GlobalNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { getAllBlogPosts, getAllCategories } from "@/data/blog-posts";
import { IconBook2 } from "@tabler/icons-react";
import {
  BLOG_IMG_Q,
  Breadcrumb,
  SectionHead,
  CategoryNav,
  PostGrid,
  TopicGrid,
  BlogCta,
  sortPosts,
} from "@/components/blog/BlogParts";
import b from "@/components/blog/blog.module.css";

export const metadata: Metadata = {
  title: "Blog & Engineering Insights — ProxiPilot",
  description:
    "Engineering insights, guides, and architectural breakdowns on AI email automation, RAG vector retrieval, inbox productivity, and data privacy.",
  alternates: { canonical: "https://proxipilot.com/blog" },
};

/**
 * Fanned photo strip under the hero title. Unsplash License (free commercial use, no attribution required):
 * circuit EUsVwEOsblE · typing 5p_7M5MP2Iw · team-office T74mVg__F_k · pointing FlPc9_VocJ4 · prisms 2yClsTFXIcE
 */
const FAN = [
  { src: "/blog/hero-circuit.jpg", alt: "Illuminated circuit board in teal light", cls: b.fan1 },
  { src: "/blog/hero-typing.jpg", alt: "Hands typing on a laptop at a white desk", cls: b.fan2 },
  { src: "/blog/hero-team-office.jpg", alt: "Team meeting in a bright, modern office", cls: b.fan3 },
  { src: "/blog/hero-pointing.jpg", alt: "Two colleagues reviewing work on a laptop screen", cls: b.fan4 },
  { src: "/blog/hero-prisms.jpg", alt: "Iridescent blue and purple glass prisms", cls: b.fan5 },
];

export default function BlogHomePage() {
  const posts = sortPosts(getAllBlogPosts());
  const categories = getAllCategories();

  return (
    <div className={b.page}>
      <GlobalNavbar />

      <main className={b.main}>
        {/* Hero */}
        <section className={b.hero} aria-labelledby="blog-title">
          <div className={b.container}>
            <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Blog" }]} />
            <h1 id="blog-title" className={b.heroTitle}>
              Insights, Ideas &amp;
              <br />
              <span className={b.highlight}>Inbox Innovation.</span>
            </h1>
            <p className={b.heroText}>
              Insights on AI email copilot engineering, vector RAG, and inbox automation. Practical technical
              breakdowns, design principles, and enterprise security frameworks written by the team building
              ProxiPilot.
            </p>
            <span className={b.journalTag}>
              <IconBook2 size={16} stroke={1.8} /> ProxiPilot Engineering Journal
            </span>
          </div>
          <div className={b.fan} aria-hidden="true">
            {FAN.map((f, i) => (
              <div key={f.src} className={`${b.fanItem} ${f.cls}`}>
                <Image
                  src={f.src}
                  alt={f.alt}
                  fill
                  quality={BLOG_IMG_Q}
                  sizes="(max-width: 720px) 36vw, 22vw"
                  preload={i === 2}
                />
              </div>
            ))}
          </div>
        </section>

        {/* All posts */}
        <section className={b.section} aria-labelledby="blog-all-title">
          <div className={b.container}>
            <SectionHead
              id="blog-all-title"
              label="Our Blog"
              title={
                <>
                  View All
                  <br />
                  Knowledge Posts
                </>
              }
              text="Dive into expert-written articles, guides and engineering breakdowns that help support, sales and operations teams answer faster without guessing."
            />
            <CategoryNav categories={categories} posts={posts} />
            <PostGrid posts={posts} />
          </div>
        </section>

        {/* Topics */}
        <section className={b.section} aria-labelledby="blog-topics-title">
          <div className={b.container}>
            <SectionHead
              id="blog-topics-title"
              label="Topics"
              title={
                <>
                  Browse by
                  <br />
                  Category
                </>
              }
              text="From RAG architecture to OAuth governance, pick a track and go deep."
            />
            <TopicGrid categories={categories} posts={posts} />
          </div>
        </section>

        <BlogCta />
      </main>

      <LandingFooter />
    </div>
  );
}
