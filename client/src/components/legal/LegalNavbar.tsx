"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ProxiPilotLogo } from "@/components/ui/ProxiPilotLogo";
import { IconMenu2, IconX, IconArrowRight, IconShieldCheck } from "@tabler/icons-react";

export function LegalNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        width: "100%",
        backgroundColor: "rgba(255, 255, 255, 0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid #E2E8F0",
      }}
    >
      <div
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          padding: "0 20px",
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Brand & Badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ProxiPilotLogo size={28} href="/" textSize="1.15rem" />
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              padding: "2px 7px",
              borderRadius: 6,
              background: "#EFF6FF",
              color: "#2563EB",
              border: "1px solid #DBEAFE",
            }}
          >
            <IconShieldCheck size={12} stroke={2.5} />
            Legal Center
          </span>
        </div>

        {/* Desktop Quick Nav */}
        <nav
          aria-label="Legal header navigation"
          style={{
            display: "none",
            alignItems: "center",
            gap: 24,
          }}
          className="legal-nav-desktop"
        >
          <Link
            href="/"
            style={{
              fontSize: 13.5,
              fontWeight: 500,
              color: "#475569",
              textDecoration: "none",
              transition: "color 140ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#0F172A")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#475569")}
          >
            Product
          </Link>
          <Link
            href="/#pricing"
            style={{
              fontSize: 13.5,
              fontWeight: 500,
              color: "#475569",
              textDecoration: "none",
              transition: "color 140ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#0F172A")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#475569")}
          >
            Pricing
          </Link>
          <Link
            href="/terms"
            style={{
              fontSize: 13.5,
              fontWeight: 500,
              color: "#475569",
              textDecoration: "none",
              transition: "color 140ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#0F172A")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#475569")}
          >
            Terms
          </Link>
          <Link
            href="/privacy"
            style={{
              fontSize: 13.5,
              fontWeight: 500,
              color: "#475569",
              textDecoration: "none",
              transition: "color 140ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#0F172A")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#475569")}
          >
            Privacy
          </Link>
          <Link
            href="/security"
            style={{
              fontSize: 13.5,
              fontWeight: 500,
              color: "#475569",
              textDecoration: "none",
              transition: "color 140ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#0F172A")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#475569")}
          >
            Security
          </Link>
          <Link
            href="/dpa"
            style={{
              fontSize: 13.5,
              fontWeight: 500,
              color: "#475569",
              textDecoration: "none",
              transition: "color 140ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#0F172A")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#475569")}
          >
            DPA
          </Link>
        </nav>

        {/* CTA Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            href="/signin"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#334155",
              textDecoration: "none",
              padding: "6px 12px",
              borderRadius: 6,
              transition: "color 140ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#0F172A")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
          >
            Sign in
          </Link>

          <Link
            href="/signup"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 13,
              fontWeight: 600,
              color: "#FFFFFF",
              backgroundColor: "#2563EB",
              textDecoration: "none",
              padding: "7px 14px",
              borderRadius: 7,
              boxShadow: "0 1px 3px rgba(37,99,235,0.3)",
              transition: "background-color 140ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1D4ED8")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#2563EB")}
          >
            <span>Get started</span>
            <IconArrowRight size={14} />
          </Link>

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            className="legal-nav-mobile-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            style={{
              display: "none",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 6,
              border: "1px solid #E2E8F0",
              background: "#F8FAFC",
              color: "#334155",
              cursor: "pointer",
            }}
          >
            {mobileMenuOpen ? <IconX size={18} /> : <IconMenu2 size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          style={{
            borderTop: "1px solid #E2E8F0",
            backgroundColor: "#FFFFFF",
            padding: "14px 20px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            style={{ fontSize: 14, color: "#1E293B", textDecoration: "none", fontWeight: 500 }}
          >
            Product Overview
          </Link>
          <Link
            href="/terms"
            onClick={() => setMobileMenuOpen(false)}
            style={{ fontSize: 14, color: "#1E293B", textDecoration: "none", fontWeight: 500 }}
          >
            Terms of Service
          </Link>
          <Link
            href="/privacy"
            onClick={() => setMobileMenuOpen(false)}
            style={{ fontSize: 14, color: "#1E293B", textDecoration: "none", fontWeight: 500 }}
          >
            Privacy Policy
          </Link>
          <Link
            href="/security"
            onClick={() => setMobileMenuOpen(false)}
            style={{ fontSize: 14, color: "#1E293B", textDecoration: "none", fontWeight: 500 }}
          >
            Security & Trust Center
          </Link>
          <Link
            href="/dpa"
            onClick={() => setMobileMenuOpen(false)}
            style={{ fontSize: 14, color: "#1E293B", textDecoration: "none", fontWeight: 500 }}
          >
            Data Processing Agreement
          </Link>
          <Link
            href="/privacy-request"
            onClick={() => setMobileMenuOpen(false)}
            style={{ fontSize: 14, color: "#2563EB", textDecoration: "none", fontWeight: 600 }}
          >
            Submit Privacy Request →
          </Link>
        </div>
      )}

      <style jsx global>{`
        @media (min-width: 768px) {
          .legal-nav-desktop {
            display: flex !important;
          }
          .legal-nav-mobile-btn {
            display: none !important;
          }
        }
        @media (max-width: 767px) {
          .legal-nav-desktop {
            display: none !important;
          }
          .legal-nav-mobile-btn {
            display: flex !important;
          }
        }
      `}</style>
    </header>
  );
}
