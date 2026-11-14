import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { Container, Section } from "./layout";
import { FadeUp } from "./animations";
import { PricingVisualStage } from "./pricing";
import { landingConfig } from "@/config/landing";

export function PricingSection() {
  const { pricing } = landingConfig.sections;

  return (
    <Section
      id={pricing.id}
      bgVariant="soft"
      textureVariant="clean"
      spacing="none"
      sx={{ pt: { xs: 8, sm: 10, md: 12 }, pb: { xs: 8, sm: 10, md: 12 } }}
      hasTopBorder
    >
      <Container size="xl">
        {/* Section Header */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            maxWidth: 820,
            mx: "auto",
            mb: { xs: 5, sm: 6, md: 7 },
          }}
        >
          {/* Eyebrow Pill Badge: PRICING */}
          <FadeUp delayMs={100}>
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                mb: { xs: 2, sm: 2.25 },
                px: { xs: 2, sm: 2.25 },
                py: { xs: 0.6, sm: 0.75 },
                backgroundColor: "#EEF2FF",
                borderRadius: "9999px",
                border: "1px solid rgba(99, 102, 241, 0.15)",
              }}
            >
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: { xs: "0.6875rem", sm: "0.75rem" },
                  color: "#4F46E5",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                {pricing.badge}
              </Typography>
            </Box>
          </FadeUp>

          {/* Main Headline (H2): Simple plans for real teams. */}
          <FadeUp delayMs={200}>
            <Typography
              variant="h2"
              component="h2"
              sx={{
                fontWeight: 800,
                fontSize: { xs: "2.125rem", sm: "2.75rem", md: "3.5rem" },
                lineHeight: { xs: 1.15, sm: 1.12, md: 1.1 },
                letterSpacing: "-0.035em",
                color: "#0F172A",
                mb: { xs: 1.75, sm: 2 },
              }}
            >
              Simple plans for{" "}
              <Box
                component="span"
                sx={{
                  display: "inline-block",
                  background: "linear-gradient(135deg, #4338CA 0%, #4F46E5 45%, #2563EB 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                real teams.
              </Box>
            </Typography>
          </FadeUp>

          {/* Subtitle */}
          <FadeUp delayMs={300}>
            <Typography
              variant="body1"
              sx={{
                fontSize: { xs: "0.9375rem", sm: "1.0625rem", md: "1.125rem" },
                lineHeight: 1.6,
                color: "#64748B",
                maxWidth: 740,
                px: { xs: 1, sm: 0 },
              }}
            >
              {pricing.subtitle}
            </Typography>
          </FadeUp>
        </Box>

        {/* Pricing Plan Cards Visual Stage */}
        <FadeUp delayMs={400}>
          <PricingVisualStage />
        </FadeUp>
      </Container>
    </Section>
  );
}
