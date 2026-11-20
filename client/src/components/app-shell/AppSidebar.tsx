"use client";

import React, { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import Divider from "@mui/material/Divider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProxiPilotLogo } from "@/components/ui/ProxiPilotLogo";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";

interface NavItem {
  label: string;
  href: string;
  icon: (active: boolean) => React.ReactNode;
}

const PRIMARY_NAV: NavItem[] = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? "#2563EB" : "none"} stroke={active ? "#2563EB" : "#64748B"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="7" height="9" x="3" y="3" rx="1" />
        <rect width="7" height="5" x="14" y="3" rx="1" />
        <rect width="7" height="9" x="14" y="12" rx="1" />
        <rect width="7" height="5" x="3" y="16" rx="1" />
      </svg>
    ),
  },
  {
    label: "Inbox",
    href: "/dashboard/inbox",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? "#2563EB" : "none"} stroke={active ? "#2563EB" : "#64748B"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
        <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      </svg>
    ),
  },
  {
    label: "Automations",
    href: "/dashboard/automations",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? "#2563EB" : "none"} stroke={active ? "#2563EB" : "#64748B"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v4" />
        <path d="m4.93 4.93 2.83 2.83" />
        <path d="M2 12h4" />
        <path d="m4.93 19.07 2.83-2.83" />
        <path d="M12 22v-4" />
        <path d="m19.07 19.07-2.83-2.83" />
        <path d="M22 12h-4" />
        <path d="m19.07 4.93-2.83 2.83" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
  },
  {
    label: "Knowledge",
    href: "/dashboard/knowledge",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? "#2563EB" : "none"} stroke={active ? "#2563EB" : "#64748B"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
        <path d="M6 6h10" />
        <path d="M6 10h10" />
      </svg>
    ),
  },
  {
    label: "AI Memory",
    href: "/dashboard/memory",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#2563EB" : "#64748B"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
        <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
        <path d="M12 5v13" />
      </svg>
    ),
  },
  {
    label: "Analytics",
    href: "/dashboard/analytics",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? "#2563EB" : "none"} stroke={active ? "#2563EB" : "#64748B"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
];

const SECONDARY_NAV: NavItem[] = [
  {
    label: "Integrations",
    href: "/dashboard/integrations",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? "#2563EB" : "none"} stroke={active ? "#2563EB" : "#64748B"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
  {
    label: "Team",
    href: "/dashboard/team",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? "#2563EB" : "none"} stroke={active ? "#2563EB" : "#64748B"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    label: "Templates",
    href: "/dashboard/templates",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? "#2563EB" : "none"} stroke={active ? "#2563EB" : "#64748B"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M3 9h18" />
        <path d="M9 21V9" />
      </svg>
    ),
  },
];

const BOTTOM_NAV: NavItem[] = [
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? "#2563EB" : "none"} stroke={active ? "#2563EB" : "#64748B"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      </svg>
    ),
  },
  {
    label: "Help",
    href: "/dashboard/help",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? "#2563EB" : "none"} stroke={active ? "#2563EB" : "#64748B"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
];

interface AppSidebarProps {
  onItemClick?: () => void;
}

