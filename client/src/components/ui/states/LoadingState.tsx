import * as React from "react";
import { Box, CircularProgress, Typography } from "@mui/material";

export interface LoadingStateProps {
  label?: string;
  minHeight?: number | string;
}

export function LoadingState({ label = "Loading...", minHeight = 200 }: LoadingStateProps) {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight,
        gap: 2,
        p: 3,
      }}
    >
      <CircularProgress size={32} thickness={4} />
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
        {label}
      </Typography>
    </Box>
  );
}
