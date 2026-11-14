"use client";

import React, { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Pagination from "@mui/material/Pagination";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  useAddContactFact, useContact, useContacts, useRetractContactFact, useUpdateContact,
} from "@/hooks/useMemory";
import { ContactFactType, ContactSummary, ContactType } from "@/services/memory.service";
import { C, Card, EmptyState, ErrorState, LoadingRows, StatusChip, btn, formatDate, humanize } from "./ui";

const PAGE = 25;
const TYPES: ContactType[] = ["customer", "prospect", "supplier", "partner", "internal", "unknown"];
const FACT_TYPES: ContactFactType[] = ["preference", "interest", "need", "issue", "attribute", "note"];

function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function ContactsTab({ canEdit }: { canEdit: boolean }) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<ContactType | "">("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const debounced = useDebounced(search.trim());
  const list = useContacts({ search: debounced || undefined, type: type || undefined, limit: PAGE, offset: (page - 1) * PAGE });

  return (
    <Card title="Contacts & relationships"
          subtitle="Every customer, supplier and partner the business emails with — history, preferences and needs the AI uses to personalise replies.">
      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mb: 2 }}>
        <TextField size="small" placeholder="Search name, email or company…" value={search}
                   onChange={(e) => { setSearch(e.target.value); setPage(1); }} sx={{ minWidth: 280 }} slotProps={{ htmlInput: { maxLength: 200 } }} />
        <TextField select size="small" label="Type" value={type} sx={{ minWidth: 160 }}
                   onChange={(e) => { setType(e.target.value as ContactType | ""); setPage(1); }}>
          <MenuItem value="">All types</MenuItem>
          {TYPES.map((t) => <MenuItem key={t} value={t}>{humanize(t)}</MenuItem>)}
        </TextField>
      </Box>
      {list.isLoading ? <LoadingRows rows={6} /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} />
        : !list.data?.items.length ? (
          <EmptyState title={debounced || type ? "No contacts match" : "No contacts yet"}
                      hint="Contacts are created automatically as emails are synced. Automated senders (no-reply, notifications) are ignored." />
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {list.data.items.map((c) => <ContactRow key={c.id} c={c} onOpen={() => setOpenId(c.id)} />)}
            {list.data.total > PAGE && (
              <Pagination sx={{ mt: 1, alignSelf: "center" }} size="small" count={Math.ceil(list.data.total / PAGE)}
                          page={page} onChange={(_, p) => setPage(p)} />
            )}
          </Box>
        )}
      <ContactDrawer id={openId} onClose={() => setOpenId(null)} canEdit={canEdit} />
    </Card>
  );
}

function ContactRow({ c, onOpen }: { c: ContactSummary; onOpen: () => void }) {
  return (
    <Box onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => (e.key === "Enter" ? onOpen() : null)}
         sx={{ display: "flex", alignItems: "center", gap: 2, p: 1.5, borderRadius: "10px", border: `1px solid ${C.border}`,
               cursor: "pointer", "&:hover": { backgroundColor: C.soft }, "&:focus-visible": { outline: `2px solid ${C.primary}` } }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: C.text }} noWrap>
          {c.display_name || c.email}{c.company_name ? ` · ${c.company_name}` : ""}
        </Typography>
        <Typography sx={{ fontSize: 12, color: C.muted }} noWrap>
          {c.email} · {c.inbound_count + c.outbound_count} emails · last {formatDate(c.last_interaction_at)}
        </Typography>
      </Box>
      {c.is_blocked && <StatusChip value="overdue" label="Blocked" />}
      <StatusChip value={c.contact_type === "unknown" ? "low" : "active"} label={humanize(c.contact_type)} />
    </Box>
  );
}

