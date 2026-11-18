"use client";

import React, { useState } from "react";
import Link from "next/link";
import { GlobalNavbar } from "@/components/navigation/GlobalNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import {
  IconCheck,
  IconX,
  IconArrowRight,
  IconHelpCircle,
  IconShieldCheck,
  IconSparkles,
} from "@tabler/icons-react";

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");

  const plans = [
    {
      name: "Starter",
      tagline: "For individuals and small teams evaluating AI assistance.",
      monthlyPrice: "$29",
      annualPrice: "$24",
      highlight: false,
      ctaText: "Start 14-Day Trial",
      ctaHref: "/signup?plan=starter",
      features: [
        "1 Connected Mailbox (Gmail or Outlook)",
        "500 AI-assisted drafts per month",
        "10 Knowledge Base documents",
        "Isolated AI Reply Copilot",
        "Standard tone presets (Concise, Polish, Warm)",
        "Human-in-the-loop review queue",
        "Community & email support",
      ],
    },
    {
      name: "Growth",
      tagline: "For high-volume teams automating everyday customer workflows.",
      monthlyPrice: "$99",
      annualPrice: "$79",
      highlight: true,
      badge: "Most Popular",
      ctaText: "Start 14-Day Trial",
      ctaHref: "/signup?plan=growth",
      features: [
        "Up to 3 Connected Mailboxes",
        "2,500 AI-assisted drafts per month",
        "50 Knowledge Base documents & spec sheets",
        "Automated rule chains & confidence triggers",
        "Intent classification (Hot/Warm/Cold tags)",
        "Custom prompt instructions & tone tuning",
        "Team roles: Owner, Admin, Agent (3 seats)",
        "Priority email support (under 8 hrs)",
      ],
    },
    {
      name: "Business",
      tagline: "For established operations scaling wholesale and multi-brand inboxes.",
      monthlyPrice: "$249",
      annualPrice: "$199",
      highlight: false,
      ctaText: "Start 14-Day Trial",
      ctaHref: "/signup?plan=business",
      features: [
        "Up to 10 Connected Mailboxes",
        "10,000 AI-assisted drafts per month",
        "Unlimited Knowledge Base uploads (PDF/CSV)",
        "Multi-tenant workspace isolation",
        "Analytics & team velocity dashboard",
        "Audit logging & compliance exports",
        "10 included team member seats",
        "Dedicated onboarding & priority SLA",
      ],
    },
    {
      name: "Enterprise",
      tagline: "For high-compliance organizations with custom security needs.",
      monthlyPrice: "Custom",
      annualPrice: "Custom",
      highlight: false,
      ctaText: "Request Enterprise Demo",
      ctaHref: "/request-demo",
      features: [
        "Unlimited Connected Mailboxes",
        "Unlimited volume & custom throughput",
        "Dedicated private Qdrant vector cluster",
        "Custom ERP/CRM webhook connectors",
        "Custom Data Processing Agreement (DPA)",
        "99.9% Uptime SLA commitment",
        "Dedicated customer success architect",
        "Custom billing & invoicing terms",
      ],
    },
  ];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#FFFFFF" }}>
      <GlobalNavbar />

      <main style={{ flex: "1 0 auto" }}>
        {/* Header */}
        <section
          style={{
            padding: "56px 24px 44px",
            backgroundColor: "#F8FAFC",
            borderBottom: "1px solid #E2E8F0",
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 10px",
                borderRadius: 20,
                backgroundColor: "#EFF6FF",
                border: "1px solid #BFDBFE",
                color: "#2563EB",
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 16,
              }}
            >
              Transparent Pricing
            </div>
            <h1
              style={{
                fontSize: "clamp(30px, 4.2vw, 46px)",
                fontWeight: 800,
                color: "#0F172A",
                letterSpacing: "-0.03em",
                lineHeight: 1.2,
                margin: "0 0 16px",
              }}
            >
              Simple plans for real commercial teams.
            </h1>
            <p
              style={{
                fontSize: "clamp(15px, 1.8vw, 17px)",
                color: "#475569",
                lineHeight: 1.6,
                margin: "0 auto 28px",
                maxWidth: 640,
              }}
            >
              Start small, scale as your inbox volume grows. All plans include 14-day free trials, enterprise encryption, and zero foundation model training.
            </p>

            {/* Billing Cycle Switch */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                backgroundColor: "#FFFFFF",
                border: "1px solid #CBD5E1",
                borderRadius: 30,
                padding: 4,
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              }}
            >
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                style={{
                  padding: "6px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 24,
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: billingCycle === "monthly" ? "#0F172A" : "transparent",
                  color: billingCycle === "monthly" ? "#FFFFFF" : "#64748B",
                  transition: "all 140ms ease",
                }}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("annual")}
                style={{
                  padding: "6px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 24,
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: billingCycle === "annual" ? "#2563EB" : "transparent",
                  color: billingCycle === "annual" ? "#FFFFFF" : "#64748B",
                  transition: "all 140ms ease",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>Annual Billing</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    backgroundColor: billingCycle === "annual" ? "#DBEAFE" : "#EFF6FF",
                    color: "#1D4ED8",
                    padding: "1px 6px",
                    borderRadius: 10,
                  }}
                >
                  Save 20%
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* Pricing Cards Grid */}
        <section style={{ padding: "56px 24px", maxWidth: 1240, margin: "0 auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 20,
              alignItems: "stretch",
            }}
          >
            {plans.map((p) => {
              const price = billingCycle === "annual" ? p.annualPrice : p.monthlyPrice;
              return (
                <div
                  key={p.name}
                  style={{
                    backgroundColor: "#FFFFFF",
                    border: p.highlight ? "2px solid #2563EB" : "1px solid #E2E8F0",
                    borderRadius: 12,
                    padding: "28px 24px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    position: "relative",
                    boxShadow: p.highlight ? "0 10px 25px -5px rgba(37,99,235,0.12)" : "0 1px 3px rgba(0,0,0,0.03)",
                  }}
                >
                  {p.badge && (
                    <div
                      style={{
                        position: "absolute",
                        top: -12,
                        left: "50%",
                        transform: "translateX(-50%)",
                        backgroundColor: "#2563EB",
                        color: "#FFFFFF",
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        padding: "3px 12px",
                        borderRadius: 12,
                        letterSpacing: "0.04em",
                      }}
                    >
                      {p.badge}
                    </div>
                  )}

                  <div>
                    <h3 style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>
                      {p.name}
                    </h3>
                    <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 16px", minHeight: 38, lineHeight: 1.45 }}>
                      {p.tagline}
                    </p>

                    <div style={{ marginBottom: 20, display: "flex", alignItems: "baseline", gap: 4 }}>
                      <span style={{ fontSize: 36, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.03em" }}>
                        {price}
                      </span>
                      {price !== "Custom" && (
                        <span style={{ fontSize: 13, color: "#64748B" }}>
                          / month {billingCycle === "annual" ? "(billed annually)" : ""}
                        </span>
                      )}
                    </div>

                    <Link
                      href={p.ctaHref}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        width: "100%",
                        padding: "10px 0",
                        borderRadius: 6,
                        fontSize: 13.5,
                        fontWeight: 600,
                        textDecoration: "none",
                        backgroundColor: p.highlight ? "#2563EB" : "#F1F5F9",
                        color: p.highlight ? "#FFFFFF" : "#1E293B",
                        border: p.highlight ? "none" : "1px solid #CBD5E1",
                        transition: "all 140ms ease",
                        boxSizing: "border-box",
                        marginBottom: 24,
                      }}
                    >
                      <span>{p.ctaText}</span>
                      <IconArrowRight size={14} />
                    </Link>

                    <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", color: "#64748B", letterSpacing: "0.04em", marginBottom: 12 }}>
                      Included Capabilities:
                    </div>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                      {p.features.map((feat) => (
                        <li key={feat} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#334155", lineHeight: 1.4 }}>
                          <IconCheck size={16} color="#16A34A" style={{ flexShrink: 0, marginTop: 1 }} />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Feature Comparison Matrix */}
        <section style={{ backgroundColor: "#F8FAFC", borderTop: "1px solid #E2E8F0", borderBottom: "1px solid #E2E8F0", padding: "56px 24px" }}>
          <div style={{ maxWidth: 1080, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0F172A", margin: "0 0 8px" }}>
                Feature Availability Matrix
              </h2>
              <p style={{ fontSize: 14, color: "#64748B", margin: 0 }}>
                Compare core capabilities across every subscription tier.
              </p>
            </div>

            <div style={{ overflowX: "auto", border: "1px solid #E2E8F0", borderRadius: 8, backgroundColor: "#FFFFFF" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
                <thead>
                  <tr style={{ backgroundColor: "#F1F5F9", borderBottom: "1px solid #E2E8F0" }}>
                    <th style={{ padding: "12px 16px", color: "#0F172A", fontWeight: 700 }}>Feature</th>
                    <th style={{ padding: "12px 16px", color: "#0F172A", fontWeight: 700, textAlign: "center" }}>Starter</th>
                    <th style={{ padding: "12px 16px", color: "#2563EB", fontWeight: 700, textAlign: "center" }}>Growth</th>
                    <th style={{ padding: "12px 16px", color: "#0F172A", fontWeight: 700, textAlign: "center" }}>Business</th>
                    <th style={{ padding: "12px 16px", color: "#0F172A", fontWeight: 700, textAlign: "center" }}>Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "10px 16px", fontWeight: 600 }}>Connected Mailboxes</td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>1</td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>3</td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>10</td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>Unlimited</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "10px 16px", fontWeight: 600 }}>Monthly AI Drafts</td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>500</td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>2,500</td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>10,000</td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>Unlimited</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "10px 16px", fontWeight: 600 }}>Vector Knowledge Docs</td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>10</td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>50</td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>Unlimited</td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>Dedicated Cluster</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "10px 16px", fontWeight: 600 }}>Automated Sending Triggers</td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>—</td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}><IconCheck size={16} color="#16A34A" /></td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}><IconCheck size={16} color="#16A34A" /></td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}><IconCheck size={16} color="#16A34A" /></td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "10px 16px", fontWeight: 600 }}>Team Member Seats</td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>1</td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>3</td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>10</td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>Custom</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "10px 16px", fontWeight: 600 }}>Support Channel</td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>Standard Email</td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>Priority Email (&lt;8h)</td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>Priority SLA (&lt;2h)</td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>24/7 Dedicated SLA</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Billing FAQs */}
        <section style={{ padding: "56px 24px", maxWidth: 860, margin: "0 auto" }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0F172A", margin: "0 0 24px", textAlign: "center" }}>
            Frequently Asked Billing Questions
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ border: "1px solid #E2E8F0", borderRadius: 8, padding: "16px 20px" }}>
              <h4 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "0 0 6px" }}>
                How does the 14-day free trial work?
              </h4>
              <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.55, margin: 0 }}>
                Every plan includes a full-featured 14-day free trial. You can connect your mailbox, upload knowledge documents, and test AI drafts with zero credit card commitment required up front.
              </p>
            </div>
            <div style={{ border: "1px solid #E2E8F0", borderRadius: 8, padding: "16px 20px" }}>
              <h4 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "0 0 6px" }}>
                Who processes subscription payments?
              </h4>
              <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.55, margin: 0 }}>
                All payments are handled securely by our Merchant of Record partners, <strong>Paddle</strong> and/or <strong>Lemon Squeezy</strong>. They handle global sales tax compliance (including VAT and GST) and fraud protection. We store zero raw payment card numbers.
              </p>
            </div>
            <div style={{ border: "1px solid #E2E8F0", borderRadius: 8, padding: "16px 20px" }}>
              <h4 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "0 0 6px" }}>
                Can I cancel anytime?
              </h4>
              <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.55, margin: 0 }}>
                Yes. You can cancel your subscription with one click directly from your dashboard under <strong>Settings &rarr; Billing</strong>. Your access remains active until the end of your current prepaid billing cycle with no subsequent renewal charges. Review our <Link href="/refund" style={{ color: "#2563EB" }}>Refund Policy</Link> for details.
              </p>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
