"use client";

import React from "react";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { FollowupSettings } from "./FollowupSettings";
import { FU } from "@/components/followups/meta";

/** Workspace settings. Sections are tabs so more workspace preferences can be added without a new page. */
export function SettingsHub() {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, maxWidth: 980 }}>
      <Box>
        <Typography component="h1" sx={{ fontSize: 22, fontWeight: 700, color: FU.text }}>Workspace settings</Typography>
        <Typography sx={{ fontSize: 14, color: FU.muted, mt: 0.5 }}>Preferences that apply to everyone in this workspace.</Typography>
      </Box>
      <Tabs value="followups" sx={{ borderBottom: "1px solid #EEF2F6", minHeight: 40,
                                    "& .MuiTab-root": { textTransform: "none", fontWeight: 600, minHeight: 40, fontSize: 14 } }}>
        <Tab value="followups" label="Follow-ups & reminders" />
      </Tabs>
      <FollowupSettings />
    </Box>
  );
}
