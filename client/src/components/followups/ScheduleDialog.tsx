"use client";

/**
 * Guided follow-up scheduler: Date → Hour → Minute → AM/PM → Time zone → Review.
 * Each choice advances automatically; the summary bar at the top doubles as the stepper, so any
 * finished step can be reopened with one click. Times are interpreted in the chosen IANA zone and
 * validated against "now" in that zone (DST aware) before saving.
 */

import React, { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { IconArrowLeft, IconBell, IconCalendarEvent, IconClock, IconSunMoon, IconWorld, IconX } from "@tabler/icons-react";
import { CalendarGrid } from "./datetime/CalendarGrid";
import { ClockFace } from "./datetime/ClockFace";
import {
  browserZone, canonicalZone, from24h, longDate, nowIn, offsetLabel, shortDate, to24h, zonedToUtc,
} from "./datetime/tz";
import { FU, addBusinessDays, addDays, nextWeekday, timeZones, todayIn } from "./meta";

type Step = "date" | "hour" | "minute" | "ampm" | "zone" | "review";
const ORDER: Step[] = ["date", "hour", "minute", "ampm", "zone", "review"];

export interface ScheduleDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (v: { local_date: string; local_time: string; timezone: string }) => void;
  loading?: boolean;
  error?: string | null;
  workspaceTimezone: string;
  defaultTime?: string;
  workdays?: number[];
  advanceNoticeDays?: number;
  title?: string;
}

/** One equal-width step tile: small caption (icon + name) above the chosen value. */
function Segment({ icon, caption, value, fullValue, active, done, onClick, ariaLabel }: {
  icon: React.ReactNode; caption: string; value: string | null; fullValue?: string | null; active: boolean; done: boolean;
  onClick: () => void; ariaLabel: string;
}) {
  return (
    <ButtonBase onClick={onClick} disabled={!done && !active} aria-label={ariaLabel} aria-current={active ? "step" : undefined}
                title={fullValue ?? value ?? undefined}
                sx={{ minWidth: 0, width: "100%", display: "flex", flexDirection: "column", alignItems: "center",
                      justifyContent: "center", gap: 0.25, px: 0.75, py: 0.9, borderRadius: "10px",
                      border: `1.5px solid ${active ? FU.primary : done ? FU.border : "transparent"}`,
                      backgroundColor: active ? "#EFF6FF" : done ? "#FFFFFF" : "transparent",
                      transition: "all 140ms ease",
                      "&:hover": { backgroundColor: active ? "#EFF6FF" : done ? "#F8FAFC" : undefined },
                      "&:focus-visible": { boxShadow: "0 0 0 3px #BFDBFE" } }}>
      <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: 10, fontWeight: 700,
                                  letterSpacing: "0.03em", textTransform: "uppercase", whiteSpace: "nowrap", lineHeight: 1.4,
                                  color: active ? FU.primary : FU.faint }}>
        {icon}{caption}
      </Box>
      <Box component="span" sx={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                  fontSize: 13.5, fontWeight: 700, fontVariantNumeric: "tabular-nums",
                                  color: value ? (active ? FU.primary : FU.text) : "#CBD5E1" }}>
        {value ?? "—"}
      </Box>
    </ButtonBase>
  );
}

