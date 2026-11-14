import React from "react";
import Box, { BoxProps } from "@mui/material/Box";

export interface ContainerProps extends BoxProps {
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  children: React.ReactNode;
}

const sizeMap = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1420px",
  "2xl": "1536px",
  full: "100%",
};

export function Container({ size = "xl", children, sx, ...rest }: ContainerProps) {
  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: sizeMap[size],
        mx: "auto",
        px: { xs: 2, sm: 3, md: 3.5, lg: 4 },
        ...sx,
      }}
      {...rest}
    >
      {children}
    </Box>
  );
}
