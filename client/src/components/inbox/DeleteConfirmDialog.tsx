"use client";

import React from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";

interface DeleteConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  conversationSubject?: string;
  conversationSender?: string;
  isPending?: boolean;
  error?: string | null;
}

export function DeleteConfirmDialog({
  open,
  onClose,
  onConfirm,
  conversationSubject,
  conversationSender,
  isPending = false,
  error = null,
}: DeleteConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={isPending ? undefined : onClose}
      disableScrollLock
      maxWidth="sm"
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
            Permanently delete conversation?
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ px: 2.5, py: 1.5 }}>
        {(conversationSubject || conversationSender) && (
          <Box
            sx={{
              p: 1.5,
              mb: 2,
              borderRadius: "8px",
              bgcolor: "#F8FAFC",
              border: "1px solid #E2E8F0",
            }}
          >
            {conversationSubject && (
              <Typography
                sx={{
                  fontSize: "13.5px",
                  fontWeight: 600,
                  color: "#1E293B",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {conversationSubject}
              </Typography>
            )}
            {conversationSender && (
              <Typography
                sx={{
                  fontSize: "12px",
                  color: "#64748B",
                  mt: 0.25,
                }}
              >
                From: {conversationSender}
              </Typography>
            )}
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: "8px", fontSize: "13px" }}>
            {error} — You can try deleting again, or cancel without losing your draft or selection.
          </Alert>
        )}

        <Typography sx={{ fontSize: "13.5px", color: "#475569", lineHeight: 1.6, mb: 1.5 }}>
          This will permanently remove this conversation and all associated data owned by it inside ProxiPilot (AI summaries, drafts, thread memory, commitments, and feedback).
        </Typography>

        <Typography sx={{ fontSize: "13px", color: "#64748B", lineHeight: 1.5, mb: 1 }}>
          <strong>Note:</strong> Your original mailbox in Gmail or Outlook remains completely untouched.
        </Typography>

        <Typography sx={{ fontSize: "13px", color: "#DC2626", fontWeight: 600 }}>
          This action cannot be undone.
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, pb: 2, pt: 1, gap: 1 }}>
        <Button
          onClick={onClose}
          disabled={isPending}
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
          disabled={isPending}
          variant="contained"
          startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
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
            "&.Mui-disabled": {
              bgcolor: "#FCA5A5",
              color: "#FFFFFF",
            },
          }}
        >
          {isPending ? "Deleting..." : "Permanently Delete"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
