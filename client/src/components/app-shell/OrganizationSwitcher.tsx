"use client";

import React, { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ButtonBase from "@mui/material/ButtonBase";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import Divider from "@mui/material/Divider";
import { useTenant } from "@/hooks/use-tenant";
import { useRouter } from "next/navigation";

export function OrganizationSwitcher() {
  const router = useRouter();
  const { currentOrganization, organizations, switchOrganization, isSwitching } = useTenant();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const orgName = currentOrganization?.name || "My Organization";
  // Real active-member count from /auth/me; hidden (not guessed) until it is known.
  const memberCount = currentOrganization?.member_count;
  const memberLabel =
    typeof memberCount === "number" && memberCount > 0
      ? `${memberCount} ${memberCount === 1 ? "member" : "members"}`
      : currentOrganization?.role || "";

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <ButtonBase
        onClick={handleClick}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          p: "4px 8px",
          borderRadius: "10px",
          border: "1px solid #E2E8F0",
          backgroundColor: "#FFFFFF",
          transition: "all 150ms ease",
          "&:hover": {
            backgroundColor: "#F8FAFC",
            borderColor: "#CBD5E1",
          },
        }}
      >
        {/* Organization Icon Badge */}
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: "7px",
            backgroundColor: "#EFF6FF",
            color: "#2563EB",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
            <path d="M9 22v-4h6v4" />
            <path d="M8 6h.01" />
            <path d="M16 6h.01" />
            <path d="M8 10h.01" />
            <path d="M16 10h.01" />
            <path d="M8 14h.01" />
            <path d="M16 14h.01" />
          </svg>
        </Box>

        {/* Name & Member Count */}
        <Box sx={{ textAlign: "left", display: { xs: "none", sm: "block" } }}>
          <Typography
            sx={{
              fontSize: "0.8rem",
              fontWeight: 700,
              color: "#0F172A",
              lineHeight: 1.2,
              maxWidth: 110,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {orgName}
          </Typography>
          <Typography sx={{ fontSize: "0.68rem", color: "#64748B", lineHeight: 1.2 }}>
            {memberLabel}
          </Typography>
        </Box>

        {/* Chevron */}
        <Box sx={{ color: "#94A3B8", display: "flex", ml: 0.25 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </Box>
      </ButtonBase>

      {/* Organization Switcher Dropdown */}
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
          <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>
            Current Organization
          </Typography>
        </Box>

        {organizations.map((org) => {
          const isSelected = org.organization_id === currentOrganization?.organization_id;
          return (
            <MenuItem
              key={org.organization_id}
              onClick={async () => {
                handleClose();
                await switchOrganization(org.organization_id);
              }}
              sx={{
                borderRadius: "8px",
                fontSize: "0.85rem",
                fontWeight: isSelected ? 700 : 500,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: isSelected ? "#EFF6FF" : "transparent",
                color: isSelected ? "#2563EB" : "#334155",
                mb: 0.5,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: "5px",
                    backgroundColor: isSelected ? "#2563EB" : "#E2E8F0",
                    color: isSelected ? "#FFFFFF" : "#475569",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.7rem",
                    fontWeight: 800,
                  }}
                >
                  {org.name.charAt(0).toUpperCase()}
                </Box>
                <Typography sx={{ fontSize: "0.82rem", fontWeight: isSelected ? 700 : 500 }}>
                  {org.name}
                </Typography>
              </Box>
              {isSelected && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </MenuItem>
          );
        })}

        <Divider sx={{ my: 0.75 }} />

        <MenuItem
          onClick={() => {
            handleClose();
            router.push("/dashboard/settings");
          }}
          sx={{ borderRadius: "8px", fontSize: "0.82rem", color: "#334155" }}
        >
          <ListItemIcon sx={{ minWidth: 26, color: "#64748B" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          </ListItemIcon>
          <Typography sx={{ fontSize: "0.82rem", color: "#334155" }}>
            Organization settings
          </Typography>
        </MenuItem>

        <MenuItem
          onClick={() => {
            handleClose();
            router.push("/signup/organization");
          }}
          sx={{ borderRadius: "8px", fontSize: "0.82rem", color: "#2563EB", fontWeight: 600 }}
        >
          <ListItemIcon sx={{ minWidth: 26, color: "#2563EB" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          </ListItemIcon>
          <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: "#2563EB" }}>
            Create new organization
          </Typography>
        </MenuItem>
      </Menu>
    </>
  );
}
