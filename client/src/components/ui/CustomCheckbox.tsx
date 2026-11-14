"use client";

import React, { forwardRef, useEffect, useRef } from "react";

export interface CustomCheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Optional label placed next to the checkmark */
  label?: React.ReactNode;
  /** Size scale: 'sm' (15px), 'md' (18px), 'lg' (22px) */
  size?: "sm" | "md" | "lg";
  /** Brand color variant */
  variant?: "indigo" | "blue";
  /** Indeterminate state (e.g. table header selection) */
  indeterminate?: boolean;
  /** Visual error state indicator */
  error?: boolean;
  /** Additional container class name */
  containerClassName?: string;
  /** Additional container style overrides */
  containerStyle?: React.CSSProperties;
  /** Accessible label */
  ariaLabel?: string;
}

/**
 * Animated Custom Checkbox Component
 * Inspired by Uiverse.io by SelfMadeSystem.
 *
 * Tailored for ProxiPilot:
 * - Fluid morphing CSS animation from box border to checkmark tick
 * - Fully accessible keyboard focusable via native hidden input
 * - React Hook Form & ref-forwarding compatible
 * - Indeterminate state support for data tables
 */
export const CustomCheckbox = forwardRef<HTMLInputElement, CustomCheckboxProps>(
  (
    {
      checked,
      defaultChecked,
      onChange,
      name,
      id,
      value,
      disabled = false,
      indeterminate = false,
      error = false,
      label,
      size = "md",
      variant = "indigo",
      className = "",
      containerClassName = "",
      containerStyle,
      ariaLabel,
      ...restProps
    },
    forwardedRef
  ) => {
    const innerRef = useRef<HTMLInputElement>(null);

    // Synchronize ref and indeterminate property on the underlying native DOM node
    useEffect(() => {
      const node = (forwardedRef && typeof forwardedRef !== "function"
        ? forwardedRef.current
        : innerRef.current) as HTMLInputElement | null;

      if (node) {
        node.indeterminate = Boolean(indeterminate);
      }
    }, [indeterminate, forwardedRef]);

    const sizeClass = `size-${size}`;
    const variantClass = variant === "blue" ? "variant-blue" : "";
    const errorClass = error ? "has-error" : "";
    const disabledClass = disabled ? "disabled" : "";

    const wrapperClasses = [
      "proxipilot-checkbox-wrapper",
      sizeClass,
      variantClass,
      errorClass,
      disabledClass,
      containerClassName,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <label className={wrapperClasses} style={containerStyle}>
        <input
          ref={(node) => {
            (innerRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
            if (typeof forwardedRef === "function") {
              forwardedRef(node);
            } else if (forwardedRef) {
              (forwardedRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
            }
          }}
          type="checkbox"
          checked={checked}
          defaultChecked={defaultChecked}
          onChange={onChange}
          name={name}
          id={id}
          value={value}
          disabled={disabled}
          aria-label={ariaLabel || (typeof label === "string" ? label : undefined)}
          className={className}
          {...restProps}
        />
        <span className="checkmark" aria-hidden="true" />
        {label && <span className="checkbox-label">{label}</span>}
      </label>
    );
  }
);

CustomCheckbox.displayName = "CustomCheckbox";

export default CustomCheckbox;
