"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

const PILLARS = [
  {
    id: "org",
    title: "Designed for organizations",
    subtitle: "Built to scale across teams and departments.",
    iconBg: "#F5F3FF",
    iconColor: "#8B5CF6",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: "control",
    title: "Built around human control",
    subtitle: "You stay in charge. Always.",
    iconBg: "#ECFDF5",
    iconColor: "#10B981",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    ),
  },
  {
    id: "evidence",
    title: "Built around evidence",
    subtitle: "Every response is grounded in real data.",
    iconBg: "#F5F3FF",
    iconColor: "#8B5CF6",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    id: "context",
    title: "Built around business context",
    subtitle: "Understands your company, not just the email.",
    iconBg: "#EFF6FF",
    iconColor: "#2563EB",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5V19A9 3 0 0 0 21 19V5" />
        <path d="M3 12A9 3 0 0 0 21 12" />
      </svg>
    ),
  },
];

export function SocialPillarsGrid() {
  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 1180,
        mx: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* 4 Pillar Cards Grid */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(4, 1fr)" },
          gap: { xs: 2, sm: 2.5 },
          width: "100%",
          mb: { xs: 6, sm: 7, md: 8 },
        }}
      >
        {PILLARS.map((pillar) => (
          <Box
            key={pillar.id}
            sx={{
              backgroundColor: "#FFFFFF",
              borderRadius: "18px",
              border: "1px solid #EEF2F6",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.03)",
              p: { xs: 2.5, sm: 3 },
              display: "flex",
              flexDirection: "column",
              gap: 1.5,
              transition: "all 200ms ease",
              "&:hover": {
                transform: "translateY(-2px)",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.06)",
                borderColor: "#E2E8F0",
              },
            }}
          >
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: "10px",
                backgroundColor: pillar.iconBg,
                color: pillar.iconColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {pillar.icon}
            </Box>
            <Box>
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: "0.875rem",
                  color: "#0F172A",
                  mb: 0.35,
                  lineHeight: 1.3,
                }}
              >
                {pillar.title}
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.78125rem",
                  color: "#64748B",
                  lineHeight: 1.45,
                }}
              >
                {pillar.subtitle}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      {/* Bottom Center Anchor Tagline */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: { xs: 2, sm: 3 },
          width: "100%",
          maxWidth: 640,
          mx: "auto",
        }}
      >
        <Box sx={{ flex: 1, height: "1px", background: "linear-gradient(90deg, transparent, #CBD5E1)" }} />
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: { xs: "0.6875rem", sm: "0.75rem" },
            letterSpacing: "0.12em",
            color: "#64748B",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          TRUSTED INTELLIGENCE. REAL IMPACT.
        </Typography>
        <Box sx={{ flex: 1, height: "1px", background: "linear-gradient(90deg, #CBD5E1, transparent)" }} />
      </Box>
    </Box>
  );
}
