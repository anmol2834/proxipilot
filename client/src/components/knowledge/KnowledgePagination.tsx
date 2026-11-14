"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ButtonBase from "@mui/material/ButtonBase";
import IconButton from "@mui/material/IconButton";
import { useKnowledgeStore } from "@/stores/knowledge.store";

interface KnowledgePaginationProps {
  totalItems: number;
}

export function KnowledgePagination({ totalItems }: KnowledgePaginationProps) {
  const { currentPage, pageSize, setCurrentPage, isFetching } = useKnowledgeStore();

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers array (with ellipsis if large)
  const getPageNumbers = () => {
    if (totalPages <= 6) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 3) {
      return [1, 2, 3, "...", totalPages];
    }
    if (currentPage >= totalPages - 2) {
      return [1, "...", totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, "...", currentPage, "...", totalPages];
  };

  if (totalItems === 0) return null;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 2,
        mt: 3,
        pt: 1,
      }}
    >
      {/* Left: Showing Range */}
      <Typography sx={{ fontSize: "0.82rem", color: "#64748B" }}>
        Showing{" "}
        <Box component="span" sx={{ fontWeight: 600, color: "#0F172A" }}>
          {startItem}–{endItem}
        </Box>{" "}
        of{" "}
        <Box component="span" sx={{ fontWeight: 600, color: "#0F172A" }}>
          {totalItems}
        </Box>{" "}
        items
      </Typography>

      {/* Right: Page Navigation Buttons */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        {/* Previous Page Chevron */}
        <IconButton
          size="small"
          disabled={isFetching || currentPage === 1}
          onClick={() => setCurrentPage(currentPage - 1)}
          aria-label="Previous page"
          sx={{
            width: 32,
            height: 32,
            borderRadius: "8px",
            border: "1px solid #E2E8F0",
            color: "#64748B",
            backgroundColor: "#FFFFFF",
            "&:disabled": { opacity: 0.4, borderColor: "#E2E8F0" },
            "&:hover": { backgroundColor: "#F8FAFC" },
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </IconButton>

        {/* Page Numbers */}
        {getPageNumbers().map((p, idx) => {
          if (p === "...") {
            return (
              <Typography
                key={`ellipsis-${idx}`}
                sx={{ px: 0.75, fontSize: "0.82rem", color: "#94A3B8" }}
              >
                …
              </Typography>
            );
          }

          const pageNum = p as number;
          const isActive = currentPage === pageNum;

          return (
            <ButtonBase
              key={pageNum}
              disabled={isFetching}
              onClick={() => setCurrentPage(pageNum)}
              sx={{
                width: 32,
                height: 32,
                borderRadius: "8px",
                fontSize: "0.82rem",
                fontWeight: isActive ? 700 : 500,
                color: isActive ? "#2563EB" : "#475569",
                backgroundColor: isActive ? "#EFF6FF" : "#FFFFFF",
                border: isActive ? "1px solid #DBEAFE" : "1px solid #E2E8F0",
                opacity: isFetching && !isActive ? 0.6 : 1,
                transition: "all 150ms ease",
                "&:hover": {
                  backgroundColor: isActive ? "#EFF6FF" : "#F8FAFC",
                  borderColor: isActive ? "#DBEAFE" : "#CBD5E1",
                },
              }}
            >
              {pageNum}
            </ButtonBase>
          );
        })}

        {/* Next Page Chevron */}
        <IconButton
          size="small"
          disabled={isFetching || currentPage === totalPages}
          onClick={() => setCurrentPage(currentPage + 1)}
          aria-label="Next page"
          sx={{
            width: 32,
            height: 32,
            borderRadius: "8px",
            border: "1px solid #E2E8F0",
            color: "#64748B",
            backgroundColor: "#FFFFFF",
            "&:disabled": { opacity: 0.4, borderColor: "#E2E8F0" },
            "&:hover": { backgroundColor: "#F8FAFC" },
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </IconButton>
      </Box>
    </Box>
  );
}
