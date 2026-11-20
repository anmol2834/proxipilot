import React from "react";
import type { Metadata } from "next";
import { LeadsQueue } from "@/components/leads/LeadsQueue";

export const metadata: Metadata = {
  title: "Leads — ProxiPilot",
  description: "Conversation intelligence: lead temperature, open opportunities and follow-ups.",
};

export default function LeadsPage() {
  return <LeadsQueue />;
}
