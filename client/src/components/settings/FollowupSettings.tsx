"use client";

/**
 * Workspace follow-up settings. Owners/admins (settings.update) edit; everyone else sees read-only.
 * Timing defaults never grant permission to email customers: that is a separate, explicit workspace
 * allowance AND a per-conversation choice by a member with send permission.
 */

import React, { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { IconBell, IconBrain, IconClock, IconEye, IconMail, IconRocket, IconShieldCheck } from "@tabler/icons-react";
import { followupError, useFollowupPolicy, usePatchFollowupPolicy } from "@/hooks/useFollowups";
import { useTenant } from "@/hooks/use-tenant";
import { can } from "@/lib/permissions";
import { toast } from "@/stores/notification.store";
import type { UserRole } from "@/types/user.types";
import type { FollowupPolicy } from "@/types/followup.types";
import { ConfirmDialog } from "@/components/ui/feedback/ConfirmDialog";
import { FU, WEEKDAYS, timeZones } from "@/components/followups/meta";

type Editable = Omit<FollowupPolicy, "effective_timezone" | "platform" | "version">;

const EDITABLE_KEYS: (keyof Editable)[] = [
  "mode", "assessment_enabled", "planning_enabled", "customer_email_allowed", "cadence_hot_days", "cadence_warm_days",
  "cadence_cold_days", "workdays", "send_window_start", "send_window_end", "default_local_time", "advance_notice_days",
  "max_attempts", "min_spacing_hours", "timezone",
];

function Section({ icon, title, subtitle, children }: {
  icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: "14px", borderColor: "#EEF2F6", p: { xs: 2, sm: 2.5 } }}>
      <Box sx={{ display: "flex", gap: 1.5, mb: 2 }}>
        <Box sx={{ width: 34, height: 34, borderRadius: "10px", backgroundColor: "#EFF6FF", color: FU.primary,
                   display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</Box>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 15, color: FU.text }}>{title}</Typography>
          <Typography sx={{ fontSize: 13, color: FU.muted, mt: 0.25 }}>{subtitle}</Typography>
        </Box>
      </Box>
      {children}
    </Paper>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "280px 1fr" }, gap: { xs: 0.75, md: 2 },
               alignItems: "center", py: 1.25, borderTop: "1px solid #F1F5F9", "&:first-of-type": { borderTop: "none" } }}>
      <Box>
        <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: FU.body }}>{label}</Typography>
        {hint && <Typography sx={{ fontSize: 12, color: FU.muted }}>{hint}</Typography>}
      </Box>
      <Box>{children}</Box>
    </Box>
  );
}

function ToggleRow({ title, desc, checked, disabled, onChange, icon }: {
  title: string; desc: string; checked: boolean; disabled: boolean; onChange: (v: boolean) => void; icon: React.ReactNode;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, py: 1.25, borderTop: "1px solid #F1F5F9",
               "&:first-of-type": { borderTop: "none" } }}>
      <Box sx={{ color: FU.muted, pt: 0.25 }}>{icon}</Box>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: FU.body }}>{title}</Typography>
        <Typography sx={{ fontSize: 12.5, color: FU.muted }}>{desc}</Typography>
      </Box>
      <Switch checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)}
              slotProps={{ input: { "aria-label": title } }} />
    </Box>
  );
}

