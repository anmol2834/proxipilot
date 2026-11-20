"use client";

/**
 * Workspace follow-up policy editor.
 * Redesigned to match Untitled UI preference rows (title & description on left, controls on right).
 *
 * Faster and more reliable:
 * - Lazy query loading when tab is active
 * - Checked error state before skeleton to prevent infinite loading on network errors
 * - Isolated draft state preserved across background refetches
 * - 409 conflict detection with explicit merge/discard options
 * - Payload sends only dirty fields with authoritative baseline version
 * - Direct cache update on patch without redundant GET round-trips
 */

import React, { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  IconEye,
  IconRefresh,
  IconRocket,
} from "@tabler/icons-react";
import { followupError, useFollowupPolicy, usePatchFollowupPolicy } from "@/hooks/useFollowups";
import { useTenant } from "@/hooks/use-tenant";
import { can } from "@/lib/permissions";
import { toast } from "@/stores/notification.store";
import type { UserRole } from "@/types/user.types";
import type { FollowupPolicy } from "@/types/followup.types";
import { ConfirmDialog } from "@/components/ui/feedback/ConfirmDialog";
import { WEEKDAYS, timeZones } from "@/components/followups/meta";
import { UntitledSwitch } from "./SettingsHub";

type Editable = Omit<FollowupPolicy, "effective_timezone" | "platform" | "version">;

const EDITABLE_KEYS: (keyof Editable)[] = [
  "mode",
  "assessment_enabled",
  "planning_enabled",
  "customer_email_allowed",
  "cadence_hot_days",
  "cadence_warm_days",
  "cadence_cold_days",
  "workdays",
  "send_window_start",
  "send_window_end",
  "default_local_time",
  "advance_notice_days",
  "max_attempts",
  "min_spacing_hours",
  "timezone",
];

interface FollowupSettingsProps {
  isTabActive?: boolean;
}

