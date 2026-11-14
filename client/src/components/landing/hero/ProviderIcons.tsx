import React from "react";
import Box from "@mui/material/Box";

// Official Google Gmail SVG Icon
export function GmailIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L12 9.545l8.073-6.052C21.69 2.28 24 3.434 24 5.457z"
        fill="#EA4335"
      />
      <path d="M0 5.455l12 9 12-9-12-9-12 9z" fill="#C5221F" opacity="0.1" />
      <path d="M18.545 11.727L24 7.636v11.73h-5.455V11.727z" fill="#4285F4" />
      <path
        d="M0 19.366V7.636l5.455 4.091v7.639H1.636A1.636 1.636 0 0 1 0 19.366z"
        fill="#34A853"
      />
      <path
        d="M18.545 11.727L12 16.636 5.455 11.727V3.545L12 8.455l6.545-4.91v8.182z"
        fill="#FBBC04"
      />
    </svg>
  );
}

// Official Microsoft Outlook SVG Icon
export function OutlookIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="6" fill="#0078D4" />
      <path
        d="M20 7H9C7.89543 7 7 7.89543 7 9V23C7 24.1046 7.89543 25 9 25H20C21.1046 25 22 24.1046 22 23V9C22 7.89543 21.1046 7 20 7Z"
        fill="#28A8EA"
      />
      <path d="M26 11V23C26 24.1 25.1 25 24 25H20V11H26Z" fill="#0078D4" />
      <path
        d="M14.5 11.5C12.0147 11.5 10 13.5147 10 16C10 18.4853 12.0147 20.5 14.5 20.5C16.9853 20.5 19 18.4853 19 16C19 13.5147 16.9853 11.5 14.5 11.5ZM14.5 18C13.3954 18 12.5 17.1046 12.5 16C12.5 14.8954 13.3954 14 14.5 14C15.6046 14 16.5 14.8954 16.5 16C16.5 17.1046 15.6046 18 14.5 18Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

// Official Slack SVG Icon
export function SlackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 15a2.5 2.5 0 0 1-2.5-2.5 2.5 2.5 0 0 1 2.5-2.5h2.5v2.5A2.5 2.5 0 0 1 6 15zm3.5 0A2.5 2.5 0 0 1 12 12.5a2.5 2.5 0 0 1 2.5 2.5v6a2.5 2.5 0 0 1-2.5 2.5 2.5 2.5 0 0 1-2.5-2.5v-6z"
        fill="#E01E5A"
      />
      <path
        d="M9 6a2.5 2.5 0 0 1-2.5-2.5A2.5 2.5 0 0 1 9 1v2.5A2.5 2.5 0 0 1 9 6zm0 3.5A2.5 2.5 0 0 1 11.5 12a2.5 2.5 0 0 1-2.5 2.5H3a2.5 2.5 0 0 1-2.5-2.5A2.5 2.5 0 0 1 3 9.5h6z"
        fill="#36C5F0"
      />
      <path
        d="M18 9a2.5 2.5 0 0 1 2.5 2.5 2.5 2.5 0 0 1-2.5 2.5h-2.5V11.5A2.5 2.5 0 0 1 18 9zm-3.5 0A2.5 2.5 0 0 1 12 11.5a2.5 2.5 0 0 1-2.5-2.5V3a2.5 2.5 0 0 1 2.5-2.5 2.5 2.5 0 0 1 2.5 2.5v6z"
        fill="#2EB67D"
      />
      <path
        d="M15 18a2.5 2.5 0 0 1 2.5 2.5 2.5 2.5 0 0 1-2.5 2.5v-2.5a2.5 2.5 0 0 1 0-2.5zm0-3.5a2.5 2.5 0 0 1-2.5-2.5 2.5 2.5 0 0 1 2.5-2.5H21a2.5 2.5 0 0 1 2.5 2.5 2.5 2.5 0 0 1-2.5 2.5h-6z"
        fill="#ECB22E"
      />
    </svg>
  );
}

// More icon
export function MoreAppsIcon() {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "3px",
      }}
    >
      <Box sx={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: "#4F46E5" }} />
      <Box sx={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: "#4F46E5" }} />
      <Box sx={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: "#4F46E5" }} />
    </Box>
  );
}

export function ProviderStack() {
  const icons = [
    { component: <GmailIcon />, alt: "Gmail" },
    { component: <OutlookIcon />, alt: "Microsoft Outlook" },
    { component: <SlackIcon />, alt: "Slack" },
    { component: <MoreAppsIcon />, alt: "More Connectors" },
  ];

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "row", sm: "column" },
        gap: { xs: 1.25, sm: 1.75 },
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        zIndex: 2,
      }}
    >
      {icons.map((item, idx) => (
        <Box
          key={idx}
          sx={{
            width: { xs: 38, sm: 44 },
            height: { xs: 38, sm: 44 },
            backgroundColor: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "12px",
            boxShadow: "0 4px 12px -2px rgba(0, 0, 0, 0.06), 0 2px 4px -1px rgba(0, 0, 0, 0.04)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "transform 200ms ease, box-shadow 200ms ease",
            "&:hover": {
              transform: "translateX(-2px) scale(1.04)",
              boxShadow: "0 8px 16px -4px rgba(79, 70, 229, 0.12)",
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
