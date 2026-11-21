"use client";

import React, { useMemo, useEffect, useRef, Suspense } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { useSearchParams } from "next/navigation";
import { useKnowledgeStore } from "@/stores/knowledge.store";
import { DEFAULT_KNOWLEDGE_CATEGORY, isKnowledgeCategory, KnowledgeCategory } from "@/types/knowledge.types";
import {
  KnowledgeHeader,
  CategoryCardsGrid,
  KnowledgeToolbar,
  KnowledgeTable,
  KnowledgePagination,
  AddKnowledgeDialog,
  DeleteConfirmationDialog,
  BulkActionBar,
} from "@/components/knowledge";
import { CompanyInfoEditor } from "@/components/knowledge/CompanyInfoEditor";

// ---------------------------------------------------------------------------
// Skeleton loader for the table while fetching
// ---------------------------------------------------------------------------
function TableSkeleton() {
  return (
    <Box
      sx={{
        mt: 2,
        backgroundColor: "#FFFFFF",
        borderRadius: "14px",
        border: "1px solid #EEF2F6",
        boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
        overflow: "hidden",
      }}
    >
      {/* Table header skeleton */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          px: 2.5,
          py: 1.5,
          backgroundColor: "#F8FAFC",
          borderBottom: "1px solid #E2E8F0",
        }}
      >
        <Skeleton variant="rectangular" width={18} height={18} sx={{ borderRadius: "4px", flexShrink: 0 }} />
        <Skeleton width={80} height={16} sx={{ ml: 1 }} />
        <Box sx={{ flex: 1 }} />
        <Skeleton width={90} height={16} sx={{ flexShrink: 0 }} />
        <Skeleton width={60} height={16} sx={{ flexShrink: 0, mx: 1 }} />
        <Skeleton width={75} height={16} sx={{ flexShrink: 0 }} />
        <Skeleton width={70} height={16} sx={{ flexShrink: 0, mx: 1 }} />
        <Skeleton width={50} height={16} sx={{ flexShrink: 0 }} />
      </Box>

      {/* Row skeletons */}
      {[...Array(10)].map((_, i) => (
        <Box
          key={i}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            px: 2.5,
            py: 1.75,
            borderBottom: i < 9 ? "1px solid #F1F5F9" : "none",
          }}
        >
          <Skeleton variant="rectangular" width={18} height={18} sx={{ borderRadius: "4px", flexShrink: 0 }} />
          <Skeleton variant="circular" width={32} height={32} sx={{ flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 180 }}>
            <Skeleton width="45%" height={18} />
            <Skeleton width="70%" height={14} sx={{ mt: 0.5 }} />
          </Box>
          <Skeleton width={110} height={24} sx={{ borderRadius: "9999px", flexShrink: 0 }} />
          <Skeleton width={70} height={18} sx={{ flexShrink: 0, mx: 1 }} />
          <Box sx={{ width: 85, flexShrink: 0 }}>
            <Skeleton width={75} height={15} />
            <Skeleton width={50} height={12} sx={{ mt: 0.5 }} />
          </Box>
          <Skeleton width={88} height={24} sx={{ borderRadius: "9999px", flexShrink: 0 }} />
          <Skeleton width={55} height={18} sx={{ flexShrink: 0 }} />
        </Box>
      ))}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Empty state when no items exist after loading
// ---------------------------------------------------------------------------
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        py: 10,
        px: 4,
        textAlign: "center",
      }}
    >
      {/* Illustration */}
      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: "24px",
          background: "linear-gradient(135deg, #EFF6FF 0%, #EEF2FF 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          mb: 3,
          boxShadow: "0 8px 24px rgba(37,99,235,0.08)",
        }}
      >
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
      </Box>

      <Typography sx={{ fontSize: "1.15rem", fontWeight: 800, color: "#0F172A", mb: 1 }}>
        No knowledge items yet
      </Typography>
      <Typography sx={{ fontSize: "0.88rem", color: "#64748B", mb: 3, maxWidth: 380, lineHeight: 1.6 }}>
        Upload your business data — products, services, policies, FAQs — and ProxiPilot will use it to give smarter, more accurate responses.
      </Typography>
      <Button
        variant="contained"
        onClick={onAdd}
        sx={{
          textTransform: "none",
          fontWeight: 700,
          fontSize: "0.88rem",
          backgroundColor: "#2563EB",
          borderRadius: "10px",
          px: 3,
          py: 1.1,
          boxShadow: "0 4px 12px rgba(37,99,235,0.25)",
          "&:hover": { backgroundColor: "#1D4ED8" },
        }}
        startIcon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        }
      >
        Add your first knowledge item
      </Button>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Error banner
