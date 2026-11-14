import React from "react";
import type { Metadata } from "next";
import { SubroutePlaceholder } from "@/components/dashboard";

export const metadata: Metadata = {
  title: "Help & Support — ProxiPilot",
  description: "Documentation, API guides, and priority technical support.",
};

export default function HelpPage() {
  return (
    <SubroutePlaceholder
      title="Help & Documentation"
      badge="Support"
      description="Access developer documentation, setup guides, video walkthroughs, or contact 24/7 dedicated engineering support."
    />
  );
}
