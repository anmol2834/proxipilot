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
import Typography from "@mui/material/Typography";
import { useDrafts, useFeedbackMetrics, useLessons, useReviewDraft, useSaveLesson } from "@/hooks/useMemory";
import { DraftItem, FEEDBACK_REASONS, FeedbackReason } from "@/services/memory.service";
import { C, Card, EmptyState, ErrorState, LoadingRows, Stat, StatusChip, btn, formatDate, humanize, pct } from "./ui";

export function FeedbackTab({ canEdit }: { canEdit: boolean }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <MetricsRow />
      <ReviewQueue canEdit={canEdit} />
      <LessonsCard canEdit={canEdit} />
    </Box>
  );
}

function MetricsRow() {
  const q = useFeedbackMetrics(30);
  const m = q.data;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const topReason = m && Object.entries(m.rejection_reasons).sort((a, b) => b[1] - a[1])[0];
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 170px), 1fr))", gap: 1.5 }}>
      <Stat label="Drafts reviewed (30d)" value={m?.drafts_reviewed ?? "…"} />
      <Stat label="Approved as-is" value={m ? pct(m.approval_rate) : "…"} tone="ok" />
      <Stat label="Edited" value={m ? pct(m.edit_rate) : "…"} />
      <Stat label="Rejected / replaced" value={m ? pct(m.rejection_rate) : "…"}
            tone={m && (m.rejection_rate ?? 0) > 0.3 ? "warn" : undefined}
            hint={topReason ? `Top reason: ${humanize(topReason[0])} (${topReason[1]})` : undefined} />
      <Stat label="Positive customer replies" value={m ? `${pct(m.positive_outcome_rate.ai)} AI · ${pct(m.positive_outcome_rate.human)} team` : "…"}
            hint="Share of customer replies classified positive after an AI vs. a team-written reply" />
    </Box>
  );
}

function ReviewQueue({ canEdit }: { canEdit: boolean }) {
  const q = useDrafts("pending_review");
  const [reviewing, setReviewing] = useState<DraftItem | null>(null);
  return (
    <Card title="Drafts waiting for review"
          subtitle="Approve, edit or reject AI drafts. Every decision teaches the AI — recording a review does not send the email.">
      {q.isLoading ? <LoadingRows /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} />
        : !q.data?.items.length ? <EmptyState title="Nothing to review" hint="Drafts the AI wasn't confident enough to send appear here." />
        : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {q.data.items.map((d) => (
              <Box key={d.id} sx={{ p: 1.5, borderRadius: "10px", border: `1px solid ${C.border}`, display: "flex", gap: 2 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: "flex", gap: 0.75, mb: 0.5 }}>
                    <StatusChip value={d.approval_status} />
                    {d.has_policy_violations && <StatusChip value="high" label="Policy check failed" />}
                  </Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 600 }} noWrap>{d.subject || "(no subject)"}</Typography>
                  <Typography sx={{ fontSize: 13, color: C.muted, display: "-webkit-box", WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical", overflow: "hidden" }}>{d.body}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: C.muted, mt: 0.25 }}>{formatDate(d.created_at, true)}</Typography>
                </Box>
                {canEdit && <Button size="small" variant="outlined" sx={{ ...btn, alignSelf: "center" }} onClick={() => setReviewing(d)}>Review</Button>}
              </Box>
            ))}
          </Box>
        )}
      {reviewing && <ReviewDialog draft={reviewing} onClose={() => setReviewing(null)} />}
    </Card>
  );
}

