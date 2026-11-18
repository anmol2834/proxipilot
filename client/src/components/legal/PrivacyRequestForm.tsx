"use client";

import React, { useState } from "react";
import {
  IconSend,
  IconCheck,
  IconMail,
  IconShieldLock,
  IconAlertCircle,
  IconCopy,
} from "@tabler/icons-react";

const REQUEST_TYPES = [
  { value: "access", label: "Right to Access / Data Export (GDPR Art. 15 / CCPA)" },
  { value: "erasure", label: "Right to Erasure / Deletion (GDPR Art. 17 / CCPA)" },
  { value: "rectification", label: "Right to Rectification / Correction (GDPR Art. 16)" },
  { value: "restriction", label: "Right to Restrict Processing (GDPR Art. 18)" },
  { value: "objection", label: "Right to Object to Processing (GDPR Art. 21)" },
  { value: "portability", label: "Right to Data Portability (GDPR Art. 20)" },
  { value: "revoke_consent", label: "Revoke Consent / Disconnect Mailbox Tokens" },
  { value: "inquiry", label: "General Data Protection & Privacy Inquiry" },
];

export function PrivacyRequestForm() {
  const [requestType, setRequestType] = useState("access");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [details, setDetails] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [referenceId, setReferenceId] = useState("");
  const [copied, setCopied] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !fullName || !authorized) return;

    setStatus("submitting");
    // Generate an audit reference ID
    const ref = `PP-DSR-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    setReferenceId(ref);

    setTimeout(() => {
      setStatus("success");
    }, 600);
  };

  const copyRef = () => {
    if (referenceId) {
      navigator.clipboard.writeText(referenceId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const mailtoSubject = encodeURIComponent(`[${referenceId || "Privacy Request"}] ${REQUEST_TYPES.find(r => r.value === requestType)?.label || requestType}`);
  const mailtoBody = encodeURIComponent(
    `Reference ID: ${referenceId || "PENDING"}\nName: ${fullName}\nBusiness Email: ${email}\nOrganization: ${organization}\nRequest Type: ${requestType}\n\nDetails:\n${details}`
  );

  return (
    <div
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: 8,
        padding: "24px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        maxWidth: 720,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: "#EFF6FF",
            color: "#2563EB",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconShieldLock size={20} />
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", margin: 0 }}>
            Submit a Data Subject Request (DSR)
          </h3>
          <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>
            Exercising rights under GDPR, CCPA, and applicable data privacy regulations.
          </p>
        </div>
      </div>

      {status === "success" ? (
        <div
          style={{
            backgroundColor: "#F0FDF4",
            border: "1px solid #BBF7D0",
            borderRadius: 8,
            padding: "20px",
            color: "#166534",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <IconCheck size={20} style={{ color: "#16A34A" }} />
            <span style={{ fontSize: 15, fontWeight: 700 }}>Request Acknowledged</span>
          </div>
          <p style={{ fontSize: 13, color: "#15803D", margin: "0 0 12px", lineHeight: 1.5 }}>
            Your privacy request has been generated. Pursuant to GDPR Art. 12(3) and CCPA § 1798.130, our Data Protection Officer will verify your business identity and fulfill verified requests within <strong>30 calendar days</strong>.
          </p>

          <div
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #86EFAC",
              borderRadius: 6,
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: "#4B5563", textTransform: "uppercase", fontWeight: 600 }}>
                Verification Reference ID
              </div>
              <div style={{ fontSize: 15, fontFamily: "monospace", fontWeight: 700, color: "#1E293B" }}>
                {referenceId}
              </div>
            </div>
            <button
              onClick={copyRef}
              type="button"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "6px 10px",
                fontSize: 12,
                borderRadius: 4,
                border: "1px solid #D1D5DB",
                background: "#F9FAFB",
                color: "#374151",
                cursor: "pointer",
              }}
            >
              <IconCopy size={14} />
              {copied ? "Copied!" : "Copy Ref"}
            </button>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <a
              href={`mailto:privacy@proxipilot.com?subject=${mailtoSubject}&body=${mailtoBody}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 600,
                color: "#FFFFFF",
                backgroundColor: "#2563EB",
                borderRadius: 6,
                textDecoration: "none",
              }}
            >
              <IconMail size={16} />
              Open in Email Client to Send Directly
            </a>
            <button
              onClick={() => {
                setStatus("idle");
                setDetails("");
                setAuthorized(false);
              }}
              type="button"
              style={{
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 500,
                color: "#475569",
                backgroundColor: "#FFFFFF",
                border: "1px solid #CBD5E1",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Submit Another Request
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label
              htmlFor="requestType"
              style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}
            >
              Request Type <span style={{ color: "#DC2626" }}>*</span>
            </label>
            <select
              id="requestType"
              value={requestType}
              onChange={(e) => setRequestType(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                fontSize: 13,
                border: "1px solid #CBD5E1",
                borderRadius: 6,
                backgroundColor: "#F8FAFC",
                color: "#0F172A",
                outline: "none",
              }}
              required
            >
              {REQUEST_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label
                htmlFor="fullName"
                style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}
              >
                Full Name <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Sarah Connor"
                required
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  fontSize: 13,
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
                style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}
              >
                Account / Business Email <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sarah@acme.com"
                required
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  fontSize: 13,
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
              htmlFor="organization"
              style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}
            >
              Organization / Workspace Name (Optional)
            </label>
            <input
              id="organization"
              type="text"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="Acme Corp"
              style={{
                width: "100%",
                padding: "8px 10px",
                fontSize: 13,
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
              htmlFor="details"
              style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}
            >
              Specific Request Details or Connected Email Account
            </label>
            <textarea
              id="details"
              rows={4}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Describe your request in detail (e.g., specific email address connected via OAuth, mailbox sync data, or vectors to be removed)."
              style={{
                width: "100%",
                padding: "8px 10px",
                fontSize: 13,
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

          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 4 }}>
            <input
              id="authorized"
              type="checkbox"
              checked={authorized}
              onChange={(e) => setAuthorized(e.target.checked)}
              required
              style={{ marginTop: 3 }}
            />
            <label htmlFor="authorized" style={{ fontSize: 12, color: "#475569", lineHeight: 1.4 }}>
              I declare under penalty of perjury that I am the account owner, data subject, or an authorized corporate representative empowered to submit this privacy request.
            </label>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
            <button
              type="submit"
              disabled={status === "submitting" || !authorized}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 18px",
                fontSize: 13,
                fontWeight: 600,
                color: "#FFFFFF",
                backgroundColor: authorized ? "#2563EB" : "#94A3B8",
                border: "none",
                borderRadius: 6,
                cursor: authorized ? "pointer" : "not-allowed",
              }}
            >
              <IconSend size={16} />
              {status === "submitting" ? "Submitting..." : "Submit Privacy Request"}
            </button>

            <a
              href="mailto:privacy@proxipilot.com?subject=Privacy%20Data%20Subject%20Request"
              style={{
                fontSize: 12,
                color: "#64748B",
                textDecoration: "underline",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <IconMail size={14} />
              Or email directly: privacy@proxipilot.com
            </a>
          </div>
        </form>
      )}
    </div>
  );
}
