"use client";

/**
 * Follow-up panel (conversation pane).
 *
 * Answers: how interested is the customer now, why, what changed, who owes the next step and when,
 * and what ProxiPilot will actually do (team reminder vs. customer email). All controls are server
 * authorised; the UI only hides what the caller cannot do.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  IconAlertTriangle,
  IconBell,
  IconCalendarEvent,
  IconChevronDown,
  IconChevronUp,
  IconClockPause,
  IconHandStop,
  IconHistory,
  IconLoader2,
  IconMail,
  IconMailOff,
  IconRefresh,
  IconTargetArrow,
} from "@tabler/icons-react";
import {
  useClearFollowupSchedule,
  useLiftSuppression,
  usePatchFollowupControls,
  useScheduleFollowup,
  useThreadFollowup,
} from "@/hooks/useFollowups";
import type { FollowupControlsPatch, ThreadFollowup } from "@/types/followup.types";

const STATUS_LABEL: Record<string, { text: string; color: string; bg: string }> = {
  none: { text: "No follow-up", color: "#64748B", bg: "#F1F5F9" },
  open: { text: "Open · purchase unconfirmed", color: "#0369A1", bg: "#E0F2FE" },
  scheduled: { text: "Follow-up scheduled", color: "#1D4ED8", bg: "#DBEAFE" },
  deferred: { text: "Deferred", color: "#7C3AED", bg: "#EDE9FE" },
  waiting_team: { text: "Team owes next step", color: "#B45309", bg: "#FEF3C7" },
  needs_review: { text: "Needs review", color: "#B91C1C", bg: "#FEE2E2" },
  closed: { text: "Closed", color: "#047857", bg: "#D1FAE5" },
  suppressed: { text: "Do not contact", color: "#991B1B", bg: "#FEE2E2" },
  stopped: { text: "Planning paused", color: "#475569", bg: "#E2E8F0" },
};

const TEMP_STYLE: Record<string, { color: string; bg: string }> = {
  hot: { color: "#DC2626", bg: "#FEF2F2" },
  warm: { color: "#D97706", bg: "#FFFBEB" },
  cold: { color: "#0284C7", bg: "#F0F9FF" },
  unknown: { color: "#64748B", bg: "#F8FAFC" },
};

const SOURCE_LABEL: Record<string, string> = {
  customer_date: "customer's date",
  ai: "AI-suggested window",
  cadence: "workspace cadence",
  user: "scheduled by a teammate",
};

const ACTOR_LABEL: Record<string, string> = {
  customer: "Customer",
  team: "Your team",
  third_party: "Third party",
  unclear: "Unclear",
};

const CUSTOMER_STATUS: Record<string, string> = {
  not_applicable: "Not emailed — reminder only",
  pending: "Will email after final checks",
  sending: "Sending…",
  sent: "Customer emailed",
  held: "Held",
  failed: "Not delivered",
  unknown: "Delivery being verified",
};

function cap(s: string | null | undefined): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

function errText(e: unknown): string {
  const err = e as { statusCode?: number; message?: string } | null;
  if (err?.statusCode === 409) return err.message || "Changed elsewhere — refreshed. Try again.";
  return err?.message || "Something went wrong.";
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.55 }}>
      <span style={{ color: "#94A3B8", marginTop: 2, flexShrink: 0 }}>{icon}</span>
      <span style={{ width: 92, flexShrink: 0, color: "#64748B", fontWeight: 600 }}>{label}</span>
      <span style={{ color: "#1E293B", minWidth: 0, flex: 1 }}>{children}</span>
    </div>
  );
}

function Btn({
  onClick,
  children,
  disabled,
  tone = "default",
  title,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  tone?: "default" | "primary" | "danger";
  title?: string;
}) {
  const palette = {
    default: { b: "#E2E8F0", bg: "#FFFFFF", c: "#334155" },
    primary: { b: "#2563EB", bg: "#2563EB", c: "#FFFFFF" },
    danger: { b: "#FCA5A5", bg: "#FFFFFF", c: "#B91C1C" },
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "5px 10px",
        borderRadius: 7,
        border: `1px solid ${palette.b}`,
        background: palette.bg,
        color: palette.c,
        fontSize: 12,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

function todayPlus(days: number): string {
  const d = new Date(Date.now() + days * 86400000);
  return d.toISOString().slice(0, 10);
}

export function FollowUpPanel({ threadId }: { threadId: string }) {
  const q = useThreadFollowup(threadId);
  const patch = usePatchFollowupControls(threadId);
  const schedule = useScheduleFollowup(threadId);
  const clear = useClearFollowupSchedule(threadId);
  const lift = useLiftSuppression(threadId);
  const [open, setOpen] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [date, setDate] = useState(todayPlus(1));
  const [time, setTime] = useState("10:00");
  const [recipient, setRecipient] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const f: ThreadFollowup | undefined = q.data;
  useEffect(() => {
    setError(null);
    setShowScheduler(false);
    setShowHistory(false);
  }, [threadId]);
  useEffect(() => {
    if (f) setRecipient(f.controls.customer_recipient_email || f.participants[0] || "");
  }, [f?.thread_id, f?.controls.customer_recipient_email, f?.participants]); // eslint-disable-line react-hooks/exhaustive-deps

  const busy = patch.isPending || schedule.isPending || clear.isPending || lift.isPending;
  const run = (p: Omit<FollowupControlsPatch, "version">) => {
    if (!f) return;
    setError(null);
    patch.mutate({ version: f.version, ...p }, { onError: (e) => { setError(errText(e)); q.refetch(); } });
  };
  const current = useMemo(() => f?.occurrences.find((o) => o.status === "scheduled") ?? f?.occurrences[0], [f]);

  if (q.isLoading) {
    return (
      <div style={cardStyle}>
        <span style={{ fontSize: 12.5, color: "#94A3B8", display: "inline-flex", gap: 6, alignItems: "center" }}>
          <IconLoader2 size={14} className="spin" /> Loading follow-up…
        </span>
      </div>
    );
  }
  if (q.isError || !f) {
    return (
      <div style={cardStyle}>
        <span style={{ fontSize: 12.5, color: "#94A3B8" }}>Follow-up details are unavailable right now.</span>{" "}
        <Btn onClick={() => q.refetch()}>Retry</Btn>
      </div>
    );
  }

  const st = STATUS_LABEL[f.status] ?? STATUS_LABEL.none;
  const temp = f.temperature.effective || "unknown";
  const ts = TEMP_STYLE[temp] ?? TEMP_STYLE.unknown;
  const manual = f.temperature.source === "manual" || f.temperature.source === "legacy";
  const canEdit = f.capabilities.can_edit;
  const canSend = f.capabilities.can_send && f.capabilities.customer_email_supported;
  const suppressed = f.suppressions.length > 0;
  const emailBlocked = f.suppressions.some((s) => s.scope === "all" || s.scope === "email" || s.scope === "until");

  return (
    <div style={cardStyle} data-testid="followup-panel">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <IconTargetArrow size={16} color="#2563EB" />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>Follow-up</span>
          <span style={{ ...chip, color: st.color, background: st.bg }}>{st.text}</span>
          <span style={{ ...chip, color: ts.color, background: ts.bg }} title={f.temperature.reason ?? undefined}>
            {cap(temp)} · {f.temperature.source === "ai" ? "AI" : f.temperature.source === "legacy" ? "earlier label" : f.temperature.source === "manual" ? "manual" : "not assessed"}
          </span>
          {f.stale && (
            <span style={{ ...chip, color: "#7C3AED", background: "#F5F3FF" }} title={f.stale_reason ?? undefined}>
              <IconLoader2 size={11} /> Re-assessing latest message
            </span>
          )}
        </div>
        <button onClick={() => setOpen((v) => !v)} style={iconBtn} aria-label={open ? "Collapse" : "Expand"}>
          {open ? <IconChevronUp size={15} /> : <IconChevronDown size={15} />}
        </button>
      </div>

      {open && (
        <>
          {suppressed && (
            <div style={{ ...banner, background: "#FEF2F2", borderColor: "#FECACA", color: "#991B1B" }}>
              <IconHandStop size={15} />
              <div style={{ flex: 1 }}>
                {f.suppressions.map((s) => (
                  <div key={s.id}>
                    {s.scope === "all" ? "Asked not to be contacted" : s.scope === "email" ? "Asked not to be emailed (other channels OK)" : `Not before ${s.until_at ? new Date(s.until_at).toLocaleDateString() : "a date to confirm"}`}
                    {s.quote ? <> — “{s.quote}”</> : null} <span style={{ color: "#B91C1C" }}>({s.recipient_email})</span>
                    {f.capabilities.can_manage_settings && (
                      <span style={{ marginLeft: 6 }}>
                        <Btn onClick={() => lift.mutate(s.id, { onError: (e) => setError(errText(e)) })} disabled={busy}
                          title="Lift only if the customer has clearly asked to be contacted again">Lift</Btn>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {f.needs_review && f.review_reason && !suppressed && (
            <div style={{ ...banner, background: "#FFFBEB", borderColor: "#FDE68A", color: "#92400E" }}>
              <IconAlertTriangle size={15} /> <span>Needs review: {f.review_reason.replace(/_/g, " ")}</span>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <Row icon={<IconTargetArrow size={14} />} label="Why">
              {f.temperature.reason || "Not assessed yet — ProxiPilot assesses each new business message."}
              {manual && f.temperature.suggested && f.temperature.suggested !== temp && (
                <span style={{ color: "#64748B" }}> · AI now suggests <b>{cap(f.temperature.suggested)}</b></span>
              )}
            </Row>
            <Row icon={<IconBell size={14} />} label="Next step">
              {f.status === "suppressed" ? (
                "No sales follow-up — the customer asked not to be contacted"
              ) : (
                <>
                  {f.next_action || "—"}
                  {f.next_actor && <span style={{ color: "#64748B" }}> · owner: {ACTOR_LABEL[f.next_actor] ?? f.next_actor}</span>}
                </>
              )}
            </Row>
            <Row icon={<IconCalendarEvent size={14} />} label="Due">
              {f.due.local ? (
                <>
                  {f.due.local}
                  {f.due.source && <span style={{ color: "#64748B" }}> · {SOURCE_LABEL[f.due.source] ?? f.due.source}</span>}
                  {f.due.phrase && <span style={{ color: "#94A3B8" }}> · “{f.due.phrase}”</span>}
                </>
              ) : f.due.phrase ? (
                <span>Unclear date: “{f.due.phrase}”</span>
              ) : (
                "Nothing scheduled"
              )}
            </Row>
            <Row icon={<IconBell size={14} />} label="Team notice">
              {f.notice.local ?? (f.due.local ? "With the due reminder" : "—")}
              {!f.capabilities.reminders_enabled && <span style={{ color: "#B45309" }}> · reminders are paused on this server</span>}
            </Row>
            <Row icon={f.controls.customer_email_enabled ? <IconMail size={14} /> : <IconMailOff size={14} />} label="Customer">
              {f.controls.customer_email_enabled
                ? <>Automatic email ON for <b>{f.controls.customer_recipient_email}</b></>
                : "Automatic email OFF — the team is reminded; nobody emails the customer automatically"}
              {current && (
                <span style={{ color: "#64748B" }}>
                  {" "}· {CUSTOMER_STATUS[current.customer_status] ?? current.customer_status}
                  {current.hold_reason && current.customer_status === "held" ? ` (${current.hold_reason.replace(/_/g, " ")})` : ""}
                </span>
              )}
              {f.controls.customer_email_enabled && !f.capabilities.customer_send_globally_enabled && (
                <div style={{ color: "#B45309" }}>Customer sending is switched off on this server; only reminders go out.</div>
              )}
            </Row>
            {f.opportunities.length > 1 && (
              <Row icon={<IconTargetArrow size={14} />} label="Opportunities">
                {f.opportunities.map((o) => `${o.subject || o.key}: ${o.status}`).join(" · ")}
              </Row>
            )}
          </div>

          {canEdit && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 4 }}>
              {manual && (
                <Btn onClick={() => run({ manual_temperature: null })} disabled={busy} title="Let AI #2 set the temperature again">
                  <IconRefresh size={13} /> Use automatic classification
                </Btn>
              )}
              <Btn onClick={() => setShowScheduler((v) => !v)} disabled={busy}>
                <IconCalendarEvent size={13} /> {f.controls.manual_due_at ? "Reschedule" : "Schedule"}
              </Btn>
              {f.controls.manual_due_at && (
                <Btn onClick={() => clear.mutate(f.version, { onError: (e) => setError(errText(e)) })} disabled={busy}>
                  Clear my schedule
                </Btn>
              )}
              <Btn onClick={() => run({ snoozed_until: new Date(Date.now() + 7 * 86400000).toISOString() })} disabled={busy}>
                <IconClockPause size={13} /> Snooze 1 week
              </Btn>
              {f.controls.completed ? (
                <Btn onClick={() => run({ completed: false })} disabled={busy}>Reopen</Btn>
              ) : (
                <Btn onClick={() => run({ completed: true })} disabled={busy}>Mark completed</Btn>
              )}
              <Btn onClick={() => run({ planning_enabled: !f.controls.planning_enabled })} disabled={busy}>
                {f.controls.planning_enabled ? "Pause follow-up planning" : "Resume follow-up planning"}
              </Btn>
              <Btn onClick={() => run({ assessment_enabled: !f.controls.assessment_enabled })} disabled={busy}
                title={f.controls.assessment_enabled ? "Freeze the label; new messages still hold customer email for review" : "Assess new messages again"}>
                {f.controls.assessment_enabled ? "Freeze AI assessment" : "Resume AI assessment"}
              </Btn>
            </div>
          )}

          {canEdit && showScheduler && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 12.5 }}>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={input} aria-label="Follow-up date" />
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={input} aria-label="Follow-up time" />
              <span style={{ color: "#64748B" }}>{f.capabilities.workspace_timezone}</span>
              <Btn tone="primary" disabled={busy || !date || !time}
                onClick={() => schedule.mutate({ version: f.version, local_date: date, local_time: time },
                  { onSuccess: () => setShowScheduler(false), onError: (e) => { setError(errText(e)); q.refetch(); } })}>
                Save
              </Btn>
            </div>
          )}

          {canEdit && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12.5, color: "#475569" }}>
              {canSend ? (
                f.controls.customer_email_enabled ? (
                  <Btn tone="danger" onClick={() => run({ customer_email_enabled: false })} disabled={busy}>
                    <IconMailOff size={13} /> Stop emailing this customer automatically
                  </Btn>
                ) : (
                  <>
                    <span>Email customer automatically:</span>
                    <select value={recipient} onChange={(e) => setRecipient(e.target.value)} style={input}
                      aria-label="Customer participant" disabled={busy || f.participants.length === 0 || emailBlocked}>
                      {f.participants.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <Btn onClick={() => run({ customer_email_enabled: true, customer_recipient_email: recipient })}
                      disabled={busy || !recipient || emailBlocked}
                      title={emailBlocked ? "This customer asked not to be emailed" : "Only follow-ups that pass every safety check are sent"}>
                      <IconMail size={13} /> Enable for this conversation
                    </Btn>
                  </>
                )
              ) : (
                <span style={{ color: "#94A3B8" }}>
                  {f.capabilities.customer_email_supported ? "Only members with send permission can allow customer email." : "Automatic customer email needs a Gmail mailbox."}
                </span>
              )}
            </div>
          )}

          {error && <div style={{ fontSize: 12, color: "#B91C1C" }} role="alert">{error}</div>}

          {f.history.length > 0 && (
            <div>
              <button onClick={() => setShowHistory((v) => !v)} style={{ ...iconBtn, width: "auto", gap: 5, fontSize: 12, color: "#475569", padding: "2px 4px" }}>
                <IconHistory size={13} /> {showHistory ? "Hide" : "Show"} assessment history ({f.history.length})
              </button>
              {showHistory && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                  {f.history.map((h) => (
                    <div key={h.id} style={{ fontSize: 12, color: "#475569", borderLeft: "2px solid #E2E8F0", paddingLeft: 8 }}>
                      <b>{h.created_at ? new Date(h.created_at).toLocaleString() : ""}</b> · {cap(h.temperature) || "—"} · {h.decision?.replace(/_/g, " ") || h.status}
                      {!h.applied && h.not_applied_reason && <span style={{ color: "#94A3B8" }}> · not applied ({h.not_applied_reason.replace(/_/g, " ")})</span>}
                      {h.explanation && <div style={{ color: "#64748B" }}>{h.explanation}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  background: "#FFFFFF",
  border: "1px solid #E2E8F0",
  padding: "14px 18px",
  display: "flex",
  flexDirection: "column",
  gap: 10,
};
const chip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 11,
  fontWeight: 700,
  borderRadius: 99,
  padding: "2px 8px",
};
const banner: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "flex-start",
  fontSize: 12.5,
  border: "1px solid",
  borderRadius: 8,
  padding: "8px 10px",
};
const iconBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 26,
  height: 26,
  border: "none",
  background: "none",
  cursor: "pointer",
  color: "#64748B",
  borderRadius: 6,
  fontFamily: "inherit",
};
const input: React.CSSProperties = {
  border: "1px solid #E2E8F0",
  borderRadius: 7,
  padding: "4px 8px",
  fontSize: 12.5,
  fontFamily: "inherit",
  color: "#0F172A",
  background: "#FFFFFF",
};
