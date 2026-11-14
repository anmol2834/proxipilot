"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import { ConnectedIntegrationAccount, ConnectionStatus } from "@/types/integrations.types";
import { GmailLogo } from "./ProviderIcons";

interface ConnectedAccountsSectionProps {
  accounts: ConnectedIntegrationAccount[];
  onConnectAnother: () => void;
  onManageAccount: (account: ConnectedIntegrationAccount) => void;
  onDisconnectAccount: (account: ConnectedIntegrationAccount) => void;
  onManualSync: (id: string) => void;
  onReconnectAccount?: (id: string) => void;
}

function StatusBadge({ status, syncProgress }: { status: ConnectionStatus; syncProgress?: number }) {
  switch (status) {
    case "healthy":
    case "connected":
      return (
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
          <Box
            sx={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              bgcolor: "#10B981",
              boxShadow: "0 0 0 2px rgba(16, 185, 129, 0.2)",
            }}
          />
          <Typography sx={{ fontSize: "12.5px", fontWeight: 600, color: "#059669" }}>
            Connected • Healthy
          </Typography>
        </Box>
      );
    case "syncing":
      return (
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
          <Box
            sx={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              bgcolor: "#3B82F6",
              animation: "pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
              "@keyframes pulse": {
                "0%, 100%": { opacity: 1 },
                "50%": { opacity: 0.4 },
              },
            }}
          />
          <Typography sx={{ fontSize: "12.5px", fontWeight: 600, color: "#2563EB" }}>
            Syncing conversations... {syncProgress ? `${syncProgress}%` : ""}
          </Typography>
        </Box>
      );
    case "needs_attention":
      return (
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
          <Box
            sx={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              bgcolor: "#F59E0B",
            }}
          />
          <Typography sx={{ fontSize: "12.5px", fontWeight: 600, color: "#D97706" }}>
            ⚠ Needs attention • Reconnect required
          </Typography>
        </Box>
      );
    case "error":
      return (
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
          <Box
            sx={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              bgcolor: "#EF4444",
            }}
          />
          <Typography sx={{ fontSize: "12.5px", fontWeight: 600, color: "#DC2626" }}>
            Connection error
          </Typography>
        </Box>
      );
    default:
      return (
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
          <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "#94A3B8" }} />
          <Typography sx={{ fontSize: "12.5px", fontWeight: 500, color: "#64748B" }}>
            {status}
          </Typography>
        </Box>
      );
  }
}

