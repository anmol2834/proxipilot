"use client";

import React from "react";
import Box from "@mui/material/Box";

// Official Google Gmail Icon (from user-uploaded original)
export function GmailIcon() {
  return (
    <Box
      component="img"
      src="/logos/gmail.png"
      alt="Google Workspace & Gmail"
      sx={{
        width: 26,
        height: 26,
        objectFit: "contain",
        display: "block",
        transition: "transform 200ms ease",
      }}
    />
  );
}

// Official Microsoft Outlook Icon (from user-uploaded original)
export function OutlookIcon() {
  return (
    <Box
      component="img"
      src="/logos/outlook.png"
      alt="Microsoft Outlook 365"
      sx={{
        width: 26,
        height: 26,
        objectFit: "contain",
        display: "block",
        transition: "transform 200ms ease",
      }}
    />
  );
}

// Official Slack Icon (from user-uploaded original) - enlarged to match optical weight
export function SlackIcon() {
  return (
    <Box
      component="img"
      src="/logos/slack.png"
      alt="Slack Connect"
      sx={{
        width: 34,
        height: 34,
        transform: "scale(1.25)",
        objectFit: "contain",
        display: "block",
        transition: "transform 200ms ease",
      }}
    />
  );
}

// More Connectors icon
export function MoreAppsIcon() {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "3.5px",
      }}
    >
      <Box sx={{ width: 4.5, height: 4.5, borderRadius: "50%", backgroundColor: "#64748B" }} />
      <Box sx={{ width: 4.5, height: 4.5, borderRadius: "50%", backgroundColor: "#64748B" }} />
      <Box sx={{ width: 4.5, height: 4.5, borderRadius: "50%", backgroundColor: "#64748B" }} />
    </Box>
  );
}

export function ProviderStack() {
  const icons = [
    { component: <GmailIcon />, alt: "Gmail & Google Workspace", name: "Gmail" },
    { component: <OutlookIcon />, alt: "Microsoft 365 & Outlook", name: "Outlook" },
    { component: <SlackIcon />, alt: "Slack Notifications", name: "Slack" },
    { component: <MoreAppsIcon />, alt: "More Custom Inboxes & Webhooks", name: "+20 More" },
  ];

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "row", sm: "column" },
        gap: { xs: 1.25, sm: 1.2 },
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        zIndex: 2,
        flexShrink: 0,
      }}
    >
      {icons.map((item, idx) => (
        <Box
          key={idx}
          sx={{
            width: { xs: 40, sm: 44 },
            height: { xs: 40, sm: 44 },
            backgroundColor: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "12px",
            boxShadow: "0 4px 12px -2px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            overflow: "hidden",
            transition: "all 200ms cubic-bezier(0.4, 0, 0.2, 1)",
            "&:hover": {
              transform: "translateY(-2px) scale(1.06)",
              boxShadow: "0 8px 18px -4px rgba(79, 70, 229, 0.16)",
              borderColor: "#CBD5E1",
            },
          }}
          title={item.alt}
        >
          {item.component}
        </Box>
      ))}
    </Box>
  );
}
