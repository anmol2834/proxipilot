"use client";

/**
 * Month calendar for picking a follow-up date in ONE click.
 * Monday-first weeks (matches the workspace workweek), past dates disabled, today ringed, non-working
 * days tinted, month/year quick-jump view, keyboard navigation (arrows, PageUp/PageDown, Home/End, Enter).
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { IconChevronDown, IconChevronLeft, IconChevronRight, IconChevronUp } from "@tabler/icons-react";

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
  "November", "December"];

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parse(v: string): { y: number; m: number; d: number } {
  const [y, m, d] = v.split("-").map(Number);
  return { y, m: m - 1, d };
}

function shift(v: string, days: number): string {
  const { y, m, d } = parse(v);
  const t = new Date(Date.UTC(y, m, d + days));
  return iso(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
}

function weekdayMon0(v: string): number {
  const { y, m, d } = parse(v);
  return (new Date(Date.UTC(y, m, d)).getUTCDay() + 6) % 7;
}

export interface CalendarGridProps {
  value: string | null;
  today: string;               // in the scheduling zone
  workdays: number[];          // Monday = 0
  onSelect: (date: string) => void;
}

export function CalendarGrid({ value, today, workdays, onSelect }: CalendarGridProps) {
  const start = parse(value ?? today);
  const [view, setView] = useState({ y: start.y, m: start.m });
  const [mode, setMode] = useState<"days" | "months">("days");
  const [focus, setFocus] = useState<string>(value ?? today);
  const gridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const p = parse(focus);
    if (p.y !== view.y || p.m !== view.m) setView({ y: p.y, m: p.m });
  }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps

  const cells = useMemo(() => {
    const first = iso(view.y, view.m, 1);
    const lead = weekdayMon0(first);
    const begin = shift(first, -lead);
    return Array.from({ length: 42 }, (_, i) => shift(begin, i));
  }, [view]);

  const todayP = parse(today);
  const canGoBack = view.y > todayP.y || (view.y === todayP.y && view.m > todayP.m);
  const go = (delta: number) => {
    const t = new Date(Date.UTC(view.y, view.m + delta, 1));
    setView({ y: t.getUTCFullYear(), m: t.getUTCMonth() });
  };

  const onKey = (e: React.KeyboardEvent) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, PageUp: -30, PageDown: 30 };
    if (e.key in moves) {
      e.preventDefault();
      const next = shift(focus, moves[e.key]);
      setFocus(next < today ? today : next);
    } else if (e.key === "Home") {
      e.preventDefault();
      setFocus(shift(focus, -weekdayMon0(focus)));
    } else if (e.key === "End") {
      e.preventDefault();
      setFocus(shift(focus, 6 - weekdayMon0(focus)));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (focus >= today) onSelect(focus);
    }
  };

  useEffect(() => {
    const el = gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focus}"]`);
    if (el && gridRef.current?.contains(document.activeElement)) el.focus();
  }, [focus, view]);

  return (
    <Box sx={{ userSelect: "none" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Button onClick={() => setMode(mode === "days" ? "months" : "days")} endIcon={mode === "days" ? <IconChevronDown size={16} /> : <IconChevronUp size={16} />}
                sx={{ textTransform: "none", fontWeight: 700, fontSize: 15.5, color: "#0F172A", px: 1 }} aria-label="Choose month and year">
          {MONTHS[view.m]} {view.y}
        </Button>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Button size="small" onClick={() => { setView({ y: todayP.y, m: todayP.m }); setFocus(today); setMode("days"); }}
                  sx={{ textTransform: "none", fontWeight: 600, minWidth: 0 }}>Today</Button>
          <IconButton size="small" onClick={() => (mode === "days" ? go(-1) : setView({ ...view, y: Math.max(todayP.y, view.y - 1) }))}
                      disabled={mode === "days" ? !canGoBack : view.y <= todayP.y} aria-label={mode === "days" ? "Previous month" : "Previous year"}>
            <IconChevronLeft size={18} />
          </IconButton>
          <IconButton size="small" onClick={() => (mode === "days" ? go(1) : setView({ ...view, y: view.y + 1 }))}
                      aria-label={mode === "days" ? "Next month" : "Next year"}>
            <IconChevronRight size={18} />
          </IconButton>
        </Box>
      </Box>

      {mode === "months" ? (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, py: 1 }}>
          {MONTHS.map((name, i) => {
            const past = view.y < todayP.y || (view.y === todayP.y && i < todayP.m);
            const active = i === view.m;
            return (
              <Button key={name} disabled={past} onClick={() => { setView({ y: view.y, m: i }); setMode("days"); }}
                      variant={active ? "contained" : "text"} disableElevation
                      sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px", py: 1.25 }}>
                {name.slice(0, 3)}
              </Button>
            );
          })}
        </Box>
      ) : (
        <>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", mb: 0.5 }}>
            {WEEK.map((w, i) => (
              <Typography key={w} sx={{ textAlign: "center", fontSize: 11.5, fontWeight: 700, letterSpacing: "0.03em",
                                        color: workdays.includes(i) ? "#64748B" : "#B4BCC8", py: 0.5 }}>{w}</Typography>
            ))}
          </Box>
          <Box ref={gridRef} role="grid" aria-label={`${MONTHS[view.m]} ${view.y}`} onKeyDown={onKey}
               sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", rowGap: 0.5 }}>
            {cells.map((c) => {
              const p = parse(c);
              const inMonth = p.m === view.m;
              const past = c < today;
              const selected = c === value;
              const isToday = c === today;
              const off = !workdays.includes(weekdayMon0(c));
              const btn = (
                <Box component="button" type="button" role="gridcell" data-date={c} aria-selected={selected}
                     aria-label={new Date(`${c}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                     disabled={past} tabIndex={c === focus ? 0 : -1}
                     onClick={() => { setFocus(c); onSelect(c); }}
                     sx={{
                       mx: "auto", width: 40, height: 40, borderRadius: "50%", border: "none", fontFamily: "inherit",
                       fontSize: 13.5, fontWeight: selected || isToday ? 700 : 500, cursor: past ? "not-allowed" : "pointer",
                       position: "relative", transition: "background-color 120ms ease, transform 120ms ease",
                       color: selected ? "#FFFFFF" : past ? "#CBD5E1" : !inMonth ? "#94A3B8" : off ? "#64748B" : "#0F172A",
                       backgroundColor: selected ? "#2563EB" : off && !past && inMonth ? "#F8FAFC" : "transparent",
                       boxShadow: isToday && !selected ? "inset 0 0 0 1.5px #2563EB" : selected ? "0 4px 12px rgba(37,99,235,0.35)" : "none",
                       outline: "none",
                       "&:hover:not(:disabled)": { backgroundColor: selected ? "#1D4ED8" : "#EFF6FF", transform: "scale(1.06)" },
                       "&:focus-visible": { boxShadow: "0 0 0 3px #BFDBFE" },
                     }}>
                  {p.d}
                </Box>
              );
              return off && !past ? <Tooltip key={c} title="Outside working days" placement="top" enterDelay={600}>{btn}</Tooltip>
                : <React.Fragment key={c}>{btn}</React.Fragment>;
            })}
          </Box>
        </>
      )}
    </Box>
  );
}
