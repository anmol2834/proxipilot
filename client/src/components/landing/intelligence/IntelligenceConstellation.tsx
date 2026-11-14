"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export function IntelligenceConstellation() {
  return (
    <Box
      sx={{
        position: "relative",
        width: { xs: "100%", md: 580, lg: 620 },
        height: { xs: 680, sm: 660, lg: 640 },
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        mx: "auto",
      }}
    >
      {/* 1. Background Concentric Orbit Rings & Dashed Tracks */}
      <Box
        aria-hidden="true"
        sx={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="100%" height="100%" viewBox="0 0 620 640" fill="none">
          {/* Inner Orbit Track */}
          <ellipse
            cx="310"
            cy="310"
            rx="190"
            ry="190"
            stroke="#E2E8F0"
            strokeWidth="1.5"
            strokeDasharray="5 5"
          />
          {/* Outer Orbit Track */}
          <ellipse
            cx="310"
            cy="310"
            rx="265"
            ry="255"
            stroke="#EEF2F6"
            strokeWidth="1.5"
            strokeDasharray="6 6"
          />
        </svg>
      </Box>

      {/* 2. Central Hub Card: ProxiPilot Intelligence Layer */}
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: { xs: 155, sm: 175 },
          height: { xs: 130, sm: 145 },
          background: "linear-gradient(135deg, #FFFFFF 0%, #F5F7FF 100%)",
          borderRadius: "24px",
          border: "1.5px solid rgba(99, 102, 241, 0.22)",
          boxShadow:
            "0 15px 35px -5px rgba(99, 102, 241, 0.15), 0 0 0 8px rgba(238, 242, 255, 0.6)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
          zIndex: 3,
          textAlign: "center",
          transition: "transform 200ms ease",
          "&:hover": {
            transform: "translate(-50%, -50%) scale(1.02)",
          },
        }}
      >
        {/* ProxiPilot Logo Emblem */}
        <Box sx={{ width: 34, height: 34, mb: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="11" cy="16" r="6" fill="#3B82F6" fillOpacity="0.9" />
            <circle cx="21" cy="16" r="6" fill="#635BFF" fillOpacity="0.9" />
            <path d="M16 11.5C17.5 12.8 18.5 14.3 18.5 16C18.5 17.7 17.5 19.2 16 20.5C14.5 19.2 13.5 17.7 13.5 16C13.5 14.3 14.5 12.8 16 11.5Z" fill="#4F46E5" />
            <circle cx="16" cy="10" r="3.5" fill="#4F7CFF" />
          </svg>
        </Box>
        <Typography
          sx={{
            fontWeight: 800,
            fontSize: "1.1875rem",
            color: "#0F172A",
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
          }}
        >
          ProxiPilot
        </Typography>
        <Typography
          sx={{
            fontSize: "0.75rem",
            color: "#64748B",
            fontWeight: 500,
            mt: 0.5,
          }}
        >
          Intelligence Layer
        </Typography>
      </Box>

      {/* 3. The 4 Cardinal Anchor Cards */}

      {/* CARDINAL TOP: Intent */}
      <Box
        sx={{
          position: "absolute",
          top: { xs: 8, sm: 20 },
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          zIndex: 4,
        }}
      >
        <Box
          sx={{
            backgroundColor: "#FFFFFF",
            borderRadius: "18px",
            border: "1px solid #EEF2F6",
            boxShadow: "0 6px 20px rgba(0, 0, 0, 0.04)",
            p: "12px 18px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            width: { xs: 150, sm: 165 },
          }}
        >
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              backgroundColor: "#EFF6FF",
              color: "#3B82F6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mb: 1,
            }}
          >
            {/* Bullseye / Target Icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
            </svg>
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: "0.84375rem", color: "#0F172A", mb: 0.35 }}>
            Intent
          </Typography>
          <Typography sx={{ fontSize: "0.6875rem", color: "#64748B", lineHeight: 1.3 }}>
            Understand what this email is about.
          </Typography>
        </Box>

        {/* Bidirectional Arrow ↕ connecting to Hub */}
        <Box sx={{ mt: 1, color: "#6366F1" }}>
          <svg width="12" height="28" viewBox="0 0 12 28" fill="none">
            <path d="M6 3L2 8M6 3L10 8" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="6" y1="4" x2="6" y2="24" stroke="#6366F1" strokeWidth="2" />
            <path d="M6 25L2 20M6 25L10 20" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Box>
      </Box>

      {/* CARDINAL LEFT: Knowledge */}
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: { xs: -5, sm: 15, md: 25 },
          transform: "translateY(-50%)",
          display: "flex",
          alignItems: "center",
          zIndex: 4,
        }}
      >
        <Box
          sx={{
            backgroundColor: "#FFFFFF",
            borderRadius: "18px",
            border: "1px solid #EEF2F6",
            boxShadow: "0 6px 20px rgba(0, 0, 0, 0.04)",
            p: "12px 18px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            width: { xs: 145, sm: 160 },
          }}
        >
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              backgroundColor: "#ECFDF5",
              color: "#10B981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mb: 1,
            }}
          >
            {/* Book Icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: "0.84375rem", color: "#0F172A", mb: 0.35 }}>
            Knowledge
          </Typography>
          <Typography sx={{ fontSize: "0.6875rem", color: "#64748B", lineHeight: 1.3 }}>
            Use your company data and documents.
          </Typography>
        </Box>

        {/* Dashed Arrow pointing into Hub */}
        <Box sx={{ ml: 1, color: "#6366F1", display: { xs: "none", sm: "block" } }}>
          <svg width="26" height="12" viewBox="0 0 26 12" fill="none">
            <line x1="2" y1="6" x2="20" y2="6" stroke="#6366F1" strokeWidth="1.75" strokeDasharray="3 3" />
            <path d="M18 2L24 6L18 10" stroke="#6366F1" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Box>
      </Box>

      {/* CARDINAL RIGHT: Context */}
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          right: { xs: -5, sm: 15, md: 25 },
          transform: "translateY(-50%)",
          display: "flex",
          alignItems: "center",
          zIndex: 4,
        }}
      >
        {/* Dashed Arrow pointing from Hub to Context */}
        <Box sx={{ mr: 1, color: "#6366F1", display: { xs: "none", sm: "block" } }}>
          <svg width="26" height="12" viewBox="0 0 26 12" fill="none">
            <line x1="2" y1="6" x2="20" y2="6" stroke="#6366F1" strokeWidth="1.75" strokeDasharray="3 3" />
            <path d="M18 2L24 6L18 10" stroke="#6366F1" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Box>

        <Box
          sx={{
            backgroundColor: "#FFFFFF",
            borderRadius: "18px",
            border: "1px solid #EEF2F6",
            boxShadow: "0 6px 20px rgba(0, 0, 0, 0.04)",
            p: "12px 18px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            width: { xs: 145, sm: 160 },
          }}
        >
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              backgroundColor: "#F5F3FF",
              color: "#8B5CF6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mb: 1,
            }}
          >
            {/* Database Stack Cylinder */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M3 5V19A9 3 0 0 0 21 19V5" />
              <path d="M3 12A9 3 0 0 0 21 12" />
            </svg>
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: "0.84375rem", color: "#0F172A", mb: 0.35 }}>
            Context
          </Typography>
          <Typography sx={{ fontSize: "0.6875rem", color: "#64748B", lineHeight: 1.3 }}>
            Customer, history, accounts, and more.
          </Typography>
        </Box>
      </Box>

      {/* CARDINAL BOTTOM: Requirements */}
      <Box
        sx={{
          position: "absolute",
          bottom: { xs: 75, sm: 90 },
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          zIndex: 4,
        }}
      >
        {/* Bidirectional Arrow ↕ connecting to Hub */}
        <Box sx={{ mb: 1, color: "#6366F1" }}>
          <svg width="12" height="28" viewBox="0 0 12 28" fill="none">
            <path d="M6 3L2 8M6 3L10 8" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="6" y1="4" x2="6" y2="24" stroke="#6366F1" strokeWidth="2" />
            <path d="M6 25L2 20M6 25L10 20" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Box>

        <Box
          sx={{
            backgroundColor: "#FFFFFF",
            borderRadius: "18px",
            border: "1px solid #EEF2F6",
            boxShadow: "0 6px 20px rgba(0, 0, 0, 0.04)",
            p: "12px 18px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            width: { xs: 150, sm: 165 },
          }}
        >
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              backgroundColor: "#FFF7ED",
              color: "#EA580C",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mb: 1,
            }}
          >
            {/* Document Sheet Icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="8" y1="13" x2="16" y2="13" />
              <line x1="8" y1="17" x2="12" y2="17" />
            </svg>
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: "0.84375rem", color: "#0F172A", mb: 0.35 }}>
            Requirements
          </Typography>
          <Typography sx={{ fontSize: "0.6875rem", color: "#64748B", lineHeight: 1.3 }}>
            Extract key details and structured data.
          </Typography>
        </Box>
      </Box>

      {/* 4. The 4 Diagonal Orbital Satellite Nodes */}

      {/* SATELLITE 1: Evidence (Top-Left) */}
      <Box
        sx={{
          position: "absolute",
          top: { xs: 75, sm: 85 },
          left: { xs: 15, sm: 55, md: 75 },
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          zIndex: 3,
        }}
      >
        <Box sx={{ textAlign: "right" }}>
          <Typography sx={{ fontWeight: 700, fontSize: "0.78125rem", color: "#0F172A" }}>
            Evidence
          </Typography>
          <Typography sx={{ fontSize: "0.65625rem", color: "#64748B", whiteSpace: "pre-line", lineHeight: 1.2 }}>
            Find relevant{"\n"}information.
          </Typography>
        </Box>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            backgroundColor: "#EFF6FF",
            border: "1px solid #DBEAFE",
            color: "#2563EB",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(37, 99, 235, 0.12)",
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </Box>
      </Box>

      {/* SATELLITE 2: Validation (Top-Right) */}
      <Box
        sx={{
          position: "absolute",
          top: { xs: 75, sm: 85 },
          right: { xs: 15, sm: 55, md: 75 },
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          zIndex: 3,
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            backgroundColor: "#ECFDF5",
            border: "1px solid #D1FAE5",
            color: "#10B981",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(16, 185, 129, 0.12)",
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <polyline points="9 12 11 14 15 10" />
          </svg>
        </Box>
        <Box sx={{ textAlign: "left" }}>
          <Typography sx={{ fontWeight: 700, fontSize: "0.78125rem", color: "#0F172A" }}>
            Validation
          </Typography>
          <Typography sx={{ fontSize: "0.65625rem", color: "#64748B", whiteSpace: "pre-line", lineHeight: 1.2 }}>
            Verify accuracy{"\n"}and reliability.
          </Typography>
        </Box>
      </Box>

      {/* SATELLITE 3: Confidence (Bottom-Left) */}
      <Box
        sx={{
          position: "absolute",
          bottom: { xs: 190, sm: 185 },
          left: { xs: 15, sm: 55, md: 70 },
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          zIndex: 3,
        }}
      >
        <Box sx={{ textAlign: "right" }}>
          <Typography sx={{ fontWeight: 700, fontSize: "0.78125rem", color: "#0F172A" }}>
            Confidence
          </Typography>
          <Typography sx={{ fontSize: "0.65625rem", color: "#64748B", whiteSpace: "pre-line", lineHeight: 1.2 }}>
            Know when{"\n"}to act.
          </Typography>
        </Box>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            backgroundColor: "#F5F3FF",
            border: "1px solid #EDE9FE",
            color: "#8B5CF6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(139, 92, 246, 0.12)",
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20v-6M6 20V10M18 20V4" />
          </svg>
        </Box>
      </Box>

      {/* SATELLITE 4: Policy (Bottom-Right) */}
      <Box
        sx={{
          position: "absolute",
          bottom: { xs: 190, sm: 185 },
          right: { xs: 15, sm: 55, md: 70 },
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          zIndex: 3,
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            backgroundColor: "#FFF1F2",
            border: "1px solid #FFE4E6",
            color: "#EF4444",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(239, 68, 68, 0.12)",
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Box>
        <Box sx={{ textAlign: "left" }}>
          <Typography sx={{ fontWeight: 700, fontSize: "0.78125rem", color: "#0F172A" }}>
            Policy
          </Typography>
          <Typography sx={{ fontSize: "0.65625rem", color: "#64748B", whiteSpace: "pre-line", lineHeight: 1.2 }}>
            Follow your{"\n"}business rules.
          </Typography>
        </Box>
      </Box>

      {/* 5. Sub-Node at Bottom: Human Review */}
      <Box
        sx={{
          position: "absolute",
          bottom: 12,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          zIndex: 4,
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            backgroundColor: "#EFF6FF",
            border: "1px solid #DBEAFE",
            color: "#2563EB",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(37, 99, 235, 0.1)",
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: "0.78125rem", color: "#0F172A", lineHeight: 1.2 }}>
            Human review
          </Typography>
          <Typography sx={{ fontSize: "0.6875rem", color: "#64748B", lineHeight: 1.2 }}>
            Keep your team in control.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
