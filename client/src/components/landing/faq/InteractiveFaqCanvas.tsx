"use client";

import React, { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ButtonBase from "@mui/material/ButtonBase";
import { landingConfig } from "@/config/landing";

export function InteractiveFaqCanvas() {
  const { questions } = landingConfig.sections.faq;
  const [activeIndex, setActiveIndex] = useState(0);

  const currentQ = questions[activeIndex] || questions[0];

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 1200,
        mx: "auto",
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "4.8fr 7.2fr" },
        gap: { xs: 3, md: 3.5 },
        alignItems: "start",
      }}
    >
      {/* ============================================================ */}
      {/* LEFT COLUMN: Question Buttons List                           */}
      {/* ============================================================ */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
        }}
      >
        {questions.map((item, idx) => {
          const isActive = idx === activeIndex;

          return (
            <ButtonBase
              key={idx}
              onClick={() => setActiveIndex(idx)}
              sx={{
                width: "100%",
                textAlign: "left",
                justifyContent: "space-between",
                backgroundColor: isActive ? "#EFF6FF" : "#FFFFFF",
                border: isActive ? "1px solid #BFDBFE" : "1px solid #EEF2F6",
                borderRadius: "16px",
                p: { xs: 2, sm: 2.25 },
                position: "relative",
                overflow: "hidden",
                boxShadow: isActive
                  ? "0 4px 16px rgba(37, 99, 235, 0.08)"
                  : "0 2px 8px rgba(0, 0, 0, 0.02)",
                transition: "all 180ms ease",
                "&:hover": {
                  backgroundColor: isActive ? "#EFF6FF" : "#F8FAFC",
                  borderColor: isActive ? "#BFDBFE" : "#CBD5E1",
                },
              }}
            >
              {/* Left Active Indicator Strip */}
              {isActive && (
                <Box
                  sx={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 4,
                    backgroundColor: "#2563EB",
                    borderRadius: "4px 0 0 4px",
                  }}
                />
              )}

              <Typography
                sx={{
                  fontWeight: isActive ? 700 : 600,
                  fontSize: { xs: "0.9rem", sm: "0.95rem" },
                  color: isActive ? "#1D4ED8" : "#1E293B",
                  lineHeight: 1.4,
                  pr: 2,
                  pl: isActive ? 0.75 : 0,
                }}
              >
                {item.q}
              </Typography>

              {/* Right Chevron Arrow */}
              <Box
                sx={{
                  flexShrink: 0,
                  color: isActive ? "#2563EB" : "#94A3B8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "transform 180ms ease",
                  transform: isActive ? "translateX(2px)" : "none",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Box>
            </ButtonBase>
          );
        })}
      </Box>

      {/* ============================================================ */}
      {/* RIGHT COLUMN: Interactive Answer Card + Graphic Mockup       */}
      {/* ============================================================ */}
      <Box
        sx={{
          backgroundColor: "#FFFFFF",
          borderRadius: "24px",
          border: "1px solid #EEF2F6",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.04)",
          p: { xs: 3, sm: 4, md: 4.5 },
          display: "flex",
          flexDirection: "column",
          gap: 3.5,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Top Text Header */}
        <Box>
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: "0.75rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#64748B",
              mb: 1.25,
            }}
          >
            ANSWER
          </Typography>
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: { xs: "1.25rem", sm: "1.5rem" },
              letterSpacing: "-0.02em",
              color: "#0F172A",
              lineHeight: 1.3,
              mb: 2,
            }}
          >
            {currentQ.q}
          </Typography>
          <Typography
            sx={{
              fontSize: { xs: "0.9375rem", sm: "1rem" },
              lineHeight: 1.65,
              color: "#475569",
            }}
          >
            {currentQ.a}
          </Typography>
        </Box>

        {/* Visual Mockup Stage (Email Card & "You're in control" Badge) */}
        <Box
          sx={{
            position: "relative",
            p: { xs: 2, sm: 2.5 },
            backgroundColor: "#F8FAFC",
            borderRadius: "18px",
            border: "1px solid #E2E8F0",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {/* Top Row: "You're in control" Pill Badge */}
          <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                px: 1.5,
                py: 0.5,
                backgroundColor: "#ECFDF5",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                borderRadius: "9999px",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#059669" }}>
                You&apos;re in control
              </Typography>
            </Box>
          </Box>

          {/* Email Preview Card */}
          <Box
            sx={{
              position: "relative",
              maxWidth: 420,
              mx: "auto",
              width: "100%",
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              border: "1px solid #E2E8F0",
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.05)",
              p: 2.5,
            }}
          >
            {/* Gmail Logo Header */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
              <Box
                component="img"
                src="/logos/gmail.png"
                alt="Gmail"
                sx={{
                  width: 22,
                  height: 22,
                  objectFit: "contain",
                  display: "block",
                }}
              />
              <Typography sx={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E293B" }}>
                Gmail Workspace
              </Typography>
            </Box>

            {/* Skeleton Email Content */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, mb: 2.5 }}>
              <Box sx={{ height: 10, width: "65%", backgroundColor: "#E2E8F0", borderRadius: "6px" }} />
              <Box sx={{ height: 8, width: "95%", backgroundColor: "#F1F5F9", borderRadius: "6px" }} />
              <Box sx={{ height: 8, width: "80%", backgroundColor: "#F1F5F9", borderRadius: "6px" }} />
            </Box>

            {/* Send Button */}
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 1,
                  px: 2.25,
                  py: 0.9,
                  backgroundColor: "#2563EB",
                  color: "#FFFFFF",
                  borderRadius: "10px",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  boxShadow: "0 2px 8px rgba(37, 99, 235, 0.35)",
                  cursor: "pointer",
                  transition: "background-color 150ms ease",
                  "&:hover": { backgroundColor: "#1D4ED8" },
                }}
              >
                Send
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Bottom 3 Mode Cards */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
            gap: 2,
            pt: 1,
          }}
        >
          {/* 1. Draft mode */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              p: 1.5,
              borderRadius: "14px",
              backgroundColor: "#F8FAFC",
              border: "1px solid #EEF2F6",
            }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: "10px",
                backgroundColor: "#EFF6FF",
                color: "#2563EB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </Box>
            <Box>
              <Typography sx={{ fontSize: "0.85rem", fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }}>
                Draft mode
              </Typography>
              <Typography sx={{ fontSize: "0.75rem", color: "#64748B" }}>
                Review before sending
              </Typography>
            </Box>
          </Box>

          {/* 2. Approval mode */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              p: 1.5,
              borderRadius: "14px",
              backgroundColor: "#F8FAFC",
              border: "1px solid #EEF2F6",
            }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: "10px",
                backgroundColor: "#ECFDF5",
                color: "#059669",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <polyline points="16 11 18 13 22 9" />
              </svg>
            </Box>
            <Box>
              <Typography sx={{ fontSize: "0.85rem", fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }}>
                Approval mode
              </Typography>
              <Typography sx={{ fontSize: "0.75rem", color: "#64748B" }}>
                Requires team approval
              </Typography>
            </Box>
          </Box>

          {/* 3. Automated mode */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              p: 1.5,
              borderRadius: "14px",
              backgroundColor: "#F8FAFC",
              border: "1px solid #EEF2F6",
            }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: "10px",
                backgroundColor: "#F5F3FF",
                color: "#7C3AED",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </Box>
            <Box>
              <Typography sx={{ fontSize: "0.85rem", fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }}>
                Automated mode
              </Typography>
              <Typography sx={{ fontSize: "0.75rem", color: "#64748B" }}>
                Sends based on your rules
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
