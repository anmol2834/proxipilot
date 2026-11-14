"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface BeforeEmailItem {
  id: string;
  sender: string;
  avatar: string;
  avatarBg: string;
  avatarColor: string;
  time: string;
  hasClockIcon?: boolean;
  subject: string;
  tag: string;
  tagBg: string;
  tagColor: string;
  preview: string;
  unread: boolean;
}

const BEFORE_EMAILS: BeforeEmailItem[] = [
  {
    id: "1",
    sender: "Acme Corp",
    avatar: "AC",
    avatarBg: "#FEE2E2",
    avatarColor: "#EF4444",
    time: "10:24 AM",
    subject: "Re: Pricing for 500 licenses",
    tag: "Urgent",
    tagBg: "#FEE2E2",
    tagColor: "#EF4444",
    preview: "Hi, can you share the pricing for 500 enterprise...",
    unread: true,
  },
  {
    id: "2",
    sender: "John Smith",
    avatar: "JS",
    avatarBg: "#DBEAFE",
    avatarColor: "#3B82F6",
    time: "9:41 AM",
    hasClockIcon: true,
    subject: "Follow up on proposal",
    tag: "Follow up",
    tagBg: "#FEF3C7",
    tagColor: "#D97706",
    preview: "Just checking if you had a chance to review...",
    unread: true,
  },
  {
    id: "3",
    sender: "Sarah Lee",
    avatar: "SL",
    avatarBg: "#D1FAE5",
    avatarColor: "#10B981",
    time: "8:15 AM",
    subject: "Question about your product",
    tag: "Question",
    tagBg: "#EFF6FF",
    tagColor: "#2563EB",
    preview: "Do you support SSO? Also, what's the uptime...",
    unread: false,
  },
  {
    id: "4",
    sender: "Team",
    avatar: "TM",
    avatarBg: "#EDE9FE",
    avatarColor: "#8B5CF6",
    time: "Yesterday",
    subject: "Internal request",
    tag: "Internal",
    tagBg: "#F1F5F9",
    tagColor: "#64748B",
    preview: "Can you help with the settings for the new hires?",
    unread: true,
  },
  {
    id: "5",
    sender: "Robert Wilson",
    avatar: "RW",
    avatarBg: "#FFEDD5",
    avatarColor: "#F97316",
    time: "Yesterday",
    subject: "Re: Contract details",
    tag: "Review",
    tagBg: "#FEE2E2",
    tagColor: "#E11D48",
    preview: "We need a few changes in the agreement...",
    unread: true,
  },
];

