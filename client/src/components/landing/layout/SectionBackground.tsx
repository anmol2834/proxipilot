import React from "react";
import Box from "@mui/material/Box";

export interface SectionBackgroundProps {
  variant?: "clean" | "ambient" | "grid" | "dots" | "glow" | "kencode";
  className?: string;
}

export function SectionBackground({ variant = "clean", className = "" }: SectionBackgroundProps) {
  if (variant === "clean") return null;

  return (
    <Box
      aria-hidden="true"
      sx={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
      }}
      className={className}
    >
      {variant === "kencode" && <div className="hero-kencode-bg" />}
      {variant === "ambient" && <div className="texture-ambient-top" />}
      {variant === "grid" && <div className="texture-grid" />}
      {variant === "dots" && <div className="texture-dots" />}
      {variant === "glow" && (
        <div
          className="texture-glow-accent"
          style={{ top: "10%", left: "50%", transform: "translateX(-50%)" }}
        />
      )}
    </Box>
  );
}
