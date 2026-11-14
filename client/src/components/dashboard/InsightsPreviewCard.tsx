"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";

export function InsightsPreviewCard() {
  return (
    <Paper
      elevation={0}
      sx={{
        backgroundColor: "#FFFFFF",
        borderRadius: "18px",
        border: "1px solid #EEF2F6",
        p: { xs: 2.5, sm: 3 },
        display: "flex",
        alignItems: "center",
        gap: { xs: 2, sm: 3 },
        boxShadow: "0 4px 20px rgba(15, 23, 42, 0.03)",
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Soft Column Chart Visual */}
      <Box
        sx={{
          width: 110,
          height: 90,
          borderRadius: "14px",
          backgroundColor: "#F8FAFC",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 1,
          p: 1.5,
          flexShrink: 0,
        }}
      >
        <Box sx={{ width: 10, height: "45%", borderRadius: "5px", backgroundColor: "#DBEAFE" }} />
        <Box sx={{ width: 10, height: "75%", borderRadius: "5px", backgroundColor: "#93C5FD" }} />
        <Box sx={{ width: 10, height: "100%", borderRadius: "5px", backgroundColor: "#60A5FA" }} />
        <Box sx={{ width: 10, height: "60%", borderRadius: "5px", backgroundColor: "#93C5FD" }} />
        <Box sx={{ width: 10, height: "30%", borderRadius: "5px", backgroundColor: "#DBEAFE" }} />
      </Box>

      {/* Text Copy */}
      <Box>
        <Typography
          sx={{
            fontWeight: 800,
            fontSize: "1.05rem",
            color: "#0F172A",
            lineHeight: 1.3,
            letterSpacing: "-0.015em",
          }}
        >
          Once you&apos;re set up, we&apos;ll show you real insights here.
        </Typography>
        <Typography sx={{ fontSize: "0.82rem", color: "#64748B", mt: 0.75, lineHeight: 1.45 }}>
          Emails, resolutions, leads, and more &mdash; all in one place.
        </Typography>
      </Box>
    </Paper>
  );
}
