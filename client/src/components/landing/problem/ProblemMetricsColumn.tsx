"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface MetricItem {
  count: number;
  label: string;
  color: string;
}

const METRICS: MetricItem[] = [
  { count: 42, label: "unread", color: "#EF4444" },
  { count: 17, label: "follow-ups", color: "#F59E0B" },
  { count: 8, label: "pricing\nrequests", color: "#3B82F6" },
  { count: 13, label: "customer\nquestions", color: "#10B981" },
  { count: 6, label: "internal\nrequests", color: "#8B5CF6" },
];

export function ProblemMetricsColumn() {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "row", sm: "row", lg: "column" },
        flexWrap: { xs: "wrap", sm: "nowrap" },
        justifyContent: "center",
        alignItems: "center",
        gap: { xs: 1.25, sm: 1.5, lg: 1.75 },
        zIndex: 2,
      }}
    >
      {METRICS.map((item, idx) => (
        <Box
          key={idx}
          sx={{
            width: { xs: 88, sm: 94, lg: 102 },
            height: { xs: 74, sm: 78, lg: 82 },
            backgroundColor: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #EEF2F6",
            boxShadow: "0 4px 14px rgba(0, 0, 0, 0.04)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            p: 1,
            transition: "all 200ms ease",
            "&:hover": {
              transform: "translateY(-2px)",
              boxShadow: "0 6px 18px rgba(0, 0, 0, 0.07)",
              borderColor: "#E2E8F0",
            },
          }}
        >
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: { xs: "1.375rem", lg: "1.5rem" },
              lineHeight: 1.1,
              color: item.color,
              fontFamily: "inherit",
            }}
          >
            {item.count}
          </Typography>
          <Typography
            sx={{
              fontWeight: 500,
              fontSize: "0.75rem",
              lineHeight: 1.25,
              color: "#64748B",
              textAlign: "center",
              whiteSpace: "pre-line",
              mt: 0.35,
            }}
          >
            {item.label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
