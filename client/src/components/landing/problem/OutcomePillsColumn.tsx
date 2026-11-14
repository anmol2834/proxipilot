"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

const OUTCOMES = [
  "Prioritized",
  "Understood",
  "Assigned",
  "Verified",
  "Automated",
];

export function OutcomePillsColumn() {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "row", sm: "row", lg: "column" },
        flexWrap: { xs: "wrap", sm: "nowrap" },
        justifyContent: "center",
        alignItems: { xs: "center", lg: "flex-start" },
        gap: { xs: 1.25, sm: 1.5, lg: 2.2 },
        zIndex: 2,
      }}
    >
      {OUTCOMES.map((label, idx) => (
        <Box
          key={idx}
          sx={{
            width: { xs: 130, sm: 140, lg: 154 },
            height: { xs: 52, sm: 56, lg: 60 },
            backgroundColor: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #EEF2F6",
            boxShadow: "0 4px 14px rgba(0, 0, 0, 0.04)",
            display: "flex",
            alignItems: "center",
            px: { xs: 1.5, lg: 2 },
            gap: 1.5,
            transition: "all 200ms ease",
            "&:hover": {
              transform: "translateY(-2px)",
              boxShadow: "0 6px 18px rgba(16, 185, 129, 0.1)",
              borderColor: "#D1FAE5",
            },
          }}
        >
          {/* Green Checkmark Circle */}
          <Box
            sx={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              backgroundColor: "#10B981",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </Box>

          {/* Outcome Label */}
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: { xs: "0.8125rem", lg: "0.875rem" },
              color: "#0F172A",
              letterSpacing: "-0.01em",
            }}
          >
            {label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