export function FollowupSettings() {
  const q = useFollowupPolicy();
  const save = usePatchFollowupPolicy();
  const { role } = useTenant();
  const canEdit = can({ role: (role ?? undefined) as UserRole | undefined }, "settings.manage");
  const zones = useMemo(() => timeZones(), []);
  const [form, setForm] = useState<Editable | null>(null);
  const [confirmEmail, setConfirmEmail] = useState(false);

  useEffect(() => {
    if (q.data) {
      const next = {} as Record<string, unknown>;
      for (const k of EDITABLE_KEYS) next[k] = q.data[k];
      setForm(next as Editable);
    }
  }, [q.data]);

  const dirtyKeys = useMemo(() => {
    if (!form || !q.data) return [] as (keyof Editable)[];
    return EDITABLE_KEYS.filter((k) => JSON.stringify(form[k]) !== JSON.stringify(q.data![k]));
  }, [form, q.data]);

  if (q.isLoading || !form || !q.data) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={140} sx={{ borderRadius: "14px" }} />)}
      </Box>
    );
  }
  if (q.isError) return <Alert severity="error">{followupError(q.error)}</Alert>;

  const p = q.data;
  const set = <K extends keyof Editable>(k: K, v: Editable[K]) => setForm({ ...form, [k]: v });
  const errors: string[] = [];
  if (form.send_window_start >= form.send_window_end) errors.push("Send hours must end after they start.");
  if (!form.workdays.length) errors.push("Choose at least one working day.");

  const num = (k: "cadence_hot_days" | "cadence_warm_days" | "cadence_cold_days" | "advance_notice_days" | "max_attempts"
    | "min_spacing_hours", min: number, max: number, suffix: string) => (
    <TextField type="number" size="small" value={form[k]} disabled={!canEdit}
               onChange={(e) => set(k, Math.max(min, Math.min(max, Number(e.target.value) || min)))}
               slotProps={{ htmlInput: { min, max }, input: { endAdornment: <Typography sx={{ fontSize: 12, color: FU.muted, ml: 0.5 }}>{suffix}</Typography> } }}
               sx={{ width: 130 }} />
  );

  const submit = () => {
    const body: Record<string, unknown> = { version: p.version };
    for (const k of dirtyKeys) body[k] = form[k];
    save.mutate(body as Partial<FollowupPolicy> & { version: number }, {
      onSuccess: () => toast.success("Follow-up settings saved"),
      onError: (e) => { toast.error(followupError(e)); q.refetch(); },
    });
  };

  const modeCard = (value: "shadow" | "active", title: string, desc: string, icon: React.ReactNode) => {
    const selected = form.mode === value;
    return (
      <Box role="radio" aria-checked={selected} tabIndex={canEdit ? 0 : -1}
           onClick={() => canEdit && set("mode", value)}
           onKeyDown={(e) => { if (canEdit && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); set("mode", value); } }}
           sx={{ flex: 1, minWidth: 240, p: 2, borderRadius: "12px", cursor: canEdit ? "pointer" : "default",
                 border: `2px solid ${selected ? FU.primary : FU.border}`, backgroundColor: selected ? "#F5F9FF" : "#FFFFFF",
                 transition: "all 120ms ease", outline: "none", "&:focus-visible": { boxShadow: "0 0 0 3px #BFDBFE" } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, color: selected ? FU.primary : FU.body }}>
          {icon}<Typography sx={{ fontWeight: 700, fontSize: 14 }}>{title}</Typography>
          {selected && <Chip size="small" label="Current" color="primary" sx={{ ml: "auto", height: 20, fontSize: 11, fontWeight: 700 }} />}
        </Box>
        <Typography sx={{ fontSize: 12.5, color: FU.muted, lineHeight: 1.55 }}>{desc}</Typography>
      </Box>
    );
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pb: dirtyKeys.length ? 10 : 2 }}>
      {!canEdit && (
        <Alert severity="info" sx={{ borderRadius: "10px" }}>Only workspace owners and admins can change these settings.</Alert>
      )}
      {p.platform.observe_only_forced && (
        <Alert severity="warning" sx={{ borderRadius: "10px" }}>
          Observe-only is currently enforced for the whole platform, so this workspace will not act on assessments until that
          is lifted by the platform operator.
        </Alert>
      )}

      <Section icon={<IconRocket size={18} />} title="Automation mode"
               subtitle="Start by observing. Activate when the AI's judgement matches how your team works.">
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }} role="radiogroup" aria-label="Automation mode">
          {modeCard("shadow", "Observe only",
            "AI #2 reads every new business email and records its assessment. Nothing is scheduled, no reminders go out and no customer is emailed.",
            <IconEye size={18} />)}
          {modeCard("active", "Active",
            "Assessments update lead temperature, schedule follow-ups and send your team reminders. Customers are emailed only where you allow it below and per conversation.",
            <IconRocket size={18} />)}
        </Box>
      </Section>

      <Section icon={<IconShieldCheck size={18} />} title="What ProxiPilot may do"
               subtitle="Each switch is independent. Conversations can override the first two.">
        <ToggleRow icon={<IconBrain size={18} />} title="Automatic lead assessment" checked={form.assessment_enabled} disabled={!canEdit}
                   onChange={(v) => set("assessment_enabled", v)}
                   desc="Re-assess temperature, outcome and next step on each new business email." />
        <ToggleRow icon={<IconBell size={18} />} title="Follow-up planning and team reminders" checked={form.planning_enabled} disabled={!canEdit}
                   onChange={(v) => set("planning_enabled", v)}
                   desc="Plan follow-ups and email every active team member before and when they are due." />
        <ToggleRow icon={<IconMail size={18} />} title="Allow automatic customer emails" checked={form.customer_email_allowed} disabled={!canEdit}
                   onChange={(v) => (v ? setConfirmEmail(true) : set("customer_email_allowed", false))}
                   desc="Lets members with send permission turn on automatic follow-up emails for a specific conversation and recipient. Off by default." />
        {form.customer_email_allowed && !p.platform.customer_send_enabled && (
          <Alert severity="info" sx={{ borderRadius: "10px", mt: 1, fontSize: 13 }}>
            Customer sending is switched off for the whole platform right now, so only reminders go out until the platform
            operator enables it.
          </Alert>
        )}
      </Section>

      <Section icon={<IconClock size={18} />} title="Timing"
               subtitle="Used when the customer did not give a date. A customer's own date or your team's schedule always comes first.">
        <Field label="Follow up after (business days)" hint="Applied only when the AI thinks a follow-up is warranted.">
          <Box sx={{ display: "flex", gap: 1.25, flexWrap: "wrap", alignItems: "center" }}>
            <Typography sx={{ fontSize: 12.5, color: "#DC2626", fontWeight: 700 }}>Hot</Typography>{num("cadence_hot_days", 1, 60, "days")}
            <Typography sx={{ fontSize: 12.5, color: "#D97706", fontWeight: 700 }}>Warm</Typography>{num("cadence_warm_days", 1, 60, "days")}
            <Typography sx={{ fontSize: 12.5, color: "#0284C7", fontWeight: 700 }}>Cold</Typography>{num("cadence_cold_days", 1, 90, "days")}
          </Box>
        </Field>
        <Field label="Working days">
          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
            {WEEKDAYS.map((d, i) => {
              const on = form.workdays.includes(i);
              return (
                <Chip key={d} label={d} clickable={canEdit} disabled={!canEdit && !on}
                      color={on ? "primary" : "default"} variant={on ? "filled" : "outlined"}
                      onClick={() => canEdit && set("workdays", on ? form.workdays.filter((x) => x !== i) : [...form.workdays, i].sort())}
                      sx={{ fontWeight: 600, minWidth: 52 }} />
              );
            })}
          </Box>
        </Field>
        <Field label="Reminder time for date-only follow-ups">
          <TextField type="time" size="small" value={form.default_local_time} disabled={!canEdit}
                     onChange={(e) => set("default_local_time", e.target.value)} sx={{ width: 140 }} />
        </Field>
        <Field label="Customer send hours" hint="Automatic customer emails go out only inside these hours.">
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <TextField type="time" size="small" value={form.send_window_start} disabled={!canEdit}
                       onChange={(e) => set("send_window_start", e.target.value)} sx={{ width: 140 }} />
            <Typography sx={{ color: FU.muted }}>to</Typography>
            <TextField type="time" size="small" value={form.send_window_end} disabled={!canEdit}
                       onChange={(e) => set("send_window_end", e.target.value)} sx={{ width: 140 }} />
          </Box>
        </Field>
        <Field label="Advance team reminder" hint="0 = remind only when due.">
          {num("advance_notice_days", 0, 10, "business days before")}
        </Field>
        <Field label="Time zone" hint={`In use: ${p.effective_timezone}`}>
          <Autocomplete size="small" options={zones} value={form.timezone ?? null} disabled={!canEdit}
                        onChange={(_, v) => set("timezone", v)} sx={{ maxWidth: 320 }}
                        renderInput={(params) => <TextField {...params} placeholder={`${p.effective_timezone} (workspace default)`} />} />
        </Field>
      </Section>

      <Section icon={<IconShieldCheck size={18} />} title="Limits" subtitle="Guard rails for automatic customer follow-ups.">
        <Field label="Maximum automatic follow-ups" hint="Per sequence; resets when the customer writes again.">
          {num("max_attempts", 1, 10, "emails")}
        </Field>
        <Field label="Minimum gap between customer emails">{num("min_spacing_hours", 1, 720, "hours")}</Field>
      </Section>

      {canEdit && dirtyKeys.length > 0 && (
        <Paper elevation={6} sx={{ position: "sticky", bottom: 16, zIndex: 5, borderRadius: "12px", px: 2.5, py: 1.5,
                                   display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", border: "1px solid #DBEAFE" }}>
          <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: FU.text, flex: 1 }}>
            {dirtyKeys.length} unsaved change{dirtyKeys.length === 1 ? "" : "s"}
            {errors.length > 0 && <Box component="span" sx={{ color: FU.danger, ml: 1 }}>{errors[0]}</Box>}
          </Typography>
          <Button onClick={() => q.data && setForm(Object.fromEntries(EDITABLE_KEYS.map((k) => [k, q.data![k]])) as Editable)}
                  disabled={save.isPending} sx={{ textTransform: "none", fontWeight: 600 }}>Discard</Button>
          <Button variant="contained" disableElevation onClick={submit} disabled={save.isPending || errors.length > 0}
                  sx={{ textTransform: "none", fontWeight: 600, borderRadius: "9px" }}>
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </Paper>
      )}

      <ConfirmDialog open={confirmEmail} title="Allow automatic customer emails?"
                     description="Members with send permission will be able to turn on automatic follow-up emails for individual conversations. Every email still passes safety checks (consent, do-not-contact, newest message, send hours, limits) and nothing is sent until someone enables it on a conversation."
                     confirmText="Allow" onClose={() => setConfirmEmail(false)}
                     onConfirm={() => { set("customer_email_allowed", true); setConfirmEmail(false); }} />
    </Box>
  );
}
