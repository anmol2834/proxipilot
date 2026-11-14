"use client";

import React, { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import Pagination from "@mui/material/Pagination";
import {
  useCommitmentSummary, useCommitments, useCreateCommitment, useUpdateCommitment,
} from "@/hooks/useMemory";
import {
  COMMITMENT_CATEGORIES, Commitment, CommitmentCategory, CommitmentKind, CommitmentParty,
} from "@/services/memory.service";
import { C, Card, EmptyState, ErrorState, LoadingRows, Stat, StatusChip, btn, formatDate, humanize } from "./ui";

const PAGE = 20;
const KIND_LABEL: Record<CommitmentKind, string> = { commitment: "Promise", decision: "Decision", action_item: "Action item" };
const PARTY_LABEL: Record<CommitmentParty, string> = { company: "We owe", customer: "Customer owes", internal: "Internal" };

type View = "open" | "overdue" | "fulfilled" | "all";

/** Local date-time input value -> ISO string WITH the browser's offset (server rejects naive times). */
export function localInputToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const hh = String(Math.floor(Math.abs(off) / 60)).padStart(2, "0");
  const mm = String(Math.abs(off) % 60).padStart(2, "0");
  return `${v.length === 16 ? `${v}:00` : v}${sign}${hh}:${mm}`;
}

export function CommitmentsTab({ canEdit }: { canEdit: boolean }) {
  const [view, setView] = useState<View>("open");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const summary = useCommitmentSummary();
  const filters = {
    status: view === "fulfilled" ? "fulfilled" as const : view === "all" ? "all" as const : "open" as const,
    overdue: view === "overdue" ? true : undefined,
    q: q.trim() || undefined, limit: PAGE, offset: (page - 1) * PAGE,
  };
  const list = useCommitments(filters);
  const update = useUpdateCommitment();
  const s = summary.data;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 150px), 1fr))", gap: 1.5 }}>
        <Stat label="Open" value={s?.open ?? "…"} />
        <Stat label="Overdue" value={s?.overdue ?? "…"} tone={s && s.overdue > 0 ? "danger" : undefined}
              hint="Open items past their deadline" />
        <Stat label="Due in 48h" value={s?.due_48h ?? "…"} tone={s && s.due_48h > 0 ? "warn" : undefined} />
        <Stat label="We owe customers" value={s?.we_owe ?? "…"} />
        <Stat label="Decisions in force" value={s?.decisions_in_force ?? "…"} />
      </Box>

      <Card
        title="Decisions, promises & pending actions"
        subtitle="Captured automatically from emails (ours and customers'), or added by your team. The AI stays consistent with these in every reply."
        action={canEdit && <Button variant="contained" onClick={() => setCreating(true)} sx={btn}>Add</Button>}
      >
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mb: 2, alignItems: "center" }}>
          <ToggleButtonGroup size="small" exclusive value={view}
                             onChange={(_, v) => { if (v) { setView(v); setPage(1); } }}>
            {(["open", "overdue", "fulfilled", "all"] as View[]).map((v) => (
              <ToggleButton key={v} value={v} sx={{ textTransform: "none", px: 1.5 }}>{humanize(v)}</ToggleButton>
            ))}
          </ToggleButtonGroup>
          <TextField size="small" placeholder="Search…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }}
                     sx={{ minWidth: 220 }} slotProps={{ htmlInput: { maxLength: 200 } }} />
        </Box>

        {list.isLoading ? <LoadingRows /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} />
          : !list.data?.items.length ? (
            <EmptyState title={view === "overdue" ? "Nothing is overdue" : "Nothing here yet"}
                        hint="Promises like “we'll send the quote by Friday” and decisions like “5% discount approved” appear here as emails arrive." />
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {list.data.items.map((c) => (
                <CommitmentRow key={c.id} c={c} canEdit={canEdit} busy={update.isPending}
                               onSet={(status) => update.mutate({ id: c.id, body: { status } })} />
              ))}
              {list.data.total > PAGE && (
                <Pagination sx={{ mt: 1, alignSelf: "center" }} count={Math.ceil(list.data.total / PAGE)} page={page}
                            onChange={(_, p) => setPage(p)} size="small" />
              )}
            </Box>
          )}
      </Card>
      {creating && <CreateCommitmentDialog onClose={() => setCreating(false)} />}
    </Box>
  );
}

