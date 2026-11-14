import React from "react";
import type { Metadata } from "next";
import { SubroutePlaceholder } from "@/components/dashboard";

export const metadata: Metadata = {
  title: "Team — ProxiPilot",
  description: "Manage organization members, workspace roles, and permissions.",
};

export default function TeamPage() {
  return (
    <SubroutePlaceholder
      title="Team Members"
      description="Invite colleagues, assign role-based access control (Admin, Operator, Viewer), and review audit logs."
    />
  );
}
