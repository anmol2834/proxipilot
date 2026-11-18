"use client";

import React, { useState } from "react";
import { IconCalendarEvent, IconCheck, IconAlertCircle, IconArrowRight } from "@tabler/icons-react";

export function DemoRequestForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [teamSize, setTeamSize] = useState("10-50");
  const [emailProvider, setEmailProvider] = useState("Google Workspace");
  const [challenge, setChallenge] = useState("High support inbox backlog");
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState<{ bookingReference: string; message: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, company, teamSize, emailProvider, challenge }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to schedule demo request");
      }

      setSuccessData({ bookingReference: data.bookingReference, message: data.message });
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit demo request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (successData) {
    return (
      <div
        style={{
          backgroundColor: "#F0FDF4",
          border: "1px solid #BBF7D0",
          borderRadius: 10,
          padding: "28px",
          color: "#166534",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <IconCheck size={24} style={{ color: "#16A34A" }} />
          <span style={{ fontSize: 17, fontWeight: 700 }}>Demo Request Confirmed</span>
        </div>
        <p style={{ fontSize: 14, color: "#15803D", margin: "0 0 16px", lineHeight: 1.55 }}>
          {successData.message}
        </p>

        <div
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #86EFAC",
            borderRadius: 6,
            padding: "12px 16px",
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 11, color: "#4B5563", textTransform: "uppercase", fontWeight: 600 }}>
            Demo Request Reference
          </div>
          <div style={{ fontSize: 16, fontFamily: "monospace", fontWeight: 700, color: "#1E293B" }}>
            {successData.bookingReference}
          </div>
        </div>

        <p style={{ fontSize: 13, color: "#166534", margin: "0 0 12px" }}>
          In the meantime, you can explore our live product documentation:
        </p>
        <a
          href="/docs"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 600,
            color: "#FFFFFF",
            backgroundColor: "#16A34A",
            borderRadius: 6,
            textDecoration: "none",
          }}
        >
          <span>Browse Documentation</span>
          <IconArrowRight size={14} />
        </a>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: 10,
        padding: "28px",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ marginBottom: 4 }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0F172A", margin: "0 0 4px" }}>
          Schedule a Guided Product Walkthrough
        </h3>
        <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>
          See how ProxiPilot automates repetitive emails on your real domain.
        </p>
      </div>

      {errorMessage && (
        <div
          style={{
            padding: "10px 14px",
            backgroundColor: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: 6,
            color: "#991B1B",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <IconAlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label
            htmlFor="demo-name"
            style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 4 }}
          >
            Full Name <span style={{ color: "#DC2626" }}>*</span>
          </label>
          <input
            id="demo-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jordan Lee"
            style={{
              width: "100%",
              padding: "8px 10px",
              fontSize: 13.5,
              border: "1px solid #CBD5E1",
              borderRadius: 6,
              color: "#0F172A",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div>
          <label
            htmlFor="demo-email"
            style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 4 }}
          >
            Work Email <span style={{ color: "#DC2626" }}>*</span>
          </label>
          <input
            id="demo-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jordan@company.com"
            style={{
              width: "100%",
              padding: "8px 10px",
              fontSize: 13.5,
              border: "1px solid #CBD5E1",
              borderRadius: 6,
              color: "#0F172A",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label
            htmlFor="demo-company"
            style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 4 }}
          >
            Company Name <span style={{ color: "#DC2626" }}>*</span>
          </label>
          <input
            id="demo-company"
            type="text"
            required
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Apex Logistics Ltd"
            style={{
              width: "100%",
              padding: "8px 10px",
              fontSize: 13.5,
              border: "1px solid #CBD5E1",
              borderRadius: 6,
              color: "#0F172A",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div>
          <label
            htmlFor="demo-teamsize"
            style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 4 }}
          >
            Team Size
          </label>
          <select
            id="demo-teamsize"
            value={teamSize}
            onChange={(e) => setTeamSize(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              fontSize: 13.5,
              border: "1px solid #CBD5E1",
              borderRadius: 6,
              backgroundColor: "#F8FAFC",
              color: "#0F172A",
              outline: "none",
            }}
          >
            <option value="1-5">1 - 5 team members</option>
            <option value="5-20">5 - 20 team members</option>
            <option value="20-50">20 - 50 team members</option>
            <option value="50-250">50 - 250 team members</option>
            <option value="250+">250+ enterprise</option>
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label
            htmlFor="demo-provider"
            style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 4 }}
          >
            Current Mail Provider
          </label>
          <select
            id="demo-provider"
            value={emailProvider}
            onChange={(e) => setEmailProvider(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              fontSize: 13.5,
              border: "1px solid #CBD5E1",
              borderRadius: 6,
              backgroundColor: "#F8FAFC",
              color: "#0F172A",
              outline: "none",
            }}
          >
            <option value="Google Workspace">Google Workspace (Gmail)</option>
            <option value="Microsoft 365">Microsoft 365 / Outlook</option>
            <option value="Both Google and Microsoft">Both Google & Microsoft</option>
            <option value="Other Exchange/Custom">Other / Self-hosted</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="demo-challenge"
            style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 4 }}
          >
            Primary Operational Goal
          </label>
          <select
            id="demo-challenge"
            value={challenge}
            onChange={(e) => setChallenge(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              fontSize: 13.5,
              border: "1px solid #CBD5E1",
              borderRadius: 6,
              backgroundColor: "#F8FAFC",
              color: "#0F172A",
              outline: "none",
            }}
          >
            <option value="High support inbox backlog">Clear support inbox backlog</option>
            <option value="Wholesale RFQs & SKU pricing">Fast wholesale RFQ & SKU quotes</option>
            <option value="Sales inbound follow-up speed">Instant inbound lead follow-up</option>
            <option value="Multi-brand agency management">Multi-inbox client management</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        style={{
          marginTop: 6,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: "10px 20px",
          fontSize: 14,
          fontWeight: 600,
          color: "#FFFFFF",
          backgroundColor: "#2563EB",
          border: "none",
          borderRadius: 6,
          cursor: loading ? "not-allowed" : "pointer",
          boxShadow: "0 1px 3px rgba(37,99,235,0.25)",
        }}
      >
        <IconCalendarEvent size={16} />
        <span>{loading ? "Scheduling Request..." : "Request Live Product Demo"}</span>
      </button>

      <div style={{ textAlign: "center", fontSize: 12, color: "#64748B", marginTop: 2 }}>
        No payment required • 30-minute personalized architecture walkthrough
      </div>
    </form>
  );
}
