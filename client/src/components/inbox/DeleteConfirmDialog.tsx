"use client";

import React from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";

interface DeleteConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmDialog({
  open,
  onClose,
  onConfirm,
}: DeleteConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      disableScrollLock
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: "16px",
            p: 1,
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
          },
        },
      }}
    >
      <DialogTitle sx={{ pb: 1, pt: 2, px: 2.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: "10px",
              bgcolor: "#FEF2F2",
              color: "#EF4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </Box>
          <Typography sx={{ fontSize: "17px", fontWeight: 700, color: "#0F172A" }}>
            Delete conversation?
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ px: 2.5, py: 1.5 }}>
        <Typography sx={{ fontSize: "13.5px", color: "#64748B", lineHeight: 1.5 }}>
          Are you sure you want to delete this conversation? This will remove it from your active inbox and conversation history.
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, pb: 2, pt: 1, gap: 1 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          sx={{
            textTransform: "none",
            borderRadius: "9px",
            borderColor: "#E2E8F0",
            color: "#334155",
            fontSize: "13.5px",
            fontWeight: 500,
            px: 2,
            py: 0.75,
            "&:hover": {
              borderColor: "#CBD5E1",
              bgcolor: "#F8FAFC",
            },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          sx={{
            textTransform: "none",
            borderRadius: "9px",
            bgcolor: "#EF4444",
            color: "#FFFFFF",
            fontSize: "13.5px",
            fontWeight: 600,
            px: 2.5,
            py: 0.75,
            boxShadow: "0 1px 3px rgba(239, 68, 68, 0.3)",
            "&:hover": {
              bgcolor: "#DC2626",
            },
          }}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}
