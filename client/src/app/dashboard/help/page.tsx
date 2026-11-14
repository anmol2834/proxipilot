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
      description="Setup guides and answers to common questions, and a way to contact our support team."
    />
  );
}
