import * as React from "react";
import { Box, Typography } from "@mui/material";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  minHeight?: number | string;
}

export function EmptyState({ icon, title, description, action, minHeight = 280 }: EmptyStateProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        minHeight,
        p: 4,
        borderRadius: 2,
        border: "1px dashed var(--border-subtle)",
        bgcolor: "background.paper",
      }}
    >
      {icon && (
        <Box sx={{ mb: 2, color: "text.secondary", fontSize: 48, display: "flex" }}>{icon}</Box>
      )}
      <Typography variant="h6" component="h2" sx={{ fontWeight: 600, mb: 1 }}>
        {title}
      </Typography>
      {description && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ maxWidth: 440, mb: action ? 3 : 0 }}
        >
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 1 }}>{action}</Box>}
    </Box>
  );
}
