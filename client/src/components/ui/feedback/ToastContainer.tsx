"use client";

import * as React from "react";
import { Alert, AlertTitle, Snackbar, Stack } from "@mui/material";
import { useNotificationStore } from "@/stores/notification.store";

export function ToastContainer() {
  const notifications = useNotificationStore((state) => state.notifications);
  const removeNotification = useNotificationStore((state) => state.removeNotification);

  if (notifications.length === 0) return null;

  return (
    <Stack
      spacing={1}
      sx={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: (theme) => theme.zIndex.snackbar,
        maxWidth: 420,
        width: "100%",
        pointerEvents: "none",
      }}
    >
      {notifications.map((item) => (
        <Snackbar
          key={item.id}
          open={true}
          autoHideDuration={item.durationMs || 5000}
          onClose={() => removeNotification(item.id)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          sx={{ position: "static", pointerEvents: "auto" }}
        >
          <Alert
            severity={item.type}
            onClose={() => removeNotification(item.id)}
            variant="filled"
            elevation={6}
            sx={{ width: "100%", borderRadius: 2 }}
          >
            {item.title && <AlertTitle sx={{ fontWeight: 600 }}>{item.title}</AlertTitle>}
            {item.message}
          </Alert>
        </Snackbar>
      ))}
    </Stack>
  );
}
