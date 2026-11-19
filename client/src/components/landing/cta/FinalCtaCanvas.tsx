"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { ProxiPilotLogo } from "@/components/ui/ProxiPilotLogo";

export function FinalCtaCanvas() {
  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        maxWidth: 520,
        mx: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* ============================================================ */}
      {/* 1. TOP CARD: Inbox ("Emails, requests, opportunities")       */}
      {/* ============================================================ */}
      <Box sx={{ position: "relative", width: "100%", display: "flex", justifyContent: "center" }}>
        {/* Hand-drawn Cursive Note: "From inbox chaos" */}
        <Box
          sx={{
            position: "absolute",
            left: { xs: 0, sm: 10, md: -20 },
            top: -10,
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            zIndex: 3,
          }}
        >
          <Typography
            sx={{
              fontFamily: "'Caveat', 'Comic Sans MS', cursive, sans-serif",
              fontSize: { xs: "1.1rem", sm: "1.25rem" },
              color: "#94A3B8",
              fontStyle: "italic",
              whiteSpace: "nowrap",
            }}
          >
            From inbox chaos
          </Typography>
          <svg width="28" height="24" viewBox="0 0 28 24" fill="none" style={{ marginTop: 6 }}>
            <path d="M2 4 C 10 4, 18 12, 24 16" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
            <path d="M19 16 L24 16 L23 11" stroke="#94A3B8" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Box>

        {/* The Card */}
        <Box
          sx={{
            width: "100%",
            maxWidth: 360,
            backgroundColor: "rgba(30, 41, 59, 0.85)",
            backdropFilter: "blur(12px)",
            borderRadius: "16px",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.3)",
            p: 2,
            display: "flex",
            alignItems: "center",
            gap: 2,
            zIndex: 2,
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: "12px",
              backgroundColor: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
              p: 1,
            }}
          >
            <Box
              component="img"
              src="/logos/gmail.png"
              alt="Gmail"
              sx={{
                width: 26,
                height: 26,
                objectFit: "contain",
                display: "block",
              }}
            />
          </Box>
          <Box>
            <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: "#FFFFFF", lineHeight: 1.25 }}>
              Inbox
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: "#94A3B8" }}>
              Emails, requests, opportunities
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Connecting Vertical Line 1 */}
      <Box
        sx={{
          width: "2px",
          height: 38,
          borderLeft: "2px dashed rgba(96, 165, 250, 0.4)",
          my: 0.5,
          position: "relative",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            bottom: -3,
            left: -4,
            width: 7,
            height: 7,
            borderBottom: "2px solid #60A5FA",
            borderRight: "2px solid #60A5FA",
            transform: "rotate(45deg)",
          }}
        />
      </Box>

      {/* ============================================================ */}
      {/* 2. CENTER HERO CARD: ProxiPilot ("Understands. Acts...")      */}
      {/* ============================================================ */}
      <Box sx={{ position: "relative", width: "100%", display: "flex", justifyContent: "center" }}>
        {/* Hand-drawn Cursive Note: "To a smarter system" */}
        <Box
          sx={{
            position: "absolute",
            left: { xs: 0, sm: 10, md: -25 },
            top: -6,
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            zIndex: 3,
          }}
        >
          <Typography
            sx={{
              fontFamily: "'Caveat', 'Comic Sans MS', cursive, sans-serif",
              fontSize: { xs: "1.1rem", sm: "1.25rem" },
              color: "#94A3B8",
              fontStyle: "italic",
              whiteSpace: "nowrap",
            }}
          >
            To a smarter system
          </Typography>
          <svg width="28" height="24" viewBox="0 0 28 24" fill="none" style={{ marginTop: 6 }}>
            <path d="M2 4 C 10 4, 18 12, 24 16" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
            <path d="M19 16 L24 16 L23 11" stroke="#94A3B8" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Box>

        {/* The Center Card */}
        <Box
          sx={{
            width: "100%",
            maxWidth: 390,
            backgroundColor: "rgba(30, 48, 80, 0.9)",
            backdropFilter: "blur(16px)",
            borderRadius: "18px",
            border: "1.5px solid #60A5FA",
            boxShadow: "0 0 35px rgba(59, 130, 246, 0.4), inset 0 0 15px rgba(59, 130, 246, 0.15)",
            p: 2.25,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            zIndex: 2,
            position: "relative",
          }}
        >
          <Box sx={{ mb: 0.5 }}>
            <ProxiPilotLogo size={28} textColor="#FFFFFF" textSize="1.15rem" />
          </Box>
          <Typography sx={{ fontSize: "0.78rem", color: "#CBD5E1", letterSpacing: "0.01em" }}>
            Understands. Acts. Keeps you in control.
          </Typography>
        </Box>
      </Box>

      {/* Connecting Vertical Line 2 */}
      <Box
        sx={{
          width: "2px",
          height: 38,
          borderLeft: "2px dashed rgba(96, 165, 250, 0.4)",
          my: 0.5,
          position: "relative",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            bottom: -3,
            left: -4,
            width: 7,
            height: 7,
            borderBottom: "2px solid #60A5FA",
            borderRight: "2px solid #60A5FA",
            transform: "rotate(45deg)",
          }}
        />
      </Box>

      {/* ============================================================ */}
      {/* 3. BOTTOM CARD: Your Business ("More time. More focus...")   */}
      {/* ============================================================ */}
      <Box sx={{ position: "relative", width: "100%", display: "flex", justifyContent: "center" }}>
        {/* Hand-drawn Cursive Note: "To real business impact" */}
        <Box
          sx={{
            position: "absolute",
            left: { xs: 0, sm: 10, md: -25 },
            top: -6,
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            zIndex: 3,
          }}
        >
          <Typography
            sx={{
              fontFamily: "'Caveat', 'Comic Sans MS', cursive, sans-serif",
              fontSize: { xs: "1.1rem", sm: "1.25rem" },
              color: "#94A3B8",
              fontStyle: "italic",
              whiteSpace: "nowrap",
            }}
          >
            To real business impact
          </Typography>
          <svg width="28" height="24" viewBox="0 0 28 24" fill="none" style={{ marginTop: 6 }}>
            <path d="M2 4 C 10 4, 18 12, 24 16" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
            <path d="M19 16 L24 16 L23 11" stroke="#94A3B8" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Box>

        {/* The Card */}
        <Box
          sx={{
            width: "100%",
            maxWidth: 360,
            backgroundColor: "rgba(30, 41, 59, 0.85)",
            backdropFilter: "blur(12px)",
            borderRadius: "16px",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.3)",
            p: 2,
            display: "flex",
            alignItems: "center",
            gap: 2,
            zIndex: 2,
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: "12px",
              backgroundColor: "#EEF2FF",
              color: "#4F46E5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="m19 9-5 5-4-4-3 3" />
            </svg>
          </Box>
          <Box>
            <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: "#FFFFFF", lineHeight: 1.25 }}>
              Your Business
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: "#94A3B8" }}>
              More time. More focus. More growth.
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
