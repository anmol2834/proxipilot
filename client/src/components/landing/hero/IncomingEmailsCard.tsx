"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { PIPELINE_SCENARIOS } from "./pipelineScenarios";

export interface IncomingEmailsCardProps {
  activeId?: number;
  onSelect?: (id: number) => void;
}

export function IncomingEmailsCard({ activeId = 1, onSelect }: IncomingEmailsCardProps) {
  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: { xs: "100%", sm: 300, lg: 305 },
        backgroundColor: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "16px",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03)",
        p: { xs: 1.25, sm: 1.4 },
        display: "flex",
        flexDirection: "column",
        gap: 1,
        position: "relative",
        zIndex: 2,
      }}
    >
      {/* Top Card Label */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1,
          py: 0.5,
          borderBottom: "1px solid #F1F5F9",
          mb: 0.25,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            fontSize: "0.6875rem",
            color: "#64748B",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Connected Inbox
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: "#22C55E",
              animation: "liveDotPulse 2s infinite ease-in-out",
            }}
          />
          <Typography variant="caption" sx={{ fontSize: "0.6875rem", color: "#16A34A", fontWeight: 600 }}>
            Real-time
          </Typography>
        </Box>
      </Box>

      {PIPELINE_SCENARIOS.map((email) => {
        const isSelected = email.id === activeId;
        return (
          <Box
            key={email.id}
            onClick={() => onSelect && onSelect(email.id)}
            sx={{
              p: 1.4,
              borderRadius: "12px",
              backgroundColor: isSelected ? "rgba(99, 91, 255, 0.04)" : "transparent",
              border: isSelected
                ? "1px solid rgba(99, 91, 255, 0.35)"
                : "1px solid transparent",
              position: "relative",
              cursor: "pointer",
              transition: "all 250ms cubic-bezier(0.4, 0, 0.2, 1)",
              boxShadow: isSelected ? "0 4px 12px -2px rgba(99, 91, 255, 0.1)" : "none",
              transform: isSelected ? "scale(1.02)" : "scale(1)",
              "&:hover": {
                backgroundColor: isSelected ? "rgba(99, 91, 255, 0.06)" : "#F8FAFC",
                borderColor: isSelected ? "rgba(99, 91, 255, 0.5)" : "#E2E8F0",
              },
            }}
          >
            {/* Header: Avatar + Sender + Time */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 0.5 }}>
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  backgroundColor: email.avatarBg,
                  color: email.avatarColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  flexShrink: 0,
                  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                }}
              >
                {email.sender
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </Box>

              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Typography
                    variant="subtitle2"
                    component="div"
                    sx={{
                      fontWeight: isSelected ? 700 : 600,
                      fontSize: "0.8125rem",
                      color: isSelected ? "#0F172A" : "#334155",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {email.sender}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: "0.6875rem",
                      color: "#94A3B8",
                      flexShrink: 0,
                      ml: 1,
                    }}
                  >
                    {email.time}
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Subject */}
            <Typography
              variant="body2"
              sx={{
                fontWeight: isSelected ? 600 : 500,
                fontSize: "0.75rem",
                color: isSelected ? "#1E1B4B" : "#475569",
                lineHeight: 1.35,
                mb: 0.5,
                display: "-webkit-box",
                WebkitLineClamp: 1,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {email.subject}
            </Typography>

            {/* Bottom: Badge + Status Dot */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Box
                sx={{
                  backgroundColor: email.badgeBg,
                  color: email.badgeColor,
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  px: 1,
                  py: 0.25,
                  borderRadius: "4px",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {email.badge}
              </Box>

              {isSelected && (
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    backgroundColor: "#635BFF",
                    boxShadow: "0 0 8px #635BFF",
                  }}
                />
              )}
            </Box>
          </Box>
        );
      })}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes liveDotPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.4); }
        }
      `,
        }}
      />
    </Box>
  );
}
