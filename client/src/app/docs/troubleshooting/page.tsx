import type { Metadata } from "next";
import { DocsLayout } from "@/components/docs/DocsLayout";
import { DOCS_ARTICLES } from "@/data/docs-content";

const doc = DOCS_ARTICLES["troubleshooting"];

export const metadata: Metadata = {
  title: `${doc.title} — ProxiPilot Docs`,
  description: doc.description,
  alternates: { canonical: `https://proxipilot.com/docs/${doc.slug}` },
};

export default function TroubleshootingDocPage() {
  return (
    <DocsLayout
      currentSlug={doc.slug}
      title={doc.title}
      description={doc.description}
      category={doc.category}
      updatedAt={doc.updatedAt}
      readTime={doc.readTime}
      sections={doc.sections}
      prevSlug={doc.prevSlug}
      nextSlug={doc.nextSlug}
      relatedSlugs={doc.relatedSlugs}
    >
      <div
        style={{ fontSize: 15, color: "#334155", lineHeight: 1.7 }}
        dangerouslySetInnerHTML={{ __html: doc.content }}
      />
    </DocsLayout>
  );
}
