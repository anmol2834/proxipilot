"use client";

/**
 * Workspace follow-up policy editor.
 * Redesigned to match the My Profile card architecture and Untitled UI design language.
 *
 * Features:
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
  IconBell,
  IconBrain,
  IconCheck,
  IconClock,
  IconEye,
  IconFlame,
  IconMail,
  IconRefresh,
  IconRocket,
  IconShieldCheck,
  IconShieldLock,
  IconSnowflake,
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
import { ModernClockTimePicker } from "./ModernClockTimePicker";

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

const cardSx = {
  backgroundColor: "#FFFFFF",
  borderRadius: "16px",
  border: "1px solid #E5E7EB",
  p: { xs: 2.5, sm: 3 },
  boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04), 0px 1px 2px rgba(16, 24, 40, 0.02)",
  transition: "all 0.2s ease-in-out",
};

const inputSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "10px",
    backgroundColor: "#FFFFFF",
    fontSize: 13.5,
    "& fieldset": { borderColor: "#D0D5DD" },
    "&:hover fieldset": { borderColor: "#98A2B3" },
    "&.Mui-focused fieldset": { borderColor: "#4F46E5", borderWidth: "1.5px" },
  },
  "& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button": {
    WebkitAppearance: "none",
    margin: 0,
  },
  "& input[type=number]": {
    MozAppearance: "textfield",
  },
};

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
      <Box sx={{ py: 4, width: "100%" }}>
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

  // Loading skeleton matching card architecture
  if (q.isLoading || !draft || !baseline) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3, py: 2, width: "100%" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.75 }}>
            <Skeleton variant="rounded" width={44} height={44} sx={{ borderRadius: "12px" }} />
            <Box>
              <Skeleton variant="text" width={220} height={28} />
              <Skeleton variant="text" width={340} height={18} sx={{ mt: 0.5 }} />
            </Box>
          </Box>
          <Skeleton variant="rounded" width={180} height={42} sx={{ borderRadius: "12px" }} />
        </Box>
        {[1, 2, 3, 4].map((i) => (
          <Box
            key={i}
            sx={{
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              border: "1px solid #E5E7EB",
              p: 3,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
              <Skeleton variant="rounded" width={36} height={36} sx={{ borderRadius: "10px" }} />
              <Box>
                <Skeleton variant="text" width={160} height={22} />
                <Skeleton variant="text" width={280} height={16} />
              </Box>
            </Box>
            <Skeleton variant="rounded" width="100%" height={90} sx={{ borderRadius: "12px" }} />
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

  const isModeActive = draft.mode === "active";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, width: "100%", pb: dirtyKeys.length ? 12 : 4 }}>
      {/* Header Section */}
      <Box
        sx={{
          display: "flex",
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.75 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: "12px",
              background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
              color: "#4F46E5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid rgba(99, 102, 241, 0.15)",
              boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
            }}
          >
            <IconRocket size={24} stroke={2.2} />
          </Box>
          <Box>
            <Typography
              sx={{
                fontSize: { xs: 20, sm: 22 },
                fontWeight: 700,
                color: "#101828",
                letterSpacing: "-0.02em",
              }}
            >
              Follow-ups & AI Policy
            </Typography>
            <Typography sx={{ fontSize: 13.5, color: "#667085", mt: 0.25 }}>
              Configure lead assessment triggers, automated sequence timing, cadence schedules, and safety limits.
            </Typography>
          </Box>
        </Box>

        {/* Engine Status Card */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            px: 2,
            py: 1.25,
            borderRadius: "12px",
            backgroundColor: "#FFFFFF",
            border: "1px solid #E5E7EB",
            boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04), 0px 1px 2px rgba(16, 24, 40, 0.02)",
          }}
        >
          <Box
            sx={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              backgroundColor: isModeActive ? "#10B981" : "#6366F1",
              boxShadow: isModeActive
                ? "0 0 0 3px rgba(16, 185, 129, 0.2)"
                : "0 0 0 3px rgba(99, 102, 241, 0.2)",
            }}
          />
          <Box>
            <Typography
              sx={{
                fontSize: 10.5,
                fontWeight: 700,
                color: "#667085",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                lineHeight: 1,
              }}
            >
              Policy Engine
            </Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#101828", mt: 0.35, lineHeight: 1.2 }}>
              {isModeActive ? "Active Automation" : "Observe Only"} • v{baseline.version}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Informational Banners */}
      {!canEdit && (
        <Alert severity="info" sx={{ borderRadius: "12px", fontSize: 13.5, border: "1px solid #BAE6FD" }}>
          You have read-only access to this workspace. Only workspace Owners and Admins can modify follow-up policies.
        </Alert>
      )}

      {baseline.platform.observe_only_forced && (
        <Alert severity="warning" sx={{ borderRadius: "12px", fontSize: 13.5, border: "1px solid #FDE68A" }}>
          Observe-only mode is temporarily enforced across the platform. Automated follow-up actions and reminders will remain paused until lifted by platform operations.
        </Alert>
      )}

      {conflictError && (
        <Alert
          severity="error"
          sx={{ borderRadius: "12px", fontSize: 13.5, border: "1px solid #FCA5A5" }}
          action={
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button size="small" color="inherit" onClick={handleAcceptServerVersion} sx={{ textTransform: "none", fontWeight: 600 }}>
                Accept server version
              </Button>
              <Button size="small" variant="outlined" color="inherit" onClick={handleForceReapplyDraft} sx={{ textTransform: "none", fontWeight: 600 }}>
                Keep my changes
              </Button>
            </Box>
          }
        >
          {conflictError}
        </Alert>
      )}

      {/* CARD 1: Automation Engine Mode */}
      <Box sx={cardSx}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: "10px",
              backgroundColor: "#EEF2FF",
              color: "#4F46E5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconRocket size={20} stroke={2} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#101828" }}>
              Automation Engine Mode
            </Typography>
            <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
              Choose whether AI assesses customer correspondence silently or activates scheduled follow-up notifications.
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
          {/* Tile: Observe only */}
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
              borderRadius: "14px",
              cursor: canEdit ? "pointer" : "default",
              border: draft.mode === "shadow" ? "2px solid #4F46E5" : "1px solid #E5E7EB",
              backgroundColor: draft.mode === "shadow" ? "#F8FAFC" : "#FFFFFF",
              boxShadow: draft.mode === "shadow" ? "0px 4px 12px rgba(79, 70, 229, 0.08)" : "none",
              transition: "all 0.15s ease",
              outline: "none",
              "&:hover": canEdit ? { borderColor: draft.mode === "shadow" ? "#4F46E5" : "#CBD5E1" } : {},
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: "8px",
                    backgroundColor: draft.mode === "shadow" ? "#EEF2FF" : "#F3F4F6",
                    color: draft.mode === "shadow" ? "#4F46E5" : "#64748B",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <IconEye size={18} />
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#101828" }}>
                  Observe only
                </Typography>
              </Box>
              {draft.mode === "shadow" ? (
                <Chip
                  size="small"
                  icon={<IconCheck size={12} color="#4F46E5" />}
                  label="Selected"
                  sx={{
                    height: 24,
                    fontSize: 11.5,
                    fontWeight: 700,
                    backgroundColor: "#EEF2FF",
                    color: "#4F46E5",
                    border: "1px solid rgba(79, 70, 229, 0.2)",
                  }}
                />
              ) : (
                <Box
                  sx={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    border: "1.5px solid #D0D5DD",
                  }}
                />
              )}
            </Box>
            <Typography sx={{ fontSize: 13, color: "#667085", lineHeight: 1.55 }}>
              AI reads inbound emails and grades lead temperature and deal intent silently. Nothing is scheduled, no reminders go out, and customers are never contacted.
            </Typography>
          </Box>

          {/* Tile: Active automation */}
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
              borderRadius: "14px",
              cursor: canEdit ? "pointer" : "default",
              border: draft.mode === "active" ? "2px solid #4F46E5" : "1px solid #E5E7EB",
              backgroundColor: draft.mode === "active" ? "#F8FAFC" : "#FFFFFF",
              boxShadow: draft.mode === "active" ? "0px 4px 12px rgba(79, 70, 229, 0.08)" : "none",
              transition: "all 0.15s ease",
              outline: "none",
              "&:hover": canEdit ? { borderColor: draft.mode === "active" ? "#4F46E5" : "#CBD5E1" } : {},
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: "8px",
                    backgroundColor: draft.mode === "active" ? "#EEF2FF" : "#F3F4F6",
                    color: draft.mode === "active" ? "#4F46E5" : "#64748B",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <IconRocket size={18} />
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#101828" }}>
                  Active automation
                </Typography>
              </Box>
              {draft.mode === "active" ? (
                <Chip
                  size="small"
                  icon={<IconCheck size={12} color="#4F46E5" />}
                  label="Selected"
                  sx={{
                    height: 24,
                    fontSize: 11.5,
                    fontWeight: 700,
                    backgroundColor: "#EEF2FF",
                    color: "#4F46E5",
                    border: "1px solid rgba(79, 70, 229, 0.2)",
                  }}
                />
              ) : (
                <Box
                  sx={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    border: "1.5px solid #D0D5DD",
                  }}
                />
              )}
            </Box>
            <Typography sx={{ fontSize: 13, color: "#667085", lineHeight: 1.55 }}>
              Assessments dynamically schedule follow-up occurrences and notify team members before due dates. Customer sending requires workspace allowance and explicit per-thread consent.
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* CARD 2: Execution & Safety Allowances */}
      <Box sx={cardSx}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: "10px",
              backgroundColor: "#ECFDF5",
              color: "#059669",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconShieldCheck size={20} stroke={2} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#101828" }}>
              Execution & Safety Allowances
            </Typography>
            <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
              Govern autonomous actions and safety gates permitted for automated workflows.
            </Typography>
          </Box>
        </Box>

        {/* Row 1: Automatic assessment */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            py: 2,
            borderBottom: "1px solid #F1F5F9",
            gap: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: "10px",
                backgroundColor: "#F3E8FF",
                color: "#7E22CE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                mt: 0.25,
              }}
            >
              <IconBrain size={18} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
                Automatic lead assessment
              </Typography>
              <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25, maxWidth: 640 }}>
                Re-evaluates buying temperature, deal outcome, and next action upon receiving new customer emails.
              </Typography>
            </Box>
          </Box>
          <UntitledSwitch
            checked={draft.assessment_enabled}
            disabled={!canEdit}
            onChange={(e) => set("assessment_enabled", e.target.checked)}
            slotProps={{ input: { "aria-label": "Automatic lead assessment" } }}
          />
        </Box>

        {/* Row 2: Planning & reminders */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            py: 2,
            borderBottom: "1px solid #F1F5F9",
            gap: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: "10px",
                backgroundColor: "#FEF3C7",
                color: "#D97706",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                mt: 0.25,
              }}
            >
              <IconBell size={18} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
                Follow-up planning & team reminders
              </Typography>
              <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25, maxWidth: 640 }}>
                Calculates due dates and sends team notification emails when action is required on high-value conversations.
              </Typography>
            </Box>
          </Box>
          <UntitledSwitch
            checked={draft.planning_enabled}
            disabled={!canEdit}
            onChange={(e) => set("planning_enabled", e.target.checked)}
            slotProps={{ input: { "aria-label": "Follow-up planning & team reminders" } }}
          />
        </Box>

        {/* Row 3: Customer sending allowance */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            py: 2,
            gap: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: "10px",
                backgroundColor: "#FEE2E2",
                color: "#DC2626",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                mt: 0.25,
              }}
            >
              <IconMail size={18} />
            </Box>
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
                  Allow automatic customer follow-up emails
                </Typography>
                <Chip
                  size="small"
                  label={draft.customer_email_allowed ? "Armed" : "Disabled"}
                  sx={{
                    height: 20,
                    fontSize: 11,
                    fontWeight: 700,
                    backgroundColor: draft.customer_email_allowed ? "#ECFDF5" : "#F1F5F9",
                    color: draft.customer_email_allowed ? "#059669" : "#64748B",
                  }}
                />
              </Box>
              <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25, maxWidth: 640 }}>
                Allows teammates with send authority to toggle automated AI follow-up sending on specific customer threads.
              </Typography>
            </Box>
          </Box>
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

        {draft.customer_email_allowed && !baseline.platform.customer_send_enabled && (
          <Alert severity="info" sx={{ mt: 1.5, borderRadius: "10px", fontSize: 13, border: "1px solid #BAE6FD" }}>
            Customer sending is currently paused at the platform infrastructure level. Reminders will be generated, but external sends are held.
          </Alert>
        )}
      </Box>

      {/* CARD 3: Timing, Cadence & Working Schedule */}
      <Box sx={cardSx}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: "10px",
              backgroundColor: "#EFF6FF",
              color: "#2563EB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconClock size={20} stroke={2} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#101828" }}>
              Timing, Cadence & Working Schedule
            </Typography>
            <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
              Intervals and delivery hours applied when customer correspondence does not specify an explicit callback date.
            </Typography>
          </Box>
        </Box>

        {/* Cadence by temperature */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "260px 1fr", lg: "280px 1fr" },
            gap: 2,
            py: 2,
            borderBottom: "1px solid #F1F5F9",
            alignItems: "center",
          }}
        >
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
              Cadence by temperature
            </Typography>
            <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
              Business days to wait before following up based on AI lead classification.
            </Typography>
          </Box>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: { xs: 1, sm: 1.25, md: 1.5 },
              width: "100%",
              alignItems: "center",
            }}
          >
            {/* Hot */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: { xs: 0.5, sm: 1 },
                px: { xs: 1.25, sm: 1.5, md: 1.75 },
                py: 1,
                borderRadius: "12px",
                border: "1px solid #FECACA",
                backgroundColor: "#FEF2F2",
                minWidth: 0,
                boxShadow: "0px 1px 2px rgba(220, 38, 38, 0.05)",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexShrink: 0, minWidth: 0 }}>
                <IconFlame size={17} color="#DC2626" />
                <Typography
                  sx={{
                    fontSize: { xs: 11.5, sm: 12.5 },
                    fontWeight: 700,
                    color: "#DC2626",
                    letterSpacing: "0.02em",
                  }}
                >
                  HOT
                </Typography>
              </Box>
              <TextField
                type="number"
                size="small"
                value={draft.cadence_hot_days}
                disabled={!canEdit}
                onChange={(e) => set("cadence_hot_days", parseInt(e.target.value, 10) || 1)}
                slotProps={{
                  htmlInput: {
                    min: 1,
                    max: 999,
                    style: {
                      padding: "4px 4px 4px 10px",
                      textAlign: "left",
                      fontSize: "13.5px",
                      fontWeight: 700,
                    },
                  },
                  input: {
                    endAdornment: (
                      <Typography
                        sx={{
                          fontSize: { xs: 11, sm: 12 },
                          color: "#64748B",
                          ml: 0.5,
                          mr: 0.75,
                          userSelect: "none",
                          fontWeight: 500,
                        }}
                      >
                        days
                      </Typography>
                    ),
                  },
                }}
                sx={{
                  width: { xs: 78, sm: 90, md: 98, lg: 104 },
                  flexShrink: 0,
                  ...inputSx,
                  "& .MuiOutlinedInput-root": {
                    height: 34,
                    borderRadius: "8px",
                    backgroundColor: "#FFFFFF",
                    "& fieldset": { borderColor: "#FCA5A5" },
                    "&:hover fieldset": { borderColor: "#EF4444" },
                    "&.Mui-focused fieldset": { borderColor: "#DC2626", borderWidth: "1.5px" },
                  },
                }}
              />
            </Box>

            {/* Warm */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: { xs: 0.5, sm: 1 },
                px: { xs: 1.25, sm: 1.5, md: 1.75 },
                py: 1,
                borderRadius: "12px",
                border: "1px solid #FDE68A",
                backgroundColor: "#FFFBEB",
                minWidth: 0,
                boxShadow: "0px 1px 2px rgba(217, 119, 6, 0.05)",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexShrink: 0, minWidth: 0 }}>
                <IconClock size={17} color="#D97706" />
                <Typography
                  sx={{
                    fontSize: { xs: 11.5, sm: 12.5 },
                    fontWeight: 700,
                    color: "#D97706",
                    letterSpacing: "0.02em",
                  }}
                >
                  WARM
                </Typography>
              </Box>
              <TextField
                type="number"
                size="small"
                value={draft.cadence_warm_days}
                disabled={!canEdit}
                onChange={(e) => set("cadence_warm_days", parseInt(e.target.value, 10) || 1)}
                slotProps={{
                  htmlInput: {
                    min: 1,
                    max: 999,
                    style: {
                      padding: "4px 4px 4px 10px",
                      textAlign: "left",
                      fontSize: "13.5px",
                      fontWeight: 700,
                    },
                  },
                  input: {
                    endAdornment: (
                      <Typography
                        sx={{
                          fontSize: { xs: 11, sm: 12 },
                          color: "#64748B",
                          ml: 0.5,
                          mr: 0.75,
                          userSelect: "none",
                          fontWeight: 500,
                        }}
                      >
                        days
                      </Typography>
                    ),
                  },
                }}
                sx={{
                  width: { xs: 78, sm: 90, md: 98, lg: 104 },
                  flexShrink: 0,
                  ...inputSx,
                  "& .MuiOutlinedInput-root": {
                    height: 34,
                    borderRadius: "8px",
                    backgroundColor: "#FFFFFF",
                    "& fieldset": { borderColor: "#FCD34D" },
                    "&:hover fieldset": { borderColor: "#F59E0B" },
                    "&.Mui-focused fieldset": { borderColor: "#D97706", borderWidth: "1.5px" },
                  },
                }}
              />
            </Box>

            {/* Cold */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: { xs: 0.5, sm: 1 },
                px: { xs: 1.25, sm: 1.5, md: 1.75 },
                py: 1,
                borderRadius: "12px",
                border: "1px solid #BFDBFE",
                backgroundColor: "#EFF6FF",
                minWidth: 0,
                boxShadow: "0px 1px 2px rgba(37, 99, 235, 0.05)",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexShrink: 0, minWidth: 0 }}>
                <IconSnowflake size={17} color="#2563EB" />
                <Typography
                  sx={{
                    fontSize: { xs: 11.5, sm: 12.5 },
                    fontWeight: 700,
                    color: "#2563EB",
                    letterSpacing: "0.02em",
                  }}
                >
                  COLD
                </Typography>
              </Box>
              <TextField
                type="number"
                size="small"
                value={draft.cadence_cold_days}
                disabled={!canEdit}
                onChange={(e) => set("cadence_cold_days", parseInt(e.target.value, 10) || 1)}
                slotProps={{
                  htmlInput: {
                    min: 1,
                    max: 999,
                    style: {
                      padding: "4px 4px 4px 10px",
                      textAlign: "left",
                      fontSize: "13.5px",
                      fontWeight: 700,
                    },
                  },
                  input: {
                    endAdornment: (
                      <Typography
                        sx={{
                          fontSize: { xs: 11, sm: 12 },
                          color: "#64748B",
                          ml: 0.5,
                          mr: 0.75,
                          userSelect: "none",
                          fontWeight: 500,
                        }}
                      >
                        days
                      </Typography>
                    ),
                  },
                }}
                sx={{
                  width: { xs: 78, sm: 90, md: 98, lg: 104 },
                  flexShrink: 0,
                  ...inputSx,
                  "& .MuiOutlinedInput-root": {
                    height: 34,
                    borderRadius: "8px",
                    backgroundColor: "#FFFFFF",
                    "& fieldset": { borderColor: "#93C5FD" },
                    "&:hover fieldset": { borderColor: "#3B82F6" },
                    "&.Mui-focused fieldset": { borderColor: "#2563EB", borderWidth: "1.5px" },
                  },
                }}
              />
            </Box>
          </Box>
        </Box>

        {/* Working days */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "260px 1fr", lg: "280px 1fr" },
            gap: 2,
            py: 2,
            borderBottom: "1px solid #F1F5F9",
            alignItems: "center",
          }}
        >
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
              Active working days
            </Typography>
            <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
              Days of the week counted toward business day cadence intervals.
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            {WEEKDAYS.map((d, i) => {
              const selected = draft.workdays.includes(i);
              return (
                <Chip
                  key={d}
                  label={d}
                  clickable={canEdit}
                  disabled={!canEdit && !selected}
                  onClick={() => {
                    if (!canEdit) return;
                    set(
                      "workdays",
                      selected ? draft.workdays.filter((x) => x !== i) : [...draft.workdays, i].sort()
                    );
                  }}
                  sx={{
                    fontWeight: 700,
                    minWidth: 54,
                    height: 32,
                    borderRadius: "10px",
                    backgroundColor: selected ? "#4F46E5" : "#F8FAFC",
                    color: selected ? "#FFFFFF" : "#64748B",
                    border: selected ? "1px solid #4F46E5" : "1px solid #E2E8F0",
                    boxShadow: selected ? "0px 1px 3px rgba(79, 70, 229, 0.25)" : "none",
                    "&:hover": canEdit
                      ? {
                          backgroundColor: selected ? "#4338CA" : "#EEF2FF",
                          borderColor: selected ? "#4338CA" : "#C7D2FE",
                          color: selected ? "#FFFFFF" : "#4F46E5",
                        }
                      : {},
                  }}
                />
              );
            })}
          </Box>
        </Box>

        {/* Customer send window */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "260px 1fr", lg: "280px 1fr" },
            gap: 2,
            py: 2,
            borderBottom: "1px solid #F1F5F9",
            alignItems: "center",
          }}
        >
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
              Customer send window
            </Typography>
            <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
              Automatic customer emails are dispatched only within these local hours.
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
            <ModernClockTimePicker
              value={draft.send_window_start}
              disabled={!canEdit}
              onChange={(val) => set("send_window_start", val)}
              label="Send Window Start"
            />
            <Typography sx={{ color: "#64748B", fontSize: 13, fontWeight: 600 }}>to</Typography>
            <ModernClockTimePicker
              value={draft.send_window_end}
              disabled={!canEdit}
              onChange={(val) => set("send_window_end", val)}
              label="Send Window End"
            />
          </Box>
        </Box>

        {/* Default reminder time */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "260px 1fr", lg: "280px 1fr" },
            gap: 2,
            py: 2,
            borderBottom: "1px solid #F1F5F9",
            alignItems: "center",
          }}
        >
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
              Default reminder time
            </Typography>
            <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
              Target time applied when a follow-up specifies a date without an explicit hour.
            </Typography>
          </Box>
          <Box>
            <ModernClockTimePicker
              value={draft.default_local_time}
              disabled={!canEdit}
              onChange={(val) => set("default_local_time", val)}
              label="Default Reminder Time"
            />
          </Box>
        </Box>

        {/* Advance team notice */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "260px 1fr", lg: "280px 1fr" },
            gap: 2,
            py: 2,
            borderBottom: "1px solid #F1F5F9",
            alignItems: "center",
          }}
        >
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
              Advance team notice
            </Typography>
            <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
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
              sx={{ width: 160, ...inputSx }}
            />
          </Box>
        </Box>

        {/* Follow-up timezone */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "260px 1fr", lg: "280px 1fr" },
            gap: 2,
            py: 2,
            alignItems: "center",
          }}
        >
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
              Follow-up timezone
            </Typography>
            <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
              Current effective: <strong>{baseline.effective_timezone}</strong> (inherited from workspace unless overridden).
            </Typography>
          </Box>
          <Box>
            <Autocomplete
              size="small"
              options={zones}
              value={draft.timezone ?? null}
              disabled={!canEdit}
              onChange={(_, val) => set("timezone", val)}
              sx={{ maxWidth: 320, ...inputSx }}
              renderInput={(params) => (
                <TextField {...params} placeholder={`${baseline.effective_timezone} (workspace default)`} />
              )}
            />
          </Box>
        </Box>
      </Box>

      {/* CARD 4: Safety Limits & Anti-Spam Guardrails */}
      <Box sx={cardSx}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: "10px",
              backgroundColor: "#FFF7ED",
              color: "#EA580C",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconShieldLock size={20} stroke={2} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#101828" }}>
              Safety Limits & Anti-Spam Guardrails
            </Typography>
            <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
              Guardrails protecting recipient goodwill, spam reputation, and outbound volume.
            </Typography>
          </Box>
        </Box>

        {/* Max attempts */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "260px 1fr", lg: "280px 1fr" },
            gap: 2,
            py: 2,
            borderBottom: "1px solid #F1F5F9",
            alignItems: "center",
          }}
        >
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
              Maximum automated emails
            </Typography>
            <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
              Sequence limit per thread before pausing. Counter automatically resets if the customer writes back.
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
              sx={{ width: 150, ...inputSx }}
            />
          </Box>
        </Box>

        {/* Min spacing */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "260px 1fr", lg: "280px 1fr" },
            gap: 2,
            py: 2,
            alignItems: "center",
          }}
        >
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
              Minimum spacing between emails
            </Typography>
            <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
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
              sx={{ width: 150, ...inputSx }}
            />
          </Box>
        </Box>
      </Box>

      {/* Sticky Save / Discard Bar */}
      {canEdit && dirtyKeys.length > 0 && (
        <Paper
          elevation={6}
          sx={{
            position: "fixed",
            bottom: 24,
            left: { xs: 16, sm: "calc(50% - 280px)" },
            right: { xs: 16, sm: "auto" },
            width: { xs: "auto", sm: 560 },
            zIndex: 1000,
            borderRadius: "16px",
            px: 2.75,
            py: 1.75,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            border: "1px solid #E0E7FF",
            backgroundColor: "#FFFFFF",
            boxShadow: "0 20px 25px -5px rgba(16, 24, 40, 0.1), 0 8px 10px -6px rgba(16, 24, 40, 0.06)",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "#4F46E5",
                boxShadow: "0 0 0 3px rgba(79, 70, 229, 0.2)",
              }}
            />
            <Box sx={{ display: "flex", flexDirection: "column" }}>
              <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: "#101828" }}>
                {dirtyKeys.length} unsaved change{dirtyKeys.length === 1 ? "" : "s"}
              </Typography>
              {validationErrors.length > 0 && (
                <Typography sx={{ fontSize: 12, color: "#DC2626", fontWeight: 600 }}>
                  {validationErrors[0]}
                </Typography>
              )}
            </Box>
          </Box>

          <Box sx={{ display: "flex", gap: 1.25, alignItems: "center" }}>
            <Button
              onClick={handleDiscard}
              disabled={save.isPending}
              sx={{
                textTransform: "none",
                fontWeight: 600,
                fontSize: 13.5,
                color: "#475467",
                borderRadius: "10px",
                px: 2,
                "&:hover": { backgroundColor: "#F1F5F9", color: "#1E293B" },
              }}
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
                fontSize: 13.5,
                borderRadius: "10px",
                px: 2.5,
                py: 0.9,
                backgroundColor: "#4F46E5",
                "&:hover": { backgroundColor: "#4338CA" },
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