function ReviewDialog({ draft, onClose }: { draft: DraftItem; onClose: () => void }) {
  const review = useReviewDraft();
  const [mode, setMode] = useState<"view" | "edit" | "reject">("view");
  const [text, setText] = useState(draft.body ?? "");
  const [reason, setReason] = useState<FeedbackReason | "">("");
  const [comment, setComment] = useState("");
  const done = { onSuccess: onClose };
  const rejectInvalid = !reason && !comment.trim();
  const editInvalid = !text.trim();

  return (
    <Dialog open onClose={review.isPending ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 650 }}>{draft.subject || "Review draft"}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {mode === "edit" ? (
          <TextField multiline minRows={10} value={text} onChange={(e) => setText(e.target.value)} slotProps={{ htmlInput: { maxLength: 20000 } }}
                     error={editInvalid} helperText={editInvalid ? "The reply can't be empty" : "Your edits teach the AI how your team writes"} />
        ) : (
          <Box component="pre" sx={{ m: 0, p: 2, borderRadius: "10px", backgroundColor: C.soft, whiteSpace: "pre-wrap",
                                      fontFamily: "inherit", fontSize: 13.5, maxHeight: 360, overflow: "auto" }}>{draft.body}</Box>
        )}
        {mode === "reject" && (
          <>
            <TextField select size="small" label="What was wrong?" value={reason} onChange={(e) => setReason(e.target.value as FeedbackReason)}>
              {FEEDBACK_REASONS.map((r) => <MenuItem key={r} value={r}>{humanize(r)}</MenuItem>)}
            </TextField>
            <TextField size="small" label="Comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)}
                       slotProps={{ htmlInput: { maxLength: 2000 } }} />
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={review.isPending} sx={btn}>Close</Button>
        {mode === "view" && (
          <>
            <Button color="error" onClick={() => setMode("reject")} sx={btn}>Reject</Button>
            <Button variant="outlined" onClick={() => setMode("edit")} sx={btn}>Edit</Button>
            <Button variant="contained" disabled={review.isPending} sx={btn}
                    onClick={() => review.mutate({ id: draft.id, body: { action: "approved" } }, done)}>Approve</Button>
          </>
        )}
        {mode === "edit" && (
          <Button variant="contained" disabled={review.isPending || editInvalid} sx={btn}
                  onClick={() => review.mutate({ id: draft.id, body: { action: "edited", final_text: text.trim() } }, done)}>
            {review.isPending ? "Saving…" : "Save edits & approve"}
          </Button>
        )}
        {mode === "reject" && (
          <Button variant="contained" color="error" disabled={review.isPending || rejectInvalid} sx={btn}
                  onClick={() => review.mutate({ id: draft.id, body: { action: "rejected", reason_code: reason || undefined,
                                                                         comment: comment.trim() || undefined } }, done)}>
            {review.isPending ? "Saving…" : "Reject draft"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function LessonsCard({ canEdit }: { canEdit: boolean }) {
  const q = useLessons();
  const save = useSaveLesson();
  const [text, setText] = useState("");
  const add = () => {
    if (text.trim().length < 5) return;
    save.mutate({ body: { instruction: text.trim(), priority: 60 } }, { onSuccess: () => setText("") });
  };
  return (
    <Card title="Drafting lessons"
          subtitle="Rules every AI draft follows — learned from repeated review patterns, or written by your team.">
      {q.isLoading ? <LoadingRows rows={3} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {!q.data?.length && <Typography sx={{ fontSize: 13, color: C.muted }}>No lessons yet — they appear as your team reviews drafts.</Typography>}
          {q.data?.map((l) => (
            <Box key={l.id} sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 0.75, borderBottom: `1px solid ${C.border}`,
                                  opacity: l.status === "active" ? 1 : 0.55 }}>
              <StatusChip value={l.status} />
              <Typography sx={{ fontSize: 13, flex: 1 }}>{l.instruction}</Typography>
              <Typography sx={{ fontSize: 11.5, color: C.muted }}>
                {l.origin === "derived" ? `learned from ${l.evidence_count} reviews` : "set by team"}
              </Typography>
              {canEdit && (
                <Button size="small" color="inherit" sx={btn} disabled={save.isPending}
                        onClick={() => save.mutate({ id: l.id, body: { status: l.status === "active" ? "disabled" : "active" } })}>
                  {l.status === "active" ? "Disable" : "Enable"}
                </Button>
              )}
            </Box>
          ))}
          {canEdit && (
            <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
              <TextField size="small" fullWidth placeholder="e.g. Always mention that GST is extra" value={text}
                         onChange={(e) => setText(e.target.value)} slotProps={{ htmlInput: { maxLength: 500 } }}
                         onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
              <Button variant="contained" sx={btn} disabled={text.trim().length < 5 || save.isPending} onClick={add}>Add</Button>
            </Box>
          )}
        </Box>
      )}
    </Card>
  );
}
