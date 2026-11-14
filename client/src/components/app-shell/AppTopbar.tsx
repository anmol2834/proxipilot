"use client";

import React, { useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import Badge from "@mui/material/Badge";
import MenuIcon from "@mui/icons-material/Menu";
import { OrganizationSwitcher } from "./OrganizationSwitcher";
import { UserProfileMenu } from "./UserProfileMenu";
import { CommandPalette } from "./CommandPalette";

interface AppTopbarProps {
  onToggleMobileMenu: () => void;
}

export function AppTopbar({ onToggleMobileMenu }: AppTopbarProps) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  return (
    <>
      <Box
        component="header"
        sx={{
          height: 64,
          backgroundColor: "#FFFFFF",
          borderBottom: "1px solid #EEF2F6",
          px: { xs: 2, sm: 3, md: 4 },
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        {/* Left Side: Mobile Hamburger + Global Search Bar */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1, maxWidth: { xs: "100%", md: 420 } }}>
          {/* Mobile Drawer Trigger (Visible only <900px) */}
          <IconButton
            onClick={onToggleMobileMenu}
            sx={{
              display: { xs: "inline-flex", md: "none" },
              color: "#475569",
              p: 1,
            }}
          >
            <MenuIcon />
          </IconButton>

          {/* Search Bar matching Reference UI */}
          <ButtonBase
            onClick={() => setCommandPaletteOpen(true)}
            sx={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: "10px",
              py: 0.8,
              px: 1.5,
              transition: "all 150ms ease",
              "&:hover": {
                backgroundColor: "#F1F5F9",
                borderColor: "#CBD5E1",
              },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box sx={{ color: "#94A3B8", display: "flex" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </Box>
              <Typography sx={{ fontSize: "0.82rem", color: "#94A3B8", fontWeight: 400 }}>
                Search emails, contacts, knowledge...
              </Typography>
            </Box>

            {/* Keyboard shortcut pill */}
            <Box
              sx={{
                display: { xs: "none", sm: "flex" },
                alignItems: "center",
                gap: 0.25,
                px: 0.75,
                py: 0.2,
                borderRadius: "5px",
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                color: "#64748B",
                fontSize: "0.68rem",
                fontWeight: 600,
              }}
            >
              <span>⌘</span>
              <span>K</span>
            </Box>
          </ButtonBase>
        </Box>

        {/* Right Side: Help, Notifications, Organization Switcher, User Profile */}
        <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1, sm: 1.5 }, ml: 2 }}>
          {/* Help Button */}
          <IconButton
            size="small"
            sx={{
              color: "#64748B",
              border: "1px solid #E2E8F0",
              borderRadius: "50%",
              width: 32,
              height: 32,
              "&:hover": { backgroundColor: "#F8FAFC" },
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </IconButton>

          {/* Notifications Button */}
          <IconButton
            size="small"
            sx={{
              color: "#64748B",
              border: "1px solid #E2E8F0",
              borderRadius: "50%",
              width: 32,
              height: 32,
              "&:hover": { backgroundColor: "#F8FAFC" },
            }}
          >
            <Badge
              variant="dot"
              sx={{
                "& .MuiBadge-dot": {
                  backgroundColor: "#2563EB",
                  top: -2,
                  right: -2,
                },
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
            </Badge>
          </IconButton>

          {/* Organization Switcher */}
          <OrganizationSwitcher />

          {/* User Profile Menu */}
          <UserProfileMenu />
        </Box>
      </Box>

      {/* Global Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </>
  );
}
