"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface ComingSoonCardProps {
  name: string;
  description: string;
  icon: React.ReactNode;
}

export function ComingSoonCard({ name, description, icon }: ComingSoonCardProps) {
  return (
    <Box
      sx={{
        borderRadius: "14px",
        border: "1px solid #E2E8F0",
        bgcolor: "#FFFFFF",
        p: 2.5,
        display: "flex",
        alignItems: "flex-start",
        gap: 2,
        position: "relative",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02)",
        transition: "all 0.2s ease",
        "&:hover": {
          borderColor: "#CBD5E1",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.04)",
          transform: "translateY(-1px)",
        },
      }}
    >
      {/* Provider Icon Box */}
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: "12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>

      {/* Content & Coming Soon Badge */}
      <Box sx={{ minWidth: 0, flex: 1, pr: 1 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            mb: 0.5,
          }}
        >
          <Typography
            sx={{
              fontSize: "15px",
              fontWeight: 600,
              color: "#0F172A",
              lineHeight: 1.2,
            }}
          >
            {name}
          </Typography>

          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              px: 1.2,
              py: 0.3,
              borderRadius: "9999px",
              bgcolor: "#F1F5F9",
              border: "1px solid #E2E8F0",
              color: "#64748B",
              fontSize: "11.5px",
              fontWeight: 500,
              whiteSpace: "nowrap",
            }}
          >
            Coming soon
          </Box>
        </Box>

        <Typography
          sx={{
            fontSize: "13px",
            color: "#64748B",
            lineHeight: 1.45,
          }}
        >
          {description}
        </Typography>
      </Box>
    </Box>
  );
}
