import React from "react";
import Box, { BoxProps } from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export interface VisualStageProps extends BoxProps {
  label?: string;
  minHeight?: number | string;
  aspectRatio?: string;
  children?: React.ReactNode;
}

export function VisualStage({
  label,
  minHeight = 320,
  aspectRatio,
  children,
  sx,
  ...rest
}: VisualStageProps) {
  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        minHeight,
        aspectRatio,
        backgroundColor: "#FFFFFF",
        border: "1px solid #E6EAF0",
        borderRadius: "16px",
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.04)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        p: { xs: 3, md: 4 },
        ...sx,
      }}
      {...rest}
    >
      {children || (
        <Box
          sx={{
            textAlign: "center",
            py: 4,
            px: 2,
            border: "1px dashed #CBD5E1",
            borderRadius: "12px",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#F8FAFC",
          }}
        >
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: "#635BFF",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontSize: "0.75rem",
              mb: 0.5,
            }}
          >
            [ Visual Stage — Ready for Reference Image ]
          </Typography>
          {label && (
            <Typography variant="body2" sx={{ color: "#64748B", maxWidth: 480 }}>
              {label}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
