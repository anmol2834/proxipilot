"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import ButtonBase from "@mui/material/ButtonBase";
import { useRouter } from "next/navigation";

interface ActionItem {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  icon: React.ReactNode;
}

const ACTIONS: ActionItem[] = [
  {
    id: "gmail",
    title: "Connect Gmail",
    subtitle: "Use your Gmail account",
    href: "/dashboard/integrations",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
      </svg>
    ),
  },
  {
    id: "outlook",
    title: "Connect Outlook",
    subtitle: "Use Microsoft Workspace",
    href: "/dashboard/integrations",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24">
        <rect width="10" height="10" x="1" y="1" fill="#F25022" />
        <rect width="10" height="10" x="13" y="1" fill="#7FBA00" />
        <rect width="10" height="10" x="1" y="13" fill="#00A4EF" />
        <rect width="10" height="10" x="13" y="13" fill="#FFB900" />
      </svg>
    ),
  },
  {
    id: "knowledge",
    title: "Add knowledge",
    subtitle: "Upload documents or add a website",
    href: "/dashboard/knowledge",
    icon: (
      <Box sx={{ color: "#2563EB", display: "flex" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </Box>
    ),
  },
  {
    id: "team",
    title: "Invite team",
    subtitle: "Send invitations to your team",
    href: "/dashboard/team",
    icon: (
      <Box sx={{ color: "#2563EB", display: "flex" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" y1="8" x2="19" y2="14" />
          <line x1="22" y1="11" x2="16" y2="11" />
        </svg>
      </Box>
    ),
  },
];

export function QuickActionsCard() {
  const router = useRouter();

  return (
    <Paper
      elevation={0}
      sx={{
        backgroundColor: "#FFFFFF",
        borderRadius: "18px",
        border: "1px solid #EEF2F6",
        p: { xs: 2.5, sm: 3 },
        boxShadow: "0 4px 20px rgba(15, 23, 42, 0.03)",
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Card Header: Lightbulb + Title */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5 }}>
        <Box sx={{ color: "#2563EB", display: "flex" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
            <path d="M9 18h6" />
            <path d="M10 22h4" />
          </svg>
        </Box>
        <Typography sx={{ fontWeight: 800, fontSize: "0.98rem", color: "#0F172A" }}>
          Quick actions
        </Typography>
      </Box>

      {/* 4 Action Items Grid */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
          gap: 1.5,
        }}
      >
        {ACTIONS.map((action) => (
          <ButtonBase
            key={action.id}
            onClick={() => router.push(action.href)}
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "space-between",
              p: 2,
              borderRadius: "14px",
              border: "1px solid #EEF2F6",
              backgroundColor: "#FFFFFF",
              textAlign: "left",
              minHeight: 110,
              transition: "all 150ms ease",
              "&:hover": {
                borderColor: "#BFDBFE",
                backgroundColor: "#F8FAFC",
                transform: "translateY(-2px)",
                boxShadow: "0 6px 16px rgba(37, 99, 235, 0.08)",
                "& .chevron-arrow": {
                  color: "#2563EB",
                  transform: "translateX(2px)",
                },
              },
            }}
          >
            {/* Top row: Icon + Chevron */}
            <Box sx={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
              {action.icon}
              <Box className="chevron-arrow" sx={{ color: "#CBD5E1", display: "flex", transition: "all 150ms ease" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Box>
            </Box>

            {/* Title & Subtitle */}
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: "0.85rem", color: "#0F172A", lineHeight: 1.2 }}>
                {action.title}
              </Typography>
              <Typography sx={{ fontSize: "0.72rem", color: "#64748B", mt: 0.4, lineHeight: 1.3 }}>
                {action.subtitle}
              </Typography>
            </Box>
          </ButtonBase>
        ))}
      </Box>
    </Paper>
  );
}