export function ScheduleDialog({
  open, onClose, onSubmit, loading = false, error = null, workspaceTimezone, defaultTime = "10:00",
  workdays = [0, 1, 2, 3, 4], advanceNoticeDays = 1, title = "Schedule a follow-up",
}: ScheduleDialogProps) {
  const fullScreen = useMediaQuery("(max-width:600px)");
  const zones = useMemo(() => timeZones(), []);
  const def = from24h(defaultTime);
  const [step, setStep] = useState<Step>("date");
  const [reached, setReached] = useState<number>(0);
  const [date, setDate] = useState<string | null>(null);
  const [hour, setHour] = useState(def.hour12);
  const [minute, setMinute] = useState(def.minute);
  const [pm, setPm] = useState<boolean | null>(null);
  const [tz, setTz] = useState(workspaceTimezone);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!open) return;
    const d = from24h(defaultTime);
    setStep("date"); setReached(0); setDate(null); setHour(d.hour12); setMinute(d.minute); setPm(null);
    setTz(workspaceTimezone);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {                                  // keep "now" fresh while the dialog is open
    if (!open) return;
    const t = setInterval(() => setTick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, [open]);

  const go = (s: Step) => {
    setStep(s);
    setReached((r) => Math.max(r, ORDER.indexOf(s)));
  };
  const back = () => go(ORDER[Math.max(0, ORDER.indexOf(step) - 1)]);

  const today = useMemo(() => todayIn(tz).date, [tz, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const time24 = pm === null ? null : to24h(hour, minute, pm);
  const dueMs = date && time24 ? zonedToUtc(date, time24, tz) : null;
  const isPast = (ms: number | null) => ms !== null && ms <= Date.now() + 60_000;
  const weekend = date ? !workdays.includes((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) : false;

  const notice = useMemo(() => {
    if (!date || !dueMs || advanceNoticeDays <= 0) return null;
    let d = date;
    let left = advanceNoticeDays;
    for (let i = 0; i < 60 && left > 0; i += 1) {
      d = addDays(d, -1);
      if (workdays.includes((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7)) left -= 1;
    }
    const ms = zonedToUtc(d, defaultTime, workspaceTimezone);
    if (ms >= dueMs) return null;
    return ms <= Date.now() ? "right away" : `${shortDate(d)}, ${defaultTime} (${workspaceTimezone})`;
  }, [date, dueMs, advanceNoticeDays, workdays, defaultTime, workspaceTimezone]);

  const presets = [
    { label: "Next business day", d: addBusinessDays(today, 1, workdays) },
    { label: "In 2 business days", d: addBusinessDays(today, 2, workdays) },
    { label: "Next Monday", d: nextWeekday(today, 0) },
    { label: "In 1 week", d: addDays(today, 7) },
  ];

  const zoneOptions = useMemo(() => {
    const pinned = Array.from(new Set([canonicalZone(workspaceTimezone), browserZone()]));
    const all = Array.from(new Set(zones.map(canonicalZone)));
    return [...pinned, ...all.filter((z) => !pinned.includes(z))];
  }, [zones, workspaceTimezone]);

  const timeLabel = `${hour}:${String(minute).padStart(2, "0")}`;
  const idx = ORDER.indexOf(step);

  const body = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <Box sx={{ px: 3, pt: 2.5, pb: 1.5, display: "flex", alignItems: "flex-start", gap: 1 }}>
        {idx > 0 && (
          <IconButton size="small" onClick={back} aria-label="Back" sx={{ mt: "-2px" }}><IconArrowLeft size={18} /></IconButton>
        )}
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 17, color: FU.text }}>{title}</Typography>
          <Typography sx={{ fontSize: 12.5, color: FU.muted }}>
            {step === "date" && "Pick a day — one click."}
            {step === "hour" && "Select the hour."}
            {step === "minute" && "Select the minutes."}
            {step === "ampm" && "Morning or afternoon?"}
            {step === "zone" && "Which time zone is this time in?"}
            {step === "review" && "Check and save. Your team is reminded; customers are emailed only where allowed."}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} disabled={loading} aria-label="Close"><IconX size={18} /></IconButton>
      </Box>

      {/* Summary bar = stepper */}
      <Box role="list" aria-label="Schedule steps"
           sx={{ mx: 3, p: 0.75, borderRadius: "12px", backgroundColor: FU.soft, border: `1px solid ${FU.border}`,
                 display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 0.75 }}>
        <Segment icon={<IconCalendarEvent size={12} />} caption="Date" value={date ? shortDate(date) : null}
                 active={step === "date"} done={reached > 0} onClick={() => go("date")} ariaLabel="Change date" />
        <Segment icon={<IconClock size={12} />} caption="Time" value={reached > 1 ? timeLabel : null}
                 active={step === "hour" || step === "minute"} done={reached > 1} onClick={() => go("hour")} ariaLabel="Change time" />
        <Segment icon={<IconSunMoon size={12} />} caption="AM / PM" value={pm === null ? null : pm ? "PM" : "AM"}
                 active={step === "ampm"} done={reached > 3} onClick={() => go("ampm")} ariaLabel="Change AM or PM" />
        <Segment icon={<IconWorld size={12} />} caption="Time zone" value={reached > 4 ? (tz.split("/").pop() ?? tz).replace(/_/g, " ") : null}
                 fullValue={reached > 4 ? tz : null}
                 active={step === "zone"} done={reached > 4} onClick={() => go("zone")} ariaLabel="Change time zone" />
      </Box>

      {/* Step body */}
      <Box key={step} sx={{ px: 3, py: 2, flex: 1, animation: "fuStepIn 200ms ease",
                            "@keyframes fuStepIn": { from: { opacity: 0, transform: "translateY(6px)" }, to: { opacity: 1, transform: "none" } } }}>
        {step === "date" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
              {presets.map((p) => (
                <Chip key={p.label} label={p.label} clickable size="small" variant={date === p.d ? "filled" : "outlined"}
                      color={date === p.d ? "primary" : "default"} onClick={() => { setDate(p.d); go("hour"); }}
                      sx={{ fontWeight: 600 }} />
              ))}
            </Box>
            <CalendarGrid value={date} today={today} workdays={workdays} onSelect={(d) => { setDate(d); go("hour"); }} />
          </Box>
        )}

        {(step === "hour" || step === "minute") && (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5, fontVariantNumeric: "tabular-nums" }}>
              <ButtonBase onClick={() => setStep("hour")} aria-label="Edit hour"
                          sx={{ fontSize: 44, fontWeight: 700, lineHeight: 1, px: 1, borderRadius: "10px",
                                color: step === "hour" ? FU.primary : FU.text, backgroundColor: step === "hour" ? "#EFF6FF" : "transparent" }}>
                {String(hour).padStart(2, "0")}
              </ButtonBase>
              <Typography sx={{ fontSize: 40, fontWeight: 700, color: FU.faint }}>:</Typography>
              <ButtonBase onClick={() => go("minute")} aria-label="Edit minutes"
                          sx={{ fontSize: 44, fontWeight: 700, lineHeight: 1, px: 1, borderRadius: "10px",
                                color: step === "minute" ? FU.primary : FU.text, backgroundColor: step === "minute" ? "#EFF6FF" : "transparent" }}>
                {String(minute).padStart(2, "0")}
              </ButtonBase>
              <Typography sx={{ fontSize: 16, fontWeight: 700, color: FU.faint, ml: 1 }}>{pm === null ? "--" : pm ? "PM" : "AM"}</Typography>
            </Box>
            <ClockFace mode={step === "hour" ? "hour" : "minute"} value={step === "hour" ? hour : minute}
                       onChange={(v) => (step === "hour" ? setHour(v) : setMinute(v))}
                       onCommit={(v) => { if (step === "hour") { setHour(v); go("minute"); } else { setMinute(v); go("ampm"); } }} />
            {step === "minute" && (
              <Box sx={{ display: "flex", gap: 0.75 }}>
                {[0, 15, 30, 45].map((m) => (
                  <Chip key={m} label={`:${String(m).padStart(2, "0")}`} size="small" clickable variant={minute === m ? "filled" : "outlined"}
                        color={minute === m ? "primary" : "default"} onClick={() => { setMinute(m); go("ampm"); }} sx={{ fontWeight: 600 }} />
                ))}
              </Box>
            )}
          </Box>
        )}

        {step === "ampm" && date && (
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, pt: 1 }}>
            {[false, true].map((isPm) => {
              const ms = zonedToUtc(date, to24h(hour, minute, isPm), tz);
              const past = isPast(ms);
              const selected = pm === isPm;
              return (
                <ButtonBase key={String(isPm)} disabled={past} onClick={() => { setPm(isPm); go("zone"); }}
                            aria-label={isPm ? "PM" : "AM"}
                            sx={{ flexDirection: "column", py: 3, borderRadius: "14px", border: `2px solid ${selected ? FU.primary : FU.border}`,
                                  backgroundColor: selected ? "#EFF6FF" : "#FFFFFF", opacity: past ? 0.45 : 1,
                                  transition: "all 140ms ease", "&:hover": { borderColor: past ? FU.border : "#93C5FD", transform: past ? "none" : "translateY(-1px)" } }}>
                  <Typography sx={{ fontSize: 26, fontWeight: 800, color: selected ? FU.primary : FU.text }}>{isPm ? "PM" : "AM"}</Typography>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: FU.muted, fontVariantNumeric: "tabular-nums" }}>
                    {timeLabel} {isPm ? "PM" : "AM"}
                  </Typography>
                  <Typography sx={{ fontSize: 11.5, color: past ? FU.danger : FU.faint, mt: 0.25 }}>
                    {past ? "Already passed" : isPm ? "Afternoon / evening" : "Morning"}
                  </Typography>
                </ButtonBase>
              );
            })}
          </Box>
        )}

        {step === "zone" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {Array.from(new Set([canonicalZone(workspaceTimezone), browserZone()])).map((z) => (
              <ButtonBase key={z} onClick={() => { setTz(z); go("review"); }}
                          sx={{ justifyContent: "space-between", px: 2, py: 1.5, borderRadius: "12px",
                                border: `2px solid ${tz === z ? FU.primary : FU.border}`, backgroundColor: tz === z ? "#EFF6FF" : "#FFFFFF" }}>
                <Box sx={{ textAlign: "left" }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: FU.text }}>{z}</Typography>
                  <Typography sx={{ fontSize: 12, color: FU.muted }}>
                    {z === workspaceTimezone ? "Workspace time zone" : "This device"} · {offsetLabel(z)} · now {nowIn(z)}
                  </Typography>
                </Box>
                {tz === z && <Chip size="small" label="Selected" color="primary" sx={{ fontWeight: 700, height: 22 }} />}
              </ButtonBase>
            ))}
            <Autocomplete size="small" options={zoneOptions} value={null} blurOnSelect
                          onChange={(_, v) => { if (v) { setTz(v); go("review"); } }}
                          getOptionLabel={(z) => z}
                          renderOption={(props, z) => {
                            const { key, ...rest } = props as React.HTMLAttributes<HTMLLIElement> & { key: string };
                            return (
                              <li key={key} {...rest} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                                <span>{z}</span><span style={{ color: FU.faint, fontSize: 12 }}>{offsetLabel(z)}</span>
                              </li>
                            );
                          }}
                          renderInput={(params) => <TextField {...params} placeholder="Search another time zone (e.g. London, Dubai)" />} />
          </Box>
        )}

        {step === "review" && date && time24 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Box sx={{ p: 2.25, borderRadius: "14px", background: "linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 100%)", border: "1px solid #DBEAFE" }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: FU.primary, letterSpacing: "0.04em" }}>FOLLOW-UP</Typography>
              <Typography sx={{ fontSize: 19, fontWeight: 800, color: FU.text, mt: 0.25 }}>{longDate(date)}</Typography>
              <Typography sx={{ fontSize: 16, fontWeight: 700, color: FU.body, fontVariantNumeric: "tabular-nums" }}>
                {timeLabel} {pm ? "PM" : "AM"} · {tz} ({offsetLabel(tz, dueMs ?? Date.now())})
              </Typography>
              {tz !== workspaceTimezone && dueMs && (
                <Typography sx={{ fontSize: 12.5, color: FU.muted, mt: 0.5 }}>
                  = {new Date(dueMs).toLocaleString("en-GB", { timeZone: workspaceTimezone, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} in {workspaceTimezone}
                </Typography>
              )}
            </Box>
            <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", color: FU.muted }}>
              <IconBell size={16} style={{ marginTop: 2 }} />
              <Typography sx={{ fontSize: 13 }}>
                {notice ? <>Team reminder <b>{notice}</b>, then again when it is due.</> : "Your team is reminded when it is due."}
              </Typography>
            </Box>
            {weekend && <Alert severity="warning" sx={{ borderRadius: "10px", fontSize: 13 }}>This day is outside your working days.</Alert>}
            {isPast(dueMs) && (
              <Alert severity="error" sx={{ borderRadius: "10px", fontSize: 13 }}
                     action={<Button size="small" color="inherit" onClick={() => go("hour")}>Change time</Button>}>
                This time has already passed in {tz}.
              </Alert>
            )}
            {error && <Alert severity="error" sx={{ borderRadius: "10px", fontSize: 13 }}>{error}</Alert>}
          </Box>
        )}
      </Box>

      {/* Footer */}
      <Box sx={{ px: 3, pb: 2.5, pt: 0.5, display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <Button onClick={onClose} disabled={loading} sx={{ textTransform: "none", fontWeight: 600 }}>Cancel</Button>
        {step === "zone" && (
          <Button variant="outlined" onClick={() => go("review")} sx={{ textTransform: "none", fontWeight: 600, borderRadius: "9px" }}>
            Continue with {tz}
          </Button>
        )}
        {step === "review" && (
          <Button variant="contained" disableElevation disabled={loading || !date || !time24 || isPast(dueMs)}
                  onClick={() => date && time24 && onSubmit({ local_date: date, local_time: time24, timezone: tz })}
                  sx={{ textTransform: "none", fontWeight: 700, borderRadius: "9px", px: 2.5 }}>
            {loading ? "Saving…" : "Save follow-up"}
          </Button>
        )}
      </Box>
    </Box>
  );

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullScreen={fullScreen} maxWidth={false}
            slotProps={{ paper: { sx: { width: fullScreen ? "100%" : 460, borderRadius: fullScreen ? 0 : "18px", overflow: "hidden" } } }}>
      {body}
    </Dialog>
  );
}
