import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft, IconArrowUpRight, IconBook2, IconMail } from "@tabler/icons-react";
import { HELP_TOPICS } from "@/data/help-content";
import { SectionBackground } from "@/components/landing/layout/SectionBackground";
import styles from "@/components/help/help.module.css";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return HELP_TOPICS.map(({ slug }) => ({ slug }));
}

async function getTopic(params: Props["params"]) {
  const { slug } = await params;
  const topic = HELP_TOPICS.find((item) => item.slug === slug);
  if (!topic) notFound();
  return topic;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, title, description } = await getTopic(params);
  const url = `/help/${slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "article" },
  };
}

export default async function HelpTopicPage({ params }: Props) {
  const topic = await getTopic(params);
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Help Center",
        item: "https://proxipilot.com/help",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: topic.title,
        item: `https://proxipilot.com/help/${topic.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs).replace(/</g, "\\u003c") }}
      />
      <header className={styles.hero}>
        <SectionBackground variant="kencode" className={styles.heroTexture} />
        <div className={`${styles.container} ${styles.topicHero}`}>
          <nav aria-label="Breadcrumb">
            <Link href="/help">
              <IconArrowLeft size={16} aria-hidden="true" /> Help Center
            </Link>
          </nav>
          <h1>{topic.title}</h1>
          <p className={styles.lead}>{topic.description}</p>
        </div>
      </header>

      <div className={`${styles.container} ${styles.articleGrid}`}>
        <article className={styles.article} aria-labelledby="steps-heading">
          <h2 id="steps-heading">What to do</h2>
          <ol className={styles.steps}>
            {topic.steps.map(([heading, detail], index) => (
              <li key={heading} id={`step-${index + 1}`}>
                <h3>{heading}</h3>
                <p>{detail}</p>
              </li>
            ))}
          </ol>
        </article>

        <aside className={styles.sidebar}>
          <div className={styles.sideCard}>
            <h2>
              <IconBook2 size={19} aria-hidden="true" /> Further reading
            </h2>
            {topic.links.map(([label, href]) => (
              <Link key={href} href={href}>
                {label} <IconArrowUpRight size={15} aria-hidden="true" />
              </Link>
            ))}
          </div>
          <div className={styles.sideCard}>
            <h2>
              <IconMail size={19} aria-hidden="true" /> Still need help?
            </h2>
            <Link href="/help#contact-support">
              Contact ProxiPilot support <IconArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </aside>

        <nav className={styles.related} aria-label="Other help topics">
          <h2>Explore more help topics</h2>
          {HELP_TOPICS.filter(({ slug }) => slug !== topic.slug).map(({ slug, title }) => (
            <Link key={slug} href={`/help/${slug}`}>
              {title} <IconArrowUpRight size={15} aria-hidden="true" />
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
