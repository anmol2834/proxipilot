"use client";

import React from "react";
import Box from "@mui/material/Box";
import { ProblemMetricsColumn } from "./ProblemMetricsColumn";
import { BeforeInboxCard } from "./BeforeInboxCard";
import { PipelineBridge } from "./PipelineBridge";
import { AfterInboxCard } from "./AfterInboxCard";
import { OutcomePillsColumn } from "./OutcomePillsColumn";

export function ProblemVisualComparison() {
  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        maxWidth: 1280,
        mx: "auto",
        pt: { xs: 2, sm: 3, md: 4 },
        pb: { xs: 4, sm: 5, md: 6 },
      }}
    >
      {/* Ambient Glows */}
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
        {/* Soft Red Ambient on the Left */}
        <Box
          sx={{
            position: "absolute",
            top: "40%",
            left: "15%",
            transform: "translate(-50%, -50%)",
            width: { xs: "260px", md: "460px" },
            height: { xs: "260px", md: "460px" },
            background:
              "radial-gradient(circle, rgba(239, 68, 68, 0.07) 0%, rgba(239, 68, 68, 0.01) 60%, transparent 75%)",
            filter: "blur(60px)",
            borderRadius: "50%",
          }}
        />

        {/* Soft Green Ambient on the Right */}
        <Box
          sx={{
            position: "absolute",
            top: "40%",
            right: "5%",
            transform: "translate(-50%, -50%)",
            width: { xs: "260px", md: "460px" },
            height: { xs: "260px", md: "460px" },
            background:
              "radial-gradient(circle, rgba(16, 185, 129, 0.07) 0%, rgba(16, 185, 129, 0.01) 60%, transparent 75%)",
            filter: "blur(60px)",
            borderRadius: "50%",
          }}
        />
      </Box>

      {/* Main 5-Column Visual Container */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", lg: "row" },
          alignItems: { xs: "center", lg: "flex-start" },
          justifyContent: "center",
          gap: { xs: 3.5, sm: 4, lg: 2, xl: 3 },
          position: "relative",
          zIndex: 2,
          width: "100%",
        }}
      >
        {/* 1. Left Metrics Column */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            width: { xs: "100%", lg: "auto" },
            pt: { lg: 3 },
          }}
        >
          <ProblemMetricsColumn />
        </Box>

        {/* 2. Before ProxiPilot Inbox Card */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            width: { xs: "100%", lg: "auto" },
            flex: { lg: "1 1 0" },
            maxWidth: { lg: 420 },
          }}
        >
          <BeforeInboxCard />
        </Box>

        {/* 3. Central Transformation Pipeline Bridge */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            alignSelf: { lg: "center" },
            width: { xs: "100%", lg: "auto" },
            my: { xs: 1, lg: 0 },
            mb: { lg: 8 },
          }}
        >
          <PipelineBridge />
        </Box>

        {/* 4. After ProxiPilot Inbox Card */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            width: { xs: "100%", lg: "auto" },
            flex: { lg: "1 1 0" },
            maxWidth: { lg: 420 },
          }}
        >
          <AfterInboxCard />
        </Box>

        {/* 5. Right Outcome Pills Column */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            width: { xs: "100%", lg: "auto" },
            pt: { lg: 4 },
          }}
        >
          <OutcomePillsColumn />
        </Box>
      </Box>
    </Box>
  );
}
