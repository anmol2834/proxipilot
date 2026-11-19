import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GlobalNavbar } from "@/components/navigation/GlobalNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { FaqBrowser } from "@/components/faq/FaqBrowser";
import { FAQ_TOPICS, faqJsonLd, getFaqTopic } from "@/data/faq-content";
import f from "@/components/faq/faq.module.css";

const SITE = "https://proxipilot.com";

interface TopicPageProps {
  params: Promise<{ topic: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return FAQ_TOPICS.map((t) => ({ topic: t.slug }));
}

export async function generateMetadata({ params }: TopicPageProps): Promise<Metadata> {
  const { topic } = await params;
  const t = getFaqTopic(topic);
  if (!t) return { title: "FAQ topic not found — ProxiPilot" };
  return {
    title: `${t.name} FAQ — ProxiPilot`,
    description: t.intro,
    alternates: { canonical: `${SITE}/faq/${t.slug}` },
    openGraph: { title: `${t.heading} — ProxiPilot FAQ`, description: t.intro, url: `${SITE}/faq/${t.slug}`, type: "website" },
  };
}

export default async function FaqTopicPage({ params }: TopicPageProps) {
  const { topic } = await params;
  const t = getFaqTopic(topic);
  if (!t) notFound();

  const nav = FAQ_TOPICS.map((x) => ({ slug: x.slug, name: x.name, count: x.items.length }));
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "FAQ", item: `${SITE}/faq` },
      { "@type": "ListItem", position: 2, name: t.name, item: `${SITE}/faq/${t.slug}` },
    ],
  };

  return (
    <div className={f.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd([t])) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <GlobalNavbar />
      <main className={f.main}>
        <FaqBrowser title={t.heading} subtitle={t.intro} topics={[t]} nav={nav} activeSlug={t.slug} breadcrumb />
      </main>
      <LandingFooter />
    </div>
  );
}
