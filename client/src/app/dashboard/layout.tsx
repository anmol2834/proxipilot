import React from "react";
import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { DashboardGuard } from "@/components/dashboard/DashboardGuard";
import { BackgroundImportIndicator } from "@/components/knowledge/BackgroundImportIndicator";

export const metadata: Metadata = {
  title: "Dashboard — ProxiPilot",
  description: "Organization overview and AI-driven inbox intelligence command center.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardGuard>
      <AppShell>
        {children}
        {/* Knowledge imports keep running (and are visible) while the user navigates */}
        <BackgroundImportIndicator />
      </AppShell>
    </DashboardGuard>
  );
}
