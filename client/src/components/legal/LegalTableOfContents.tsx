"use client";

import React, { useState, useEffect } from "react";
import { IconChevronDown, IconChevronUp, IconList } from "@tabler/icons-react";

export interface TocItem {
  id: string;
  title: string;
}

export function LegalTableOfContents({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id || "");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!items.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries.find((entry) => entry.isIntersecting);
        if (visibleEntry) {
          setActiveId(visibleEntry.target.id);
        }
      },
      {
        rootMargin: "-80px 0% -65% 0%",
        threshold: 0,
      }
    );

    items.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [items]);

  const handleScrollTo = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      const yOffset = -84;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
      setActiveId(id);
      setMobileOpen(false);
      window.history.pushState(null, "", `#${id}`);
    }
  };

  return (
    <>
      {/* Mobile / Tablet Accordion (< 1024px) */}
      <div
        className="legal-toc-mobile"
        style={{
          display: "none",
          width: "100%",
          marginBottom: 20,
          borderRadius: 8,
          border: "1px solid #E2E8F0",
          background: "#FFFFFF",
          overflow: "hidden",
        }}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-toc-list"
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            background: "#F8FAFC",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "#1E293B" }}>
            <IconList size={16} color="#2563EB" />
            <span>Table of Contents ({items.length} sections)</span>
          </div>
          {mobileOpen ? <IconChevronUp size={16} color="#64748B" /> : <IconChevronDown size={16} color="#64748B" />}
        </button>

        {mobileOpen && (
          <nav id="mobile-toc-list" aria-label="Table of contents mobile" style={{ padding: "8px 12px 12px", borderTop: "1px solid #E2E8F0" }}>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {items.map((item, index) => {
                const isActive = activeId === item.id;
                return (
                  <li key={item.id} style={{ marginBottom: 4 }}>
                    <a
                      href={`#${item.id}`}
                      onClick={(e) => handleScrollTo(e, item.id)}
                      style={{
                        display: "block",
                        padding: "5px 8px",
                        fontSize: 12.5,
                        lineHeight: 1.4,
                        borderRadius: 5,
                        textDecoration: "none",
                        color: isActive ? "#2563EB" : "#475569",
                        backgroundColor: isActive ? "#EFF6FF" : "transparent",
                        fontWeight: isActive ? 600 : 400,
                      }}
                    >
                      {index + 1}. {item.title}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </div>

      {/* Desktop Sticky Sidebar (>= 1024px) */}
      <nav
        className="legal-toc-desktop"
        aria-label="Table of contents"
        style={{
          position: "sticky",
          top: 92,
          maxHeight: "calc(100vh - 120px)",
          overflowY: "auto",
          width: 250,
          minWidth: 250,
          paddingRight: 16,
          scrollbarWidth: "thin",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, paddingLeft: 8 }}>
          <IconList size={15} color="#2563EB" />
          <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748B" }}>
            On this page
          </span>
        </div>

        <ul style={{ listStyle: "none", margin: 0, padding: 0, position: "relative" }}>
          {items.map((item, index) => {
            const isActive = activeId === item.id;
            return (
              <li key={item.id} style={{ marginBottom: 2 }}>
                <a
                  href={`#${item.id}`}
                  onClick={(e) => handleScrollTo(e, item.id)}
                  style={{
                    display: "block",
                    padding: "5px 10px",
                    fontSize: 12.5,
                    lineHeight: 1.4,
                    borderRadius: 6,
                    textDecoration: "none",
                    color: isActive ? "#1D4ED8" : "#475569",
                    backgroundColor: isActive ? "#EFF6FF" : "transparent",
                    fontWeight: isActive ? 600 : 400,
                    borderLeft: isActive ? "2px solid #2563EB" : "2px solid transparent",
                    transition: "all 140ms ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = "#0F172A";
                      e.currentTarget.style.backgroundColor = "#F8FAFC";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = "#475569";
                      e.currentTarget.style.backgroundColor = "transparent";
                    }
                  }}
                >
                  <span style={{ opacity: 0.7, marginRight: 5, fontSize: 11 }}>{index + 1}.</span>
                  {item.title}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <style jsx global>{`
        @media (max-width: 1023px) {
          .legal-toc-mobile {
            display: block !important;
          }
          .legal-toc-desktop {
            display: none !important;
          }
        }
        @media (min-width: 1024px) {
          .legal-toc-mobile {
            display: none !important;
          }
          .legal-toc-desktop {
            display: block !important;
          }
        }
      `}</style>
    </>
  );
}
