"use client";

import React, { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export function AnalyticsCockpitFrame() {
  const [activeNav, setActiveNav] = useState<string>("analytics");

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 1140,
        mx: "auto",
        backgroundColor: "#FFFFFF",
        borderRadius: { xs: "16px", sm: "24px" },
        border: "1px solid #E2E8F0",
        boxShadow:
          "0 25px 60px -15px rgba(15, 23, 42, 0.08), 0 10px 30px -10px rgba(0, 0, 0, 0.04)",
        overflow: "hidden",
        position: "relative",
        zIndex: 2,
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        minHeight: 620,
      }}
    >
      {/* 1. Left Sidebar Navigation */}
      <Box
        sx={{
          width: { xs: "100%", md: 195, lg: 210 },
          backgroundColor: "#FAFAFA",
          borderRight: "1px solid #EEF2F6",
          p: 2.25,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <Box>
          {/* Brand Logo */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 3, px: 0.5 }}>
            <Box sx={{ width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
                <circle cx="11" cy="16" r="6" fill="#3B82F6" fillOpacity="0.9" />
                <circle cx="21" cy="16" r="6" fill="#635BFF" fillOpacity="0.9" />
                <path d="M16 11.5C17.5 12.8 18.5 14.3 18.5 16C18.5 17.7 17.5 19.2 16 20.5C14.5 19.2 13.5 17.7 13.5 16C13.5 14.3 14.5 12.8 16 11.5Z" fill="#4F46E5" />
                <circle cx="16" cy="10" r="3.5" fill="#4F7CFF" />
              </svg>
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: "1.0625rem", color: "#0F172A", letterSpacing: "-0.02em" }}>
              ProxiPilot
            </Typography>
          </Box>

          {/* Navigation Links */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            {[
              {
                id: "inbox",
                label: "Inbox",
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                ),
              },
              {
                id: "automation",
                label: "Automation",
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                ),
              },
              {
                id: "knowledge",
                label: "Knowledge",
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                  </svg>
                ),
              },
              {
                id: "analytics",
                label: "Analytics",
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3v18h18" />
                    <path d="m19 9-5 5-4-4-3 3" />
                  </svg>
                ),
              },
            ].map((item) => {
              const isActive = activeNav === item.id;
              return (
                <Box
                  key={item.id}
                  component="button"
                  onClick={() => setActiveNav(item.id)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.25,
                    px: 1.5,
                    py: 1,
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: isActive ? "#EFF6FF" : "transparent",
                    color: isActive ? "#2563EB" : "#64748B",
                    fontWeight: isActive ? 700 : 500,
                    fontSize: "0.8125rem",
                    cursor: "pointer",
                    width: "100%",
                    textAlign: "left",
                    transition: "all 150ms ease",
                    "&:hover": { backgroundColor: isActive ? "#EFF6FF" : "#F1F5F9" },
                  }}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Bottom Settings & Profile */}
        <Box sx={{ pt: 2 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              px: 1.5,
              py: 0.85,
              color: "#64748B",
              fontSize: "0.8125rem",
              fontWeight: 500,
              cursor: "pointer",
              borderRadius: "8px",
              mb: 1.5,
              "&:hover": { backgroundColor: "#F1F5F9", color: "#0F172A" },
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>Settings</span>
          </Box>

          {/* Tenant Avatar Switcher */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              p: 1,
              borderRadius: "10px",
              backgroundColor: "#FFFFFF",
              border: "1px solid #E2E8F0",
              cursor: "pointer",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  backgroundColor: "#DBEAFE",
                  color: "#2563EB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                }}
              >
                A
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: "0.75rem", color: "#0F172A", lineHeight: 1.2 }}>
                  Acme Inc.
                </Typography>
                <Typography sx={{ fontSize: "0.6875rem", color: "#64748B", lineHeight: 1.2 }}>
                  Enterprise Plan
                </Typography>
              </Box>
            </Box>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </Box>
        </Box>
      </Box>

      {/* 2. Main Analytics Canvas Body */}
      <Box
        sx={{
          flex: 1,
          p: { xs: 2, sm: 3, md: 3.5 },
          display: "flex",
          flexDirection: "column",
          gap: 2.5,
          minWidth: 0,
        }}
      >
        {/* Header Row: Title & Date Range Picker */}
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: { xs: "flex-start", sm: "center" },
            justifyContent: "space-between",
            gap: 1.5,
          }}
        >
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: "1.375rem", color: "#0F172A", letterSpacing: "-0.02em" }}>
              Analytics
            </Typography>
            <Typography sx={{ fontSize: "0.8125rem", color: "#64748B" }}>
              Your email operations at a glance.
            </Typography>
          </Box>

          {/* Date Picker Button */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              backgroundColor: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "8px",
              px: 1.75,
              py: 0.75,
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
              cursor: "pointer",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <Typography sx={{ fontWeight: 500, fontSize: "0.78125rem", color: "#334155" }}>
              Sep 1, 2025 – Sep 30, 2025
            </Typography>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </Box>
        </Box>

        {/* Top 4 KPI Metrics Grid */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr 1fr", lg: "repeat(4, 1fr)" },
            gap: 2,
          }}
        >
          {/* Card 1: Emails processed */}
          <Box sx={{ backgroundColor: "#FFFFFF", borderRadius: "14px", border: "1px solid #EEF2F6", p: 2, boxShadow: "0 2px 10px rgba(0, 0, 0, 0.02)" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <Box sx={{ width: 26, height: 26, borderRadius: "6px", backgroundColor: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </Box>
              <Typography sx={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 500 }}>
                Emails processed
              </Typography>
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: "1.45rem", color: "#0F172A", lineHeight: 1.15, mb: 0.5 }}>
              24,821
            </Typography>
            <Typography sx={{ fontSize: "0.71875rem", color: "#10B981", fontWeight: 600 }}>
              ↑ 12% <Box component="span" sx={{ color: "#94A3B8", fontWeight: 400 }}>vs last month</Box>
            </Typography>
          </Box>

          {/* Card 2: AI handled */}
          <Box sx={{ backgroundColor: "#FFFFFF", borderRadius: "14px", border: "1px solid #EEF2F6", p: 2, boxShadow: "0 2px 10px rgba(0, 0, 0, 0.02)" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <Box sx={{ width: 26, height: 26, borderRadius: "6px", backgroundColor: "#EFF6FF", color: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </Box>
              <Typography sx={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 500 }}>
                AI handled
              </Typography>
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: "1.45rem", color: "#0F172A", lineHeight: 1.15, mb: 0.5 }}>
              82%
            </Typography>
            <Typography sx={{ fontSize: "0.71875rem", color: "#10B981", fontWeight: 600 }}>
              ↑ 6% <Box component="span" sx={{ color: "#94A3B8", fontWeight: 400 }}>vs last month</Box>
            </Typography>
          </Box>

          {/* Card 3: Human reviewed */}
          <Box sx={{ backgroundColor: "#FFFFFF", borderRadius: "14px", border: "1px solid #EEF2F6", p: 2, boxShadow: "0 2px 10px rgba(0, 0, 0, 0.02)" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <Box sx={{ width: 26, height: 26, borderRadius: "6px", backgroundColor: "#FFF1F2", color: "#EF4444", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </Box>
              <Typography sx={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 500 }}>
                Human reviewed
              </Typography>
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: "1.45rem", color: "#0F172A", lineHeight: 1.15, mb: 0.5 }}>
              18%
            </Typography>
            <Typography sx={{ fontSize: "0.71875rem", color: "#EF4444", fontWeight: 600 }}>
              ↓ 4% <Box component="span" sx={{ color: "#94A3B8", fontWeight: 400 }}>vs last month</Box>
            </Typography>
          </Box>

          {/* Card 4: Avg response time */}
          <Box sx={{ backgroundColor: "#FFFFFF", borderRadius: "14px", border: "1px solid #EEF2F6", p: 2, boxShadow: "0 2px 10px rgba(0, 0, 0, 0.02)" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <Box sx={{ width: 26, height: 26, borderRadius: "6px", backgroundColor: "#F5F3FF", color: "#8B5CF6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </Box>
              <Typography sx={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 500 }}>
                Avg response time
              </Typography>
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: "1.45rem", color: "#0F172A", lineHeight: 1.15, mb: 0.5 }}>
              8m
            </Typography>
            <Typography sx={{ fontSize: "0.71875rem", color: "#10B981", fontWeight: 600 }}>
              ↓ 37% <Box component="span" sx={{ color: "#94A3B8", fontWeight: 400 }}>vs last month</Box>
            </Typography>
          </Box>
        </Box>

        {/* Main Chart Row + Top Intents Card */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "1.85fr 1fr" },
            gap: 2,
            alignItems: "stretch",
          }}
        >
          {/* Left Chart Container: Response Time */}
          <Box
            sx={{
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              border: "1px solid #EEF2F6",
              p: 2.5,
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 2px 10px rgba(0, 0, 0, 0.02)",
            }}
          >
            {/* Chart Header */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0F172A" }}>
                  Response Time
                </Typography>
                <Typography sx={{ fontSize: "0.75rem", color: "#64748B" }}>
                  Average time from email received to response
                </Typography>
              </Box>

              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  backgroundColor: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: "6px",
                  px: 1.25,
                  py: 0.5,
                  fontSize: "0.71875rem",
                  color: "#475569",
                  cursor: "pointer",
                }}
              >
                <span>Average response time</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </Box>
            </Box>

            {/* SVG Area Chart Graphic */}
            <Box sx={{ position: "relative", width: "100%", height: 210, mt: 1 }}>
              <svg width="100%" height="100%" viewBox="0 0 520 200" preserveAspectRatio="none" fill="none">
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid lines */}
                {[30, 60, 90, 120, 150, 180].map((y, i) => (
                  <line key={i} x1="35" y1={y} x2="510" y2={y} stroke="#F1F5F9" strokeWidth="1" />
                ))}

                {/* Y-axis Labels */}
                <text x="5" y="34" fill="#94A3B8" fontSize="10" fontFamily="inherit">24m</text>
                <text x="5" y="64" fill="#94A3B8" fontSize="10" fontFamily="inherit">20m</text>
                <text x="5" y="94" fill="#94A3B8" fontSize="10" fontFamily="inherit">16m</text>
                <text x="5" y="124" fill="#94A3B8" fontSize="10" fontFamily="inherit">12m</text>
                <text x="10" y="154" fill="#94A3B8" fontSize="10" fontFamily="inherit">8m</text>
                <text x="10" y="184" fill="#94A3B8" fontSize="10" fontFamily="inherit">4m</text>

                {/* The Filled Area */}
                <path
                  d="M 35 60 C 60 55, 80 50, 100 70 C 120 90, 130 65, 150 78 C 180 95, 200 120, 240 135 C 280 150, 300 135, 330 148 C 360 160, 380 150, 410 140 C 440 155, 470 140, 500 150 L 500 185 L 35 185 Z"
                  fill="url(#chartGradient)"
                />

                {/* The Curve Line */}
                <path
                  d="M 35 60 C 60 55, 80 50, 100 70 C 120 90, 130 65, 150 78 C 180 95, 200 120, 240 135 C 280 150, 300 135, 330 148 C 360 160, 380 150, 410 140 C 440 155, 470 140, 500 150"
                  stroke="#3B82F6"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Endpoint Circle Marker */}
                <circle cx="475" cy="143" r="5" fill="#3B82F6" stroke="#FFFFFF" strokeWidth="2" />
              </svg>

              {/* Tooltip Card pointing to the Sep 30 point */}
              <Box
                sx={{
                  position: "absolute",
                  top: 95,
                  right: 40,
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: "8px",
                  boxShadow: "0 4px 14px rgba(0, 0, 0, 0.08)",
                  p: "6px 12px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <Typography sx={{ fontWeight: 800, fontSize: "0.8125rem", color: "#0F172A" }}>
                  8m
                </Typography>
                <Typography sx={{ fontSize: "0.6875rem", color: "#10B981", fontWeight: 600 }}>
                  ↓ 60% vs last month
                </Typography>
              </Box>

              {/* X-axis Date Labels */}
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  pl: "35px",
                  pr: "10px",
                  mt: 0.5,
                  color: "#94A3B8",
                  fontSize: "0.6875rem",
                }}
              >
                <span>Sep 1</span>
                <span>Sep 5</span>
                <span>Sep 10</span>
                <span>Sep 15</span>
                <span>Sep 20</span>
                <span>Sep 25</span>
                <span>Sep 30</span>
              </Box>
            </Box>
          </Box>

          {/* Right Container: Top intents */}
          <Box
            sx={{
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              border: "1px solid #EEF2F6",
              p: 2.5,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 2px 10px rgba(0, 0, 0, 0.02)",
            }}
          >
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0F172A", mb: 0.25 }}>
                Top intents
              </Typography>
              <Typography sx={{ fontSize: "0.75rem", color: "#64748B", mb: 2.5 }}>
                Most common email intents detected
              </Typography>

              {/* 4 Intent Progress Bars */}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.75 }}>
                {[
                  {
                    name: "Pricing",
                    percent: 32,
                    color: "#3B82F6",
                    icon: (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
                        <path d="M7 7h.01" />
                      </svg>
                    ),
                  },
                  {
                    name: "Support",
                    percent: 26,
                    color: "#8B5CF6",
                    icon: (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                      </svg>
                    ),
                  },
                  {
                    name: "Sales",
                    percent: 21,
                    color: "#10B981",
                    icon: (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 20V10M12 20V4M6 20v-6" />
                      </svg>
                    ),
                  },
                  {
                    name: "Other",
                    percent: 21,
                    color: "#94A3B8",
                    icon: (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="19" cy="12" r="1" />
                        <circle cx="5" cy="12" r="1" />
                      </svg>
                    ),
                  },
                ].map((intent) => (
                  <Box key={intent.name} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Box sx={{ width: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {intent.icon}
                    </Box>
                    <Typography sx={{ width: 55, fontSize: "0.78125rem", color: "#1E293B", fontWeight: 600 }}>
                      {intent.name}
                    </Typography>
                    {/* Progress Bar Track */}
                    <Box sx={{ flex: 1, height: 8, backgroundColor: "#F1F5F9", borderRadius: "9999px", overflow: "hidden" }}>
                      <Box sx={{ width: `${intent.percent}%`, height: "100%", backgroundColor: intent.color, borderRadius: "9999px" }} />
                    </Box>
                    <Typography sx={{ width: 30, textAlign: "right", fontSize: "0.75rem", color: "#64748B", fontWeight: 600 }}>
                      {intent.percent}%
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Bottom Link: View all intents */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                pt: 2,
                borderTop: "1px solid #F1F5F9",
                color: "#64748B",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                "&:hover": { color: "#2563EB" },
              }}
            >
              <span>View all intents</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
