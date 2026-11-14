"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { ComingSoonCard } from "./ComingSoonCard";
import {
  OutlookLogo,
  ImapLogo,
  SalesforceLogo,
  HubSpotLogo,
  SlackLogo,
  GoogleDriveLogo,
} from "./ProviderIcons";

interface ComingSoonGridProps {
  onRequestIntegration: () => void;
}

export function ComingSoonGrid({ onRequestIntegration }: ComingSoonGridProps) {
  const providers = [
    {
      name: "Outlook",
      description: "Connect your Microsoft Outlook account.",
      icon: <OutlookLogo size={42} />,
    },
    {
      name: "IMAP",
      description: "Connect any email provider via IMAP.",
      icon: <ImapLogo size={42} />,
    },
    {
      name: "Salesforce",
      description: "Sync your leads, contacts, and opportunities.",
      icon: <SalesforceLogo size={42} />,
    },
    {
      name: "HubSpot",
      description: "Manage contacts and customer data from HubSpot.",
      icon: <HubSpotLogo size={42} />,
    },
    {
      name: "Slack",
      description: "Get notified and take action from Slack.",
      icon: <SlackLogo size={42} />,
    },
    {
      name: "Google Drive",
      description: "Upload and manage knowledge from Google Drive.",
      icon: <GoogleDriveLogo size={42} />,
    },
  ];

  return (
    <Box sx={{ mb: 4 }}>
      {/* Header Row */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
          gap: 1.5,
          mb: 2.5,
        }}
      >
        <Box>
          <Typography
            variant="h6"
            sx={{
              fontSize: "18px",
              fontWeight: 700,
              color: "#0F172A",
              lineHeight: 1.2,
              mb: 0.5,
            }}
          >
            More integrations
          </Typography>
          <Typography
            sx={{
              fontSize: "13.5px",
              color: "#64748B",
            }}
          >
            More tools are on the way. We're constantly adding new integrations to help you do more.
          </Typography>
        </Box>

        <Button
          onClick={onRequestIntegration}
          variant="outlined"
          sx={{
            textTransform: "none",
            borderRadius: "10px",
            borderColor: "#E2E8F0",
            color: "#334155",
            bgcolor: "#FFFFFF",
            fontSize: "13.5px",
            fontWeight: 500,
            px: 2,
            py: 0.85,
            display: "inline-flex",
            alignItems: "center",
            gap: 0.85,
            boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
            "&:hover": {
              borderColor: "#CBD5E1",
              bgcolor: "#F8FAFC",
            },
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#64748B"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Request an integration
        </Button>
      </Box>

      {/* 3-Column Responsive Grid */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            lg: "repeat(3, 1fr)",
          },
          gap: 2,
        }}
      >
        {providers.map((provider) => (
          <ComingSoonCard
            key={provider.name}
            name={provider.name}
            description={provider.description}
            icon={provider.icon}
          />
        ))}
      </Box>
    </Box>
  );
}
