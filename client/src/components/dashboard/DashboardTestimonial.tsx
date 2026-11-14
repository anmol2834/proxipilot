"use client";

import React, { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

const TESTIMONIALS = [
  {
    quote:
      "ProxiPilot has saved us hours every week. Our support and sales emails are handled automatically with impressive accuracy.",
    author: "Early Access User",
  },
  {
    quote:
      "The evidence retrieval and deterministic guardrails give our enterprise team 100% confidence in AI email triage.",
    author: "Head of Support Operations",
  },
  {
    quote:
      "Setup took less than 3 minutes. Connecting our Google Workspace was instant and zero maintenance.",
    author: "SaaS Founder",
  },
  {
    quote:
      "Our resolution times dropped from 4 hours to under 8 minutes with autonomous draft suggestions.",
    author: "Customer Success Director",
  },
];

export function DashboardTestimonial() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const current = TESTIMONIALS[currentIndex];

  return (
    <Box
      sx={{
        mt: 4,
        pt: 2.5,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 2,
      }}
    >
      {/* Left: Quote + Author */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, maxWidth: 700 }}>
        <Typography
          sx={{
            fontSize: "1.8rem",
            color: "#93C5FD",
            fontWeight: 800,
            lineHeight: 1,
            userSelect: "none",
          }}
        >
          &ldquo;
        </Typography>
        <Typography sx={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.4 }}>
          &ldquo;{current.quote}&rdquo;{" "}
          <Box component="span" sx={{ color: "#94A3B8", fontWeight: 500, ml: 0.5 }}>
            &mdash; {current.author}
          </Box>
        </Typography>
      </Box>

      {/* Center: Pagination Dots */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        {TESTIMONIALS.map((_, idx) => (
          <Box
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            sx={{
              width: idx === currentIndex ? 8 : 6,
              height: idx === currentIndex ? 8 : 6,
              borderRadius: "50%",
              backgroundColor: idx === currentIndex ? "#2563EB" : "#CBD5E1",
              cursor: "pointer",
              transition: "all 150ms ease",
              "&:hover": { backgroundColor: "#93C5FD" },
            }}
          />
        ))}
      </Box>

      {/* Right: Tagline */}
      <Box sx={{ display: { xs: "none", md: "block" } }}>
        <Typography sx={{ fontSize: "0.78rem", color: "#94A3B8", fontWeight: 500 }}>
          Built for modern teams
        </Typography>
      </Box>
    </Box>
  );
}
