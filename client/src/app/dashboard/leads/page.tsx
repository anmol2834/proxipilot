import React from "react";
import type { Metadata } from "next";
import { SubroutePlaceholder } from "@/components/dashboard";

export const metadata: Metadata = {
  title: "Leads — ProxiPilot",
  description: "AI-qualified prospects and automated lead scoring pipeline.",
};

export default function LeadsPage() {
  return (
    <SubroutePlaceholder
      title="Lead Intelligence"
      description="Track inbound prospect requests, qualification scores, and CRM sync status."
    />
  );
}
