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
}

export function ProxiPilotLogo({
  size = 32,
  showText = true,
  textColor = "#0F172A",
  textSize = "1.2rem",
  textWeight = 800,
  href,
  className = "",
}: ProxiPilotLogoProps) {
  const content = (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: Math.max(8, Math.round(size * 0.28)),
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
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
        aria-hidden="true"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/Proxipilot logo.svg"
          alt="ProxiPilot Logo"
          width={size}
          height={size}
          style={{
            width: size,
            height: size,
            objectFit: "contain",
            display: "block",
          }}
        />
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
