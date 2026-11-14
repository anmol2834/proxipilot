"use client";

import React, { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface AfterEmailItem {
  id: string;
  sender: string;
  avatar: string;
  avatarBg: string;
  avatarColor: string;
  subIcon?: "bot" | "user" | "calendar";
  time: string;
  hasUserIcon?: boolean;
  subject: string;
  tag: string;
  tagBg: string;
  tagColor: string;
  preview: string;
  category: "all" | "priority" | "assigned" | "automated" | "archived";
}

const AFTER_EMAILS: AfterEmailItem[] = [
  {
    id: "1",
    sender: "Acme Corp",
    avatar: "AC",
    avatarBg: "#DBEAFE",
    avatarColor: "#3B82F6",
    time: "10:24 AM",
    subject: "Re: Pricing for 500 licenses",
    tag: "Replied",
    tagBg: "#DCFCE7",
    tagColor: "#16A34A",
    preview: "Here's the pricing for 500 licenses as requested...",
    category: "all",
  },
  {
    id: "2",
    sender: "Sarah Lee",
    avatar: "SL",
    avatarBg: "#D1FAE5",
    avatarColor: "#10B981",
    time: "9:18 AM",
    subject: "Question about SSO",
    tag: "Answered",
    tagBg: "#DCFCE7",
    tagColor: "#16A34A",
    preview: "Yes, we support SSO. Here are the details...",
    category: "all",
  },
  {
    id: "3",
    sender: "TechVision",
    avatar: "TV",
    avatarBg: "#EFF6FF",
    avatarColor: "#4F46E5",
    subIcon: "user",
    time: "Yesterday",
    hasUserIcon: true,
    subject: "Partnership opportunity",
    tag: "Assigned",
    tagBg: "#EDE9FE",
    tagColor: "#7C3AED",
    preview: "Thanks for reaching out. Let's schedule a call...",
    category: "assigned",
  },
  {
    id: "4",
    sender: "HR Team",
    avatar: "HT",
    avatarBg: "#EDE9FE",
    avatarColor: "#7C3AED",
    subIcon: "bot",
    time: "Yesterday",
    hasUserIcon: true,
    subject: "New hire setup",
    tag: "Automated",
    tagBg: "#EDE9FE",
    tagColor: "#7C3AED",
    preview: "All accounts have been configured.",
    category: "automated",
  },
  {
    id: "5",
    sender: "John Smith",
    avatar: "JS",
    avatarBg: "#DBEAFE",
    avatarColor: "#2563EB",
    subIcon: "calendar",
    time: "Yesterday",
    subject: "Following up",
    tag: "Scheduled",
    tagBg: "#DBEAFE",
    tagColor: "#2563EB",
    preview: "Meeting scheduled for tomorrow at 10 AM.",
    category: "all",
  },
];

const TABS = [
  { id: "all", label: "All" },
  { id: "priority", label: "Priority" },
  { id: "assigned", label: "Assigned" },
  { id: "automated", label: "Automated" },
  { id: "archived", label: "Archived" },
];

export function AfterInboxCard() {
  const [activeTab, setActiveTab] = useState("all");

  const filteredEmails =
    activeTab === "all"
      ? AFTER_EMAILS
      : AFTER_EMAILS.filter(
          (email) => email.category === activeTab || activeTab === "all"
        );

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
      {/* Main "After ProxiPilot" Inbox Card */}
      <Box
        sx={{
          position: "relative",
          zIndex: 2,
          backgroundColor: "#FFFFFF",
          borderRadius: "24px",
          border: "1px solid #E6EDF5",
          boxShadow:
            "0 20px 40px -15px rgba(16, 185, 129, 0.08), 0 10px 25px -5px rgba(0, 0, 0, 0.05)",
          overflow: "hidden",
          p: { xs: 2.25, sm: 2.75 },
          width: "100%",
          transition: "all 250ms ease",
          "&:hover": {
            boxShadow:
              "0 25px 50px -12px rgba(16, 185, 129, 0.12), 0 12px 30px -5px rgba(0, 0, 0, 0.08)",
          },
        }}
      >
        {/* Card Header: Inbox title, 8 badge, Search & Filter icons */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 2,
            pb: 0.25,
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
                backgroundColor: "#10B981",
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
              8
            </Box>
          </Box>

          {/* Header Right Icons */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, color: "#64748B" }}>
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

        {/* Navigation Tabs Bar */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: { xs: 1.5, sm: 2 },
            borderBottom: "1px solid #F1F5F9",
            mb: 1.75,
            pb: 0.75,
            overflowX: "auto",
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Box
                key={tab.id}
                component="button"
                onClick={() => setActiveTab(tab.id)}
                sx={{
                  background: "none",
                  border: "none",
                  p: "4px 0",
                  cursor: "pointer",
                  fontWeight: isActive ? 700 : 500,
                  fontSize: "0.75rem",
                  color: isActive ? "#3B82F6" : "#64748B",
                  position: "relative",
                  whiteSpace: "nowrap",
                  transition: "color 150ms ease",
                  "&:hover": {
                    color: isActive ? "#2563EB" : "#1E293B",
                  },
                  "&::after": isActive
                    ? {
                        content: '""',
                        position: "absolute",
                        bottom: -7,
                        left: 0,
                        right: 0,
                        height: "2px",
                        backgroundColor: "#3B82F6",
                        borderRadius: "2px",
                      }
                    : {},
                }}
              >
                {tab.label}
              </Box>
            );
          })}
        </Box>

        {/* Email Items List */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {filteredEmails.map((email) => (
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
              {/* Green Verified Checkmark Indicator */}
              <Box
                sx={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  backgroundColor: "transparent",
                  color: "#10B981",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mt: 1.4,
                  flexShrink: 0,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </Box>

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
                  position: "relative",
                }}
              >
                {email.avatar}
                {email.subIcon && (
                  <Box
                    sx={{
                      position: "absolute",
                      bottom: -2,
                      right: -2,
                      width: 13,
                      height: 13,
                      borderRadius: "50%",
                      backgroundColor: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                    }}
                  >
                    {email.subIcon === "user" && (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="#6366F1">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                      </svg>
                    )}
                    {email.subIcon === "bot" && (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="#7C3AED">
                        <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H6a2 2 0 01-2-2v-1H3a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z" />
                      </svg>
                    )}
                    {email.subIcon === "calendar" && (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="#2563EB">
                        <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 002 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z" />
                      </svg>
                    )}
                  </Box>
                )}
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
                    {email.hasUserIcon && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
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
            backgroundColor: "#DCFCE7",
            color: "#16A34A",
            fontWeight: 600,
            fontSize: "0.8125rem",
            px: 2,
            py: 0.5,
            borderRadius: "9999px",
            mb: 0.75,
            display: "inline-block",
          }}
        >
          After ProxiPilot
        </Box>
        <Typography
          sx={{
            fontSize: "0.84375rem",
            fontWeight: 500,
            color: "#64748B",
          }}
        >
          Clear. Organized. Actionable.
        </Typography>
      </Box>
    </Box>
  );
}
