"use client";

import React, { useState } from "react";
import { IconSend, IconCheck, IconMail, IconAlertCircle } from "@tabler/icons-react";

export function ContactForm() {
  const [department, setDepartment] = useState("Sales Inquiries");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState<{ referenceId: string; message: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, department, company, message }),
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

  if (successData) {
    return (
      <div
        style={{
          backgroundColor: "#F0FDF4",
          border: "1px solid #BBF7D0",
          borderRadius: 8,
          padding: "24px",
          color: "#166534",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <IconCheck size={22} style={{ color: "#16A34A" }} />
          <span style={{ fontSize: 16, fontWeight: 700 }}>Inquiry Submitted Successfully</span>
        </div>
        <p style={{ fontSize: 14, color: "#15803D", margin: "0 0 16px", lineHeight: 1.5 }}>
          {successData.message}
        </p>

        <div
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #86EFAC",
            borderRadius: 6,
            padding: "10px 14px",
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 11, color: "#4B5563", textTransform: "uppercase", fontWeight: 600 }}>
            Ticket Reference Number
          </div>
          <div style={{ fontSize: 16, fontFamily: "monospace", fontWeight: 700, color: "#1E293B" }}>
            {successData.referenceId}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setSuccessData(null);
            setMessage("");
          }}
          style={{
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
            color: "#166534",
            backgroundColor: "#DCFCE7",
            border: "1px solid #86EFAC",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Send Another Message
        </button>
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
        padding: "24px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
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

      <div>
        <label
          htmlFor="department"
          style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 4 }}
        >
          Inquiry Department <span style={{ color: "#DC2626" }}>*</span>
        </label>
        <select
          id="department"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
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
          <option value="Sales Inquiries">Sales & Product Licensing</option>
          <option value="Technical Support">Technical Support & Integrations</option>
          <option value="Billing & Merchant">Billing, Subscriptions & Invoicing</option>
          <option value="Partnership Alliances">Partner & Agency Alliances</option>
          <option value="Security & Compliance">Security & Vulnerability Disclosure</option>
          <option value="General Inquiries">General Questions</option>
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label
            htmlFor="name"
            style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 4 }}
          >
            Your Name <span style={{ color: "#DC2626" }}>*</span>
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex Morgan"
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
            htmlFor="email"
            style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 4 }}
          >
            Work Email <span style={{ color: "#DC2626" }}>*</span>
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="alex@company.com"
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

      <div>
        <label
          htmlFor="company"
          style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 4 }}
        >
          Company Name (Optional)
        </label>
        <input
          id="company"
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Acme Global Inc."
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
          htmlFor="message"
          style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 4 }}
        >
          How can we help? <span style={{ color: "#DC2626" }}>*</span>
        </label>
        <textarea
          id="message"
          rows={4}
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Please describe your requirements, current email volume, or technical questions..."
          style={{
            width: "100%",
            padding: "8px 10px",
            fontSize: 13.5,
            border: "1px solid #CBD5E1",
            borderRadius: 6,
            color: "#0F172A",
            outline: "none",
            fontFamily: "inherit",
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginTop: 4 }}>
        <button
          type="submit"
          disabled={loading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "9px 20px",
            fontSize: 13.5,
            fontWeight: 600,
            color: "#FFFFFF",
            backgroundColor: "#2563EB",
            border: "none",
            borderRadius: 6,
            cursor: loading ? "not-allowed" : "pointer",
            boxShadow: "0 1px 2px rgba(37,99,235,0.2)",
          }}
        >
          <IconSend size={15} />
          <span>{loading ? "Sending Message..." : "Submit Message"}</span>
        </button>

        <span style={{ fontSize: 12, color: "#64748B" }}>
          Direct email: <a href="mailto:support@proxipilot.com" style={{ color: "#2563EB" }}>support@proxipilot.com</a>
        </span>
      </div>
    </form>
  );
}
