"use client";

import React from "react";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTenant } from "@/hooks/use-tenant";
import { can } from "@/lib/permissions";
import { UserRole } from "@/types/user.types";
import { C } from "./ui";
import { OverviewTab } from "./OverviewTab";
import { ContactsTab } from "./ContactsTab";
import { CommitmentsTab } from "./CommitmentsTab";
import { PracticesTab } from "./PracticesTab";
import { StyleTab } from "./StyleTab";
import { FeedbackTab } from "./FeedbackTab";

export const MEMORY_TABS = ["overview", "contacts", "commitments", "practices", "style", "feedback"] as const;
export type MemoryTab = (typeof MEMORY_TABS)[number];

const LABELS: Record<MemoryTab, string> = {
  overview: "Overview",
  contacts: "Contacts",
  commitments: "Decisions & commitments",
  practices: "How we operate",
  style: "Writing style",
  feedback: "Draft feedback",
};

export function MemoryHub() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { role } = useTenant();
  const canEdit = can({ role: (role ?? undefined) as UserRole | undefined }, "email.reply");
  const raw = params.get("tab");
  const tab: MemoryTab = (MEMORY_TABS as readonly string[]).includes(raw ?? "") ? (raw as MemoryTab) : "overview";

  const go = (t: MemoryTab) => {
    const sp = new URLSearchParams(params.toString());
    if (t === "overview") sp.delete("tab"); else sp.set("tab", t);
    router.replace(`${pathname}${sp.toString() ? `?${sp}` : ""}`, { scroll: false });
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, pb: 6 }}>
      <Box>
        <Typography sx={{ fontSize: 22, fontWeight: 700, color: C.text }}>AI Memory</Typography>
        <Typography sx={{ fontSize: 14, color: C.muted, mt: 0.5, maxWidth: 820 }}>
          Everything ProxiPilot remembers about your business, your customers and your conversations — and what it learns
          from your team. Changes here apply to the very next AI reply.
          {!canEdit && " You have read-only access."}
        </Typography>
      </Box>
      <Tabs value={tab} onChange={(_, v) => go(v)} variant="scrollable" scrollButtons="auto"
            sx={{ borderBottom: `1px solid ${C.border}`, minHeight: 40,
                  "& .MuiTab-root": { textTransform: "none", fontWeight: 600, minHeight: 40, fontSize: 14 } }}>
        {MEMORY_TABS.map((t) => <Tab key={t} value={t} label={LABELS[t]} />)}
      </Tabs>
      {tab === "overview" && <OverviewTab onOpen={go} />}
      {tab === "contacts" && <ContactsTab canEdit={canEdit} />}
      {tab === "commitments" && <CommitmentsTab canEdit={canEdit} />}
      {tab === "practices" && <PracticesTab canEdit={canEdit} />}
      {tab === "style" && <StyleTab canEdit={canEdit} />}
      {tab === "feedback" && <FeedbackTab canEdit={canEdit} />}
    </Box>
  );
}
