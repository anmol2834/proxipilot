import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";

export interface IncomingEmailsCardProps {
  activeId?: number;
}

export function IncomingEmailsCard({ activeId = 1 }: IncomingEmailsCardProps) {
  const emails = [
    {
      id: 1,
      sender: "Sarah Johnson",
      time: "10:24 AM",
      subject: "Can you send me pricing for 500 licenses?",
      badge: "External",
      badgeBg: "#FEF3C7",
      badgeColor: "#92400E",
      avatarBg: "#EEF2FF",
      avatarColor: "#4F46E5",
    },
    {
      id: 2,
      sender: "Michael Chen",
      time: "9:18 AM",
      subject: "Need help with integration",
      badge: "Support",
      badgeBg: "#F1F5F9",
      badgeColor: "#475569",
      avatarBg: "#F0FDF4",
      avatarColor: "#16A34A",
    },
    {
      id: 3,
      sender: "Priya Sharma",
      time: "Yesterday",
      subject: "Partnership opportunity",
      badge: "Business",
      badgeBg: "#F0FDF4",
      badgeColor: "#166534",
      avatarBg: "#FDF2F8",
      avatarColor: "#DB2777",
    },
    {
      id: 4,
      sender: "David Miller",
      time: "Yesterday",
      subject: "Question about enterprise plan",
      badge: "Sales",
      badgeBg: "#F1F5F9",
      badgeColor: "#475569",
      avatarBg: "#F5F3FF",
      avatarColor: "#7C3AED",
    },
  ];

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: { xs: "100%", sm: 330 },
        backgroundColor: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "18px",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03)",
        p: { xs: 1.5, sm: 2 },
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
        position: "relative",
        zIndex: 2,
      }}
    >
      {emails.map((email) => {
        const isSelected = email.id === activeId;
        return (
          <Box
            key={email.id}
            sx={{
              p: 1.5,
              borderRadius: "12px",
              backgroundColor: isSelected ? "#F8FAFC" : "transparent",
              border: isSelected
                ? "1px solid rgba(79, 70, 229, 0.35)"
                : "1px solid transparent",
              position: "relative",
              transition: "all 250ms ease",
              animation: isSelected ? "activeCardBreath 3.5s ease-in-out infinite" : "none",
              "&:hover": {
                backgroundColor: "#F8FAFC",
              },
            }}
          >
          {/* Header: Avatar + Sender + Time */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 0.75 }}>
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
                flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </Box>
            <Box sx={{ flexGrow: 1 }}>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  color: "#111827",
                  lineHeight: 1.2,
                }}
              >
                {email.sender}
              </Typography>
            </Box>
            <Typography
              variant="caption"
              sx={{
                color: "#94A3B8",
                fontSize: "0.6875rem",
                fontWeight: 500,
                flexShrink: 0,
              }}
            >
              {email.time}
            </Typography>
          </Box>

          {/* Subject snippet */}
          <Typography
            variant="body2"
            sx={{
              color: "#334155",
              fontSize: "0.75rem",
              lineHeight: 1.4,
              fontWeight: isSelected ? 600 : 400,
              mb: 1,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {email.subject}
          </Typography>

          {/* Tag + Indicator Dot */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Chip
              label={email.badge}
              size="small"
              sx={{
                height: 20,
                fontSize: "0.65rem",
                fontWeight: 600,
                backgroundColor: email.badgeBg,
                color: email.badgeColor,
                borderRadius: "6px",
                px: 0.5,
              }}
            />
            {isSelected && (
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: "#635BFF",
                  animation: "emailLivePulse 2s ease-in-out infinite",
                }}
              />
            )}
          </Box>
        </Box>
      );
    })}
  </Box>
);
}
