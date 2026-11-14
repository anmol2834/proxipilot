"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { PricingPlanCards } from "./PricingPlanCards";

export function PricingVisualStage() {
  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <PricingPlanCards />

      {/* Decorative Bottom Impact Label */}
      <Box
        sx={{
          mt: { xs: 6, md: 8 },
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          width: "100%",
          maxWidth: 600,
        }}
      >
        <Box sx={{ flex: 1, height: "1px", backgroundColor: "#E2E8F0" }} />
        <Typography
          sx={{
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: "#64748B",
            textTransform: "uppercase",
          }}
        >
          A PLAN TODAY. A MORE PRODUCTIVE TOMORROW.
        </Typography>
        <Box sx={{ flex: 1, height: "1px", backgroundColor: "#E2E8F0" }} />
      </Box>
    </Box>
  );
}
