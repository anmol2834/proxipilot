"use client";

import React, { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import { GmailLogo } from "./ProviderIcons";

interface OAuthConnectModalProps {
  open: boolean;
  onClose: () => void;
  onAuthorize: (email: string, displayName?: string) => Promise<void>;
}

export function OAuthConnectModal({ open, onClose, onAuthorize }: OAuthConnectModalProps) {
  const [displayName, setDisplayName] = useState("");
  const [emailHint, setEmailHint] = useState("");
  const [showScopeDetails, setShowScopeDetails] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  React.useEffect(() => {
    if (!open) {
      setIsSubmitting(false);
      setIsRedirecting(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isRedirecting) return;

    setIsSubmitting(true);
    try {
      await onAuthorize(emailHint.trim(), displayName.trim());
      setIsRedirecting(true);
    } catch {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting || isRedirecting) return;
    setDisplayName("");
    setEmailHint("");
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      disableScrollLock
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: "20px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(15, 23, 42, 0.05)",
            overflow: "hidden",
            bgcolor: "#FFFFFF",
            maxHeight: "min(92vh, 660px)",
            display: "flex",
            flexDirection: "column",
          },
        },
      }}
    >
      {/* Top Accent Gradient Bar */}
      <Box
        sx={{
          height: 4,
          background: "linear-gradient(90deg, #4285F4 0%, #EA4335 33%, #FBBC05 66%, #34A853 100%)",
          flexShrink: 0,
        }}
      />

      {/* Header with Icon, Title, and Close Button */}
      <DialogTitle sx={{ px: 3, pt: 2.5, pb: 1.5, flexShrink: 0 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.75 }}>
            <Box
              sx={{
                width: 46,
                height: 46,
                borderRadius: "14px",
                bgcolor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
                flexShrink: 0,
              }}
            >
              <GmailLogo size={26} />
            </Box>
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography sx={{ fontSize: "17.5px", fontWeight: 700, color: "#0F172A", letterSpacing: "-0.01em" }}>
                  Connect Gmail Mailbox
                </Typography>
                <Box
                  sx={{
                    px: 1,
                    py: 0.2,
                    borderRadius: "9999px",
                    bgcolor: "#ECFDF5",
                    border: "1px solid #A7F3D0",
                    color: "#059669",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                >
                  OAuth 2.0
                </Box>
              </Box>
              <Typography sx={{ fontSize: "12.5px", color: "#64748B", mt: 0.25 }}>
                Sync incoming emails and automate replies via Google Cloud Pub/Sub.
              </Typography>
            </Box>
          </Box>

          <IconButton
            onClick={handleClose}
            disabled={isSubmitting || isRedirecting}
            size="small"
            sx={{
              color: "#94A3B8",
              p: 0.75,
              borderRadius: "10px",
              "&:hover": { bgcolor: "#F1F5F9", color: "#475569" },
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </IconButton>
        </Box>
      </DialogTitle>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
        <DialogContent sx={{ px: 3, py: 1.5, display: "flex", flexDirection: "column", gap: 2.25, overflowY: "auto", flex: 1 }}>
          {/* Information Card */}
          <Box
            sx={{
              p: 2,
              borderRadius: "12px",
              bgcolor: "#F8FAFC",
              border: "1px solid #E2E8F0",
              display: "flex",
              flexDirection: "column",
              gap: 1.5,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: "8px",
                  bgcolor: "#EFF6FF",
                  color: "#2563EB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  mt: 0.25,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </Box>
              <Box>
                <Typography sx={{ fontSize: "13.5px", fontWeight: 600, color: "#1E293B" }}>
                  Multi-Account Organization Support
                </Typography>
                <Typography sx={{ fontSize: "12.5px", color: "#64748B", mt: 0.25, lineHeight: 1.5 }}>
                  You can connect multiple individual or shared Google Workspace accounts to this organization. Each mailbox maintains isolated sync cursors and recovery states.
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Mailbox Details Input */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.75 }}>
            <Box>
              <Typography sx={{ fontSize: "13px", fontWeight: 600, color: "#334155", mb: 0.75 }}>
                Mailbox Display Name (Optional)
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="e.g. Support Desk, Sales Pipeline, Founder Mailbox"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isSubmitting}
                slotProps={{
                  input: {
                    sx: {
                      fontSize: "13.5px",
                      borderRadius: "10px",
                      bgcolor: "#FFFFFF",
                      "& fieldset": { borderColor: "#E2E8F0" },
                      "&:hover fieldset": { borderColor: "#CBD5E1" },
                      "&.Mui-focused fieldset": { borderColor: "#2563EB" },
                    },
                  },
                }}
              />
              <Typography sx={{ fontSize: "11.5px", color: "#94A3B8", mt: 0.5 }}>
                Used to label this mailbox across your team inbox and automations.
              </Typography>
            </Box>

            <Box>
              <Typography sx={{ fontSize: "13px", fontWeight: 600, color: "#334155", mb: 0.75 }}>
                Account Email Hint (Optional)
              </Typography>
              <TextField
                fullWidth
                size="small"
                type="email"
                placeholder="e.g. team@yourcompany.com"
                value={emailHint}
                onChange={(e) => setEmailHint(e.target.value)}
                disabled={isSubmitting}
                slotProps={{
                  input: {
                    sx: {
                      fontSize: "13.5px",
                      borderRadius: "10px",
                      bgcolor: "#FFFFFF",
                      "& fieldset": { borderColor: "#E2E8F0" },
                      "&:hover fieldset": { borderColor: "#CBD5E1" },
                      "&.Mui-focused fieldset": { borderColor: "#2563EB" },
                    },
                  },
                }}
              />
              <Typography sx={{ fontSize: "11.5px", color: "#94A3B8", mt: 0.5 }}>
                Pre-selects this account in the Google account chooser if you are logged into multiple accounts.
              </Typography>
            </Box>
          </Box>

          {/* Security & Scopes Section */}
          <Box
            sx={{
              p: 2,
              borderRadius: "12px",
              bgcolor: "#F8FAFC",
              border: "1px solid #E2E8F0",
            }}
          >
            <Box
              onClick={() => setShowScopeDetails(!showScopeDetails)}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ color: "#2563EB", display: "flex", alignItems: "center" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </Box>
                <Typography sx={{ fontSize: "13px", fontWeight: 600, color: "#1E293B" }}>
                  Google OAuth 2.0 Security & Scopes Transparency
                </Typography>
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Typography sx={{ fontSize: "11.5px", color: "#64748B", fontWeight: 500 }}>
                  3 scopes
                </Typography>
                <Box
                  sx={{
                    transform: showScopeDetails ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    color: "#64748B",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </Box>
              </Box>
            </Box>

            <Collapse in={showScopeDetails} sx={{ mt: showScopeDetails ? 1.5 : 0 }}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, pt: 1, borderTop: "1px dashed #E2E8F0" }}>
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25 }}>
                  <Box sx={{ color: "#059669", mt: 0.25, display: "flex" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: "12.5px", fontWeight: 600, color: "#334155" }}>
                      Read & Analyze Emails (gmail.readonly)
                    </Typography>
                    <Typography sx={{ fontSize: "11.5px", color: "#64748B" }}>
                      Allows ProxiPilot to ingest customer inquiries and classify lead intent.
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25 }}>
                  <Box sx={{ color: "#059669", mt: 0.25, display: "flex" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: "12.5px", fontWeight: 600, color: "#334155" }}>
                      Send Automated Responses (gmail.send)
                    </Typography>
                    <Typography sx={{ fontSize: "11.5px", color: "#64748B" }}>
                      Dispatches approved replies under your verified business email address.
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25 }}>
                  <Box sx={{ color: "#059669", mt: 0.25, display: "flex" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: "12.5px", fontWeight: 600, color: "#334155" }}>
                      Synchronize Conversation Context (gmail.modify)
                    </Typography>
                    <Typography sx={{ fontSize: "11.5px", color: "#64748B" }}>
                      Maintains synchronized thread labels and read states across devices.
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Collapse>
          </Box>
        </DialogContent>

        {/* Footer Actions — Always Pinned and 100% Visible */}
        <DialogActions
          sx={{
            px: 3,
            py: 2,
            bgcolor: "#F8FAFC",
            borderTop: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <Typography sx={{ fontSize: "12px", color: "#64748B", display: { xs: "none", sm: "block" } }}>
            🔒 256-bit encrypted credential exchange
          </Typography>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, ml: "auto" }}>
            <Button
              onClick={handleClose}
              disabled={isSubmitting || isRedirecting}
              variant="outlined"
              sx={{
                textTransform: "none",
                borderRadius: "10px",
                borderColor: "#E2E8F0",
                color: "#475569",
                bgcolor: "#FFFFFF",
                fontSize: "13.5px",
                fontWeight: 500,
                px: 2,
                py: 0.8,
                "&:hover": {
                  borderColor: "#CBD5E1",
                  bgcolor: "#F8FAFC",
                },
              }}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting || isRedirecting}
              variant="contained"
              sx={{
                textTransform: "none",
                borderRadius: "10px",
                bgcolor: "#2563EB",
                color: "#FFFFFF",
                fontSize: "13.5px",
                fontWeight: 600,
                px: 2.75,
                py: 0.8,
                boxShadow: "0 2px 8px rgba(37, 99, 235, 0.25)",
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                "&:hover": {
                  bgcolor: "#1D4ED8",
                  boxShadow: "0 4px 12px rgba(37, 99, 235, 0.35)",
                },
              }}
            >
              {isSubmitting || isRedirecting ? (
                <>
                  <CircularProgress size={16} sx={{ color: "#FFFFFF" }} />
                  {isRedirecting ? "Opening Google..." : "Connecting..."}
                </>
              ) : (
                <>
                  Authorize with Google
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
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </>
              )}
            </Button>
          </Box>
        </DialogActions>
      </form>
    </Dialog>
  );
}
