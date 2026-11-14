"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import { useKnowledgeStore } from "@/stores/knowledge.store";

export function BulkActionBar() {
  const { selectedIds, clearSelection, bulkUpdateStatus, bulkDeleteItems } =
    useKnowledgeStore();

  if (selectedIds.length === 0) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        bottom: 32,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 50,
        maxWidth: 500,
        width: "90%",
      }}
    >
      <Paper
        elevation={6}
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
        {/* Left: Count Badge */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              px: 1.25,
              py: 0.25,
              borderRadius: "9999px",
              backgroundColor: "#2563EB",
              fontSize: "0.75rem",
              fontWeight: 700,
            }}
          >
            {selectedIds.length}
          </Box>
          <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: "#F8FAFC" }}>
            selected
          </Typography>
        </Box>

        {/* Middle Actions: Publish, Archive, Delete */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Button
            size="small"
            onClick={() => bulkUpdateStatus(selectedIds, "Published")}
            sx={{
              textTransform: "none",
              color: "#FFFFFF",
              fontSize: "0.78rem",
              fontWeight: 600,
              px: 1.5,
              py: 0.5,
              borderRadius: "9999px",
              "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.12)" },
            }}
          >
            Publish
          </Button>

          <Button
            size="small"
            onClick={() => bulkUpdateStatus(selectedIds, "Archived")}
            sx={{
              textTransform: "none",
              color: "#94A3B8",
              fontSize: "0.78rem",
              fontWeight: 600,
              px: 1.5,
              py: 0.5,
              borderRadius: "9999px",
              "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.12)", color: "#FFFFFF" },
            }}
          >
            Archive
          </Button>

          <Button
            size="small"
            onClick={() => bulkDeleteItems(selectedIds)}
            sx={{
              textTransform: "none",
              color: "#F87171",
              fontSize: "0.78rem",
              fontWeight: 600,
              px: 1.5,
              py: 0.5,
              borderRadius: "9999px",
              "&:hover": { backgroundColor: "rgba(239, 68, 68, 0.2)" },
            }}
          >
            Delete
          </Button>
        </Box>

        {/* Right: Clear Selection */}
        <IconButton
          size="small"
          onClick={clearSelection}
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