function CommitmentRow({ c, canEdit, busy, onSet }: {
  c: Commitment; canEdit: boolean; busy: boolean; onSet: (s: "open" | "fulfilled" | "cancelled") => void;
}) {
  return (
    <Box sx={{ display: "flex", gap: 2, alignItems: "center", p: 1.5, borderRadius: "10px", border: `1px solid ${C.border}`,
               backgroundColor: c.is_overdue ? "#FFFBFB" : "#FFFFFF" }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mb: 0.5 }}>
          <StatusChip value={c.kind === "decision" ? "active" : "open"} label={KIND_LABEL[c.kind]} />
          {c.kind !== "decision" && <StatusChip value="low" label={PARTY_LABEL[c.owed_by]} />}
          <StatusChip value={c.is_overdue ? "overdue" : c.status} label={c.is_overdue ? "Overdue" : undefined} />
          <StatusChip value="low" label={humanize(c.category)} />
        </Box>
        <Typography sx={{ fontSize: 14, color: C.text, fontWeight: 550, wordBreak: "break-word" }}>{c.statement}</Typography>
        <Typography sx={{ fontSize: 12, color: C.muted, mt: 0.25 }}>
          {c.due_at ? `Due ${formatDate(c.due_at, true)}${c.due_text ? ` (“${c.due_text}”)` : ""} · ` : ""}
          {c.approved_by ? `Approved by ${c.approved_by} · ` : ""}
          {c.owner_email ? `Owner ${c.owner_email} · ` : ""}
          {c.source_type === "employee" ? "Added by team" : "From email"}
          {c.resolution_note ? ` · ${c.resolution_note}` : ""}
        </Typography>
      </Box>
      {canEdit && c.status !== "superseded" && (
        <Box sx={{ display: "flex", gap: 1, flexShrink: 0 }}>
          {c.status === "open" ? (
            <>
              <Button size="small" variant="outlined" disabled={busy} onClick={() => onSet("fulfilled")} sx={btn}>
                {c.kind === "decision" ? "Close" : "Done"}
              </Button>
              <Button size="small" color="inherit" disabled={busy} onClick={() => onSet("cancelled")} sx={btn}>Cancel</Button>
            </>
          ) : (
            <Button size="small" disabled={busy} onClick={() => onSet("open")} sx={btn}>Reopen</Button>
          )}
        </Box>
      )}
    </Box>
  );
}

function CreateCommitmentDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateCommitment();
  const [kind, setKind] = useState<CommitmentKind>("commitment");
  const [owedBy, setOwedBy] = useState<CommitmentParty>("company");
  const [category, setCategory] = useState<CommitmentCategory>("other");
  const [statement, setStatement] = useState("");
  const [due, setDue] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const tooShort = statement.trim().length < 8;

  const submit = () => {
    if (tooShort || create.isPending) return;
    create.mutate({
      kind, owed_by: kind === "decision" ? "internal" : owedBy, category, statement: statement.trim(),
      due_at: localInputToIso(due), approved_by: kind === "decision" ? approvedBy.trim() || null : null,
    }, { onSuccess: onClose });
  };

  return (
    <Dialog open onClose={create.isPending ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 650 }}>Record a decision, promise or action</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
        <TextField select label="Type" value={kind} onChange={(e) => setKind(e.target.value as CommitmentKind)} size="small">
          {Object.entries(KIND_LABEL).map(([k, l]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}
        </TextField>
        {kind !== "decision" && (
          <TextField select label="Who owes it" value={owedBy} onChange={(e) => setOwedBy(e.target.value as CommitmentParty)} size="small">
            {Object.entries(PARTY_LABEL).map(([k, l]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}
          </TextField>
        )}
        <TextField select label="Category" value={category} onChange={(e) => setCategory(e.target.value as CommitmentCategory)} size="small">
          {COMMITMENT_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{humanize(c)}</MenuItem>)}
        </TextField>
        <TextField label={kind === "decision" ? "What was decided" : "What was promised"} value={statement} multiline minRows={2}
                   onChange={(e) => setStatement(e.target.value)} slotProps={{ htmlInput: { maxLength: 300 } }}
                   error={statement.length > 0 && tooShort} helperText={statement.length > 0 && tooShort ? "At least 8 characters" : `${statement.length}/300`} />
        {kind === "decision" ? (
          <TextField label="Approved by" value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} size="small"
                     slotProps={{ htmlInput: { maxLength: 255 } }} />
        ) : (
          <TextField label="Deadline (optional)" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)}
                     size="small" slotProps={{ inputLabel: { shrink: true } }} />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={create.isPending} sx={btn}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={tooShort || create.isPending} sx={btn}>
          {create.isPending ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
