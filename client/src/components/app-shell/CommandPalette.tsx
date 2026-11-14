"use client";

import React, { useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import InputBase from "@mui/material/InputBase";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import { useRouter } from "next/navigation";

interface CommandItem {
  id: string;
  title: string;
  category: string;
  href: string;
  icon: React.ReactNode;
}

const COMMANDS: CommandItem[] = [
  {
    id: "overview",
    title: "Go to Overview",
    category: "Navigation",
    href: "/dashboard",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></svg>,
  },
  {
    id: "inbox",
    title: "Open Inbox",
    category: "Navigation",
    href: "/dashboard/inbox",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>,
  },
  {
    id: "automations",
    title: "Manage Automations",
    category: "Navigation",
    href: "/dashboard/automations",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  },
  {
    id: "knowledge",
    title: "Add Business Knowledge",
    category: "Actions",
    href: "/dashboard/knowledge",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" /><path d="M6 6h10" /><path d="M6 10h10" /></svg>,
  },
  {
    id: "integrations",
    title: "Connect Email (Gmail / Outlook)",
    category: "Actions",
    href: "/dashboard/integrations",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>,
  },
  {
    id: "analytics",
    title: "View Performance Analytics",
    category: "Navigation",
    href: "/dashboard/analytics",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
  },
  {
    id: "settings",
    title: "Workspace Settings",
    category: "Settings",
    href: "/dashboard/settings",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>,
  },
];

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const filtered = COMMANDS.filter((cmd) =>
    cmd.title.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      disableScrollLock
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(4px)",
          },
        },
        paper: {
          sx: {
            borderRadius: "16px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 25px 60px -15px rgba(15, 23, 42, 0.2)",
            overflow: "hidden",
          },
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        {/* Search Input Bar */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            px: 2.5,
            py: 1.75,
            borderBottom: "1px solid #E2E8F0",
          }}
        >
          <Box sx={{ color: "#94A3B8", display: "flex" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          </Box>
          <InputBase
            autoFocus
            fullWidth
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{
              fontSize: "0.95rem",
              fontWeight: 500,
              color: "#0F172A",
            }}
          />
          <Box
            sx={{
              px: 1,
              py: 0.25,
              borderRadius: "6px",
              backgroundColor: "#F1F5F9",
              border: "1px solid #E2E8F0",
            }}
          >
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#64748B" }}>
              ESC
            </Typography>
          </Box>
        </Box>

        {/* Results List */}
        <List sx={{ p: 1, maxHeight: 320, overflowY: "auto" }}>
          {filtered.length === 0 ? (
            <Box sx={{ p: 3, textAlign: "center" }}>
              <Typography sx={{ fontSize: "0.85rem", color: "#94A3B8" }}>
                No commands found matching &ldquo;{query}&rdquo;
              </Typography>
            </Box>
          ) : (
            filtered.map((cmd) => (
              <ListItemButton
                key={cmd.id}
                onClick={() => handleSelect(cmd.href)}
                sx={{
                  borderRadius: "10px",
                  py: 1.1,
                  px: 1.5,
                  mb: 0.5,
                  "&:hover": {
                    backgroundColor: "#EFF6FF",
                    "& .MuiListItemIcon-root": { color: "#2563EB" },
                    "& .cmd-title": { color: "#2563EB" },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 32, color: "#64748B" }}>
                  {cmd.icon}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography className="cmd-title" sx={{ fontSize: "0.85rem", fontWeight: 600, color: "#0F172A" }}>
                      {cmd.title}
                    </Typography>
                  }
                  secondary={
                    <Typography sx={{ fontSize: "0.72rem", color: "#94A3B8" }}>
                      {cmd.category}
                    </Typography>
                  }
                />
              </ListItemButton>
            ))
          )}
        </List>
      </DialogContent>
    </Dialog>
  );
}
