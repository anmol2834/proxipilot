import React from "react";
import type { Metadata } from "next";
import { SubroutePlaceholder } from "@/components/dashboard";

export const metadata: Metadata = {
  title: "Templates — ProxiPilot",
  description: "Standardized email templates and AI response blueprints.",
};

export default function TemplatesPage() {
  return (
    <SubroutePlaceholder
      title="Response Templates"
      badge="Library"
      description="Create dynamic parameterized response templates for instant human-in-the-loop dispatch."
    />
  );
}
