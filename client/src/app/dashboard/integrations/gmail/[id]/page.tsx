"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useIntegrationsStore } from "@/stores/integrations.store";
import { useIntegrations } from "@/hooks/use-integrations";
import { GmailLogo } from "@/components/integrations/ProviderIcons";
import { DisconnectConfirmDialog } from "@/components/integrations/DisconnectConfirmDialog";
import CircularProgress from "@mui/material/CircularProgress";

export default function GmailAccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const {
    accounts,
    isLoading,
    triggerManualSync,
    reconnectAccount,
    disconnectAccount,
  } = useIntegrations();

  const {
    isDisconnectModalOpen,
    accountToDisconnect,
    openDisconnectModal,
    closeDisconnectModal,
  } = useIntegrationsStore();

  const account = accounts.find((a) => a.id === id);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
        <CircularProgress size={32} sx={{ color: "#2563EB" }} />
      </Box>
    );
  }

  if (!account) {
    return (
      <Box sx={{ maxWidth: 800, mx: "auto", py: 6, textAlign: "center" }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: "#0F172A" }}>
          Gmail Account Not Found
        </Typography>
        <Typography sx={{ color: "#64748B", mb: 3 }}>
          This connected integration account may have been disconnected or does not exist.
        </Typography>
        <Link href="/dashboard/integrations" style={{ textDecoration: "none" }}>
          <Button variant="contained" sx={{ textTransform: "none", bgcolor: "#2563EB" }}>
            Return to Integrations
          </Button>
        </Link>
      </Box>
    );
  }

  const handleConfirmDisconnect = async () => {
    if (accountToDisconnect) {
      await disconnectAccount(accountToDisconnect.id);
      router.push("/dashboard/integrations");
    }
  };

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", pb: 6 }}>
      {/* Breadcrumb */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          mb: 2,
          fontSize: "13px",
          color: "#64748B",
        }}
      >
        <Link
          href="/dashboard/integrations"
          style={{
            display: "inline-flex",
            alignItems: "center",
            color: "#64748B",
            textDecoration: "none",
          }}
        >
          Integrations
        </Link>
        <span style={{ color: "#94A3B8" }}>›</span>
        <Typography component="span" sx={{ fontSize: "13px", color: "#475569", fontWeight: 500 }}>
          {account.emailAddress}
        </Typography>
      </Box>

      {/* Header card */}
      <Box
        sx={{
          p: 3.5,
          borderRadius: "16px",
          border: "1px solid #E2E8F0",
          bgcolor: "#FFFFFF",
          mb: 3,
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: "14px",
              bgcolor: "#F8FAFC",
              border: "1px solid #E2E8F0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <GmailLogo size={32} />
          </Box>
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
              <Typography variant="h5" sx={{ fontSize: "20px", fontWeight: 700, color: "#0F172A" }}>
                {account.emailAddress}
              </Typography>
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
            <Typography sx={{ fontSize: "13px", color: "#64748B" }}>
              Google Workspace Account • Connected by {account.connectedByUserName}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          {(account.status === "needs_attention" || account.needsReconnect || account.watchExpired) && (
            <Button
              onClick={() => reconnectAccount(account.id)}
              variant="contained"
              sx={{
                textTransform: "none",
                borderRadius: "10px",
                bgcolor: "#D97706",
                color: "#FFFFFF",
                fontSize: "13.5px",
                fontWeight: 600,
                px: 2,
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                boxShadow: "0 1px 2px rgba(217, 119, 6, 0.2)",
                "&:hover": {
                  bgcolor: "#B45309",
                },
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
              Reconnect Mailbox
            </Button>
          )}

          <Button
            onClick={() => {
              if (account.status === "needs_attention" || account.needsReconnect || account.watchExpired) {
                reconnectAccount(account.id);
              } else {
                triggerManualSync(account.id);
              }
            }}
            disabled={account.status === "syncing"}
            variant="outlined"
            sx={{
              textTransform: "none",
              borderRadius: "10px",
              borderColor: "#CBD5E1",
              color: "#334155",
              fontSize: "13.5px",
              fontWeight: 500,
              px: 2,
            }}
          >
            {account.status === "syncing"
              ? "Syncing..."
              : account.status === "needs_attention" || account.needsReconnect || account.watchExpired
              ? "Reconnect to sync"
              : "Sync Mailbox"}
          </Button>
          <Button
            onClick={() => openDisconnectModal(account)}
            variant="outlined"
            sx={{
              textTransform: "none",
              borderRadius: "10px",
              borderColor: "#FECACA",
              color: "#EF4444",
              fontSize: "13.5px",
              fontWeight: 500,
              px: 2,
              "&:hover": {
                bgcolor: "#FEF2F2",
                borderColor: "#F87171",
              },
            }}
          >
            Disconnect
          </Button>
        </Box>
      </Box>

      {/* Warning banner if watch expired or re-authorization required */}
      {(account.status === "needs_attention" || account.needsReconnect || account.watchExpired) && (
        <Box
          sx={{
            mb: 3,
            p: 2,
            borderRadius: "14px",
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
              onClick={() => reconnectAccount(account.id)}
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

      {/* Details Grid */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.2fr 0.8fr" }, gap: 3 }}>
        {/* Permissions & Scopes */}
        <Box
          sx={{
            p: 3,
            borderRadius: "16px",
            border: "1px solid #E2E8F0",
            bgcolor: "#FFFFFF",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          <Typography sx={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", mb: 0.5 }}>
            Granted Permissions
          </Typography>
          <Typography sx={{ fontSize: "13px", color: "#64748B", mb: 2 }}>
            ProxiPilot only requests minimal OAuth scopes required to analyze and automate emails.
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
            {account.scopes.map((scope, idx) => (
              <Box
                key={idx}
                sx={{
                  p: 1.5,
                  borderRadius: "10px",
                  bgcolor: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                }}
              >
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    bgcolor: "#ECFDF5",
                    color: "#10B981",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </Box>
                <Typography sx={{ fontSize: "12.5px", fontFamily: "monospace", color: "#334155" }}>
                  {scope}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Sync & Operational Status */}
        <Box
          sx={{
            p: 3,
            borderRadius: "16px",
            border: "1px solid #E2E8F0",
            bgcolor: "#FFFFFF",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <Typography sx={{ fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
            Operational Sync Health
          </Typography>

          <Box sx={{ p: 2, borderRadius: "10px", bgcolor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
            <Typography sx={{ fontSize: "12px", color: "#64748B", mb: 0.5 }}>Last Successful Sync</Typography>
            <Typography sx={{ fontSize: "15px", fontWeight: 600, color: "#0F172A" }}>
              {account.lastSyncedAt}
            </Typography>
          </Box>

          <Box sx={{ p: 2, borderRadius: "10px", bgcolor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
            <Typography sx={{ fontSize: "12px", color: "#64748B", mb: 0.5 }}>Indexed Email Threads</Typography>
            <Typography sx={{ fontSize: "15px", fontWeight: 600, color: "#0F172A" }}>
              {account.totalSyncedEmails ?? 128} conversations
            </Typography>
          </Box>

          <Box sx={{ p: 2, borderRadius: "10px", bgcolor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
            <Typography sx={{ fontSize: "12px", color: "#64748B", mb: 0.5 }}>Account Identity</Typography>
            <Typography sx={{ fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>
              {account.providerAccountId}
            </Typography>
          </Box>
        </Box>
      </Box>

      <DisconnectConfirmDialog
        open={isDisconnectModalOpen}
        account={accountToDisconnect}
        onClose={closeDisconnectModal}
        onConfirm={handleConfirmDisconnect}
      />
    </Box>
  );
}
