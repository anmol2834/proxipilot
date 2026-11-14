"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export function IntegrationHowItWorks() {
  const steps = [
    {
      number: "1",
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#2563EB"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      ),
      title: "Connect your account",
      description: "Sign in with your Google account using secure OAuth.",
    },
    {
      number: "2",
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#2563EB"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
      ),
      title: "Choose permissions",
      description: "We only request the permissions needed to help you.",
    },
    {
      number: "3",
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#2563EB"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
          <path d="M5 3v4" />
          <path d="M19 17v4" />
          <path d="M3 5h4" />
          <path d="M17 19h4" />
        </svg>
      ),
      title: "Start automating",
      description: "ProxiPilot will sync your emails and get to work.",
    },
  ];

  return (
    <Box
      sx={{
        borderRadius: "16px",
        border: "1px solid #E2E8F0",
        bgcolor: "#FFFFFF",
        p: { xs: 2.5, sm: 3, md: 3.5 },
        mb: 3.5,
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.02)",
      }}
    >
      <Typography
        variant="h6"
        sx={{
          fontSize: "17.5px",
          fontWeight: 700,
          color: "#0F172A",
          lineHeight: 1.2,
          mb: 0.5,
        }}
      >
        How it works
      </Typography>
      <Typography
        sx={{
          fontSize: "13.5px",
          color: "#64748B",
          mb: 3,
        }}
      >
        Get started in just a few simple steps.
      </Typography>

      {/* 3-Step Horizontal Row */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr auto 1fr auto 1fr" },
          alignItems: "center",
          gap: { xs: 2.5, md: 2 },
        }}
      >
        {steps.map((step, index) => (
          <React.Fragment key={index}>
            <Box
              sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: 2,
              }}
            >
              {/* Number Badge */}
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  bgcolor: "#EFF6FF",
                  color: "#2563EB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  fontWeight: 700,
                  flexShrink: 0,
                  mt: 0.25,
                }}
              >
                {step.number}
              </Box>

              {/* Icon Box */}
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: "12px",
                  bgcolor: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {step.icon}
              </Box>

              {/* Step Details */}
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  sx={{
                    fontSize: "14.5px",
                    fontWeight: 600,
                    color: "#0F172A",
                    mb: 0.35,
                    lineHeight: 1.3,
                  }}
                >
                  {step.title}
                </Typography>
                <Typography
                  sx={{
                    fontSize: "12.5px",
                    color: "#64748B",
                    lineHeight: 1.45,
                  }}
                >
                  {step.description}
                </Typography>
              </Box>
            </Box>

            {/* Connecting Chevron (only between steps 1-2 and 2-3 on desktop) */}
            {index < steps.length - 1 && (
              <Box
                sx={{
                  display: { xs: "none", md: "flex" },
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#94A3B8",
                  px: 1,
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Box>
            )}
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );
}
