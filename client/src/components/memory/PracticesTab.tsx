"use client";

import React, { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  useMinePractices, usePracticeInsights, usePractices, useSavePractice, useTestPractices,
} from "@/hooks/useMemory";
import { PRACTICE_SITUATIONS, Practice, PracticeInput, PracticeSituation } from "@/services/memory.service";
import { C, Card, EmptyState, ErrorState, LoadingRows, StatusChip, btn, humanize } from "./ui";

export function PracticesTab({ canEdit }: { canEdit: boolean }) {
  const list = usePractices({ status: "all" });
  const save = useSavePractice();
  const mine = useMinePractices();
  const [editing, setEditing] = useState<Practice | "new" | null>(null);
  const items = list.data ?? [];
  const suggested = items.filter((p) => p.status === "suggested");
  const live = items.filter((p) => p.status !== "suggested");

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {suggested.length > 0 && (
        <Card title={`Needs your approval (${suggested.length})`}
              subtitle="Learned from your team's real emails and decisions. They do nothing until you approve them.">
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {suggested.map((p) => (
              <PracticeRow key={p.id} p={p} canEdit={canEdit} busy={save.isPending} onEdit={() => setEditing(p)}
                           actions={canEdit && (
                             <>
                               <Button size="small" variant="contained" sx={btn} disabled={save.isPending}
                                       onClick={() => save.mutate({ id: p.id, body: { status: "active" } })}>Approve</Button>
                               <Button size="small" color="inherit" sx={btn} disabled={save.isPending}
                                       onClick={() => save.mutate({ id: p.id, body: { status: "archived" } })}>Dismiss</Button>
                             </>
                           )} />
            ))}
          </Box>
        </Card>
      )}

      <Card title="How your business operates"
            subtitle="Workflows, negotiation limits, approvals and complaint handling. Matching practices guide every AI reply; ones that need approval send the reply to human review."
            action={canEdit && (
              <>
                <Button variant="outlined" sx={btn} disabled={mine.isPending} onClick={() => mine.mutate(undefined)}>
                  {mine.isPending ? "Learning…" : "Learn from history"}
                </Button>
                <Button variant="contained" sx={btn} onClick={() => setEditing("new")}>Add practice</Button>
              </>
            )}>
        {list.isLoading ? <LoadingRows /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} />
          : !live.length ? (
            <EmptyState title="No practices yet"
                        hint="Add rules like “Discounts above 5% need Sales Head approval” or “Ask for photos before replacing damaged goods”." />
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {live.map((p) => (
                <PracticeRow key={p.id} p={p} canEdit={canEdit} busy={save.isPending} onEdit={() => setEditing(p)}
                             actions={canEdit && p.status !== "archived" && (
                               <Button size="small" color="inherit" sx={btn} disabled={save.isPending}
                                       onClick={() => save.mutate({ id: p.id, body: { status: p.status === "active" ? "disabled" : "active" } })}>
                                 {p.status === "active" ? "Disable" : "Enable"}
                               </Button>
                             )} />
              ))}
            </Box>
          )}
      </Card>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: 2 }}>
        <PracticeTester />
        <InsightsCard />
      </Box>
      {editing && <PracticeDialog practice={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Box>
  );
}

