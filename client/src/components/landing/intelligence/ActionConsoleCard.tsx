"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export function ActionConsoleCard() {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: { xs: "center", lg: "flex-start" },
        position: "relative",
        width: { xs: "100%", lg: "auto" },
      }}
    >
      {/* Handwritten Note "...to the right action." */}
      <Box
        sx={{
          position: { xs: "relative", lg: "absolute" },
          top: { lg: -45 },
          right: { lg: 10 },
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
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
            transform: "rotate(4deg)",
          }}
        >
          ...to the right action.
        </Typography>
        <Box sx={{ mr: 4, mt: 0.25, color: "#94A3B8" }}>
          <svg width="34" height="28" viewBox="0 0 34 28" fill="none">
            <path
              d="M30 2 C 26 14, 14 22, 4 24"
              stroke="#94A3B8"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="3 3"
            />
            <path
              d="M10 18 L 3 24 L 11 28"
              stroke="#94A3B8"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Box>
      </Box>

      {/* Main Action Console Card with Entry Ingress Arrow */}
      <Box sx={{ display: "flex", alignItems: "center" }}>
        {/* Left Ingress Arrow (Desktop & Tablet) */}
        <Box
          sx={{
            display: { xs: "none", md: "flex" },
            alignItems: "center",
            width: 38,
            mr: 1,
            color: "#4F46E5",
          }}
        >
          <svg width="38" height="14" viewBox="0 0 38 14" fill="none">
            <line x1="0" y1="7" x2="30" y2="7" stroke="#4F46E5" strokeWidth="1.75" strokeDasharray="4 4" />
            <path d="M28 2L35 7L28 12" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Box>

        {/* Action Card Container */}
        <Box
          sx={{
            width: { xs: 215, sm: 230 },
            backgroundColor: "#FFFFFF",
            borderRadius: "20px",
            border: "1px solid #EEF2F6",
            boxShadow: "0 6px 24px rgba(0, 0, 0, 0.04)",
            p: { xs: 2, sm: 2.25 },
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
            transition: "all 200ms ease",
            "&:hover": {
              transform: "translateY(-2px)",
              boxShadow: "0 8px 28px rgba(0, 0, 0, 0.06)",
              borderColor: "#E2E8F0",
            },
          }}
        >
          {/* Card Header: Checkmark + Response Ready */}
          <Box sx={{ pb: 1, borderBottom: "1px solid #F1F5F9" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1 }}>
              <Box
                sx={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  backgroundColor: "#10B981",
                  color: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </Box>
              <Typography sx={{ fontWeight: 700, fontSize: "0.875rem", color: "#0F172A" }}>
                Response ready
              </Typography>
            </Box>

            {/* Skeleton Preview Bars */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, pl: 0.25 }}>
              <Box sx={{ width: "95%", height: 4, backgroundColor: "#E2E8F0", borderRadius: "2px" }} />
              <Box sx={{ width: "65%", height: 4, backgroundColor: "#F1F5F9", borderRadius: "2px" }} />
            </Box>
          </Box>

          {/* Action Triggers List */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {/* 1. Send automatically */}
            <Box
              component="button"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                p: "9px 12px",
                borderRadius: "10px",
                backgroundColor: "#FFFFFF",
                border: "1px solid #EEF2F6",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 150ms ease",
                "&:hover": {
                  backgroundColor: "#F8FAFC",
                  borderColor: "#CBD5E1",
                },
              }}
            >
              <Box sx={{ color: "#4F46E5", display: "flex", alignItems: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </Box>
              <Typography sx={{ fontWeight: 600, fontSize: "0.78125rem", color: "#334155" }}>
                Send automatically
              </Typography>
            </Box>

            {/* 2. Assign to team */}
            <Box
              component="button"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                p: "9px 12px",
                borderRadius: "10px",
                backgroundColor: "#FFFFFF",
                border: "1px solid #EEF2F6",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 150ms ease",
                "&:hover": {
                  backgroundColor: "#F8FAFC",
                  borderColor: "#CBD5E1",
                },
              }}
            >
              <Box sx={{ color: "#4F46E5", display: "flex", alignItems: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </Box>
              <Typography sx={{ fontWeight: 600, fontSize: "0.78125rem", color: "#334155" }}>
                Assign to team
              </Typography>
            </Box>

            {/* 3. Schedule */}
            <Box
              component="button"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                p: "9px 12px",
                borderRadius: "10px",
                backgroundColor: "#FFFFFF",
                border: "1px solid #EEF2F6",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 150ms ease",
                "&:hover": {
                  backgroundColor: "#F8FAFC",
                  borderColor: "#CBD5E1",
                },
              }}
            >
              <Box sx={{ color: "#4F46E5", display: "flex", alignItems: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </Box>
              <Typography sx={{ fontWeight: 600, fontSize: "0.78125rem", color: "#334155" }}>
                Schedule
              </Typography>
            </Box>

            {/* 4. More actions */}
            <Box
              component="button"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                p: "9px 12px",
                borderRadius: "10px",
                backgroundColor: "#FFFFFF",
                border: "1px solid #EEF2F6",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 150ms ease",
                "&:hover": {
                  backgroundColor: "#F8FAFC",
                  borderColor: "#CBD5E1",
                },
              }}
            >
              <Box sx={{ color: "#64748B", display: "flex", alignItems: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="19" cy="12" r="1" />
                  <circle cx="5" cy="12" r="1" />
                </svg>
              </Box>
              <Typography sx={{ fontWeight: 600, fontSize: "0.78125rem", color: "#64748B" }}>
                More actions
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
