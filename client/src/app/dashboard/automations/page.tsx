import React from "react";
import type { Metadata } from "next";
import { SubroutePlaceholder } from "@/components/dashboard";

export const metadata: Metadata = {
  title: "Automations — ProxiPilot",
  description: "Configure deterministic and AI-driven automated email workflows.",
};

export default function AutomationsPage() {
  return (
    <SubroutePlaceholder
      title="Automations"
      badge="Workflow Engine"
      description="Design triggers, conditional logic, and AI action steps for high-frequency messages."
    />
  );
}
