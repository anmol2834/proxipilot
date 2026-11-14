import React from "react";
import type { Metadata } from "next";
import { SubroutePlaceholder } from "@/components/dashboard";

export const metadata: Metadata = {
  title: "Campaigns — ProxiPilot",
  description: "Personalized outreach and multi-touch email sequences.",
};

export default function CampaignsPage() {
  return (
    <SubroutePlaceholder
      title="Outreach Campaigns"
      description="Orchestrate hyper-personalized follow-up sequences with real-time intent analysis."
    />
  );
}
