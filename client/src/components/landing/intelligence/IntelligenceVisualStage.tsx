"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { EmailIngestStack } from "./EmailIngestStack";
import { IntelligenceConstellation } from "./IntelligenceConstellation";
import { ActionConsoleCard } from "./ActionConsoleCard";

export function IntelligenceVisualStage() {
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
      {/* Soft Ambient Radial Background Glow */}
      <Box
        aria-hidden="true"
        sx={{
          position: "absolute",
          top: "45%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: { xs: "320px", sm: "600px", md: "800px" },
          height: { xs: "320px", sm: "500px", md: "600px" },
          background:
            "radial-gradient(circle, rgba(99, 102, 241, 0.07) 0%, rgba(79, 124, 255, 0.02) 50%, transparent 70%)",
          filter: "blur(60px)",
          borderRadius: "50%",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Main 3-Column Diagram Container */}
      <Box
        sx={{
          position: "relative",
          zIndex: 2,
          width: "100%",
          display: "flex",
          flexDirection: { xs: "column", lg: "row" },
          alignItems: "center",
          justifyContent: "space-between",
          gap: { xs: 4, lg: 1 },
          mb: { xs: 6, sm: 7, md: 8 },
        }}
      >
        {/* 1. Left Ingestion Stack */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            width: { xs: "100%", lg: "auto" },
            flexShrink: 0,
          }}
        >
          <EmailIngestStack />
        </Box>

        {/* 2. Center Constellation Hub */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            width: { xs: "100%", lg: "auto" },
            flex: { lg: "1 1 auto" },
          }}
        >
          <IntelligenceConstellation />
        </Box>

        {/* 3. Right Action Console */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            width: { xs: "100%", lg: "auto" },
            flexShrink: 0,
          }}
        >
          <ActionConsoleCard />
        </Box>
      </Box>

      {/* Bottom Center Pillar: BUILT FOR REAL BUSINESS WORKFLOWS */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: { xs: 2, sm: 3 },
          width: "100%",
          maxWidth: 680,
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
          BUILT FOR REAL BUSINESS WORKFLOWS
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
