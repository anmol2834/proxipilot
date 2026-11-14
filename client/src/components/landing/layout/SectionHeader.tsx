import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import { FadeUp } from "../animations/FadeUp";

export interface SectionHeaderProps {
  badge?: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
  maxWidth?: string | number;
}

export function SectionHeader({
  badge,
  title,
  subtitle,
  align = "center",
  maxWidth = 720,
}: SectionHeaderProps) {
  const isCenter = align === "center";

  return (
    <FadeUp>
      <Box
        sx={{
          textAlign: align,
          maxWidth,
          mx: isCenter ? "auto" : 0,
          mb: { xs: 5, md: 7, lg: 9 },
        }}
      >
        {badge && (
          <Chip
            label={badge}
            size="small"
            sx={{
              mb: 2,
              fontWeight: 600,
              fontSize: "0.8125rem",
              letterSpacing: "0.02em",
              color: "#635BFF",
              backgroundColor: "rgba(99, 91, 255, 0.08)",
              border: "1px solid rgba(99, 91, 255, 0.18)",
              borderRadius: "9999px",
              px: 0.5,
              py: 0.25,
            }}
          />
        )}
        <Typography
          variant="h2"
          component="h2"
          sx={{
            fontWeight: 700,
            fontSize: { xs: "1.875rem", sm: "2.25rem", md: "2.75rem" },
            lineHeight: 1.2,
            letterSpacing: "-0.025em",
            color: "#111827",
            mb: subtitle ? 2 : 0,
          }}
        >
          {title}
        </Typography>
        {subtitle && (
          <Typography
            variant="body1"
            sx={{
              fontSize: { xs: "1rem", sm: "1.125rem" },
              lineHeight: 1.65,
              color: "#64748B",
            }}
          >
            {subtitle}
          </Typography>
        )}
      </Box>
    </FadeUp>
  );
}
