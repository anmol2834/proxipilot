"use client";

/**
 * Leads & follow-ups workspace. Server-side filters, counts, search, sort and pagination; a row opens the
 * full follow-up panel in a drawer so the team can act without leaving the queue.
 */

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Tab from "@mui/material/Tab";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { IconAlertTriangle, IconExternalLink, IconEye, IconRefresh, IconSearch, IconX } from "@tabler/icons-react";
import { followupError, useLeads } from "@/hooks/useFollowups";
import { FollowUpPanel } from "@/components/followups/FollowUpPanel";
import { ACTOR, FU, STATUS, TEMPERATURE, inZone, relative } from "@/components/followups/meta";
import type { LeadFilter, LeadItem, LeadSort } from "@/types/followup.types";

const FILTERS: { key: LeadFilter; label: string }[] = [
  { key: "active", label: "All active" },
  { key: "due", label: "Due now" },
  { key: "needs_review", label: "Needs review" },
  { key: "scheduled", label: "Scheduled" },
  { key: "waiting_team", label: "Team owes reply" },
  { key: "open_unconfirmed", label: "Open · unconfirmed" },
  { key: "deferred", label: "Deferred" },
  { key: "closed", label: "Closed" },
];

const EMPTY: Record<LeadFilter, string> = {
  active: "No active follow-ups. New business emails are assessed automatically.",
  due: "Nothing is due right now.",
  needs_review: "Nothing needs a decision right now.",
  scheduled: "No follow-ups scheduled.",
  waiting_team: "Your team doesn't owe any replies.",
  open_unconfirmed: "No open opportunities awaiting confirmation.",
  deferred: "No deferred conversations.",
  closed: "No closed conversations yet.",
};

function Kpi({ label, value, tone, hint, onClick, active }: {
  label: string; value: number | undefined; tone?: string; hint: string; onClick: () => void; active: boolean;
}) {
  return (
    <Tooltip title={hint} arrow>
      <Paper variant="outlined" onClick={onClick} role="button" tabIndex={0}
             onKeyDown={(e) => (e.key === "Enter" ? onClick() : undefined)}
             sx={{ px: 1.75, py: 1.25, borderRadius: "12px", cursor: "pointer", borderColor: active ? FU.primary : "#EEF2F6",
                   backgroundColor: active ? "#F5F9FF" : "#FFFFFF", transition: "all 120ms ease",
                   "&:hover": { borderColor: "#BFDBFE" } }}>
        <Typography sx={{ fontSize: 12, color: FU.muted, fontWeight: 600 }}>{label}</Typography>
        <Typography sx={{ fontSize: 22, fontWeight: 700, color: tone ?? FU.text, fontVariantNumeric: "tabular-nums", mt: 0.25 }}>
          {value ?? <Skeleton width={28} />}
        </Typography>
      </Paper>
    </Tooltip>
  );
}

