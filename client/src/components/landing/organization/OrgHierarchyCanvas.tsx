"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export function OrgHierarchyCanvas() {
  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        maxWidth: 1140,
        mx: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* ============================================================ */}
      {/* 1. TOP ROOT: Acme Inc. Organization Card                     */}
      {/* ============================================================ */}
      <Box
        sx={{
          backgroundColor: "#FFFFFF",
          borderRadius: "18px",
          border: "1px solid #EEF2F6",
          boxShadow: "0 6px 20px rgba(0, 0, 0, 0.04)",
          px: { xs: 2.5, sm: 3.5 },
          py: 1.5,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          zIndex: 3,
          position: "relative",
          mb: { xs: 2, lg: 3 },
          transition: "transform 180ms ease",
          "&:hover": { transform: "translateY(-2px)" },
        }}
      >
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: "10px",
            backgroundColor: "#EFF6FF",
            color: "#2563EB",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="16" height="20" x="4" y="2" rx="2" />
            <path d="M9 22v-4h6v4" />
            <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
          </svg>
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: "0.875rem", color: "#0F172A", lineHeight: 1.25 }}>
            Acme Inc.
          </Typography>
          <Typography sx={{ fontSize: "0.71875rem", color: "#64748B", lineHeight: 1.25 }}>
            Your Organization
          </Typography>
        </Box>
      </Box>

      {/* ============================================================ */}
      {/* 2. THREE TEAM WORKSPACES: Sales, Support, Operations         */}
      {/* ============================================================ */}
      <Box
        sx={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
          gap: { xs: 2.5, sm: 3, lg: 3.5 },
          position: "relative",
          zIndex: 2,
          mb: { xs: 3, lg: 4 },
        }}
      >
        {/* Floating Cursive Note Left "Different teams. Same intelligence." */}
        <Box
          sx={{
            position: "absolute",
            top: -35,
            left: -35,
            display: { xs: "none", xl: "flex" },
            flexDirection: "column",
            alignItems: "flex-start",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          <Typography
            sx={{
              fontFamily: "var(--font-handwritten), Caveat, cursive",
              fontSize: "1.4rem",
              color: "#64748B",
              fontWeight: 600,
              transform: "rotate(-10deg)",
            }}
          >
            Different teams.
            <br />
            Same intelligence.
          </Typography>
          <Box sx={{ ml: 4, mt: 0.5, color: "#94A3B8" }}>
            <svg width="34" height="28" viewBox="0 0 34 28" fill="none">
              <path d="M4 2 C 8 14, 20 22, 30 24" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3" />
              <path d="M24 18 L 31 24 L 23 28" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Box>
        </Box>

        {/* Floating Cursive Note Right "Your organization. More productive." */}
        <Box
          sx={{
            position: "absolute",
            top: -35,
            right: -35,
            display: { xs: "none", xl: "flex" },
            flexDirection: "column",
            alignItems: "flex-end",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          <Typography
            sx={{
              fontFamily: "var(--font-handwritten), Caveat, cursive",
              fontSize: "1.4rem",
              color: "#64748B",
              fontWeight: 600,
              transform: "rotate(8deg)",
              textAlign: "right",
            }}
          >
            Your organization.
            <br />
            More productive.
          </Typography>
          <Box sx={{ mr: 4, mt: 0.5, color: "#94A3B8" }}>
            <svg width="34" height="28" viewBox="0 0 34 28" fill="none">
              <path d="M30 2 C 26 14, 14 22, 4 24" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3" />
              <path d="M10 18 L 3 24 L 11 28" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Box>
        </Box>

        {/* TEAM 1: Sales (Blue Tinted) */}
        <Box
          sx={{
            backgroundColor: "#F0F7FF",
            borderRadius: "20px",
            border: "1px solid #DBEAFE",
            p: 2.5,
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
            boxShadow: "0 4px 16px rgba(59, 130, 246, 0.04)",
            position: "relative",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: "8px",
                backgroundColor: "#DBEAFE",
                color: "#2563EB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: "0.875rem", color: "#0F172A", lineHeight: 1.2 }}>
                Sales
              </Typography>
              <Typography sx={{ fontSize: "0.71875rem", color: "#64748B", lineHeight: 1.2 }}>
                Leads, demos, and deals
              </Typography>
            </Box>
          </Box>

          {/* Inner Card */}
          <Box sx={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #EEF2F6", p: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.25 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "#64748B" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#1E293B" }}>
                  Team inbox
                </Typography>
              </Box>
              <Box sx={{ backgroundColor: "#DBEAFE", color: "#2563EB", fontWeight: 700, fontSize: "0.6875rem", px: 0.9, py: 0.15, borderRadius: "9999px" }}>
                28
              </Box>
            </Box>

            {/* Avatars */}
            <Box sx={{ display: "flex", alignItems: "center", pl: 0.5 }}>
              {["#FEE2E2", "#DBEAFE", "#EDE9FE"].map((bg, i) => (
                <Box
                  key={i}
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    backgroundColor: bg,
                    border: "2px solid #FFFFFF",
                    ml: i === 0 ? 0 : -0.75,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    color: "#475569",
                  }}
                >
                  {["AK", "SP", "RW"][i]}
                </Box>
              ))}
            </Box>
          </Box>

          {/* Bottom Connector Dot */}
          <Box sx={{ display: "flex", justifyContent: "center", mt: 0.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#2563EB" }} />
          </Box>
        </Box>

        {/* TEAM 2: Support (Green Tinted) */}
        <Box
          sx={{
            backgroundColor: "#F0FDF4",
            borderRadius: "20px",
            border: "1px solid #DCFCE7",
            p: 2.5,
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
            boxShadow: "0 4px 16px rgba(16, 185, 129, 0.04)",
            position: "relative",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: "8px",
                backgroundColor: "#DCFCE7",
                color: "#16A34A",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
              </svg>
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: "0.875rem", color: "#0F172A", lineHeight: 1.2 }}>
                Support
              </Typography>
              <Typography sx={{ fontSize: "0.71875rem", color: "#64748B", lineHeight: 1.2 }}>
                Customers and issues
              </Typography>
            </Box>
          </Box>

          {/* Inner Card */}
          <Box sx={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #EEF2F6", p: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.25 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "#64748B" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#1E293B" }}>
                  Team inbox
                </Typography>
              </Box>
              <Box sx={{ backgroundColor: "#DCFCE7", color: "#16A34A", fontWeight: 700, fontSize: "0.6875rem", px: 0.9, py: 0.15, borderRadius: "9999px" }}>
                42
              </Box>
            </Box>

            {/* Avatars */}
            <Box sx={{ display: "flex", alignItems: "center", pl: 0.5 }}>
              {["#DCFCE7", "#FEF3C7", "#EFF6FF"].map((bg, i) => (
                <Box
                  key={i}
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    backgroundColor: bg,
                    border: "2px solid #FFFFFF",
                    ml: i === 0 ? 0 : -0.75,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    color: "#475569",
                  }}
                >
                  {["SL", "JS", "TM"][i]}
                </Box>
              ))}
            </Box>
          </Box>

          {/* Bottom Connector Dot */}
          <Box sx={{ display: "flex", justifyContent: "center", mt: 0.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#10B981" }} />
          </Box>
        </Box>

        {/* TEAM 3: Operations (Amber Tinted) */}
        <Box
          sx={{
            backgroundColor: "#FFFBEB",
            borderRadius: "20px",
            border: "1px solid #FEF3C7",
            p: 2.5,
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
            boxShadow: "0 4px 16px rgba(245, 158, 11, 0.04)",
            position: "relative",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: "8px",
                backgroundColor: "#FEF3C7",
                color: "#D97706",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: "0.875rem", color: "#0F172A", lineHeight: 1.2 }}>
                Operations
              </Typography>
              <Typography sx={{ fontSize: "0.71875rem", color: "#64748B", lineHeight: 1.2 }}>
                Internal requests
              </Typography>
            </Box>
          </Box>

          {/* Inner Card */}
          <Box sx={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #EEF2F6", p: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.25 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "#64748B" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#1E293B" }}>
                  Team inbox
                </Typography>
              </Box>
              <Box sx={{ backgroundColor: "#EFF6FF", color: "#2563EB", fontWeight: 700, fontSize: "0.6875rem", px: 0.9, py: 0.15, borderRadius: "9999px" }}>
                16
              </Box>
            </Box>

            {/* Avatars */}
            <Box sx={{ display: "flex", alignItems: "center", pl: 0.5 }}>
              {["#F1F5F9", "#DBEAFE", "#FEE2E2"].map((bg, i) => (
                <Box
                  key={i}
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    backgroundColor: bg,
                    border: "2px solid #FFFFFF",
                    ml: i === 0 ? 0 : -0.75,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    color: "#475569",
                  }}
                >
                  {["AS", "TV", "ED"][i]}
                </Box>
              ))}
            </Box>
          </Box>

          {/* Bottom Connector Dot */}
          <Box sx={{ display: "flex", justifyContent: "center", mt: 0.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#F59E0B" }} />
          </Box>
        </Box>
      </Box>

      {/* ============================================================ */}
      {/* 3. SHARED INTELLIGENCE LAYER: Hub + Flanking Satellite Cards  */}
      {/* ============================================================ */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: { xs: 2, sm: 3, md: 4 },
          flexWrap: { xs: "wrap", md: "nowrap" },
          width: "100%",
          position: "relative",
          zIndex: 2,
        }}
      >
        {/* Left Flanking Card: Shared knowledge */}
        <Box
          sx={{
            backgroundColor: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #EEF2F6",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.03)",
            p: "14px 18px",
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            width: { xs: 200, sm: 220 },
          }}
        >
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: "8px",
              backgroundColor: "#EFF6FF",
              color: "#2563EB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M3 5V19A9 3 0 0 0 21 19V5" />
              <path d="M3 12A9 3 0 0 0 21 12" />
            </svg>
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: "0.8125rem", color: "#0F172A", lineHeight: 1.25 }}>
              Shared knowledge
            </Typography>
            <Typography sx={{ fontSize: "0.71875rem", color: "#64748B", lineHeight: 1.25 }}>
              Always up to date
            </Typography>
          </Box>
        </Box>

        {/* Dashed arrow pointing into Hub */}
        <Box sx={{ color: "#6366F1", display: { xs: "none", md: "block" } }}>
          <svg width="34" height="12" viewBox="0 0 34 12" fill="none">
            <line x1="0" y1="6" x2="26" y2="6" stroke="#6366F1" strokeWidth="1.75" strokeDasharray="3 3" />
            <path d="M24 2L30 6L24 10" stroke="#6366F1" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Box>

        {/* Center Hub: ProxiPilot Shared Intelligence Layer */}
        <Box
          sx={{
            width: { xs: "100%", sm: 340, md: 360 },
            background: "linear-gradient(135deg, #FFFFFF 0%, #EEF2FF 100%)",
            borderRadius: "24px",
            border: "1.5px solid rgba(99, 102, 241, 0.25)",
            boxShadow:
              "0 15px 35px -5px rgba(99, 102, 241, 0.15), 0 0 0 8px rgba(238, 242, 255, 0.6)",
            p: 2.5,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 0.5 }}>
            <Box
              component="img"
              src="/Proxipilot logo.svg"
              alt="ProxiPilot"
              sx={{
                width: 30,
                height: 30,
                objectFit: "contain",
                display: "block",
              }}
            />
            <Typography sx={{ fontWeight: 800, fontSize: "1.35rem", color: "#0F172A", letterSpacing: "-0.02em" }}>
              ProxiPilot
            </Typography>
          </Box>
          <Typography sx={{ fontSize: "0.8125rem", color: "#64748B", fontWeight: 500 }}>
            Shared Intelligence Layer
          </Typography>
        </Box>

        {/* Dashed arrow pointing into Hub from right */}
        <Box sx={{ color: "#6366F1", display: { xs: "none", md: "block" } }}>
          <svg width="34" height="12" viewBox="0 0 34 12" fill="none">
            <line x1="34" y1="6" x2="8" y2="6" stroke="#6366F1" strokeWidth="1.75" strokeDasharray="3 3" />
            <path d="M10 2L4 6L10 10" stroke="#6366F1" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Box>

        {/* Right Flanking Card: Consistent responses */}
        <Box
          sx={{
            backgroundColor: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #EEF2F6",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.03)",
            p: "14px 18px",
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            width: { xs: 200, sm: 220 },
          }}
        >
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: "8px",
              backgroundColor: "#F5F3FF",
              color: "#7C3AED",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: "0.8125rem", color: "#0F172A", lineHeight: 1.25 }}>
              Consistent responses
            </Typography>
            <Typography sx={{ fontSize: "0.71875rem", color: "#64748B", lineHeight: 1.25 }}>
              Across every team
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
