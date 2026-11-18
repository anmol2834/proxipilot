"use client";

import React, { useState } from "react";
import { IconCheck, IconAlertCircle, IconArrowRight } from "@tabler/icons-react";

export function PartnerInquiryForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [partnerType, setPartnerType] = useState("Agency & Consultancy");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState<{ partnerRef: string; message: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, company, website, partnerType, details }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit partnership application");
      }

      setSuccessData({ partnerRef: data.partnerRef, message: data.message });
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit application. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (successData) {
    return (
      <div
        style={{
          padding: "32px 24px",
          borderRadius: 12,
          backgroundColor: "#F0FDF4",
          border: "1px solid #BBF7D0",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: "#22C55E",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <IconCheck size={28} />
        </div>
        <h3 style={{ fontSize: 20, fontWeight: 800, color: "#166534", marginBottom: 8 }}>
          Application Received
        </h3>
        <p style={{ fontSize: 14, color: "#15803D", lineHeight: 1.5, margin: "0 0 16px" }}>
          {successData.message}
        </p>
        <div
          style={{
            display: "inline-block",
            padding: "8px 16px",
            borderRadius: 8,
            backgroundColor: "#DCFCE7",
            color: "#166534",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          Reference ID: {successData.partnerRef}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {errorMessage && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            backgroundColor: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#DC2626",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <IconAlertCircle size={16} />
          {errorMessage}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
            Your Name *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            style={{
              width: "100%",
              padding: "10px 14px",
              fontSize: 14,
              border: "1px solid #CBD5E1",
              borderRadius: 8,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
            Work Email *
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@company.com"
            style={{
              width: "100%",
              padding: "10px 14px",
              fontSize: 14,
              border: "1px solid #CBD5E1",
              borderRadius: 8,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
            Organization Name *
          </label>
          <input
            type="text"
            required
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Acme Solutions LLC"
            style={{
              width: "100%",
              padding: "10px 14px",
              fontSize: 14,
              border: "1px solid #CBD5E1",
              borderRadius: 8,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
            Company Website
          </label>
          <input
            type="text"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://example.com"
            style={{
              width: "100%",
              padding: "10px 14px",
              fontSize: 14,
              border: "1px solid #CBD5E1",
              borderRadius: 8,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      <div>
        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
          Partnership Track
        </label>
        <select
          value={partnerType}
          onChange={(e) => setPartnerType(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 14px",
            fontSize: 14,
            border: "1px solid #CBD5E1",
            borderRadius: 8,
            outline: "none",
            backgroundColor: "#FFFFFF",
            boxSizing: "border-box",
          }}
        >
          <option value="Agency & Consultancy">Agency &amp; Digital Consultancy</option>
          <option value="Technology & Integration">Technology &amp; API Integration</option>
          <option value="Solution Integrator">Enterprise Solution Integrator</option>
          <option value="Reseller & Referral">Commercial Referral Partner</option>
        </select>
      </div>

      <div>
        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
          Collaboration Scope / Description
        </label>
        <textarea
          rows={3}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Briefly describe your agency focus, client base, or integration concept..."
          style={{
            width: "100%",
            padding: "10px 14px",
            fontSize: 14,
            border: "1px solid #CBD5E1",
            borderRadius: 8,
            outline: "none",
            boxSizing: "border-box",
            fontFamily: "inherit",
          }}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        style={{
          padding: "12px 20px",
          backgroundColor: "#2563EB",
          color: "#FFFFFF",
          fontSize: 14,
          fontWeight: 700,
          border: "none",
          borderRadius: 8,
          cursor: loading ? "not-allowed" : "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {loading ? "Submitting..." : "Submit Partner Application"} <IconArrowRight size={16} />
      </button>
    </form>
  );
}
