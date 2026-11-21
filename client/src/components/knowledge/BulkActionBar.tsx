"use client";

/**
 * Bulk actions for selected knowledge rows. Knowledge is managed by importing files (re-importing
 * updates rows in place by their identity), so the only bulk action is a permanent delete — with
 * an explicit confirmation step, because it cannot be undone.
 */

import React, { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import { useKnowledgeStore } from "@/stores/knowledge.store";

const pill = {
  textTransform: "none",
  fontSize: "0.78rem",
  fontWeight: 700,
  px: 1.5,
  py: 0.5,
  borderRadius: "9999px",
  whiteSpace: "nowrap",
} as const;

export function BulkActionBar() {
  const { selectedIds, clearSelection, bulkDeleteItems } = useKnowledgeStore();
  const [confirming, setConfirming] = useState(false);
  const count = selectedIds.length;

  // A changed selection must be confirmed again.
  useEffect(() => setConfirming(false), [count]);

  if (count === 0) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        bottom: 32,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 50,
        maxWidth: 520,
        width: "90%",
      }}
    >
      <Paper
        elevation={6}
        role="toolbar"
        aria-label="Selected knowledge items"
        sx={{
          py: 1.25,
          px: 2.25,
          borderRadius: "9999px",
          backgroundColor: "#0F172A",
          color: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          boxShadow: "0 12px 35px rgba(15, 23, 42, 0.35)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
          <Box sx={{ px: 1.25, py: 0.25, borderRadius: "9999px", backgroundColor: confirming ? "#DC2626" : "#2563EB",
                     fontSize: "0.75rem", fontWeight: 700 }}>
            {count}
          </Box>
          <Typography noWrap sx={{ fontSize: "0.82rem", fontWeight: 600, color: "#F8FAFC" }}>
            {confirming ? `Delete ${count === 1 ? "this item" : "these items"} permanently?` : "selected"}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {confirming ? (
            <>
              <Button size="small" onClick={() => setConfirming(false)}
                      sx={{ ...pill, color: "#CBD5E1", "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.12)" } }}>
                Cancel
              </Button>
              <Button size="small" onClick={() => { setConfirming(false); void bulkDeleteItems(selectedIds); }}
                      sx={{ ...pill, color: "#FFFFFF", backgroundColor: "#DC2626", "&:hover": { backgroundColor: "#B91C1C" } }}>
                Delete {count}
              </Button>
            </>
          ) : (
            <Button size="small" onClick={() => setConfirming(true)}
                    sx={{ ...pill, color: "#F87171", "&:hover": { backgroundColor: "rgba(239, 68, 68, 0.2)" } }}>
              Delete
            </Button>
          )}
        </Box>

        <IconButton
          size="small"
          onClick={clearSelection}
          aria-label="Clear selection"
          sx={{
            color: "#94A3B8",
            p: 0.5,
            "&:hover": { color: "#FFFFFF", backgroundColor: "rgba(255, 255, 255, 0.1)" },
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </IconButton>
      </Paper>
    </Box>
  );
}
