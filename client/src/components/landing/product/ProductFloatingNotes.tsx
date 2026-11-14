"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export function ProductTopLeftNote() {
  return (
    <Box
      sx={{
        position: "absolute",
        top: { xs: -30, sm: -40, md: -20, lg: 15 },
        left: { xs: 5, sm: 10, md: 20, lg: -30, xl: -45 },
        zIndex: 10,
        pointerEvents: "none",
        display: { xs: "none", sm: "flex" },
        flexDirection: "column",
        alignItems: "flex-start",
      }}
    >
      {/* Handwritten Text */}
      <Box
        sx={{
          transform: "rotate(-8deg)",
          transformOrigin: "bottom left",
          mb: 1,
          ml: 1,
        }}
      >
        <Typography
          sx={{
            fontFamily: "var(--font-handwritten), Caveat, cursive",
            fontSize: { sm: "1.35rem", md: "1.55rem", lg: "1.75rem" },
            lineHeight: 1.15,
            color: "#64748B",
            fontWeight: 600,
          }}
        >
          One inbox.
          <br />
          Many possibilities.
        </Typography>
      </Box>

      {/* Curved Arrow pointing toward the card */}
      <Box sx={{ ml: 4, mt: -0.5, color: "#94A3B8" }}>
        <svg width="48" height="54" viewBox="0 0 48 54" fill="none">
          <path
            d="M8 2 C 10 24, 22 42, 38 46"
            stroke="#94A3B8"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeDasharray="3 3"
          />
          <path
            d="M32 40 L 40 46 L 36 52"
            stroke="#94A3B8"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Box>

      {/* Floating Mail Icon Pill */}
      <Box
        sx={{
          position: "absolute",
          top: { sm: 70, md: 80, lg: 90 },
          left: { sm: 10, md: -10, lg: -25 },
          width: 44,
          height: 44,
          borderRadius: "14px",
          backgroundColor: "#FFFFFF",
          border: "1px solid #E2E8F0",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.02)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#3B82F6",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="16" x="2" y="4" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      </Box>
    </Box>
  );
}

export function ProductBottomRightNote() {
  return (
    <Box
      sx={{
        position: "absolute",
        bottom: { xs: 40, sm: 60, md: 80, lg: 120 },
        right: { xs: 5, sm: 10, md: 20, lg: -30, xl: -45 },
        zIndex: 10,
        pointerEvents: "none",
        display: { xs: "none", sm: "flex" },
        flexDirection: "column",
        alignItems: "flex-end",
      }}
    >
      {/* Floating Sparkle/Star Icon Pill */}
      <Box
        sx={{
          position: "absolute",
          top: -45,
          right: { sm: 20, md: 30, lg: 20 },
          width: 44,
          height: 44,
          borderRadius: "14px",
          backgroundColor: "#FFFFFF",
          border: "1px solid #E2E8F0",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.02)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#635BFF",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
            fill="#635BFF"
          />
        </svg>
      </Box>

      {/* Handwritten Text */}
      <Box
        sx={{
          transform: "rotate(-4deg)",
          transformOrigin: "bottom right",
          mb: 1.5,
          textAlign: "right",
        }}
      >
        <Typography
          sx={{
            fontFamily: "var(--font-handwritten), Caveat, cursive",
            fontSize: { sm: "1.35rem", md: "1.55rem", lg: "1.75rem" },
            lineHeight: 1.15,
            color: "#64748B",
            fontWeight: 600,
          }}
        >
          Less manual work.
          <br />
          More meaningful
          <br />
          conversations.
        </Typography>
      </Box>

      {/* Curved Arrow pointing down/left toward the card */}
      <Box sx={{ mr: 4, color: "#94A3B8" }}>
        <svg width="48" height="54" viewBox="0 0 48 54" fill="none">
          <path
            d="M38 4 C 36 26, 24 44, 8 48"
            stroke="#94A3B8"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeDasharray="3 3"
          />
          <path
            d="M14 42 L 6 48 L 12 54"
            stroke="#94A3B8"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Box>
    </Box>
  );
}
