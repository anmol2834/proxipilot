import React from "react";
import type { Metadata } from "next";
import { SettingsHub } from "@/components/settings/SettingsHub";

export const metadata: Metadata = {
  title: "Settings — ProxiPilot",
  description: "Organization configuration, security policies, and workspace preferences.",
};

export default function SettingsPage() {
  return <SettingsHub />;
}
