"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import Link from "next/link";

interface SubroutePlaceholderProps {
  title: string;
  badge?: string;
  description: string;
  actionText?: string;
  actionHref?: string;
  icon?: React.ReactNode;
}

export function SubroutePlaceholder({
  title,
  badge = "Coming soon",
  description,
  actionText = "Back to Overview",
  actionHref = "/dashboard",
  icon,
}: SubroutePlaceholderProps) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Page Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 800,
                color: "#0F172A",
                letterSpacing: "-0.02em",
              }}
            >
              {title}
            </Typography>
            <Box
              sx={{
                px: 1.25,
                py: 0.25,
                backgroundColor: "#EFF6FF",
                borderRadius: "6px",
                border: "1px solid #DBEAFE",
              }}
            >
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#2563EB" }}>
                {badge}
              </Typography>
            </Box>
          </Box>
          <Typography sx={{ fontSize: "0.88rem", color: "#64748B" }}>
            {description}
          </Typography>
        </Box>

        <Button
          component={Link}
          href={actionHref}
          variant="outlined"
          size="small"
          sx={{
            textTransform: "none",
            borderRadius: "9px",
            borderColor: "#E2E8F0",
            color: "#475569",
            fontWeight: 600,
            fontSize: "0.82rem",
            px: 2,
            "&:hover": {
              borderColor: "#CBD5E1",
              backgroundColor: "#F8FAFC",
            },
          }}
        >
          {actionText}
        </Button>
      </Box>

      {/* Card Body */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 4, sm: 6 },
          borderRadius: "18px",
          border: "1px dashed #CBD5E1",
          backgroundColor: "#FFFFFF",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          minHeight: 380,
        }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: "14px",
            backgroundColor: "#EFF6FF",
            color: "#2563EB",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mb: 2.5,
          }}
        >
          {icon || (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          )}
        </Box>

        <Typography sx={{ fontWeight: 800, fontSize: "1.15rem", color: "#0F172A", mb: 1 }}>
          {title} is coming soon
        </Typography>

        <Typography sx={{ color: "#64748B", fontSize: "0.88rem", maxWidth: 500, mb: 3 }}>
          We are building this section. Your inbox, AI drafts, knowledge base and integrations already work as usual.
        </Typography>

        <Button
          component={Link}
          href="/dashboard"
          variant="contained"
          sx={{
            backgroundColor: "#2563EB",
            color: "#FFFFFF",
            textTransform: "none",
            fontWeight: 700,
            fontSize: "0.85rem",
            borderRadius: "10px",
            px: 3,
            py: 1,
            boxShadow: "0 2px 8px rgba(37, 99, 235, 0.25)",
            "&:hover": { backgroundColor: "#1D4ED8" },
          }}
        >
          Return to Overview
        </Button>
      </Paper>
    </Box>
  );
}