export function AppSidebar({ onItemClick }: AppSidebarProps) {
  const pathname = usePathname();
  const { currentOrganization } = useTenant();
  const { user } = useAuth();

  const [activePlanOverride, setActivePlanOverride] = useState<string | null>(null);

  useEffect(() => {
    const readPlan = () => {
      try {
        const stored = localStorage.getItem("proxipilot_active_plan");
        if (stored) setActivePlanOverride(stored.toLowerCase());
      } catch {}
    };
    readPlan();
    window.addEventListener("storage", readPlan);
    window.addEventListener("plan-updated", readPlan);
    return () => {
      window.removeEventListener("storage", readPlan);
      window.removeEventListener("plan-updated", readPlan);
    };
  }, []);

  const rawPlan = (
    activePlanOverride ||
    ((currentOrganization as any)?.plan || (user as any)?.plan || "growth") as string
  ).toLowerCase();

  const nextPlanSuggestion = useMemo(() => {
    if (rawPlan === "starter") {
      return {
        title: "Upgrade to Growth",
        subtitle: "Unlock AI autopilot & 2,500 credits",
        bg: "#F0F6FF",
        border: "#DBEAFE",
        hoverBg: "#E0EDFF",
        badgeBg: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 50%, #DB2777 100%)",
        textColor: "#1E3A8A",
        subColor: "#3B82F6",
      };
    }
    if (rawPlan === "growth") {
      return {
        title: "Upgrade to Business",
        subtitle: "Unlock custom AI tone & 10k credits",
        bg: "#FFFBEB",
        border: "#FDE68A",
        hoverBg: "#FEF3C7",
        badgeBg: "linear-gradient(135deg, #D97706 0%, #DC2626 50%, #7C3AED 100%)",
        textColor: "#92400E",
        subColor: "#B45309",
      };
    }
    if (rawPlan === "business") {
      return {
        title: "Upgrade to Enterprise",
        subtitle: "Dedicated cluster & custom SLA",
        bg: "#EFF6FF",
        border: "#BFDBFE",
        hoverBg: "#DBEAFE",
        badgeBg: "linear-gradient(135deg, #1D4ED8 0%, #4F46E5 100%)",
        textColor: "#1E40AF",
        subColor: "#2563EB",
      };
    }
    if (rawPlan === "enterprise") {
      return {
        title: "Enterprise Active",
        subtitle: "Dedicated SLA & 50k+ credits",
        bg: "#ECFDF5",
        border: "#A7F3D0",
        hoverBg: "#DCFCE7",
        badgeBg: "linear-gradient(135deg, #059669 0%, #0D9488 100%)",
        textColor: "#065F46",
        subColor: "#059669",
      };
    }
    return {
      title: "Upgrade to Growth",
      subtitle: "Unlock AI autopilot & 2,500 credits",
      bg: "#F0F6FF",
      border: "#DBEAFE",
      hoverBg: "#E0EDFF",
      badgeBg: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 50%, #DB2777 100%)",
      textColor: "#1E3A8A",
      subColor: "#3B82F6",
    };
  }, [rawPlan]);

  const isNavActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  const renderNavList = (items: NavItem[]) => (
    <List sx={{ p: 0, display: "flex", flexDirection: "column", gap: 0.5 }}>
      {items.map((item) => {
        const active = isNavActive(item.href);

        return (
          <ListItemButton
            key={item.label}
            component={Link}
            href={item.href}
            onClick={onItemClick}
            sx={{
              borderRadius: "10px",
              py: 0.85,
              px: 1.5,
              backgroundColor: active ? "#EEF2FF" : "transparent",
              color: active ? "#2563EB" : "#475569",
              position: "relative",
              transition: "all 140ms ease",
              "&:hover": {
                backgroundColor: active ? "#EEF2FF" : "#F8FAFC",
                color: active ? "#2563EB" : "#0F172A",
              },
            }}
          >
            {active && (
              <Box
                sx={{
                  position: "absolute",
                  left: 0,
                  top: "20%",
                  bottom: "20%",
                  width: 3.5,
                  borderRadius: "0 4px 4px 0",
                  backgroundColor: "#2563EB",
                }}
              />
            )}
            <ListItemIcon
              sx={{
                minWidth: 30,
                color: active ? "#2563EB" : "#64748B",
              }}
            >
              {item.icon(active)}
            </ListItemIcon>
            <Typography
              sx={{
                fontSize: "0.86rem",
                fontWeight: active ? 700 : 500,
                letterSpacing: "-0.01em",
                color: active ? "#2563EB" : "#334155",
              }}
            >
              {item.label}
            </Typography>
          </ListItemButton>
        );
      })}
    </List>
  );

  return (
    <Box
      sx={{
        width: 245,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#FFFFFF",
        borderRight: "1px solid #EEF2F6",
        p: 2,
        boxSizing: "border-box",
      }}
    >
      {/* Top: Brand Logo + Primary Nav */}
      <Box>
        {/* Brand Logo Header */}
        <Box sx={{ mb: 3, px: 1 }}>
          <ProxiPilotLogo size={28} href="/dashboard" textSize="1.15rem" />
        </Box>

        {/* Primary Nav List */}
        {renderNavList(PRIMARY_NAV)}

        <Divider sx={{ my: 1.75, borderColor: "#F1F5F9" }} />

        {/* Secondary Nav List */}
        {renderNavList(SECONDARY_NAV)}
      </Box>

      {/* Bottom: Settings/Help + Upgrade Promo Card */}
      <Box sx={{ mt: 2 }}>
        {renderNavList(BOTTOM_NAV)}

        {/* Dynamic Tier Suggestion Card */}
        <Box
          component={Link}
          href="/dashboard/settings?tab=billing"
          onClick={onItemClick}
          sx={{
            mt: 2,
            p: 1.75,
            borderRadius: "14px",
            backgroundColor: nextPlanSuggestion.bg,
            border: `1px solid ${nextPlanSuggestion.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            textDecoration: "none",
            transition: "all 150ms ease",
            "&:hover": {
              backgroundColor: nextPlanSuggestion.hoverBg,
            },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: "9px",
                background: nextPlanSuggestion.badgeBg,
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 2px 6px rgba(0, 0, 0, 0.15)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
            </Box>
            <Box>
              <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: nextPlanSuggestion.textColor, lineHeight: 1.2 }}>
                {nextPlanSuggestion.title}
              </Typography>
              <Typography sx={{ fontSize: "0.68rem", color: nextPlanSuggestion.subColor, lineHeight: 1.2 }}>
                {nextPlanSuggestion.subtitle}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ color: nextPlanSuggestion.textColor, display: "flex" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
