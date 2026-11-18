"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { Container, Section } from "./layout";
import { FadeUp } from "./animations";
import { FollowEmailVisual } from "./FollowEmailVisual";

export function AIIntelligenceSection() {
  return (
    <Section
      id="email-routing"
      bgVariant="transparent"
      textureVariant="clean"
      spacing="none"
      sx={{
        backgroundColor: "#FAF8F5",
        pt: { xs: 7, sm: 9, md: 11, lg: 13 },
        pb: { xs: 8, sm: 10, md: 12, lg: 14 },
        borderTop: "1px solid rgba(226, 232, 240, 0.7)",
        borderBottom: "1px solid rgba(226, 232, 240, 0.7)",
      }}
    >
      <Container size="xl">
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", lg: "row" },
            alignItems: "center",
            justifyContent: "space-between",
            gap: { xs: 5, md: 6, lg: 7, xl: 9 },
            width: "100%",
          }}
        >
          {/* Left Column: Brand, Headline, Subtitle, & CTA */}
          <Box
            sx={{
              flex: 1,
              maxWidth: { xs: "100%", lg: 520, xl: 560 },
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              textAlign: "left",
            }}
          >
            {/* ProxiPilot Logo Brandmark */}
            <FadeUp delayMs={100}>
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 1.5,
                  mb: { xs: 2.5, sm: 3, md: 3.5 },
                }}
              >
                <Box
                  component="img"
                  src="/Proxipilot logo.svg"
                  alt="ProxiPilot"
                  sx={{
                    width: { xs: 32, sm: 36 },
                    height: { xs: 32, sm: 36 },
                    objectFit: "contain",
                    display: "block",
                  }}
                />
                <Typography
                  component="span"
                  sx={{
                    fontWeight: 700,
                    fontSize: { xs: "1.375rem", sm: "1.5rem" },
                    letterSpacing: "-0.025em",
                    color: "#0F172A",
                    fontFamily: "var(--font-inter), system-ui, -apple-system, sans-serif",
                    lineHeight: 1,
                  }}
                >
                  ProxiPilot
                </Typography>
              </Box>
            </FadeUp>

            {/* Main Headline */}
            <FadeUp delayMs={200}>
              <Typography
                variant="h2"
                component="h2"
                sx={{
                  fontWeight: 800,
                  fontSize: { xs: "2.35rem", sm: "3rem", md: "3.5rem", lg: "3.75rem" },
                  lineHeight: { xs: 1.15, sm: 1.1, md: 1.08 },
                  letterSpacing: "-0.035em",
                  color: "#0F172A",
                  mb: { xs: 2, sm: 2.5 },
                }}
              >
                Important emails<br />
                shouldn&apos;t have<br />
                <Box component="span" sx={{ color: "#1D4ED8" }}>
                  to wait.
                </Box>
              </Typography>
            </FadeUp>

            {/* Subtitle / Paragraph */}
            <FadeUp delayMs={300}>
              <Typography
                variant="body1"
                sx={{
                  fontSize: { xs: "1rem", sm: "1.125rem", md: "1.1875rem" },
                  lineHeight: 1.6,
                  color: "#475569",
                  maxWidth: 480,
                  mb: { xs: 3.5, sm: 4 },
                  fontWeight: 400,
                }}
              >
                ProxiPilot finds the emails that matter, routes them to the right team, and handles routine replies.
              </Typography>
            </FadeUp>

            {/* Explore email automation CTA Link */}
            <FadeUp delayMs={400}>
              <Box
                component={Link}
                href="/features"
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 1,
                  color: "#1D4ED8",
                  fontWeight: 700,
                  fontSize: { xs: "1rem", sm: "1.0625rem" },
                  textDecoration: "none",
                  transition: "all 200ms cubic-bezier(0.4, 0, 0.2, 1)",
                  "&:hover": {
                    color: "#1E40AF",
                    "& .arrow-icon": {
                      transform: "translateX(5px)",
                    },
                  },
                }}
              >
                Explore email automation
                <Box
                  component="span"
                  className="arrow-icon"
                  sx={{
                    display: "inline-block",
                    transition: "transform 200ms ease",
                    fontSize: "1.25rem",
                    lineHeight: 1,
                  }}
                >
                  →
                </Box>
              </Box>
            </FadeUp>
          </Box>

          {/* Right Column: Visual Stage (The Dark Blueprint Canvas Card) */}
          <Box
            sx={{
              flex: 1,
              width: "100%",
              maxWidth: { xs: "100%", sm: 580, lg: 640 },
              display: "flex",
              justifyContent: { xs: "center", lg: "flex-end" },
              alignItems: "center",
            }}
          >
            <FollowEmailVisual />
          </Box>
        </Box>
      </Container>
    </Section>
  );
}