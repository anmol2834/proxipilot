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
      <LandingNavbar />
      <Box component="main" sx={{ flexGrow: 1, width: "100%", maxWidth: "100vw", overflowX: "clip" }}>
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
