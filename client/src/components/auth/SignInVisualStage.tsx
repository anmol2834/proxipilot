"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Link from "next/link";

export function SignInVisualStage() {
  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        p: { xs: 2.5, sm: 3, md: 3.5, lg: 4 },
        display: { xs: "none", md: "flex" },
        flexDirection: "column",
        justifyContent: "space-between",
        background: "linear-gradient(150deg, #F0F6FF 0%, #F8FAFC 45%, #EEF4FF 100%)",
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* Background Soft Glow Circles */}
      <Box
        sx={{
          position: "absolute",
          top: "-10%",
          left: "-10%",
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(191, 219, 254, 0.45) 0%, transparent 70%)",
          filter: "blur(35px)",
          pointerEvents: "none",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          bottom: "10%",
          right: "-10%",
          width: 280,
          height: 280,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(219, 234, 254, 0.4) 0%, transparent 70%)",
          filter: "blur(35px)",
          pointerEvents: "none",
        }}
      />

      {/* Top Section: Brand + Headlines */}
      <Box sx={{ position: "relative", zIndex: 2 }}>
        {/* Brand Logo */}
        <Box
          component={Link}
          href="/"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 1.25,
            textDecoration: "none",
            color: "#0F172A",
            mb: { xs: 1.75, md: 2.25 },
          }}
        >
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: "8px",
              backgroundColor: "#2563EB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              boxShadow: "0 3px 10px rgba(37, 99, 235, 0.3)",
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            </svg>
          </Box>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              fontSize: "1.25rem",
              letterSpacing: "-0.025em",
              color: "#0F172A",
            }}
          >
            ProxiPilot
          </Typography>
        </Box>

        {/* Eyebrow */}
        <Typography
          sx={{
            fontSize: "0.7rem",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#64748B",
            mb: 0.75,
          }}
        >
          WELCOME BACK
        </Typography>

        {/* H1 Headline */}
        <Typography
          variant="h1"
          sx={{
            fontSize: { xs: "1.5rem", sm: "1.75rem", lg: "2.1rem" },
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: "-0.03em",
            color: "#0F172A",
            mb: 1,
          }}
        >
          Turn your inbox{" "}
          <br />
          into a competitive{" "}
          <Box component="span" sx={{ color: "#2563EB" }}>
            advantage.
          </Box>
        </Typography>

        {/* Subtitle */}
        <Typography
          sx={{
            fontSize: "0.84rem",
            lineHeight: 1.5,
            color: "#64748B",
            maxWidth: 420,
            mb: { xs: 1.5, md: 2 },
          }}
        >
          Sign in to continue building a smarter, faster, and more organized inbox with ProxiPilot.
        </Typography>
      </Box>

      {/* Middle Section: Floating Visual Mockup */}
      <Box
        sx={{
          position: "relative",
          my: 0.5,
          zIndex: 2,
        }}
      >
        {/* Floating "AI sorting..." pill badge */}
        <Box
          sx={{
            position: "absolute",
            top: 10,
            right: -6,
            backgroundColor: "#FFFFFF",
            borderRadius: "9999px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 8px 20px rgba(0, 0, 0, 0.08)",
            px: 1.5,
            py: 0.55,
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            zIndex: 4,
          }}
        >
          <Box sx={{ color: "#2563EB", display: "flex", alignItems: "center" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            </svg>
          </Box>
          <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: "#1E293B" }}>
            AI sorting...
          </Typography>
        </Box>

        {/* Mockup Card */}
        <Box
          sx={{
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(10px)",
            borderRadius: "16px",
            border: "1px solid #EEF2F6",
            boxShadow: "0 16px 36px -10px rgba(0, 0, 0, 0.07)",
            p: 1.5,
            display: "grid",
            gridTemplateColumns: "90px 1fr",
            gap: 1.5,
            maxWidth: 430,
          }}
        >
          {/* Left Mini-Sidebar */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, pr: 0.75, borderRight: "1px solid #F1F5F9" }}>
            {/* Active Inbox */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#EFF6FF",
                color: "#2563EB",
                borderRadius: "6px",
                px: 1,
                py: 0.5,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                  <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                </svg>
                <Typography sx={{ fontSize: "0.72rem", fontWeight: 700 }}>Inbox</Typography>
              </Box>
              <Box
                sx={{
                  backgroundColor: "#2563EB",
                  color: "#FFFFFF",
                  fontSize: "0.6rem",
                  fontWeight: 700,
                  borderRadius: "9999px",
                  px: 0.5,
                  py: 0.05,
                  lineHeight: 1.2,
                }}
              >
                12
              </Box>
            </Box>

            {/* Sent */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1, py: 0.4, color: "#64748B" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 500 }}>Sent</Typography>
            </Box>

            {/* Drafts */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1, py: 0.4, color: "#64748B" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 500 }}>Drafts</Typography>
            </Box>

            {/* AI Replies */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1, py: 0.4, color: "#64748B" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
              </svg>
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 500 }}>AI Replies</Typography>
            </Box>

            {/* Starred */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1, py: 0.4, color: "#64748B" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 500 }}>Starred</Typography>
            </Box>
          </Box>

          {/* Right Messages Feed */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.9 }}>
            {/* Message 1: Slack */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    backgroundColor: "#EF4444",
                    color: "#FFFFFF",
                    fontSize: "0.6rem",
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  NS
                </Box>
                <Box>
                  <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }}>
                    Slack
                  </Typography>
                  <Typography sx={{ fontSize: "0.66rem", color: "#64748B" }}>
                    New message in #product
                  </Typography>
                </Box>
              </Box>
              <Typography sx={{ fontSize: "0.64rem", color: "#94A3B8", whiteSpace: "nowrap" }}>
                2 min ago
              </Typography>
            </Box>

            {/* Message 2: Notion */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    backgroundColor: "#1E293B",
                    color: "#FFFFFF",
                    fontSize: "0.64rem",
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  N
                </Box>
                <Box>
                  <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }}>
                    Notion
                  </Typography>
                  <Typography sx={{ fontSize: "0.66rem", color: "#64748B" }}>
                    Update on your workspace
                  </Typography>
                </Box>
              </Box>
              <Typography sx={{ fontSize: "0.64rem", color: "#94A3B8", whiteSpace: "nowrap" }}>
                12 min ago
              </Typography>
            </Box>

            {/* Message 3: Stripe */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    backgroundColor: "#6366F1",
                    color: "#FFFFFF",
                    fontSize: "0.64rem",
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  S
                </Box>
                <Box>
                  <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }}>
                    Stripe
                  </Typography>
                  <Typography sx={{ fontSize: "0.66rem", color: "#64748B" }}>
                    Payment received
                  </Typography>
                </Box>
              </Box>
              <Typography sx={{ fontSize: "0.64rem", color: "#94A3B8", whiteSpace: "nowrap" }}>
                1 hour ago
              </Typography>
            </Box>

            {/* Message 4: Customer */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    backgroundColor: "#06B6D4",
                    color: "#FFFFFF",
                    fontSize: "0.64rem",
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  H
                </Box>
                <Box>
                  <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }}>
                    Customer
                  </Typography>
                  <Typography sx={{ fontSize: "0.66rem", color: "#64748B" }}>
                    Re: Support request
                  </Typography>
                </Box>
              </Box>
              <Typography sx={{ fontSize: "0.64rem", color: "#94A3B8", whiteSpace: "nowrap" }}>
                3 hours ago
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Cursive Annotation & Arrow: "Less chaos. More progress." */}
        <Box
          sx={{
            position: "relative",
            mt: 1,
            display: "flex",
            justifyContent: "flex-end",
            pr: 3,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.75 }}>
            {/* Curved Arrow pointing up */}
            <svg width="28" height="28" viewBox="0 0 34 34" fill="none" style={{ transform: "rotate(10deg)" }}>
              <path d="M4 28 C 14 28, 22 22, 24 10" stroke="#6366F1" strokeWidth="1.75" strokeLinecap="round" fill="none" />
              <path d="M18 12 L24 9 L26 15" stroke="#6366F1" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <Box>
              <Typography
                sx={{
                  fontFamily: "'Caveat', 'Comic Sans MS', cursive, sans-serif",
                  fontSize: "1.1rem",
                  color: "#64748B",
                  fontStyle: "italic",
                  lineHeight: 1.05,
                }}
              >
                Less chaos.
              </Typography>
              <Typography
                sx={{
                  fontFamily: "'Caveat', 'Comic Sans MS', cursive, sans-serif",
                  fontSize: "1.1rem",
                  color: "#64748B",
                  fontStyle: "italic",
                  lineHeight: 1.05,
                }}
              >
                More progress.
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Bottom Footer Note */}
      <Box sx={{ position: "relative", zIndex: 2, pt: 1 }}>
        <Typography sx={{ fontSize: "0.75rem", color: "#94A3B8" }}>
          Trusted by forward-thinking teams worldwide.
        </Typography>
      </Box>
    </Box>
  );
}