export function FollowupSettings({ isTabActive = true }: FollowupSettingsProps) {
  const { organizationId, role } = useTenant();
  const q = useFollowupPolicy(isTabActive);
  const save = usePatchFollowupPolicy();
  const canEdit = can({ role: (role ?? undefined) as UserRole | undefined }, "settings.manage");
  const zones = useMemo(() => timeZones(), []);

  // Baseline tracks the server version; draft tracks user changes
  const [baseline, setBaseline] = useState<FollowupPolicy | null>(null);
  const [draft, setDraft] = useState<Editable | null>(null);
  const [lastOrgId, setLastOrgId] = useState<string | null>(null);
  const [confirmEmailDialog, setConfirmEmailDialog] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);

  // Synchronize incoming policy data
  useEffect(() => {
    if (!q.data) return;

    const orgChanged = organizationId !== lastOrgId;

    if (orgChanged || !baseline) {
      // First load or tenant switch: set fresh baseline and draft
      setBaseline(q.data);
      setLastOrgId(organizationId);
      const initialDraft: Record<string, unknown> = {};
      for (const k of EDITABLE_KEYS) initialDraft[k] = q.data[k];
      setDraft(initialDraft as Editable);
      setConflictError(null);
    } else if (baseline && q.data.version !== baseline.version) {
      // Background refetch detected a new version from another session
      const hasUnsavedEdits = EDITABLE_KEYS.some(
        (k) => draft && JSON.stringify(draft[k]) !== JSON.stringify(baseline[k])
      );

      if (!hasUnsavedEdits) {
        // Safe to silently adopt server version
        setBaseline(q.data);
        const nextDraft: Record<string, unknown> = {};
        for (const k of EDITABLE_KEYS) nextDraft[k] = q.data[k];
        setDraft(nextDraft as Editable);
      } else {
        // User has pending edits: keep edits and present conflict notice
        setConflictError(
          `A newer policy (v${q.data.version}) was saved by another teammate or session. Your edits (based on v${baseline.version}) are kept below.`
        );
      }
    }
  }, [q.data, organizationId, lastOrgId, baseline, draft]);

  // Compute dirty keys comparing draft against baseline
  const dirtyKeys = useMemo(() => {
    if (!draft || !baseline) return [] as (keyof Editable)[];
    return EDITABLE_KEYS.filter((k) => JSON.stringify(draft[k]) !== JSON.stringify(baseline[k]));
  }, [draft, baseline]);

  // Validations
  const validationErrors = useMemo(() => {
    if (!draft) return [];
    const errs: string[] = [];
    if (draft.send_window_start >= draft.send_window_end) {
      errs.push("Send window start time must be before end time.");
    }
    if (!draft.workdays || draft.workdays.length === 0) {
      errs.push("Select at least one workday.");
    }
    if (draft.cadence_hot_days < 1 || draft.cadence_hot_days > 60) {
      errs.push("Hot cadence must be between 1 and 60 days.");
    }
    if (draft.cadence_warm_days < 1 || draft.cadence_warm_days > 60) {
      errs.push("Warm cadence must be between 1 and 60 days.");
    }
    if (draft.cadence_cold_days < 1 || draft.cadence_cold_days > 90) {
      errs.push("Cold cadence must be between 1 and 90 days.");
    }
    if (draft.advance_notice_days < 0 || draft.advance_notice_days > 10) {
      errs.push("Advance notice must be between 0 and 10 days.");
    }
    if (draft.max_attempts < 1 || draft.max_attempts > 10) {
      errs.push("Maximum attempts must be between 1 and 10.");
    }
    if (draft.min_spacing_hours < 1 || draft.min_spacing_hours > 720) {
      errs.push("Minimum spacing must be between 1 and 720 hours.");
    }
    return errs;
  }, [draft]);

  // Check initial error state BEFORE checking !draft || !baseline
  if (q.isError) {
    return (
      <Box sx={{ py: 4, maxWidth: 960 }}>
        <Alert
          severity="error"
          sx={{ borderRadius: "12px", border: "1px solid #FCA5A5" }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => q.refetch()}
              startIcon={<IconRefresh size={16} />}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              Retry
            </Button>
          }
        >
          {followupError(q.error)}
        </Alert>
      </Box>
    );
  }

  // Loading skeleton matching Untitled UI preference rows
  if (q.isLoading || !draft || !baseline) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3, py: 2, maxWidth: 960 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Box
            key={i}
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "320px 1fr" },
              gap: 2,
              py: 2.5,
              borderBottom: "1px solid #EAECF0",
            }}
          >
            <Box>
              <Skeleton variant="text" width="60%" height={24} />
              <Skeleton variant="text" width="90%" height={18} sx={{ mt: 0.5 }} />
            </Box>
            <Box sx={{ display: "flex", justifyContent: { xs: "flex-start", md: "flex-end" } }}>
              <Skeleton variant="rounded" width={160} height={38} sx={{ borderRadius: "8px" }} />
            </Box>
          </Box>
        ))}
      </Box>
    );
  }

  const set = <K extends keyof Editable>(k: K, v: Editable[K]) => {
    setDraft((prev) => (prev ? { ...prev, [k]: v } : prev));
  };

  const handleDiscard = () => {
    if (!baseline) return;
    const restored: Record<string, unknown> = {};
    for (const k of EDITABLE_KEYS) restored[k] = baseline[k];
    setDraft(restored as Editable);
    setConflictError(null);
  };

  const handleSave = () => {
    if (!draft || !baseline) return;
    if (validationErrors.length > 0) return;

    // Send baseline version and only modified keys
    const patchPayload: Record<string, unknown> = { version: baseline.version };
    for (const k of dirtyKeys) {
      patchPayload[k] = draft[k];
    }

    save.mutate(patchPayload as Partial<FollowupPolicy> & { version: number }, {
      onSuccess: (updatedPolicy) => {
        toast.success("Follow-up policy updated successfully");
        setBaseline(updatedPolicy);
        const syncedDraft: Record<string, unknown> = {};
        for (const k of EDITABLE_KEYS) syncedDraft[k] = updatedPolicy[k];
        setDraft(syncedDraft as Editable);
        setConflictError(null);
      },
      onError: (err: any) => {
        if (err?.statusCode === 409 || err?.response?.status === 409) {
          setConflictError(
            "Conflict detected: another member updated these settings. Click 'Refresh Server Version' to inspect or reapply your changes."
          );
          q.refetch();
        } else {
          toast.error(followupError(err));
        }
      },
    });
  };

  const handleAcceptServerVersion = () => {
    if (!q.data) return;
    setBaseline(q.data);
    const serverDraft: Record<string, unknown> = {};
    for (const k of EDITABLE_KEYS) serverDraft[k] = q.data[k];
    setDraft(serverDraft as Editable);
    setConflictError(null);
    toast.info("Restored latest server policy");
  };

  const handleForceReapplyDraft = () => {
    if (!q.data) return;
    // Update baseline version to latest server version so re-submit succeeds
    setBaseline((prev) => (prev ? { ...prev, version: q.data!.version } : q.data!));
    setConflictError(null);
    toast.info("Updated target version to latest. You may now click 'Save changes'.");
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0, maxWidth: 960, pb: dirtyKeys.length ? 12 : 4 }}>
      {/* Informational banners */}
      {!canEdit && (
        <Alert severity="info" sx={{ mb: 3, borderRadius: "10px", fontSize: 13.5 }}>
          You have read-only access to this workspace. Only workspace Owners and Admins can modify follow-up policies.
        </Alert>
      )}

      {baseline.platform.observe_only_forced && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: "10px", fontSize: 13.5 }}>
          Observe-only mode is temporarily enforced across the platform. Automated follow-up actions and reminders will remain paused until lifted by platform operations.
        </Alert>
      )}

      {conflictError && (
        <Alert
          severity="error"
          sx={{ mb: 3, borderRadius: "10px", fontSize: 13.5 }}
          action={
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button size="small" color="inherit" onClick={handleAcceptServerVersion} sx={{ textTransform: "none" }}>
                Accept server version
              </Button>
              <Button size="small" variant="outlined" color="inherit" onClick={handleForceReapplyDraft} sx={{ textTransform: "none" }}>
                Keep my changes
              </Button>
            </Box>
          }
        >
          {conflictError}
        </Alert>
      )}

      {/* Section 1: Automation Engine Mode */}
      <Box sx={{ pt: 1, pb: 3, borderBottom: "1px solid #EAECF0" }}>
        <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#101828" }}>Automation mode</Typography>
        <Typography sx={{ fontSize: 13.5, color: "#475467", mt: 0.25 }}>
          Choose whether AI assesses customer emails silently or activates scheduled follow-up notifications.
        </Typography>

        <Box sx={{ mt: 2.5, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
          {/* Card: Observe only */}
          <Box
            role="radio"
            aria-checked={draft.mode === "shadow"}
            tabIndex={canEdit ? 0 : -1}
            onClick={() => canEdit && set("mode", "shadow")}
            onKeyDown={(e) => {
              if (canEdit && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                set("mode", "shadow");
              }
            }}
            sx={{
              p: 2.5,
              borderRadius: "12px",
              cursor: canEdit ? "pointer" : "default",
              border: `2px solid ${draft.mode === "shadow" ? "#2563EB" : "#EAECF0"}`,
              backgroundColor: draft.mode === "shadow" ? "#F0F7FF" : "#FFFFFF",
              transition: "all 120ms ease",
              outline: "none",
              "&:hover": canEdit ? { borderColor: draft.mode === "shadow" ? "#2563EB" : "#D0D5DD" } : {},
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: draft.mode === "shadow" ? "#2563EB" : "#344054" }}>
                <IconEye size={18} />
                <Typography sx={{ fontWeight: 600, fontSize: 14.5 }}>Observe only</Typography>
              </Box>
              {draft.mode === "shadow" && (
                <Chip size="small" label="Active" color="primary" sx={{ height: 22, fontSize: 11, fontWeight: 600 }} />
              )}
            </Box>
            <Typography sx={{ fontSize: 13, color: "#475467", lineHeight: 1.5 }}>
              AI #2 reads every new business email and records temperature assessments. Nothing is scheduled, no reminders go out, and customers are never contacted.
            </Typography>
          </Box>

          {/* Card: Active */}
          <Box
            role="radio"
            aria-checked={draft.mode === "active"}
            tabIndex={canEdit ? 0 : -1}
            onClick={() => canEdit && set("mode", "active")}
            onKeyDown={(e) => {
              if (canEdit && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                set("mode", "active");
              }
            }}
            sx={{
              p: 2.5,
              borderRadius: "12px",
              cursor: canEdit ? "pointer" : "default",
              border: `2px solid ${draft.mode === "active" ? "#2563EB" : "#EAECF0"}`,
              backgroundColor: draft.mode === "active" ? "#F0F7FF" : "#FFFFFF",
              transition: "all 120ms ease",
              outline: "none",
              "&:hover": canEdit ? { borderColor: draft.mode === "active" ? "#2563EB" : "#D0D5DD" } : {},
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: draft.mode === "active" ? "#2563EB" : "#344054" }}>
                <IconRocket size={18} />
                <Typography sx={{ fontWeight: 600, fontSize: 14.5 }}>Active automation</Typography>
              </Box>
              {draft.mode === "active" && (
                <Chip size="small" label="Active" color="primary" sx={{ height: 22, fontSize: 11, fontWeight: 600 }} />
              )}
            </Box>
            <Typography sx={{ fontSize: 13, color: "#475467", lineHeight: 1.5 }}>
              Assessments dynamically schedule follow-up occurrences and notify team members before due dates. Customer sending requires workspace allowance and explicit per-thread consent.
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Section 2: Workspace Execution & Safety Allowances */}
      <Box sx={{ py: 3, borderBottom: "1px solid #EAECF0" }}>
        <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#101828" }}>Execution & allowances</Typography>
        <Typography sx={{ fontSize: 13.5, color: "#475467", mt: 0.25 }}>
          Govern which automated actions ProxiPilot is permitted to take across this workspace.
        </Typography>

        {/* Row: Automatic assessment */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "380px 1fr" },
            gap: 2,
            py: 2.5,
            borderBottom: "1px solid #F1F5F9",
            alignItems: "center",
          }}
        >
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
              Automatic lead assessment
            </Typography>
            <Typography sx={{ fontSize: 13, color: "#475467", mt: 0.25 }}>
              Re-evaluates buying temperature, deal outcome, and next action upon receiving new customer emails.
            </Typography>
          </Box>
          <Box sx={{ display: "flex", justifyContent: { xs: "flex-start", md: "flex-start" } }}>
            <UntitledSwitch
              checked={draft.assessment_enabled}
              disabled={!canEdit}
              onChange={(e) => set("assessment_enabled", e.target.checked)}
              slotProps={{ input: { "aria-label": "Automatic lead assessment" } }}
            />
          </Box>
        </Box>

        {/* Row: Planning & reminders */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "340px 1fr" },
            gap: 2,
            py: 2.5,
            borderBottom: "1px solid #F1F5F9",
            alignItems: "center",
          }}
        >
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
              Follow-up planning & team reminders
            </Typography>
            <Typography sx={{ fontSize: 13, color: "#475467", mt: 0.25 }}>
              Calculates due dates and sends team notification emails when action is required on high-value conversations.
            </Typography>
          </Box>
          <Box sx={{ display: "flex", justifyContent: { xs: "flex-start", md: "flex-start" } }}>
            <UntitledSwitch
              checked={draft.planning_enabled}
              disabled={!canEdit}
              onChange={(e) => set("planning_enabled", e.target.checked)}
              slotProps={{ input: { "aria-label": "Follow-up planning & team reminders" } }}
            />
          </Box>
        </Box>

        {/* Row: Customer sending allowance */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "340px 1fr" },
            gap: 2,
            py: 2.5,
            alignItems: "center",
          }}
        >
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
              Allow automatic customer follow-up emails
            </Typography>
            <Typography sx={{ fontSize: 13, color: "#475467", mt: 0.25 }}>
              Allows teammates with send authority to toggle automated AI follow-up sending on specific customer threads.
            </Typography>
          </Box>
          <Box sx={{ display: "flex", justifyContent: { xs: "flex-start", md: "flex-start" } }}>
            <UntitledSwitch
              checked={draft.customer_email_allowed}
              disabled={!canEdit}
              onChange={(e) => {
                if (e.target.checked) {
                  setConfirmEmailDialog(true);
                } else {
                  set("customer_email_allowed", false);
                }
              }}
              slotProps={{ input: { "aria-label": "Allow automatic customer emails" } }}
            />
          </Box>
        </Box>

        {draft.customer_email_allowed && !baseline.platform.customer_send_enabled && (
          <Alert severity="info" sx={{ mt: 1.5, borderRadius: "10px", fontSize: 13 }}>
            Customer sending is currently paused at the platform infrastructure level. Reminders will be generated, but external sends are held.
          </Alert>
        )}
      </Box>

      {/* Section 3: Timing & Working Hours */}
      <Box sx={{ py: 3, borderBottom: "1px solid #EAECF0" }}>
        <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#101828" }}>Timing & schedule</Typography>
        <Typography sx={{ fontSize: 13.5, color: "#475467", mt: 0.25 }}>
          Intervals and delivery hours applied when customer correspondence does not specify an explicit callback date.
        </Typography>

        {/* Row: Cadence by temperature */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "380px 1fr" },
            gap: 2,
            py: 2.5,
            borderBottom: "1px solid #F1F5F9",
            alignItems: "center",
          }}
        >
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
              Cadence by temperature (business days)
            </Typography>
            <Typography sx={{ fontSize: 13, color: "#475467", mt: 0.25 }}>
              Business days to wait before following up based on AI temperature classification.
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "#DC2626" }}>Hot</Typography>
              <TextField
                type="number"
                size="small"
                value={draft.cadence_hot_days}
                disabled={!canEdit}
                onChange={(e) => set("cadence_hot_days", parseInt(e.target.value, 10) || 1)}
                slotProps={{
                  htmlInput: { min: 1, max: 60 },
                  input: { endAdornment: <Typography sx={{ fontSize: 12, color: "#64748B", ml: 0.5 }}>days</Typography> },
                }}
                sx={{ width: 110 }}
              />
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "#D97706" }}>Warm</Typography>
              <TextField
                type="number"
                size="small"
                value={draft.cadence_warm_days}
                disabled={!canEdit}
                onChange={(e) => set("cadence_warm_days", parseInt(e.target.value, 10) || 1)}
                slotProps={{
                  htmlInput: { min: 1, max: 60 },
                  input: { endAdornment: <Typography sx={{ fontSize: 12, color: "#64748B", ml: 0.5 }}>days</Typography> },
                }}
                sx={{ width: 110 }}
              />
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "#0284C7" }}>Cold</Typography>
              <TextField
                type="number"
                size="small"
                value={draft.cadence_cold_days}
                disabled={!canEdit}
                onChange={(e) => set("cadence_cold_days", parseInt(e.target.value, 10) || 1)}
                slotProps={{
                  htmlInput: { min: 1, max: 90 },
                  input: { endAdornment: <Typography sx={{ fontSize: 12, color: "#64748B", ml: 0.5 }}>days</Typography> },
                }}
                sx={{ width: 110 }}
              />
            </Box>
          </Box>
        </Box>

        {/* Row: Working days */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "380px 1fr" },
            gap: 2,
            py: 2.5,
            borderBottom: "1px solid #F1F5F9",
            alignItems: "center",
          }}
        >
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>Working days</Typography>
            <Typography sx={{ fontSize: 13, color: "#475467", mt: 0.25 }}>
              Days of the week counted toward business day cadence intervals.
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
            {WEEKDAYS.map((d, i) => {
              const selected = draft.workdays.includes(i);
              return (
                <Chip
                  key={d}
                  label={d}
                  clickable={canEdit}
                  disabled={!canEdit && !selected}
                  color={selected ? "primary" : "default"}
                  variant={selected ? "filled" : "outlined"}
                  onClick={() => {
                    if (!canEdit) return;
                    set(
                      "workdays",
                      selected ? draft.workdays.filter((x) => x !== i) : [...draft.workdays, i].sort()
                    );
                  }}
                  sx={{ fontWeight: 600, minWidth: 50, borderRadius: "8px" }}
                />
              );
            })}
          </Box>
        </Box>

        {/* Row: Customer send hours */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "380px 1fr" },
            gap: 2,
            py: 2.5,
            borderBottom: "1px solid #F1F5F9",
            alignItems: "center",
          }}
        >
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>Customer send window</Typography>
            <Typography sx={{ fontSize: 13, color: "#475467", mt: 0.25 }}>
              Automatic customer emails are dispatched only within these local hours.
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
            <TextField
              type="time"
              size="small"
              value={draft.send_window_start}
              disabled={!canEdit}
              onChange={(e) => set("send_window_start", e.target.value)}
              sx={{ width: 140 }}
            />
            <Typography sx={{ color: "#64748B", fontSize: 13 }}>to</Typography>
            <TextField
              type="time"
              size="small"
              value={draft.send_window_end}
              disabled={!canEdit}
              onChange={(e) => set("send_window_end", e.target.value)}
              sx={{ width: 140 }}
            />
          </Box>
        </Box>

        {/* Row: Default reminder time */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "380px 1fr" },
            gap: 2,
            py: 2.5,
            borderBottom: "1px solid #F1F5F9",
            alignItems: "center",
          }}
        >
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>Default reminder time</Typography>
            <Typography sx={{ fontSize: 13, color: "#475467", mt: 0.25 }}>
              Target time applied when a follow-up specifies a date without an explicit hour.
            </Typography>
          </Box>
          <Box>
            <TextField
              type="time"
              size="small"
              value={draft.default_local_time}
              disabled={!canEdit}
              onChange={(e) => set("default_local_time", e.target.value)}
              sx={{ width: 140 }}
            />
          </Box>
        </Box>

        {/* Row: Advance notice */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "380px 1fr" },
            gap: 2,
            py: 2.5,
            borderBottom: "1px solid #F1F5F9",
            alignItems: "center",
          }}
        >
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>Advance team notice</Typography>
            <Typography sx={{ fontSize: 13, color: "#475467", mt: 0.25 }}>
              Notify team members this many business days ahead of follow-up due date (0 = remind only on due date).
            </Typography>
          </Box>
          <Box>
            <TextField
              type="number"
              size="small"
              value={draft.advance_notice_days}
              disabled={!canEdit}
              onChange={(e) => set("advance_notice_days", parseInt(e.target.value, 10) || 0)}
              slotProps={{
                htmlInput: { min: 0, max: 10 },
                input: { endAdornment: <Typography sx={{ fontSize: 12, color: "#64748B", ml: 0.5 }}>days before</Typography> },
              }}
              sx={{ width: 160 }}
            />
          </Box>
        </Box>

        {/* Row: Timezone */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "380px 1fr" },
            gap: 2,
            py: 2.5,
            alignItems: "center",
          }}
        >
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>Follow-up timezone</Typography>
            <Typography sx={{ fontSize: 13, color: "#475467", mt: 0.25 }}>
              Current effective timezone: <strong>{baseline.effective_timezone}</strong> (inherited from workspace unless overridden).
            </Typography>
          </Box>
          <Box>
            <Autocomplete
              size="small"
              options={zones}
              value={draft.timezone ?? null}
              disabled={!canEdit}
              onChange={(_, val) => set("timezone", val)}
              sx={{ maxWidth: 320 }}
              renderInput={(params) => (
                <TextField {...params} placeholder={`${baseline.effective_timezone} (workspace default)`} />
              )}
            />
          </Box>
        </Box>
      </Box>

      {/* Section 4: Safety & Automation Limits */}
      <Box sx={{ py: 3 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#101828" }}>Safety limits</Typography>
        <Typography sx={{ fontSize: 13.5, color: "#475467", mt: 0.25 }}>
          Guardrails protecting recipient goodwill, spam reputation, and outbound volume.
        </Typography>

        {/* Row: Max attempts */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "380px 1fr" },
            gap: 2,
            py: 2.5,
            borderBottom: "1px solid #F1F5F9",
            alignItems: "center",
          }}
        >
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
              Maximum automated emails
            </Typography>
            <Typography sx={{ fontSize: 13, color: "#475467", mt: 0.25 }}>
              Sequence limit per thread before pausing. Counter resets if the customer writes back.
            </Typography>
          </Box>
          <Box>
            <TextField
              type="number"
              size="small"
              value={draft.max_attempts}
              disabled={!canEdit}
              onChange={(e) => set("max_attempts", parseInt(e.target.value, 10) || 1)}
              slotProps={{
                htmlInput: { min: 1, max: 10 },
                input: { endAdornment: <Typography sx={{ fontSize: 12, color: "#64748B", ml: 0.5 }}>emails</Typography> },
              }}
              sx={{ width: 140 }}
            />
          </Box>
        </Box>

        {/* Row: Min spacing */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "380px 1fr" },
            gap: 2,
            py: 2.5,
            alignItems: "center",
          }}
        >
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
              Minimum spacing between emails
            </Typography>
            <Typography sx={{ fontSize: 13, color: "#475467", mt: 0.25 }}>
              Enforced cooldown buffer between consecutive outbound emails to the same recipient.
            </Typography>
          </Box>
          <Box>
            <TextField
              type="number"
              size="small"
              value={draft.min_spacing_hours}
              disabled={!canEdit}
              onChange={(e) => set("min_spacing_hours", parseInt(e.target.value, 10) || 1)}
              slotProps={{
                htmlInput: { min: 1, max: 720 },
                input: { endAdornment: <Typography sx={{ fontSize: 12, color: "#64748B", ml: 0.5 }}>hours</Typography> },
              }}
              sx={{ width: 140 }}
            />
          </Box>
        </Box>
      </Box>

      {/* Sticky Save / Discard Bar */}
      {canEdit && dirtyKeys.length > 0 && (
        <Paper
          elevation={4}
          sx={{
            position: "fixed",
            bottom: 24,
            left: { xs: 16, sm: "calc(50% - 300px)" },
            right: { xs: 16, sm: "auto" },
            width: { xs: "auto", sm: 600 },
            zIndex: 1000,
            borderRadius: "14px",
            px: 3,
            py: 1.75,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            border: "1px solid #BFDBFE",
            backgroundColor: "#FFFFFF",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
          }}
        >
          <Box sx={{ display: "flex", flexDirection: "column" }}>
            <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: "#1E293B" }}>
              {dirtyKeys.length} unsaved change{dirtyKeys.length === 1 ? "" : "s"}
            </Typography>
            {validationErrors.length > 0 && (
              <Typography sx={{ fontSize: 12, color: "#DC2626", fontWeight: 500 }}>
                {validationErrors[0]}
              </Typography>
            )}
          </Box>

          <Box sx={{ display: "flex", gap: 1.25, alignItems: "center" }}>
            <Button
              onClick={handleDiscard}
              disabled={save.isPending}
              sx={{ textTransform: "none", fontWeight: 600, color: "#475467" }}
            >
              Discard
            </Button>
            <Button
              variant="contained"
              disableElevation
              onClick={handleSave}
              disabled={save.isPending || validationErrors.length > 0}
              sx={{
                textTransform: "none",
                fontWeight: 600,
                borderRadius: "8px",
                backgroundColor: "#2563EB",
                "&:hover": { backgroundColor: "#1D4ED8" },
              }}
            >
              {save.isPending ? "Saving changes…" : "Save changes"}
            </Button>
          </Box>
        </Paper>
      )}

      {/* Safety Confirmation for customer emails */}
      <ConfirmDialog
        open={confirmEmailDialog}
        title="Allow automatic customer follow-ups?"
        description="Enabling this allowance lets members with send authority activate automated customer follow-ups on specific threads. ProxiPilot strictly enforces consent, do-not-contact flags, maximum sequence limits, and send hours. No emails will be sent until explicitly enabled on an individual conversation."
        confirmText="Allow for workspace"
        onClose={() => setConfirmEmailDialog(false)}
        onConfirm={() => {
          set("customer_email_allowed", true);
          setConfirmEmailDialog(false);
        }}
      />
    </Box>
  );
}
