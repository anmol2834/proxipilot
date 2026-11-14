"use client";

import React, { useState, useRef, useEffect } from "react";

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
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize options to CustomSelectOption format
  const normalizedOptions: CustomSelectOption[] = options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    } else if (e.key === "ArrowDown" && !isOpen) {
      e.preventDefault();
      setIsOpen(true);
    }
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
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
        type="button"
        id={id}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
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

        {/* Animated Chevron Down Icon */}
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

      {/* Floating Dropdown Menu Panel */}
      {isOpen && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 5px)",
            left: 0,
            right: 0,
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            boxShadow:
              "0 16px 36px -4px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(15, 23, 42, 0.04)",
            maxHeight: "260px",
            overflowY: "auto",
            zIndex: 60,
            padding: "5px",
            animation: "ppDropdownFadeIn 0.15s ease-out both",
          }}
        >
          {normalizedOptions.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(opt.value)}
                style={{
                  padding: opt.description ? "8px 10px" : "8px 10px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  backgroundColor: isSelected ? "#eff6ff" : "transparent",
                  color: isSelected ? "#3562f5" : "#0f172a",
                  transition: "background-color 0.12s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = "#f8fafc";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
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
        </div>
      )}

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
