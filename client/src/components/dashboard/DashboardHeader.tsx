"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useRegistrationStore } from "@/stores/registration.store";

interface DashboardHeaderProps {
  userName?: string;
}

export function DashboardHeader({ userName }: DashboardHeaderProps = {}) {
  const { accountDraft } = useRegistrationStore();
  const firstName = userName || accountDraft.firstName?.trim() || "Anmol";

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 3,
        mb: { xs: 3, md: 4 },
        position: "relative",
      }}
    >
      {/* Left Greeting */}
      <Box sx={{ maxWidth: 500 }}>
        <Typography
          variant="h3"
          component="h1"
          sx={{
            fontSize: { xs: "1.85rem", sm: "2.25rem", md: "2.6rem" },
            fontWeight: 800,
            color: "#0F172A",
            letterSpacing: "-0.03em",
            lineHeight: 1.15,
          }}
        >
          Good morning,{" "}
          <Box component="span" sx={{ color: "#2563EB" }}>
            {firstName}.
          </Box>
        </Typography>
        <Typography
          sx={{
            fontSize: { xs: "0.95rem", sm: "1.05rem" },
            color: "#64748B",
            mt: 0.75,
            fontWeight: 400,
          }}
        >
          Let&apos;s get your inbox working smarter.
        </Typography>
      </Box>

      {/* Right Decorative Graphic Stage matching Screenshot */}
      <Box
        sx={{
          display: { xs: "none", lg: "flex" },
          alignItems: "center",
          gap: 2,
          position: "relative",
          pr: 2,
        }}
      >
        {/* Handwritten text with curved arrow */}
        <Box sx={{ position: "relative", textAlign: "right" }}>
          <Typography
            sx={{
              fontFamily: "var(--font-handwritten), Caveat, cursive",
              fontSize: "1.35rem",
              fontWeight: 600,
              color: "#3B82F6",
              transform: "rotate(-6deg)",
              lineHeight: 1.1,
              whiteSpace: "nowrap",
            }}
          >
            Turn emails<br />into opportunities
          </Typography>
          <Box
            sx={{
              position: "absolute",
              right: -18,
              bottom: -16,
              color: "#3B82F6",
            }}
          >
            <svg width="34" height="24" viewBox="0 0 38 28" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <path d="M4 4 C 18 20, 26 22, 34 16" />
              <path d="M26 14 L 34 16 L 31 24" />
            </svg>
          </Box>
        </Box>

        {/* Stacked Floating Cards Mockup */}
        <Box sx={{ position: "relative", width: 220, height: 110 }}>
          {/* Back Card */}
          <Box
            sx={{
              position: "absolute",
              top: 0,
              right: 15,
              width: 170,
              height: 95,
              borderRadius: "14px",
              backgroundColor: "#F1F5F9",
              border: "1px solid #E2E8F0",
              transform: "rotate(4deg)",
              boxShadow: "0 8px 20px rgba(15, 23, 42, 0.04)",
            }}
          />

          {/* Front Card */}
          <Box
            sx={{
              position: "absolute",
              top: 8,
              right: 25,
              width: 175,
              height: 95,
              borderRadius: "14px",
              backgroundColor: "#FFFFFF",
              border: "1px solid #EEF2F6",
              p: 1.5,
              boxShadow: "0 10px 25px rgba(37, 99, 235, 0.08)",
              display: "flex",
              flexDirection: "column",
              gap: 1,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#CBD5E1" }} />
              <Box sx={{ color: "#2563EB" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                </svg>
              </Box>
            </Box>
            <Box sx={{ width: "70%", height: 6, borderRadius: "4px", backgroundColor: "#E2E8F0" }} />
            <Box sx={{ width: "45%", height: 6, borderRadius: "4px", backgroundColor: "#F1F5F9" }} />
          </Box>

          {/* Floating Pill Badge */}
          <Box
            sx={{
              position: "absolute",
              bottom: -5,
              right: 0,
              backgroundColor: "#FFFFFF",
              border: "1px solid #DBEAFE",
              borderRadius: "12px",
              py: 0.75,
              px: 1.25,
              boxShadow: "0 8px 18px rgba(37, 99, 235, 0.12)",
              display: "flex",
              alignItems: "center",
              gap: 0.85,
              zIndex: 3,
            }}
          >
            <Box sx={{ color: "#2563EB", display: "flex" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
              </svg>
            </Box>
            <Box>
              <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: "#1E293B", lineHeight: 1.1 }}>
                Smarter emails.
              </Typography>
              <Typography sx={{ fontSize: "0.62rem", color: "#64748B", lineHeight: 1.1 }}>
                Bigger outcomes.
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
