"use client";

import React from "react";
import Box from "@mui/material/Box";
import { TrustedLogosStrip } from "./TrustedLogosStrip";
import { TestimonialCarousel } from "./TestimonialCarousel";
import { SocialPillarsGrid } from "./SocialPillarsGrid";

export function SocialProofVisualStage() {
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
      {/* 1. Trusted Brands Logos Strip */}
      <TrustedLogosStrip />

      {/* 2. Interactive Testimonial Carousel */}
      <TestimonialCarousel />

      {/* 3. 4-Pillars Grid + Bottom Anchor */}
      <SocialPillarsGrid />
    </Box>
  );
}
