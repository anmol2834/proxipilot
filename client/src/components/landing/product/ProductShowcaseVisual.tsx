"use client";

import React from "react";
import Box from "@mui/material/Box";
import { ProductTabSwitcher } from "./ProductTabSwitcher";
import { ProductCockpitFrame } from "./ProductCockpitFrame";
import { ProductTopLeftNote, ProductBottomRightNote } from "./ProductFloatingNotes";

export function ProductShowcaseVisual() {
  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        maxWidth: 1240,
        mx: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* 4 Interactive Feature Switcher Pills */}
      <ProductTabSwitcher />

      {/* Frame Container with Floating Badges and Ambient Glow */}
      <Box
        sx={{
          position: "relative",
          width: "100%",
          display: "flex",
          justifyContent: "center",
        }}
      >
        {/* Ambient Radial Glow behind the Frame */}
        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: { xs: "320px", sm: "600px", md: "850px" },
            height: { xs: "280px", sm: "450px", md: "550px" },
            background:
              "radial-gradient(ellipse at center, rgba(99, 91, 255, 0.08) 0%, rgba(79, 124, 255, 0.03) 50%, transparent 75%)",
            filter: "blur(60px)",
            borderRadius: "50%",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />

        {/* Faint Orbital Curved Dashed Lines behind Frame */}
        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            inset: -40,
            pointerEvents: "none",
            zIndex: 1,
            display: { xs: "none", md: "block" },
          }}
        >
          <svg width="100%" height="100%" viewBox="0 0 1200 680" fill="none">
            {/* Top Left Orbit Arc */}
            <path
              d="M 40 280 C 40 120, 160 40, 320 40"
              stroke="#E2E8F0"
              strokeWidth="1.5"
              strokeDasharray="6 6"
            />
            {/* Bottom Right Orbit Arc */}
            <path
              d="M 880 640 C 1040 640, 1160 560, 1160 400"
              stroke="#E2E8F0"
              strokeWidth="1.5"
              strokeDasharray="6 6"
            />
          </svg>
        </Box>

        {/* Floating Handwritten Notes */}
        <ProductTopLeftNote />
        <ProductBottomRightNote />

        {/* The macOS Cockpit Window Frame */}
        <ProductCockpitFrame />
      </Box>
    </Box>
  );
}
