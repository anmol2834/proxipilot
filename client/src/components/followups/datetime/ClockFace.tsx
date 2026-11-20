"use client";

/**
 * Analog clock face for picking an hour (1–12) or a minute (0–59).
 * Click or drag anywhere on the dial; releasing commits and the parent advances to the next step.
 * Keyboard: arrows move (hours by 1, minutes by 1 / 5 with Shift), Enter commits.
 */

import React, { useRef, useState } from "react";
import Box from "@mui/material/Box";

const SIZE = 264;
const C = SIZE / 2;
const R_LABEL = 100;

export interface ClockFaceProps {
  mode: "hour" | "minute";
  value: number;
  onChange: (v: number) => void;
  onCommit: (v: number) => void;
  isDisabled?: (v: number) => boolean;
}

function valueFromPoint(mode: "hour" | "minute", x: number, y: number): number {
  let deg = (Math.atan2(y - C, x - C) * 180) / Math.PI + 90;
  if (deg < 0) deg += 360;
  if (mode === "hour") {
    const h = Math.round(deg / 30) % 12;
    return h === 0 ? 12 : h;
  }
  return Math.round(deg / 6) % 60;
}

function angleOf(mode: "hour" | "minute", v: number): number {
  return ((mode === "hour" ? (v % 12) * 30 : v * 6) - 90) * (Math.PI / 180);
}

export function ClockFace({ mode, value, onChange, onCommit, isDisabled }: ClockFaceProps) {
  const ref = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState(false);
  const labels = mode === "hour" ? Array.from({ length: 12 }, (_, i) => i + 1) : Array.from({ length: 12 }, (_, i) => i * 5);

  const pick = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return null;
    const x = ((e.clientX - r.left) / r.width) * SIZE;
    const y = ((e.clientY - r.top) / r.height) * SIZE;
    const v = valueFromPoint(mode, x, y);
    if (isDisabled?.(v)) return null;
    onChange(v);
    return v;
  };

  const a = angleOf(mode, value);
  const hx = C + Math.cos(a) * R_LABEL;
  const hy = C + Math.sin(a) * R_LABEL;
  const onTick = mode === "hour" || value % 5 === 0;

  const onKey = (e: React.KeyboardEvent) => {
    const step = mode === "minute" && e.shiftKey ? 5 : 1;
    const span = mode === "hour" ? 12 : 60;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = value + step;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = value - step;
    if (next !== null) {
      e.preventDefault();
      if (mode === "hour") next = ((((next - 1) % 12) + 12) % 12) + 1;
      else next = ((next % span) + span) % span;
      if (!isDisabled?.(next)) onChange(next);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!isDisabled?.(value)) onCommit(value);
    }
  };

  return (
    <Box sx={{ display: "flex", justifyContent: "center" }}>
      <Box component="svg" ref={ref} viewBox={`0 0 ${SIZE} ${SIZE}`} role="slider" tabIndex={0}
           aria-label={mode === "hour" ? "Hour" : "Minute"} aria-valuenow={value}
           aria-valuemin={mode === "hour" ? 1 : 0} aria-valuemax={mode === "hour" ? 12 : 59}
           onKeyDown={onKey}
           onPointerDown={(e: React.PointerEvent<SVGSVGElement>) => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* capture unsupported */ } setDrag(true); pick(e); }}
           onPointerMove={(e: React.PointerEvent<SVGSVGElement>) => { if (drag) pick(e); }}
           onPointerUp={(e: React.PointerEvent<SVGSVGElement>) => {
             setDrag(false);
             const v = pick(e);
             if (v !== null) onCommit(v);
           }}
           sx={{ width: SIZE, height: SIZE, maxWidth: "100%", cursor: "pointer", touchAction: "none", outline: "none",
                 borderRadius: "50%", "&:focus-visible": { boxShadow: "0 0 0 3px #BFDBFE" } }}>
        <circle cx={C} cy={C} r={C - 4} fill="#F1F5F9" />
        {mode === "minute" && Array.from({ length: 60 }, (_, i) => i).filter((i) => i % 5 !== 0).map((i) => {
          const t = angleOf("minute", i);
          return <circle key={i} cx={C + Math.cos(t) * (R_LABEL + 18)} cy={C + Math.sin(t) * (R_LABEL + 18)} r={1.3} fill="#CBD5E1" />;
        })}
        <line x1={C} y1={C} x2={hx} y2={hy} stroke="#2563EB" strokeWidth={2.5} strokeLinecap="round"
              style={{ transition: drag ? "none" : "all 180ms ease" }} />
        <circle cx={C} cy={C} r={5} fill="#2563EB" />
        <circle cx={hx} cy={hy} r={19} fill="#2563EB" style={{ transition: drag ? "none" : "all 180ms ease" }} />
        {!onTick && <circle cx={hx} cy={hy} r={3.5} fill="#FFFFFF" />}
        {labels.map((v) => {
          const t = angleOf(mode, v);
          const x = C + Math.cos(t) * R_LABEL;
          const y = C + Math.sin(t) * R_LABEL;
          const selected = mode === "hour" ? v === value : v === value;
          const disabled = isDisabled?.(v) ?? false;
          return (
            <text key={v} x={x} y={y} textAnchor="middle" dominantBaseline="central"
                  style={{ fontSize: 15, fontWeight: selected ? 700 : 500, pointerEvents: "none", fontFamily: "inherit" }}
                  fill={selected ? "#FFFFFF" : disabled ? "#CBD5E1" : "#0F172A"}>
              {mode === "minute" ? String(v).padStart(2, "0") : v}
            </text>
          );
        })}
      </Box>
    </Box>
  );
}
