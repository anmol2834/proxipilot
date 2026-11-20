"use client";

/** Workspace follow-up defaults: timing only — never permission to email customers (that is granted
 *  per conversation and recipient by a member with send authority). Editing needs settings.update. */

import React, { useEffect, useState } from "react";
import { IconDeviceFloppy, IconLoader2 } from "@tabler/icons-react";
import { useFollowupPolicy, usePatchFollowupPolicy } from "@/hooks/useFollowups";
import { useTenant } from "@/hooks/use-tenant";
import { can } from "@/lib/permissions";
import type { UserRole } from "@/types/user.types";
import type { FollowupPolicy } from "@/types/followup.types";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function FollowupSettings() {
  const q = useFollowupPolicy();
  const save = usePatchFollowupPolicy();
  const { role } = useTenant();
  const canEdit = can({ role: (role ?? undefined) as UserRole | undefined }, "settings.manage");
  const [form, setForm] = useState<FollowupPolicy | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (q.data) setForm(q.data);
  }, [q.data]);

  if (q.isLoading || !form) {
    return <div style={card}><IconLoader2 size={14} /> Loading follow-up settings…</div>;
  }
  const set = <K extends keyof FollowupPolicy>(k: K, v: FollowupPolicy[K]) => setForm({ ...form, [k]: v });
  const num = (k: keyof FollowupPolicy, min: number, max: number) => (
    <input type="number" min={min} max={max} value={Number(form[k])} disabled={!canEdit}
      onChange={(e) => set(k, Math.max(min, Math.min(max, Number(e.target.value) || min)) as never)} style={inp} />
  );

  const submit = () => {
    setMsg(null);
    const { effective_timezone: _ignored, ...body } = form;  // eslint-disable-line @typescript-eslint/no-unused-vars
    save.mutate(body, {
      onSuccess: () => setMsg({ ok: true, text: "Saved." }),
      onError: (e: unknown) => {
        const err = e as { statusCode?: number; message?: string };
        setMsg({ ok: false, text: err.statusCode === 409 ? "Someone else changed these settings; reloaded." : err.message || "Could not save." });
        q.refetch();
      },
    });
  };

  return (
    <div style={card}>
      <div>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0F172A" }}>Follow-ups & reminders</h2>
        <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#64748B" }}>
          Defaults for timing and team reminders. Emailing a customer automatically is never enabled here —
          a teammate with send permission turns it on per conversation.
        </p>
      </div>

      <label style={row}><input type="checkbox" checked={form.assessment_enabled} disabled={!canEdit}
        onChange={(e) => set("assessment_enabled", e.target.checked)} /> Automatic lead assessment (AI #2 reads each new business message)</label>
      <label style={row}><input type="checkbox" checked={form.planning_enabled} disabled={!canEdit}
        onChange={(e) => set("planning_enabled", e.target.checked)} /> Automatic follow-up planning and team reminders</label>

      <div style={grid}>
        <span>Cadence when no date is given (business days)</span>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
          Hot {num("cadence_hot_days", 1, 60)} Warm {num("cadence_warm_days", 1, 60)} Cold {num("cadence_cold_days", 1, 90)}
        </span>
        <span>Working days</span>
        <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {DAYS.map((d, i) => (
            <label key={d} style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
              <input type="checkbox" disabled={!canEdit} checked={form.workdays.includes(i)}
                onChange={(e) => set("workdays", e.target.checked ? [...form.workdays, i].sort() : form.workdays.filter((x) => x !== i))} />
              {d}
            </label>
          ))}
        </span>
        <span>Reminder time for date-only follow-ups</span>
        <input type="time" value={form.default_local_time} disabled={!canEdit} onChange={(e) => set("default_local_time", e.target.value)} style={inp} />
        <span>Local send hours</span>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="time" value={form.send_window_start} disabled={!canEdit} onChange={(e) => set("send_window_start", e.target.value)} style={inp} />
          to
          <input type="time" value={form.send_window_end} disabled={!canEdit} onChange={(e) => set("send_window_end", e.target.value)} style={inp} />
        </span>
        <span>Team advance notice (business days before due)</span>
        {num("advance_notice_days", 0, 10)}
        <span>Maximum automatic follow-ups per sequence</span>
        {num("max_attempts", 1, 10)}
        <span>Minimum gap between customer emails (hours)</span>
        {num("min_spacing_hours", 1, 720)}
        <span>Time zone</span>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input value={form.timezone ?? ""} placeholder={form.effective_timezone} disabled={!canEdit}
            onChange={(e) => set("timezone", e.target.value || null)} style={{ ...inp, width: 200 }} />
          <span style={{ color: "#94A3B8", fontSize: 12 }}>in use: {form.effective_timezone}</span>
        </span>
      </div>

      {canEdit ? (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={submit} disabled={save.isPending} style={btn}>
            <IconDeviceFloppy size={14} /> {save.isPending ? "Saving…" : "Save follow-up settings"}
          </button>
          {msg && <span style={{ fontSize: 12.5, color: msg.ok ? "#047857" : "#B91C1C" }}>{msg.text}</span>}
        </div>
      ) : (
        <span style={{ fontSize: 12.5, color: "#94A3B8" }}>Only workspace owners and admins can change these settings.</span>
      )}
    </div>
  );
}

const card: React.CSSProperties = {
  border: "1px solid #E2E8F0", borderRadius: 12, background: "#FFFFFF", padding: "18px 20px",
  display: "flex", flexDirection: "column", gap: 14, maxWidth: 860, fontSize: 13, color: "#334155",
};
const row: React.CSSProperties = { display: "flex", gap: 8, alignItems: "center", fontSize: 13 };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "300px 1fr", gap: "10px 16px", alignItems: "center" };
const inp: React.CSSProperties = { border: "1px solid #E2E8F0", borderRadius: 7, padding: "4px 8px", fontSize: 12.5, width: 70, fontFamily: "inherit" };
const btn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1px solid #2563EB",
  background: "#2563EB", color: "#FFFFFF", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
};
