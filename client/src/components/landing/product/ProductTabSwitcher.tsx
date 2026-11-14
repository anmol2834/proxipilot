"use client";

import React, { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export type ProductTab = "inbox" | "automation" | "knowledge" | "analytics";

interface TabItem {
  id: ProductTab;
  label: string;
  icon: (color: string) => React.ReactNode;
}

const TABS: TabItem[] = [
  {
    id: "inbox",
    label: "Inbox",
    icon: (color) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </svg>
    ),
  },
  {
    id: "automation",
    label: "Automation",
    icon: (color) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
    ),
  },
  {
    id: "knowledge",
    label: "Knowledge",
    icon: (color) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: (color) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="m19 9-5 5-4-4-3 3" />
      </svg>
    ),
  },
];

interface ProductTabSwitcherProps {
  activeTab?: ProductTab;
  onTabChange?: (tab: ProductTab) => void;
}

export function ProductTabSwitcher({
  activeTab: externalTab,
  onTabChange,
}: ProductTabSwitcherProps) {
  const [internalTab, setInternalTab] = useState<ProductTab>("inbox");
  const currentTab = externalTab ?? internalTab;

  const handleSelect = (tab: ProductTab) => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };

  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: { xs: 1, sm: 1.5 },
        flexWrap: "wrap",
        p: 0.75,
        backgroundColor: "rgba(248, 250, 252, 0.8)",
        borderRadius: "9999px",
        mx: "auto",
        mb: { xs: 4, sm: 5, md: 6 },
      }}
    >
      {TABS.map((tab) => {
        const isActive = currentTab === tab.id;
        return (
          <Box
            key={tab.id}
            component="button"
            onClick={() => handleSelect(tab.id)}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              px: { xs: 2.25, sm: 3 },
              py: { xs: 1, sm: 1.15 },
              borderRadius: "9999px",
              border: isActive ? "1px solid #4F46E5" : "1px solid #E2E8F0",
              backgroundColor: isActive ? "#4F46E5" : "#FFFFFF",
              color: isActive ? "#FFFFFF" : "#475569",
              cursor: "pointer",
              boxShadow: isActive
                ? "0 4px 14px 0 rgba(79, 70, 229, 0.35)"
                : "0 1px 3px rgba(0, 0, 0, 0.04)",
              transition: "all 180ms cubic-bezier(0.4, 0, 0.2, 1)",
              "&:hover": {
                backgroundColor: isActive ? "#4338CA" : "#F8FAFC",
                color: isActive ? "#FFFFFF" : "#1E293B",
                transform: "translateY(-1px)",
                boxShadow: isActive
                  ? "0 6px 18px 0 rgba(79, 70, 229, 0.42)"
                  : "0 3px 8px rgba(0, 0, 0, 0.06)",
              },
            }}
          >
            {tab.icon(isActive ? "#FFFFFF" : "#64748B")}
            <Typography
              sx={{
                fontWeight: 600,
                fontSize: { xs: "0.8125rem", sm: "0.875rem" },
                letterSpacing: "0.01em",
                color: "inherit",
              }}
            >
              {tab.label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
