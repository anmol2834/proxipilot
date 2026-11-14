"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export function InboxHeader() {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography
        variant="h4"
        sx={{
          fontSize: { xs: "24px", sm: "28px" },
          fontWeight: 700,
          color: "#0F172A",
          letterSpacing: "-0.025em",
          lineHeight: 1.2,
          mb: 0.5,
        }}
      >
        Inbox
      </Typography>
      <Typography
        sx={{
          fontSize: { xs: "13.5px", sm: "14.5px" },
          color: "#64748B",
          lineHeight: 1.5,
        }}
      >
        Your emails, powered by AI. Focus on what matters.
      </Typography>
    </Box>
  );
}
