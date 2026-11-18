"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import { PipelineScenario, PIPELINE_SCENARIOS } from "./pipelineScenarios";

export interface DraftResponseCardProps {
  scenario?: PipelineScenario;
  typedBody?: string;
  isTyping?: boolean;
  isReady?: boolean;
}

export function DraftResponseCard({
  scenario = PIPELINE_SCENARIOS[0],
  typedBody,
  isTyping = false,
  isReady = true,
}: DraftResponseCardProps) {
  const displayText = typedBody !== undefined ? typedBody : scenario.draft.body;

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: { xs: "100%", sm: 330, lg: 340 },
        backgroundColor: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "18px",
        boxShadow: "0 16px 40px -8px rgba(0, 0, 0, 0.07), 0 4px 12px -2px rgba(0, 0, 0, 0.03)",
        p: { xs: 1.5, sm: 2 },
        display: "flex",
        flexDirection: "column",
        gap: 1.4,
        position: "relative",
        zIndex: 2,
        transition: "all 300ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: "8px",
              backgroundColor: "#EEF2FF",
              color: "#4F46E5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Box>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 700,
              fontSize: "0.875rem",
              color: "#0F172A",
              whiteSpace: "nowrap",
            }}
          >
            Draft Response
          </Typography>
        </Box>

        {isReady ? (
          <Chip
            icon={
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2.5 6.5l2.5 2.5 4.5-5"
                  stroke="#15803D"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
            label="Ready to send"
            size="small"
            sx={{
              height: 24,
              fontSize: "0.6875rem",
              fontWeight: 700,
              backgroundColor: "#DCFCE7",
              color: "#15803D",
              borderRadius: "9999px",
              whiteSpace: "nowrap",
              border: "1px solid rgba(22, 163, 74, 0.2)",
            }}
          />
        ) : (
          <Chip
            label={isTyping ? "AI Drafting..." : "Awaiting Context"}
            size="small"
            sx={{
              height: 24,
              fontSize: "0.6875rem",
              fontWeight: 700,
              backgroundColor: isTyping ? "#EEF2FF" : "#F1F5F9",
              color: isTyping ? "#4F46E5" : "#64748B",
              borderRadius: "9999px",
              whiteSpace: "nowrap",
              border: isTyping ? "1px solid rgba(79, 70, 229, 0.2)" : "1px solid #E2E8F0",
            }}
          />
        )}
      </Box>

      {/* Recipient Details Pill */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          p: 1.25,
          borderRadius: "10px",
          backgroundColor: "#F8FAFC",
          border: "1px solid #F1F5F9",
        }}
      >
        <Typography variant="caption" sx={{ color: "#94A3B8", fontWeight: 600, fontSize: "0.6875rem" }}>
          To:
        </Typography>
        <Typography variant="caption" sx={{ color: "#0F172A", fontWeight: 700, fontSize: "0.75rem" }}>
          {scenario.sender}
        </Typography>
        <Typography variant="caption" sx={{ color: "#64748B", fontSize: "0.6875rem", ml: "auto" }}>
          Re: {scenario.subject}
        </Typography>
      </Box>

      {/* Message Body Box */}
      <Box
        sx={{
          p: 1.75,
          borderRadius: "12px",
          backgroundColor: "#FAF5FF",
          border: "1px solid rgba(124, 58, 237, 0.12)",
          minHeight: 140,
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        <Typography
          variant="body2"
          sx={{
            fontWeight: 700,
            fontSize: "0.8125rem",
            color: "#1E1B4B",
            mb: 0.75,
          }}
        >
          {scenario.draft.greeting}
        </Typography>

        <Typography
          variant="body2"
          sx={{
            fontSize: "0.8125rem",
            color: "#334155",
            lineHeight: 1.6,
            flex: 1,
            whiteSpace: "pre-line",
          }}
        >
          {displayText}
          {isTyping && (
            <Box
              component="span"
              sx={{
                display: "inline-block",
                width: "2px",
                height: "14px",
                backgroundColor: "#7C3AED",
                ml: 0.5,
                verticalAlign: "middle",
                animation: "cursorBlink 0.8s infinite",
              }}
            />
          )}
        </Typography>

        <Typography
          variant="caption"
          sx={{
            fontSize: "0.75rem",
            color: "#64748B",
            mt: 1.5,
            whiteSpace: "pre-line",
            fontWeight: 500,
          }}
        >
          {scenario.draft.signoff}
        </Typography>
      </Box>

      {/* Actions */}
      <Box sx={{ display: "flex", gap: 1, pt: 0.5 }}>
        <Button
          fullWidth
          variant="contained"
          size="small"
          sx={{
            backgroundColor: "#2563EB",
            color: "#FFFFFF",
            fontWeight: 700,
            fontSize: "0.75rem",
            textTransform: "none",
            borderRadius: "8px",
            py: 1,
            boxShadow: "0 2px 8px rgba(37, 99, 235, 0.25)",
            "&:hover": {
              backgroundColor: "#1D4ED8",
            },
          }}
        >
          Send Now
        </Button>
        <Button
          fullWidth
          variant="outlined"
          size="small"
          sx={{
            borderColor: "#CBD5E1",
            color: "#334155",
            fontWeight: 600,
            fontSize: "0.75rem",
            textTransform: "none",
            borderRadius: "8px",
            py: 1,
            "&:hover": {
              borderColor: "#94A3B8",
              backgroundColor: "#F8FAFC",
            },
          }}
        >
          Review &amp; Edit
        </Button>
      </Box>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `,
        }}
      />
    </Box>
  );
}
