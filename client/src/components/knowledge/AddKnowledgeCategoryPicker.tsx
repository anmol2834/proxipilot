"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Typography from "@mui/material/Typography";
import { useKnowledgeStore } from "@/stores/knowledge.store";
import type { KnowledgeCategory } from "@/types/knowledge.types";

export interface PickerCategory {
  id: KnowledgeCategory;
  name: string;
  desc: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
}

/** What each category lets ProxiPilot answer, and the words people use for it (incl. Hinglish). */
const CATEGORY_HINTS: Record<KnowledgeCategory, { example: string; keywords: string[] }> = {
  "products-services": {
    example: "“What's the price of model X?”",
    keywords: ["product", "service", "price", "pricing", "rate", "cost", "catalog", "catalogue", "sku", "model",
      "spec", "stock", "item", "inventory", "daam", "mrp", "quotation", "variant"],
  },
  "company-info": {
    example: "“What's your office address?”",
    keywords: ["company", "about", "contact", "phone", "mobile", "email", "address", "location", "office", "branch",
      "hours", "timing", "website", "gst", "headquarters", "team", "number"],
  },
  policies: {
    example: "“What's your return policy?”",
    keywords: ["policy", "policies", "refund", "return", "cancel", "cancellation", "warranty", "guarantee", "terms",
      "privacy", "replacement", "exchange", "rules", "condition"],
  },
  "support-faqs": {
    example: "“How do I fix error E4?”",
    keywords: ["faq", "faqs", "question", "questions", "support", "troubleshoot", "issue", "problem", "help",
      "error", "fix", "answer", "how to"],
  },
  "offers-promotions": {
    example: "“Any discount on bulk orders?”",
    keywords: ["offer", "offers", "discount", "coupon", "promo", "promotion", "sale", "deal", "festive", "cashback",
      "scheme", "campaign", "bulk discount"],
  },
  "processes-timelines": {
    example: "“Confirmation time after PO?”",
    keywords: ["process", "processes", "timeline", "timelines", "delivery", "dispatch", "shipping", "lead time",
      "po", "purchase order", "confirmation", "turnaround", "tat", "how long", "steps", "onboarding",
      "installation", "payment terms", "eta", "kitne din", "kab", "procedure", "sop", "workflow"],
  },
};

/** Which empty category to suggest first: the ones whose absence costs the most replies. */
const RECOMMEND_ORDER: KnowledgeCategory[] = [
  "products-services", "processes-timelines", "company-info", "policies", "support-faqs", "offers-promotions",
];

function scoreQuery(query: string, id: KnowledgeCategory, name: string): number {
  const q = ` ${query.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim()} `;
  if (q.trim().length < 2) return 0;
  let score = name.toLowerCase().split(/\W+/).some((w) => w.length > 2 && q.includes(` ${w}`)) ? 2 : 0;
  for (const kw of CATEGORY_HINTS[id].keywords) {
    if (q.includes(` ${kw} `) || (kw.length > 3 && q.includes(` ${kw}`))) score += kw.includes(" ") ? 3 : 2;
  }
  return score;
}

