"use client";

import React, { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useRebuildStyle, useSaveStyle, useStyleProfiles } from "@/hooks/useMemory";
import { StyleOverrides, StyleProfile } from "@/services/memory.service";
import { C, Card, ErrorState, LoadingRows, StatusChip, btn, formatDate, humanize, pct } from "./ui";

export function StyleTab({ canEdit }: { canEdit: boolean }) {
  const q = useStyleProfiles();
  const rebuild = useRebuildStyle();
  if (q.isLoading) return <LoadingRows rows={5} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const profiles = q.data ?? [];
  const company = profiles.find((p) => p.scope === "company") ?? null;
  const senders = profiles.filter((p) => p.scope === "sender");

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: 2, alignItems: "start" }}>
        <LearnedCard profile={company} canEdit={canEdit} rebuilding={rebuild.isPending}
                     onRebuild={() => rebuild.mutate(false)} />
        <SettingsCard profile={company} canEdit={canEdit} />
      </Box>
      {senders.length > 0 && (
        <Card title="Per-mailbox style" subtitle="Mailboxes with at least 10 hand-written emails use their own learned style.">
          {senders.map((s) => (
            <Box key={s.id} sx={{ display: "flex", gap: 1, alignItems: "center", py: 0.75 }}>
              <Typography sx={{ fontSize: 13, flex: 1 }}>{s.scope_key}</Typography>
              <Typography sx={{ fontSize: 12, color: C.muted }}>{s.sample_count} emails</Typography>
              <StatusChip value={s.status} />
            </Box>
          ))}
        </Card>
      )}
    </Box>
  );
}

