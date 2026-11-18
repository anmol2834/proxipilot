"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export function FollowEmailVisual() {
  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 620,
        height: { xs: 390, sm: 430, md: 440 },
        position: "relative",
        borderRadius: "28px",
        overflow: "hidden",
        background: "linear-gradient(145deg, #050B1E 0%, #071136 45%, #0B1953 80%, #0E236E 100%)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "0 25px 60px -15px rgba(2, 6, 23, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
        userSelect: "none",
        mx: "auto",
        display: "block",
      }}
    >
      {/* Ambient Blueprint Grid Texture */}
      <Box
        aria-hidden="true"
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.035) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.035) 1px, transparent 1px)
          `,
          backgroundSize: "36px 36px",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* Ambient Radial Electric Glow */}
      <Box
        aria-hidden="true"
        sx={{
          position: "absolute",
          top: "-15%",
          right: "-10%",
          width: 360,
          height: 360,
          background: "radial-gradient(circle, rgba(37, 99, 235, 0.35) 0%, rgba(29, 78, 216, 0.12) 45%, transparent 70%)",
          filter: "blur(50px)",
          borderRadius: "50%",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* Title: Follow the email */}
      <Typography
        sx={{
          position: "absolute",
          top: { xs: 22, sm: 28 },
          left: { xs: 22, sm: 32 },
          color: "#FFFFFF",
          fontWeight: 600,
          fontSize: { xs: "1rem", sm: "1.125rem" },
          letterSpacing: "-0.01em",
          zIndex: 2,
        }}
      >
        Follow the email
      </Typography>

      {/* Layer 3: Deepest Background Card in Stack */}
      <Box
        sx={{
          position: "absolute",
          top: { xs: 84, sm: 96 },
          left: { xs: 16, sm: 24 },
          width: { xs: 230, sm: 275 },
          height: { xs: 68, sm: 78 },
          backgroundColor: "rgba(12, 19, 48, 0.55)",
          border: "1px solid rgba(255, 255, 255, 0.04)",
          borderRadius: "14px",
          zIndex: 2,
        }}
      />

      {/* Layer 2: Middle Background Card in Stack */}
      <Box
        sx={{
          position: "absolute",
          top: { xs: 78, sm: 88 },
          left: { xs: 22, sm: 30 },
          width: { xs: 230, sm: 275 },
          height: { xs: 68, sm: 78 },
          backgroundColor: "rgba(18, 28, 68, 0.7)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "14px",
          zIndex: 3,
        }}
      />

      {/* Layer 1: Top Active Email Card (Acme Corp) */}
      <Box
        sx={{
          position: "absolute",
          top: { xs: 72, sm: 80 },
          left: { xs: 28, sm: 36 },
          width: { xs: 238, sm: 275 },
          height: { xs: 70, sm: 78 },
          backgroundColor: "rgba(26, 38, 86, 0.94)",
          backdropFilter: "blur(14px)",
          border: "1.5px solid rgba(129, 140, 248, 0.45)",
          borderRadius: "14px",
          boxShadow: "0 12px 30px -4px rgba(0, 0, 0, 0.45), 0 0 15px rgba(99, 102, 241, 0.15)",
          px: { xs: "14px", sm: "18px" },
          display: "flex",
          alignItems: "center",
          gap: { xs: 1.25, sm: 1.75 },
          zIndex: 4,
          transition: "transform 250ms ease, border-color 250ms ease",
          "&:hover": {
            transform: "translateY(-2px)",
            borderColor: "rgba(147, 197, 253, 0.8)",
          },
        }}
      >
        {/* Crisp Mail Outline Icon */}
        <Box
          sx={{
            width: { xs: 34, sm: 40 },
            height: { xs: 34, sm: 40 },
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <rect
              x="2"
              y="4"
              width="20"
              height="16"
              rx="3.5"
              stroke="#FFFFFF"
              strokeWidth="1.8"
            />
            <path
              d="M3 6.5L12 13L21 6.5"
              stroke="#FFFFFF"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Box>

        {/* Text Details */}
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              color: "#FFFFFF",
              fontWeight: 700,
              fontSize: { xs: "0.95rem", sm: "1.0625rem" },
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
            }}
          >
            Acme Corp
          </Typography>
          <Typography
            sx={{
              color: "#94A3B8",
              fontSize: { xs: "0.78125rem", sm: "0.84rem" },
              fontWeight: 500,
              mt: 0.35,
              whiteSpace: "nowrap",
            }}
          >
            Pricing for 500 licenses
          </Typography>
        </Box>
      </Box>

      {/* SVG Connecting Curved Path & Animated Particle */}
      <Box
        component="svg"
        viewBox="0 0 620 440"
        sx={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 5,
        }}
      >
        <defs>
          <linearGradient id="flowBeamGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>

          <filter id="bluePulseGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* The Bold Blue Connecting Flow Path */}
        <path
          d="M 311 119 H 414 Q 442 119 442 147 V 298"
          fill="none"
          stroke="url(#flowBeamGrad)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* Downward Arrow Head pointing into the Reply Sent card */}
        <polygon
          points="436,290 442,300 448,290"
          fill="#2563EB"
        />

        {/* Animated Traveling Particle along the Path */}
        <circle r="4" fill="#FFFFFF" filter="url(#bluePulseGlow)">
          <animateMotion
            path="M 311 119 H 414 Q 442 119 442 147 V 298"
            dur="2.2s"
            repeatCount="indefinite"
          />
        </circle>
      </Box>

      {/* Anchor Connection Node on right edge of Acme Corp card */}
      <Box
        sx={{
          position: "absolute",
          top: { xs: 104, sm: 111 },
          left: { xs: 260, sm: 303 },
          width: 16,
          height: 16,
          borderRadius: "50%",
          backgroundColor: "#0B1746",
          border: "2.5px solid #3B82F6",
          boxShadow: "0 0 10px rgba(59, 130, 246, 0.9)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 6,
        }}
      >
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: "#FFFFFF",
          }}
        />
      </Box>

      {/* Floating Pill: Routed to Sales */}
      <Box
        sx={{
          position: "absolute",
          top: { xs: 195, sm: 215 },
          left: { xs: "71%", sm: 442 },
          transform: "translate(-50%, -50%)",
          backgroundColor: "#1D4ED8",
          color: "#FFFFFF",
          px: { xs: "14px", sm: "18px" },
          py: { xs: "6px", sm: "7px" },
          borderRadius: "9999px",
          boxShadow: "0 8px 20px -2px rgba(29, 78, 216, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.3)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          zIndex: 6,
          transition: "transform 200ms ease, box-shadow 200ms ease",
          "&:hover": {
            transform: "translate(-50%, -52%) scale(1.04)",
            boxShadow: "0 10px 24px -2px rgba(29, 78, 216, 0.75)",
          },
        }}
      >
        <Typography
          sx={{
            color: "#FFFFFF",
            fontSize: { xs: "0.78125rem", sm: "0.85rem" },
            fontWeight: 600,
            whiteSpace: "nowrap",
            letterSpacing: "-0.01em",
            lineHeight: 1.2,
          }}
        >
          Routed to Sales
        </Typography>
      </Box>

      {/* Bottom Success Card: Reply sent */}
      <Box
        sx={{
          position: "absolute",
          bottom: { xs: 20, sm: 30 },
          right: { xs: 16, sm: 28 },
          width: { xs: "calc(100% - 32px)", sm: 355 },
          backgroundColor: "#FFFFFF",
          borderRadius: "18px",
          boxShadow: "0 20px 45px -8px rgba(0, 0, 0, 0.45), 0 2px 8px rgba(0, 0, 0, 0.08)",
          p: { xs: "14px 18px", sm: "18px 22px" },
          display: "flex",
          alignItems: "center",
          gap: { xs: 1.5, sm: 2 },
          zIndex: 6,
          transition: "transform 250ms ease, box-shadow 250ms ease",
          "&:hover": {
            transform: "translateY(-2px)",
            boxShadow: "0 24px 50px -8px rgba(0, 0, 0, 0.5)",
          },
        }}
      >
        {/* Emerald Checkmark Badge */}
        <Box
          sx={{
            width: { xs: 38, sm: 42 },
            height: { xs: 38, sm: 42 },
            borderRadius: "50%",
            backgroundColor: "#DCFCE7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 13L9.5 17.5L19 7"
              stroke="#16A34A"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Box>

        {/* Content */}
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              color: "#0F172A",
              fontWeight: 700,
              fontSize: { xs: "1rem", sm: "1.1rem" },
              lineHeight: 1.2,
              letterSpacing: "-0.015em",
            }}
          >
            Reply sent
          </Typography>
          <Typography
            sx={{
              color: "#64748B",
              fontSize: { xs: "0.78125rem", sm: "0.85rem" },
              fontWeight: 500,
              mt: 0.35,
              whiteSpace: "nowrap",
            }}
          >
            Acme Corp received the pricing details.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}