export function BeforeInboxCard() {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        maxWidth: { xs: 360, sm: 410, md: 420 },
        position: "relative",
      }}
    >
      {/* Container with stacked background sheets fanning out to the left */}
      <Box
        sx={{
          position: "relative",
          width: "100%",
        }}
      >
        {/* Layer 3 (deepest stacked card) */}
        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            top: 14,
            left: -18,
            right: 18,
            bottom: -14,
            backgroundColor: "#FFFFFF",
            borderRadius: "24px",
            border: "1px solid #E2E8F0",
            opacity: 0.5,
            boxShadow: "0 6px 20px rgba(0, 0, 0, 0.03)",
            pointerEvents: "none",
            zIndex: 0,
            display: { xs: "none", sm: "block" },
          }}
        />

        {/* Layer 2 (middle stacked card) */}
        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            top: 7,
            left: -9,
            right: 9,
            bottom: -7,
            backgroundColor: "#FFFFFF",
            borderRadius: "24px",
            border: "1px solid #E2E8F0",
            opacity: 0.75,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.04)",
            pointerEvents: "none",
            zIndex: 1,
            display: { xs: "none", sm: "block" },
          }}
        />

        {/* Main "Before ProxiPilot" Inbox Card */}
        <Box
          sx={{
            position: "relative",
            zIndex: 2,
            backgroundColor: "#FFFFFF",
            borderRadius: "24px",
            border: "1px solid #E6EDF5",
            boxShadow:
              "0 20px 40px -15px rgba(239, 68, 68, 0.08), 0 10px 25px -5px rgba(0, 0, 0, 0.05)",
            overflow: "hidden",
            p: { xs: 2.25, sm: 2.75 },
            transition: "all 250ms ease",
            "&:hover": {
              boxShadow:
                "0 25px 50px -12px rgba(239, 68, 68, 0.12), 0 12px 30px -5px rgba(0, 0, 0, 0.08)",
            },
          }}
        >
          {/* Card Header: Inbox title, 42 badge, Search & Filter icons */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 2.25,
              pb: 0.5,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: "1.25rem",
                  color: "#0F172A",
                  letterSpacing: "-0.02em",
                }}
              >
                Inbox
              </Typography>
              <Box
                sx={{
                  backgroundColor: "#EF4444",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: "0.6875rem",
                  px: 0.9,
                  py: 0.2,
                  borderRadius: "9999px",
                  lineHeight: 1.2,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                42
              </Box>
            </Box>

            {/* Header Right Icons */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, color: "#64748B" }}>
              {/* Search Icon */}
              <Box
                component="button"
                aria-label="Search emails"
                sx={{
                  background: "none",
                  border: "none",
                  p: 0.5,
                  cursor: "pointer",
                  color: "inherit",
                  display: "flex",
                  alignItems: "center",
                  borderRadius: "6px",
                  "&:hover": { color: "#0F172A", backgroundColor: "#F8FAFC" },
                }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </Box>

              {/* Filter/Sliders Icon */}
              <Box
                component="button"
                aria-label="Filter emails"
                sx={{
                  background: "none",
                  border: "none",
                  p: 0.5,
                  cursor: "pointer",
                  color: "inherit",
                  display: "flex",
                  alignItems: "center",
                  borderRadius: "6px",
                  "&:hover": { color: "#0F172A", backgroundColor: "#F8FAFC" },
                }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="4" y1="12" x2="16" y2="12" />
                  <line x1="4" y1="18" x2="11" y2="18" />
                </svg>
              </Box>
            </Box>
          </Box>

          {/* Email Items List */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {BEFORE_EMAILS.map((email) => (
              <Box
                key={email.id}
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 1.25,
                  p: { xs: 1, sm: 1.25 },
                  borderRadius: "14px",
                  transition: "background-color 150ms ease",
                  "&:hover": {
                    backgroundColor: "#F8FAFC",
                  },
                }}
              >
                {/* Unread indicator dot */}
                <Box
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    backgroundColor: email.unread ? "#EF4444" : "transparent",
                    mt: 1.6,
                    flexShrink: 0,
                  }}
                />

                {/* Avatar */}
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    backgroundColor: email.avatarBg,
                    color: email.avatarColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "0.75rem",
                    flexShrink: 0,
                  }}
                >
                  {email.avatar}
                </Box>

                {/* Content Block */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {/* Sender & Timestamp */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      mb: 0.25,
                    }}
                  >
                    <Typography
                      sx={{
                        fontWeight: 700,
                        fontSize: "0.84rem",
                        color: "#0F172A",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {email.sender}
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      {email.hasClockIcon && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                      )}
                      <Typography
                        sx={{
                          fontSize: "0.71875rem",
                          color: "#94A3B8",
                          fontWeight: 500,
                          flexShrink: 0,
                        }}
                      >
                        {email.time}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Subject & Tag */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 1,
                      mb: 0.35,
                    }}
                  >
                    <Typography
                      sx={{
                        fontWeight: 600,
                        fontSize: "0.78125rem",
                        color: "#1E293B",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {email.subject}
                    </Typography>
                    <Box
                      sx={{
                        backgroundColor: email.tagBg,
                        color: email.tagColor,
                        fontWeight: 600,
                        fontSize: "0.65625rem",
                        px: 0.85,
                        py: 0.15,
                        borderRadius: "6px",
                        flexShrink: 0,
                        lineHeight: 1.3,
                      }}
                    >
                      {email.tag}
                    </Box>
                  </Box>

                  {/* Email Preview Snippet */}
                  <Typography
                    sx={{
                      fontSize: "0.71875rem",
                      color: "#64748B",
                      lineHeight: 1.35,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {email.preview}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Bottom Label & Subtitle */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          mt: 2.75,
          textAlign: "center",
        }}
      >
        <Box
          sx={{
            backgroundColor: "#FEE2E2",
            color: "#DC2626",
            fontWeight: 600,
            fontSize: "0.8125rem",
            px: 2,
            py: 0.5,
            borderRadius: "9999px",
            mb: 0.75,
            display: "inline-block",
          }}
        >
          Before ProxiPilot
        </Box>
        <Typography
          sx={{
            fontSize: "0.84375rem",
            fontWeight: 500,
            color: "#64748B",
          }}
        >
          Scattered. Overwhelming. Time-consuming.
        </Typography>
      </Box>
    </Box>
  );
}
