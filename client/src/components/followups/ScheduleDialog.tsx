"use client";

import React, { useEffect, useMemo, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { FU, addBusinessDays, addDays, nextWeekday, timeZones, todayIn } from "./meta";

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

export function ScheduleDialog({
  open, onClose, onSubmit, loading = false, error = null, workspaceTimezone, defaultTime = "10:00",
  workdays = [0, 1, 2, 3, 4], advanceNoticeDays = 1, title = "Schedule a follow-up",
}: ScheduleDialogProps) {
  const zones = useMemo(() => timeZones(), []);
  const [tz, setTz] = useState(workspaceTimezone);
  const today = useMemo(() => todayIn(tz), [tz]);
  const [date, setDate] = useState(addBusinessDays(today.date, 1, workdays));
  const [time, setTime] = useState(defaultTime);
  const [preset, setPreset] = useState<string>("next");

  useEffect(() => {
    if (open) {
      const t = todayIn(workspaceTimezone);
      setTz(workspaceTimezone);
      setDate(addBusinessDays(t.date, 1, workdays));
      setTime(defaultTime);
      setPreset("next");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const presets = [
    { key: "next", label: "Next business day", date: addBusinessDays(today.date, 1, workdays) },
    { key: "two", label: "In 2 business days", date: addBusinessDays(today.date, 2, workdays) },
    { key: "mon", label: "Next Monday", date: nextWeekday(today.date, 0) },
    { key: "week", label: "In 1 week", date: addDays(today.date, 7) },
  ];

  const preview = useMemo(() => {
    try {
      const d = new Date(`${date}T${time}:00`);
      const day = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      return `${day} at ${time} (${tz})`;
    } catch {
      return "";
    }
  }, [date, time, tz]);

  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^([01]\d|2[0-3]):[0-5]\d$/.test(time) && date >= today.date;
  const weekend = !workdays.includes((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7);

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth
            slotProps={{ paper: { sx: { borderRadius: "14px" } } }}>
      <DialogTitle sx={{ fontWeight: 700, fontSize: 17, pb: 0.5 }}>{title}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
        <Typography sx={{ fontSize: 13, color: FU.muted }}>
          Your team gets a reminder at this time. Customers are only emailed automatically where that has been
          allowed for this conversation.
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
          {presets.map((p) => (
            <Chip key={p.key} label={p.label} clickable size="small"
                  color={preset === p.key ? "primary" : "default"} variant={preset === p.key ? "filled" : "outlined"}
                  onClick={() => { setPreset(p.key); setDate(p.date); }} sx={{ fontWeight: 600 }} />
          ))}
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 1.5 }}>
          <TextField label="Date" type="date" size="small" value={date}
                     onChange={(e) => { setDate(e.target.value); setPreset(""); }}
                     slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: today.date } }} />
          <TextField label="Time" type="time" size="small" value={time} onChange={(e) => setTime(e.target.value)}
                     slotProps={{ inputLabel: { shrink: true } }} />
        </Box>
        <Autocomplete size="small" options={zones} value={tz} disableClearable
                      onChange={(_, v) => v && setTz(v)}
                      renderInput={(params) => <TextField {...params} label="Time zone" />} />
        {valid && (
          <Alert severity="info" icon={false} sx={{ borderRadius: "10px", fontSize: 13 }}>
            <b>{preview}</b>
            {advanceNoticeDays > 0 && (
              <Box component="span" sx={{ display: "block", color: FU.muted, mt: 0.25 }}>
                Advance reminder {advanceNoticeDays} business day{advanceNoticeDays === 1 ? "" : "s"} before, unless that
                time has already passed.
              </Box>
            )}
          </Alert>
        )}
        {weekend && valid && (
          <Alert severity="warning" sx={{ borderRadius: "10px", fontSize: 13 }}>This date is outside your working days.</Alert>
        )}
        {error && <Alert severity="error" sx={{ borderRadius: "10px", fontSize: 13 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={loading} sx={{ textTransform: "none", fontWeight: 600 }}>Cancel</Button>
        <Button variant="contained" disableElevation disabled={!valid || loading}
                onClick={() => onSubmit({ local_date: date, local_time: time, timezone: tz })}
                sx={{ textTransform: "none", fontWeight: 600, borderRadius: "9px" }}>
          {loading ? "Saving…" : "Save follow-up"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