function PracticeRow({ p, actions, onEdit, canEdit }: {
  p: Practice; actions?: React.ReactNode; onEdit: () => void; canEdit: boolean; busy: boolean;
}) {
  return (
    <Box sx={{ p: 1.5, borderRadius: "10px", border: `1px solid ${C.border}`, opacity: p.status === "active" || p.status === "suggested" ? 1 : 0.6 }}>
      <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mb: 0.5 }}>
            <StatusChip value={p.status} />
            <StatusChip value="low" label={humanize(p.situation)} />
            {p.requires_approval && <StatusChip value="medium" label={`Needs approval${p.approver ? ` · ${p.approver}` : ""}`} />}
            {p.escalate_to_human && <StatusChip value="medium" label="Always human" />}
            {p.origin === "learned" && <StatusChip value="low" label={`Learned · ${Math.round(p.confidence * 100)}%`} />}
          </Box>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: C.text }}>{p.title}</Typography>
          <Typography sx={{ fontSize: 13, color: C.muted, mt: 0.25, wordBreak: "break-word" }}>{p.description}</Typography>
          {p.rules.length > 0 && (
            <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
              {p.rules.map((r, i) => <li key={i}><Typography sx={{ fontSize: 13 }}>{r}</Typography></li>)}
            </Box>
          )}
          {p.evidence?.summary && (
            <Typography sx={{ fontSize: 12, color: C.muted, mt: 0.5 }}>Evidence: {p.evidence.summary}</Typography>
          )}
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexShrink: 0 }}>
          {canEdit && <Button size="small" sx={btn} onClick={onEdit}>Edit</Button>}
          {actions}
        </Box>
      </Box>
    </Box>
  );
}

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

function PracticeDialog({ practice, onClose }: { practice: Practice | null; onClose: () => void }) {
  const save = useSavePractice();
  const [title, setTitle] = useState(practice?.title ?? "");
  const [situation, setSituation] = useState<PracticeSituation>(practice?.situation ?? "general");
  const [keywords, setKeywords] = useState((practice?.trigger_keywords ?? []).join(", "));
  const [description, setDescription] = useState(practice?.description ?? "");
  const [rules, setRules] = useState((practice?.rules ?? []).join("\n"));
  const [exceptions, setExceptions] = useState(practice?.exceptions ?? "");
  const [requiresApproval, setRequiresApproval] = useState(practice?.requires_approval ?? false);
  const [approver, setApprover] = useState(practice?.approver ?? "");
  const [escalate, setEscalate] = useState(practice?.escalate_to_human ?? false);
  const valid = title.trim().length >= 5 && description.trim().length >= 10;

  const submit = () => {
    if (!valid || save.isPending) return;
    const body: PracticeInput = {
      title: title.trim(), situation, description: description.trim(), rules: lines(rules),
      trigger_keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
      exceptions: exceptions.trim() || null, requires_approval: requiresApproval,
      approver: requiresApproval ? approver.trim() || null : null, escalate_to_human: escalate,
      priority: practice?.priority ?? 60,
    };
    save.mutate({ id: practice?.id, body }, { onSuccess: onClose });
  };

  return (
    <Dialog open onClose={save.isPending ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 650 }}>{practice ? "Edit practice" : "Add a practice"}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
        <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} size="small" slotProps={{ htmlInput: { maxLength: 200 } }}
                   error={title.length > 0 && title.trim().length < 5} helperText="e.g. Discount requests" />
        <TextField select label="Situation" size="small" value={situation} onChange={(e) => setSituation(e.target.value as PracticeSituation)}>
          {PRACTICE_SITUATIONS.map((s) => <MenuItem key={s} value={s}>{humanize(s)}</MenuItem>)}
        </TextField>
        <TextField label="Trigger words (comma separated)" size="small" value={keywords} onChange={(e) => setKeywords(e.target.value)}
                   helperText="Customer words that make this practice apply, e.g. discount, best price" />
        <TextField label="How the team handles it" value={description} onChange={(e) => setDescription(e.target.value)}
                   multiline minRows={2} slotProps={{ htmlInput: { maxLength: 3000 } }} error={description.length > 0 && description.trim().length < 10} />
        <TextField label="Rules (one per line)" value={rules} onChange={(e) => setRules(e.target.value)} multiline minRows={2} />
        <TextField label="Exceptions (optional)" value={exceptions} onChange={(e) => setExceptions(e.target.value)} size="small"
                   slotProps={{ htmlInput: { maxLength: 1000 } }} />
        <FormControlLabel control={<Checkbox checked={requiresApproval} onChange={(e) => setRequiresApproval(e.target.checked)} />}
                          label="Needs internal approval (the AI will not promise it, and the reply goes to review)" />
        {requiresApproval && (
          <TextField label="Approver" size="small" value={approver} onChange={(e) => setApprover(e.target.value)} slotProps={{ htmlInput: { maxLength: 255 } }} />
        )}
        <FormControlLabel control={<Checkbox checked={escalate} onChange={(e) => setEscalate(e.target.checked)} />}
                          label="Always handled by a person (never auto-sent)" />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={save.isPending} sx={btn}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={!valid || save.isPending} sx={btn}>
          {save.isPending ? "Saving…" : practice?.status === "suggested" ? "Save" : "Save & publish"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function PracticeTester() {
  const test = useTestPractices();
  const [text, setText] = useState("");
  const r = test.data;
  return (
    <Card title="Try a customer message" subtitle="See which practices would apply and whether the reply would be sent for human review.">
      <TextField fullWidth multiline minRows={3} placeholder="e.g. Can you give us your best price for 300 units?"
                 value={text} onChange={(e) => setText(e.target.value)} slotProps={{ htmlInput: { maxLength: 5000 } }} />
      <Button variant="outlined" sx={{ ...btn, mt: 1.5 }} disabled={text.trim().length < 3 || test.isPending}
              onClick={() => test.mutate(text.trim())}>{test.isPending ? "Checking…" : "Check"}</Button>
      {r && (
        <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 1 }}>
          <Typography sx={{ fontSize: 13 }}>
            Situations: <b>{r.situations.length ? r.situations.map(humanize).join(", ") : "none detected"}</b>
          </Typography>
          <Box>
            {r.escalate_to_human_review
              ? <StatusChip value="high" label="Would go to human review" />
              : <StatusChip value="active" label="Can be auto-sent (if evidence allows)" />}
          </Box>
          {r.escalation_reason && <Typography sx={{ fontSize: 12.5, color: C.muted }}>{r.escalation_reason}</Typography>}
          {r.drafter_context ? (
            <Box component="pre" sx={{ m: 0, p: 1.5, borderRadius: "10px", backgroundColor: C.soft, fontSize: 12, whiteSpace: "pre-wrap",
                                        fontFamily: "inherit" }}>{r.drafter_context}</Box>
          ) : <Typography sx={{ fontSize: 12.5, color: C.muted }}>No practice applies to this message.</Typography>}
        </Box>
      )}
    </Card>
  );
}

