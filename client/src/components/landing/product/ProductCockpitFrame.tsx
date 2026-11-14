"use client";

import React, { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface Thread {
  id: string;
  sender: string;
  avatar: string;
  avatarBg: string;
  avatarColor: string;
  time: string;
  subject: string;
  preview: string;
  unread: boolean;
}

const THREADS: Thread[] = [
  {
    id: "1",
    sender: "Sarah Johnson",
    avatar: "SJ",
    avatarBg: "#FEE2E2",
    avatarColor: "#EF4444",
    time: "10:24 AM",
    subject: "Pricing for 500 licenses",
    preview: "Hi, can you send me the pricing for 500...",
    unread: true,
  },
  {
    id: "2",
    sender: "Michael Chen",
    avatar: "MC",
    avatarBg: "#F1F5F9",
    avatarColor: "#475569",
    time: "9:18 AM",
    subject: "Integration with Salesforce",
    preview: "Do you support Salesforce integration?",
    unread: true,
  },
  {
    id: "3",
    sender: "Priya Sharma",
    avatar: "PS",
    avatarBg: "#DBEAFE",
    avatarColor: "#3B82F6",
    time: "Yesterday",
    subject: "Partnership opportunity",
    preview: "We're exploring a potential partnership...",
    unread: false,
  },
  {
    id: "4",
    sender: "Robert Wilson",
    avatar: "RW",
    avatarBg: "#FFEDD5",
    avatarColor: "#EA580C",
    time: "Yesterday",
    subject: "Contract details",
    preview: "Could you share the contract template?",
    unread: false,
  },
  {
    id: "5",
    sender: "Emily Davis",
    avatar: "ED",
    avatarBg: "#EDE9FE",
    avatarColor: "#8B5CF6",
    time: "Sep 12",
    subject: "Product demo",
    preview: "Can we schedule a demo for next week?",
    unread: false,
  },
  {
    id: "6",
    sender: "Alex Carter",
    avatar: "AC",
    avatarBg: "#D1FAE5",
    avatarColor: "#10B981",
    time: "Sep 11",
    subject: "Support request",
    preview: "I'm facing an issue with the setup...",
    unread: false,
  },
];

export function ProductCockpitFrame() {
  const [selectedThreadId, setSelectedThreadId] = useState<string>("1");
  const [activeThreadFilter, setActiveThreadFilter] = useState<string>("all");
  const [activeFolder, setActiveFolder] = useState<string>("inbox");

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 1140,
        mx: "auto",
        backgroundColor: "#FFFFFF",
        borderRadius: { xs: "16px", sm: "24px" },
        border: "1px solid #E2E8F0",
        boxShadow:
          "0 25px 60px -15px rgba(15, 23, 42, 0.08), 0 10px 30px -10px rgba(0, 0, 0, 0.04)",
        overflow: "hidden",
        position: "relative",
        zIndex: 2,
      }}
    >
      {/* 1. Safari / macOS Window Chrome Header */}
      <Box
        sx={{
          height: 48,
          backgroundColor: "#F8FAFC",
          borderBottom: "1px solid #E2E8F0",
          px: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          userSelect: "none",
        }}
      >
        {/* Left: Window Controls + Navigation */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          {/* Traffic Lights */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.9 }}>
            <Box sx={{ width: 11, height: 11, borderRadius: "50%", backgroundColor: "#EF4444" }} />
            <Box sx={{ width: 11, height: 11, borderRadius: "50%", backgroundColor: "#F59E0B" }} />
            <Box sx={{ width: 11, height: 11, borderRadius: "50%", backgroundColor: "#10B981" }} />
          </Box>

          {/* Browser Navigation Icons */}
          <Box sx={{ display: { xs: "none", sm: "flex" }, alignItems: "center", gap: 1, color: "#94A3B8" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M9 3v18" />
            </svg>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, ml: 0.5 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Box>
          </Box>
        </Box>

        {/* Center: Safari URL Pill */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            backgroundColor: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "8px",
            px: { xs: 2, sm: 3 },
            py: 0.45,
            width: { xs: 200, sm: 320 },
            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <Typography
            sx={{
              fontWeight: 500,
              fontSize: "0.78125rem",
              color: "#475569",
              letterSpacing: "0.01em",
            }}
          >
            app.proxipilot.com
          </Typography>
        </Box>

        {/* Right: Window Utilities */}
        <Box sx={{ display: { xs: "none", sm: "flex" }, alignItems: "center", gap: 1.5, color: "#94A3B8" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" />
          </svg>
        </Box>
      </Box>

      {/* 2. Cockpit 3-Column Main Workspace */}
      <Box
        sx={{
          display: "flex",
          minHeight: { xs: 580, md: 660 },
          width: "100%",
          backgroundColor: "#FFFFFF",
        }}
      >
        {/* COLUMN 1: Left Navigation Sidebar */}
        <Box
          sx={{
            width: { xs: 0, md: 195, lg: 215 },
            display: { xs: "none", md: "flex" },
            flexDirection: "column",
            justifyContent: "space-between",
            backgroundColor: "#FAFAFA",
            borderRight: "1px solid #EEF2F6",
            p: 2,
            flexShrink: 0,
          }}
        >
          {/* Top Brand & Actions */}
          <Box>
            {/* Logo */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 2.5, px: 0.5 }}>
              <Box sx={{ width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
                  <circle cx="11" cy="16" r="6" fill="#3B82F6" fillOpacity="0.9" />
                  <circle cx="21" cy="16" r="6" fill="#635BFF" fillOpacity="0.9" />
                  <path d="M16 11.5C17.5 12.8 18.5 14.3 18.5 16C18.5 17.7 17.5 19.2 16 20.5C14.5 19.2 13.5 17.7 13.5 16C13.5 14.3 14.5 12.8 16 11.5Z" fill="#4F46E5" />
                  <circle cx="16" cy="10" r="3.5" fill="#4F7CFF" />
                </svg>
              </Box>
              <Typography sx={{ fontWeight: 800, fontSize: "1.0625rem", color: "#0F172A", letterSpacing: "-0.02em" }}>
                ProxiPilot
              </Typography>
            </Box>

            {/* + New Message CTA Button */}
            <Box
              component="button"
              sx={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                backgroundColor: "#4F46E5",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "10px",
                py: 1.1,
                px: 2,
                fontWeight: 600,
                fontSize: "0.8125rem",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(79, 70, 229, 0.28)",
                transition: "all 150ms ease",
                mb: 2.5,
                "&:hover": {
                  backgroundColor: "#4338CA",
                },
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>New message</span>
            </Box>

            {/* Folder Navigation */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              {/* Inbox */}
              <Box
                component="button"
                onClick={() => setActiveFolder("inbox")}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  px: 1.25,
                  py: 1,
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: activeFolder === "inbox" ? "#EFF6FF" : "transparent",
                  color: activeFolder === "inbox" ? "#2563EB" : "#64748B",
                  fontWeight: activeFolder === "inbox" ? 700 : 500,
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "left",
                  transition: "background 150ms ease",
                  "&:hover": { backgroundColor: activeFolder === "inbox" ? "#EFF6FF" : "#F1F5F9" },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  <span>Inbox</span>
                </Box>
                <Box
                  sx={{
                    backgroundColor: activeFolder === "inbox" ? "#DBEAFE" : "#E2E8F0",
                    color: activeFolder === "inbox" ? "#1D4ED8" : "#475569",
                    fontWeight: 700,
                    fontSize: "0.6875rem",
                    px: 0.85,
                    py: 0.15,
                    borderRadius: "9999px",
                  }}
                >
                  12
                </Box>
              </Box>

              {/* Assigned */}
              <Box
                component="button"
                onClick={() => setActiveFolder("assigned")}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.25,
                  px: 1.25,
                  py: 1,
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: activeFolder === "assigned" ? "#EFF6FF" : "transparent",
                  color: activeFolder === "assigned" ? "#2563EB" : "#64748B",
                  fontWeight: 500,
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "left",
                  "&:hover": { backgroundColor: "#F1F5F9" },
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
                <span>Assigned</span>
              </Box>

              {/* Snoozed */}
              <Box
                component="button"
                onClick={() => setActiveFolder("snoozed")}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.25,
                  px: 1.25,
                  py: 1,
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: activeFolder === "snoozed" ? "#EFF6FF" : "transparent",
                  color: activeFolder === "snoozed" ? "#2563EB" : "#64748B",
                  fontWeight: 500,
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "left",
                  "&:hover": { backgroundColor: "#F1F5F9" },
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>Snoozed</span>
              </Box>

              {/* Sent */}
              <Box
                component="button"
                onClick={() => setActiveFolder("sent")}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.25,
                  px: 1.25,
                  py: 1,
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: activeFolder === "sent" ? "#EFF6FF" : "transparent",
                  color: activeFolder === "sent" ? "#2563EB" : "#64748B",
                  fontWeight: 500,
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "left",
                  "&:hover": { backgroundColor: "#F1F5F9" },
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                <span>Sent</span>
              </Box>

              {/* Archived */}
              <Box
                component="button"
                onClick={() => setActiveFolder("archived")}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.25,
                  px: 1.25,
                  py: 1,
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: activeFolder === "archived" ? "#EFF6FF" : "transparent",
                  color: activeFolder === "archived" ? "#2563EB" : "#64748B",
                  fontWeight: 500,
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "left",
                  "&:hover": { backgroundColor: "#F1F5F9" },
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="5" x="2" y="3" rx="1" />
                  <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
                  <path d="M10 12h4" />
                </svg>
                <span>Archived</span>
              </Box>

              {/* Trash */}
              <Box
                component="button"
                onClick={() => setActiveFolder("trash")}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.25,
                  px: 1.25,
                  py: 1,
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: activeFolder === "trash" ? "#EFF6FF" : "transparent",
                  color: activeFolder === "trash" ? "#2563EB" : "#64748B",
                  fontWeight: 500,
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "left",
                  "&:hover": { backgroundColor: "#F1F5F9" },
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <span>Trash</span>
              </Box>
            </Box>
          </Box>

          {/* Bottom Organization Switcher */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              p: 1,
              borderRadius: "10px",
              backgroundColor: "#FFFFFF",
              border: "1px solid #E2E8F0",
              cursor: "pointer",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box
                sx={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  backgroundColor: "#1E3A8A",
                  color: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: "0.78125rem", color: "#0F172A", lineHeight: 1.2 }}>
                  Acme Corp
                </Typography>
                <Typography sx={{ fontSize: "0.6875rem", color: "#64748B", lineHeight: 1.2 }}>
                  12 members
                </Typography>
              </Box>
            </Box>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </Box>
        </Box>

        {/* COLUMN 2: Inbox Threads List */}
        <Box
          sx={{
            width: { xs: "100%", sm: 270, md: 280, lg: 300 },
            borderRight: "1px solid #EEF2F6",
            display: { xs: selectedThreadId ? "none" : "flex", sm: "flex" },
            flexDirection: "column",
            flexShrink: 0,
            p: 2,
          }}
        >
          {/* Header */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
            <Typography sx={{ fontWeight: 800, fontSize: "1.1875rem", color: "#0F172A", letterSpacing: "-0.01em" }}>
              Inbox
            </Typography>
            <Box sx={{ color: "#64748B", cursor: "pointer" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="16" y2="12" />
                <line x1="4" y1="18" x2="11" y2="18" />
              </svg>
            </Box>
          </Box>

          {/* Sub-tabs: All, Unread, Mentions */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, borderBottom: "1px solid #F1F5F9", pb: 1, mb: 1.5 }}>
            {["all", "unread", "mentions"].map((filter) => {
              const isActive = activeThreadFilter === filter;
              return (
                <Box
                  key={filter}
                  component="button"
                  onClick={() => setActiveThreadFilter(filter)}
                  sx={{
                    background: "none",
                    border: "none",
                    p: 0,
                    cursor: "pointer",
                    fontSize: "0.75rem",
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? "#2563EB" : "#64748B",
                    textTransform: "capitalize",
                    position: "relative",
                    "&::after": isActive
                      ? {
                          content: '""',
                          position: "absolute",
                          bottom: -9,
                          left: 0,
                          right: 0,
                          height: "2px",
                          backgroundColor: "#2563EB",
                          borderRadius: "2px",
                        }
                      : {},
                  }}
                >
                  {filter}
                </Box>
              );
            })}
          </Box>

          {/* Thread List Items */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, overflowY: "auto" }}>
            {THREADS.map((thread) => {
              const isSelected = selectedThreadId === thread.id;
              return (
                <Box
                  key={thread.id}
                  onClick={() => setSelectedThreadId(thread.id)}
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 1.25,
                    p: 1.25,
                    borderRadius: "10px",
                    cursor: "pointer",
                    backgroundColor: isSelected ? "#F0F7FF" : "transparent",
                    borderLeft: isSelected ? "3px solid #3B82F6" : "3px solid transparent",
                    transition: "all 150ms ease",
                    "&:hover": {
                      backgroundColor: isSelected ? "#F0F7FF" : "#F8FAFC",
                    },
                  }}
                >
                  {/* Avatar */}
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      backgroundColor: thread.avatarBg,
                      color: thread.avatarColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: "0.75rem",
                      flexShrink: 0,
                      mt: 0.25,
                    }}
                  >
                    {thread.avatar}
                  </Box>

                  {/* Thread details */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.25 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: "0.8125rem", color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {thread.sender}
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                        <Typography sx={{ fontSize: "0.6875rem", color: "#94A3B8", flexShrink: 0 }}>
                          {thread.time}
                        </Typography>
                        {thread.unread && (
                          <Box sx={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#3B82F6", flexShrink: 0 }} />
                        )}
                      </Box>
                    </Box>
                    <Typography sx={{ fontWeight: 600, fontSize: "0.75rem", color: "#1E293B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", mb: 0.25 }}>
                      {thread.subject}
                    </Typography>
                    <Typography sx={{ fontSize: "0.6875rem", color: "#64748B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {thread.preview}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* COLUMN 3: Email Thread Detail & AI Copilot Workspace */}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            p: { xs: 2, sm: 2.5, md: 3 },
          }}
        >
          {/* Top Search & Actions Bar */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 2.5,
              pb: 1.5,
              borderBottom: "1px solid #F1F5F9",
            }}
          >
            {/* Search Input */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                backgroundColor: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: "8px",
                px: 1.5,
                py: 0.6,
                width: { xs: "100%", sm: 280, md: 320 },
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <Typography sx={{ fontSize: "0.78125rem", color: "#94A3B8" }}>
                Search emails, contacts...
              </Typography>
            </Box>

            {/* Profile & Notifications */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              {/* Notification Bell */}
              <Box sx={{ position: "relative", color: "#64748B", cursor: "pointer", p: 0.5 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
                <Box sx={{ position: "absolute", top: 3, right: 3, width: 7, height: 7, borderRadius: "50%", backgroundColor: "#EF4444" }} />
              </Box>

              {/* User Avatar */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  cursor: "pointer",
                  p: 0.5,
                  borderRadius: "6px",
                  "&:hover": { backgroundColor: "#F8FAFC" },
                }}
              >
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    backgroundColor: "#DBEAFE",
                    color: "#2563EB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "0.75rem",
                  }}
                >
                  A
                </Box>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </Box>
            </Box>
          </Box>

          {/* Subject Line & Tags */}
          <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 2, gap: 2 }}>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: { xs: "1.125rem", sm: "1.25rem" }, color: "#0F172A", mb: 1 }}>
                Pricing for 500 licenses
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
                <Box sx={{ backgroundColor: "#FEF3C7", color: "#B45309", fontWeight: 600, fontSize: "0.6875rem", px: 1, py: 0.25, borderRadius: "6px" }}>
                  External
                </Box>
                <Box sx={{ backgroundColor: "#DBEAFE", color: "#2563EB", fontWeight: 600, fontSize: "0.6875rem", px: 1, py: 0.25, borderRadius: "6px" }}>
                  Sales
                </Box>
                <Box sx={{ backgroundColor: "#FEE2E2", color: "#DC2626", fontWeight: 600, fontSize: "0.6875rem", px: 1, py: 0.25, borderRadius: "6px", display: "flex", alignItems: "center", gap: 0.5 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                  <span>High Priority</span>
                </Box>
              </Box>
            </Box>

            {/* Quick Action Icons */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, color: "#94A3B8" }}>
              <Box component="button" sx={{ background: "none", border: "none", p: 0.5, cursor: "pointer", color: "inherit", "&:hover": { color: "#F59E0B" } }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </Box>
              <Box component="button" sx={{ background: "none", border: "none", p: 0.5, cursor: "pointer", color: "inherit", "&:hover": { color: "#0F172A" } }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </Box>
              <Box component="button" sx={{ background: "none", border: "none", p: 0.5, cursor: "pointer", color: "inherit", "&:hover": { color: "#0F172A" } }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="19" cy="12" r="1" />
                  <circle cx="5" cy="12" r="1" />
                </svg>
              </Box>
            </Box>
          </Box>

          {/* Customer Email Thread Message */}
          <Box sx={{ mb: 3 }}>
            {/* Sender Info */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    backgroundColor: "#FEE2E2",
                    color: "#DC2626",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "0.8125rem",
                  }}
                >
                  SJ
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: "0.84375rem", color: "#0F172A", lineHeight: 1.2 }}>
                    Sarah Johnson <Box component="span" sx={{ fontWeight: 400, color: "#64748B", fontSize: "0.78125rem" }}>&lt;sarah@acmecorp.com&gt;</Box>
                  </Typography>
                  <Typography sx={{ fontSize: "0.71875rem", color: "#94A3B8", lineHeight: 1.2 }}>
                    to you
                  </Typography>
                </Box>
              </Box>
              <Typography sx={{ fontSize: "0.71875rem", color: "#94A3B8" }}>
                10:24 AM
              </Typography>
            </Box>

            {/* Email Message Content */}
            <Box sx={{ pl: { xs: 0, sm: 5.5 }, pr: 1, color: "#334155", fontSize: "0.8125rem", lineHeight: 1.6 }}>
              <Typography sx={{ fontSize: "inherit", mb: 1 }}>Hi,</Typography>
              <Typography sx={{ fontSize: "inherit", mb: 1 }}>
                Can you send me the pricing for 500 enterprise licenses?
              </Typography>
              <Typography sx={{ fontSize: "inherit", mb: 1 }}>
                We&apos;re planning for Q4 and would also like to know about volume discounts.
              </Typography>
              <Typography sx={{ fontSize: "inherit", mb: 0.25 }}>Thanks,</Typography>
              <Typography sx={{ fontSize: "inherit", mb: 1.5 }}>Sarah</Typography>

              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: "#94A3B8", cursor: "pointer" }}>
                <Box sx={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: "#94A3B8" }} />
                <Box sx={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: "#94A3B8" }} />
                <Box sx={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: "#94A3B8" }} />
              </Box>
            </Box>
          </Box>

          {/* AI Draft Reply Card */}
          <Box
            sx={{
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              border: "1px solid #E2E8F0",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.03)",
              p: { xs: 2, sm: 2.5 },
              mt: "auto",
            }}
          >
            {/* Header: AI draft reply + Ready to send badge */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "#4F46E5" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                <Typography sx={{ fontWeight: 700, fontSize: "0.84375rem", color: "#4F46E5" }}>
                  AI draft reply
                </Typography>
              </Box>

              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  backgroundColor: "#ECFDF5",
                  border: "1px solid #D1FAE5",
                  color: "#10B981",
                  fontWeight: 600,
                  fontSize: "0.71875rem",
                  px: 1.25,
                  py: 0.35,
                  borderRadius: "9999px",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Ready to send</span>
              </Box>
            </Box>

            {/* Draft Reply Content */}
            <Box sx={{ color: "#334155", fontSize: "0.8125rem", lineHeight: 1.6, mb: 2 }}>
              <Typography sx={{ fontSize: "inherit", mb: 0.75 }}>Hi Sarah,</Typography>
              <Typography sx={{ fontSize: "inherit", mb: 0.75 }}>
                Thanks for your interest! Here&apos;s the pricing for 500 enterprise licenses as requested. We&apos;ve included volume discounts and a few additional details that might be helpful for your Q4 planning.
              </Typography>
              <Typography sx={{ fontSize: "inherit", mb: 0.2 }}>Best regards,</Typography>
              <Typography sx={{ fontSize: "inherit" }}>Your Team</Typography>
            </Box>

            {/* Action Buttons */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
              {/* Send Button (Split button) */}
              <Box
                sx={{
                  display: "inline-flex",
                  borderRadius: "8px",
                  overflow: "hidden",
                  boxShadow: "0 2px 8px rgba(79, 70, 229, 0.3)",
                }}
              >
                <Box
                  component="button"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    backgroundColor: "#4F46E5",
                    color: "#FFFFFF",
                    border: "none",
                    px: 2,
                    py: 0.9,
                    fontWeight: 600,
                    fontSize: "0.8125rem",
                    cursor: "pointer",
                    "&:hover": { backgroundColor: "#4338CA" },
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  <span>Send</span>
                </Box>
                <Box
                  component="button"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#4338CA",
                    color: "#FFFFFF",
                    border: "none",
                    borderLeft: "1px solid rgba(255, 255, 255, 0.2)",
                    px: 1,
                    cursor: "pointer",
                    "&:hover": { backgroundColor: "#3730A3" },
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </Box>
              </Box>

              {/* Edit Button */}
              <Box
                component="button"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: "8px",
                  color: "#334155",
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  px: 1.75,
                  py: 0.9,
                  cursor: "pointer",
                  "&:hover": { backgroundColor: "#F8FAFC", borderColor: "#CBD5E1" },
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
                <span>Edit</span>
              </Box>

              {/* Regenerate Button */}
              <Box
                component="button"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: "8px",
                  color: "#334155",
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  px: 1.75,
                  py: 0.9,
                  cursor: "pointer",
                  "&:hover": { backgroundColor: "#F8FAFC", borderColor: "#CBD5E1" },
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                  <path d="M8 16H3v5" />
                </svg>
                <span>Regenerate</span>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
