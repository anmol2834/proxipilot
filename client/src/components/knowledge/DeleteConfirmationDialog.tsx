"use client";

import React from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { useKnowledgeStore } from "@/stores/knowledge.store";

export function DeleteConfirmationDialog() {
  const { deletingItem, closeDeleteDialog, deleteItem } = useKnowledgeStore();

  if (!deletingItem) return null;

  const handleDelete = () => {
    deleteItem(deletingItem.id);
  };

  return (
    <Dialog
      open={Boolean(deletingItem)}
      onClose={closeDeleteDialog}
      disableScrollLock
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: "16px",
            p: 1,
            boxShadow: "0 20px 50px rgba(15, 23, 42, 0.16)",
          },
        },
      }}
    >
      <DialogTitle sx={{ pb: 1, display: "flex", alignItems: "center", gap: 1.5 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: "10px",
            backgroundColor: "#FEF2F2",
            color: "#EF4444",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </Box>
        <Typography sx={{ fontWeight: 800, fontSize: "1.1rem", color: "#0F172A" }}>
          Delete this knowledge?
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <Typography sx={{ fontSize: "0.85rem", color: "#475569", lineHeight: 1.5, mb: 1.5 }}>
          Are you sure you want to permanently delete{" "}
          <Box component="span" sx={{ fontWeight: 700, color: "#0F172A" }}>
            &ldquo;{deletingItem.title}&rdquo;
          </Box>
          ?
        </Typography>
        <Typography sx={{ fontSize: "0.78rem", color: "#EA580C", backgroundColor: "#FFFBEB", p: 1.25, borderRadius: "8px", border: "1px solid #FEF3C7" }}>
          ⚠️ This information may be actively used by ProxiPilot when generating email responses and AI triage decisions.
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1 }}>
        <Button
          onClick={closeDeleteDialog}
          variant="outlined"
          sx={{
            textTransform: "none",
            borderColor: "#E2E8F0",
            color: "#475569",
            borderRadius: "9px",
            fontWeight: 600,
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleDelete}
          variant="contained"
          sx={{
            textTransform: "none",
            backgroundColor: "#EF4444",
            color: "#FFFFFF",
            borderRadius: "9px",
            fontWeight: 700,
            px: 2.5,
            "&:hover": { backgroundColor: "#DC2626" },
          }}
        >
          Delete Item
        </Button>
      </DialogActions>
    </Dialog>
  );
}
