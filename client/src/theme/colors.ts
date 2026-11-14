// ==============================================================================
// ProxiPilot Design System Color Tokens
// ==============================================================================

export const colors = {
  // Brand Backgrounds
  background: "#FFFFFF",
  backgroundSoft: "#F8FAFC",
  backgroundMuted: "#F1F5F9",

  // Text Hierarchy
  textPrimary: "#111827",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",
  textWhite: "#FFFFFF",

  // Structural & Borders
  border: "#E6EAF0",
  borderLight: "#F1F5F9",
  borderDark: "#CBD5E1",

  // Accents & Actions
  primaryAccent: "#635BFF", // Indigo Accent
  primaryAccentLight: "#7D76FF",
  primaryAccentDark: "#4D45E0",

  secondaryAccent: "#4F7CFF", // Electric Blue
  secondaryAccentLight: "#7598FF",
  secondaryAccentDark: "#3361E6",

  // Semantic Status
  success: "#16A36A",
  successLight: "#22C55E",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#4F7CFF",
} as const;

export type ColorToken = keyof typeof colors;
