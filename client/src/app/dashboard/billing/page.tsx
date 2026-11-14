import React from "react";
import type { Metadata } from "next";
import { SubroutePlaceholder } from "@/components/dashboard";

export const metadata: Metadata = {
  title: "Billing & Plans — ProxiPilot",
  description: "Subscription management, usage tracking, and invoice history.",
};

export default function BillingPage() {
  return (
    <SubroutePlaceholder
      title="Billing & Subscription"
      badge="Account"
      description="Manage your enterprise subscription, seat allocation, AI token consumption, and download invoices."
    />
  );
}
