"use client";

import React, { useMemo, useState, useCallback, useRef } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import { IconCheck, IconClock, IconSparkles, IconX } from "@tabler/icons-react";

interface ModernClockTimePickerProps {
  value: string; // "HH:mm" (24-hour format, e.g. "09:00" or "18:30")
  onChange: (val: string) => void;
  disabled?: boolean;
  label?: string;
}

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const PRESETS = [
  { label: "09:00 AM", value: "09:00" },
  { label: "10:00 AM", value: "10:00" },
  { label: "01:00 PM", value: "13:00" },
  { label: "05:00 PM", value: "17:00" },
  { label: "06:00 PM", value: "18:00" },
];

export function ModernClockTimePicker({
  value = "09:00",
  onChange,
  disabled = false,
  label,
}: ModernClockTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"hours" | "minutes">("hours");
  const dialRef = useRef<HTMLDivElement | null>(null);

  // Parse current 24h value into 12h components
  const { hour24, minute, hour12, isPM, formatted12h, formatted24h } = useMemo(() => {
    const parts = (value || "09:00").split(":");
    const h24 = Math.min(23, Math.max(0, parseInt(parts[0], 10) || 0));
    const m = Math.min(59, Math.max(0, parseInt(parts[1], 10) || 0));
    const pm = h24 >= 12;
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    const f12 = `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${pm ? "PM" : "AM"}`;
    const f24 = `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    return {
      hour24: h24,
      minute: m,
      hour12: h12,
      isPM: pm,
      formatted12h: f12,
      formatted24h: f24,
    };
  }, [value]);

  const handleOpen = () => {
    if (disabled) return;
    setIsOpen(true);
    setMode("hours");
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const updateTime = useCallback(
    (newHour12: number, newMinute: number, newIsPM: boolean) => {
      let finalH24 = newHour12 % 12;
      if (newIsPM) finalH24 += 12;
      const formatted = `${String(finalH24).padStart(2, "0")}:${String(newMinute).padStart(2, "0")}`;
      onChange(formatted);
    },
    [onChange]
  );

  const handleSelectHour = (h: number) => {
    updateTime(h, minute, isPM);
    // Smooth transition to minutes after selecting hour
    setTimeout(() => {
      setMode("minutes");
    }, 140);
  };

  const handleSelectMinute = (m: number) => {
    updateTime(hour12, m, isPM);
  };

  const toggleAmPm = (targetPm: boolean) => {
    if (targetPm === isPM) return;
    updateTime(hour12, minute, targetPm);
  };

  const handleDialClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dialRef.current) return;
    const rect = dialRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;

    // Angle clockwise from 12 o'clock in radians
    let angle = Math.atan2(dx, -dy);
    if (angle < 0) angle += 2 * Math.PI;

    if (mode === "hours") {
      let h = Math.round(angle / (Math.PI / 6));
      if (h === 0) h = 12;
      handleSelectHour(h);
    } else {
      let m = Math.round(angle / (Math.PI / 30));
      if (m === 60) m = 0;
      // Snap to nearest 5 minutes if clicking on dial
      m = Math.round(m / 5) * 5;
      if (m === 60) m = 0;
      handleSelectMinute(m);
    }
  };

  // Coordinates for the selected indicator and hand
  const currentAngle = useMemo(() => {
    if (mode === "hours") {
      return (hour12 % 12) * (Math.PI / 6);
    } else {
      return (minute / 60) * (2 * Math.PI);
    }
  }, [mode, hour12, minute]);

  const DIAL_RADIUS = 76;
  const CENTER = 110;
  const handTargetX = CENTER + DIAL_RADIUS * Math.sin(currentAngle);
  const handTargetY = CENTER - DIAL_RADIUS * Math.cos(currentAngle);

  return (
    <>
      {/* Modern Trigger Button */}
      <ButtonBase
        onClick={handleOpen}
        disabled={disabled}
        aria-label={label || "Select time"}
        aria-haspopup="dialog"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 1.25,
          px: 1.5,
          py: 0.75,
          borderRadius: "10px",
          border: isOpen ? "1.5px solid #4F46E5" : "1px solid #D0D5DD",
          backgroundColor: isOpen ? "#F8FAFC" : "#FFFFFF",
          boxShadow: isOpen
            ? "0px 0px 0px 3px rgba(79, 70, 229, 0.12)"
            : "0px 1px 2px rgba(16, 24, 40, 0.04)",
          cursor: disabled ? "default" : "pointer",
          transition: "all 0.15s ease",
          "&:hover": !disabled
            ? {
                borderColor: "#4F46E5",
                backgroundColor: "#F8FAFC",
                boxShadow: "0px 2px 6px rgba(79, 70, 229, 0.08)",
              }
            : {},
        }}
      >
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: "7px",
            backgroundColor: "#EEF2FF",
            color: "#4F46E5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconClock size={16} stroke={2.2} />
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <Typography
            sx={{
              fontSize: 13.5,
              fontWeight: 700,
              color: "#101828",
              letterSpacing: "0.01em",
              lineHeight: 1.2,
            }}
          >
            {formatted12h}
          </Typography>
        </Box>
        <Box
          sx={{
            px: 0.75,
            py: 0.25,
            borderRadius: "5px",
            backgroundColor: "#F1F5F9",
            color: "#64748B",
            fontSize: 11,
            fontWeight: 600,
            lineHeight: 1,
            ml: 0.5,
          }}
        >
          {formatted24h}
        </Box>
      </ButtonBase>

      {/* Centered Modal with Backdrop Blur */}
      <Dialog
        open={isOpen}
        onClose={handleClose}
        maxWidth="xs"
        fullWidth
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: "rgba(16, 24, 40, 0.6)",
              backdropFilter: "blur(6px)",
            },
          },
          paper: {
            sx: {
              borderRadius: "24px",
              border: "1px solid #E0E7FF",
              p: { xs: 2.5, sm: 3 },
              maxWidth: 360,
              width: "100%",
              backgroundColor: "#FFFFFF",
              boxShadow:
                "0px 24px 48px -12px rgba(16, 24, 40, 0.25), 0px 8px 16px -4px rgba(16, 24, 40, 0.08)",
              m: 2,
            },
          },
        }}
      >
        {/* Modal Header */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: "8px",
                backgroundColor: "#EEF2FF",
                color: "#4F46E5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconClock size={18} stroke={2.2} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 15, fontWeight: 700, color: "#101828", lineHeight: 1.2 }}>
                {label || "Select Time"}
              </Typography>
              <Typography sx={{ fontSize: 11.5, color: "#667085", mt: 0.25 }}>
                24-hour format: <strong>{formatted24h}</strong>
              </Typography>
            </Box>
          </Box>
          <IconButton
            size="small"
            onClick={handleClose}
            sx={{
              color: "#98A2B3",
              borderRadius: "8px",
              "&:hover": { color: "#1E293B", backgroundColor: "#F1F5F9" },
            }}
          >
            <IconX size={18} />
          </IconButton>
        </Box>

        {/* Digital Time Header & AM/PM Toggle */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            p: 1.5,
            borderRadius: "14px",
            backgroundColor: "#F8FAFC",
            border: "1px solid #EAECF0",
            mb: 2,
          }}
        >
          {/* Hour & Minute Digits */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            {/* Hour Block */}
            <ButtonBase
              onClick={() => setMode("hours")}
              sx={{
                px: 1.5,
                py: 0.5,
                borderRadius: "10px",
                backgroundColor: mode === "hours" ? "#EEF2FF" : "#FFFFFF",
                border: mode === "hours" ? "1.5px solid #4F46E5" : "1px solid #D0D5DD",
                color: mode === "hours" ? "#4F46E5" : "#1E293B",
                fontWeight: 800,
                fontSize: 26,
                fontFamily: "inherit",
                minWidth: 54,
                boxShadow: mode === "hours" ? "0px 2px 4px rgba(79, 70, 229, 0.12)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              {String(hour12).padStart(2, "0")}
            </ButtonBase>

            <Typography sx={{ fontSize: 24, fontWeight: 700, color: "#94A3B8" }}>:</Typography>

            {/* Minute Block */}
            <ButtonBase
              onClick={() => setMode("minutes")}
              sx={{
                px: 1.5,
                py: 0.5,
                borderRadius: "10px",
                backgroundColor: mode === "minutes" ? "#EEF2FF" : "#FFFFFF",
                border: mode === "minutes" ? "1.5px solid #4F46E5" : "1px solid #D0D5DD",
                color: mode === "minutes" ? "#4F46E5" : "#1E293B",
                fontWeight: 800,
                fontSize: 26,
                fontFamily: "inherit",
                minWidth: 54,
                boxShadow: mode === "minutes" ? "0px 2px 4px rgba(79, 70, 229, 0.12)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              {String(minute).padStart(2, "0")}
            </ButtonBase>
          </Box>

          {/* AM / PM Segmented Control */}
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              borderRadius: "10px",
              backgroundColor: "#FFFFFF",
              border: "1px solid #D0D5DD",
              overflow: "hidden",
            }}
          >
            <ButtonBase
              onClick={() => toggleAmPm(false)}
              sx={{
                px: 1.5,
                py: 0.6,
                fontSize: 12,
                fontWeight: 700,
                backgroundColor: !isPM ? "#4F46E5" : "transparent",
                color: !isPM ? "#FFFFFF" : "#64748B",
                transition: "all 0.15s ease",
              }}
            >
              AM
            </ButtonBase>
            <ButtonBase
              onClick={() => toggleAmPm(true)}
              sx={{
                px: 1.5,
                py: 0.6,
                fontSize: 12,
                fontWeight: 700,
                borderTop: "1px solid #EAECF0",
                backgroundColor: isPM ? "#4F46E5" : "transparent",
                color: isPM ? "#FFFFFF" : "#64748B",
                transition: "all 0.15s ease",
              }}
            >
              PM
            </ButtonBase>
          </Box>
        </Box>

        {/* Mode Selector Sub-header */}
        <Box sx={{ display: "flex", gap: 1, mb: 1.5 }}>
          <ButtonBase
            onClick={() => setMode("hours")}
            sx={{
              flex: 1,
              py: 0.75,
              borderRadius: "8px",
              fontSize: 12,
              fontWeight: 700,
              backgroundColor: mode === "hours" ? "#EEF2FF" : "#F8FAFC",
              color: mode === "hours" ? "#4F46E5" : "#64748B",
              border: mode === "hours" ? "1px solid #C7D2FE" : "1px solid #E2E8F0",
              transition: "all 0.15s ease",
            }}
          >
            Select Hour (1–12)
          </ButtonBase>
          <ButtonBase
            onClick={() => setMode("minutes")}
            sx={{
              flex: 1,
              py: 0.75,
              borderRadius: "8px",
              fontSize: 12,
              fontWeight: 700,
              backgroundColor: mode === "minutes" ? "#EEF2FF" : "#F8FAFC",
              color: mode === "minutes" ? "#4F46E5" : "#64748B",
              border: mode === "minutes" ? "1px solid #C7D2FE" : "1px solid #E2E8F0",
              transition: "all 0.15s ease",
            }}
          >
            Select Minute (00–55)
          </ButtonBase>
        </Box>

        {/* Visual Clock Face Dial */}
        <Box
          ref={dialRef}
          onClick={handleDialClick}
          sx={{
            width: 220,
            height: 220,
            borderRadius: "50%",
            margin: "0 auto 16px auto",
            position: "relative",
            backgroundColor: "#F8FAFC",
            border: "1.5px solid #E2E8F0",
            boxShadow: "inset 0px 2px 5px rgba(16, 24, 40, 0.05)",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          {/* SVG Clock Hand & Pointer Center */}
          <svg
            width="220"
            height="220"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              pointerEvents: "none",
            }}
          >
            {/* Clock Hand Line */}
            <line
              x1={CENTER}
              y1={CENTER}
              x2={handTargetX}
              y2={handTargetY}
              stroke="#4F46E5"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Center Pivot Dot */}
            <circle cx={CENTER} cy={CENTER} r="5.5" fill="#4F46E5" />
            <circle cx={CENTER} cy={CENTER} r="2.5" fill="#FFFFFF" />

            {/* Selected Tip Indicator Ball */}
            <circle
              cx={handTargetX}
              cy={handTargetY}
              r="16"
              fill="#4F46E5"
              style={{
                filter: "drop-shadow(0px 2px 4px rgba(79, 70, 229, 0.35))",
                transition: "cx 0.15s ease, cy 0.15s ease",
              }}
            />
          </svg>

          {/* Clock Numbers Overlay */}
          {mode === "hours"
            ? HOURS.map((h) => {
                const angle = (h % 12) * (Math.PI / 6);
                const x = CENTER + DIAL_RADIUS * Math.sin(angle);
                const y = CENTER - DIAL_RADIUS * Math.cos(angle);
                const isSelected = hour12 === h;

                return (
                  <Box
                    key={`hour-${h}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectHour(h);
                    }}
                    sx={{
                      position: "absolute",
                      left: x,
                      top: y,
                      transform: "translate(-50%, -50%)",
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13.5,
                      fontWeight: isSelected ? 800 : 600,
                      color: isSelected ? "#FFFFFF" : "#334155",
                      cursor: "pointer",
                      zIndex: 2,
                      transition: "color 0.15s ease",
                      "&:hover": {
                        color: isSelected ? "#FFFFFF" : "#4F46E5",
                      },
                    }}
                  >
                    {h}
                  </Box>
                );
              })
            : MINUTES.map((m) => {
                const angle = (m / 60) * (2 * Math.PI);
                const x = CENTER + DIAL_RADIUS * Math.sin(angle);
                const y = CENTER - DIAL_RADIUS * Math.cos(angle);
                const isSelected = minute === m;

                return (
                  <Box
                    key={`min-${m}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectMinute(m);
                    }}
                    sx={{
                      position: "absolute",
                      left: x,
                      top: y,
                      transform: "translate(-50%, -50%)",
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: isSelected ? 800 : 600,
                      color: isSelected ? "#FFFFFF" : "#334155",
                      cursor: "pointer",
                      zIndex: 2,
                      transition: "color 0.15s ease",
                      "&:hover": {
                        color: isSelected ? "#FFFFFF" : "#4F46E5",
                      },
                    }}
                  >
                    {String(m).padStart(2, "0")}
                  </Box>
                );
              })}
        </Box>

        {/* Quick Presets Bar */}
        <Box sx={{ mb: 2 }}>
          <Typography
            sx={{
              fontSize: 10.5,
              fontWeight: 700,
              color: "#64748B",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              mb: 0.75,
            }}
          >
            Quick Presets
          </Typography>
          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
            {PRESETS.map((p) => {
              const isActive = value === p.value;
              return (
                <ButtonBase
                  key={p.value}
                  onClick={() => onChange(p.value)}
                  sx={{
                    px: 1,
                    py: 0.4,
                    borderRadius: "6px",
                    fontSize: 11,
                    fontWeight: 600,
                    backgroundColor: isActive ? "#EEF2FF" : "#F8FAFC",
                    color: isActive ? "#4F46E5" : "#475467",
                    border: isActive ? "1px solid #4F46E5" : "1px solid #E2E8F0",
                    transition: "all 0.12s ease",
                    "&:hover": {
                      backgroundColor: "#EEF2FF",
                      color: "#4F46E5",
                      borderColor: "#C7D2FE",
                    },
                  }}
                >
                  {p.label}
                </ButtonBase>
              );
            })}
          </Box>
        </Box>

        {/* Footer Actions */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 1 }}>
          <Button
            variant="text"
            size="small"
            onClick={handleClose}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              fontSize: 13,
              color: "#64748B",
              borderRadius: "8px",
              px: 2,
              "&:hover": { backgroundColor: "#F1F5F9", color: "#1E293B" },
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={handleClose}
            startIcon={<IconCheck size={16} />}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              fontSize: 13,
              borderRadius: "10px",
              backgroundColor: "#4F46E5",
              px: 3,
              py: 0.8,
              boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
              "&:hover": {
                backgroundColor: "#4338CA",
              },
            }}
          >
            Apply Time
          </Button>
        </Box>
      </Dialog>
    </>
  );
}
