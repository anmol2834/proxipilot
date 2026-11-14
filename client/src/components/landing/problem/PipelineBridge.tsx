"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export function PipelineBridge() {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "row", md: "row", lg: "row" },
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        px: { xs: 1, sm: 2, lg: 2.5 },
        py: { xs: 2, lg: 0 },
        zIndex: 2,
      }}
    >
      {/* Left Ingress Dashed Arrow (Desktop & Tablet) */}
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          alignItems: "center",
          mr: { md: 1.5, lg: 2.5 },
          color: "#6366F1",
          opacity: 0.85,
        }}
      >
        <svg width="36" height="16" viewBox="0 0 36 16" fill="none">
          <line
            x1="0"
            y1="8"
            x2="28"
            y2="8"
            stroke="#6366F1"
            strokeWidth="2"
            strokeDasharray="4 4"
          />
          <path
            d="M26 3L33 8L26 13"
            stroke="#6366F1"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Box>

      {/* Central Vertical Pipeline Nodes Column */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "row", md: "column" },
          alignItems: "center",
          justifyContent: "center",
          gap: { xs: 2, md: 1.75 },
        }}
      >
        {/* Node 1: CHAOS (Lightning Bolt) */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0.75,
          }}
        >
          <Box
            sx={{
              width: { xs: 44, lg: 50 },
              height: { xs: 44, lg: 50 },
              borderRadius: "50%",
              backgroundColor: "#FFF1F2",
              border: "1px solid #FFE4E6",
              boxShadow: "0 0 20px rgba(244, 63, 94, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#EF4444",
              transition: "transform 200ms ease",
              "&:hover": { transform: "scale(1.08)" },
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </Box>
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: "0.6875rem",
              letterSpacing: "0.08em",
              color: "#EF4444",
              textAlign: "center",
            }}
          >
            CHAOS
          </Typography>
        </Box>

        {/* Downward Connector Arrow 1 */}
        <Box
          sx={{
            display: { xs: "none", md: "flex" },
            flexDirection: "column",
            alignItems: "center",
            color: "#94A3B8",
            my: -0.25,
          }}
        >
          <svg width="12" height="26" viewBox="0 0 12 26" fill="none">
            <line
              x1="6"
              y1="0"
              x2="6"
              y2="18"
              stroke="#94A3B8"
              strokeWidth="1.75"
              strokeDasharray="3 3"
            />
            <path
              d="M2 16L6 22L10 16"
              stroke="#94A3B8"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Box>

        {/* Node 2: UNDERSTAND (Search Glass) */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0.75,
          }}
        >
          <Box
            sx={{
              width: { xs: 44, lg: 50 },
              height: { xs: 44, lg: 50 },
              borderRadius: "50%",
              backgroundColor: "#EFF6FF",
              border: "1px solid #DBEAFE",
              boxShadow: "0 0 20px rgba(59, 130, 246, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#3B82F6",
              transition: "transform 200ms ease",
              "&:hover": { transform: "scale(1.08)" },
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16" y2="16" />
            </svg>
          </Box>
          <Box
            sx={{
              backgroundColor: "#EFF6FF",
              color: "#3B82F6",
              fontWeight: 800,
              fontSize: "0.6875rem",
              letterSpacing: "0.06em",
              px: 1.5,
              py: 0.35,
              borderRadius: "9999px",
              textAlign: "center",
              border: "1px solid rgba(59, 130, 246, 0.12)",
            }}
          >
            UNDERSTAND
          </Box>
        </Box>

        {/* Downward Connector Arrow 2 */}
        <Box
          sx={{
            display: { xs: "none", md: "flex" },
            flexDirection: "column",
            alignItems: "center",
            color: "#94A3B8",
            my: -0.25,
          }}
        >
          <svg width="12" height="26" viewBox="0 0 12 26" fill="none">
            <line
              x1="6"
              y1="0"
              x2="6"
              y2="18"
              stroke="#94A3B8"
              strokeWidth="1.75"
              strokeDasharray="3 3"
            />
            <path
              d="M2 16L6 22L10 16"
              stroke="#94A3B8"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Box>

        {/* Node 3: ORGANIZE (4 Grid Squares) */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0.75,
          }}
        >
          <Box
            sx={{
              width: { xs: 44, lg: 50 },
              height: { xs: 44, lg: 50 },
              borderRadius: "50%",
              backgroundColor: "#EEF2FF",
              border: "1px solid #E0E7FF",
              boxShadow: "0 0 20px rgba(99, 102, 241, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#6366F1",
              transition: "transform 200ms ease",
              "&:hover": { transform: "scale(1.08)" },
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="3" width="7" height="7" rx="2" />
              <rect x="14" y="3" width="7" height="7" rx="2" />
              <rect x="3" y="14" width="7" height="7" rx="2" />
              <rect x="14" y="14" width="7" height="7" rx="2" />
            </svg>
          </Box>
          <Box
            sx={{
              backgroundColor: "#EEF2FF",
              color: "#6366F1",
              fontWeight: 800,
              fontSize: "0.6875rem",
              letterSpacing: "0.06em",
              px: 1.5,
              py: 0.35,
              borderRadius: "9999px",
              textAlign: "center",
              border: "1px solid rgba(99, 102, 241, 0.12)",
            }}
          >
            ORGANIZE
          </Box>
        </Box>

        {/* Downward Connector Arrow 3 */}
        <Box
          sx={{
            display: { xs: "none", md: "flex" },
            flexDirection: "column",
            alignItems: "center",
            color: "#94A3B8",
            my: -0.25,
          }}
        >
          <svg width="12" height="26" viewBox="0 0 12 26" fill="none">
            <line
              x1="6"
              y1="0"
              x2="6"
              y2="18"
              stroke="#94A3B8"
              strokeWidth="1.75"
              strokeDasharray="3 3"
            />
            <path
              d="M2 16L6 22L10 16"
              stroke="#94A3B8"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Box>

        {/* Node 4: ACT (Checkmark Circle) */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0.75,
          }}
        >
          <Box
            sx={{
              width: { xs: 44, lg: 50 },
              height: { xs: 44, lg: 50 },
              borderRadius: "50%",
              backgroundColor: "#ECFDF5",
              border: "1px solid #D1FAE5",
              boxShadow: "0 0 20px rgba(16, 185, 129, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#10B981",
              transition: "transform 200ms ease",
              "&:hover": { transform: "scale(1.08)" },
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <polyline points="8 12 11 15 16 9" />
            </svg>
          </Box>
          <Box
            sx={{
              backgroundColor: "#ECFDF5",
              color: "#10B981",
              fontWeight: 800,
              fontSize: "0.6875rem",
              letterSpacing: "0.06em",
              px: 1.5,
              py: 0.35,
              borderRadius: "9999px",
              textAlign: "center",
              border: "1px solid rgba(16, 185, 129, 0.12)",
            }}
          >
            ACT
          </Box>
        </Box>
      </Box>

      {/* Right Egress Dashed Arrow (Desktop & Tablet) */}
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          alignItems: "center",
          ml: { md: 1.5, lg: 2.5 },
          color: "#6366F1",
          opacity: 0.85,
        }}
      >
        <svg width="36" height="16" viewBox="0 0 36 16" fill="none">
          <line
            x1="0"
            y1="8"
            x2="28"
            y2="8"
            stroke="#6366F1"
            strokeWidth="2"
            strokeDasharray="4 4"
          />
          <path
            d="M26 3L33 8L26 13"
            stroke="#6366F1"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Box>
    </Box>
  );
}
