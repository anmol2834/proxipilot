import React, { Suspense } from "react";
import type { Metadata } from "next";
import { LeadsWorkspace } from "@/components/leads/LeadsWorkspace";

export const metadata: Metadata = {
  title: "Leads — ProxiPilot",
  description: "Conversation intelligence: lead temperature, open opportunities and follow-ups.",
};

export default function LeadsPage() {
  return (
    <Suspense fallback={null}>
      <LeadsWorkspace />
    </Suspense>
  );
}
