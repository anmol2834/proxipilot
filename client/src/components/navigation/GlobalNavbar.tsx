"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProxiPilotLogo } from "@/components/ui/ProxiPilotLogo";
import { MAIN_NAVIGATION, NavLinkItem } from "@/config/site-navigation";
import {
  IconChevronDown,
  IconMenu2,
  IconX,
  IconArrowRight,
  IconSparkles,
  IconBuildingSkyscraper,
  IconBook,
  IconShieldCheck,
  IconMail,
} from "@tabler/icons-react";

export function GlobalNavbar() {
  const pathname = usePathname();
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileExpandedSection, setMobileExpandedSection] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Close dropdowns on route change
  useEffect(() => {
    setActiveDropdown(null);
    setMobileOpen(false);
  }, [pathname]);

  // Handle outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMouseEnter = (key: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActiveDropdown(key);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 180);
  };

  const toggleMobileSection = (key: string) => {
    setMobileExpandedSection((prev) => (prev === key ? null : key));
  };

  return (
    <header
      ref={navRef}
      style={{
        position: "sticky",
        top: 0,
        zIndex: 1000,
        width: "100%",
        backgroundColor: "rgba(255, 255, 255, 0.94)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: "1px solid #E2E8F0",
        transition: "all 180ms ease",
      }}
    >
      <div
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          padding: "0 24px",
          height: 68,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Brand Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <ProxiPilotLogo size={32} href="/" textSize="1.3rem" />

          {/* Desktop Navigation Links */}
          <nav
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
            className="hidden-mobile"
          >
            {/* Product Dropdown */}
            <div
              onMouseEnter={() => handleMouseEnter("product")}
              onMouseLeave={handleMouseLeave}
              style={{ position: "relative" }}
            >
              <button
                type="button"
                onClick={() => setActiveDropdown(activeDropdown === "product" ? null : "product")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "8px 12px",
                  fontSize: 14,
                  fontWeight: 500,
                  color: activeDropdown === "product" ? "#2563EB" : "#334155",
                  background: activeDropdown === "product" ? "#F1F5F9" : "transparent",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  transition: "all 140ms ease",
                }}
              >
                <span>Product</span>
                <IconChevronDown
                  size={14}
                  style={{
                    transform: activeDropdown === "product" ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 180ms ease",
                  }}
                />
              </button>

              {activeDropdown === "product" && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    width: 320,
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: 10,
                    padding: 8,
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
                    marginTop: 4,
                  }}
                >
                  {MAIN_NAVIGATION.product.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      style={{
                        display: "block",
                        padding: "10px 12px",
                        borderRadius: 6,
                        textDecoration: "none",
                        transition: "background-color 140ms ease",
                      }}
                      className="nav-dropdown-item"
                    >
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "#0F172A" }}>{item.title}</div>
                      <div style={{ fontSize: 12, color: "#64748B", marginTop: 2, lineHeight: 1.4 }}>
                        {item.description}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Solutions Dropdown / Mega Menu */}
            <div
              onMouseEnter={() => handleMouseEnter("solutions")}
              onMouseLeave={handleMouseLeave}
              style={{ position: "relative" }}
            >
              <button
                type="button"
                onClick={() => setActiveDropdown(activeDropdown === "solutions" ? null : "solutions")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "8px 12px",
                  fontSize: 14,
                  fontWeight: 500,
                  color: activeDropdown === "solutions" ? "#2563EB" : "#334155",
                  background: activeDropdown === "solutions" ? "#F1F5F9" : "transparent",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  transition: "all 140ms ease",
                }}
              >
                <span>Solutions</span>
                <IconChevronDown
                  size={14}
                  style={{
                    transform: activeDropdown === "solutions" ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 180ms ease",
                  }}
                />
              </button>

              {activeDropdown === "solutions" && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: -120,
                    width: 580,
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: 10,
                    padding: 12,
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
                    marginTop: 4,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 12px 10px",
                      borderBottom: "1px solid #F1F5F9",
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#64748B" }}>
                      Workflows by Industry & Team
                    </span>
                    <Link
                      href="/solutions"
                      style={{ fontSize: 12, fontWeight: 600, color: "#2563EB", textDecoration: "none" }}
                    >
                      All Solutions →
                    </Link>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                    {MAIN_NAVIGATION.solutions.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        style={{
                          display: "block",
                          padding: "8px 10px",
                          borderRadius: 6,
                          textDecoration: "none",
                          transition: "background-color 140ms ease",
                        }}
                        className="nav-dropdown-item"
                      >
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{item.title}</div>
                        <div
                          style={{
                            fontSize: 11.5,
                            color: "#64748B",
                            marginTop: 1,
                            lineHeight: 1.35,
                            display: "-webkit-box",
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {item.description}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Resources Dropdown */}
            <div
              onMouseEnter={() => handleMouseEnter("resources")}
              onMouseLeave={handleMouseLeave}
              style={{ position: "relative" }}
            >
              <button
                type="button"
                onClick={() => setActiveDropdown(activeDropdown === "resources" ? null : "resources")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "8px 12px",
                  fontSize: 14,
                  fontWeight: 500,
                  color: activeDropdown === "resources" ? "#2563EB" : "#334155",
                  background: activeDropdown === "resources" ? "#F1F5F9" : "transparent",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  transition: "all 140ms ease",
                }}
              >
                <span>Resources</span>
                <IconChevronDown
                  size={14}
                  style={{
                    transform: activeDropdown === "resources" ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 180ms ease",
                  }}
                />
              </button>

              {activeDropdown === "resources" && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    width: 320,
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: 10,
                    padding: 8,
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
                    marginTop: 4,
                  }}
                >
                  {MAIN_NAVIGATION.resources.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      style={{
                        display: "block",
                        padding: "10px 12px",
                        borderRadius: 6,
                        textDecoration: "none",
                        transition: "background-color 140ms ease",
                      }}
                      className="nav-dropdown-item"
                    >
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "#0F172A" }}>{item.title}</div>
                      <div style={{ fontSize: 12, color: "#64748B", marginTop: 2, lineHeight: 1.4 }}>
                        {item.description}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Company Dropdown */}
            <div
              onMouseEnter={() => handleMouseEnter("company")}
              onMouseLeave={handleMouseLeave}
              style={{ position: "relative" }}
            >
              <button
                type="button"
                onClick={() => setActiveDropdown(activeDropdown === "company" ? null : "company")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "8px 12px",
                  fontSize: 14,
                  fontWeight: 500,
                  color: activeDropdown === "company" ? "#2563EB" : "#334155",
                  background: activeDropdown === "company" ? "#F1F5F9" : "transparent",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  transition: "all 140ms ease",
                }}
              >
                <span>Company</span>
                <IconChevronDown
                  size={14}
                  style={{
                    transform: activeDropdown === "company" ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 180ms ease",
                  }}
                />
              </button>

              {activeDropdown === "company" && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    width: 320,
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: 10,
                    padding: 8,
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
                    marginTop: 4,
                  }}
                >
                  {MAIN_NAVIGATION.company.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      style={{
                        display: "block",
                        padding: "10px 12px",
                        borderRadius: 6,
                        textDecoration: "none",
                        transition: "background-color 140ms ease",
                      }}
                      className="nav-dropdown-item"
                    >
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "#0F172A" }}>{item.title}</div>
                      <div style={{ fontSize: 12, color: "#64748B", marginTop: 2, lineHeight: 1.4 }}>
                        {item.description}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Direct Links */}
            <Link
              href="/pricing"
              style={{
                padding: "8px 12px",
                fontSize: 14,
                fontWeight: 500,
                color: pathname === "/pricing" ? "#2563EB" : "#334155",
                textDecoration: "none",
                borderRadius: 6,
                transition: "all 140ms ease",
              }}
            >
              Pricing
            </Link>
          </nav>
        </div>

        {/* Right CTA Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link
            href="/signin"
            style={{
              fontSize: 13.5,
              fontWeight: 500,
              color: "#334155",
              textDecoration: "none",
              padding: "6px 12px",
              borderRadius: 6,
              transition: "color 140ms ease",
            }}
            className="hidden-mobile"
          >
            Sign in
          </Link>

          <Link
            href="/contact"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 13,
              fontWeight: 600,
              color: "#1E293B",
              backgroundColor: "#F1F5F9",
              border: "1px solid #CBD5E1",
              padding: "7px 14px",
              borderRadius: 6,
              textDecoration: "none",
              transition: "all 140ms ease",
            }}
            className="hidden-mobile"
          >
            Contact
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
              padding: "7px 16px",
              borderRadius: 6,
              textDecoration: "none",
              boxShadow: "0 1px 2px rgba(37, 99, 235, 0.2)",
              transition: "all 140ms ease",
            }}
          >
            <span>Get Started</span>
            <IconArrowRight size={14} />
          </Link>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation menu"
            style={{
              display: "none",
              alignItems: "center",
              justifyContent: "center",
              width: 38,
              height: 38,
              borderRadius: 6,
              border: "1px solid #E2E8F0",
              background: "#FFFFFF",
              color: "#1E293B",
              cursor: "pointer",
            }}
            className="visible-mobile-flex"
          >
            {mobileOpen ? <IconX size={20} /> : <IconMenu2 size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div
          style={{
            position: "fixed",
            top: 68,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#FFFFFF",
            overflowY: "auto",
            padding: "20px 24px 40px",
            borderTop: "1px solid #E2E8F0",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            zIndex: 999,
          }}
        >
          {/* Mobile Accordion Navigation */}
          <div>
            {/* Product Section */}
            <div style={{ borderBottom: "1px solid #F1F5F9", paddingBottom: 10, marginBottom: 10 }}>
              <button
                type="button"
                onClick={() => toggleMobileSection("product")}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#0F172A",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <span>Product</span>
                <IconChevronDown
                  size={16}
                  style={{
                    transform: mobileExpandedSection === "product" ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 140ms ease",
                  }}
                />
              </button>
              {mobileExpandedSection === "product" && (
                <div style={{ paddingLeft: 12, marginTop: 4, display: "flex", flexDirection: "column", gap: 8 }}>
                  {MAIN_NAVIGATION.product.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      style={{ fontSize: 14, color: "#475569", textDecoration: "none", padding: "4px 0" }}
                    >
                      {item.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Solutions Section */}
            <div style={{ borderBottom: "1px solid #F1F5F9", paddingBottom: 10, marginBottom: 10 }}>
              <button
                type="button"
                onClick={() => toggleMobileSection("solutions")}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#0F172A",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <span>Solutions</span>
                <IconChevronDown
                  size={16}
                  style={{
                    transform: mobileExpandedSection === "solutions" ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 140ms ease",
                  }}
                />
              </button>
              {mobileExpandedSection === "solutions" && (
                <div style={{ paddingLeft: 12, marginTop: 4, display: "flex", flexDirection: "column", gap: 8 }}>
                  {MAIN_NAVIGATION.solutions.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      style={{ fontSize: 14, color: "#475569", textDecoration: "none", padding: "4px 0" }}
                    >
                      {item.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Resources Section */}
            <div style={{ borderBottom: "1px solid #F1F5F9", paddingBottom: 10, marginBottom: 10 }}>
              <button
                type="button"
                onClick={() => toggleMobileSection("resources")}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#0F172A",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <span>Resources</span>
                <IconChevronDown
                  size={16}
                  style={{
                    transform: mobileExpandedSection === "resources" ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 140ms ease",
                  }}
                />
              </button>
              {mobileExpandedSection === "resources" && (
                <div style={{ paddingLeft: 12, marginTop: 4, display: "flex", flexDirection: "column", gap: 8 }}>
                  {MAIN_NAVIGATION.resources.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      style={{ fontSize: 14, color: "#475569", textDecoration: "none", padding: "4px 0" }}
                    >
                      {item.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Company Section */}
            <div style={{ borderBottom: "1px solid #F1F5F9", paddingBottom: 10, marginBottom: 10 }}>
              <button
                type="button"
                onClick={() => toggleMobileSection("company")}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#0F172A",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <span>Company</span>
                <IconChevronDown
                  size={16}
                  style={{
                    transform: mobileExpandedSection === "company" ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 140ms ease",
                  }}
                />
              </button>
              {mobileExpandedSection === "company" && (
                <div style={{ paddingLeft: 12, marginTop: 4, display: "flex", flexDirection: "column", gap: 8 }}>
                  {MAIN_NAVIGATION.company.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      style={{ fontSize: 14, color: "#475569", textDecoration: "none", padding: "4px 0" }}
                    >
                      {item.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Pricing direct */}
            <div style={{ padding: "8px 0" }}>
              <Link
                href="/pricing"
                style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", textDecoration: "none", display: "block" }}
              >
                Pricing
              </Link>
            </div>
          </div>

          {/* Quick Actions at Bottom of Mobile Drawer */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: "auto", paddingTop: 20 }}>
            <Link
              href="/contact"
              style={{
                textAlign: "center",
                padding: "10px",
                fontSize: 14,
                fontWeight: 600,
                color: "#1E293B",
                backgroundColor: "#F1F5F9",
                borderRadius: 6,
                textDecoration: "none",
              }}
            >
              Contact
            </Link>
            <Link
              href="/signup"
              style={{
                textAlign: "center",
                padding: "10px",
                fontSize: 14,
                fontWeight: 600,
                color: "#FFFFFF",
                backgroundColor: "#2563EB",
                borderRadius: 6,
                textDecoration: "none",
              }}
            >
              Get Started Free
            </Link>
            <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 8 }}>
              <Link href="/signin" style={{ fontSize: 13, color: "#64748B", textDecoration: "none" }}>
                Sign in
              </Link>
              <span style={{ color: "#CBD5E1" }}>•</span>
              <Link href="/contact" style={{ fontSize: 13, color: "#64748B", textDecoration: "none" }}>
                Contact Support & Sales
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Global Navbar Styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .nav-dropdown-item:hover {
          background-color: #F8FAFC;
        }
        .nav-dropdown-item:hover div:first-child {
          color: #2563EB !important;
        }
        @media (max-width: 900px) {
          .hidden-mobile {
            display: none !important;
          }
          .visible-mobile-flex {
            display: flex !important;
          }
        }
      `,
        }}
      />
    </header>
  );
}
