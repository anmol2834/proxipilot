"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Link from "next/link";

interface PlanItem {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  price: string;
  period?: string;
  buttonText: string;
  buttonHref: string;
  isPopular?: boolean;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
}

const PLANS: PlanItem[] = [
  {
    id: "starter",
    name: "Starter",
    subtitle: "For individuals and small teams",
    description: "Get started with AI-powered email assistance.",
    price: "$29",
    period: "/ month",
    buttonText: "Get started →",
    buttonHref: "/signup?plan=starter",
    iconBg: "#EFF6FF",
    iconColor: "#2563EB",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    id: "growth",
    name: "Growth",
    subtitle: "For growing teams",
    description: "Automate more conversations and streamline your workflow.",
    price: "$99",
    period: "/ month",
    buttonText: "Get started →",
    buttonHref: "/signup?plan=growth",
    iconBg: "#ECFDF5",
    iconColor: "#059669",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: "business",
    name: "Business",
    subtitle: "For established organizations",
    description: "Advanced control, deeper integrations, and team collaboration.",
    price: "$249",
    period: "/ month",
    buttonText: "Get started →",
    buttonHref: "/signup?plan=business",
    isPopular: true,
    iconBg: "#EEF2FF",
    iconColor: "#4F46E5",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="16" height="20" x="4" y="2" rx="2" />
        <path d="M9 22v-4h6v4" />
        <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
      </svg>
    ),
  },
  {
    id: "enterprise",
    name: "Enterprise",
    subtitle: "For large organizations",
    description: "Custom setup, dedicated support, and flexible deployment.",
    price: "Let's talk",
    buttonText: "Contact sales →",
    buttonHref: "/contact",
    iconBg: "#F1F5F9",
    iconColor: "#475569",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
        <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
        <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
        <path d="M10 6h4" />
        <path d="M10 10h4" />
        <path d="M10 14h4" />
        <path d="M10 18h4" />
      </svg>
    ),
  },
];

export function PricingPlanCards() {
  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 1240,
        mx: "auto",
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, 1fr)",
          lg: "repeat(4, 1fr)",
        },
        gap: { xs: 3, md: 3 },
        alignItems: "stretch",
      }}
    >
      {PLANS.map((plan) => {
        const isPopular = plan.isPopular;

        return (
          <Box
            key={plan.id}
            sx={{
              position: "relative",
              backgroundColor: "#FFFFFF",
              borderRadius: "22px",
              border: isPopular ? "2px solid #6366F1" : "1px solid #EEF2F6",
              boxShadow: isPopular
                ? "0 16px 36px -4px rgba(99, 102, 241, 0.16), 0 0 0 1px rgba(99, 102, 241, 0.15)"
                : "0 6px 24px rgba(0, 0, 0, 0.03)",
              p: { xs: 3, sm: 3.5 },
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              transition: "transform 200ms ease, box-shadow 200ms ease",
              "&:hover": {
                transform: "translateY(-4px)",
                boxShadow: isPopular
                  ? "0 20px 42px -4px rgba(99, 102, 241, 0.22)"
                  : "0 12px 30px rgba(0, 0, 0, 0.06)",
              },
            }}
          >
            {/* "Most Popular" Pill Badge on Top Right */}
            {isPopular && (
              <Box
                sx={{
                  position: "absolute",
                  top: 18,
                  right: 18,
                  backgroundColor: "#4F46E5",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  px: 1.5,
                  py: 0.5,
                  borderRadius: "9999px",
                  letterSpacing: "0.02em",
                  boxShadow: "0 2px 8px rgba(79, 70, 229, 0.35)",
                }}
              >
                Most Popular
              </Box>
            )}

            {/* Top Info Area */}
            <Box>
              {/* Icon Container */}
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: "12px",
                  backgroundColor: plan.iconBg,
                  color: plan.iconColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mb: 2.25,
                }}
              >
                {plan.icon}
              </Box>

              {/* Title & Subtitle */}
              <Typography
                sx={{
                  fontSize: "1.375rem",
                  fontWeight: 800,
                  color: "#0F172A",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                  mb: 0.5,
                }}
              >
                {plan.name}
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.85rem",
                  color: "#64748B",
                  mb: 2.5,
                  minHeight: 20,
                }}
              >
                {plan.subtitle}
              </Typography>

              {/* Description */}
              <Typography
                sx={{
                  fontSize: "0.875rem",
                  color: "#475569",
                  lineHeight: 1.55,
                  mb: 3,
                  minHeight: 44,
                }}
              >
                {plan.description}
              </Typography>
            </Box>

            {/* Bottom Pricing & CTA Area */}
            <Box sx={{ pt: 2, borderTop: "1px solid #F1F5F9" }}>
              <Box sx={{ display: "flex", alignItems: "baseline", mb: 2.5, minHeight: 40 }}>
                <Typography
                  sx={{
                    fontSize: plan.price.startsWith("$") ? "2rem" : "1.75rem",
                    fontWeight: 800,
                    color: "#0F172A",
                    letterSpacing: "-0.025em",
                    lineHeight: 1,
                  }}
                >
                  {plan.price}
                </Typography>
                {plan.period && (
                  <Typography
                    sx={{
                      fontSize: "0.875rem",
                      color: "#64748B",
                      ml: 0.75,
                      fontWeight: 500,
                    }}
                  >
                    {plan.period}
                  </Typography>
                )}
              </Box>

              {/* CTA Button */}
              <Button
                component={Link}
                href={plan.buttonHref}
                variant={isPopular ? "contained" : "outlined"}
                fullWidth
                sx={{
                  backgroundColor: isPopular ? "#4F46E5" : "#F1F5F9",
                  color: isPopular ? "#FFFFFF" : "#0F172A",
                  border: isPopular ? "none" : "1px solid #E2E8F0",
                  textTransform: "none",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  py: 1.25,
                  borderRadius: "12px",
                  boxShadow: isPopular ? "0 4px 14px rgba(79, 70, 229, 0.3)" : "none",
                  transition: "all 180ms ease",
                  "&:hover": {
                    backgroundColor: isPopular ? "#4338CA" : "#E2E8F0",
                    borderColor: isPopular ? "none" : "#CBD5E1",
                    boxShadow: isPopular ? "0 6px 18px rgba(79, 70, 229, 0.4)" : "none",
                  },
                }}
              >
                {plan.buttonText}
              </Button>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
