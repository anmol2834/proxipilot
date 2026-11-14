"use client";

/** Shared building blocks for the AI Memory screens (consistent loading / error / empty states). */

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Skeleton from "@mui/material/Skeleton";
import Tooltip from "@mui/material/Tooltip";
import { errorMessage } from "@/hooks/useMemory";

export const C = {
  primary: "#2563EB",
  text: "#0F172A",
  muted: "#64748B",
  border: "#EEF2F6",
  soft: "#F8FAFC",
  danger: "#DC2626",
  warn: "#D97706",
  ok: "#059669",
};

export function Card({ title, subtitle, action, children, sx }: {
  title?: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; sx?: object;
}) {
  return (
    <Box sx={{ backgroundColor: "#FFFFFF", borderRadius: "14px", border: `1px solid ${C.border}`,
               boxShadow: "0 1px 3px rgba(0,0,0,0.02)", p: 2.5, ...sx }}>
      {(title || action) && (
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, mb: 2 }}>
          <Box sx={{ minWidth: 0 }}>
            {title && <Typography sx={{ fontWeight: 650, fontSize: 15, color: C.text }}>{title}</Typography>}
            {subtitle && <Typography sx={{ fontSize: 13, color: C.muted, mt: 0.25 }}>{subtitle}</Typography>}
          </Box>
          {action && <Box sx={{ flexShrink: 0, display: "flex", gap: 1 }}>{action}</Box>}
        </Box>
      )}
      {children}
    </Box>
  );
}

export function Stat({ label, value, hint, tone }: {
  label: string; value: React.ReactNode; hint?: string; tone?: "danger" | "warn" | "ok";
}) {
  const color = tone === "danger" ? C.danger : tone === "warn" ? C.warn : tone === "ok" ? C.ok : C.text;
  const body = (
    <Box sx={{ p: 2, borderRadius: "12px", border: `1px solid ${C.border}`, backgroundColor: "#FFFFFF", minWidth: 0 }}>
      <Typography sx={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>{label}</Typography>
      <Typography sx={{ fontSize: 24, fontWeight: 700, color, mt: 0.5, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
    </Box>
  );
  return hint ? <Tooltip title={hint} arrow>{body}</Tooltip> : body;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  active: { bg: "#ECFDF5", fg: "#047857" }, open: { bg: "#EFF6FF", fg: "#1D4ED8" },
  fulfilled: { bg: "#ECFDF5", fg: "#047857" }, answered: { bg: "#ECFDF5", fg: "#047857" },
  suggested: { bg: "#FFFBEB", fg: "#B45309" }, insufficient_data: { bg: "#FFFBEB", fg: "#B45309" },
  pending_review: { bg: "#FFFBEB", fg: "#B45309" }, overdue: { bg: "#FEF2F2", fg: "#B91C1C" },
  high: { bg: "#FEF2F2", fg: "#B91C1C" }, medium: { bg: "#FFFBEB", fg: "#B45309" }, low: { bg: "#F1F5F9", fg: "#475569" },
  cancelled: { bg: "#F1F5F9", fg: "#475569" }, disabled: { bg: "#F1F5F9", fg: "#475569" },
  superseded: { bg: "#F1F5F9", fg: "#475569" }, archived: { bg: "#F1F5F9", fg: "#475569" },
  human_rejected: { bg: "#FEF2F2", fg: "#B91C1C" }, human_approved: { bg: "#ECFDF5", fg: "#047857" },
  sent: { bg: "#ECFDF5", fg: "#047857" },
};

export function StatusChip({ value, label }: { value: string; label?: string }) {
  const c = STATUS_COLORS[value] ?? { bg: "#F1F5F9", fg: "#334155" };
  return (
    <Chip size="small" label={label ?? humanize(value)}
          sx={{ backgroundColor: c.bg, color: c.fg, fontWeight: 600, fontSize: 11.5, height: 22, borderRadius: "6px" }} />
  );
}

export function humanize(v: string | null | undefined): string {
  if (!v) return "—";
  const s = v.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, withTime
    ? { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "numeric", month: "short", year: "numeric" });
}

export function pct(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : `${Math.round(v * 100)}%`;
}

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} variant="rounded" height={44} sx={{ borderRadius: "10px" }} />
      ))}
    </Box>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <Box sx={{ p: 3, textAlign: "center", border: `1px dashed #FECACA`, borderRadius: "12px", backgroundColor: "#FEF2F2" }}>
      <Typography sx={{ color: C.danger, fontWeight: 600, fontSize: 14 }}>Couldn't load this</Typography>
      <Typography sx={{ color: C.muted, fontSize: 13, mt: 0.5 }}>{errorMessage(error)}</Typography>
      {onRetry && (
        <Button size="small" onClick={onRetry} sx={{ mt: 1.5, textTransform: "none" }}>Try again</Button>
      )}
    </Box>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <Box sx={{ p: 4, textAlign: "center", border: `1px dashed ${C.border}`, borderRadius: "12px", backgroundColor: C.soft }}>
      <Typography sx={{ color: C.text, fontWeight: 600, fontSize: 14 }}>{title}</Typography>
      {hint && <Typography sx={{ color: C.muted, fontSize: 13, mt: 0.5, maxWidth: 520, mx: "auto" }}>{hint}</Typography>}
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  );
}

export const btn = { textTransform: "none", fontWeight: 600, borderRadius: "10px" } as const;