function LearnedCard({ profile, canEdit, rebuilding, onRebuild }: {
  profile: StyleProfile | null; canEdit: boolean; rebuilding: boolean; onRebuild: () => void;
}) {
  const s = profile?.learned ?? null;
  const g = profile?.learned_guide ?? null;
  const row = (label: string, value: React.ReactNode) => (
    <Box sx={{ display: "flex", gap: 2, py: 0.6, borderBottom: `1px solid ${C.border}` }}>
      <Typography sx={{ fontSize: 13, color: C.muted, width: 150, flexShrink: 0 }}>{label}</Typography>
      <Typography sx={{ fontSize: 13, color: C.text, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{value ?? "—"}</Typography>
    </Box>
  );
  return (
    <Card title="Learned from your team's emails"
          subtitle={profile?.computed_at
            ? `${profile.sample_count} hand-written email(s) · updated ${formatDate(profile.computed_at, true)}. AI-sent replies are never used, so the AI doesn't learn from itself.`
            : "Learns automatically from emails your team writes in Gmail and drafts they edit."}
          action={canEdit && (
            <Button size="small" variant="outlined" sx={btn} disabled={rebuilding} onClick={onRebuild}>
              {rebuilding ? "Learning…" : "Re-learn now"}
            </Button>
          )}>
      {profile && <Box sx={{ mb: 1.5 }}><StatusChip value={profile.status} /></Box>}
      {!s || !s.sample_count ? (
        <Typography sx={{ fontSize: 13, color: C.muted }}>
          Nothing learned yet. Until then, the settings on the right are used. Learning starts once your team has sent at least 5 emails by hand.
        </Typography>
      ) : (
        <Box>
          {row("Greeting", s.greeting ? `${s.greeting} (${pct(s.greeting_share)} of emails)` : "varies")}
          {row("Sign-off", s.sign_off ?? "varies")}
          {row("Language", humanize(s.language))}
          {row("Register", humanize(s.formality))}
          {row("Typical length", s.median_words ? `~${s.median_words} words, ${s.median_paragraphs} paragraph(s)` : null)}
          {row("Phrases", (s.phrases ?? []).length ? (s.phrases as string[]).map((p) => `“${p}”`).join(", ") : null)}
          {g?.tone && row("Tone", g.tone)}
          {(g?.situational ?? []).map((r, i) => <React.Fragment key={i}>{row(`When ${r.situation}`, r.practice)}</React.Fragment>)}
        </Box>
      )}
    </Card>
  );
}

function SettingsCard({ profile, canEdit }: { profile: StyleProfile | null; canEdit: boolean }) {
  const save = useSaveStyle();
  const o = profile?.overrides ?? {};
  const [greeting, setGreeting] = useState(o.greeting ?? "");
  const [signOff, setSignOff] = useState(o.sign_off ?? "");
  const [language, setLanguage] = useState<string>(o.language ?? "");
  const [formality, setFormality] = useState<string>(o.formality ?? "");
  const [maxWords, setMaxWords] = useState(o.max_words ? String(o.max_words) : "");
  const [guide, setGuide] = useState(profile?.employee_guide ?? "");
  useEffect(() => {
    setGreeting(o.greeting ?? ""); setSignOff(o.sign_off ?? "");
    setLanguage(o.language ?? ""); setFormality(o.formality ?? ""); setMaxWords(o.max_words ? String(o.max_words) : "");
    setGuide(profile?.employee_guide ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.version, JSON.stringify(profile?.overrides), profile?.employee_guide]);

  const words = maxWords.trim() ? Number(maxWords) : null;
  const wordsInvalid = words !== null && (!Number.isInteger(words) || words < 30 || words > 600);
  const enabled = profile?.status !== "disabled";

  const submit = () => {
    if (wordsInvalid) return;
    const overrides: StyleOverrides = {};
    if (greeting.trim()) overrides.greeting = greeting.trim();
    if (signOff.trim()) overrides.sign_off = signOff.trim();
    if (language) overrides.language = language as StyleOverrides["language"];
    if (formality) overrides.formality = formality as StyleOverrides["formality"];
    if (words) overrides.max_words = words;
    save.mutate({ scope: "company", overrides, employee_guide: guide.trim() || null });
  };

  return (
    <Card title="Your team's settings" subtitle="These always win over what the AI learned. Leave a field empty to use the learned value."
          action={canEdit && profile && (
            <FormControlLabel sx={{ mr: 0 }} label={<Typography sx={{ fontSize: 13 }}>Use style</Typography>}
                              control={<Switch size="small" checked={enabled} disabled={save.isPending}
                                               onChange={(e) => save.mutate({ scope: "company", enabled: e.target.checked })} />} />
          )}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <TextField size="small" label="Greeting" placeholder="Dear {name}," value={greeting} disabled={!canEdit}
                   onChange={(e) => setGreeting(e.target.value)} slotProps={{ htmlInput: { maxLength: 80 } }}
                   helperText="{name} is replaced with the recipient's name" />
        <TextField size="small" label="Sign-off" placeholder="Thanks & Regards," value={signOff} disabled={!canEdit}
                   onChange={(e) => setSignOff(e.target.value)} slotProps={{ htmlInput: { maxLength: 60 } }}
                   helperText="Your company name is added on the line below. Leave empty to use the learned sign-off, or “Regards,”" />
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1.5 }}>
          <TextField select size="small" label="Language" value={language} disabled={!canEdit} onChange={(e) => setLanguage(e.target.value)}>
            <MenuItem value="">Learned / match customer</MenuItem>
            {["english", "hindi", "hinglish"].map((l) => <MenuItem key={l} value={l}>{humanize(l)}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Register" value={formality} disabled={!canEdit} onChange={(e) => setFormality(e.target.value)}>
            <MenuItem value="">Learned</MenuItem>
            {["formal", "neutral", "casual"].map((l) => <MenuItem key={l} value={l}>{humanize(l)}</MenuItem>)}
          </TextField>
          <TextField size="small" label="Max words" value={maxWords} disabled={!canEdit} onChange={(e) => setMaxWords(e.target.value.replace(/[^0-9]/g, ""))}
                     error={wordsInvalid} helperText={wordsInvalid ? "30–600" : undefined} />
        </Box>
        <TextField label="Team style rules (one per line)" value={guide} disabled={!canEdit} multiline minRows={3}
                   onChange={(e) => setGuide(e.target.value)} slotProps={{ htmlInput: { maxLength: 2000 } }}
                   placeholder={"Always mention that GST is extra\nNever use emojis"} />
        {canEdit && (
          <Button variant="contained" sx={{ ...btn, alignSelf: "flex-start" }} onClick={submit}
                  disabled={save.isPending || wordsInvalid}>{save.isPending ? "Saving…" : "Save"}</Button>
        )}
      </Box>
    </Card>
  );
}