export function LeadsWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const initialFilter = (FILTERS.find((f) => f.key === params.get("filter"))?.key ?? "active") as LeadFilter;
  const [filter, setFilter] = useState<LeadFilter>(initialFilter);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [temperature, setTemperature] = useState<string>("");
  const [sort, setSort] = useState<LeadSort>("due");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [openThread, setOpenThread] = useState<LeadItem | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setQ(search.trim()); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const leads = useLeads(filter, page + 1, temperature || null, q, sort, pageSize);
  const data = leads.data;
  const tz = data?.timezone ?? "UTC";

  const choose = (f: LeadFilter) => {
    setFilter(f);
    setPage(0);
    const sp = new URLSearchParams(params.toString());
    if (f === "active") sp.delete("filter"); else sp.set("filter", f);
    router.replace(`${pathname}${sp.toString() ? `?${sp}` : ""}`, { scroll: false });
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.25, pb: 6 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
        <Box>
          <Typography component="h1" sx={{ fontSize: 22, fontWeight: 700, color: FU.text }}>Leads & follow-ups</Typography>
          <Typography sx={{ fontSize: 14, color: FU.muted, mt: 0.5, maxWidth: 760 }}>
            Every new business email is assessed by AI. See who is interested, who owes the next step and what is due —
            and act on it here.
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          {data?.mode === "shadow" && <Chip icon={<IconEye size={14} />} label="Observe-only" size="small"
                                            sx={{ fontWeight: 700, color: "#6D28D9", backgroundColor: "#F5F3FF" }} />}
          <Tooltip title="Refresh">
            <IconButton onClick={() => leads.refetch()} aria-label="Refresh leads"><IconRefresh size={18} /></IconButton>
          </Tooltip>
        </Box>
      </Box>

      {data?.mode === "shadow" && (
        <Alert severity="info" icon={<IconEye size={18} />} sx={{ borderRadius: "12px" }}
               action={<Button component={Link} href="/dashboard/settings" size="small" sx={{ textTransform: "none", fontWeight: 700 }}>Open settings</Button>}>
          This workspace is observing: AI assessments are recorded on each conversation, but nothing is scheduled and no
          reminders are sent until follow-ups are activated in Settings.
        </Alert>
      )}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", lg: "repeat(5, 1fr)" }, gap: 1.25 }}>
        <Kpi label="Due now" value={data?.counts.due} tone={data?.counts.due ? FU.danger : undefined}
             hint="Follow-ups whose time has arrived" onClick={() => choose("due")} active={filter === "due"} />
        <Kpi label="Due by end of today" value={data?.kpis.due_today} hint="Including anything overdue"
             onClick={() => choose("due")} active={false} />
        <Kpi label="Needs review" value={data?.counts.needs_review} tone={data?.counts.needs_review ? FU.warn : undefined}
             hint="Unclear dates, scope or identity" onClick={() => choose("needs_review")} active={filter === "needs_review"} />
        <Kpi label="Team owes reply" value={data?.counts.waiting_team} hint="Your team owes the next step"
             onClick={() => choose("waiting_team")} active={filter === "waiting_team"} />
        <Kpi label="Hot leads" value={data?.kpis.hot} tone="#DC2626" hint="Active conversations marked Hot"
             onClick={() => { setTemperature("hot"); choose("active"); }} active={temperature === "hot"} />
      </Box>

      <Paper variant="outlined" sx={{ borderRadius: "14px", borderColor: "#EEF2F6", overflow: "hidden" }}>
        <Tabs value={filter} onChange={(_, v) => choose(v)} variant="scrollable" scrollButtons="auto"
              sx={{ px: 1, borderBottom: "1px solid #EEF2F6", minHeight: 44,
                    "& .MuiTab-root": { textTransform: "none", fontWeight: 600, minHeight: 44, fontSize: 13.5 } }}>
          {FILTERS.map((f) => (
            <Tab key={f.key} value={f.key} label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                {f.label}
                <Box component="span" sx={{ fontSize: 11.5, fontWeight: 700, px: 0.75, borderRadius: "6px",
                                            backgroundColor: filter === f.key ? "#DBEAFE" : "#F1F5F9",
                                            color: filter === f.key ? "#1D4ED8" : FU.muted }}>
                  {data?.counts?.[f.key] ?? "·"}
                </Box>
              </Box>} />
          ))}
        </Tabs>

        <Box sx={{ display: "flex", gap: 1.25, p: 1.5, flexWrap: "wrap", alignItems: "center" }}>
          <TextField size="small" placeholder="Search subject or customer" value={search} onChange={(e) => setSearch(e.target.value)}
                     sx={{ flex: 1, minWidth: 220 }}
                     slotProps={{ input: {
                       startAdornment: <InputAdornment position="start"><IconSearch size={16} /></InputAdornment>,
                       endAdornment: search ? <IconButton size="small" onClick={() => setSearch("")} aria-label="Clear search"><IconX size={14} /></IconButton> : null,
                     } }} />
          <TextField select size="small" label="Temperature" value={temperature} sx={{ width: 160 }}
                     onChange={(e) => { setTemperature(e.target.value); setPage(0); }}>
            <MenuItem value="">Any</MenuItem>
            {(["hot", "warm", "cold", "unknown"] as const).map((t) => <MenuItem key={t} value={t}>{TEMPERATURE[t].label}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Sort by" value={sort} sx={{ width: 170 }}
                     onChange={(e) => { setSort(e.target.value as LeadSort); setPage(0); }}>
            <MenuItem value="due">Due date</MenuItem>
            <MenuItem value="recent">Latest message</MenuItem>
            <MenuItem value="temperature">Temperature</MenuItem>
          </TextField>
        </Box>

        {leads.isError ? (
          <Box sx={{ p: 3 }}>
            <Alert severity="error" action={<Button size="small" onClick={() => leads.refetch()}>Retry</Button>}>
              {followupError(leads.error)}
            </Alert>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small" sx={{ "& td, & th": { borderColor: "#F1F5F9" } }}>
              <TableHead>
                <TableRow sx={{ "& th": { fontSize: 12, fontWeight: 700, color: FU.muted, backgroundColor: FU.soft, py: 1.25 } }}>
                  <TableCell>Conversation</TableCell>
                  <TableCell>Temperature</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Next step</TableCell>
                  <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Owner</TableCell>
                  <TableCell>Due</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {leads.isLoading && Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={6}><Skeleton height={34} /></TableCell></TableRow>
                ))}
                {data && data.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ py: 6, textAlign: "center" }}>
                      <Typography sx={{ fontWeight: 600, color: FU.text, fontSize: 14 }}>{q ? "No matches" : EMPTY[filter]}</Typography>
                      {q && <Typography sx={{ color: FU.muted, fontSize: 13 }}>Try a different name or subject.</Typography>}
                    </TableCell>
                  </TableRow>
                )}
                {data?.items.map((it) => {
                  const t = TEMPERATURE[it.temperature ?? "unknown"] ?? TEMPERATURE.unknown;
                  const s = STATUS[it.status] ?? STATUS.none;
                  const due = relative(it.due_at);
                  return (
                    <TableRow key={it.thread_id} hover onClick={() => setOpenThread(it)} sx={{ cursor: "pointer" }}
                              selected={openThread?.thread_id === it.thread_id}>
                      <TableCell sx={{ maxWidth: 320 }}>
                        <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: FU.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {it.subject || "(no subject)"}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: FU.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {it.sender_name || it.sender_email}
                        </Typography>
                        {it.needs_review && it.review_reason && (
                          <Typography sx={{ fontSize: 11.5, color: FU.warn, display: "flex", gap: 0.5, alignItems: "center" }}>
                            <IconAlertTriangle size={12} /> {it.review_reason.replace(/_/g, " ").slice(0, 80)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={t.label} sx={{ height: 22, fontWeight: 700, fontSize: 11.5, color: t.fg, backgroundColor: t.bg, borderRadius: "6px" }} />
                        {it.temperature_source && it.temperature_source !== "ai" && (
                          <Typography sx={{ fontSize: 11, color: FU.faint }}>{it.temperature_source === "manual" ? "set by team" : "earlier label"}</Typography>
                        )}
                        {it.stale && <Typography sx={{ fontSize: 11, color: "#6D28D9" }}>reading new message…</Typography>}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={s.label} sx={{ height: 22, fontWeight: 700, fontSize: 11.5, color: s.fg, backgroundColor: s.bg, borderRadius: "6px" }} />
                      </TableCell>
                      <TableCell sx={{ display: { xs: "none", md: "table-cell" }, maxWidth: 320, fontSize: 13, color: FU.body }}>
                        <Box sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {it.next_action || "—"}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ display: { xs: "none", sm: "table-cell" }, fontSize: 13 }}>{it.next_actor ? ACTOR[it.next_actor] ?? it.next_actor : "—"}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {it.due_at ? (
                          <>
                            <Typography sx={{ fontSize: 13, color: FU.text }}>{inZone(it.due_at, tz)}</Typography>
                            {due && <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: due.overdue ? FU.danger : FU.primary }}>{due.text}</Typography>}
                          </>
                        ) : <Typography sx={{ fontSize: 13, color: FU.faint }}>—</Typography>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        <TablePagination component="div" count={data?.total ?? 0} page={page} rowsPerPage={pageSize}
                         onPageChange={(_, p) => setPage(p)} rowsPerPageOptions={[10, 25, 50, 100]}
                         onRowsPerPageChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }} />
      </Paper>

      <Drawer anchor="right" open={Boolean(openThread)} onClose={() => setOpenThread(null)}
              slotProps={{ paper: { sx: { width: { xs: "100%", sm: 540 }, p: 2.5, backgroundColor: FU.soft } } }}>
        {openThread && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 16, fontWeight: 700, color: FU.text }}>{openThread.subject || "(no subject)"}</Typography>
                <Typography sx={{ fontSize: 13, color: FU.muted }}>{openThread.sender_name || ""} {openThread.sender_email ? `<${openThread.sender_email}>` : ""}</Typography>
              </Box>
              <IconButton onClick={() => setOpenThread(null)} aria-label="Close"><IconX size={18} /></IconButton>
            </Box>
            <Button component={Link} href={`/dashboard/inbox?conversation=${encodeURIComponent(openThread.thread_id)}`}
                    variant="outlined" startIcon={<IconExternalLink size={16} />}
                    sx={{ textTransform: "none", fontWeight: 600, borderRadius: "9px", alignSelf: "flex-start" }}>
              Open conversation
            </Button>
            <FollowUpPanel threadId={openThread.thread_id} />
          </Box>
        )}
      </Drawer>
    </Box>
  );
}
