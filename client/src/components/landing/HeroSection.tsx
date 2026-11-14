"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Link from "next/link";
import { Container, Section } from "./layout";
import { FadeUp } from "./animations";
import { HeroPipelineVisual, FeatureStrip } from "./hero";
import { ExpandableCtaButton } from "@/components/ui/ExpandableCtaButton";

export function HeroSection() {
  return (
    <Section
      id="hero"
      bgVariant="transparent"
      textureVariant="kencode"
      spacing="none"
      sx={{ pt: { xs: 2, sm: 3, md: 3.5 }, pb: { xs: 6, sm: 8, md: 10 } }}
    >
      <Container size="xl">
        {/* Hero Header Area */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            maxWidth: 880,
            mx: "auto",
            pt: 0,
            mb: { xs: 3, sm: 3.5, md: 4.5 },
          }}
        >
          {/* Eyebrow Badge Pill */}
          <FadeUp delayMs={100}>
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                mb: { xs: 2, sm: 2.5 },
                px: { xs: 1.5, sm: 2 },
                py: { xs: 0.5, sm: 0.75 },
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "9999px",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
                  fill="#635BFF"
                  stroke="#635BFF"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  fontSize: { xs: "0.71875rem", sm: "0.8125rem" },
                  color: "#334155",
                  letterSpacing: "0.01em",
                }}
              >
                AI-Powered Email Automation for Modern Businesses
              </Typography>
            </Box>
          </FadeUp>

          {/* Main Headline (H1) */}
          <FadeUp delayMs={200}>
            <Typography
              variant="h1"
              component="h1"
              sx={{
                fontWeight: 800,
                fontSize: { xs: "2.125rem", sm: "3.25rem", md: "4.25rem", lg: "4.75rem" },
                lineHeight: { xs: 1.15, sm: 1.1, md: 1.08 },
                letterSpacing: "-0.035em",
                color: "#111827",
                mb: { xs: 1.75, sm: 2.25 },
              }}
            >
              Your inbox shouldn’t{" "}
              <Box
                component="span"
                sx={{
                  display: "inline-block",
                  background: "linear-gradient(135deg, #4338CA 0%, #4F46E5 45%, #3B82F6 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                run your business.
              </Box>
            </Typography>
          </FadeUp>

          {/* Subtitle */}
          <FadeUp delayMs={300}>
            <Typography
              variant="body1"
              sx={{
                fontSize: { xs: "0.9375rem", sm: "1.0625rem", md: "1.1875rem" },
                lineHeight: 1.55,
                color: "#64748B",
                maxWidth: 680,
                mb: { xs: 3, sm: 3.5 },
                px: { xs: 1, sm: 0 },
              }}
            >
              AI that understands your emails, your business, and what should happen next.
            </Typography>
          </FadeUp>

          {/* Primary Action CTA */}
          <FadeUp delayMs={400}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: "100%",
              }}
            >
              <ExpandableCtaButton
                href="/signup"
                text="Get started free"
                size="lg"
              />
            </Box>
          </FadeUp>
        </Box>

        {/* The 3-Part Connected Pipeline Canvas */}
        <FadeUp delayMs={500}>
          <HeroPipelineVisual />
        </FadeUp>

        {/* Bottom Floating 5-Pillar Feature Strip */}
        <FadeUp delayMs={600}>
          <FeatureStrip />
        </FadeUp>
      </Container>
    </Section>
  );
}
