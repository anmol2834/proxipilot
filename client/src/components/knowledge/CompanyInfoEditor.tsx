"use client";

/**
 * Company Info — one structured editor for the facts customers ask about by email.
 *
 * Shared facts (company name, website, industry, description, industries served, offerings,
 * customer types) are owned by the organization / business profile entered at signup: editing them
 * here updates those owners, so signup data and Company Info never diverge. Everything else is owned
 * by Company Info. "What the AI can share" previews exactly what the email AI is given.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Skeleton from "@mui/material/Skeleton";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { knowledgeService } from "@/services/knowledge.service";
import { toast } from "@/stores/notification.store";
import { useKnowledgeStore } from "@/stores/knowledge.store";
import type {
  Branch,
  CompanyFacts,
  CompanyInfoSaveRequest,
  CompanyInfoState,
  ContactRoute,
  EnquiryLink,
  HoursEntry,
  NotApplicableSection,
  ServiceMode,
  SharedFactKey,
} from "@/types/company-info.types";

const C = { text: "#0F172A", muted: "#64748B", faint: "#94A3B8", border: "#E8EDF3", primary: "#2563EB" };

const PURPOSES: [ContactRoute["purpose"], string][] = [
  ["general", "General enquiries"], ["sales", "Sales"], ["support", "Support"], ["booking", "Bookings"],
  ["billing", "Billing & invoices"], ["other", "Other"],
];
const CHANNELS: [ContactRoute["channel"], string][] = [
  ["email", "Email"], ["phone", "Phone"], ["whatsapp", "WhatsApp"], ["form", "Contact form"], ["link", "Link"],
];
const KINDS: [Branch["kind"], string][] = [
  ["office", "Office"], ["store", "Store"], ["warehouse", "Warehouse"], ["service_center", "Service centre"],
  ["factory", "Factory"], ["other", "Other"],
];
const VISITS: [Branch["visit_policy"], string][] = [
  ["unknown", "Not specified"], ["walk_in", "Walk-ins welcome"], ["appointment_only", "By appointment only"],
  ["no_visits", "No walk-ins / not open to visitors"],
];
const MODES: [ServiceMode, string][] = [
  ["online", "Online"], ["in_person", "In person"], ["on_site", "On site"], ["hybrid", "Hybrid"],
];
const ENQUIRY: [EnquiryLink["kind"], string][] = [
  ["booking", "Book an appointment"], ["demo", "Book a demo"], ["quote", "Request a quote"], ["other", "Other"],
];
const SHARED_LABEL: Record<SharedFactKey, string> = {
  company_name: "Company name", website: "Website", industry: "Industry", description: "About the company",
  industries_served: "Industries you serve", offerings_summary: "What you offer (overview)",
  customer_types: "Customers you serve",
};

type Draft = {
  shared: Record<SharedFactKey, string | string[]>;
  share: Record<SharedFactKey, boolean>;
  facts: CompanyFacts;
};

const SHARED_KEYS = Object.keys(SHARED_LABEL) as SharedFactKey[];

function toDraft(s: CompanyInfoState): Draft {
  const shared = {} as Draft["shared"];
  const share = {} as Draft["share"];
  for (const k of SHARED_KEYS) {
    const f = s.shared[k];
    shared[k] = k === "customer_types" ? [...((f.value as string[] | null) ?? [])] : ((f.value as string | null) ?? "");
    share[k] = f.shared;
  }
  return { shared, share, facts: JSON.parse(JSON.stringify(s.facts)) as CompanyFacts };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const blankToNull = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

function buildPayload(base: Draft, draft: Draft, revision: number, canShared: boolean, canFacts: boolean): CompanyInfoSaveRequest | null {
  const body: CompanyInfoSaveRequest = { revision };
  if (canShared) {
    const shared: CompanyInfoSaveRequest["shared"] = {};
    for (const k of SHARED_KEYS) if (!same(base.shared[k], draft.shared[k])) shared[k] = draft.shared[k];
    if (Object.keys(shared).length) body.shared = shared;
  }
  if (canFacts) {
    const share: CompanyInfoSaveRequest["share"] = {};
    for (const k of SHARED_KEYS) if (base.share[k] !== draft.share[k]) share[k] = draft.share[k];
    if (Object.keys(share).length) body.share = share;
    const facts: Partial<CompanyFacts> = {};
    for (const k of Object.keys(draft.facts) as (keyof CompanyFacts)[]) {
      if (!same(base.facts[k], draft.facts[k])) (facts as Record<string, unknown>)[k] = draft.facts[k];
    }
    if (Object.keys(facts).length) body.facts = facts;
  }
  return body.shared || body.share || body.facts ? body : null;
}

// ---------------------------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------------------------

function Section({ title, hint, children, action }: { title: string; hint?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Box component="section" sx={{ border: `1px solid ${C.border}`, borderRadius: "14px", backgroundColor: "#fff", p: { xs: 2, md: 2.5 } }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, mb: 1.75 }}>
        <Box>
          <Typography sx={{ fontSize: "0.98rem", fontWeight: 800, color: C.text }}>{title}</Typography>
          {hint && <Typography sx={{ fontSize: "0.78rem", color: C.muted, mt: 0.25 }}>{hint}</Typography>}
        </Box>
        {action}
      </Box>
      {children}
    </Box>
  );
}

function ChipsInput({ value, onChange, placeholder, disabled, label }: {
  value: string[]; onChange: (v: string[]) => void; placeholder: string; disabled?: boolean; label: string;
}) {
  const [text, setText] = useState("");
  const add = () => {
    const parts = text.split(",").map((t) => t.trim()).filter(Boolean);
    if (parts.length) onChange([...value, ...parts.filter((p) => !value.some((v) => v.toLowerCase() === p.toLowerCase()))]);
    setText("");
  };
  return (
    <Box>
      <Typography sx={labelSx}>{label}</Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: value.length ? 1 : 0 }}>
        {value.map((v) => (
          <Chip key={v} label={v} size="small" onDelete={disabled ? undefined : () => onChange(value.filter((x) => x !== v))}
                sx={{ borderRadius: "8px", fontWeight: 600 }} />
        ))}
      </Box>
      {!disabled && (
        <TextField size="small" fullWidth value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)}
                   onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
                   onBlur={add} sx={fieldSx} />
      )}
    </Box>
  );
}

const labelSx = { fontSize: "0.78rem", fontWeight: 700, color: C.text, mb: 0.5 } as const;
const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: "10px", backgroundColor: "#fff" } } as const;

function Field({ label, value, onChange, disabled, multiline, placeholder, helper, type }: {
  label: string; value: string | number | null | undefined; onChange: (v: string) => void; disabled?: boolean;
  multiline?: boolean; placeholder?: string; helper?: string; type?: string;
}) {
  return (
    <Box>
      <Typography sx={labelSx}>{label}</Typography>
      <TextField size="small" fullWidth value={value ?? ""} onChange={(e) => onChange(e.target.value)} disabled={disabled}
                 multiline={multiline} minRows={multiline ? 2 : undefined} placeholder={placeholder} type={type}
                 helperText={helper} sx={fieldSx} />
    </Box>
  );
}

function SelectField<T extends string>({ label, value, options, onChange, disabled }: {
  label: string; value: T; options: [T, string][]; onChange: (v: T) => void; disabled?: boolean;
}) {
  return (
    <Box>
      <Typography sx={labelSx}>{label}</Typography>
      <TextField select size="small" fullWidth value={value} onChange={(e) => onChange(e.target.value as T)} disabled={disabled} sx={fieldSx}
                 slotProps={{ select: { displayEmpty: true } }}>
        {options.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
      </TextField>
    </Box>
  );
}

function RemoveButton({ onClick, disabled, label }: { onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <Tooltip title={label}>
      <span>
        <IconButton size="small" onClick={onClick} disabled={disabled} aria-label={label} sx={{ color: C.faint, "&:hover": { color: "#DC2626" } }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
        </IconButton>
      </span>
    </Tooltip>
  );
}

function AddButton({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <Button size="small" onClick={onClick} disabled={disabled} sx={{ textTransform: "none", fontWeight: 700, borderRadius: "9px" }}
            startIcon={<span style={{ fontSize: 16, lineHeight: 1 }}>+</span>}>
      {children}
    </Button>
  );
}

function NotApplicableToggle({ section, facts, setFacts, label, disabled }: {
  section: NotApplicableSection; facts: CompanyFacts; setFacts: (f: Partial<CompanyFacts>) => void; label: string; disabled?: boolean;
}) {
  const on = facts.not_applicable.includes(section);
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      <Switch size="small" checked={on} disabled={disabled}
              onChange={(e) => setFacts({ not_applicable: e.target.checked ? [...facts.not_applicable, section] : facts.not_applicable.filter((s) => s !== section) })} />
      <Typography sx={{ fontSize: "0.76rem", color: C.muted, fontWeight: 600 }}>{label}</Typography>
    </Box>
  );
}

function StatusPill({ state }: { state: CompanyInfoState["index"]["state"] }) {
  const meta = {
    ready: { label: "Ready for AI", color: "#047857", bg: "#ECFDF5", tip: "The email AI and search use the saved revision." },
    indexing: { label: "Saved · Indexing", color: "#1D4ED8", bg: "#EFF6FF", tip: "Saved. Replies already use these facts from the database while search catches up." },
    delayed: { label: "Indexing delayed", color: "#B45309", bg: "#FFFBEB", tip: "Saved. Search indexing is retrying automatically; replies use the saved facts meanwhile." },
    not_published: { label: "Not published", color: C.muted, bg: "#F1F5F9", tip: "Nothing has been shared with the AI yet." },
  }[state];
  return (
    <Tooltip title={meta.tip} arrow>
      <Box component="span" role="status" sx={{ fontSize: "0.74rem", fontWeight: 800, color: meta.color, backgroundColor: meta.bg, px: 1.1, py: 0.4, borderRadius: "999px", whiteSpace: "nowrap" }}>
        {meta.label}
      </Box>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------------------------

export function CompanyInfoEditor() {
  const fetchCategoryCounts = useKnowledgeStore((s) => s.fetchCategoryCounts);
  const [server, setServer] = useState<CompanyInfoState | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<CompanyInfoState | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const base = useMemo(() => (server ? toDraft(server) : null), [server]);
  const dirty = !!(base && draft && !same(base, draft));
  const canShared = !!server?.permissions.edit_shared_facts;
  const canFacts = !!server?.permissions.edit_company_facts;

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const s = await knowledgeService.getCompanyInfo();
      setServer(s);
      setDraft(toDraft(s));
    } catch (e) {
      setLoadError((e as Error)?.message || "Company Info could not be loaded.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // While the saved revision is indexing, refresh only its status (never the user's draft).
  useEffect(() => {
    if (pollRef.current) clearTimeout(pollRef.current);
    if (server?.index.state !== "indexing") return;
    pollRef.current = setTimeout(async () => {
      try {
        const s = await knowledgeService.getCompanyInfo();
        setServer((prev) => (prev && prev.revision === s.revision ? { ...prev, index: s.index } : prev));
      } catch { /* next poll */ }
    }, 4000);
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [server]);

  // Leaving with unsaved edits asks first.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const setFacts = (patch: Partial<CompanyFacts>) => setDraft((d) => (d ? { ...d, facts: { ...d.facts, ...patch } } : d));
  const setShared = (k: SharedFactKey, v: string | string[]) => setDraft((d) => (d ? { ...d, shared: { ...d.shared, [k]: v } } : d));
  const setShare = (k: SharedFactKey, v: boolean) => setDraft((d) => (d ? { ...d, share: { ...d.share, [k]: v } } : d));

  const save = async () => {
    if (!server || !draft || !base) return;
    const body = buildPayload(base, draft, server.revision, canShared, canFacts);
    if (!body) return;
    setSaving(true);
    setSaveError(null);
    try {
      const next = await knowledgeService.saveCompanyInfo(body);
      setServer(next);
      setDraft(toDraft(next));
      setConflict(null);
      void fetchCategoryCounts();
      toast.success(next.saved ? "Company Info saved" : "No changes to save");
    } catch (e) {
      const err = e as { statusCode?: number; message?: string };
      if (err?.statusCode === 409) {
        // Someone else saved first: keep the user's draft, load the latest for review.
        try { setConflict(await knowledgeService.getCompanyInfo()); } catch { /* banner still explains */ }
        setSaveError("Someone else changed Company Info while you were editing. Your edits are kept — review and save again.");
      } else {
        setSaveError(err?.message || "Couldn't save. Your edits are kept — try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const reapplyOnLatest = () => {
    if (!conflict || !draft || !base) return;
    // Rebase: start from the latest values and re-apply only the fields this user changed.
    const latest = toDraft(conflict);
    const merged: Draft = JSON.parse(JSON.stringify(latest));
    for (const k of SHARED_KEYS) {
      if (!same(base.shared[k], draft.shared[k])) merged.shared[k] = draft.shared[k];
      if (base.share[k] !== draft.share[k]) merged.share[k] = draft.share[k];
    }
    for (const k of Object.keys(draft.facts) as (keyof CompanyFacts)[]) {
      if (!same(base.facts[k], draft.facts[k])) (merged.facts as unknown as Record<string, unknown>)[k] = draft.facts[k];
    }
    setServer(conflict);
    setDraft(merged);
    setConflict(null);
    setSaveError(null);
  };

  if (loadError) {
    return (
      <Alert severity="error" action={<Button onClick={() => void load()} sx={{ textTransform: "none" }}>Try again</Button>}>
        {loadError}
      </Alert>
    );
  }
  if (!server || !draft) {
    return (
      <Box sx={{ display: "grid", gap: 2 }}>
        {[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={140} sx={{ borderRadius: "14px" }} />)}
      </Box>
    );
  }

  const f = draft.facts;
  const branchOptions: [string, string][] = [["", "Whole company"], ...f.branches.filter((b) => b.id).map((b) => [b.id as string, b.name] as [string, string])];
  const readOnlyAll = !canFacts && !canShared;

  const sharedRow = (k: SharedFactKey, multiline = false) => {
    const fact = server.shared[k];
    const owner = fact.owner === "organization" ? "Organization" : "Business profile";
    return (
      <Box key={k}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 0.25, minHeight: 28 }}>
          <Typography noWrap sx={{ ...labelSx, mb: 0, minWidth: 0 }}>{SHARED_LABEL[k]}</Typography>
          <Tooltip title={draft.share[k] ? "The email AI can use this in replies" : "Hidden from customer replies"}>
            <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
              <Typography noWrap sx={{ fontSize: "0.68rem", color: draft.share[k] ? "#047857" : C.faint, fontWeight: 700 }}>
                {draft.share[k] ? "AI can share" : "Hidden"}
              </Typography>
              <Switch size="small" checked={draft.share[k]} disabled={!canFacts} onChange={(e) => setShare(k, e.target.checked)}
                      slotProps={{ input: { "aria-label": `Let the AI share ${SHARED_LABEL[k]}` } }} />
            </Box>
          </Tooltip>
        </Box>
        {k === "customer_types" ? (
          <ChipsInput label="" value={draft.shared.customer_types as string[]} disabled={!canShared}
                      onChange={(v) => setShared("customer_types", v)} placeholder="e.g. Homes, Dealers, Institutions — press Enter" />
        ) : (
          <TextField size="small" fullWidth multiline={multiline} minRows={multiline ? 2 : undefined} value={draft.shared[k] as string}
                     disabled={!canShared} onChange={(e) => setShared(k, e.target.value)} sx={fieldSx} />
        )}
        <Typography sx={{ fontSize: "0.68rem", fontWeight: 600, color: C.faint, mt: 0.4 }}>
          From signup · saved to your {owner.toLowerCase()}{canShared ? "" : " (owners and admins can change it)"}
        </Typography>
      </Box>
    );
  };

  const updateList = <T,>(key: "contact_routes" | "branches" | "hours" | "enquiry_links", i: number, patch: Partial<T>) => {
    const list = [...(f[key] as unknown as T[])];
    list[i] = { ...list[i], ...patch };
    setFacts({ [key]: list } as Partial<CompanyFacts>);
  };
  const removeFromList = (key: "contact_routes" | "branches" | "hours" | "enquiry_links", i: number) => {
    const list = [...(f[key] as unknown[])];
    const removed = list.splice(i, 1)[0] as { id?: string };
    const patch: Partial<CompanyFacts> = { [key]: list } as Partial<CompanyFacts>;
    if (key === "branches" && removed?.id) {
      // Detach contact routes / hours that pointed at the removed branch.
      patch.contact_routes = f.contact_routes.map((r) => (r.branch_id === removed.id ? { ...r, branch_id: null } : r));
      patch.hours = f.hours.filter((h) => h.branch_id !== removed.id);
    }
    setFacts(patch);
  };
  const newId = (p: string) => `${p}_${Math.random().toString(16).slice(2, 14)}`;

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", xl: "minmax(0, 1fr) 320px" }, gap: 2.5, alignItems: "start" }}>
      <Box sx={{ display: "grid", gap: 2, minWidth: 0 }}>
        {/* Sticky action bar */}
        <Box sx={{ position: "sticky", top: 72, zIndex: 3, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5,
                   border: `1px solid ${C.border}`, borderRadius: "14px", backgroundColor: "rgba(255,255,255,0.96)", backdropFilter: "blur(6px)", px: 2, py: 1.25 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
            <StatusPill state={server.index.state} />
            <Typography sx={{ fontSize: "0.78rem", color: C.muted }} noWrap>
              {readOnlyAll ? "View only — ask an admin to change Company Info." : dirty ? "Unsaved changes" : "All changes saved"}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            {dirty && (
              <Button size="small" onClick={() => base && setDraft(JSON.parse(JSON.stringify(base)))} disabled={saving}
                      sx={{ textTransform: "none", fontWeight: 700, color: C.muted }}>Discard</Button>
            )}
            <Button size="small" variant="contained" disableElevation onClick={() => void save()} disabled={!dirty || saving || readOnlyAll}
                    sx={{ textTransform: "none", fontWeight: 800, borderRadius: "9px", px: 2 }}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </Box>
        </Box>

        {saveError && (
          <Alert severity={conflict ? "warning" : "error"} sx={{ borderRadius: "12px" }}
                 action={conflict ? <Button size="small" onClick={reapplyOnLatest} sx={{ textTransform: "none", fontWeight: 700 }}>Reapply my edits on the latest</Button> : undefined}>
            {saveError}
          </Alert>
        )}
        {server.legacy_items > 0 && (
          <Alert severity="info" sx={{ borderRadius: "12px" }}>
            {server.legacy_items} older Company Info record{server.legacy_items === 1 ? "" : "s"} from before this editor {server.legacy_items === 1 ? "is" : "are"} still used. Review them below and remove duplicates.
          </Alert>
        )}

        <Section title="Business overview" hint="Who you are. Facts marked “From signup” are the same values you entered when registering.">
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) minmax(0, 1fr)" }, gap: 1.75 }}>
            {sharedRow("company_name")}
            <Field label="Public name (if different)" value={f.public_name} disabled={!canFacts} placeholder="Shown to customers instead of the workspace name"
                   onChange={(v) => setFacts({ public_name: blankToNull(v) })} />
            {sharedRow("website")}
            {sharedRow("industry")}
            <Box sx={{ gridColumn: { md: "1 / -1" } }}>{sharedRow("description", true)}</Box>
            <Box sx={{ gridColumn: { md: "1 / -1" } }}>{sharedRow("offerings_summary", true)}</Box>
            {sharedRow("industries_served")}
            {sharedRow("customer_types")}
            <Field label="Legal name" value={f.legal_name} disabled={!canFacts} onChange={(v) => setFacts({ legal_name: blankToNull(v) })} />
            <Field label="Founded (year)" value={f.founded_year ?? ""} disabled={!canFacts} type="number"
                   onChange={(v) => setFacts({ founded_year: v ? Number(v) : null })} />
          </Box>
        </Section>

        <Section title="Public contact" hint="Each route has a purpose, so “who handles invoices?” gets the billing contact."
                 action={<NotApplicableToggle section="contact_routes" facts={f} setFacts={setFacts} label="No public contact" disabled={!canFacts} />}>
          <Box sx={{ display: "grid", gap: 1.25 }}>
            {f.contact_routes.map((r, i) => (
              <Box key={r.id ?? i} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr) minmax(0, 1fr)", lg: "minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 1.6fr) minmax(0, 1.1fr) 36px" }, gap: 1, alignItems: "end" }}>
                <SelectField label="Purpose" value={r.purpose} options={PURPOSES} disabled={!canFacts} onChange={(v) => updateList<ContactRoute>("contact_routes", i, { purpose: v })} />
                <SelectField label="Channel" value={r.channel} options={CHANNELS} disabled={!canFacts} onChange={(v) => updateList<ContactRoute>("contact_routes", i, { channel: v })} />
                <Field label={r.channel === "email" ? "Email address" : r.channel === "form" || r.channel === "link" ? "Web address" : "Number"}
                       value={r.value} disabled={!canFacts} onChange={(v) => updateList<ContactRoute>("contact_routes", i, { value: v })}
                       placeholder={r.channel === "email" ? "billing@yourcompany.com" : r.channel === "phone" || r.channel === "whatsapp" ? "+91 98765 43210" : "https://"} />
                <SelectField label="Applies to" value={(r.branch_id ?? "") as string} options={branchOptions} disabled={!canFacts}
                             onChange={(v) => updateList<ContactRoute>("contact_routes", i, { branch_id: v || null })} />
                <RemoveButton label="Remove contact" disabled={!canFacts} onClick={() => removeFromList("contact_routes", i)} />
              </Box>
            ))}
            <AddButton disabled={!canFacts} onClick={() => setFacts({ contact_routes: [...f.contact_routes, { id: newId("cr"), purpose: "general", channel: "email", value: "" }] })}>
              Add contact route
            </AddButton>
          </Box>
        </Section>

        <Section title="Hours & visits" hint="Keep opening hours and support hours separate. Explicit facts like “closed on Sundays” are shared as written."
                 action={<NotApplicableToggle section="hours" facts={f} setFacts={setFacts} label="Not applicable" disabled={!canFacts} />}>
          <Box sx={{ display: "grid", gap: 1.5 }}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) minmax(0, 1fr)" }, gap: 1.5 }}>
              <Box>
                <Field label="Business time zone" value={f.timezone} disabled={!canFacts} placeholder="e.g. Asia/Kolkata"
                       onChange={(v) => setFacts({ timezone: blankToNull(v) })} />
                {!f.timezone && server.suggestions.timezone && canFacts && (
                  <Button size="small" onClick={() => setFacts({ timezone: server.suggestions.timezone!.value.split(" ")[0] })}
                          sx={{ textTransform: "none", fontSize: "0.74rem", mt: 0.5 }}>
                    Use {server.suggestions.timezone.value} — from {server.suggestions.timezone.from}
                  </Button>
                )}
              </Box>
              <SelectField label="Visits" value={f.visit_policy} options={VISITS} disabled={!canFacts} onChange={(v) => setFacts({ visit_policy: v })} />
            </Box>
            {f.hours.map((h, i) => (
              <Box key={h.id ?? i} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr) minmax(0, 1fr)", lg: "minmax(0, 1fr) minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 1fr) 64px minmax(0, 1.2fr) 36px" }, gap: 1, alignItems: "end" }}>
                <SelectField label="Type" value={h.scope} options={[["opening", "Opening"], ["support", "Support"], ["other", "Other"]]} disabled={!canFacts}
                             onChange={(v) => updateList<HoursEntry>("hours", i, { scope: v })} />
                <Field label="Days" value={h.days} disabled={!canFacts} placeholder="Mon-Fri" onChange={(v) => updateList<HoursEntry>("hours", i, { days: v })} />
                <Field label="Opens" value={h.open ?? ""} disabled={!canFacts || h.closed} type="time" onChange={(v) => updateList<HoursEntry>("hours", i, { open: v || null })} />
                <Field label="Closes" value={h.close ?? ""} disabled={!canFacts || h.closed} type="time" onChange={(v) => updateList<HoursEntry>("hours", i, { close: v || null })} />
                <Box>
                  <Typography sx={labelSx}>Closed</Typography>
                  <Switch size="small" checked={h.closed} disabled={!canFacts} onChange={(e) => updateList<HoursEntry>("hours", i, { closed: e.target.checked })} />
                </Box>
                <SelectField label="Applies to" value={(h.branch_id ?? "") as string} options={branchOptions} disabled={!canFacts}
                             onChange={(v) => updateList<HoursEntry>("hours", i, { branch_id: v || null })} />
                <RemoveButton label="Remove hours" disabled={!canFacts} onClick={() => removeFromList("hours", i)} />
              </Box>
            ))}
            <AddButton disabled={!canFacts} onClick={() => setFacts({ hours: [...f.hours, { id: newId("hr"), scope: "opening", days: "Mon-Fri", open: "09:00", close: "18:00", closed: false }] })}>
              Add hours
            </AddButton>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) minmax(0, 1fr)" }, gap: 1.5 }}>
              <Field label="Appointments" value={f.appointment_note} disabled={!canFacts} placeholder="e.g. Book 24 hours ahead"
                     onChange={(v) => setFacts({ appointment_note: blankToNull(v) })} />
              <Field label="Holidays / exceptions" value={f.holiday_note} disabled={!canFacts} placeholder="e.g. Closed on public holidays"
                     onChange={(v) => setFacts({ holiday_note: blankToNull(v) })} />
            </Box>
          </Box>
        </Section>

        <Section title="Locations" hint="Branches customers can visit or collect from. Each keeps its own address, hours and contacts."
                 action={<NotApplicableToggle section="branches" facts={f} setFacts={setFacts} label="No public office" disabled={!canFacts} />}>
          <Box sx={{ display: "grid", gap: 1.5 }}>
            {f.branches.map((b, i) => (
              <Box key={b.id ?? i} sx={{ border: `1px dashed ${C.border}`, borderRadius: "12px", p: 1.5, display: "grid", gap: 1.25 }}>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr) minmax(0, 1fr)", lg: "minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1.3fr) 36px" }, gap: 1, alignItems: "end" }}>
                  <Field label="Branch name" value={b.name} disabled={!canFacts} placeholder="e.g. Pune branch" onChange={(v) => updateList<Branch>("branches", i, { name: v })} />
                  <SelectField label="Type" value={b.kind} options={KINDS} disabled={!canFacts} onChange={(v) => updateList<Branch>("branches", i, { kind: v })} />
                  <SelectField label="Visits" value={b.visit_policy} options={VISITS} disabled={!canFacts} onChange={(v) => updateList<Branch>("branches", i, { visit_policy: v })} />
                  <RemoveButton label="Remove branch" disabled={!canFacts} onClick={() => removeFromList("branches", i)} />
                </Box>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr) minmax(0, 1fr)", lg: "minmax(0, 2fr) repeat(3, minmax(0, 1fr))" }, gap: 1 }}>
                  <Field label="Address" value={b.address} disabled={!canFacts} onChange={(v) => updateList<Branch>("branches", i, { address: blankToNull(v) })} />
                  <Field label="City" value={b.city} disabled={!canFacts} onChange={(v) => updateList<Branch>("branches", i, { city: blankToNull(v) })} />
                  <Field label="Region / state" value={b.region} disabled={!canFacts} onChange={(v) => updateList<Branch>("branches", i, { region: blankToNull(v) })} />
                  <Field label="Postal code" value={b.postal_code} disabled={!canFacts} onChange={(v) => updateList<Branch>("branches", i, { postal_code: blankToNull(v) })} />
                </Box>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr) minmax(0, 1fr)", lg: "repeat(3, minmax(0, 1fr))" }, gap: 1 }}>
                  <Field label="Country" value={b.country} disabled={!canFacts} onChange={(v) => updateList<Branch>("branches", i, { country: blankToNull(v) })} />
                  <Field label="Map link" value={b.map_url} disabled={!canFacts} placeholder="https://maps…" onChange={(v) => updateList<Branch>("branches", i, { map_url: blankToNull(v) })} />
                  <Field label="Pickup / visitor notes" value={b.pickup_note} disabled={!canFacts} onChange={(v) => updateList<Branch>("branches", i, { pickup_note: blankToNull(v) })} />
                </Box>
              </Box>
            ))}
            <AddButton disabled={!canFacts} onClick={() => setFacts({ branches: [...f.branches, { id: newId("br"), name: "", kind: "office", visit_policy: "unknown" }] })}>
              Add branch
            </AddButton>
          </Box>
        </Section>

        <Section title="Coverage, languages & enquiries" hint="Where you serve customers, the languages you reply in, and official links for bookings or quotes.">
          <Box sx={{ display: "grid", gap: 1.5 }}>
            <Box>
              <Typography sx={labelSx}>How you serve customers</Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                {MODES.map(([m, l]) => {
                  const on = f.service_modes.includes(m);
                  return (
                    <Chip key={m} label={l} clickable={canFacts} disabled={!canFacts} variant={on ? "filled" : "outlined"} color={on ? "primary" : "default"}
                          onClick={() => setFacts({ service_modes: on ? f.service_modes.filter((x) => x !== m) : [...f.service_modes, m] })}
                          sx={{ borderRadius: "8px", fontWeight: 700 }} />
                  );
                })}
              </Box>
            </Box>
            <ChipsInput label="Service coverage areas" value={f.coverage_areas} disabled={!canFacts} placeholder="e.g. Pune, Mumbai, Rajasthan — press Enter"
                        onChange={(v) => setFacts({ coverage_areas: v })} />
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) minmax(0, 1fr)" }, gap: 1.5 }}>
              <Field label="Coverage notes" value={f.coverage_note} disabled={!canFacts} placeholder="e.g. On-site visits within city limits"
                     onChange={(v) => setFacts({ coverage_note: blankToNull(v) })} />
              <Field label="Shipping / delivery reach" value={f.shipping_note} disabled={!canFacts} placeholder="e.g. Ships across India"
                     onChange={(v) => setFacts({ shipping_note: blankToNull(v) })} />
            </Box>
            <Box>
              <ChipsInput label="Languages you reply in" value={f.languages} disabled={!canFacts} placeholder="e.g. English, Hindi — press Enter"
                          onChange={(v) => setFacts({ languages: v })} />
              {!f.languages.length && server.suggestions.languages && canFacts && (
                <Button size="small" onClick={() => setFacts({ languages: server.suggestions.languages!.value })} sx={{ textTransform: "none", fontSize: "0.74rem", mt: 0.5 }}>
                  Use {server.suggestions.languages.value.join(", ")} — from {server.suggestions.languages.from}
                </Button>
              )}
            </Box>
            {f.enquiry_links.map((l, i) => (
              <Box key={l.id ?? i} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr) minmax(0, 1fr)", lg: "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.5fr) 36px" }, gap: 1, alignItems: "end" }}>
                <SelectField label="Link" value={l.kind} options={ENQUIRY} disabled={!canFacts} onChange={(v) => updateList<EnquiryLink>("enquiry_links", i, { kind: v })} />
                <Field label="Label (optional)" value={l.label} disabled={!canFacts} onChange={(v) => updateList<EnquiryLink>("enquiry_links", i, { label: blankToNull(v) })} />
                <Field label="Web address" value={l.url} disabled={!canFacts} placeholder="https://" onChange={(v) => updateList<EnquiryLink>("enquiry_links", i, { url: v })} />
                <RemoveButton label="Remove link" disabled={!canFacts} onClick={() => removeFromList("enquiry_links", i)} />
              </Box>
            ))}
            <AddButton disabled={!canFacts || f.enquiry_links.length >= 10} onClick={() => setFacts({ enquiry_links: [...f.enquiry_links, { id: newId("lk"), kind: "booking", url: "" }] })}>
              Add booking / quote link
            </AddButton>
          </Box>
        </Section>
      </Box>

      {/* What the email AI can share — exactly what is indexed for the saved revision */}
      <Box sx={{ position: { xl: "sticky" }, top: 136, minWidth: 0, border: `1px solid ${C.border}`, borderRadius: "14px", backgroundColor: "#FBFCFE", p: 2 }}>
        <Typography sx={{ fontSize: "0.92rem", fontWeight: 800, color: C.text }}>What the AI can share</Typography>
        <Typography sx={{ fontSize: "0.74rem", color: C.muted, mt: 0.25, mb: 1.25 }}>
          From the last saved version{dirty ? " — save to update" : ""}. Nothing else from your workspace is shared.
        </Typography>
        <Box sx={{ display: "grid", gap: 0.75, maxHeight: { xs: 260, xl: "70vh" }, overflowY: "auto" }}>
          {server.ai_can_share.length === 0 && <Typography sx={{ fontSize: "0.8rem", color: C.faint }}>Nothing yet.</Typography>}
          {server.ai_can_share.map((s) => (
            <Box key={s.section} sx={{ fontSize: "0.76rem", color: "#334155", lineHeight: 1.5, whiteSpace: "pre-line", backgroundColor: "#fff",
                                       border: `1px solid ${C.border}`, borderRadius: "10px", p: 1 }}>
              {s.text}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
