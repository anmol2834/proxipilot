"use client";

import React from "react";
import Link from "next/link";

export interface ExpandableCtaButtonProps {
  /** Label displayed inside the button */
  text: string;
  /** Optional link destination (renders Next.js Link) */
  href?: string;
  /** Size scale: 'sm' for navbar, 'md' for standard, 'lg' for hero/CTA */
  size?: "sm" | "md" | "lg";
  /** Color theme variant */
  variant?: "indigo" | "blue" | "purple";
  /** Expand to fill full parent container width */
  fullWidth?: boolean;
  /** Optional click handler */
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  /** Additional CSS class name */
  className?: string;
  /** Inline style overrides */
  style?: React.CSSProperties;
  /** Accessible label */
  ariaLabel?: string;
  /** Optional button type if not a link */
  type?: "button" | "submit" | "reset";
}

/**
 * Interactive Expandable CTA Button Component
 * Inspired by Uiverse.io by adamgiebl.
 *
 * Tailored for ProxiPilot:
 * - Fluid expanding white bubble on hover with arrow glide animation
 * - Scaled size variants (sm, md, lg) with exact visual proportions
 * - Brand indigo/blue gradients and hardware-accelerated transitions
 */
export const ExpandableCtaButton: React.FC<ExpandableCtaButtonProps> = ({
  text,
  href,
  size = "md",
  variant = "indigo",
  fullWidth = false,
  onClick,
  className = "",
  style,
  ariaLabel,
  type = "button",
}) => {
  const variantClass = variant !== "indigo" ? `variant-${variant}` : "";
  const sizeClass = `size-${size}`;
  const fullWidthClass = fullWidth ? "full-width" : "";
  const combinedClasses = `proxipilot-cta-btn ${sizeClass} ${variantClass} ${fullWidthClass} ${className}`.trim();

  const arrowIcon = (
    <div className="btn-icon" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        fill="currentColor"
      >
        <path d="M0 0h24v24H0z" fill="none" />
        <path d="M16.172 11l-5.364-5.364 1.414-1.414L20 12l-7.778 7.778-1.414-1.414L16.172 13H4v-2z" />
      </svg>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={combinedClasses}
        style={style}
        onClick={onClick}
        aria-label={ariaLabel || text}
      >
        <span className="btn-text">{text}</span>
        {arrowIcon}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={combinedClasses}
      style={style}
      onClick={onClick}
      aria-label={ariaLabel || text}
    >
      <span className="btn-text">{text}</span>
      {arrowIcon}
    </button>
  );
};

export default ExpandableCtaButton;
