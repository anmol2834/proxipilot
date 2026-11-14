import React from "react";
import Link from "next/link";

export interface ProxiPilotLogoProps {
  size?: number;
  showText?: boolean;
  textColor?: string;
  textSize?: string | number;
  textWeight?: number | string;
  href?: string;
  className?: string;
  badgeBackground?: string;
  starColor?: string;
}

export function ProxiPilotLogo({
  size = 30,
  showText = true,
  textColor = "#0F172A",
  textSize = "1.2rem",
  textWeight = 800,
  href,
  className = "",
  badgeBackground = "#2563EB",
  starColor = "#FFFFFF",
}: ProxiPilotLogoProps) {
  const badgeRadius = Math.round(size * 0.28);
  const iconSize = Math.round(size * 0.58);

  const content = (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: Math.max(8, Math.round(size * 0.3)),
        textDecoration: "none",
        color: textColor,
        verticalAlign: "middle",
        lineHeight: 1,
      }}
    >
      <span
        style={{
          width: size,
          height: size,
          borderRadius: badgeRadius,
          backgroundColor: badgeBackground,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 2px 8px rgba(37, 99, 235, 0.28)",
        }}
        aria-hidden="true"
      >
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke={starColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        </svg>
      </span>

      {showText && (
        <span
          style={{
            fontWeight: textWeight,
            fontSize: textSize,
            letterSpacing: "-0.025em",
            color: textColor,
            fontFamily: "var(--font-inter), system-ui, -apple-system, sans-serif",
          }}
        >
          ProxiPilot
        </span>
      )}
    </span>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: "none" }} aria-label="ProxiPilot Home">
        {content}
      </Link>
    );
  }

  return content;
}
