"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export function DualPathDecisionCanvas() {
  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        maxWidth: 1120,
        mx: "auto",
        display: "flex",
        flexDirection: { xs: "column", lg: "row" },
        alignItems: { xs: "center", lg: "flex-start" },
        justifyContent: "center",
        gap: { xs: 4, lg: 3 },
      }}
    >
      {/* ============================================================ */}
      {/* LEFT COLUMN: Handled by AI (Green / Routine Automation Path) */}
      {/* ============================================================ */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
          width: { xs: "100%", sm: 330, md: 340 },
          zIndex: 2,
        }}
      >
        {/* Handwritten Note "Let AI handle the routine." */}
        <Box
          sx={{
            position: { xs: "relative", lg: "absolute" },
            top: { lg: -45 },
            left: { lg: -35 },
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
              transform: "rotate(-8deg)",
            }}
          >
            Let AI handle
            <br />
            the routine.
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

        {/* Step 1: High confidence Pill */}
        <Box
          sx={{
            width: "100%",
            backgroundColor: "#ECFDF5",
            borderRadius: "16px",
            border: "1px solid #D1FAE5",
            p: "12px 18px",
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            boxShadow: "0 4px 14px rgba(16, 185, 129, 0.06)",
          }}
        >
          <Box
            sx={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              backgroundColor: "rgba(16, 185, 129, 0.15)",
              color: "#10B981",
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
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: "0.8125rem", color: "#0F172A", lineHeight: 1.25 }}>
              High confidence
            </Typography>
            <Typography sx={{ fontSize: "0.71875rem", color: "#64748B", lineHeight: 1.25 }}>
              Clear intent, verified context
            </Typography>
          </Box>
        </Box>

        {/* Connector Downward Arrow */}
        <Box sx={{ my: 1, color: "#6366F1" }}>
          <svg width="10" height="22" viewBox="0 0 10 22" fill="none">
            <line x1="5" y1="0" x2="5" y2="16" stroke="#6366F1" strokeWidth="1.5" />
            <path d="M1 13L5 19L9 13" stroke="#6366F1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Box>

        {/* Step 2: Generate response Card */}
        <Box
          sx={{
            width: "100%",
            backgroundColor: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #EEF2F6",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.03)",
            p: "14px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            transition: "all 180ms ease",
            "&:hover": {
              transform: "translateY(-1px)",
              boxShadow: "0 6px 20px rgba(0, 0, 0, 0.05)",
            },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: "8px",
                backgroundColor: "#EFF6FF",
                color: "#2563EB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <line x1="10" y1="9" x2="8" y2="9" />
              </svg>
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: "0.8125rem", color: "#0F172A", lineHeight: 1.25 }}>
                Generate response
              </Typography>
              <Typography sx={{ fontSize: "0.71875rem", color: "#64748B", lineHeight: 1.25 }}>
                Create accurate, on-brand reply
              </Typography>
            </Box>
          </Box>
          <Box
            sx={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              backgroundColor: "#10B981",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </Box>
        </Box>

        {/* Connector Downward Arrow */}
        <Box sx={{ my: 1, color: "#6366F1" }}>
          <svg width="10" height="22" viewBox="0 0 10 22" fill="none">
            <line x1="5" y1="0" x2="5" y2="16" stroke="#6366F1" strokeWidth="1.5" />
            <path d="M1 13L5 19L9 13" stroke="#6366F1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Box>

        {/* Step 3: Send automatically Card */}
        <Box
          sx={{
            width: "100%",
            backgroundColor: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #EEF2F6",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.03)",
            p: "14px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            transition: "all 180ms ease",
            "&:hover": {
              transform: "translateY(-1px)",
              boxShadow: "0 6px 20px rgba(0, 0, 0, 0.05)",
            },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: "8px",
                backgroundColor: "#EFF6FF",
                color: "#2563EB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: "0.8125rem", color: "#0F172A", lineHeight: 1.25 }}>
                Send automatically
              </Typography>
              <Typography sx={{ fontSize: "0.71875rem", color: "#64748B", lineHeight: 1.25 }}>
                Response sent to customer
              </Typography>
            </Box>
          </Box>
          <Box
            sx={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              backgroundColor: "#10B981",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </Box>
        </Box>

        {/* Connector Downward Arrow */}
        <Box sx={{ my: 1, color: "#6366F1" }}>
          <svg width="10" height="22" viewBox="0 0 10 22" fill="none">
            <line x1="5" y1="0" x2="5" y2="16" stroke="#6366F1" strokeWidth="1.5" />
            <path d="M1 13L5 19L9 13" stroke="#6366F1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Box>

        {/* Step 4: Final Outcome Pill: Handled by AI */}
        <Box
          sx={{
            width: "100%",
            backgroundColor: "#ECFDF5",
            borderRadius: "9999px",
            border: "1px solid #D1FAE5",
            p: "10px 18px",
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            boxShadow: "0 6px 18px rgba(16, 185, 129, 0.08)",
          }}
        >
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              backgroundColor: "#10B981",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: "0.875rem", color: "#065F46", lineHeight: 1.25 }}>
              Handled by AI
            </Typography>
            <Typography sx={{ fontSize: "0.71875rem", color: "#047857", fontWeight: 500, lineHeight: 1.25 }}>
              Fast. Accurate. Reliable.
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* ============================================================ */}
      {/* CENTER ENGINE: ProxiPilot Decision Hub                       */}
      {/* ============================================================ */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
          width: { xs: "100%", lg: 220 },
          mt: { xs: 1, lg: 5 },
          zIndex: 3,
        }}
      >
        {/* SVG Curved Branching Lines (Desktop & Tablet) */}
        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            top: -20,
            left: "50%",
            transform: "translateX(-50%)",
            width: 440,
            height: 90,
            pointerEvents: "none",
            display: { xs: "none", lg: "block" },
          }}
        >
          <svg width="440" height="90" viewBox="0 0 440 90" fill="none">
            {/* Left Curve to High Confidence */}
            <path
              d="M 170 55 C 130 55, 60 55, 10 20"
              stroke="#6366F1"
              strokeWidth="1.75"
              strokeDasharray="4 4"
            />
            {/* Right Curve to Uncertain */}
            <path
              d="M 270 55 C 310 55, 380 55, 430 20"
              stroke="#F59E0B"
              strokeWidth="1.75"
              strokeDasharray="4 4"
            />
          </svg>
        </Box>

        {/* Central ProxiPilot Hub Card */}
        <Box
          sx={{
            width: { xs: 155, sm: 170 },
            height: { xs: 135, sm: 145 },
            background: "linear-gradient(135deg, #FFFFFF 0%, #EEF2FF 100%)",
            borderRadius: "24px",
            border: "1.5px solid rgba(99, 102, 241, 0.25)",
            boxShadow:
              "0 15px 35px -5px rgba(99, 102, 241, 0.15), 0 0 0 8px rgba(238, 242, 255, 0.6)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            p: 2,
            textAlign: "center",
            transition: "transform 200ms ease",
            "&:hover": {
              transform: "scale(1.02)",
            },
          }}
        >
          {/* Logo */}
          <Box sx={{ width: 34, height: 34, mb: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Box
              component="img"
              src="/Proxipilot logo.svg"
              alt="ProxiPilot"
              sx={{
                width: 32,
                height: 32,
                objectFit: "contain",
                display: "block",
              }}
            />
          </Box>
          <Typography sx={{ fontWeight: 800, fontSize: "1.125rem", color: "#0F172A", letterSpacing: "-0.02em" }}>
            ProxiPilot
          </Typography>
          <Typography sx={{ fontSize: "0.71875rem", color: "#64748B", fontWeight: 500, mt: 0.35 }}>
            AI understands
            <br />
            the email
          </Typography>
        </Box>
      </Box>

      {/* ============================================================ */}
      {/* RIGHT COLUMN: Handled by your team (Amber / Human Oversight) */}
      {/* ============================================================ */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
          width: { xs: "100%", sm: 330, md: 340 },
          zIndex: 2,
        }}
      >
        {/* Handwritten Note "Your team stays in control." */}
        <Box
          sx={{
            position: { xs: "relative", lg: "absolute" },
            top: { lg: -45 },
            right: { lg: -35 },
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
              transform: "rotate(6deg)",
              textAlign: "right",
            }}
          >
            Your team
            <br />
            stays in control.
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

        {/* Step 1: Uncertain Pill */}
        <Box
          sx={{
            width: "100%",
            backgroundColor: "#FFFBEB",
            borderRadius: "16px",
            border: "1px solid #FEF3C7",
            p: "12px 18px",
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            boxShadow: "0 4px 14px rgba(245, 158, 11, 0.06)",
          }}
        >
          <Box
            sx={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              backgroundColor: "rgba(245, 158, 11, 0.15)",
              color: "#D97706",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: "0.8125rem", color: "#0F172A", lineHeight: 1.25 }}>
              Uncertain
            </Typography>
            <Typography sx={{ fontSize: "0.71875rem", color: "#64748B", lineHeight: 1.25 }}>
              Sensitive, complex or low confidence
            </Typography>
          </Box>
        </Box>

        {/* Connector Downward Arrow */}
        <Box sx={{ my: 1, color: "#6366F1" }}>
          <svg width="10" height="22" viewBox="0 0 10 22" fill="none">
            <line x1="5" y1="0" x2="5" y2="16" stroke="#6366F1" strokeWidth="1.5" />
            <path d="M1 13L5 19L9 13" stroke="#6366F1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Box>

        {/* Step 2: Route to human Card */}
        <Box
          sx={{
            width: "100%",
            backgroundColor: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #EEF2F6",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.03)",
            p: "14px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            transition: "all 180ms ease",
            "&:hover": {
              transform: "translateY(-1px)",
              boxShadow: "0 6px 20px rgba(0, 0, 0, 0.05)",
            },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: "8px",
                backgroundColor: "#EFF6FF",
                color: "#2563EB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: "0.8125rem", color: "#0F172A", lineHeight: 1.25 }}>
                Route to human
              </Typography>
              <Typography sx={{ fontSize: "0.71875rem", color: "#64748B", lineHeight: 1.25 }}>
                Notify the right team member
              </Typography>
            </Box>
          </Box>
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              backgroundColor: "#F59E0B",
              flexShrink: 0,
            }}
          />
        </Box>

        {/* Connector Downward Arrow */}
        <Box sx={{ my: 1, color: "#6366F1" }}>
          <svg width="10" height="22" viewBox="0 0 10 22" fill="none">
            <line x1="5" y1="0" x2="5" y2="16" stroke="#6366F1" strokeWidth="1.5" />
            <path d="M1 13L5 19L9 13" stroke="#6366F1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Box>

        {/* Step 3: Assign to team Card */}
        <Box
          sx={{
            width: "100%",
            backgroundColor: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #EEF2F6",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.03)",
            p: "14px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            transition: "all 180ms ease",
            "&:hover": {
              transform: "translateY(-1px)",
              boxShadow: "0 6px 20px rgba(0, 0, 0, 0.05)",
            },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                backgroundColor: "#F1F5F9",
                color: "#475569",
                fontWeight: 700,
                fontSize: "0.75rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              AS
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: "0.8125rem", color: "#0F172A", lineHeight: 1.25 }}>
                Assign to team
              </Typography>
              <Typography sx={{ fontSize: "0.71875rem", color: "#64748B", lineHeight: 1.25 }}>
                Assigned to Anmol Sinha
              </Typography>
            </Box>
          </Box>
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              backgroundColor: "#F59E0B",
              flexShrink: 0,
            }}
          />
        </Box>

        {/* Connector Downward Arrow */}
        <Box sx={{ my: 1, color: "#6366F1" }}>
          <svg width="10" height="22" viewBox="0 0 10 22" fill="none">
            <line x1="5" y1="0" x2="5" y2="16" stroke="#6366F1" strokeWidth="1.5" />
            <path d="M1 13L5 19L9 13" stroke="#6366F1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Box>

        {/* Step 4: Final Outcome Pill: Handled by your team */}
        <Box
          sx={{
            width: "100%",
            backgroundColor: "#FFF7ED",
            borderRadius: "9999px",
            border: "1px solid #FFEDD5",
            p: "10px 18px",
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            boxShadow: "0 6px 18px rgba(234, 88, 12, 0.08)",
          }}
        >
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              backgroundColor: "rgba(234, 88, 12, 0.15)",
              color: "#EA580C",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: "0.875rem", color: "#9A3412", lineHeight: 1.25 }}>
              Handled by your team
            </Typography>
            <Typography sx={{ fontSize: "0.71875rem", color: "#C2410C", fontWeight: 500, lineHeight: 1.25 }}>
              Full control. Better decisions.
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
