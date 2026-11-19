import type { Metadata } from "next";
import type React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconCalendarEvent, IconClock, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { DOCS_ARTICLES, DOCS_NAVIGATION } from "@/data/docs-content";
import { DocsShell, DocsFeedback, type SearchEntry, type TocItem } from "./DocsShell";
import d from "./docs.module.css";

const SITE = "https://proxipilot.com";

/** Sections of the /docs overview page (shared with its page and the search index). */
export const OVERVIEW_SECTIONS: TocItem[] = [
  { id: "getting-started", title: "1. Quick Start Walkthrough" },
  { id: "integrations", title: "2. Mailbox Integrations" },
  { id: "copilot-rag", title: "3. Vector RAG & Copilot" },
  { id: "draft-management", title: "4. Review & Approval Modes" },
  { id: "architecture", title: "5. Security & Multi-Tenant Isolation" },
];

/** Every nav item by slug, for titles and links of pages outside DOCS_ARTICLES (overview, support). */
const NAV_ITEMS = DOCS_NAVIGATION.flatMap((g) => g.items.map((i) => ({ ...i, group: g.group })));

function navItem(slug: string) {
  return NAV_ITEMS.find((i) => i.slug === slug);
}

export function buildSearchIndex(): SearchEntry[] {
  const out: SearchEntry[] = [
    {
      title: "Documentation Overview",
      path: "Overview & Setup",
      href: "/docs",
      text: "platform documentation overview quick start integrations security",
    },
    ...OVERVIEW_SECTIONS.map((s) => ({
      title: s.title.replace(/^\d+\.\s*/, ""),
      path: "Documentation Overview",
      href: `/docs#${s.id}`,
      text: "",
    })),
  ];
  for (const doc of Object.values(DOCS_ARTICLES)) {
    out.push({ title: doc.title, path: doc.category, href: `/docs/${doc.slug}`, text: doc.description });
    for (const s of doc.sections) {
      out.push({
        title: s.title.replace(/^\d+\.\s*/, ""),
        path: doc.title,
        href: `/docs/${doc.slug}#${s.id}`,
        text: "",
      });
    }
  }
  out.push({ title: "Customer Support Portal", path: "Maintenance & Diagnostics", href: "/contact", text: "help contact" });
  return out;
}

export function DocsFrame({
  activeSlug,
  toc,
  children,
}: {
  activeSlug: string;
  toc: TocItem[];
  children: React.ReactNode;
}) {
  return (
    <div className={d.page}>
      <DocsShell activeSlug={activeSlug} toc={toc} searchIndex={buildSearchIndex()}>
        {children}
      </DocsShell>
      <LandingFooter />
    </div>
  );
}

export function InlineToc({ toc }: { toc: TocItem[] }) {
  if (!toc.length) return null;
  return (
    <details className={d.inlineToc}>
      <summary>On this page</summary>
      <ol>
        {toc.map((t) => (
          <li key={t.id}>
            <a href={`#${t.id}`}>{t.title.replace(/^\d+\.\s*/, "")}</a>
          </li>
        ))}
      </ol>
    </details>
  );
}

export function Pager({ prevSlug, nextSlug }: { prevSlug?: string; nextSlug?: string }) {
  const prev = prevSlug ? navItem(prevSlug) : undefined;
  const next = nextSlug ? navItem(nextSlug) : undefined;
  if (!prev && !next) return null;
  return (
    <nav className={d.pager} aria-label="Previous and next guides">
      {prev && (
        <Link href={prev.href} className={d.pagerLink}>
          <span className={d.pagerLabel}>
            <IconChevronLeft size={15} stroke={2} aria-hidden="true" /> Previous
          </span>
          <span className={d.pagerTitle}>{prev.title}</span>
        </Link>
      )}
      {next && (
        <Link href={next.href} className={`${d.pagerLink} ${d.pagerNext}`}>
          <span className={d.pagerLabel}>
            Next <IconChevronRight size={15} stroke={2} aria-hidden="true" />
          </span>
          <span className={d.pagerTitle}>{next.title}</span>
        </Link>
      )}
    </nav>
  );
}

export function docMetadata(slug: string): Metadata {
  const doc = DOCS_ARTICLES[slug];
  return {
    title: `${doc.title} — ProxiPilot Docs`,
    description: doc.description,
    alternates: { canonical: `${SITE}/docs/${doc.slug}` },
  };
}

export function DocArticleView({ slug }: { slug: string }) {
  const doc = DOCS_ARTICLES[slug];
  if (!doc) notFound();

  const related = doc.relatedSlugs.map((s) => DOCS_ARTICLES[s]).filter(Boolean);

  return (
    <DocsFrame activeSlug={doc.slug} toc={doc.sections}>
      <main className={d.article} id="main-content">
        <p className={d.eyebrow}>{doc.category}</p>
        <h1 className={d.title}>{doc.title}</h1>
        <p className={d.description}>{doc.description}</p>
        <div className={d.meta}>
          <span>
            <IconCalendarEvent size={15} stroke={1.7} aria-hidden="true" /> Updated {doc.updatedAt}
          </span>
          <span>
            <IconClock size={15} stroke={1.7} aria-hidden="true" /> {doc.readTime}
          </span>
        </div>
        <InlineToc toc={doc.sections} />

        <div className={d.prose} dangerouslySetInnerHTML={{ __html: doc.content }} />

        <DocsFeedback />
        <Pager prevSlug={doc.prevSlug} nextSlug={doc.nextSlug} />

        {related.length > 0 && (
          <section className={d.related} aria-labelledby="related-guides">
            <h2 id="related-guides" className={d.relatedTitle}>
              Related guides
            </h2>
            <ul className={d.relatedList}>
              {related.map((r) => (
                <li key={r.slug}>
                  <Link href={`/docs/${r.slug}`}>
                    <span className={d.relatedName}>{r.title}</span>
                    <span className={d.relatedCat}>{r.category}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </DocsFrame>
  );
}
