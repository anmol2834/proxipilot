"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import { AppSidebar } from "./AppSidebar";
import { AppTopbar } from "./AppTopbar";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const pathname = usePathname();
  const isInbox = pathname?.startsWith("/dashboard/inbox");
  const isSettings = pathname?.startsWith("/dashboard/settings");
  const isFixedLayout = isInbox || isSettings;
  const isFullBleed = isInbox || isSettings;

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        height: { xs: isInbox ? "100vh" : "auto", md: isFixedLayout ? "100vh" : "auto" },
        maxHeight: { xs: isInbox ? "100vh" : "none", md: isFixedLayout ? "100vh" : "none" },
        overflow: { xs: isInbox ? "hidden" : "visible", md: isFixedLayout ? "hidden" : "visible" },
        backgroundColor: isSettings ? "#FFFFFF" : "#F8FAFC",
        width: "100%",
      }}
    >
      {/* Desktop Fixed Sidebar (Visible md+) */}
      <Box
        component="aside"
        sx={{
          display: { xs: "none", md: "block" },
          width: 245,
          flexShrink: 0,
          position: "sticky",
          top: 0,
          height: "100vh",
          zIndex: 20,
        }}
      >
        <AppSidebar />
      </Box>

      {/* Mobile Drawer (Visible <900px) */}
      <Drawer
        anchor="left"
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        disableScrollLock
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": {
            width: 260,
            boxSizing: "border-box",
          },
        }}
      >
        <AppSidebar onItemClick={() => setMobileDrawerOpen(false)} />
      </Drawer>

      {/* Main Content Area: Topbar + Page Body */}
      <Box
        component="main"
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          height: { xs: isInbox ? "100vh" : "auto", md: isFixedLayout ? "100vh" : "auto" },
          maxHeight: { xs: isInbox ? "100vh" : "none", md: isFixedLayout ? "100vh" : "none" },
          overflow: { xs: isInbox ? "hidden" : "visible", md: isFixedLayout ? "hidden" : "visible" },
        }}
      >
        <AppTopbar onToggleMobileMenu={() => setMobileDrawerOpen(true)} />

        {/* Page Body Container (Full-bleed for inbox and settings, standard padded for other views) */}
        <Box
          sx={
            isFullBleed
              ? {
                  flex: 1,
                  p: 0,
                  width: "100%",
                  height: { xs: isInbox ? "calc(100vh - 64px)" : "auto", md: isFixedLayout ? "calc(100vh - 64px)" : "auto" },
                  minHeight: isSettings ? "calc(100vh - 64px)" : "auto",
                  backgroundColor: "#FFFFFF",
                  overflow: { xs: isInbox ? "hidden" : "visible", md: isFixedLayout ? "hidden" : "visible" },
                  display: "flex",
                  flexDirection: "column",
                }
              : {
                  flex: 1,
                  p: { xs: 2, sm: 3, md: 4 },
                  maxWidth: 1300,
                  width: "100%",
                  mx: "auto",
                  boxSizing: "border-box",
                }
          }
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
