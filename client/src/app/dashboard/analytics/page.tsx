import React from "react";
import type { Metadata } from "next";
import { SubroutePlaceholder } from "@/components/dashboard";

export const metadata: Metadata = {
  title: "Analytics — ProxiPilot",
  description: "Response times, deflection rates, and organization operational insights.",
};

export default function AnalyticsPage() {
  return (
    <SubroutePlaceholder
      title="Intelligence Analytics"
      badge="Reporting"
      description="Deep dive into resolution accuracy, SLA compliance, and agent productivity."
    />
  );
}
