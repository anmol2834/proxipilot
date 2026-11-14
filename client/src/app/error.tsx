"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { logger } from "@/lib/logger";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootErrorBoundary({ error, reset }: ErrorProps) {
  React.useEffect(() => {
    logger.error("Root boundary caught error", error);
  }, [error]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        p: 4,
        textAlign: "center",
      }}
    >
      <Typography variant="h3" component="h1" sx={{ fontWeight: 700, mb: 1.5 }}>
        Application Error
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 480, mb: 3 }}>
        An unexpected error occurred while rendering this page. Our team has been notified.
      </Typography>
      {error.digest && (
        <Typography
          variant="caption"
          sx={{
            fontFamily: "monospace",
            bgcolor: "action.hover",
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
            mb: 3,
          }}
        >
          Digest: {error.digest}
        </Typography>
      )}
      <Button onClick={() => reset()} variant="contained" color="primary">
        Try Again
      </Button>
    </Box>
  );
}
