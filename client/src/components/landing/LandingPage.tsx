"use client";

import React from "react";
import Box from "@mui/material/Box";
import { LandingNavbar } from "./LandingNavbar";
import { HeroSection } from "./HeroSection";
import { ProblemSection } from "./ProblemSection";
import { ProductShowcaseSection } from "./ProductShowcaseSection";
import { AIIntelligenceSection } from "./AIIntelligenceSection";
import { AIControlSection } from "./AIControlSection";
import { OrganizationSection } from "./OrganizationSection";
import { AnalyticsSection } from "./AnalyticsSection";
import { SocialProofSection } from "./SocialProofSection";
import { PricingSection } from "./PricingSection";
import { FAQSection } from "./FAQSection";
import { FinalCTASection } from "./FinalCTASection";
import { LandingFooter } from "./LandingFooter";

export function LandingPage() {
  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: "100vw",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#FFFFFF",
        color: "#111827",
        overflowX: "clip",
      }}
    >
      {/* Accessible Skip Link for Keyboard & Screen Reader Users (SEO / WCAG 2.1 AA) */}
      <Box
        component="a"
        href="#main-content"
        sx={{
          position: "absolute",
          top: -100,
          left: 16,
          zIndex: 9999,
          backgroundColor: "#2563EB",
          color: "#FFFFFF",
          padding: "8px 16px",
          borderRadius: "6px",
          fontWeight: 700,
          textDecoration: "none",
          transition: "top 0.2s ease",
          "&:focus": {
            top: 16,
          },
        }}
      >
        Skip to main content
      </Box>

      <LandingNavbar />

      <Box
        component="main"
        id="main-content"
        tabIndex={-1}
        sx={{
          flexGrow: 1,
          width: "100%",
          maxWidth: "100vw",
          overflowX: "clip",
          outline: "none",
        }}
      >
        <HeroSection />
        <ProblemSection />
        <ProductShowcaseSection />
        <AIIntelligenceSection />
        <AIControlSection />
        <OrganizationSection />
        <AnalyticsSection />
        <SocialProofSection />
        <PricingSection />
        <FAQSection />
        <FinalCTASection />
      </Box>

      <LandingFooter />
    </Box>
  );
}