export function ConnectedAccountsSection({
  accounts,
  onConnectAnother,
  onManageAccount,
  onDisconnectAccount,
  onManualSync,
  onReconnectAccount,
}: ConnectedAccountsSectionProps) {
  if (accounts.length === 0) return null;

  return (
    <Box sx={{ mb: 3.5 }}>
      {/* Header Row */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1.5,
          mb: 2,
        }}
      >
        <Box>
          <Typography
            variant="h6"
            sx={{
              fontSize: "17px",
              fontWeight: 700,
              color: "#0F172A",
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            Connected Gmail accounts
            <Box
              component="span"
              sx={{
                px: 1,
                py: 0.2,
                borderRadius: "9999px",
                bgcolor: "#EFF6FF",
                border: "1px solid #DBEAFE",
                color: "#2563EB",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              {accounts.length}
            </Box>
          </Typography>
          <Typography sx={{ fontSize: "13px", color: "#64748B" }}>
            Multiple mailboxes syncing with ProxiPilot AI for your organization.
          </Typography>
        </Box>

        <Button
          onClick={onConnectAnother}
          variant="outlined"
          sx={{
            textTransform: "none",
            borderRadius: "10px",
            borderColor: "#2563EB",
            color: "#2563EB",
            bgcolor: "#F8FAFF",
            fontSize: "13.5px",
            fontWeight: 600,
            px: 2,
            py: 0.75,
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            "&:hover": {
              borderColor: "#1D4ED8",
              bgcolor: "#EFF6FF",
            },
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Connect another Gmail
        </Button>
      </Box>

      {/* Grid of Connected Account Cards */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
          gap: 2,
        }}
      >
        {accounts.map((account) => (
          <Box
            key={account.id}
            sx={{
              borderRadius: "14px",
              border: "1px solid #E2E8F0",
              bgcolor: "#FFFFFF",
              p: 2.5,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
              transition: "all 0.2s ease",
              "&:hover": {
                borderColor: "#CBD5E1",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
              },
            }}
          >
            {/* Top Row: Logo, Email, Status */}
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, mb: 2 }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: "12px",
                  bgcolor: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <GmailLogo size={24} />
              </Box>

              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                    mb: 0.35,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: "14.5px",
                      fontWeight: 600,
                      color: "#0F172A",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {account.emailAddress}
                  </Typography>

                  <Typography
                    sx={{
                      fontSize: "12px",
                      color: "#64748B",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Last synced {account.lastSyncedAt}
                  </Typography>
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                  <StatusBadge status={account.status} syncProgress={account.syncProgress} />
                  {account.displayName && (
                    <Typography sx={{ fontSize: "12px", color: "#94A3B8" }}>
                      ({account.displayName})
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>

            {/* Warning banner if watch expired or re-authorization required */}
            {(account.status === "needs_attention" || account.needsReconnect || account.watchExpired) && (
              <Box
                sx={{
                  mb: 2,
                  p: 1.5,
                  borderRadius: "10px",
                  bgcolor: "#FFFBEB",
                  border: "1px solid #FDE68A",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 1.25,
                }}
              >
                <Box
                  sx={{
                    color: "#D97706",
                    display: "flex",
                    alignItems: "center",
                    mt: 0.2,
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width="16"
                    height="16"
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
                  <Typography sx={{ fontSize: "12.5px", fontWeight: 700, color: "#92400E" }}>
                    7-Day Gmail Sync Watch Expired
                  </Typography>
                  <Typography sx={{ fontSize: "12px", color: "#B45309", mt: 0.25, lineHeight: 1.45 }}>
                    {account.reconnectReason ||
                      "Google Pub/Sub push notifications expire every 7 days. Reconnect your account to renew real-time email syncing."}
                  </Typography>
                </Box>
              </Box>
            )}

            {/* Sync Progress Bar if Syncing */}
            {account.status === "syncing" && (
              <Box sx={{ mb: 2 }}>
                <LinearProgress
                  variant={account.syncProgress ? "determinate" : "indeterminate"}
                  value={account.syncProgress || 30}
                  sx={{
                    height: 5,
                    borderRadius: 3,
                    bgcolor: "#EFF6FF",
                    "& .MuiLinearProgress-bar": {
                      bgcolor: "#2563EB",
                      borderRadius: 3,
                    },
                  }}
                />
              </Box>
            )}

            {/* Bottom Actions Row */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                pt: 1.5,
                borderTop: "1px solid #F1F5F9",
                flexWrap: "wrap",
                gap: 1,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                {(account.status === "needs_attention" || account.needsReconnect || account.watchExpired) && (
                  <Button
                    onClick={() => onReconnectAccount?.(account.id)}
                    size="small"
                    variant="contained"
                    sx={{
                      textTransform: "none",
                      borderRadius: "8px",
                      bgcolor: "#D97706",
                      color: "#FFFFFF",
                      fontSize: "13px",
                      fontWeight: 600,
                      px: 2,
                      py: 0.5,
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
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                    Reconnect
                  </Button>
                )}

                <Button
                  onClick={() => onManageAccount(account)}
                  size="small"
                  variant="outlined"
                  sx={{
                    textTransform: "none",
                    borderRadius: "8px",
                    borderColor: "#E2E8F0",
                    color: "#334155",
                    fontSize: "13px",
                    fontWeight: 500,
                    px: 1.75,
                    py: 0.5,
                    bgcolor: "#FFFFFF",
                    "&:hover": {
                      borderColor: "#CBD5E1",
                      bgcolor: "#F8FAFC",
                    },
                  }}
                >
                  Manage
                </Button>

                <Button
                  onClick={() => onDisconnectAccount(account)}
                  size="small"
                  sx={{
                    textTransform: "none",
                    borderRadius: "8px",
                    color: "#EF4444",
                    fontSize: "13px",
                    fontWeight: 500,
                    px: 1.75,
                    py: 0.5,
                    "&:hover": {
                      bgcolor: "#FEF2F2",
                      color: "#DC2626",
                    },
                  }}
                >
                  Disconnect
                </Button>
              </Box>

              <Button
                onClick={() => {
                  if (account.status === "needs_attention" || account.needsReconnect || account.watchExpired) {
                    onReconnectAccount?.(account.id);
                  } else {
                    onManualSync(account.id);
                  }
                }}
                disabled={account.status === "syncing"}
                size="small"
                sx={{
                  textTransform: "none",
                  color:
                    account.status === "needs_attention" || account.needsReconnect || account.watchExpired
                      ? "#D97706"
                      : "#64748B",
                  fontSize: "12px",
                  p: 0.5,
                  minWidth: "auto",
                  "&:hover": {
                    color:
                      account.status === "needs_attention" || account.needsReconnect || account.watchExpired
                        ? "#B45309"
                        : "#2563EB",
                  },
                }}
                title={
                  account.status === "needs_attention" || account.needsReconnect || account.watchExpired
                    ? "Reconnect required to resume synchronization"
                    : "Sync now"
                }
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    animation: account.status === "syncing" ? "spin 1.5s linear infinite" : "none",
                  }}
                >
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
              </Button>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
