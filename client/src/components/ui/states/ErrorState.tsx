"use client";

import * as React from "react";
import { Box, Button, Typography } from "@mui/material";
import { ErrorOutlineOutlined, Refresh } from "@mui/icons-material";

export interface ErrorStateProps {
  title?: string;
  message?: string;
  code?: string;
  onRetry?: () => void;
  minHeight?: number | string;
}

export function ErrorState({
  title = "Something went wrong",
  message = "An error occurred while loading this section. Please try again.",
  code,
  onRetry,
  minHeight = 240,
}: ErrorStateProps) {
  return (
    <Box
      role="alert"
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        minHeight,
        p: 4,
        borderRadius: 2,
        border: "1px solid var(--border-subtle)",
        bgcolor: "background.paper",
      }}
    >
      <ErrorOutlineOutlined color="error" sx={{ fontSize: 44, mb: 1.5 }} />
      <Typography variant="h6" component="h2" sx={{ fontWeight: 600, mb: 0.5 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 440, mb: 2 }}>
        {message}
      </Typography>
      {code && (
        <Typography
          variant="caption"
          sx={{
            fontFamily: "monospace",
            bgcolor: "action.hover",
            px: 1,
            py: 0.5,
            borderRadius: 1,
            mb: 2,
          }}
        >
          Error Code: {code}
        </Typography>
      )}
      {onRetry && (
        <Button
          variant="outlined"
          color="primary"
          size="small"
          startIcon={<Refresh />}
          onClick={onRetry}
        >
          Try Again
        </Button>
      )}
    </Box>
  );
}
