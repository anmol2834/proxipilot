"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface IngestItem {
  id: string;
  title: string;
  icon: React.ReactNode;
}

const INGEST_ITEMS: IngestItem[] = [
  {
    id: "gmail",
    title: "Customer inquiry",
    icon: (
      <svg width="22" height="18" viewBox="0 0 24 20" fill="none">
        <path d="M1.5 17.5V4.5C1.5 3.4 2.4 2.5 3.5 2.5H5.5L12 8L18.5 2.5H20.5C21.6 2.5 22.5 3.4 22.5 4.5V17.5C22.5 18.6 21.6 19.5 20.5 19.5H18.5V9.5L12 14.5L5.5 9.5V19.5H3.5C2.4 19.5 1.5 18.6 1.5 17.5Z" fill="#EA4335" />
        <path d="M18.5 2.5H20.5C21.6 2.5 22.5 3.4 22.5 4.5V8.5L18.5 5.5V2.5Z" fill="#4285F4" />
        <path d="M1.5 4.5C1.5 3.4 2.4 2.5 3.5 2.5H5.5V5.5L1.5 8.5V4.5Z" fill="#FBBC05" />
        <path d="M1.5 8.5L5.5 11.5V19.5H3.5C2.4 19.5 1.5 18.6 1.5 17.5V8.5Z" fill="#34A853" />
      </svg>
    ),
  },
  {
    id: "outlook",
    title: "Partnership request",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="4" width="20" height="16" rx="3" fill="#0078D4" />
        <path d="M2 7L12 13L22 7" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="12" r="3.5" fill="#004E8C" />
        <text x="9" y="14" fill="#FFFFFF" fontSize="6.5" fontWeight="bold" textAnchor="middle">O</text>
      </svg>
    ),
  },
  {
    id: "support",
    title: "Support question",
    icon: (
      <Box
        sx={{
          width: 26,
          height: 26,
          borderRadius: "6px",
          backgroundColor: "#EFF6FF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#2563EB",
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="16" x="2" y="4" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      </Box>
    ),
  },
];

export function EmailIngestStack() {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: { xs: "center", lg: "flex-end" },
        position: "relative",
        width: { xs: "100%", lg: "auto" },
      }}
    >
      {/* Handwritten Top Note "From emails..." */}
      <Box
        sx={{
          position: { xs: "relative", lg: "absolute" },
          top: { lg: -45 },
          left: { lg: 10 },
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          mb: { xs: 1.5, lg: 0 },
          pointerEvents: "none",
        }}
      >
        <Typography
          sx={{
            fontFamily: "var(--font-handwritten), Caveat, cursive",
            fontSize: { xs: "1.25rem", sm: "1.45rem" },
            color: "#64748B",
            fontWeight: 600,
            transform: "rotate(-6deg)",
          }}
        >
          From emails...
        </Typography>
        <Box sx={{ ml: 4, mt: 0.25, color: "#94A3B8" }}>
          <svg width="34" height="28" viewBox="0 0 34 28" fill="none">
            <path
              d="M4 2 C 8 14, 20 22, 30 24"
              stroke="#94A3B8"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="3 3"
            />
            <path
              d="M24 18 L 31 24 L 23 28"
              stroke="#94A3B8"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Box>
      </Box>

      {/* Main Container with 3 Cards + Branching Connector */}
      <Box sx={{ display: "flex", alignItems: "center" }}>
        {/* 3 Email Cards Column */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.75 }}>
          {INGEST_ITEMS.map((item) => (
            <Box
              key={item.id}
              sx={{
                width: { xs: 200, sm: 215 },
                backgroundColor: "#FFFFFF",
                borderRadius: "16px",
                border: "1px solid #EEF2F6",
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.03)",
                p: "14px 16px",
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                transition: "all 200ms ease",
                "&:hover": {
                  transform: "translateX(2px)",
                  boxShadow: "0 6px 20px rgba(0, 0, 0, 0.06)",
                  borderColor: "#E2E8F0",
                },
              }}
            >
              <Box sx={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
                {item.icon}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: "0.8125rem",
                    color: "#0F172A",
                    lineHeight: 1.25,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    mb: 0.75,
                  }}
                >
                  {item.title}
                </Typography>
                {/* Skeleton Preview Bars */}
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                  <Box
                    sx={{
                      width: "80%",
                      height: 4,
                      backgroundColor: "#E2E8F0",
                      borderRadius: "2px",
                    }}
                  />
                  <Box
                    sx={{
                      width: "55%",
                      height: 4,
                      backgroundColor: "#F1F5F9",
                      borderRadius: "2px",
                    }}
                  />
                </Box>
              </Box>
            </Box>
          ))}
        </Box>

        {/* Multi-branch SVG Bracket Connector Converging into Right Arrow (Desktop & Tablet) */}
        <Box
          sx={{
            display: { xs: "none", md: "flex" },
            alignItems: "center",
            width: 46,
            height: 190,
            ml: 1,
          }}
        >
          <svg width="46" height="190" viewBox="0 0 46 190" fill="none">
            {/* Top Branch */}
            <path
              d="M 0 35 C 18 35, 24 95, 34 95"
              stroke="#CBD5E1"
              strokeWidth="1.5"
              fill="none"
              strokeDasharray="4 4"
            />
            {/* Middle Branch */}
            <path
              d="M 0 95 L 34 95"
              stroke="#CBD5E1"
              strokeWidth="1.5"
              fill="none"
              strokeDasharray="4 4"
            />
            {/* Bottom Branch */}
            <path
              d="M 0 155 C 18 155, 24 95, 34 95"
              stroke="#CBD5E1"
              strokeWidth="1.5"
              fill="none"
              strokeDasharray="4 4"
            />
            {/* Outgoing Arrow to Knowledge */}
            <line
              x1="34"
              y1="95"
              x2="42"
              y2="95"
              stroke="#4F46E5"
              strokeWidth="2"
            />
            <path
              d="M 39 90 L 45 95 L 39 100"
              stroke="#4F46E5"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Box>
      </Box>
    </Box>
  );
}
