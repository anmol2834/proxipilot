"use client";

import React from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import { ConnectedIntegrationAccount } from "@/types/integrations.types";
import { GmailLogo } from "./ProviderIcons";

interface GmailAccountDetailModalProps {
  open: boolean;
  account: ConnectedIntegrationAccount | null;
  onClose: () => void;
  onDisconnect: (account: ConnectedIntegrationAccount) => void;
  onSyncNow: (id: string) => void;
  onReconnect: (id: string) => void;
}

export function GmailAccountDetailModal({
  open,
  account,
  onClose,
  onDisconnect,
  onSyncNow,
  onReconnect,
}: GmailAccountDetailModalProps) {
  if (!account) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      disableScrollLock
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: "16px",
            p: 1,
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15)",
          },
        },
      }}
    >
      <DialogTitle sx={{ pb: 1, pt: 2, px: 2.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: "12px",
                bgcolor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              <GmailLogo size={26} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: "17.5px", fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }}>
                Gmail Account Settings
              </Typography>
              <Typography sx={{ fontSize: "13px", color: "#64748B" }}>
                {account.emailAddress}
              </Typography>
            </Box>
          </Box>

          <Chip
            size="small"
            label={
              account.status === "healthy"
                ? "Healthy"
                : account.status === "needs_attention" || account.needsReconnect || account.watchExpired
                ? "Needs attention"
                : account.status
            }
            sx={{
              bgcolor:
                account.status === "healthy"
                  ? "#ECFDF5"
                  : account.status === "needs_attention" || account.needsReconnect || account.watchExpired
                  ? "#FEF3C7"
                  : "#EFF6FF",
              color:
                account.status === "healthy"
                  ? "#059669"
                  : account.status === "needs_attention" || account.needsReconnect || account.watchExpired
                  ? "#B45309"
                  : "#2563EB",
              border: "1px solid",
              borderColor:
                account.status === "healthy"
                  ? "#A7F3D0"
                  : account.status === "needs_attention" || account.needsReconnect || account.watchExpired
                  ? "#FDE68A"
                  : "#BFDBFE",
              fontWeight: 600,
              fontSize: "12px",
            }}
          />
        </Box>
      </DialogTitle>

      <DialogContent sx={{ px: 2.5, py: 2, display: "flex", flexDirection: "column", gap: 2.5 }}>
        {/* Warning banner if watch expired or re-authorization required */}
        {(account.status === "needs_attention" || account.needsReconnect || account.watchExpired) && (
          <Box
            sx={{
              p: 2,
              borderRadius: "12px",
              bgcolor: "#FFFBEB",
              border: "1px solid #FDE68A",
              display: "flex",
              alignItems: "flex-start",
              gap: 1.5,
            }}
          >
            <Box sx={{ color: "#D97706", display: "flex", alignItems: "center", mt: 0.25, flexShrink: 0 }}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: "14px", fontWeight: 700, color: "#92400E" }}>
                Action Required: 7-Day Gmail Sync Watch Expired
              </Typography>
              <Typography sx={{ fontSize: "12.5px", color: "#B45309", mt: 0.5, lineHeight: 1.45 }}>
                {account.reconnectReason ||
                  "Google Cloud Pub/Sub push notification watches expire every 7 days. Incoming message notifications and background sync are currently paused until you reconnect."}
              </Typography>
              <Button
                onClick={() => onReconnect(account.id)}
                variant="contained"
                size="small"
                sx={{
                  mt: 1.5,
                  bgcolor: "#D97706",
                  color: "#FFFFFF",
                  textTransform: "none",
                  fontWeight: 600,
                  fontSize: "13px",
                  borderRadius: "8px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.75,
                  boxShadow: "0 1px 2px rgba(217, 119, 6, 0.2)",
                  "&:hover": { bgcolor: "#B45309" },
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                Reconnect Gmail Account
              </Button>
            </Box>
          </Box>
        )}

        {/* Account Metadata Box */}
        <Box
          sx={{
            p: 2,
            borderRadius: "12px",
            bgcolor: "#F8FAFC",
            border: "1px solid #E2E8F0",
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
            gap: 1.75,
          }}
        >
          <Box>
            <Typography sx={{ fontSize: "12px", color: "#64748B", mb: 0.25 }}>Display Name</Typography>
            <Typography sx={{ fontSize: "13.5px", fontWeight: 600, color: "#0F172A" }}>
              {account.displayName || "Default"}
            </Typography>
          </Box>

          <Box>
            <Typography sx={{ fontSize: "12px", color: "#64748B", mb: 0.25 }}>Connected By</Typography>
            <Typography sx={{ fontSize: "13.5px", fontWeight: 600, color: "#0F172A" }}>
              {account.connectedByUserName}
            </Typography>
          </Box>

          <Box>
            <Typography sx={{ fontSize: "12px", color: "#64748B", mb: 0.25 }}>Last Sync</Typography>
            <Typography sx={{ fontSize: "13.5px", fontWeight: 600, color: "#0F172A" }}>
              {account.lastSyncedAt}
            </Typography>
          </Box>

          <Box>
            <Typography sx={{ fontSize: "12px", color: "#64748B", mb: 0.25 }}>Synced Conversations</Typography>
            <Typography sx={{ fontSize: "13.5px", fontWeight: 600, color: "#0F172A" }}>
              {account.totalSyncedEmails ?? 128} messages
            </Typography>
          </Box>
        </Box>

        {/* Granted Permissions List */}
        <Box>
          <Typography sx={{ fontSize: "13px", fontWeight: 700, color: "#334155", mb: 1 }}>
            Authorized Scopes
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {account.scopes.map((scope, idx) => (
              <Box
                key={idx}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  fontSize: "12px",
                  color: "#475569",
                  bgcolor: "#F1F5F9",
                  px: 1.5,
                  py: 0.75,
                  borderRadius: "8px",
                  fontFamily: "monospace",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {scope}
              </Box>
            ))}
          </Box>
        </Box>

        {/* Sync Controls */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            p: 1.75,
            borderRadius: "12px",
            border: "1px solid #E2E8F0",
            bgcolor: "#FFFFFF",
          }}
        >
          <Box>
            <Typography sx={{ fontSize: "13.5px", fontWeight: 600, color: "#0F172A" }}>
              Force Mailbox Sync
            </Typography>
            <Typography sx={{ fontSize: "12px", color: "#64748B" }}>
              {account.status === "needs_attention" || account.needsReconnect || account.watchExpired
                ? "Re-authorization required before mailbox synchronization can proceed."
                : "Pulls incoming messages and refreshes AI indexing immediately."}
            </Typography>
          </Box>
          <Button
            onClick={() => {
              if (account.status === "needs_attention" || account.needsReconnect || account.watchExpired) {
                onReconnect(account.id);
              } else {
                onSyncNow(account.id);
              }
            }}
            disabled={account.status === "syncing"}
            size="small"
            variant={
              account.status === "needs_attention" || account.needsReconnect || account.watchExpired
                ? "contained"
                : "outlined"
            }
            sx={{
              textTransform: "none",
              borderRadius: "8px",
              borderColor: "#CBD5E1",
              fontSize: "13px",
              fontWeight: 500,
              ...(account.status === "needs_attention" || account.needsReconnect || account.watchExpired
                ? {
                    bgcolor: "#D97706",
                    color: "#FFFFFF",
                    "&:hover": { bgcolor: "#B45309" },
                  }
                : {
                    color: "#334155",
                  }),
            }}
          >
            {account.status === "syncing"
              ? "Syncing..."
              : account.status === "needs_attention" || account.needsReconnect || account.watchExpired
              ? "Reconnect to sync"
              : "Sync now"}
          </Button>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, pb: 2, pt: 1, justifyContent: "space-between" }}>
        <Button
          onClick={() => onDisconnect(account)}
          sx={{
            textTransform: "none",
            color: "#EF4444",
            fontSize: "13.5px",
            fontWeight: 500,
            "&:hover": { bgcolor: "#FEF2F2" },
          }}
        >
          Disconnect account
        </Button>

        <Button
          onClick={onClose}
          variant="contained"
          sx={{
            textTransform: "none",
            borderRadius: "9px",
            bgcolor: "#2563EB",
            color: "#FFFFFF",
            fontSize: "13.5px",
            fontWeight: 600,
            px: 2.5,
            "&:hover": { bgcolor: "#1D4ED8" },
          }}
        >
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}