export function AddKnowledgeCategoryPicker({
  categories,
  onSelect,
  onClose,
}: {
  categories: PickerCategory[];
  onSelect: (id: KnowledgeCategory) => void;
  onClose: () => void;
}) {
  const { categoryCounts, categoryCountsLoaded, fetchCategoryCounts } = useKnowledgeStore();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!categoryCountsLoaded) void fetchCategoryCounts();
  }, [categoryCountsLoaded, fetchCategoryCounts]);

  const countOf = (id: KnowledgeCategory) => categoryCounts[id] ?? 0;

  const recommended: KnowledgeCategory | null = useMemo(() => {
    if (!categoryCountsLoaded) return null;
    return RECOMMEND_ORDER.find((id) => (categoryCounts[id] ?? 0) === 0) ?? null;
  }, [categoryCounts, categoryCountsLoaded]);

  // Instant keyword match (on the device, no AI call): the category the user's words point to.
  const bestMatch: KnowledgeCategory | null = useMemo(() => {
    let best: KnowledgeCategory | null = null;
    let top = 0;
    for (const c of categories) {
      const s = scoreQuery(query, c.id, c.name);
      if (s > top) {
        top = s;
        best = c.id;
      }
    }
    return best;
  }, [query, categories]);

  useEffect(() => {
    if (bestMatch) setActive(categories.findIndex((c) => c.id === bestMatch));
  }, [bestMatch, categories]);

  // Focus the finder once the dialog's own focus handling has run.
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  // Keyboard: ↑ ↓ move by row, ← → by card (only while the finder is empty, so they still move the
  // text cursor when typing), Enter opens the highlighted category. Handled at window level so it
  // works wherever focus sits inside the dialog.
  const keyState = useRef({ active, query, categories, onSelect });
  keyState.current = { active, query, categories, onSelect };
  useEffect(() => {
    const cols = 3;
    const onKey = (e: KeyboardEvent) => {
      const { active: cur, query: q, categories: cats, onSelect: select } = keyState.current;
      const move = (delta: number) => {
        e.preventDefault();
        const next = (cur + delta + cats.length) % cats.length;
        setActive(next);
        cardRefs.current[next]?.scrollIntoView({ block: "nearest" });
      };
      if (e.key === "ArrowDown") move(cols);
      else if (e.key === "ArrowUp") move(-cols);
      else if (e.key === "ArrowRight" && !q) move(1);
      else if (e.key === "ArrowLeft" && !q) move(-1);
      else if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        select(cats[cur].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const matchedCat = bestMatch ? categories.find((c) => c.id === bestMatch) : null;

  return (
    <Box data-mode="category-select"
         sx={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
      {/* Header */}
      <Box sx={{ px: { xs: 2.5, sm: 3.5 }, pt: { xs: 2.25, sm: 3 }, pb: 2, display: "flex", alignItems: "flex-start",
                 justifyContent: "space-between", gap: 2, flexShrink: 0 }}>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", minWidth: 0 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: "12px", flexShrink: 0, display: "grid", placeItems: "center",
                     background: "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)",
                     boxShadow: "0 6px 16px rgba(37, 99, 235, 0.28)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: { xs: "1.1rem", sm: "1.25rem" }, fontWeight: 800, color: "#0F172A",
                              letterSpacing: "-0.02em", lineHeight: 1.2 }}>
              Add knowledge
            </Typography>
            <Typography sx={{ fontSize: "0.82rem", color: "#64748B", mt: 0.25 }}>
              Pick what you&apos;re adding — ProxiPilot uses it to answer customers accurately.
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} size="small" aria-label="Close dialog"
                    sx={{ color: "#94A3B8", mt: -0.5, "&:hover": { backgroundColor: "#F1F5F9", color: "#334155" } }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </IconButton>
      </Box>

      {/* Smart finder */}
      <Box sx={{ px: { xs: 2.5, sm: 3.5 }, flexShrink: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, height: 42, borderRadius: "12px",
                   border: "1px solid #E2E8F0", backgroundColor: "#F8FAFC", transition: "all 150ms ease",
                   "&:focus-within": { borderColor: "#93C5FD", backgroundColor: "#FFFFFF",
                                       boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.12)" } }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <InputBase
            inputRef={inputRef}
            fullWidth
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Describe what you want to add — e.g. “delivery time after PO” or “price list”"
            inputProps={{ "aria-label": "Describe what you want to add" }}
            sx={{ fontSize: "0.86rem", color: "#0F172A", "& input::placeholder": { color: "#94A3B8", opacity: 1 } }}
          />
          {matchedCat && (
            <Box component="span" sx={{ flexShrink: 0, fontSize: "0.72rem", fontWeight: 700, color: "#1D4ED8",
                                        backgroundColor: "#EFF6FF", border: "1px solid #DBEAFE", borderRadius: "999px",
                                        px: 1, py: 0.25, whiteSpace: "nowrap" }}>
              ↵ {matchedCat.name}
            </Box>
          )}
        </Box>
      </Box>

      {/* Category grid — sized to fit without scrolling */}
      <Box role="listbox" aria-label="Knowledge categories"
           sx={{ px: { xs: 2.5, sm: 3.5 }, pt: 2, pb: 2.5, flex: "1 1 auto", minHeight: 0,
                 overflowY: { xs: "auto", md: "visible" },
                 display: "grid", gap: 1.5,
                 gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" } }}>
        {categories.map((cat, i) => {
          const count = countOf(cat.id);
          const isActive = i === active;
          const isMatch = cat.id === bestMatch;
          const isRecommended = cat.id === recommended && !query;
          return (
            <ButtonBase
              key={cat.id}
              ref={(el) => { cardRefs.current[i] = el; }}
              role="option"
              aria-selected={isActive}
              onClick={() => onSelect(cat.id)}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              sx={{
                position: "relative", display: "flex", flexDirection: "column", alignItems: "stretch",
                textAlign: "left", p: 1.75, borderRadius: "14px", backgroundColor: "#FFFFFF",
                border: "1px solid", borderColor: isMatch ? "#3B82F6" : isActive ? "#BFDBFE" : "#E8EDF3",
                boxShadow: isMatch
                  ? "0 0 0 3px rgba(59, 130, 246, 0.14), 0 8px 20px rgba(37, 99, 235, 0.10)"
                  : isActive ? "0 8px 20px rgba(15, 23, 42, 0.07)" : "0 1px 2px rgba(15, 23, 42, 0.03)",
                transform: isActive ? "translateY(-2px)" : "none",
                transition: "all 160ms cubic-bezier(0.4, 0, 0.2, 1)",
                "&:focus-visible": { outline: "none", borderColor: "#3B82F6" },
                "& .pick-arrow": { opacity: isActive ? 1 : 0, transform: isActive ? "translateX(0)" : "translateX(-4px)" },
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                <Box sx={{ width: 36, height: 36, borderRadius: "10px", backgroundColor: cat.iconBg, flexShrink: 0,
                           display: "grid", placeItems: "center", "& svg": { width: 19, height: 19 } }}>
                  {cat.icon}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }} noWrap>
                    {cat.name}
                  </Typography>
                  <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, mt: 0.25,
                                    color: !categoryCountsLoaded ? "#94A3B8" : count > 0 ? "#64748B" : "#B45309" }}>
                    {!categoryCountsLoaded ? "…" : count > 0 ? `${count.toLocaleString()} item${count === 1 ? "" : "s"}` : "Empty"}
                  </Typography>
                </Box>
                <Box className="pick-arrow" sx={{ color: "#2563EB", transition: "all 160ms ease", flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </Box>
              </Box>

              <Typography sx={{ fontSize: "0.77rem", color: "#475569", lineHeight: 1.45, mt: 1.1,
                                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                                overflow: "hidden", minHeight: "2.9em" }}>
                {cat.desc}
              </Typography>

              <Box sx={{ mt: 1.1, pt: 1, borderTop: "1px dashed #E8EDF3", display: "flex", alignItems: "center",
                         gap: 0.75, minWidth: 0 }}>
                <Typography component="span" sx={{ fontSize: "0.68rem", fontWeight: 700, color: "#94A3B8",
                                                   textTransform: "uppercase", letterSpacing: "0.04em", flexShrink: 0 }}>
                  Answers
                </Typography>
                <Typography component="span" noWrap sx={{ fontSize: "0.74rem", color: "#334155", fontStyle: "italic" }}>
                  {CATEGORY_HINTS[cat.id].example}
                </Typography>
              </Box>

              {(isMatch || isRecommended) && (
                <Box component="span" sx={{
                  position: "absolute", top: -9, right: 12, fontSize: "0.64rem", fontWeight: 800,
                  letterSpacing: "0.03em", textTransform: "uppercase", px: 0.9, py: 0.2, borderRadius: "999px",
                  color: isMatch ? "#FFFFFF" : "#92400E",
                  background: isMatch ? "linear-gradient(135deg, #2563EB, #7C3AED)" : "#FEF3C7",
                  border: isMatch ? "none" : "1px solid #FDE68A",
                }}>
                  {isMatch ? "Best match" : "Suggested"}
                </Box>
              )}
            </ButtonBase>
          );
        })}
      </Box>

      {/* Footer */}
      <Box sx={{ px: { xs: 2.5, sm: 3.5 }, py: 1.5, borderTop: "1px solid #F1F5F9", backgroundColor: "#FBFCFE",
                 display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexShrink: 0,
                 flexWrap: "wrap" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", color: "#64748B", fontSize: "0.74rem" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
            </svg>
            <span>CSV, XLS or XLSX · up to 10 MB · one row per item · Company Info uses a form</span>
          </Box>
          <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 0.5 }}>
            {["↑", "↓", "↵"].map((k) => (
              <Box key={k} component="kbd" sx={{ fontFamily: "inherit", fontSize: "0.68rem", fontWeight: 700, color: "#475569",
                                               border: "1px solid #E2E8F0", borderBottomWidth: 2, borderRadius: "5px",
                                               px: 0.6, lineHeight: 1.5, backgroundColor: "#FFFFFF" }}>{k}</Box>
            ))}
            <span>to choose</span>
          </Box>
        </Box>
        <ButtonBase onClick={() => window.open("/docs", "_blank")}
                    sx={{ fontSize: "0.78rem", fontWeight: 700, color: "#2563EB", borderRadius: "8px", px: 1, py: 0.5,
                          gap: 0.5, "&:hover": { backgroundColor: "#EFF6FF" } }}>
          Examples & guide
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17 17 7M8 7h9v9" />
          </svg>
        </ButtonBase>
      </Box>
    </Box>
  );
}
