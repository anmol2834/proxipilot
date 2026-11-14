import React from "react";
import Box, { BoxProps } from "@mui/material/Box";
import { SectionBackground, SectionBackgroundProps } from "./SectionBackground";

export interface SectionProps extends BoxProps {
  id: string;
  bgVariant?: "white" | "soft" | "transparent";
  textureVariant?: SectionBackgroundProps["variant"];
  spacing?: "sm" | "md" | "lg" | "none";
  hasTopBorder?: boolean;
  children: React.ReactNode;
}

const spacingMap = {
  none: 0,
  sm: { xs: 6, md: 8, lg: 10 },
  md: { xs: 10, md: 14, lg: 18 },
  lg: { xs: 14, md: 20, lg: 26 },
};

export function Section({
  id,
  bgVariant = "white",
  textureVariant = "clean",
  spacing = "md",
  hasTopBorder = false,
  children,
  sx,
  ...rest
}: SectionProps) {
  const bgColor =
    bgVariant === "soft" ? "#F8FAFC" : bgVariant === "white" ? "#FFFFFF" : "transparent";

  return (
    <Box
      component="section"
      id={id}
      sx={{
        position: "relative",
        width: "100%",
        maxWidth: "100vw",
        overflow: "hidden",
        backgroundColor: bgColor,
        py: spacingMap[spacing],
        borderTop: hasTopBorder ? "1px solid #E6EAF0" : "none",
        ...sx,
      }}
      {...rest}
    >
      <SectionBackground variant={textureVariant} />
      <Box sx={{ position: "relative", zIndex: 1 }}>{children}</Box>
    </Box>
  );
}