function InsightsCard() {
  const q = usePracticeInsights();
  return (
    <Card title="How it actually goes" subtitle="Last 90 days, from decision & commitment memory.">
      {q.isLoading ? <LoadingRows rows={3} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} />
        : !q.data?.commitment_turnaround.length && !q.data?.approvals.length ? (
          <EmptyState title="No data yet" hint="Turnaround and approval numbers appear once promises and decisions are tracked." />
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {q.data!.commitment_turnaround.map((t) => (
              <Typography key={`${t.category}-${t.owed_by}`} sx={{ fontSize: 13 }}>
                <b>{humanize(t.category)}</b> ({t.owed_by === "company" ? "we owe" : t.owed_by}): {t.fulfilled}/{t.total} done
                {t.median_hours_to_fulfil !== null ? ` · typical ${t.median_hours_to_fulfil}h` : ""}
                {t.on_time_pct !== null ? ` · ${t.on_time_pct}% on time` : ""}
                {t.overdue ? ` · ${t.overdue} overdue` : ""}
              </Typography>
            ))}
            {q.data!.approvals.map((a) => (
              <Typography key={`${a.approver}-${a.category}`} sx={{ fontSize: 13, color: C.muted }}>
                {a.approver} approved {a.decisions} {humanize(a.category).toLowerCase()} decision(s)
              </Typography>
            ))}
          </Box>
        )}
    </Card>
  );
}
