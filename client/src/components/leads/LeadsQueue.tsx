"use client";

/** Leads queue: distinct, server-counted filters over the effective follow-up state. Suppressed and
 *  paused conversations never appear in actionable counts. Rows open the conversation in the inbox. */

import React, { useState } from "react";
import Link from "next/link";
import { IconAlertTriangle, IconChevronLeft, IconChevronRight, IconLoader2 } from "@tabler/icons-react";
import { useLeads } from "@/hooks/useFollowups";
import type { LeadFilter } from "@/types/followup.types";

const FILTERS: { key: LeadFilter; label: string; hint: string }[] = [
  { key: "active", label: "All active", hint: "Every conversation with an actionable follow-up state" },
  { key: "open_unconfirmed", label: "Open · unconfirmed", hint: "Real interest; purchase or completion not confirmed" },
  { key: "scheduled", label: "Scheduled", hint: "A follow-up is planned for later" },
  { key: "due", label: "Due", hint: "The follow-up time has arrived" },
  { key: "deferred", label: "Deferred", hint: "Customer asked for a later window" },
  { key: "waiting_team", label: "Team owes reply", hint: "Your team owes the next step" },
  { key: "needs_review", label: "Needs review", hint: "Unclear date, scope or identity" },
  { key: "closed", label: "Closed", hint: "Completed or declined" },
];

const TEMP: Record<string, { c: string; bg: string }> = {
  hot: { c: "#DC2626", bg: "#FEF2F2" },
  warm: { c: "#D97706", bg: "#FFFBEB" },
  cold: { c: "#0284C7", bg: "#F0F9FF" },
  unknown: { c: "#64748B", bg: "#F1F5F9" },
};

const ACTOR: Record<string, string> = { customer: "Customer", team: "Your team", third_party: "Third party", unclear: "Unclear" };

export function LeadsQueue() {
  const [filter, setFilter] = useState<LeadFilter>("active");
  const [page, setPage] = useState(1);
  const [temperature, setTemperature] = useState<string | null>(null);
  const q = useLeads(filter, page, temperature);
  const data = q.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 1200 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#0F172A" }}>Leads & follow-ups</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748B" }}>
          AI #2 reassesses every new business message. Customers are only emailed automatically where a
          teammate allowed it for that conversation.
        </p>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="tablist">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <button key={f.key} role="tab" aria-selected={active} title={f.hint}
              onClick={() => { setFilter(f.key); setPage(1); }}
              style={{
                padding: "6px 12px", borderRadius: 99, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                border: `1px solid ${active ? "#2563EB" : "#E2E8F0"}`, background: active ? "#EFF6FF" : "#FFFFFF",
                color: active ? "#1D4ED8" : "#475569", fontFamily: "inherit",
              }}>
              {f.label}
              <span style={{ marginLeft: 6, color: active ? "#1D4ED8" : "#94A3B8" }}>{data?.counts?.[f.key] ?? "·"}</span>
            </button>
          );
        })}
        <select value={temperature ?? ""} onChange={(e) => { setTemperature(e.target.value || null); setPage(1); }}
          aria-label="Temperature" style={{ marginLeft: "auto", border: "1px solid #E2E8F0", borderRadius: 8, padding: "5px 8px", fontSize: 12.5 }}>
          <option value="">Any temperature</option>
          <option value="hot">Hot</option>
          <option value="warm">Warm</option>
          <option value="cold">Cold</option>
          <option value="unknown">Unknown</option>
        </select>
      </div>

      <div style={{ border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden", background: "#FFFFFF" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F8FAFC", color: "#64748B", textAlign: "left" }}>
              <th style={th}>Conversation</th>
              <th style={th}>Temperature</th>
              <th style={th}>Next step</th>
              <th style={th}>Owner</th>
              <th style={th}>Due</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && (
              <tr><td colSpan={5} style={{ ...td, color: "#94A3B8" }}><IconLoader2 size={14} /> Loading…</td></tr>
            )}
            {q.isError && (
              <tr><td colSpan={5} style={{ ...td, color: "#B91C1C" }}>Could not load leads. <button onClick={() => q.refetch()}>Retry</button></td></tr>
            )}
            {data && data.items.length === 0 && (
              <tr><td colSpan={5} style={{ ...td, color: "#94A3B8" }}>Nothing here right now.</td></tr>
            )}
            {data?.items.map((it) => {
              const t = TEMP[it.temperature ?? "unknown"] ?? TEMP.unknown;
              return (
                <tr key={it.thread_id} style={{ borderTop: "1px solid #F1F5F9" }}>
                  <td style={td}>
                    <Link href={`/dashboard/inbox?conversation=${encodeURIComponent(it.thread_id)}`}
                      style={{ color: "#0F172A", fontWeight: 600, textDecoration: "none" }}>
                      {it.subject || "(no subject)"}
                    </Link>
                    <div style={{ color: "#64748B", fontSize: 12 }}>{it.sender_name || it.sender_email}</div>
                    {it.needs_review && (
                      <div style={{ color: "#B45309", fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}>
                        <IconAlertTriangle size={12} /> {it.review_reason?.replace(/_/g, " ") || "needs review"}
                      </div>
                    )}
                  </td>
                  <td style={td}>
                    <span style={{ color: t.c, background: t.bg, borderRadius: 99, padding: "2px 8px", fontWeight: 700, fontSize: 11.5 }}>
                      {(it.temperature ?? "unknown").replace(/^./, (c) => c.toUpperCase())}
                    </span>
                    {it.temperature_source && it.temperature_source !== "ai" && (
                      <span style={{ color: "#94A3B8", fontSize: 11 }}> · {it.temperature_source}</span>
                    )}
                    {it.stale && <div style={{ color: "#7C3AED", fontSize: 11 }}>re-assessing…</div>}
                  </td>
                  <td style={{ ...td, maxWidth: 360 }}>{it.next_action || "—"}</td>
                  <td style={td}>{it.next_actor ? ACTOR[it.next_actor] ?? it.next_actor : "—"}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{it.due_local || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data && data.total > data.page_size && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end", fontSize: 12.5, color: "#475569" }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} aria-label="Previous page"><IconChevronLeft size={14} /></button>
          Page {page} of {pages}
          <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} aria-label="Next page"><IconChevronRight size={14} /></button>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: "10px 14px", fontWeight: 600, fontSize: 12 };
const td: React.CSSProperties = { padding: "10px 14px", verticalAlign: "top", color: "#1E293B" };
