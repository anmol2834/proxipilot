"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Link from "next/link";
import { Container } from "./layout";
import { FadeUp } from "./animations";
import { FinalCtaCanvas } from "./cta";
import { landingConfig } from "@/config/landing";
import { ExpandableCtaButton } from "@/components/ui/ExpandableCtaButton";

export function FinalCTASection() {
  const { cta } = landingConfig.sections;

  return (
    <Box
      component="section"
      id={cta.id}
      sx={{
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#090A0F",
        borderTop: "1px solid rgba(255, 255, 255, 0.08)",
        pt: { xs: 9, sm: 11, md: 13 },
        pb: { xs: 10, sm: 12, md: 14 },
      }}
    >
      {/* Animated Starry Night Sky Background (Uiverse.io by amir_6539) */}
      <div className="final-cta-starry-bg" aria-hidden="true">
        <div id="stars" />
        <div id="stars2" />
        <div id="stars3" />
      </div>

      <Container size="xl" sx={{ position: "relative", zIndex: 1 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1.1fr 0.9fr" },
            gap: { xs: 6, md: 4 },
            alignItems: "center",
          }}
        >
          {/* ============================================================ */}
          {/* LEFT COLUMN: Headings, Action Button, Trust Note             */}
          {/* ============================================================ */}
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: { xs: "center", md: "flex-start" },
              textAlign: { xs: "center", md: "left" },
              maxWidth: 580,
            }}
          >
            {/* Eyebrow: FINAL CTA */}
            <FadeUp delayMs={100}>
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  letterSpacing: "0.12em",
                  color: "#94A3B8",
                  textTransform: "uppercase",
                  mb: 2,
                }}
              >
                {cta.badge}
              </Typography>
            </FadeUp>

            {/* Headline H2: Your inbox shouldn't run your business. */}
            <FadeUp delayMs={200}>
              <Typography
                variant="h2"
                component="h2"
                sx={{
                  fontWeight: 800,
                  fontSize: { xs: "2.25rem", sm: "3rem", md: "3.75rem" },
                  lineHeight: 1.1,
                  letterSpacing: "-0.035em",
                  color: "#FFFFFF",
                  mb: 2,
                }}
              >
                Your inbox shouldn&apos;t{" "}
                <Box
                  component="span"
                  sx={{
                    display: "inline-block",
                    background: "linear-gradient(135deg, #60A5FA 0%, #3B82F6 45%, #6366F1 100%)",
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
                sx={{
                  fontSize: { xs: "1rem", sm: "1.15rem" },
                  lineHeight: 1.6,
                  color: "#94A3B8",
                  mb: 3.5,
                  maxWidth: 480,
                }}
              >
                {cta.subheadline}
              </Typography>
            </FadeUp>

            {/* Action CTA Button */}
            <FadeUp delayMs={400}>
              <ExpandableCtaButton
                href={cta.buttonHref}
                text={cta.buttonText.replace(/→/g, "").trim()}
                size="lg"
                variant="blue"
                style={{ marginBottom: "16px" }}
              />
            </FadeUp>

            {/* Trust Note */}
            <FadeUp delayMs={450}>
              <Typography
                sx={{
                  color: "#64748B",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                }}
              >
                {cta.guaranteeNote}
              </Typography>
            </FadeUp>
          </Box>

          {/* ============================================================ */}
          {/* RIGHT COLUMN: 3-Stage Visual Loop Pipeline                   */}
          {/* ============================================================ */}
          <FadeUp delayMs={300}>
            <FinalCtaCanvas />
          </FadeUp>
        </Box>
      </Container>

      {/* ============================================================ */}
      {/* Bottom Glowing Laser Light Horizon Accent                    */}
      {/* ============================================================ */}
      <Box
        sx={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "1px",
          backgroundColor: "rgba(59, 130, 246, 0.4)",
          boxShadow: "0 0 40px 6px rgba(59, 130, 246, 0.6), 0 0 100px 15px rgba(99, 102, 241, 0.3)",
          zIndex: 1,
        }}
      />
      <Box
        sx={{
          position: "absolute",
          bottom: -80,
          left: "50%",
          transform: "translateX(-50%)",
          width: "70%",
          height: 160,
          borderRadius: "100%",
          background: "radial-gradient(ellipse at center, rgba(37, 99, 235, 0.3) 0%, rgba(99, 102, 241, 0.1) 40%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />
    </Box>
  );
}
