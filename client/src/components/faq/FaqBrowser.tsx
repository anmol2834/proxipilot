"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { IconSearch, IconX, IconPlus, IconBook2, IconReceipt, IconShieldCheck } from "@tabler/icons-react";
import { faqPlainText, type FaqTopic } from "@/data/faq-content";
import f from "./faq.module.css";

/** Render one answer paragraph, turning [label](/href) into links. */
function Rich({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <Link key={m.index} href={m[2]}>
        {m[1]}
      </Link>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <p>{parts}</p>;
}

function HelpCard({ className }: { className: string }) {
  return (
    <div className={className}>
      <p className={f.helpTitle}>Still have questions?</p>
      <p className={f.helpText}>
        If you can&rsquo;t find your answer here, our team can help with setup, billing and security questions.
      </p>
      <div className={f.helpActions}>
        <Link href="/contact" className={f.btnSolid}>
          Contact support
        </Link>
        <Link href="/docs" className={f.btnGhost}>
          Read the docs
        </Link>
      </div>
    </div>
  );
}

export function FaqBrowser({
  title,
  subtitle,
  topics,
  nav,
  activeSlug,
  breadcrumb,
}: {
  title: string;
  subtitle: string;
  /** Topics shown on this page (all on /faq, one on /faq/[topic]). */
  topics: FaqTopic[];
  /** Every topic, for the rail. */
  nav: { slug: string; name: string; count: number }[];
  activeSlug?: string;
  breadcrumb?: boolean;
}) {
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // Open and scroll to a question linked by #id.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLDetailsElement>(`details[id="${CSS.escape(id)}"]`);
    if (el) {
      el.open = true;
      el.scrollIntoView({ block: "start" });
    }
  }, []);

  const terms = useMemo(() => query.toLowerCase().split(/\s+/).filter(Boolean), [query]);
  const visible = useMemo(() => {
    if (!terms.length) return topics;
    return topics
      .map((t) => ({
        ...t,
        items: t.items.filter((it) => {
          const hay = `${it.q} ${it.a.map(faqPlainText).join(" ")} ${t.name}`.toLowerCase();
          return terms.every((term) => hay.includes(term));
        }),
      }))
      .filter((t) => t.items.length > 0);
  }, [terms, topics]);
  const matchCount = visible.reduce((n, t) => n + t.items.length, 0);
  const total = nav.reduce((n, t) => n + t.count, 0);

  return (
    <div className={f.layout}>
      <aside className={f.rail}>
        {breadcrumb && (
          <nav className={f.crumb} aria-label="Breadcrumb">
            <Link href="/faq">FAQ</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{nav.find((n) => n.slug === activeSlug)?.name}</span>
          </nav>
        )}
        <h1 className={f.title}>{title}</h1>
        <p className={f.subtitle}>{subtitle}</p>

        <div className={f.search} role="search">
          <IconSearch size={18} stroke={1.8} aria-hidden="true" />
          <input
            type="search"
            className={f.searchInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions"
            aria-label="Search frequently asked questions"
          />
          {query && (
            <button type="button" className={f.searchClear} onClick={() => setQuery("")} aria-label="Clear search">
              <IconX size={16} />
            </button>
          )}
        </div>

        <nav className={f.topicNav} aria-label="FAQ topics">
          <ul className={f.topicList}>
            <li>
              <Link
                href="/faq"
                className={`${f.topicLink} ${!activeSlug ? f.topicActive : ""}`}
                aria-current={!activeSlug ? "page" : undefined}
              >
                All topics <span className={f.topicCount}>{total}</span>
              </Link>
            </li>
            {nav.map((t) => (
              <li key={t.slug}>
                <Link
                  href={`/faq/${t.slug}`}
                  className={`${f.topicLink} ${activeSlug === t.slug ? f.topicActive : ""}`}
                  aria-current={activeSlug === t.slug ? "page" : undefined}
                >
                  {t.name} <span className={f.topicCount}>{t.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <HelpCard className={f.helpCard} />
      </aside>

      <div ref={listRef}>
        {terms.length > 0 && matchCount > 0 && (
          <p className={f.resultsNote} role="status">
            <strong>{matchCount}</strong> {matchCount === 1 ? "question matches" : "questions match"} &ldquo;{query}&rdquo;
          </p>
        )}

        {visible.length === 0 ? (
          <div className={f.empty} role="status">
            <h2>No questions match &ldquo;{query}&rdquo;</h2>
            <p>
              Try a shorter phrase such as Gmail, pricing or drafts, browse the <Link href="/docs">documentation</Link>, or{" "}
              <Link href="/contact">ask our support team</Link>.
            </p>
          </div>
        ) : (
          visible.map((t, gi) => (
            <section key={t.slug} className={f.group} aria-labelledby={`faq-topic-${t.slug}`}>
              <div className={f.groupHead}>
                <h2 id={`faq-topic-${t.slug}`} className={f.groupPill}>
                  {t.name}
                </h2>
                {!activeSlug && !terms.length && (
                  <Link href={`/faq/${t.slug}`} className={f.groupLink}>
                    Open topic page
                  </Link>
                )}
              </div>
              {!terms.length && <p className={f.groupIntro}>{t.intro}</p>}
              <ul className={f.items}>
                {t.items.map((it, i) => (
                  <li key={it.id}>
                    <details id={it.id} className={f.item} open={(gi === 0 && i === 0 && !terms.length) || undefined}>
                      <summary className={f.summary}>
                        <h3>{it.q}</h3>
                        <IconPlus className={f.plus} stroke={1.8} aria-hidden="true" />
                      </summary>
                      <div className={f.answer}>
                        {it.a.map((p, pi) => (
                          <Rich key={pi} text={p} />
                        ))}
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}

        <section className={f.resources} aria-labelledby="faq-resources">
          <h2 id="faq-resources" className={f.resourcesTitle}>
            Keep exploring
          </h2>
          <div className={f.resourceGrid}>
            <Link href="/docs" className={f.resource}>
              <span className={f.resourceName}>
                <IconBook2 size={18} stroke={1.8} aria-hidden="true" /> Documentation
              </span>
              <span className={f.resourceText}>Step-by-step setup guides for every feature.</span>
            </Link>
            <Link href="/pricing" className={f.resource}>
              <span className={f.resourceName}>
                <IconReceipt size={18} stroke={1.8} aria-hidden="true" /> Pricing &amp; plans
              </span>
              <span className={f.resourceText}>Compare plans and start a 14-day free trial.</span>
            </Link>
            <Link href="/security" className={f.resource}>
              <span className={f.resourceName}>
                <IconShieldCheck size={18} stroke={1.8} aria-hidden="true" /> Security Center
              </span>
              <span className={f.resourceText}>Encryption, data handling and compliance.</span>
            </Link>
          </div>
        </section>

        <HelpCard className={`${f.helpCard} ${f.helpCardBottom}`} />
      </div>
    </div>
  );
}
