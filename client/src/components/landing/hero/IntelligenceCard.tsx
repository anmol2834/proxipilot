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
  const steps = [
    {
      id: "intent",
      label: "Intent detected",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="#635BFF" strokeWidth="2" />
          <circle cx="12" cy="12" r="6" stroke="#635BFF" strokeWidth="2" />
          <circle cx="12" cy="12" r="2" fill="#635BFF" />
        </svg>
      ),
      iconBg: "rgba(99, 91, 255, 0.1)",
      valuePill: (
        <Box
          sx={{
            backgroundColor: isAnalyzing || isVerified ? "#EEF2FF" : "#F1F5F9",
            color: isAnalyzing || isVerified ? "#4F46E5" : "#1E293B",
            fontSize: "0.6875rem",
            fontWeight: 600,
            px: 1.25,
            py: 0.5,
            borderRadius: "6px",
            transition: "all 200ms ease",
          }}
        >
          {scenario.intelligence.intent}
        </Box>
      ),
    },
    {
      id: "customer",
      label: "Customer identified",
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
            backgroundColor: "#EEF2FF",
            color: "#4F46E5",
            fontSize: "0.6875rem",
            fontWeight: 600,
            px: 1.25,
            py: 0.5,
            borderRadius: "6px",
            transition: "all 200ms ease",
          }}
        >
          {scenario.intelligence.customer}
        </Box>
      ),
    },
    {
      id: "requirement",
      label: "Requirement extracted",
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
            backgroundColor: "#EEF2FF",
            color: "#4F46E5",
            fontSize: "0.6875rem",
            fontWeight: 600,
            px: 1.25,
            py: 0.5,
            borderRadius: "6px",
            transition: "all 200ms ease",
          }}
        >
          {scenario.intelligence.requirement}
        </Box>
      ),
    },
    {
      id: "knowledge",
      label: "Knowledge search",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 12c0 2.21 3.582 4 8 4s8-1.79 8-4"
            stroke="#10B981"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
      iconBg: "rgba(16, 185, 129, 0.12)",
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
          {scenario.intelligence.knowledgeTags.map((tag, idx) => (
            <Box
              key={idx}
              sx={{
                backgroundColor: "#F1F5F9",
                color: "#334155",
                fontSize: "0.6875rem",
                fontWeight: 500,
                px: 1,
                py: 0.35,
                borderRadius: "6px",
                whiteSpace: "nowrap",
                transition: "all 200ms ease",
              }}
            >
              {tag}
            </Box>
          ))}
        </Box>
      ),
    },
    {
      id: "evidence",
      label: "Evidence verified",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" fill="#16A36A" />
          <path
            d="M8 12.5l2.5 2.5 5.5-5.5"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
      iconBg: "transparent",
      valuePill: (
        <Typography
          variant="body2"
          sx={{
            color: "#111827",
            fontWeight: 600,
            fontSize: "0.75rem",
          }}
        >
          {scenario.intelligence.sourcesMatched}
        </Typography>
      ),
    },
  ];

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: { xs: "100%", sm: 420 },
        backgroundColor: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "20px",
        boxShadow: "0 20px 40px -12px rgba(79, 70, 229, 0.14), 0 4px 12px -2px rgba(0, 0, 0, 0.04)",
        p: { xs: 1.5, sm: 2.75 },
        position: "relative",
        zIndex: 3,
        transition: "border-color 250ms ease, box-shadow 250ms ease",
      }}
    >
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
              color: "#111827",
              letterSpacing: "-0.01em",
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
              border: "1px solid rgba(99, 91, 255, 0.18)",
              borderRadius: "9999px",
              px: 1.25,
              py: 0.35,
            }}
          >
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: "#635BFF",
                animation: "analyzeBadgePulse 1.6s infinite ease-in-out",
              }}
            />
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                fontSize: "0.6875rem",
                color: "#635BFF",
              }}
            >
              Analyzing...
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
              py: 0.35,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
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
                fontWeight: 600,
                fontSize: "0.6875rem",
                color: "#16A34A",
              }}
            >
              Verified
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
              py: 0.35,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: 500,
                fontSize: "0.6875rem",
                color: "#64748B",
              }}
            >
              Standby
            </Typography>
          </Box>
        )}
      </Box>

      {/* 5 Process Rows with progressive activation */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
        {steps.map((step, idx) => {
          const isCurrentStep = isAnalyzing && idx === activeStepCount - 1;
          const isStepDone = isVerified || (isAnalyzing && idx < activeStepCount);

          return (
            <Box
              key={step.id}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: { xs: "wrap", sm: "nowrap" },
                p: { xs: 1, sm: 1.25 },
                borderRadius: "10px",
                backgroundColor: isCurrentStep
                  ? "#EEF2FF"
                  : isStepDone
                  ? "#FAFAFE"
                  : "#F8FAFC",
                border: isCurrentStep
                  ? "1px solid rgba(99, 91, 255, 0.45)"
                  : isStepDone
                  ? "1px solid rgba(99, 91, 255, 0.18)"
                  : "1px solid #F1F5F9",
                boxShadow: isCurrentStep
                  ? "0 2px 8px rgba(99, 91, 255, 0.12)"
                  : "none",
                gap: { xs: 0.75, sm: 1.5 },
                transition: "all 250ms ease",
                transform: isCurrentStep ? "translateX(2px)" : "none",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
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
                    transform: isCurrentStep ? "scale(1.1)" : "scale(1)",
                  }}
                >
                  {step.icon}
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: isStepDone ? 600 : 500,
                    fontSize: "0.75rem",
                    color: isStepDone ? "#111827" : "#64748B",
                    whiteSpace: "nowrap",
                    transition: "color 200ms ease",
                  }}
                >
                  {step.label}
                </Typography>
              </Box>
              <Box sx={{ flexShrink: 0, ml: { xs: "auto", sm: 0 } }}>{step.valuePill}</Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
