import React from "react";
import type { Metadata } from "next";
import { FollowupSettings } from "@/components/settings/FollowupSettings";

export const metadata: Metadata = {
  title: "Settings — ProxiPilot",
  description: "Organization configuration, security policies, and workspace preferences.",
};

export default function SettingsPage() {
  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#0F172A" }}>Workspace settings</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748B" }}>Preferences that apply to your whole workspace.</p>
      </div>
      <FollowupSettings />
    </div>
  );
}
