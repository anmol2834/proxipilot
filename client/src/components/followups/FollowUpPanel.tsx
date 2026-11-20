"use client";

/**
 * Follow-up panel — answers, for one conversation: how interested is the customer now and why, who owes
 * the next step and when, and what ProxiPilot will actually do (team reminder vs. customer email).
 * Every control is authorised on the server; the UI only hides or explains what the user cannot do.
 */

import React, { useMemo, useState } from "react";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Skeleton from "@mui/material/Skeleton";
import Switch from "@mui/material/Switch";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import {
  IconAlertTriangle, IconBell, IconBrain, IconCalendarEvent, IconCheck, IconChevronDown, IconChevronUp,
  IconClockPause, IconDots, IconEye, IconHandStop, IconHistory, IconMail, IconPlayerPause, IconPlayerPlay,
  IconSparkles, IconTargetArrow, IconUser, IconX,
} from "@tabler/icons-react";
import { ConfirmDialog } from "@/components/ui/feedback/ConfirmDialog";
import { toast } from "@/stores/notification.store";
import {
  followupError, useApplySuggestion, useClearFollowupSchedule, useFollowupPolicy, useLiftSuppression,
  usePatchFollowupControls, useScheduleFollowup, useThreadFollowup,
} from "@/hooks/useFollowups";
import type { FollowupControlsPatch, ThreadFollowup } from "@/types/followup.types";
import { CustomerEmailDialog } from "./CustomerEmailDialog";
import { ScheduleDialog } from "./ScheduleDialog";
import {
  ACTOR, CUSTOMER_STATUS, DECISION, DUE_SOURCE, FU, SOURCE, STATUS, TEMPERATURE, cap, humanize, inZone, relative,
} from "./meta";

type Confirm = null | "complete" | "stop_email" | { lift: string };

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "20px 104px 1fr", gap: 1, alignItems: "start", py: 0.75 }}>
      <Box sx={{ color: FU.faint, pt: "2px" }}>{icon}</Box>
      <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: FU.muted }}>{label}</Typography>
      <Box sx={{ fontSize: 13, color: FU.text, minWidth: 0, lineHeight: 1.55 }}>{children}</Box>
    </Box>
  );
}

function Pill({ label, fg, bg, tooltip, icon }: { label: string; fg: string; bg: string; tooltip?: string; icon?: React.ReactElement }) {
  const chip = (
    <Chip size="small" label={label} icon={icon}
          sx={{ height: 22, fontSize: 11.5, fontWeight: 700, color: fg, backgroundColor: bg, borderRadius: "6px",
                "& .MuiChip-icon": { color: fg, ml: "6px" } }} />
  );
  return tooltip ? <Tooltip title={tooltip} arrow>{chip}</Tooltip> : chip;
}

