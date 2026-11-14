"use client";

import React from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import { ConnectedIntegrationAccount } from "@/types/integrations.types";

interface DisconnectConfirmDialogProps {
  open: boolean;
  account: ConnectedIntegrationAccount | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DisconnectConfirmDialog({
  open,
  account,
  onClose,
  onConfirm,
}: DisconnectConfirmDialogProps) {
  if (!account) return null;

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
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </Box>
          <Typography sx={{ fontSize: "17px", fontWeight: 700, color: "#0F172A" }}>
            Disconnect this Gmail account?
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ px: 2.5, py: 1.5 }}>
        <Typography sx={{ fontSize: "14px", color: "#475569", mb: 1.5, lineHeight: 1.5 }}>
          ProxiPilot will stop syncing emails from:
        </Typography>

        <Box
          sx={{
            p: 1.5,
            borderRadius: "10px",
            bgcolor: "#F8FAFC",
            border: "1px solid #E2E8F0",
            mb: 1.5,
          }}
        >
          <Typography sx={{ fontSize: "14px", fontWeight: 600, color: "#0F172A" }}>
            {account.emailAddress}
          </Typography>
          <Typography sx={{ fontSize: "12px", color: "#64748B" }}>
            Provider ID: {account.providerAccountId}
          </Typography>
        </Box>

        <Typography sx={{ fontSize: "13px", color: "#64748B", lineHeight: 1.5 }}>
          Existing organization data and past synced conversations will not be deleted automatically.
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
            px: 2.25,
            py: 0.75,
            boxShadow: "0 1px 3px rgba(239, 68, 68, 0.3)",
            "&:hover": {
              bgcolor: "#DC2626",
            },
          }}
        >
          Disconnect
        </Button>
      </DialogActions>
    </Dialog>
  );
}
