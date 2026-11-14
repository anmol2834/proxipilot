"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { knowledgeService } from "@/services/knowledge.service";
import {
  useCommitmentSummary, useContacts, useDrafts, useFeedbackMetrics, useLessons, usePractices, useStyleProfiles,
} from "@/hooks/useMemory";
import { C, StatusChip, pct } from "./ui";
import type { MemoryTab } from "./MemoryHub";

type Health = "active" | "suggested" | "low" | "overdue";

function Tile({ n, title, what, value, detail, health, href, onOpen }: {
  n: string; title: string; what: string; value: React.ReactNode; detail?: React.ReactNode; health: Health;
  href?: string; onOpen?: () => void;
}) {
  const label = health === "active" ? "Working" : health === "suggested" ? "Learning" : health === "overdue" ? "Needs attention" : "Waiting for data";
  const inner = (
    <Box sx={{ p: 2.25, height: "100%", borderRadius: "14px", border: `1px solid ${C.border}`, backgroundColor: "#FFFFFF",
               cursor: href || onOpen ? "pointer" : "default", transition: "border-color .15s",
               "&:hover": href || onOpen ? { borderColor: "#BFDBFE" } : undefined, display: "flex", flexDirection: "column", gap: 0.75 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
        <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: C.muted, letterSpacing: 0.3 }}>{n}</Typography>
        <StatusChip value={health} label={label} />
      </Box>
      <Typography sx={{ fontSize: 15, fontWeight: 650, color: C.text }}>{title}</Typography>
      <Typography sx={{ fontSize: 12.5, color: C.muted, lineHeight: 1.45 }}>{what}</Typography>
      <Typography sx={{ fontSize: 22, fontWeight: 700, color: C.text, mt: "auto", pt: 0.5, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
      {detail && <Typography sx={{ fontSize: 12, color: C.muted }}>{detail}</Typography>}
    </Box>
  );
  if (href) return <Link href={href} style={{ textDecoration: "none" }}>{inner}</Link>;
  return <Box onClick={onOpen} role={onOpen ? "button" : undefined}>{inner}</Box>;
}

const n = (v: number | undefined) => (v === undefined ? "…" : v.toLocaleString());

export function OverviewTab({ onOpen }: { onOpen: (t: MemoryTab) => void }) {
  const knowledge = useQuery({ queryKey: ["memory", "knowledge-counts"], queryFn: () => knowledgeService.getCategoryCounts(),
                               staleTime: 60_000, retry: 1 });
  const contacts = useContacts({ limit: 1 });
  const commitments = useCommitmentSummary();
  const practices = usePractices({ status: "all" });
  const style = useStyleProfiles();
  const drafts = useDrafts("pending_review");
  const metrics = useFeedbackMetrics(30);
  const lessons = useLessons();

  const kTotal = knowledge.data ? Object.values(knowledge.data).reduce((a, b) => a + (Number(b) || 0), 0) : undefined;
  const pr = practices.data ?? [];
  const prActive = pr.filter((p) => p.status === "active").length;
  const prSuggested = pr.filter((p) => p.status === "suggested").length;
  const company = style.data?.find((p) => p.scope === "company");
  const hasStyleSettings = Boolean(company && (Object.keys(company.overrides ?? {}).length || company.employee_guide));
  const cs = commitments.data;
  const m = metrics.data;
  const activeLessons = (lessons.data ?? []).filter((l) => l.status === "active").length;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 240px), 1fr))", gap: 1.5 }}>
        <Tile n="MEMORY 1 + 8" title="Company knowledge" href="/dashboard/knowledge"
              what="Products, prices, policies and official information. Edit → Update & Publish syncs instantly, with version history and rollback."
              value={n(kTotal)} detail="items, all searchable" health={kTotal ? "active" : "low"} />
        <Tile n="MEMORY 2" title="Communication style" onOpen={() => onOpen("style")}
              what="How your team writes — greeting, sign-off, tone, language and situational habits."
              value={company?.status === "active" ? `${company.sample_count} emails` : hasStyleSettings ? "Team settings" : "Not set"}
              detail={company?.status === "active" ? "learned from your team" : "learns from hand-written replies"}
              health={company?.status === "active" ? "active" : hasStyleSettings ? "suggested" : "low"} />
        <Tile n="MEMORY 3" title="Conversations" href="/dashboard/inbox"
              what="Each thread's summary, customer requirements, open issues and agreed facts — kept up to date after every email."
              value="Per thread" detail="Open any conversation in the Inbox → AI memory" health="active" />
        <Tile n="MEMORY 4" title="Contacts & relationships" onOpen={() => onOpen("contacts")}
              what="Every customer, supplier and partner — history, preferences, interests and needs."
              value={n(contacts.data?.total)} detail="contacts remembered" health={contacts.data?.total ? "active" : "low"} />
        <Tile n="MEMORY 5" title="How the business operates" onOpen={() => onOpen("practices")}
              what="Workflows, negotiation limits, approvals and complaint handling that guide every reply."
              value={`${prActive} active`} detail={prSuggested ? `${prSuggested} learned suggestion(s) to approve` : undefined}
              health={prSuggested ? "suggested" : prActive ? "active" : "low"} />
        <Tile n="MEMORY 6" title="Decisions & commitments" onOpen={() => onOpen("commitments")}
              what="Promises made, decisions and approvers, pending actions and deadlines — and how they ended."
              value={cs ? `${cs.open} open` : "…"}
              detail={cs ? `${cs.overdue} overdue · ${cs.decisions_in_force} decisions in force` : undefined}
              health={cs && cs.overdue > 0 ? "overdue" : cs && cs.open > 0 ? "active" : "low"} />
        <Tile n="MEMORY 7" title="Feedback & outcomes" onOpen={() => onOpen("feedback")}
              what="Learns from approved, edited and rejected drafts and from how customers react."
              value={m ? `${m.drafts_reviewed} reviewed` : "…"}
              detail={m ? `${pct(m.approval_rate)} approved as-is · ${activeLessons} active lesson(s)${drafts.data?.total ? ` · ${drafts.data.total} waiting` : ""}` : undefined}
              health={drafts.data?.total ? "overdue" : m && m.drafts_reviewed ? "active" : "low"} />
        <Tile n="ENGINE" title="Context Intelligence" href="/dashboard/inbox"
              what="Combines all memories for each reply, catches changed prices, outdated facts and overdue promises, and sends risky replies to review."
              value="Every reply" detail="See it per message: Inbox → AI memory" health="active" />
      </Box>
      <Typography sx={{ fontSize: 12, color: C.muted }}>
        All memories are private to your organisation. Team-entered information always has the highest authority — the AI can't overwrite it.
      </Typography>
    </Box>
  );
}
