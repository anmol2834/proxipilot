import { PaletteMode, PaletteOptions } from "@mui/material";

export const lightPalette: PaletteOptions = {
  mode: "light" as PaletteMode,
  primary: {
    main: "#635BFF", // Primary Accent
    light: "#7D76FF",
    dark: "#4D45E0",
    contrastText: "#FFFFFF",
  },
  secondary: {
    main: "#4F7CFF", // Secondary Accent
    light: "#7598FF",
    dark: "#3361E6",
    contrastText: "#FFFFFF",
  },
  success: {
    main: "#16A36A", // Success
    light: "#22C55E",
    dark: "#15803D",
    contrastText: "#FFFFFF",
  },
  warning: {
    main: "#F59E0B",
    light: "#FBBF24",
    dark: "#D97706",
    contrastText: "#FFFFFF",
  },
  error: {
    main: "#EF4444",
    light: "#F87171",
    dark: "#DC2626",
    contrastText: "#FFFFFF",
  },
  info: {
    main: "#4F7CFF",
    light: "#7598FF",
    dark: "#3361E6",
    contrastText: "#FFFFFF",
  },
  background: {
    default: "#FFFFFF", // Clean White Base
    paper: "#F8FAFC", // Soft Background
  },
  text: {
    primary: "#111827", // Primary Text
    secondary: "#64748B", // Secondary Text
    disabled: "#94A3B8",
  },
  divider: "#E6EAF0", // Clean Border
  action: {
    active: "#64748B",
    hover: "rgba(17, 24, 39, 0.04)",
    selected: "rgba(99, 91, 255, 0.08)",
    disabled: "rgba(17, 24, 39, 0.26)",
    disabledBackground: "rgba(17, 24, 39, 0.12)",
  },
};

export const darkPalette: PaletteOptions = {
  mode: "dark" as PaletteMode,
  primary: {
    main: "#6366f1", // Indigo 500
    light: "#a5b4fc",
    dark: "#4338ca",
    contrastText: "#ffffff",
  },
  secondary: {
    main: "#8b5cf6", // Violet 500
    light: "#c4b5fd",
    dark: "#6d28d9",
    contrastText: "#ffffff",
  },
  success: {
    main: "#10b981",
    light: "#34d399",
    dark: "#059669",
    contrastText: "#ffffff",
  },
  warning: {
    main: "#f59e0b",
    light: "#fbbf24",
    dark: "#d97706",
    contrastText: "#ffffff",
  },
  error: {
    main: "#f87171",
    light: "#fca5a5",
    dark: "#dc2626",
    contrastText: "#ffffff",
  },
  info: {
    main: "#60a5fa",
    light: "#93c5fd",
    dark: "#2563eb",
    contrastText: "#ffffff",
  },
  background: {
    default: "#020617", // Slate 950
    paper: "#0f172a", // Slate 900
  },
  text: {
    primary: "#f8fafc", // Slate 50
    secondary: "#94a3b8", // Slate 400
    disabled: "#475569", // Slate 600
  },
  divider: "#1e293b", // Slate 800
  action: {
    active: "#94a3b8",
    hover: "rgba(255, 255, 255, 0.05)",
    selected: "rgba(99, 102, 241, 0.16)",
    disabled: "rgba(255, 255, 255, 0.3)",
    disabledBackground: "rgba(255, 255, 255, 0.12)",
  },
};
