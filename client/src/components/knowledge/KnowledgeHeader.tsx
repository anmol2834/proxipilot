"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Link from "next/link";
import { useKnowledgeStore } from "@/stores/knowledge.store";

export function KnowledgeHeader() {
  const { bannerDismissed, dismissBanner } = useKnowledgeStore();

  return (
    <Box sx={{ mb: 3.5 }}>
      {/* Breadcrumb */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.25 }}>
        <Link
          href="/dashboard"
          style={{
            display: "inline-flex",
            alignItems: "center",
            color: "#64748B",
            textDecoration: "none",
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </Link>
        <Typography sx={{ fontSize: "0.78rem", color: "#94A3B8" }}>/</Typography>
        <Typography
          sx={{
            fontSize: "0.78rem",
            color: "#64748B",
            fontWeight: 500,
          }}
        >
          Knowledge
        </Typography>
      </Box>

      {/* Main Title Row + Right Notice Banner */}
      <Box
        sx={{
          display: "flex",
          alignItems: { xs: "flex-start", lg: "center" },
          justifyContent: "space-between",
          flexDirection: { xs: "column", lg: "row" },
          gap: 2.5,
        }}
      >
        {/* Left Heading & Subtitle */}
        <Box sx={{ maxWidth: 620 }}>
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontSize: { xs: "1.75rem", sm: "2.1rem", md: "2.35rem" },
              fontWeight: 800,
              color: "#0F172A",
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
            }}
          >
            Your business knowledge
          </Typography>
          <Typography
            sx={{
              fontSize: { xs: "0.9rem", sm: "0.96rem" },
              color: "#64748B",
              mt: 0.75,
              lineHeight: 1.5,
            }}
          >
            Add and manage the information ProxiPilot uses to understand your business.
          </Typography>
        </Box>

        {/* Right Info Banner (Notice card matching reference) */}
        {!bannerDismissed && (
          <Box
            sx={{
              backgroundColor: "rgba(238, 242, 255, 0.65)",
              border: "1px solid #E0E7FF",
              borderRadius: "14px",
              p: 1.75,
              display: "flex",
              alignItems: "flex-start",
              gap: 1.5,
              maxWidth: { xs: "100%", lg: 440 },
              width: "100%",
              position: "relative",
            }}
          >
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: "8px",
                backgroundColor: "#E0E7FF",
                color: "#2563EB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                mt: 0.25,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/Proxipilot logo.svg"
                alt="ProxiPilot"
                width={18}
                height={18}
                style={{ objectFit: "contain", display: "block" }}
              />
            </Box>

            <Box sx={{ flex: 1, pr: 2 }}>
              <Typography
                sx={{
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "#1E1B4B",
                  lineHeight: 1.2,
                }}
              >
                Better knowledge. Smarter replies.
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.74rem",
                  color: "#475569",
                  mt: 0.4,
                  lineHeight: 1.45,
                }}
              >
                Keep your business information up to date so ProxiPilot can give accurate, on-brand responses.
              </Typography>
            </Box>

            <IconButton
              size="small"
              onClick={dismissBanner}
              aria-label="Dismiss banner"
              sx={{
                position: "absolute",
                top: 8,
                right: 8,
                p: 0.5,
                color: "#94A3B8",
                "&:hover": { color: "#475569", backgroundColor: "transparent" },
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </IconButton>
          </Box>
        )}
      </Box>
    </Box>
  );
}
