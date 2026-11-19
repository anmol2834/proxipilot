"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  IconArrowRight,
  IconCheck,
  IconClock,
  IconShieldCheck,
  IconBuildingSkyscraper,
  IconHeadset,
  IconMessageCircle2,
  IconMail,
  IconPhone,
  IconChevronDown,
  IconChevronUp,
  IconAlertCircle,
  IconSparkles,
  IconUsers,
  IconBrandGoogle,
  IconBrandOffice,
  IconWorld,
  IconX,
} from "@tabler/icons-react";
import {
  DEPARTMENT_DESKS,
  RESPONSE_SLAS,
  GLOBAL_OFFICES,
  CONTACT_FAQS,
} from "@/data/contact-data";

export function ContactClientView() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("Sales Inquiries");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState<{ referenceId: string; message: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    const fullName = `${firstName} ${lastName}`.trim() || firstName || "Website Visitor";

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName,
          email,
          department,
          company,
          message,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit message");
      }

      setSuccessData({ referenceId: data.referenceId, message: data.message });
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred. Please try again or email us directly.");
    } finally {
      setLoading(false);
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <div style={{ width: "100%", overflowX: "hidden", backgroundColor: "#F8F9FA" }}>
      {/* Styles for responsive behavior and hover effects */}
      <style>{`
        .contact-hero-grid {
          display: grid;
          grid-template-columns: 1fr 1.25fr;
          gap: 64px;
          align-items: center;
        }
        @media (max-width: 960px) {
          .contact-hero-grid {
            grid-template-columns: 1fr !important;
            gap: 40px !important;
          }
        }
        .contact-input:focus {
          outline: none;
          border-color: #635BFF !important;
          background-color: #FFFFFF !important;
          box-shadow: 0 0 0 3px rgba(99, 91, 255, 0.12) !important;
        }
        .dept-card {
          transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
        }
        .dept-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 14px 28px -6px rgba(15, 23, 42, 0.08);
          border-color: #CBD5E1 !important;
        }
      `}</style>

      {/* =========================================================
          SECTION 1: HERO SPLIT SECTION (EXACT MATCH TO REFERENCE)
          ========================================================= */}
      <section
        style={{
          padding: "72px 24px 64px",
          maxWidth: 1240,
          margin: "0 auto",
          position: "relative",
        }}
      >
        <div className="contact-hero-grid">
          {/* LEFT COLUMN: Headings, Direct Channels & Live Chat Button */}
          <div>
            {/* Main Headline (Exact geometry and em dash from user image!) */}
            <h1
              style={{
                fontSize: "clamp(38px, 5.2vw, 58px)",
                fontWeight: 800,
                color: "#0F172A",
                letterSpacing: "-0.035em",
                lineHeight: 1.1,
                margin: "0 0 24px",
              }}
            >
              Get in —<br />
              touch with us
            </h1>

            {/* Subtext */}
            <p
              style={{
                fontSize: "clamp(15px, 2.2vw, 17px)",
                color: "#475569",
                lineHeight: 1.6,
                maxWidth: 480,
                margin: "0 0 36px",
              }}
            >
              We&apos;re here to help! Whether you have a question about our autonomous email engine, need assistance connecting your team&apos;s Gmail or Outlook mailboxes, or want to explore enterprise volume pricing, our team is ready to assist you.
            </p>

            {/* Direct Email Channel */}
            <div style={{ marginBottom: 36 }}>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: "#64748B",
                  marginBottom: 4,
                }}
              >
                Email:
              </div>
              <a
                href="mailto:hello@proxipilot.com"
                style={{
                  fontSize: "clamp(20px, 2.6vw, 24px)",
                  fontWeight: 700,
                  color: "#0F172A",
                  textDecoration: "none",
                  display: "inline-block",
                  letterSpacing: "-0.01em",
                }}
              >
                hello@proxipilot.com
              </a>
              <div
                style={{
                  fontSize: 12.5,
                  color: "#64748B",
                  marginTop: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    backgroundColor: "#16A34A",
                    display: "inline-block",
                  }}
                />
                <span>Available Monday to Friday, 9 AM - 6 PM EST • Sub-2 hour response for pilot inquiries</span>
              </div>
            </div>

            {/* Live Chat Action Button (Exact Black Capsule + Circular White Arrow Badge!) */}
            <div>
              <button
                type="button"
                onClick={() => setIsChatModalOpen(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px 10px 22px",
                  borderRadius: 9999,
                  backgroundColor: "#0A0D14",
                  color: "#FFFFFF",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 8px 20px -4px rgba(0, 0, 0, 0.25)",
                  transition: "all 140ms ease",
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em" }}>
                  Live Chat
                </span>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    backgroundColor: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#0A0D14",
                  }}
                >
                  <IconArrowRight size={15} stroke={2.5} />
                </div>
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: Elevated Studio White Card with Form */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 36,
              border: "1px solid #ECEFF2",
              boxShadow: "0 20px 48px -12px rgba(15, 23, 42, 0.08), 0 4px 12px -2px rgba(15, 23, 42, 0.03)",
              padding: "clamp(28px, 4vw, 44px)",
              position: "relative",
            }}
          >
            {successData ? (
              <div
                style={{
                  padding: "36px 20px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    backgroundColor: "#DCFCE7",
                    color: "#16A34A",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px",
                  }}
                >
                  <IconCheck size={30} stroke={2.5} />
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: "0 0 8px" }}>
                  Message Received!
                </h3>
                <p style={{ fontSize: 14.5, color: "#475569", lineHeight: 1.6, maxWidth: 420, margin: "0 auto 20px" }}>
                  {successData.message}
                </p>

                <div
                  style={{
                    backgroundColor: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: 12,
                    padding: "12px 18px",
                    display: "inline-block",
                    marginBottom: 24,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                    Inquiry Reference Number
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#635BFF", fontFamily: "monospace", marginTop: 2 }}>
                    {successData.referenceId}
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setSuccessData(null);
                      setMessage("");
                    }}
                    style={{
                      padding: "10px 22px",
                      borderRadius: 8,
                      border: "1px solid #E2E8F0",
                      backgroundColor: "#FFFFFF",
                      color: "#0F172A",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Send Another Inquiry
                  </button>
                </div>
              </div>
            ) : (
              <form id="contact-form" onSubmit={handleSubmit}>
                {errorMessage && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "12px 16px",
                      borderRadius: 12,
                      backgroundColor: "#FEF2F2",
                      border: "1px solid #FCA5A5",
                      color: "#991B1B",
                      fontSize: 13.5,
                      marginBottom: 20,
                    }}
                  >
                    <IconAlertCircle size={18} />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Row 1: First Name & Last Name (Side by Side) */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                    marginBottom: 20,
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#0F172A",
                        marginBottom: 7,
                      }}
                    >
                      First Name
                    </label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Enter your first name..."
                      className="contact-input"
                      style={{
                        width: "100%",
                        padding: "13px 18px",
                        borderRadius: 14,
                        border: "1px solid #E2E8F0",
                        backgroundColor: "#F8FAFC",
                        fontSize: 14,
                        color: "#0F172A",
                        boxSizing: "border-box",
                        transition: "all 140ms ease",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#0F172A",
                        marginBottom: 7,
                      }}
                    >
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Enter your last name..."
                      className="contact-input"
                      style={{
                        width: "100%",
                        padding: "13px 18px",
                        borderRadius: 14,
                        border: "1px solid #E2E8F0",
                        backgroundColor: "#F8FAFC",
                        fontSize: 14,
                        color: "#0F172A",
                        boxSizing: "border-box",
                        transition: "all 140ms ease",
                      }}
                    />
                  </div>
                </div>

                {/* Row 2: Corporate Email */}
                <div style={{ marginBottom: 20 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#0F172A",
                      marginBottom: 7,
                    }}
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address..."
                    className="contact-input"
                    style={{
                      width: "100%",
                      padding: "13px 18px",
                      borderRadius: 14,
                      border: "1px solid #E2E8F0",
                      backgroundColor: "#F8FAFC",
                      fontSize: 14,
                      color: "#0F172A",
                      boxSizing: "border-box",
                      transition: "all 140ms ease",
                    }}
                  />
                </div>

                {/* Row 3: Department / Inquiry Type & Company */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.2fr 1fr",
                    gap: 16,
                    marginBottom: 20,
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#0F172A",
                        marginBottom: 7,
                      }}
                    >
                      Department / Topic
                    </label>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="contact-input"
                      style={{
                        width: "100%",
                        padding: "13px 18px",
                        borderRadius: 14,
                        border: "1px solid #E2E8F0",
                        backgroundColor: "#F8FAFC",
                        fontSize: 14,
                        color: "#0F172A",
                        boxSizing: "border-box",
                        transition: "all 140ms ease",
                        cursor: "pointer",
                      }}
                    >
                      <option value="Sales Inquiries">Enterprise Sales &amp; Custom Volume</option>
                      <option value="Customer Support">Technical Support &amp; OAuth Sync</option>
                      <option value="Security & Legal">Security, DPA &amp; Compliance</option>
                      <option value="Billing Inquiries">Billing, Invoices &amp; Tax Receipts</option>
                      <option value="Partnership Desk">Partnerships, Agencies &amp; MSPs</option>
                    </select>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#0F172A",
                        marginBottom: 7,
                      }}
                    >
                      Company <span style={{ color: "#94A3B8", fontWeight: 400 }}>(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="e.g. Acme Corp"
                      className="contact-input"
                      style={{
                        width: "100%",
                        padding: "13px 18px",
                        borderRadius: 14,
                        border: "1px solid #E2E8F0",
                        backgroundColor: "#F8FAFC",
                        fontSize: 14,
                        color: "#0F172A",
                        boxSizing: "border-box",
                        transition: "all 140ms ease",
                      }}
                    />
                  </div>
                </div>

                {/* Row 4: Message Area */}
                <div style={{ marginBottom: 28 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#0F172A",
                      marginBottom: 7,
                    }}
                  >
                    How can we help you?
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Enter your message... tell us about your mailbox setup, current volume, or specific questions..."
                    className="contact-input"
                    style={{
                      width: "100%",
                      padding: "16px 18px",
                      borderRadius: 18,
                      border: "1px solid #E2E8F0",
                      backgroundColor: "#F8FAFC",
                      fontSize: 14,
                      color: "#0F172A",
                      lineHeight: 1.6,
                      boxSizing: "border-box",
                      resize: "vertical",
                      minHeight: 130,
                      transition: "all 140ms ease",
                    }}
                  />
                </div>

                {/* Bottom Bar: Privacy Notice & Black Capsule Submit Button */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 16,
                  }}
                >
                  <div style={{ fontSize: 12, color: "#64748B", maxWidth: 260, lineHeight: 1.4 }}>
                    We never sell data or train generalized AI models on your inputs.
                  </div>

                  {/* Send Message Button (Matches Image exactly!) */}
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "11px 12px 11px 24px",
                      borderRadius: 9999,
                      backgroundColor: loading ? "#475569" : "#0A0D14",
                      color: "#FFFFFF",
                      border: "none",
                      cursor: loading ? "not-allowed" : "pointer",
                      boxShadow: "0 8px 20px -4px rgba(0, 0, 0, 0.28)",
                      transition: "all 140ms ease",
                    }}
                  >
                    <span style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: "-0.01em" }}>
                      {loading ? "Sending..." : "Send Message"}
                    </span>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        backgroundColor: "#FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#0A0D14",
                        flexShrink: 0,
                      }}
                    >
                      <IconArrowRight size={15} stroke={2.5} />
                    </div>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>



      {/* =========================================================
          SECTION 3: ENTERPRISE RESPONSE SLAS
          ========================================================= */}
      <section style={{ padding: "72px 24px", maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#635BFF",
              marginBottom: 10,
            }}
          >
            Service Level Commitments
          </div>
          <h2
            style={{
              fontSize: "clamp(26px, 3.4vw, 36px)",
              fontWeight: 800,
              letterSpacing: "-0.025em",
              color: "#0F172A",
              lineHeight: 1.2,
              margin: "0 0 12px",
            }}
          >
            Guaranteed Response Time Tiers
          </h2>
          <p style={{ fontSize: 16, color: "#64748B", maxWidth: 620, margin: "0 auto" }}>
            Every ticket and inquiry is tracked against strict SLA benchmarks with automated executive escalation.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: 20,
          }}
        >
          {RESPONSE_SLAS.map((sla, idx) => (
            <div
              key={idx}
              style={{
                padding: "26px 22px",
                borderRadius: 18,
                backgroundColor: sla.bg,
                border: `1px solid ${sla.border}`,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ fontSize: 28, fontWeight: 900, color: sla.color, marginBottom: 6 }}>
                  {sla.responseTime}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: sla.color, textTransform: "uppercase", marginBottom: 10 }}>
                  {sla.availability}
                </div>
                <h4 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", margin: "0 0 8px" }}>
                  {sla.tier}
                </h4>
                <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.55, margin: 0 }}>
                  {sla.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* =========================================================
          SECTION 4: GLOBAL OPERATING LOCATIONS
          ========================================================= */}
      <section
        style={{
          padding: "64px 24px",
          backgroundColor: "#FFFFFF",
          borderTop: "1px solid #E2E8F0",
          borderBottom: "1px solid #E2E8F0",
        }}
      >
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <h3 style={{ fontSize: 24, fontWeight: 800, color: "#0F172A", margin: "0 0 8px" }}>
              Global Regional Desks
            </h3>
            <p style={{ fontSize: 15, color: "#64748B", margin: 0 }}>
              Supporting commercial deployments across North America, EMEA, and Asia-Pacific.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 24,
            }}
          >
            {GLOBAL_OFFICES.map((office, idx) => (
              <div
                key={idx}
                style={{
                  padding: "28px 24px",
                  borderRadius: 16,
                  backgroundColor: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: "#635BFF", textTransform: "uppercase", marginBottom: 6 }}>
                  {office.region}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>
                  {office.city}
                </div>
                <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.5, margin: "0 0 14px" }}>
                  {office.address}
                </p>
                <div style={{ fontSize: 13, color: "#64748B", display: "grid", gap: 4 }}>
                  <div><strong>Email:</strong> {office.email}</div>
                  <div><strong>Hours:</strong> {office.timezone}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================
          SECTION 5: SEO FAQ ACCORDION
          ========================================================= */}
      <section style={{ padding: "72px 24px", maxWidth: 840, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#635BFF",
              marginBottom: 10,
            }}
          >
            Frequently Asked Questions
          </div>
          <h2
            style={{
              fontSize: "clamp(26px, 3.4vw, 36px)",
              fontWeight: 800,
              letterSpacing: "-0.025em",
              color: "#0F172A",
              lineHeight: 1.2,
              margin: "0 0 12px",
            }}
          >
            Common questions about contacting ProxiPilot
          </h2>
          <p style={{ fontSize: 15.5, color: "#64748B", margin: 0 }}>
            Find quick answers regarding pilot onboarding, response times, and enterprise security evaluations.
          </p>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {CONTACT_FAQS.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                style={{
                  borderRadius: 14,
                  border: isOpen ? "1px solid #C7D2FE" : "1px solid #E2E8F0",
                  backgroundColor: "#FFFFFF",
                  overflow: "hidden",
                  transition: "border-color 140ms ease",
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  style={{
                    width: "100%",
                    padding: "18px 22px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    textAlign: "left",
                    border: "none",
                    backgroundColor: "transparent",
                    cursor: "pointer",
                    gap: 16,
                  }}
                >
                  <span
                    style={{
                      fontSize: 15.5,
                      fontWeight: 700,
                      color: isOpen ? "#635BFF" : "#0F172A",
                    }}
                  >
                    {faq.question}
                  </span>
                  <span style={{ color: isOpen ? "#635BFF" : "#94A3B8", flexShrink: 0 }}>
                    {isOpen ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
                  </span>
                </button>

                {isOpen && (
                  <div
                    style={{
                      padding: "0 22px 20px",
                      fontSize: 14.5,
                      color: "#475569",
                      lineHeight: 1.6,
                      borderTop: "1px solid #F1F5F9",
                      paddingTop: 14,
                    }}
                  >
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* =========================================================
          INTERACTIVE LIVE CHAT DRAWER / MODAL
          ========================================================= */}
      {isChatModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setIsChatModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 24,
              maxWidth: 480,
              width: "100%",
              padding: "32px 28px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsChatModalOpen(false)}
              style={{
                position: "absolute",
                top: 18,
                right: 18,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "#64748B",
              }}
            >
              <IconX size={20} />
            </button>

            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                backgroundColor: "#0A0D14",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <IconMessageCircle2 size={24} />
            </div>

            <h3 style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", margin: "0 0 8px" }}>
              Live Support &amp; Guided Walkthrough
            </h3>
            <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.55, margin: "0 0 20px" }}>
              Our operations team is available Monday to Friday, 9:00 AM – 6:00 PM EST. Choose the quickest way to get in touch:
            </p>

            <div style={{ display: "grid", gap: 12 }}>
              <Link
                href="#contact-form"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 18px",
                  borderRadius: 12,
                  backgroundColor: "#F5F3FF",
                  border: "1px solid #DDD6FE",
                  color: "#635BFF",
                  textDecoration: "none",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                <span>Talk to our sales team</span>
                <IconArrowRight size={16} />
              </Link>

              <a
                href="mailto:hello@proxipilot.com"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 18px",
                  borderRadius: 12,
                  backgroundColor: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  color: "#0F172A",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                <span>Direct Email: hello@proxipilot.com</span>
                <IconArrowRight size={16} />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* JSON-LD Structured Data for Google Rich Snippets */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ContactPage",
            name: "ProxiPilot Contact and Support Center",
            description:
              "Official contact and support desk for ProxiPilot sales, technical operations, and general inquiries.",
            url: "https://proxipilot.com/contact",
            mainEntity: {
              "@type": "Organization",
              name: "ProxiPilot",
              url: "https://proxipilot.com",
              logo: "https://proxipilot.com/proxipilot-logo.svg",
              contactPoint: [
                {
                  "@type": "ContactPoint",
                  contactType: "customer service",
                  email: "hello@proxipilot.com",
                  areaServed: "Worldwide",
                  availableLanguage: ["English"],
                },
                {
                  "@type": "ContactPoint",
                  email: "sales@proxipilot.com",
                  contactType: "sales",
                  areaServed: "Worldwide",
                  availableLanguage: ["English"],
                },
                {
                  "@type": "ContactPoint",
                  email: "legal@proxipilot.com",
                  contactType: "legal",
                  areaServed: "Worldwide",
                  availableLanguage: ["English"],
                },
              ],
            },
          }),
        }}
      />
    </div>
  );
}
