import { TypographyVariantsOptions } from "@mui/material/styles";

export const typography: TypographyVariantsOptions = {
  fontFamily: [
    "var(--font-inter)",
    "-apple-system",
    "BlinkMacSystemFont",
    '"Segoe UI"',
    "Roboto",
    '"Helvetica Neue"',
    "Arial",
    "sans-serif",
  ].join(","),
  h1: {
    fontSize: "2.25rem", // 36px
    fontWeight: 700,
    lineHeight: 1.25,
    letterSpacing: "-0.025em",
  },
  h2: {
    fontSize: "1.875rem", // 30px
    fontWeight: 700,
    lineHeight: 1.3,
    letterSpacing: "-0.02em",
  },
  h3: {
    fontSize: "1.5rem", // 24px
    fontWeight: 600,
    lineHeight: 1.35,
    letterSpacing: "-0.015em",
  },
  h4: {
    fontSize: "1.25rem", // 20px
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: "-0.01em",
  },
  h5: {
    fontSize: "1.125rem", // 18px
    fontWeight: 600,
    lineHeight: 1.45,
  },
  h6: {
    fontSize: "1rem", // 16px
    fontWeight: 600,
    lineHeight: 1.5,
  },
  subtitle1: {
    fontSize: "1rem",
    fontWeight: 500,
    lineHeight: 1.5,
  },
  subtitle2: {
    fontSize: "0.875rem",
    fontWeight: 500,
    lineHeight: 1.5,
  },
  body1: {
    fontSize: "0.9375rem", // 15px
    fontWeight: 400,
    lineHeight: 1.6,
  },
  body2: {
    fontSize: "0.875rem", // 14px
    fontWeight: 400,
    lineHeight: 1.5,
  },
  button: {
    fontSize: "0.875rem",
    fontWeight: 600,
    textTransform: "none",
    letterSpacing: "0.01em",
  },
  caption: {
    fontSize: "0.75rem",
    fontWeight: 400,
    lineHeight: 1.4,
  },
  overline: {
    fontSize: "0.6875rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
};
