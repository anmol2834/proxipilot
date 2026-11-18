"use client";

import React from "react";
import Link from "next/link";

export function LegalBreadcrumbs({ currentTitle }: { currentTitle: string }) {
  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 6,
        fontSize: 12.5,
        color: "#64748B",
        marginBottom: 12,
        lineHeight: 1.4,
      }}
    >
      <Link
        href="/"
        style={{
          color: "#64748B",
          textDecoration: "none",
          fontWeight: 500,
          transition: "color 150ms ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#2563EB")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#64748B")}
      >
        Home
      </Link>
      <span style={{ color: "#CBD5E1", userSelect: "none" }}>/</span>
      <Link
        href="/terms"
        style={{
          color: "#64748B",
          textDecoration: "none",
          fontWeight: 500,
          transition: "color 150ms ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#2563EB")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#64748B")}
      >
        Legal Center
      </Link>
      <span style={{ color: "#CBD5E1", userSelect: "none" }}>/</span>
      <span
        style={{
          color: "#0F172A",
          fontWeight: 600,
          maxWidth: 320,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {currentTitle}
      </span>
    </nav>
  );
}
