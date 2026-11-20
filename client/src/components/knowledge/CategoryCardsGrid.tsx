"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import { useKnowledgeStore } from "@/stores/knowledge.store";
import type { KnowledgeCategory } from "@/types/knowledge.types";
import { useRouter, useSearchParams } from "next/navigation";

interface CategoryDefinition {
  id: KnowledgeCategory;
  name: string;
  subtitle: string;
  iconBg: string;
  iconColor: string;
  renderIcon: () => React.ReactNode;
}

const CATEGORIES: CategoryDefinition[] = [
  {
    id: "products-services",
    name: "Products & Services",
    subtitle: "What you offer",
    iconBg: "#EFF6FF",
    iconColor: "#2563EB",
    renderIcon: () => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
      </svg>
    ),
  },
  {
    id: "company-info",
    name: "Company Info",
    subtitle: "About your organization",
    iconBg: "#EFF6FF",
    iconColor: "#2563EB",
    renderIcon: () => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
        <path d="M9 22v-4h6v4" />
        <path d="M8 6h.01" />
        <path d="M16 6h.01" />
        <path d="M8 10h.01" />
        <path d="M16 10h.01" />
        <path d="M8 14h.01" />
        <path d="M16 14h.01" />
      </svg>
    ),
  },
  {
    id: "policies",
    name: "Policies",
    subtitle: "Refund, cancellation, etc.",
    iconBg: "#F0FDFA",
    iconColor: "#0D9488",
    renderIcon: () => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    id: "support-faqs",
    name: "Support & FAQs",
    subtitle: "Common questions",
    iconBg: "#EFF6FF",
    iconColor: "#2563EB",
    renderIcon: () => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    id: "offers-promotions",
    name: "Offers & Promotions",
    subtitle: "Current campaigns",
    iconBg: "#FFFBEB",
    iconColor: "#D97706",
    renderIcon: () => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 12 20 22 4 22 4 12" />
        <rect width="20" height="5" x="2" y="7" />
        <line x1="12" y1="22" x2="12" y2="7" />
        <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
        <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
      </svg>
    ),
  },
  {
    id: "processes-timelines",
    name: "Processes & Timelines",
    subtitle: "Steps and how long they take",
    iconBg: "#ECFDF5",
    iconColor: "#059669",
    renderIcon: () => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 2.5" />
        <path d="M9 2h6" />
        <path d="M12 2v3" />
      </svg>
    ),
  },
];

export function CategoryCardsGrid() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedCategory, setSelectedCategory, categoryCounts, categoryCountsLoaded } =
    useKnowledgeStore();

  // Exactly one category is always selected (Products & Services by default); a card click
  // switches to it. Clicking the selected card again does nothing.
  const handleCardClick = (catId: KnowledgeCategory) => {
    if (catId === selectedCategory) return;
    setSelectedCategory(catId);
    const params = new URLSearchParams(searchParams?.toString());
    params.set("category", catId);
    router.replace(`/dashboard/knowledge?${params.toString()}`);
  };

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, 1fr)",
          md: "repeat(3, 1fr)", // 3 per row from tablet up: 2 rows of 3
        },
        gap: 2,
        mb: 4,
      }}
    >
      {CATEGORIES.map((cat) => {
        const isActive = selectedCategory === cat.id;
        // Only real server counts are shown. The stats API omits categories with no
        // rows, so a missing key means 0 — never a placeholder number.
        const displayCount = categoryCountsLoaded
          ? (categoryCounts[cat.id] ?? 0).toLocaleString()
          : "…";

        return (
          <Paper
            key={cat.id}
            elevation={0}
            onClick={() => handleCardClick(cat.id)}
            role="button"
            aria-pressed={isActive}
            title={isActive ? `Showing ${cat.name}` : `Show ${cat.name}`}
            sx={{
              p: 2,
              borderRadius: "14px",
              backgroundColor: isActive ? "#F8FAFF" : "#FFFFFF",
              border: isActive ? "1.5px solid #2563EB" : "1px solid #EEF2F6",
              boxShadow: isActive
                ? "0 2px 10px rgba(37, 99, 235, 0.08)"
                : "none",
              cursor: "pointer",
              transition: "all 180ms ease",
              display: "flex",
              alignItems: "flex-start",
              gap: 1.5,
              "&:hover": {
                borderColor: isActive ? "#2563EB" : "#CBD5E1",
                backgroundColor: isActive ? "#F8FAFF" : "#FAFAFA",
                transform: "translateY(-1px)",
              },
            }}
          >
            {/* Category Icon */}
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: "10px",
                backgroundColor: cat.iconBg,
                color: cat.iconColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {cat.renderIcon()}
            </Box>

            {/* Category Text & Count */}
            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: "#0F172A",
                  lineHeight: 1.2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {cat.name}
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.74rem",
                  color: "#64748B",
                  mt: 0.25,
                  fontWeight: 500,
                }}
              >
                {displayCount} items
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.68rem",
                  color: "#94A3B8",
                  mt: 0.25,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {cat.subtitle}
              </Typography>
            </Box>
          </Paper>
        );
      })}
    </Box>
  );
}