// ---------------------------------------------------------------------------
function FetchErrorBanner({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <Box
      sx={{
        mx: 2,
        my: 2,
        p: 2,
        borderRadius: "12px",
        backgroundColor: "#FEF2F2",
        border: "1px solid #FECACA",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 2,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <Typography sx={{ fontSize: "0.84rem", color: "#991B1B", fontWeight: 600 }}>
          {error}
        </Typography>
      </Box>
      <Button
        size="small"
        onClick={onRetry}
        sx={{
          textTransform: "none",
          fontSize: "0.78rem",
          fontWeight: 700,
          color: "#DC2626",
          border: "1px solid #FCA5A5",
          borderRadius: "7px",
          px: 1.5,
          py: 0.5,
          flexShrink: 0,
          "&:hover": { backgroundColor: "#FEE2E2" },
        }}
      >
        Retry
      </Button>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Main Knowledge Content
// ---------------------------------------------------------------------------
function KnowledgeContent() {
  const searchParams = useSearchParams();
  const {
    items,
    isLoading,
    isFetching,
    fetchError,
    upload,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    fetchItems,
    fetchCategoryCounts,
    openAddDialog,
    totalCount,
    selectedCategory,
  } = useKnowledgeStore();
  const isCompanyInfo = selectedCategory === "company-info";

  const isTableLoading =
    isLoading ||
    isFetching ||
    upload.phase === "uploading" ||
    upload.phase === "processing" ||
    upload.phase === "done";

  // The URL decides the category: ?category=<one of the 6>, otherwise Products & Services. An old
  // link to a removed category (e.g. ?category=operations) also opens Products & Services.
  const urlCategoryParam = searchParams?.get("category") ?? null;
  const categoryFromUrl = (param: string | null): KnowledgeCategory =>
    isKnowledgeCategory(param) ? param : DEFAULT_KNOWLEDGE_CATEGORY;
  const lastUrlCategory = useRef<string | null | undefined>(undefined);

  // ── First load: ONE request, already scoped to the right category ─────────
  useEffect(() => {
    lastUrlCategory.current = urlCategoryParam;
    const initial = categoryFromUrl(urlCategoryParam);
    if (initial !== useKnowledgeStore.getState().selectedCategory) {
      setSelectedCategory(initial); // fetches
    } else {
      fetchItems(true, 1);
    }
    fetchCategoryCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Later URL changes (links, back/forward) ───────────────────────────────
  // Reacts only when the URL's category itself changes; card clicks update the store directly.
  useEffect(() => {
    if (lastUrlCategory.current === urlCategoryParam) return;
    lastUrlCategory.current = urlCategoryParam;
    const next = categoryFromUrl(urlCategoryParam);
    if (next !== useKnowledgeStore.getState().selectedCategory) {
      setSelectedCategory(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCategoryParam]);

  useEffect(() => {
    const urlSearch = searchParams?.get("search");
    if (urlSearch && urlSearch !== searchQuery) {
      setSearchQuery(urlSearch);
    }
  }, [searchParams, searchQuery, setSearchQuery]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", pb: 5 }}>
      {/* 1. Header */}
      <KnowledgeHeader />

      {/* 2. Category Cards */}
      <CategoryCardsGrid />

      {/* 3. Company Info is one structured editor (no file import); older rows, if any, follow it */}
      {isCompanyInfo && (
        <Box id="company-info-editor" sx={{ mt: 2.5, scrollMarginTop: "80px" }}>
          <CompanyInfoEditor />
        </Box>
      )}

      {/* 4. Toolbar */}
      {(!isCompanyInfo || items.length > 0 || isTableLoading) && <KnowledgeToolbar />}

      {/* 5. Error Banner */}
      {fetchError && !isTableLoading && (
        <FetchErrorBanner error={fetchError} onRetry={() => fetchItems(true, 1)} />
      )}

      {/* 6. Content: Loading skeleton / Empty state / Table */}
      {isCompanyInfo && !isTableLoading && items.length === 0 ? null : isTableLoading ? (
        <>
          <TableSkeleton />
          <KnowledgePagination totalItems={totalCount} />
        </>
      ) : !fetchError && items.length === 0 ? (
        <EmptyState onAdd={() => openAddDialog()} />
      ) : (
        <>
          <KnowledgeTable currentPageItems={items} />
          <KnowledgePagination totalItems={totalCount} />
        </>
      )}

      {/* 6. Modals & Floating Bars */}
      <AddKnowledgeDialog />
      <DeleteConfirmationDialog />
      <BulkActionBar />
    </Box>
  );
}

export default function KnowledgePage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
          <CircularProgress size={32} sx={{ color: "#2563EB" }} />
        </Box>
      }
    >
      <KnowledgeContent />
    </Suspense>
  );
}
