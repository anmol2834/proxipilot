"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { GmailLogo } from "./ProviderIcons";

interface GmailHeroCardProps {
  onConnectClick: () => void;
  onLearnMoreClick: () => void;
  hasConnectedAccounts?: boolean;
}

export function GmailHeroCard({
  onConnectClick,
  onLearnMoreClick,
  hasConnectedAccounts = false,
}: GmailHeroCardProps) {
  const featureChips = [
    "Read & analyze emails",
    "Send email replies",
    "Sync conversations",
    "AI-assisted responses",
  ];

  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "18px",
        border: "1px solid #E2E8F0",
        background: "linear-gradient(135deg, #FFFFFF 0%, #F6F9FE 45%, #EEF4FF 100%)",
        boxShadow: "0 4px 20px -2px rgba(37, 99, 235, 0.04), 0 2px 6px -1px rgba(0, 0, 0, 0.02)",
        p: { xs: 2.5, sm: 3.5, md: 4 },
        mb: 3.5,
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1.15fr 0.85fr" },
          gap: { xs: 3.5, lg: 4 },
          alignItems: "center",
        }}
      >
        {/* Left Column: Information & CTAs */}
        <Box sx={{ zIndex: 2 }}>
          {/* Logo & Available badge */}
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2.5, mb: 2 }}>
            <Box
              sx={{
                width: 60,
                height: 60,
                borderRadius: "16px",
                bgcolor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
                flexShrink: 0,
              }}
            >
              <GmailLogo size={36} />
            </Box>

            <Box>
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  px: 1.25,
                  py: 0.35,
                  borderRadius: "9999px",
                  bgcolor: "#ECFDF5",
                  border: "1px solid #A7F3D0",
                  color: "#059669",
                  fontSize: "12px",
                  fontWeight: 600,
                  letterSpacing: "0.01em",
                  mb: 0.75,
                }}
              >
                Available
              </Box>
              <Typography
                variant="h5"
                sx={{
                  fontSize: "24px",
                  fontWeight: 700,
                  color: "#0F172A",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                }}
              >
                Gmail
              </Typography>
            </Box>
          </Box>

          {/* Description */}
          <Typography
            sx={{
              fontSize: "14.5px",
              color: "#475569",
              lineHeight: 1.6,
              mb: 2.5,
              maxWidth: "520px",
            }}
          >
            Connect your Gmail account to let ProxiPilot read, understand, and respond to your emails using AI.
          </Typography>

          {/* Feature Chips */}
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 1.25,
              mb: 3,
            }}
          >
            {featureChips.map((feature, idx) => (
              <Box
                key={idx}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.75,
                  px: 1.5,
                  py: 0.6,
                  borderRadius: "9999px",
                  bgcolor: "#EFF6FF",
                  border: "1px solid #DBEAFE",
                  fontSize: "12.5px",
                  fontWeight: 500,
                  color: "#1E3A8A",
                }}
              >
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    bgcolor: "#2563EB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </Box>
                {feature}
              </Box>
            ))}
          </Box>

          {/* CTA Buttons Row */}
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 1.5,
              mb: 2.25,
            }}
          >
            <Button
              onClick={onConnectClick}
              variant="contained"
              sx={{
                bgcolor: "#2563EB",
                color: "#FFFFFF",
                textTransform: "none",
                fontSize: "14px",
                fontWeight: 600,
                borderRadius: "10px",
                px: 2.75,
                py: 1.1,
                boxShadow: "0 2px 8px rgba(37, 99, 235, 0.25)",
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                "&:hover": {
                  bgcolor: "#1D4ED8",
                  boxShadow: "0 4px 12px rgba(37, 99, 235, 0.35)",
                },
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              {hasConnectedAccounts ? "Connect another Gmail" : "Connect Gmail"}
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Button>

            <Button
              onClick={onLearnMoreClick}
              variant="outlined"
              sx={{
                bgcolor: "#FFFFFF",
                color: "#334155",
                borderColor: "#CBD5E1",
                textTransform: "none",
                fontSize: "14px",
                fontWeight: 500,
                borderRadius: "10px",
                px: 2.25,
                py: 1.1,
                display: "inline-flex",
                alignItems: "center",
                gap: 0.85,
                boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                "&:hover": {
                  borderColor: "#94A3B8",
                  bgcolor: "#F8FAFC",
                },
              }}
            >
              Learn more
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </Button>
          </Box>

          {/* Security Reassurance */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              color: "#64748B",
              fontSize: "12.5px",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#2563EB"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <Typography sx={{ fontSize: "12.5px", color: "#64748B" }}>
              We use secure OAuth authorization. Your data is encrypted and you're always in control.
            </Typography>
          </Box>
        </Box>

        {/* Right Column: Visual Stage / Product Preview Card */}
        <Box
          sx={{
            position: "relative",
            display: { xs: "none", md: "flex" },
            alignItems: "center",
            justifyContent: "center",
            minHeight: 270,
            pr: { md: 2, lg: 3 },
          }}
        >
          {/* Subtle background glow */}
          <Box
            sx={{
              position: "absolute",
              width: 320,
              height: 240,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(199, 210, 254, 0.4) 0%, rgba(239, 246, 255, 0) 70%)",
              filter: "blur(30px)",
              zIndex: 0,
            }}
          />

          {/* Main Tilted Opportunity Card */}
          <Box
            sx={{
              position: "relative",
              zIndex: 1,
              width: "100%",
              maxWidth: 380,
              bgcolor: "#FFFFFF",
              borderRadius: "16px",
              border: "1px solid rgba(226, 232, 240, 0.9)",
              p: 3,
              boxShadow: "0 20px 25px -5px rgba(15, 23, 42, 0.06), 0 8px 10px -6px rgba(15, 23, 42, 0.03)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            {/* Subtle Mockup Header Bars on the top left */}
            <Box
              sx={{
                position: "absolute",
                top: 14,
                left: 16,
                display: "flex",
                flexDirection: "column",
                gap: 0.6,
                opacity: 0.35,
              }}
            >
              <Box sx={{ width: 36, height: 4, bgcolor: "#94A3B8", borderRadius: 1 }} />
              <Box sx={{ width: 24, height: 4, bgcolor: "#94A3B8", borderRadius: 1 }} />
            </Box>

            {/* Centered Gmail Logo */}
            <Box
              sx={{
                width: 46,
                height: 46,
                borderRadius: "12px",
                bgcolor: "#F8FAFC",
                border: "1px solid #E2E8F0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mb: 1.5,
                mt: 0.5,
              }}
            >
              <GmailLogo size={26} />
            </Box>

            {/* Headline */}
            <Typography
              sx={{
                fontSize: "17px",
                fontWeight: 700,
                color: "#0F172A",
                lineHeight: 1.35,
                maxWidth: "240px",
                mb: 1.5,
              }}
            >
              Turn your emails into opportunities.
            </Typography>

            {/* Floating Tags around the card */}
            {/* Tag 1: Understand conversations (top right) */}
            <Box
              sx={{
                position: "absolute",
                top: -16,
                right: -16,
                bgcolor: "#FFFFFF",
                borderRadius: "9999px",
                border: "1px solid #E2E8F0",
                px: 1.75,
                py: 0.75,
                display: "flex",
                alignItems: "center",
                gap: 0.85,
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.07)",
                zIndex: 3,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/Proxipilot logo.svg"
                alt="AI"
                width={14}
                height={14}
                style={{ objectFit: "contain", display: "block" }}
              />
              <Typography sx={{ fontSize: "12px", fontWeight: 600, color: "#1E293B" }}>
                Understand conversations
              </Typography>
            </Box>

            {/* Tag 2: Save time with AI (middle right) */}
            <Box
              sx={{
                position: "absolute",
                top: "45%",
                right: -24,
                bgcolor: "#FFFFFF",
                borderRadius: "9999px",
                border: "1px solid #E2E8F0",
                px: 1.75,
                py: 0.75,
                display: "flex",
                alignItems: "center",
                gap: 0.85,
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.07)",
                zIndex: 3,
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#2563EB"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <Typography sx={{ fontSize: "12px", fontWeight: 600, color: "#1E293B" }}>
                Save time with AI
              </Typography>
            </Box>

            {/* Tag 3: Respond with your brand voice (bottom right) */}
            <Box
              sx={{
                position: "absolute",
                bottom: -18,
                right: -10,
                bgcolor: "#FFFFFF",
                borderRadius: "9999px",
                border: "1px solid #E2E8F0",
                px: 1.75,
                py: 0.75,
                display: "flex",
                alignItems: "center",
                gap: 0.85,
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.07)",
                zIndex: 3,
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#2563EB"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <Typography sx={{ fontSize: "12px", fontWeight: 600, color: "#1E293B" }}>
                Respond with your brand voice
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
