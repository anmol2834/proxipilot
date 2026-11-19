import type { Metadata } from "next";
import Link from "next/link";
import {
  IconArrowRight,
  IconArrowUpRight,
  IconBook2,
  IconBooks,
  IconCircleCheck,
  IconMail,
  IconReceipt,
  IconRocket,
  IconSparkles,
  IconTool,
} from "@tabler/icons-react";
import { HelpCenterClient } from "@/components/help/HelpCenterClient";
import { HelpSearch } from "@/components/help/HelpSearch";
import { SectionBackground } from "@/components/landing/layout/SectionBackground";
import { HELP_EMAIL, HELP_FAQS, HELP_TOPICS } from "@/data/help-content";
import { DOCS_ARTICLES } from "@/data/docs-content";
import styles from "@/components/help/help.module.css";

const title = "Help Center";
const description =
  "Get help with ProxiPilot AI email automation. Connect Gmail or Outlook, review AI drafts, set up business knowledge, and troubleshoot inbox sync.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/help" },
  openGraph: { title: "ProxiPilot Help Center", description, url: "/help" },
};

const icons = {
  rocket: IconRocket,
  mail: IconMail,
  sparkles: IconSparkles,
  books: IconBooks,
  tool: IconTool,
  receipt: IconReceipt,
};

const searchItems = [
  ...HELP_TOPICS.map(({ title, description, slug }) => ({
    title,
    description,
    href: `/help/${slug}`,
  })),
  ...Object.values(DOCS_ARTICLES).map(({ title, description, slug }) => ({
    title,
    description,
    href: `/docs/${slug}`,
  })),
];

export default function HelpCenterPage() {
  return (
    <>
      <section className={styles.hero} aria-labelledby="help-heading">
        <SectionBackground variant="kencode" className={styles.heroTexture} />
        <div className={`${styles.container} ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <div>
              <p className={styles.eyebrow}>ProxiPilot Help Center</p>
              <h1 id="help-heading">
                How can we <span className={styles.headlineAccent}>help?</span>
              </h1>
              <p className={styles.lead}>
                Find answers about your inbox, AI drafts, and workspace, or get in touch with
                ProxiPilot support.
              </p>
              <ul className={styles.checklist}>
                <li>
                  <IconCircleCheck size={19} aria-hidden="true" />
                  <Link href="/help/connect-mailbox">Connect Gmail or Outlook</Link>
                </li>
                <li>
                  <IconCircleCheck size={19} aria-hidden="true" />
                  <Link href="/help/review-ai-drafts">Review and approve AI replies</Link>
                </li>
                <li>
                  <IconCircleCheck size={19} aria-hidden="true" />
                  <Link href="/help/troubleshooting">Fix a mailbox sync issue</Link>
                </li>
              </ul>
            </div>
            <div className={styles.shortcuts}>
              <a href={`mailto:${HELP_EMAIL}`}>
                <span>
                  <IconMail size={17} aria-hidden="true" /> Email support
                </span>
                <small>{HELP_EMAIL}</small>
              </a>
              <Link href="/docs">
                <span>
                  <IconBook2 size={17} aria-hidden="true" /> Documentation{" "}
                  <IconArrowUpRight size={14} aria-hidden="true" />
                </span>
                <small>Setup and integration guides</small>
              </Link>
            </div>
          </div>
          <HelpCenterClient />
        </div>
      </section>

      <section className={`${styles.container} ${styles.content}`} aria-labelledby="browse-heading">
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="browse-heading">Browse help topics</h2>
            <p>Find what you need to set up, run, or troubleshoot ProxiPilot.</p>
          </div>
          <HelpSearch items={searchItems} />
        </div>
        <div className={styles.topicGrid}>
          {HELP_TOPICS.map(({ slug, title, description, icon }) => {
            const Icon = icons[icon];
            return (
              <Link key={slug} href={`/help/${slug}`} className={styles.topic}>
                <span className={styles.tile}>
                  <Icon size={23} stroke={1.7} aria-hidden="true" />
                </span>
                <IconArrowUpRight className={styles.cardArrow} size={19} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{description}</p>
              </Link>
            );
          })}
        </div>

        <section className={styles.faq} aria-labelledby="faq-heading">
          <div>
            <h2 id="faq-heading">Common questions</h2>
            <p>Quick answers for everyday inbox workflows.</p>
          </div>
          <div className={styles.questions}>
            {HELP_FAQS.map(({ question, answer, slug }) => (
              <details key={slug}>
                <summary>{question}</summary>
                <p>{answer}</p>
                <Link href={`/help/${slug}`}>
                  Read the guide <IconArrowRight size={15} aria-hidden="true" />
                </Link>
              </details>
            ))}
          </div>
        </section>
      </section>
    </>
  );
}
