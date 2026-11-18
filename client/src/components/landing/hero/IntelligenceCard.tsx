"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { PipelineScenario, PIPELINE_SCENARIOS } from "./pipelineScenarios";

export interface IntelligenceCardProps {
  scenario?: PipelineScenario;
  activeStepCount?: number; // 0 to 5
  isAnalyzing?: boolean;
  isVerified?: boolean;
}

export function IntelligenceCard({
  scenario = PIPELINE_SCENARIOS[0],
  activeStepCount = 5,
  isAnalyzing = false,
  isVerified = true,
}: IntelligenceCardProps) {
  // Business-focused intelligence steps (strictly avoids revealing proprietary system architecture)
  const steps = [
    {
      id: "inquiry",
      label: "Inquiry Understanding",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="#635BFF" strokeWidth="2" />
          <path d="M12 16v-4M12 8h.01" stroke="#635BFF" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
      iconBg: "rgba(99, 91, 255, 0.1)",
      valuePill: (
        <Box
          sx={{
            backgroundColor: "#EEF2FF",
            color: "#4338CA",
            fontSize: "0.6875rem",
            fontWeight: 700,
            px: 1.25,
            py: 0.5,
            borderRadius: "6px",
            border: "1px solid rgba(99, 91, 255, 0.15)",
            whiteSpace: "nowrap",
          }}
        >
          {scenario.intelligence.inquiryType}
        </Box>
      ),
    },
    {
      id: "account",
      label: "Account Context",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            fill="#0D9488"
          />
        </svg>
      ),
      iconBg: "rgba(13, 148, 136, 0.12)",
      valuePill: (
        <Box
          sx={{
            backgroundColor: "#F0FDFA",
            color: "#0F766E",
            fontSize: "0.6875rem",
            fontWeight: 600,
            px: 1.25,
            py: 0.5,
            borderRadius: "6px",
            border: "1px solid rgba(13, 148, 136, 0.2)",
            whiteSpace: "nowrap",
          }}
        >
          {scenario.intelligence.accountContext}
        </Box>
      ),
    },
    {
      id: "specifics",
      label: "Key Specifics",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            stroke="#2563EB"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
      iconBg: "rgba(37, 99, 235, 0.1)",
      valuePill: (
        <Box
          sx={{
            backgroundColor: "#EFF6FF",
            color: "#1E40AF",
            fontSize: "0.6875rem",
            fontWeight: 600,
            px: 1.25,
            py: 0.5,
            borderRadius: "6px",
            border: "1px solid rgba(37, 99, 235, 0.15)",
            whiteSpace: "nowrap",
          }}
        >
          {scenario.intelligence.keySpecifics}
        </Box>
      ),
    },
    {
      id: "grounding",
      label: "Business Grounding",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z"
            stroke="#D97706"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
      iconBg: "rgba(217, 119, 6, 0.1)",
      valuePill: (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          {scenario.intelligence.knowledgeGrounded.map((tag, idx) => (
            <Box
              key={idx}
              sx={{
                backgroundColor: "#FFFBEB",
                color: "#92400E",
                fontSize: "0.6875rem",
                fontWeight: 600,
                px: 1,
                py: 0.35,
                borderRadius: "6px",
                border: "1px solid rgba(217, 119, 6, 0.2)",
                whiteSpace: "nowrap",
              }}
            >
              {tag}
            </Box>
          ))}
        </Box>
      ),
    },
    {
      id: "safety",
      label: "Safety & Policy Check",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
            fill="#16A34A"
          />
          <path
            d="M9 12l2 2 4-4"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
      iconBg: "transparent",
      valuePill: (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.6,
            color: "#166534",
            fontWeight: 700,
            fontSize: "0.71875rem",
            backgroundColor: "#F0FDF4",
            px: 1.2,
            py: 0.4,
            borderRadius: "6px",
            border: "1px solid rgba(22, 163, 74, 0.2)",
          }}
        >
          <Box sx={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#16A34A" }} />
          {scenario.intelligence.policyStatus}
        </Box>
      ),
    },
  ];

  const progressPercentage = Math.min(Math.round((activeStepCount / 5) * 100), 100);

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: { xs: "100%", sm: 480, lg: 495 },
        backgroundColor: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "18px",
        boxShadow: "0 16px 40px -8px rgba(79, 70, 229, 0.12), 0 4px 12px -2px rgba(0, 0, 0, 0.04)",
        p: { xs: 1.5, sm: 2.2 },
        position: "relative",
        zIndex: 3,
        overflow: "hidden",
        transition: "all 300ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* Top Subtle Animated Progress Line */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          backgroundColor: "#F1F5F9",
        }}
      >
        <Box
          sx={{
            height: "100%",
            width: `${progressPercentage}%`,
            background: "linear-gradient(90deg, #635BFF, #3B82F6, #10B981)",
            transition: "width 400ms cubic-bezier(0.4, 0, 0.2, 1)",
            boxShadow: "0 0 8px rgba(99, 91, 255, 0.6)",
          }}
        />
      </Box>

      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pb: 2,
          mb: 2,
          borderBottom: "1px solid #F1F5F9",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          <Box
            sx={{
              width: 26,
              height: 26,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/Proxipilot logo.svg"
              alt="ProxiPilot Intelligence"
              width={22}
              height={22}
              style={{ objectFit: "contain", display: "block" }}
            />
          </Box>
          <Typography
            variant="h6"
            component="div"
            sx={{
              fontWeight: 700,
              fontSize: { xs: "0.875rem", sm: "0.9375rem" },
              color: "#0F172A",
              letterSpacing: "-0.015em",
            }}
          >
            ProxiPilot Intelligence
          </Typography>
        </Box>

        {/* Dynamic Status Pill */}
        {isAnalyzing ? (
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              backgroundColor: "rgba(99, 91, 255, 0.08)",
              border: "1px solid rgba(99, 91, 255, 0.2)",
              borderRadius: "9999px",
              px: 1.25,
              py: 0.4,
            }}
          >
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: "#635BFF",
                animation: "analyzeBadgePulse 1.4s infinite ease-in-out",
              }}
            />
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                fontSize: "0.6875rem",
                color: "#635BFF",
              }}
            >
              Analyzing Context...
            </Typography>
          </Box>
        ) : isVerified ? (
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.6,
              backgroundColor: "#DCFCE7",
              border: "1px solid rgba(22, 163, 74, 0.25)",
              borderRadius: "9999px",
              px: 1.25,
              py: 0.4,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path
                d="M2.5 6.5l2.5 2.5 4.5-5"
                stroke="#16A34A"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                fontSize: "0.6875rem",
                color: "#166534",
              }}
            >
              Grounded &amp; Verified
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.6,
              backgroundColor: "#F1F5F9",
              borderRadius: "9999px",
              px: 1.25,
              py: 0.4,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                fontSize: "0.6875rem",
                color: "#64748B",
              }}
            >
              Listening to Inbox
            </Typography>
          </Box>
        )}
      </Box>

      {/* Intelligence Row List with Staggered Transition */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
        {steps.map((step, idx) => {
          const isRowActive = idx < activeStepCount;
          const isCurrentAnalyzing = isAnalyzing && idx === activeStepCount - 1;

          return (
            <Box
              key={step.id}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1.5,
                p: { xs: 1, sm: 1.2 },
                borderRadius: "10px",
                backgroundColor: isCurrentAnalyzing
                  ? "rgba(99, 91, 255, 0.04)"
                  : isRowActive
                  ? "rgba(248, 250, 252, 0.9)"
                  : "transparent",
                border: isCurrentAnalyzing
                  ? "1px solid rgba(99, 91, 255, 0.25)"
                  : "1px solid transparent",
                opacity: isRowActive ? 1 : 0.35,
                transform: isRowActive ? "translateX(0)" : "translateX(6px)",
                transition: "all 300ms cubic-bezier(0.4, 0, 0.2, 1)",
                boxShadow: isCurrentAnalyzing ? "0 2px 8px rgba(99, 91, 255, 0.08)" : "none",
              }}
            >
              {/* Left: Icon + Label */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexShrink: 0 }}>
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: "8px",
                    backgroundColor: step.iconBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "transform 200ms ease",
                    transform: isCurrentAnalyzing ? "scale(1.1)" : "scale(1)",
                  }}
                >
                  {step.icon}
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: { xs: "0.78125rem", sm: "0.8125rem" },
                    fontWeight: 600,
                    color: isRowActive ? "#1E293B" : "#94A3B8",
                    whiteSpace: "nowrap",
                  }}
                >
                  {step.label}
                </Typography>
              </Box>

              {/* Right: Value Pill */}
              <Box
                sx={{
                  flexShrink: 0,
                  transition: "opacity 200ms ease, transform 200ms ease",
                  opacity: isRowActive ? 1 : 0,
                  transform: isRowActive ? "scale(1)" : "scale(0.9)",
                }}
              >
                {step.valuePill}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Animation Keyframes */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes analyzeBadgePulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.4;
            transform: scale(1.3);
          }
        }
      `,
        }}
      />
    </Box>
  );
}
