"use client";

import React, { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ButtonBase from "@mui/material/ButtonBase";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import Divider from "@mui/material/Divider";
import Avatar from "@mui/material/Avatar";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";

export function UserProfileMenu() {
  const router = useRouter();
  const { user, signout } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const fullName = mounted ? (user?.full_name || user?.email?.split("@")[0] || "") : "";
  const email = mounted ? (user?.email || "") : "";
  const initial = mounted ? ((fullName.charAt(0) || user?.email?.charAt(0) || "U").toUpperCase()) : "U";

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSignOut = async () => {
    handleClose();
    await signout();
  };

  return (
    <>
      <ButtonBase
        onClick={handleClick}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          p: "3px 6px",
          borderRadius: "10px",
          transition: "all 150ms ease",
          "&:hover": {
            backgroundColor: "#F8FAFC",
          },
        }}
      >
        {/* User Avatar Circle */}
        <Avatar
          sx={{
            width: 32,
            height: 32,
            backgroundColor: "#1E293B",
            color: "#FFFFFF",
            fontSize: "0.85rem",
            fontWeight: 700,
          }}
        >
          {initial}
        </Avatar>

        {/* Name & Email */}
        <Box sx={{ textAlign: "left", display: { xs: "none", md: "block" } }}>
          <Typography
            sx={{
              fontSize: "0.8rem",
              fontWeight: 700,
              color: "#0F172A",
              lineHeight: 1.2,
              maxWidth: 120,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {fullName}
          </Typography>
          <Typography
            sx={{
              fontSize: "0.68rem",
              color: "#64748B",
              lineHeight: 1.2,
              maxWidth: 120,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {email}
          </Typography>
        </Box>

        {/* Chevron */}
        <Box sx={{ color: "#94A3B8", display: "flex", ml: 0.25 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </Box>
      </ButtonBase>

      {/* Profile Dropdown Menu */}
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        disableScrollLock
        slotProps={{
          paper: {
            sx: {
              width: 220,
              mt: 1,
              borderRadius: "12px",
              boxShadow: "0 10px 30px rgba(15, 23, 42, 0.12)",
              border: "1px solid #E2E8F0",
              p: 0.5,
            },
          },
        }}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
      >
        <Box sx={{ px: 1.5, py: 1 }}>
          <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: "#0F172A" }}>
            {fullName}
          </Typography>
          <Typography sx={{ fontSize: "0.72rem", color: "#64748B" }}>
            {email}
          </Typography>
        </Box>

        <Divider sx={{ my: 0.5 }} />

        <MenuItem
          onClick={() => {
            handleClose();
            router.push("/dashboard/settings?tab=profile");
          }}
          sx={{ borderRadius: "8px", fontSize: "0.82rem", color: "#334155" }}
        >
          <ListItemIcon sx={{ minWidth: 26, color: "#64748B" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          </ListItemIcon>
          <Typography sx={{ fontSize: "0.82rem", color: "#334155" }}>
            Profile
          </Typography>
        </MenuItem>

        <MenuItem
          onClick={() => {
            handleClose();
            router.push("/dashboard/settings?tab=preferences");
          }}
          sx={{ borderRadius: "8px", fontSize: "0.82rem", color: "#334155" }}
        >
          <ListItemIcon sx={{ minWidth: 26, color: "#64748B" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          </ListItemIcon>
          <Typography sx={{ fontSize: "0.82rem", color: "#334155" }}>
            Preferences
          </Typography>
        </MenuItem>

        <MenuItem
          onClick={() => {
            handleClose();
            router.push("/dashboard/billing");
          }}
          sx={{ borderRadius: "8px", fontSize: "0.82rem", color: "#334155" }}
        >
          <ListItemIcon sx={{ minWidth: 26, color: "#64748B" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
          </ListItemIcon>
          <Typography sx={{ fontSize: "0.82rem", color: "#334155" }}>
            Billing & Plans
          </Typography>
        </MenuItem>

        <Divider sx={{ my: 0.5 }} />

        <MenuItem
          onClick={handleSignOut}
          sx={{ borderRadius: "8px", fontSize: "0.82rem", color: "#EF4444", fontWeight: 600 }}
        >
          <ListItemIcon sx={{ minWidth: 26, color: "#EF4444" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
          </ListItemIcon>
          <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: "#EF4444" }}>
            Sign out
          </Typography>
        </MenuItem>
      </Menu>
    </>
  );
}
