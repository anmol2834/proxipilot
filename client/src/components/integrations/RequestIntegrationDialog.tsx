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
import { IntegrationRequestPayload } from "@/types/integrations.types";

interface RequestIntegrationDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: IntegrationRequestPayload) => void;
}

export function RequestIntegrationDialog({
  open,
  onClose,
  onSubmit,
}: RequestIntegrationDialogProps) {
  const [toolName, setToolName] = useState("");
  const [useCase, setUseCase] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!toolName.trim()) return;

    onSubmit({
      toolName: toolName.trim(),
      useCase: useCase.trim(),
    });

    setIsSubmitted(true);
    setTimeout(() => {
      setIsSubmitted(false);
      setToolName("");
      setUseCase("");
      onClose();
    }, 1500);
  };

  const handleClose = () => {
    if (!isSubmitted) {
      setToolName("");
      setUseCase("");
      onClose();
    }
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
            borderRadius: "16px",
            p: 1,
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
          },
        },
      }}
    >
      <DialogTitle sx={{ pb: 1, pt: 2, px: 2.5 }}>
        <Typography sx={{ fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>
          Request an integration
        </Typography>
        <Typography sx={{ fontSize: "13px", color: "#64748B", mt: 0.5 }}>
          Tell us which tool you want ProxiPilot to connect with next.
        </Typography>
      </DialogTitle>

      {isSubmitted ? (
        <DialogContent sx={{ px: 2.5, py: 4, textAlign: "center" }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              bgcolor: "#ECFDF5",
              color: "#10B981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mx: "auto",
              mb: 2,
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </Box>
          <Typography sx={{ fontSize: "16px", fontWeight: 600, color: "#0F172A", mb: 0.5 }}>
            Thank you! Request received.
          </Typography>
          <Typography sx={{ fontSize: "13.5px", color: "#64748B" }}>
            Our product team reviews integration requests weekly.
          </Typography>
        </DialogContent>
      ) : (
        <form onSubmit={handleSubmit}>
          <DialogContent sx={{ px: 2.5, py: 1.5, display: "flex", flexDirection: "column", gap: 2.5 }}>
            <Box>
              <Typography sx={{ fontSize: "13.5px", fontWeight: 600, color: "#334155", mb: 0.75 }}>
                Which integration would you like to see? *
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="e.g. Zendesk, Notion, Linear, WhatsApp"
                value={toolName}
                onChange={(e) => setToolName(e.target.value)}
                required
                autoFocus
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "10px",
                    bgcolor: "#F8FAFC",
                    fontSize: "14px",
                  },
                }}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: "13.5px", fontWeight: 600, color: "#334155", mb: 0.75 }}>
                Why is it useful to you? (optional)
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                placeholder="Describe how your team would use this integration..."
                value={useCase}
                onChange={(e) => setUseCase(e.target.value)}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "10px",
                    bgcolor: "#F8FAFC",
                    fontSize: "14px",
                  },
                }}
              />
            </Box>
          </DialogContent>

          <DialogActions sx={{ px: 2.5, pb: 2, pt: 1, gap: 1 }}>
            <Button
              onClick={handleClose}
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
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!toolName.trim()}
              variant="contained"
              sx={{
                textTransform: "none",
                borderRadius: "9px",
                bgcolor: "#2563EB",
                color: "#FFFFFF",
                fontSize: "13.5px",
                fontWeight: 600,
                px: 2.5,
                py: 0.75,
                boxShadow: "0 1px 3px rgba(37, 99, 235, 0.3)",
                "&:hover": {
                  bgcolor: "#1D4ED8",
                },
              }}
            >
              Submit request
            </Button>
          </DialogActions>
        </form>
      )}
    </Dialog>
  );
}