function ContactDrawer({ id, onClose, canEdit }: { id: string | null; onClose: () => void; canEdit: boolean }) {
  const q = useContact(id);
  const update = useUpdateContact();
  const addFact = useAddContactFact();
  const retract = useRetractContactFact();
  const [factType, setFactType] = useState<ContactFactType>("preference");
  const [factKey, setFactKey] = useState("");
  const [factValue, setFactValue] = useState("");
  const p = q.data;

  const save = (body: Parameters<typeof update.mutate>[0]["body"]) => id && update.mutate({ id, body });
  const add = () => {
    if (!id || !factKey.trim() || !factValue.trim()) return;
    addFact.mutate({ id, body: { fact_type: factType, key: factKey.trim(), value: factValue.trim() } },
                   { onSuccess: () => { setFactKey(""); setFactValue(""); } });
  };

  return (
    <Drawer anchor="right" open={Boolean(id)} onClose={onClose} slotProps={{ paper: { sx: { width: { xs: "100%", sm: 480 }, p: 3 } } }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 17 }}>Contact memory</Typography>
        <IconButton onClick={onClose} aria-label="Close">✕</IconButton>
      </Box>
      {q.isLoading ? <LoadingRows rows={6} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : p && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
          <Box>
            <Typography sx={{ fontSize: 16, fontWeight: 650 }}>{p.display_name || p.email}</Typography>
            <Typography sx={{ fontSize: 13, color: C.muted }}>{p.email}</Typography>
            <Typography sx={{ fontSize: 12, color: C.muted, mt: 0.5 }}>
              {p.stats.inbound_count + p.stats.outbound_count} emails in {p.stats.thread_count} conversation(s) ·
              since {formatDate(p.stats.first_interaction_at)} · last {formatDate(p.stats.last_interaction_at)}
            </Typography>
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
            <TextField select size="small" label="Relationship" value={p.contact_type} disabled={!canEdit || update.isPending}
                       onChange={(e) => save({ contact_type: e.target.value as ContactType })}>
              {TYPES.map((t) => <MenuItem key={t} value={t}>{humanize(t)}</MenuItem>)}
            </TextField>
            <BlurField label="Company" value={p.company_name} disabled={!canEdit} onCommit={(v) => save({ company_name: v })} />
            <BlurField label="Job title" value={p.job_title} disabled={!canEdit} onCommit={(v) => save({ job_title: v })} />
            <BlurField label="Preferred language" value={p.preferred_language} disabled={!canEdit}
                       onCommit={(v) => save({ preferred_language: v })} />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 650, mb: 1 }}>What the AI knows</Typography>
            {FACT_TYPES.every((t) => !p.facts[t]?.length) ? (
              <Typography sx={{ fontSize: 13, color: C.muted }}>Nothing recorded yet.</Typography>
            ) : FACT_TYPES.filter((t) => p.facts[t]?.length).map((t) => (
              <Box key={t} sx={{ mb: 1.5 }}>
                <Typography sx={{ fontSize: 11.5, color: C.muted, fontWeight: 600, textTransform: "uppercase", mb: 0.5 }}>
                  {humanize(t)}
                </Typography>
                {p.facts[t]!.map((f) => (
                  <Box key={f.id} sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.5 }}>
                    <Typography sx={{ fontSize: 13, flex: 1, wordBreak: "break-word" }}>
                      <b>{humanize(f.key)}:</b> {f.value}
                      <Box component="span" sx={{ color: C.muted, fontSize: 11.5 }}>
                        {" "}· {f.source_type === "employee" ? "set by team" : f.source_type === "email" ? "from email" : "AI inferred"}
                        {f.occurrences && f.occurrences > 1 ? ` ×${f.occurrences}` : ""}
                      </Box>
                    </Typography>
                    {canEdit && (
                      <Button size="small" color="inherit" disabled={retract.isPending}
                              onClick={() => id && retract.mutate({ id, factId: f.id })} sx={{ ...btn, minWidth: 0 }}>Remove</Button>
                    )}
                  </Box>
                ))}
              </Box>
            ))}
          </Box>

          {canEdit && (
            <Box sx={{ p: 2, borderRadius: "12px", backgroundColor: C.soft, display: "flex", flexDirection: "column", gap: 1.25 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 650 }}>Add to memory</Typography>
              <TextField select size="small" label="Kind" value={factType} onChange={(e) => setFactType(e.target.value as ContactFactType)}>
                {FACT_TYPES.map((t) => <MenuItem key={t} value={t}>{humanize(t)}</MenuItem>)}
              </TextField>
              <TextField size="small" label="What (e.g. payment terms)" value={factKey} onChange={(e) => setFactKey(e.target.value)}
                         slotProps={{ htmlInput: { maxLength: 128 } }} />
              <TextField size="small" label="Value (e.g. 30 days credit)" value={factValue} onChange={(e) => setFactValue(e.target.value)}
                         slotProps={{ htmlInput: { maxLength: 4000 } }} multiline maxRows={4} />
              <Button variant="contained" onClick={add} disabled={!factKey.trim() || !factValue.trim() || addFact.isPending}
                      sx={{ ...btn, alignSelf: "flex-start" }}>{addFact.isPending ? "Saving…" : "Save"}</Button>
              <Typography sx={{ fontSize: 11.5, color: C.muted }}>
                Team-entered facts have the highest authority — the AI can never overwrite them.
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Drawer>
  );
}

/** Text field that saves on blur / Enter, only when the value actually changed. */
function BlurField({ label, value, disabled, onCommit }: {
  label: string; value: string | null; disabled?: boolean; onCommit: (v: string | null) => void;
}) {
  const [v, setV] = useState(value ?? "");
  useEffect(() => setV(value ?? ""), [value]);
  const commit = () => { const next = v.trim() || null; if (next !== (value ?? null)) onCommit(next); };
  return (
    <TextField size="small" label={label} value={v} disabled={disabled} onChange={(e) => setV(e.target.value)}
               onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
               slotProps={{ htmlInput: { maxLength: 255 } }} />
  );
}
