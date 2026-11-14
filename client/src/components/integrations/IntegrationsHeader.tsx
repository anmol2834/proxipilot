"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Link from "next/link";

interface IntegrationsHeaderProps {
  onNeedHelpClick?: () => void;
}

export function IntegrationsHeader({ onNeedHelpClick }: IntegrationsHeaderProps) {
  return (
    <Box sx={{ mb: 3 }}>
      {/* Breadcrumbs: Home icon > Integrations */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          mb: 1.5,
          fontSize: "13px",
          color: "#64748B",
        }}
      >
        <Link
          href="/dashboard"
          style={{
            display: "inline-flex",
            alignItems: "center",
            color: "#64748B",
            textDecoration: "none",
            transition: "color 0.2s ease",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#2563EB")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#64748B")}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </Link>
        <span style={{ color: "#94A3B8", fontSize: "12px" }}>›</span>
        <Typography
          component="span"
          sx={{
            fontSize: "13px",
            fontWeight: 500,
            color: "#475569",
          }}
        >
          Integrations
        </Typography>
      </Box>

      {/* Main Title Row + Need help Button */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "flex-start", sm: "flex-start" },
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{
              fontSize: { xs: "24px", sm: "28px" },
              fontWeight: 700,
              color: "#0F172A",
              letterSpacing: "-0.025em",
              lineHeight: 1.2,
              mb: 0.75,
            }}
          >
            Integrations
          </Typography>
          <Typography
            sx={{
              fontSize: { xs: "13.5px", sm: "14.5px" },
              color: "#64748B",
              lineHeight: 1.5,
              maxWidth: "680px",
            }}
          >
            Connect ProxiPilot with your email and business tools to unlock more powerful automation.
          </Typography>
        </Box>

        {/* Need Help Button */}
        <Button
          onClick={onNeedHelpClick}
          variant="outlined"
          sx={{
            textTransform: "none",
            borderRadius: "10px",
            borderColor: "#E2E8F0",
            color: "#334155",
            bgcolor: "#FFFFFF",
            px: 2,
            py: 0.85,
            fontSize: "13.5px",
            fontWeight: 500,
            display: "inline-flex",
            alignItems: "center",
            gap: 0.85,
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
            "&:hover": {
              borderColor: "#CBD5E1",
              bgcolor: "#F8FAFC",
            },
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#64748B"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <path d="M12 17h.01" />
          </svg>
          Need help?
        </Button>
      </Box>
    </Box>
  );
}