export function FollowUpPanel({ threadId, defaultOpen = true }: { threadId: string; defaultOpen?: boolean }) {
  const q = useThreadFollowup(threadId);
  const policyQ = useFollowupPolicy();
  const patch = usePatchFollowupControls(threadId);
  const schedule = useScheduleFollowup(threadId);
  const clear = useClearFollowupSchedule(threadId);
  const applySuggestion = useApplySuggestion(threadId);
  const lift = useLiftSuppression(threadId);

  const [open, setOpen] = useState(defaultOpen);
  const [showActivity, setShowActivity] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [menuEl, setMenuEl] = useState<HTMLElement | null>(null);
  const [snoozeEl, setSnoozeEl] = useState<HTMLElement | null>(null);

  const f: ThreadFollowup | undefined = q.data;
  const busy = patch.isPending || schedule.isPending || clear.isPending || applySuggestion.isPending || lift.isPending;
  const tz = f?.capabilities.workspace_timezone || "UTC";
  const current = useMemo(() => f?.occurrences.find((o) => o.status === "scheduled") ?? f?.occurrences[0], [f]);

  const activity = useMemo(() => {
    if (!f) return [];
    const items: { at: string; title: string; detail?: string | null; tone?: string }[] = [];
    for (const h of f.history) {
      items.push({
        at: h.created_at ?? "", tone: h.applied ? "ok" : "muted",
        title: `AI assessment · ${cap(h.temperature) || "—"} · ${DECISION[h.decision ?? ""] ?? humanize(h.decision ?? h.status)}`,
        detail: [h.explanation, !h.applied && h.not_applied_reason ? `Not applied: ${humanize(h.not_applied_reason)}` : null]
          .filter(Boolean).join(" — "),
      });
    }
    for (const o of f.occurrences) {
      const notices = Object.entries(o.notices || {}).map(([k, v]) =>
        `${k} notice: ${Object.entries(v).map(([s, n]) => `${n} ${s}`).join(", ")}`).join(" · ");
      items.push({
        at: o.due_at ?? "", tone: o.status === "scheduled" ? "info" : "muted",
        title: `Follow-up ${o.status} · due ${inZone(o.due_at, tz)}`,
        detail: [DUE_SOURCE[o.origin] ?? o.origin, CUSTOMER_STATUS[o.customer_status]?.label, notices || null,
                 o.hold_reason ? `Held: ${humanize(o.hold_reason)}` : null].filter(Boolean).join(" · "),
      });
    }
    return items.sort((a, b) => (b.at || "").localeCompare(a.at || "")).slice(0, 14);
  }, [f, tz]);

  if (q.isLoading) {
    return (
      <Box sx={card}>
        <Skeleton variant="text" width={180} height={26} />
        <Skeleton variant="rounded" height={86} sx={{ borderRadius: "10px" }} />
      </Box>
    );
  }
  if (q.isError || !f) {
    return (
      <Box sx={card}>
        <Typography sx={{ fontSize: 13, color: FU.muted }}>Follow-up details are unavailable right now.</Typography>
        <Button size="small" onClick={() => q.refetch()} sx={{ textTransform: "none", alignSelf: "flex-start" }}>Try again</Button>
      </Box>
    );
  }

  const run = (p: Omit<FollowupControlsPatch, "version">, success: string) => {
    patch.mutate({ version: f.version, ...p }, {
      onSuccess: () => toast.success(success),
      onError: (e) => toast.error(followupError(e)),
    });
  };

  const st = STATUS[f.status] ?? STATUS.none;
  const temp = (f.temperature.effective || "unknown") as string;
  const tm = TEMPERATURE[temp] ?? TEMPERATURE.unknown;
  const manual = f.temperature.source === "manual" || f.temperature.source === "legacy";
  const canEdit = f.capabilities.can_edit;
  const observe = f.workspace.mode === "shadow";
  const sugg = f.latest_suggestion;
  const emailBlocked = f.suppressions.length > 0;
  const due = relative(f.due.at);
  const snoozed = f.controls.snoozed_until && new Date(f.controls.snoozed_until).getTime() > Date.now();
  const policy = policyQ.data;

  let emailDisabledReason: string | null = null;
  if (!f.capabilities.customer_email_supported) emailDisabledReason = "Automatic customer email needs a connected Gmail mailbox.";
  else if (!f.workspace.customer_email_allowed) emailDisabledReason = "Not allowed in this workspace — an admin can allow it in Settings → Follow-ups.";
  else if (!f.capabilities.can_send) emailDisabledReason = "Only members with send permission can allow customer email.";
  else if (emailBlocked) emailDisabledReason = "This customer asked not to be contacted by email.";
  else if (f.participants.length === 0) emailDisabledReason = "Nobody has written in this conversation yet.";

  return (
    <Box sx={card} data-testid="followup-panel">
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", minWidth: 0 }}>
          <IconTargetArrow size={17} color={FU.primary} />
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: FU.text }}>Follow-up</Typography>
          <Pill label={st.label} fg={st.fg} bg={st.bg} tooltip={st.hint} />
          <Pill label={`${tm.label} · ${SOURCE[f.temperature.source ?? ""] ?? "Not assessed"}`} fg={tm.fg} bg={tm.bg}
                tooltip={f.temperature.reason ?? undefined} />
          {observe && <Pill label="Observe-only" fg="#6D28D9" bg="#F5F3FF" icon={<IconEye size={12} />}
                            tooltip="ProxiPilot records AI assessments but does not schedule or remind in this workspace." />}
          {f.stale && <Pill label="Reading latest message…" fg="#6D28D9" bg="#F5F3FF" tooltip="AI #2 is assessing the newest message." />}
          {snoozed && <Pill label={`Snoozed until ${inZone(f.controls.snoozed_until, tz)}`} fg={FU.muted} bg="#F1F5F9" />}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          {canEdit && (
            <Tooltip title="More actions">
              <IconButton size="small" onClick={(e) => setMenuEl(e.currentTarget)} aria-label="More follow-up actions">
                <IconDots size={17} />
              </IconButton>
            </Tooltip>
          )}
          <IconButton size="small" onClick={() => setOpen((v) => !v)} aria-label={open ? "Collapse follow-up" : "Expand follow-up"}>
            {open ? <IconChevronUp size={17} /> : <IconChevronDown size={17} />}
          </IconButton>
        </Box>
      </Box>

      <Collapse in={open} unmountOnExit>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, mt: 1.25 }}>
          {/* Banners */}
          {observe && sugg && (
            <Alert severity="info" icon={<IconBrain size={18} />} sx={banner}>
              <b>AI suggests:</b> {cap(sugg.temperature)} · {DECISION[sugg.decision ?? ""] ?? humanize(sugg.decision)}
              {sugg.next_action ? ` — ${sugg.next_action}` : ""}
              {sugg.timing_phrase ? ` (“${sugg.timing_phrase}”)` : ""}
              <Box component="span" sx={{ display: "block", color: FU.muted, mt: 0.25 }}>
                Observe-only mode: nothing is scheduled or sent.{" "}
                {f.capabilities.can_manage_settings
                  ? <Link href="/dashboard/settings" style={{ color: FU.primary, fontWeight: 600 }}>Activate follow-ups in Settings</Link>
                  : "A workspace admin can activate follow-ups in Settings."}
              </Box>
            </Alert>
          )}
          {!observe && sugg && !sugg.applied && sugg.is_latest_message && canEdit && (
            <Alert severity="info" icon={<IconSparkles size={18} />} sx={banner}
                   action={<Button size="small" disabled={busy} onClick={() => applySuggestion.mutate(f.version, {
                     onSuccess: () => toast.success("AI suggestion applied"), onError: (e) => toast.error(followupError(e)) })}
                     sx={{ textTransform: "none", fontWeight: 700 }}>Apply</Button>}>
              Recorded while observing: {cap(sugg.temperature)} · {DECISION[sugg.decision ?? ""] ?? humanize(sugg.decision)}
              {sugg.next_action ? ` — ${sugg.next_action}` : ""}
            </Alert>
          )}
          {f.suppressions.map((s) => (
            <Alert key={s.id} severity="error" icon={<IconHandStop size={18} />} sx={banner}
                   action={f.capabilities.can_manage_settings ? (
                     <Button size="small" color="inherit" disabled={busy} onClick={() => setConfirm({ lift: s.id })}
                             sx={{ textTransform: "none", fontWeight: 700 }}>Lift</Button>) : undefined}>
              {s.scope === "all" ? "Asked not to be contacted" : s.scope === "email" ? "Asked not to be emailed (other channels are fine)"
                : `Asked not to be contacted before ${s.until_at ? new Date(s.until_at).toLocaleDateString() : "a date to confirm"}`}
              {s.quote ? <> — “{s.quote}”</> : null}
              <Box component="span" sx={{ color: "#B91C1C" }}> · {s.recipient_email}</Box>
            </Alert>
          ))}
          {f.needs_review && f.review_reason && f.status !== "suppressed" && (
            <Alert severity="warning" icon={<IconAlertTriangle size={18} />} sx={banner}>
              Needs review: {humanize(f.review_reason)}
            </Alert>
          )}

          {/* Temperature */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
            <ToggleButtonGroup size="small" exclusive value={manual ? temp : null} disabled={!canEdit || busy}
                               onChange={(_, v) => v && v !== temp && run({ manual_temperature: v }, `Marked ${cap(v)}`)}
                               aria-label="Lead temperature">
              {(["hot", "warm", "cold"] as const).map((t) => (
                <ToggleButton key={t} value={t}
                              sx={{ textTransform: "none", fontWeight: 600, fontSize: 12.5, px: 1.5, py: 0.35,
                                    "&.Mui-selected": { color: TEMPERATURE[t].fg, backgroundColor: TEMPERATURE[t].bg } }}>
                  {TEMPERATURE[t].label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            {manual ? (
              <Button size="small" disabled={!canEdit || busy} onClick={() => run({ manual_temperature: null }, "Using AI classification")}
                      sx={{ textTransform: "none", fontWeight: 600 }}>
                Use AI classification{f.temperature.suggested ? ` (${cap(f.temperature.suggested)})` : ""}
              </Button>
            ) : (
              <Typography sx={{ fontSize: 12, color: FU.muted }}>Set by AI · pick one to override</Typography>
            )}
          </Box>

          <Box>
            <Row icon={<IconSparkles size={15} />} label="Why">
              {f.temperature.reason || (observe ? "See the AI suggestion above." : "Assessed automatically when the next business message arrives.")}
              {f.temperature.buying_interest !== null && f.temperature.buying_interest !== undefined && (
                <Typography component="span" sx={{ fontSize: 12, color: FU.muted }}> · buying interest {Math.round(f.temperature.buying_interest * 100)}%</Typography>
              )}
            </Row>
            <Row icon={<IconUser size={15} />} label="Next step">
              {f.status === "suppressed" ? "No sales follow-up — the customer asked not to be contacted." : (f.next_action || "—")}
              {f.next_actor && f.status !== "suppressed" && (
                <Chip size="small" label={ACTOR[f.next_actor] ?? f.next_actor}
                      sx={{ ml: 0.75, height: 20, fontSize: 11, fontWeight: 600, borderRadius: "5px" }} />
              )}
            </Row>
            <Row icon={<IconCalendarEvent size={15} />} label="Due">
              {f.due.at ? (
                <>
                  <b>{inZone(f.due.at, f.due.timezone || tz, true)}</b>
                  <Typography component="span" sx={{ fontSize: 12, color: FU.muted }}> {f.due.timezone || tz}</Typography>
                  {due && <Chip size="small" label={due.text}
                                sx={{ ml: 0.75, height: 20, fontSize: 11, fontWeight: 700, borderRadius: "5px",
                                      color: due.overdue ? "#B91C1C" : "#1D4ED8", backgroundColor: due.overdue ? "#FEE2E2" : "#DBEAFE" }} />}
                  <Box sx={{ fontSize: 12, color: FU.muted }}>
                    {DUE_SOURCE[f.due.source ?? ""] ?? ""}{f.due.phrase ? ` · “${f.due.phrase}”` : ""}
                  </Box>
                </>
              ) : f.due.phrase ? <>Unclear date: “{f.due.phrase}”</> : <Box component="span" sx={{ color: FU.muted }}>Nothing scheduled</Box>}
            </Row>
            <Row icon={<IconBell size={15} />} label="Team reminder">
              {f.notice.at ? inZone(f.notice.at, tz, true) : f.due.at ? "With the due reminder" : "—"}
              {!f.capabilities.reminders_enabled && <Box sx={{ fontSize: 12, color: FU.warn }}>Reminders are paused platform-wide.</Box>}
            </Row>
            <Row icon={<IconMail size={15} />} label="Customer email">
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                <Tooltip title={emailDisabledReason && !f.controls.customer_email_enabled ? emailDisabledReason : ""}>
                  <span>
                    <Switch size="small" checked={f.controls.customer_email_enabled}
                            disabled={!canEdit || busy || (!f.controls.customer_email_enabled && Boolean(emailDisabledReason))}
                            onChange={(e) => {
                              if (e.target.checked) { setEmailError(null); setEmailOpen(true); } else setConfirm("stop_email");
                            }}
                            slotProps={{ input: { "aria-label": "Email this customer automatically" } }} />
                  </span>
                </Tooltip>
                <Typography sx={{ fontSize: 13 }}>
                  {f.controls.customer_email_enabled
                    ? <>Automatic for <b>{f.controls.customer_recipient_email}</b></>
                    : "Off — your team is reminded; nobody emails the customer automatically"}
                </Typography>
              </Box>
              {current && current.customer_status !== "not_applicable" && (
                <Typography sx={{ fontSize: 12, color: FU.muted }}>
                  {CUSTOMER_STATUS[current.customer_status]?.label ?? current.customer_status}
                  {current.hold_reason && current.customer_status === "held" ? ` — ${humanize(current.hold_reason)}` : ""}
                </Typography>
              )}
              {f.controls.customer_email_enabled && !f.capabilities.customer_send_globally_enabled && (
                <Typography sx={{ fontSize: 12, color: FU.warn }}>Customer sending is switched off platform-wide; only reminders go out.</Typography>
              )}
            </Row>
            {f.opportunities.length > 1 && (
              <Row icon={<IconTargetArrow size={15} />} label="Opportunities">
                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                  {f.opportunities.map((o) => (
                    <Chip key={o.key} size="small" label={`${o.subject || o.key} · ${humanize(o.status)}`}
                          sx={{ height: 22, fontSize: 11.5, borderRadius: "6px",
                                backgroundColor: o.status === "completed" ? "#D1FAE5" : o.status === "declined" ? "#FEE2E2" : "#F1F5F9" }} />
                  ))}
                </Box>
              </Row>
            )}
          </Box>

          {canEdit && (
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Button size="small" variant="contained" disableElevation startIcon={<IconCalendarEvent size={15} />} disabled={busy}
                      onClick={() => { setScheduleError(null); setScheduleOpen(true); }} sx={actionBtn}>
                {f.controls.manual_due_at ? "Reschedule" : "Schedule follow-up"}
              </Button>
              <Button size="small" variant="outlined" startIcon={<IconClockPause size={15} />} disabled={busy}
                      onClick={(e) => setSnoozeEl(e.currentTarget)} sx={actionBtn}>
                Snooze
              </Button>
              {f.controls.completed ? (
                <Button size="small" variant="outlined" disabled={busy} onClick={() => run({ completed: false }, "Reopened")} sx={actionBtn}>
                  Reopen
                </Button>
              ) : (
                <Button size="small" variant="outlined" color="success" startIcon={<IconCheck size={15} />} disabled={busy}
                        onClick={() => setConfirm("complete")} sx={actionBtn}>
                  Mark completed
                </Button>
              )}
            </Box>
          )}

          {activity.length > 0 && (
            <Box>
              <Divider sx={{ mb: 1, borderColor: "#F1F5F9" }} />
              <Button size="small" startIcon={<IconHistory size={15} />} onClick={() => setShowActivity((v) => !v)}
                      sx={{ textTransform: "none", fontWeight: 600, color: FU.muted }}>
                {showActivity ? "Hide activity" : `Activity (${activity.length})`}
              </Button>
              <Collapse in={showActivity} unmountOnExit>
                <Box sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 1, pl: 1, borderLeft: `2px solid ${FU.border}` }}>
                  {activity.map((a, i) => (
                    <Box key={i}>
                      <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: a.tone === "ok" ? FU.ok : FU.body }}>{a.title}</Typography>
                      <Typography sx={{ fontSize: 11.5, color: FU.faint }}>{a.at ? inZone(a.at, tz, true) : ""}</Typography>
                      {a.detail && <Typography sx={{ fontSize: 12, color: FU.muted }}>{a.detail}</Typography>}
                    </Box>
                  ))}
                </Box>
              </Collapse>
            </Box>
          )}
        </Box>
      </Collapse>

      {/* Menus */}
      <Menu anchorEl={menuEl} open={Boolean(menuEl)} onClose={() => setMenuEl(null)}>
        <MenuItem onClick={() => { setMenuEl(null); run({ planning_enabled: !f.controls.planning_enabled },
          f.controls.planning_enabled ? "Follow-up planning paused" : "Follow-up planning resumed"); }}>
          <ListItemIcon>{f.controls.planning_enabled ? <IconPlayerPause size={16} /> : <IconPlayerPlay size={16} />}</ListItemIcon>
          {f.controls.planning_enabled ? "Pause follow-up planning" : "Resume follow-up planning"}
        </MenuItem>
        <MenuItem onClick={() => { setMenuEl(null); run({ assessment_enabled: !f.controls.assessment_enabled },
          f.controls.assessment_enabled ? "AI assessment frozen" : "AI assessment resumed"); }}>
          <ListItemIcon><IconBrain size={16} /></ListItemIcon>
          {f.controls.assessment_enabled ? "Freeze AI assessment" : "Resume AI assessment"}
        </MenuItem>
        {f.controls.manual_due_at && (
          <MenuItem onClick={() => { setMenuEl(null); clear.mutate(f.version, {
            onSuccess: () => toast.success("Your schedule was cleared"), onError: (e) => toast.error(followupError(e)) }); }}>
            <ListItemIcon><IconX size={16} /></ListItemIcon>Clear my schedule
          </MenuItem>
        )}
      </Menu>
      <Menu anchorEl={snoozeEl} open={Boolean(snoozeEl)} onClose={() => setSnoozeEl(null)}>
        {[["1 day", 1], ["3 days", 3], ["1 week", 7], ["2 weeks", 14]].map(([label, days]) => (
          <MenuItem key={label as string} onClick={() => {
            setSnoozeEl(null);
            run({ snoozed_until: new Date(Date.now() + (days as number) * 86400000).toISOString() }, `Snoozed for ${label}`);
          }}>{label as string}</MenuItem>
        ))}
        {snoozed && <Divider />}
        {snoozed && <MenuItem onClick={() => { setSnoozeEl(null); run({ snoozed_until: null }, "Snooze removed"); }}>Remove snooze</MenuItem>}
      </Menu>

      {/* Dialogs */}
      <ScheduleDialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} loading={schedule.isPending} error={scheduleError}
                      workspaceTimezone={tz} defaultTime={policy?.default_local_time} workdays={policy?.workdays}
                      advanceNoticeDays={f.controls.manual_notice_days ?? policy?.advance_notice_days ?? 1}
                      title={f.controls.manual_due_at ? "Reschedule follow-up" : "Schedule a follow-up"}
                      onSubmit={(v) => schedule.mutate({ version: f.version, ...v }, {
                        onSuccess: () => { setScheduleOpen(false); toast.success("Follow-up scheduled"); },
                        onError: (e) => setScheduleError(followupError(e)),
                      })} />
      <CustomerEmailDialog open={emailOpen} onClose={() => setEmailOpen(false)} loading={patch.isPending} error={emailError}
                           participants={f.participants} defaultRecipient={f.controls.customer_recipient_email}
                           platformEnabled={f.capabilities.customer_send_globally_enabled}
                           onConfirm={(recipient) => patch.mutate(
                             { version: f.version, customer_email_enabled: true, customer_recipient_email: recipient },
                             { onSuccess: () => { setEmailOpen(false); toast.success(`Automatic email enabled for ${recipient}`); },
                               onError: (e) => setEmailError(followupError(e)) })} />
      <ConfirmDialog open={confirm === "complete"} title="Mark this follow-up completed?"
                     description="Automatic follow-ups for this conversation stop and pending reminders are cancelled. You can reopen it any time."
                     confirmText="Mark completed" isLoading={patch.isPending} onClose={() => setConfirm(null)}
                     onConfirm={() => { setConfirm(null); run({ completed: true }, "Marked completed"); }} />
      <ConfirmDialog open={confirm === "stop_email"} title="Stop emailing this customer automatically?"
                     description="No new automatic follow-up emails (or retries) will be sent. Team reminders continue."
                     confirmText="Stop automatic email" destructive isLoading={patch.isPending} onClose={() => setConfirm(null)}
                     onConfirm={() => { setConfirm(null); run({ customer_email_enabled: false }, "Automatic customer email turned off"); }} />
      <ConfirmDialog open={typeof confirm === "object" && confirm !== null} title="Lift this restriction?"
                     description="Only do this if the customer clearly asked to be contacted again. The change is recorded in the audit log."
                     confirmText="Lift restriction" destructive isLoading={lift.isPending} onClose={() => setConfirm(null)}
                     onConfirm={() => {
                       if (typeof confirm === "object" && confirm) {
                         lift.mutate(confirm.lift, { onSuccess: () => toast.success("Restriction lifted"), onError: (e) => toast.error(followupError(e)) });
                       }
                       setConfirm(null);
                     }} />
    </Box>
  );
}

const card = {
  borderRadius: "12px", backgroundColor: "#FFFFFF", border: `1px solid ${FU.border}`, p: "14px 18px",
  display: "flex", flexDirection: "column", gap: 1, boxShadow: "0 1px 3px rgba(15,23,42,0.03)",
} as const;
const banner = { borderRadius: "10px", fontSize: 13, py: 0.25, "& .MuiAlert-message": { py: 0.75 } } as const;
const actionBtn = { textTransform: "none", fontWeight: 600, borderRadius: "8px", fontSize: 12.5 } as const;
