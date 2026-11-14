"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { IncomingTriggerCard } from "./IncomingTriggerCard";
import { DualPathDecisionCanvas } from "./DualPathDecisionCanvas";

export function ControlVisualStage() {
  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        maxWidth: 1240,
        mx: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Ambient Background Glows */}
      <Box
        aria-hidden="true"
        sx={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          overflow: "hidden",
        }}
      >
        {/* Soft Mint Glow on the Left (Handled by AI) */}
        <Box
          sx={{
            position: "absolute",
            top: "55%",
            left: "20%",
            transform: "translate(-50%, -50%)",
            width: { xs: "280px", md: "460px" },
            height: { xs: "280px", md: "460px" },
            background:
              "radial-gradient(circle, rgba(16, 185, 129, 0.07) 0%, rgba(16, 185, 129, 0.01) 60%, transparent 75%)",
            filter: "blur(60px)",
            borderRadius: "50%",
          }}
        />

        {/* Soft Amber Glow on the Right (Handled by your team) */}
        <Box
          sx={{
            position: "absolute",
            top: "55%",
            right: "10%",
            transform: "translate(-50%, -50%)",
            width: { xs: "280px", md: "460px" },
            height: { xs: "280px", md: "460px" },
            background:
              "radial-gradient(circle, rgba(245, 158, 11, 0.07) 0%, rgba(245, 158, 11, 0.01) 60%, transparent 75%)",
            filter: "blur(60px)",
            borderRadius: "50%",
          }}
        />
      </Box>

      {/* 1. Top Incoming Email Trigger Card */}
      <IncomingTriggerCard />

      {/* 2. Dual-Path Decision Tree Canvas */}
      <Box sx={{ width: "100%", mb: { xs: 6, sm: 7, md: 8 } }}>
        <DualPathDecisionCanvas />
      </Box>

      {/* 3. Bottom Center Pillar: THE RIGHT RESPONSE. EVERY TIME. */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: { xs: 2, sm: 3 },
          width: "100%",
          maxWidth: 640,
          mx: "auto",
          pt: 1,
        }}
      >
        {/* Left Divider Line */}
        <Box
          sx={{
            flex: 1,
            height: "1px",
            background: "linear-gradient(90deg, transparent, #CBD5E1)",
          }}
        />

        {/* Center Tagline */}
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
          THE RIGHT RESPONSE. EVERY TIME.
        </Typography>

        {/* Right Divider Line */}
        <Box
          sx={{
            flex: 1,
            height: "1px",
            background: "linear-gradient(90deg, #CBD5E1, transparent)",
          }}
        />
      </Box>
    </Box>
  );
}
