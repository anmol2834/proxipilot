"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconBook2,
  IconLifebuoy,
  IconMessageQuestion,
  IconSearch,
  IconMenu2,
  IconX,
  IconArrowUpRight,
  IconArrowRight,
} from "@tabler/icons-react";
import { ProxiPilotLogo } from "@/components/ui/ProxiPilotLogo";
import { DOCS_NAVIGATION } from "@/data/docs-content";
import d from "./docs.module.css";

export interface SearchEntry {
  title: string;
  path: string;
  href: string;
  text: string;
}

export interface TocItem {
  id: string;
  title: string;
}

const TABS = [
  { label: "Guides", href: "/docs", Icon: IconBook2, active: true },
  { label: "Help Center", href: "/help", Icon: IconLifebuoy, active: false },
  { label: "FAQ", href: "/faq", Icon: IconMessageQuestion, active: false },
];

/* ------------------------------------------------------------------ */

/** Highlights the TOC entry for the section in view. Looks ids up inside `root` only: Next can keep a
 *  hidden copy of the previous page in the DOM, so document-wide id lookups may hit the wrong copy. */
function useScrollSpy(ids: string[], root: React.RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(ids[0] ?? "");
  useEffect(() => {
    const scope = root.current;
    if (!ids.length || !scope) return;
    const els = ids
      .map((id) => scope.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`))
      .filter((e): e is HTMLElement => !!e);
    const visible = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting);
        const first = ids.find((id) => visible.get(id));
        if (first) setActive(first);
      },
      { rootMargin: "-80px 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids, root]);
  return active;
}

function SearchDialog({ index, onClose }: { index: SearchEntry[]; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const results = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return index.filter((e) => !e.href.includes("#")).slice(0, 8);
    return index
      .map((e) => {
        const hay = `${e.title} ${e.path} ${e.text}`.toLowerCase();
        if (!terms.every((t) => hay.includes(t))) return null;
        const score = terms.reduce((s, t) => s + (e.title.toLowerCase().includes(t) ? 3 : 1), 0);
        return { e, score };
      })
      .filter((r): r is { e: SearchEntry; score: number } => !!r)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((r) => r.e);
  }, [q, index]);

  useEffect(() => setCursor(0), [q]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div className={d.overlay} onMouseDown={onClose} role="presentation">
      <div
        className={d.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Search documentation"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={d.dialogInput}>
          <IconSearch size={19} stroke={1.8} aria-hidden="true" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search guides, settings and steps"
            aria-label="Search documentation"
            aria-controls="docs-search-results"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              } else if (e.key === "Enter" && results[cursor]) {
                e.preventDefault();
                go(results[cursor].href);
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
          />
          <span className={d.kbd}>Esc</span>
        </div>
        {results.length ? (
          <ul id="docs-search-results" className={d.results} role="listbox">
            {results.map((r, i) => (
              <li key={r.href} role="option" aria-selected={i === cursor}>
                <Link
                  href={r.href}
                  className={`${d.result} ${i === cursor ? d.resultActive : ""}`}
                  onMouseEnter={() => setCursor(i)}
                  onClick={onClose}
                >
                  <span className={d.resultTitle}>{r.title}</span>
                  <span className={d.resultPath}>{r.path}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className={d.noResults}>No guides match &ldquo;{q}&rdquo;. Try a feature name such as Gmail, drafts or knowledge base.</p>
        )}
        <div className={d.dialogFoot}>
          <span>
            <span className={d.kbd}>↑</span> <span className={d.kbd}>↓</span> to move
          </span>
          <span>
            <span className={d.kbd}>Enter</span> to open
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function DocsShell({
  activeSlug,
  toc,
  searchIndex,
  children,
}: {
  activeSlug: string;
  toc: TocItem[];
  searchIndex: SearchEntry[];
  children: React.ReactNode;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const ids = useMemo(() => toc.map((t) => t.id), [toc]);
  const contentRef = useRef<HTMLDivElement>(null);
  const activeId = useScrollSpy(ids, contentRef);

  const openSearch = useCallback(() => {
    setDrawerOpen(false);
    setSearchOpen(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      } else if (e.key === "Escape") {
        setDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header className={d.topbar}>
        <div className={d.topbarInner}>
          <Link href="/docs" className={d.brand} aria-label="ProxiPilot documentation home">
            <ProxiPilotLogo size={28} />
            <span className={d.docsBadge}>Docs</span>
          </Link>

          <nav className={d.tabs} aria-label="Documentation sections">
            {TABS.map(({ label, href, Icon, active }) => (
              <Link key={href} href={href} className={`${d.tab} ${active ? d.tabActive : ""}`} aria-current={active ? "page" : undefined}>
                <Icon size={19} stroke={1.7} aria-hidden="true" />
                {label}
              </Link>
            ))}
          </nav>

          <div className={d.topActions}>
            <Link href="/" className={d.linkQuiet}>
              Back to site
            </Link>
            <Link href="/signup" className={d.btnPrimary}>
              Get started
            </Link>
            <button type="button" className={d.iconBtn} onClick={openSearch} aria-label="Search documentation">
              <IconSearch size={19} stroke={1.8} />
            </button>
            <button
              type="button"
              className={d.iconBtn}
              onClick={() => setDrawerOpen((o) => !o)}
              aria-label={drawerOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={drawerOpen}
              aria-controls="docs-sidebar"
            >
              {drawerOpen ? <IconX size={19} /> : <IconMenu2 size={19} />}
            </button>
          </div>
        </div>
      </header>

      <div className={d.shell}>
        {drawerOpen && <div className={d.drawerBackdrop} onClick={() => setDrawerOpen(false)} aria-hidden="true" />}
        <aside id="docs-sidebar" className={`${d.sidebar} ${drawerOpen ? d.sidebarOpen : ""}`} aria-label="Documentation">
          <nav className={d.drawerTabs} aria-label="Documentation sections">
            {TABS.map(({ label, href, Icon, active }) => (
              <Link key={href} href={href} className={`${d.navLink} ${active ? d.navActive : ""}`}>
                <Icon size={18} stroke={1.7} aria-hidden="true" />
                {label}
              </Link>
            ))}
          </nav>

          <button type="button" className={d.searchBtn} onClick={openSearch}>
            <IconSearch size={18} stroke={1.8} aria-hidden="true" />
            <span>Search docs…</span>
            <span className={d.kbd}>Ctrl K</span>
          </button>

          {DOCS_NAVIGATION.map((group) => (
            <div key={group.group} className={d.navGroup}>
              <p className={d.navGroupTitle}>{group.group}</p>
              <ul className={d.navList}>
                {group.items.map((item) => {
                  const active = item.slug === activeSlug;
                  const external = !item.href.startsWith("/docs");
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`${d.navLink} ${active ? d.navActive : ""}`}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setDrawerOpen(false)}
                      >
                        {item.title}
                        {external && <IconArrowUpRight size={14} className={d.navExternal} aria-label="(opens outside docs)" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </aside>

        <div ref={contentRef} style={{ display: "contents" }}>
          {children}
        </div>

        {toc.length > 0 && (
          <aside className={d.toc} aria-label="On this page">
            <p className={d.tocTitle}>On this page</p>
            <ul className={d.tocList}>
              {toc.map((t) => (
                <li key={t.id}>
                  <a href={`#${t.id}`} className={`${d.tocLink} ${activeId === t.id ? d.tocActive : ""}`}>
                    {t.title}
                  </a>
                </li>
              ))}
            </ul>
            <div className={d.tocHelp}>
              Stuck on a step? Our team answers setup questions.
              <br />
              <Link href="/contact">
                Contact support <IconArrowRight size={14} stroke={2.2} />
              </Link>
            </div>
          </aside>
        )}
      </div>

      {searchOpen && <SearchDialog index={searchIndex} onClose={() => setSearchOpen(false)} />}
    </>
  );
}

export function DocsFeedback() {
  const [sent, setSent] = useState(false);
  return (
    <div className={d.feedback}>
      <span>Was this page helpful?</span>
      {sent ? (
        <span className={d.feedbackThanks} role="status">
          Thanks for the feedback.
        </span>
      ) : (
        <div className={d.feedbackBtns}>
          <button type="button" className={d.feedbackBtn} onClick={() => setSent(true)}>
            Yes
          </button>
          <button type="button" className={d.feedbackBtn} onClick={() => setSent(true)}>
            Not really
          </button>
        </div>
      )}
    </div>
  );
}
