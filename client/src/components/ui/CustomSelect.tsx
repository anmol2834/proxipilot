"use client";

/**
 * CustomSelect — accessible dropdown used by the signup steps.
 *
 * The option list is rendered in a portal with fixed positioning, so it is never clipped by a
 * parent's overflow or by the bottom of the window. It measures the space around the trigger,
 * opens downward when there is room and flips upward when there is not, caps its height to the
 * visible space, and follows the trigger on scroll and resize. Keyboard: Enter/Space/ArrowDown
 * open, ArrowUp/ArrowDown/Home/End move, Enter selects, Escape/Tab close.
 */

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface CustomSelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

export interface CustomSelectProps {
  id?: string;
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  options: (CustomSelectOption | string)[];
  error?: string;
  helperText?: string;
  startIcon?: React.ReactNode;
  disabled?: boolean;
  required?: boolean;
}

const GAP = 6;            // space between trigger and menu
const EDGE = 12;          // keep this far from the window edge
const MAX_HEIGHT = 280;   // tallest the menu gets when there is room
const MIN_COMFORT = 160;  // below this much room underneath, prefer opening upward

type Placement = { side: "bottom" | "top"; left: number; width: number; top?: number; bottom?: number; maxHeight: number };

export function CustomSelect({
  id,
  label,
  placeholder = "Select an option",
  value,
  onChange,
  options,
  error,
  helperText,
  startIcon,
  disabled = false,
  required = false,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const normalizedOptions: CustomSelectOption[] = options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );
  const selectedIndex = normalizedOptions.findIndex((opt) => opt.value === value);
  const selectedOption = selectedIndex >= 0 ? normalizedOptions[selectedIndex] : undefined;

  // ---- Positioning -------------------------------------------------------------------------
  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    const vh = window.innerHeight;
    const natural = Math.min(MAX_HEIGHT, menuRef.current?.scrollHeight ?? MAX_HEIGHT);
    const below = vh - r.bottom - GAP - EDGE;
    const above = r.top - GAP - EDGE;
    const openDown = below >= natural || below >= MIN_COMFORT || below >= above;
    const room = Math.max(120, openDown ? below : above);
    setPlacement({
      side: openDown ? "bottom" : "top",
      left: r.left,
      width: r.width,
      top: openDown ? r.bottom + GAP : undefined,
      bottom: openDown ? undefined : vh - r.top + GAP,
      maxHeight: Math.min(MAX_HEIGHT, room),
    });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) {
      setPlacement(null);
      return;
    }
    place();
    // Re-measure once the list has rendered (its natural height decides up vs down).
    const raf = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true); // capture: any scrolling ancestor
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [isOpen, place]);

  // ---- Open / close ------------------------------------------------------------------------
  const open = useCallback(() => {
    if (disabled) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setIsOpen(true);
  }, [disabled, selectedIndex]);

  const close = useCallback((refocus = false) => {
    setIsOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  // Close on outside press (the menu lives in a portal, so check both elements).
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [isOpen]);

  // Keep the active option visible while navigating.
  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    const el = menuRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [isOpen, activeIndex, placement?.maxHeight]);

  const handleSelect = (val: string) => {
    onChange(val);
    close(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    const last = normalizedOptions.length - 1;
    switch (e.key) {
      case "Escape":
        if (isOpen) {
          e.preventDefault();
          close(true);
        }
        break;
      case "Tab":
        if (isOpen) close();
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (!isOpen) open();
        else if (activeIndex >= 0 && activeIndex <= last) handleSelect(normalizedOptions[activeIndex].value);
        break;
      case "ArrowDown":
        e.preventDefault();
        if (!isOpen) open();
        else setActiveIndex((i) => Math.min(last, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!isOpen) open();
        else setActiveIndex((i) => Math.max(0, i - 1));
        break;
      case "Home":
        if (isOpen) {
          e.preventDefault();
          setActiveIndex(0);
        }
        break;
      case "End":
        if (isOpen) {
          e.preventDefault();
          setActiveIndex(last);
        }
        break;
    }
  };

  const menu =
    isOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            id={listboxId}
            role="listbox"
            aria-labelledby={id}
            style={{
              position: "fixed",
              left: placement?.left ?? 0,
              width: placement?.width ?? 0,
              top: placement?.top,
              bottom: placement?.bottom,
              maxHeight: placement?.maxHeight ?? MAX_HEIGHT,
              // Hidden for the first measuring frame so it never flashes in the wrong place.
              visibility: placement ? "visible" : "hidden",
              overflowY: "auto",
              overscrollBehavior: "contain",
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              boxShadow:
                placement?.side === "top"
                  ? "0 -16px 36px -4px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(15, 23, 42, 0.04)"
                  : "0 16px 36px -4px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(15, 23, 42, 0.04)",
              zIndex: 1500,
              padding: "5px",
              boxSizing: "border-box",
              transformOrigin: placement?.side === "top" ? "bottom center" : "top center",
              animation: `${placement?.side === "top" ? "ppDropdownFadeInUp" : "ppDropdownFadeIn"} 0.15s ease-out both`,
            }}
          >
            {normalizedOptions.map((opt, index) => {
              const isSelected = opt.value === value;
              const isActive = index === activeIndex;
              return (
                <div
                  key={opt.value}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  // Keep focus on the trigger so keyboard navigation continues to work.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(opt.value)}
                  onMouseEnter={() => setActiveIndex(index)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    backgroundColor: isSelected ? "#eff6ff" : isActive ? "#f8fafc" : "transparent",
                    color: isSelected ? "#3562f5" : "#0f172a",
                    transition: "background-color 0.12s ease",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: isSelected ? 600 : 500,
                        color: isSelected ? "#3562f5" : "#0f172a",
                      }}
                    >
                      {opt.label}
                    </div>
                    {opt.description && (
                      <div
                        style={{
                          fontSize: "0.74rem",
                          color: isSelected ? "#60a5fa" : "#64748b",
                          marginTop: "2px",
                        }}
                      >
                        {opt.description}
                      </div>
                    )}
                  </div>

                  {isSelected && (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#3562f5"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ flexShrink: 0 }}
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <div
      className="pp-custom-select-container"
      style={{
        position: "relative",
        width: "100%",
        userSelect: "none",
      }}
    >
      {label && (
        <label
          htmlFor={id}
          style={{
            display: "block",
            fontSize: "0.82rem",
            fontWeight: 600,
            color: "#0f172a",
            marginBottom: "5px",
          }}
        >
          {label} {required && <span style={{ color: "#3562f5" }}>*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        disabled={disabled}
        style={{
          width: "100%",
          height: "42px",
          padding: "0 12px",
          borderRadius: "10px",
          border: error
            ? "1px solid #ef4444"
            : isOpen
            ? "1px solid #3562f5"
            : "1px solid #e2e8f0",
          backgroundColor: disabled ? "#f8fafc" : "#ffffff",
          boxShadow: error
            ? "0 0 0 3px rgba(239, 68, 68, 0.12)"
            : isOpen
            ? "0 0 0 3px rgba(53, 98, 245, 0.14)"
            : "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          cursor: disabled ? "not-allowed" : "pointer",
          outline: "none",
          transition: "all 0.15s ease",
          textAlign: "left",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "9px",
            minWidth: 0,
            flex: 1,
          }}
        >
          {startIcon && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                color: "#94a3b8",
                flexShrink: 0,
              }}
            >
              {startIcon}
            </div>
          )}
          <span
            style={{
              fontSize: "0.86rem",
              color: selectedOption ? "#0f172a" : "#94a3b8",
              fontWeight: selectedOption ? 500 : 400,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        {/* Animated Chevron */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#94a3b8"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            flexShrink: 0,
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {menu}

      {/* Error or Helper Text */}
      {error ? (
        <span
          style={{
            display: "block",
            fontSize: "0.74rem",
            color: "#ef4444",
            marginTop: "4px",
          }}
        >
          {error}
        </span>
      ) : helperText ? (
        <span
          style={{
            display: "block",
            fontSize: "0.74rem",
            color: "#64748b",
            marginTop: "4px",
          }}
        >
          {helperText}
        </span>
      ) : null}
    </div>
  );
}
