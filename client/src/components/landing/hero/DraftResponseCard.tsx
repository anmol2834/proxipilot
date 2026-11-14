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
        maxWidth: { xs: "100%", sm: 340 },
        backgroundColor: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "18px",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03)",
        p: { xs: 1.75, sm: 2.25 },
        display: "flex",
        flexDirection: "column",
        gap: 2,
        position: "relative",
        zIndex: 2,
      }}
    >
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
          <Box
            sx={{
              width: 26,
              height: 26,
              borderRadius: "6px",
              backgroundColor: "#EEF2FF",
              color: "#4F46E5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
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
              color: "#111827",
              whiteSpace: "nowrap",
            }}
          >
            Draft response
          </Typography>
        </Box>

        {isReady ? (
          <Chip
            icon={
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2.5 6.5l2.5 2.5 4.5-5"
                  stroke="#15803D"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
            label="Ready to send"
            size="small"
            sx={{
              height: 22,
              fontSize: "0.6875rem",
              fontWeight: 600,
              backgroundColor: "#DCFCE7",
              color: "#15803D",
              borderRadius: "9999px",
              whiteSpace: "nowrap",
              flexShrink: 0,
              animation: "readyBadgeGlow 2.5s ease-in-out infinite",
              "& .MuiChip-icon": {
                ml: 0.75,
                mr: -0.25,
              },
            }}
          />
        ) : isTyping ? (
          <Chip
            label="AI Composing..."
            size="small"
            sx={{
              height: 22,
              fontSize: "0.6875rem",
              fontWeight: 600,
              backgroundColor: "#EEF2FF",
              color: "#4F46E5",
              borderRadius: "9999px",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          />
        ) : (
          <Chip
            label="Pending trigger"
            size="small"
            sx={{
              height: 22,
              fontSize: "0.6875rem",
              fontWeight: 500,
              backgroundColor: "#F1F5F9",
              color: "#64748B",
              borderRadius: "9999px",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          />
        )}
      </Box>

      {/* Email Body Content Box */}
      <Box
        sx={{
          backgroundColor: "#F8FAFC",
          border: "1px solid #F1F5F9",
          borderRadius: "12px",
          p: 2,
          display: "flex",
          flexDirection: "column",
          gap: 1.25,
          minHeight: 150,
        }}
      >
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            fontSize: "0.75rem",
            color: "#111827",
          }}
        >
          {scenario.draft.greeting}
        </Typography>

        <Typography
          variant="body2"
          sx={{
            fontSize: "0.75rem",
            lineHeight: 1.5,
            color: "#334155",
            minHeight: "4.5em",
          }}
        >
          {displayText}
          {isTyping && (
            <Box
              component="span"
              sx={{
                display: "inline-block",
                color: "#4F46E5",
                fontWeight: 700,
                ml: "2px",
                animation: "typingCursorBlink 0.8s infinite",
              }}
            >
              |
            </Box>
          )}
        </Typography>

        <Box sx={{ mt: "auto", pt: 1 }}>
          {scenario.draft.signoff.split("\n").map((line, idx) => (
            <Typography
              key={idx}
              variant="caption"
              sx={{
                display: "block",
                fontWeight: idx === 0 ? 400 : 600,
                color: idx === 0 ? "#64748B" : "#111827",
                fontSize: "0.6875rem",
              }}
            >
              {line}
            </Typography>
          ))}
        </Box>
      </Box>

      {/* Action Buttons */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Button
          fullWidth
          variant="contained"
          size="small"
          sx={{
            backgroundColor: "#4F46E5",
            color: "#FFFFFF",
            fontWeight: 600,
            fontSize: "0.75rem",
            textTransform: "none",
            py: 1,
            borderRadius: "8px",
            boxShadow: isReady
              ? "0 2px 8px 0 rgba(79, 70, 229, 0.3)"
              : "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            animation: isReady ? "sendButtonShine 3s ease-in-out infinite" : "none",
            opacity: isReady ? 1 : 0.65,
            "&:hover": { backgroundColor: "#4338CA" },
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path
              d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Send now</span>
        </Button>

        <Button
          fullWidth
          variant="outlined"
          size="small"
          sx={{
            borderColor: "#E2E8F0",
            color: "#111827",
            backgroundColor: "#FFFFFF",
            fontWeight: 600,
            fontSize: "0.75rem",
            textTransform: "none",
            py: 1,
            borderRadius: "8px",
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            "&:hover": {
              backgroundColor: "#F8FAFC",
              borderColor: "#CBD5E1",
            },
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path
              d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M8.5 11a4 4 0 100-8 4 4 0 000 8z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Review</span>
        </Button>
      </Box>
    </Box>
  );
}
