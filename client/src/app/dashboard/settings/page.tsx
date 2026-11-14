import React from "react";
import type { Metadata } from "next";
import { SubroutePlaceholder } from "@/components/dashboard";

export const metadata: Metadata = {
  title: "Settings — ProxiPilot",
  description: "Organization configuration, security policies, and workspace preferences.",
};

export default function SettingsPage() {
  return (
    <SubroutePlaceholder
      title="Workspace Settings"
      description="Configure workspace domain, notification webhooks, AI confidence thresholds, and security controls."
    />
  );
}
