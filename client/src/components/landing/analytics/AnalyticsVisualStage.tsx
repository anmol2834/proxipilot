"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { AnalyticsCockpitFrame } from "./AnalyticsCockpitFrame";

export function AnalyticsVisualStage() {
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
      {/* Background Soft Ambient Radial Glow */}
      <Box
        aria-hidden="true"
        sx={{
          position: "absolute",
          top: "45%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: { xs: "320px", sm: "600px", md: "850px" },
          height: { xs: "280px", sm: "450px", md: "550px" },
          background:
            "radial-gradient(ellipse at center, rgba(59, 130, 246, 0.08) 0%, rgba(99, 102, 241, 0.02) 60%, transparent 75%)",
          filter: "blur(60px)",
          borderRadius: "50%",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Analytics Dashboard Cockpit Frame */}
      <Box sx={{ width: "100%", mb: { xs: 6, sm: 7, md: 8 } }}>
        <AnalyticsCockpitFrame />
      </Box>

      {/* Bottom Center Anchor Tagline: TURN EMAIL ACTIVITY INTO BUSINESS GROWTH */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: { xs: 2, sm: 3 },
          width: "100%",
          maxWidth: 680,
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
          TURN EMAIL ACTIVITY INTO BUSINESS GROWTH
        </Typography>
        <Box sx={{ flex: 1, height: "1px", background: "linear-gradient(90deg, #CBD5E1, transparent)" }} />
      </Box>
    </Box>
  );
}
