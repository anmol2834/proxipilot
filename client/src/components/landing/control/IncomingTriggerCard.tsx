"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export function IncomingTriggerCard() {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        position: "relative",
        zIndex: 3,
        mb: 2,
      }}
    >
      {/* Top Incoming Email Card */}
      <Box
        sx={{
          width: { xs: "100%", sm: 360 },
          backgroundColor: "#FFFFFF",
          borderRadius: "18px",
          border: "1px solid #EEF2F6",
          boxShadow: "0 8px 25px rgba(0, 0, 0, 0.04)",
          p: "16px 20px",
          transition: "transform 200ms ease, box-shadow 200ms ease",
          "&:hover": {
            transform: "translateY(-2px)",
            boxShadow: "0 12px 32px rgba(0, 0, 0, 0.07)",
          },
        }}
      >
        {/* Top row: Icon + Label + Time */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 1.25,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: "8px",
                backgroundColor: "#EFF6FF",
                color: "#2563EB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: "0.8125rem", color: "#0F172A" }}>
              New incoming email
            </Typography>
          </Box>
          <Typography sx={{ fontSize: "0.75rem", color: "#94A3B8", fontWeight: 500 }}>
            10:24 AM
          </Typography>
        </Box>

        {/* Email Question Preview */}
        <Typography
          sx={{
            fontWeight: 600,
            fontSize: "0.8125rem",
            color: "#334155",
            mb: 1.5,
          }}
        >
          Can you send pricing for 500 licenses?
        </Typography>

        {/* Preview Skeleton Lines */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Box sx={{ width: "75%", height: 4, backgroundColor: "#E2E8F0", borderRadius: "2px" }} />
          <Box sx={{ width: "45%", height: 4, backgroundColor: "#F1F5F9", borderRadius: "2px" }} />
        </Box>
      </Box>

      {/* Downward Connector Line with Arrow */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          color: "#6366F1",
          mt: 0.5,
          mb: 0.5,
        }}
      >
        <svg width="12" height="34" viewBox="0 0 12 34" fill="none">
          <line
            x1="6"
            y1="0"
            x2="6"
            y2="26"
            stroke="#6366F1"
            strokeWidth="1.75"
            strokeDasharray="4 4"
          />
          <path
            d="M2 24L6 31L10 24"
            stroke="#6366F1"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Box>
    </Box>
  );
}
