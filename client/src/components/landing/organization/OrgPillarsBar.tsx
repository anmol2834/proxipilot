"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

const ORG_PILLARS = [
  {
    title: "Work together",
    description: "Break down silos between teams with shared intelligence and context.",
    iconColor: "#2563EB",
    iconBg: "#EFF6FF",
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
    title: "Centralized knowledge",
    description: "One single source of truth across product, sales, support, and billing.",
    iconColor: "#4F46E5",
    iconBg: "#EEF2FF",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
      </svg>
    ),
  },
  {
    title: "Controlled access",
    description: "Granular RBAC ensures teams only access the accounts and data they need.",
    iconColor: "#059669",
    iconBg: "#ECFDF5",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    ),
  },
  {
    title: "Better results",
    description: "Faster responses, consistent answers, and measurable operational savings.",
    iconColor: "#7C3AED",
    iconBg: "#F5F3FF",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    ),
  },
];

export function OrgPillarsBar() {
  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 1140,
        mx: "auto",
        mt: { xs: 4, md: 5 },
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
        gap: { xs: 2.5, md: 3 },
      }}
    >
      {ORG_PILLARS.map((pillar, idx) => (
        <Box
          key={idx}
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: { xs: "center", sm: "flex-start" },
            textAlign: { xs: "center", sm: "left" },
            px: 1,
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: "12px",
              backgroundColor: pillar.iconBg,
              color: pillar.iconColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mb: 1.75,
              transition: "transform 180ms ease, box-shadow 180ms ease",
              "&:hover": {
                transform: "translateY(-2px)",
                boxShadow: `0 6px 14px ${pillar.iconColor}22`,
              },
            }}
          >
            {pillar.icon}
          </Box>
          <Typography
            sx={{
              fontSize: "1rem",
              fontWeight: 700,
              color: "#0F172A",
              letterSpacing: "-0.01em",
              mb: 0.75,
            }}
          >
            {pillar.title}
          </Typography>
          <Typography
            sx={{
              fontSize: "0.84rem",
              lineHeight: 1.5,
              color: "#64748B",
            }}
          >
            {pillar.description}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
