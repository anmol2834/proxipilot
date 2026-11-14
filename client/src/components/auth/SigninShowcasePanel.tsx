"use client";

import React from "react";

export function SigninShowcasePanel() {
  return (
    <div className="pp-signin-hero">
      {/* Top Header Text */}
      <div className="pp-showcase-header">
        <h2 className="pp-showcase-title">
          The simplest way to triage your emails
        </h2>
        <p className="pp-showcase-subtitle">
          Autonomous AI triage, continuous inbox monitoring, and instant smart drafting.
        </p>
      </div>

      {/* Floating Dashboard Mockup Area */}
      <div className="pp-mockup-stage">
        {/* Main White Dashboard Card */}
        <div className="pp-dashboard-card">
          {/* Top Bar Navigation */}
          <div className="pp-dash-topbar">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="pp-dash-title">Inbox Live Triage</span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "0.62rem",
                  color: "#059669",
                  backgroundColor: "#ECFDF5",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  fontWeight: 600,
                }}
              >
                <span
                  style={{
                    width: "5px",
                    height: "5px",
                    borderRadius: "50%",
                    backgroundColor: "#10B981",
                  }}
                />
                AI Engine Active
              </span>
            </div>

            <div className="pp-dash-controls">
              <div className="pp-dash-filter-pill">
                <span>Priority Channels</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>

              <div className="pp-dash-date-pill">
                <span>‹</span>
                <span>Today, Oct 2</span>
                <span>›</span>
              </div>
            </div>

            <div className="pp-dash-team-actions">
              <div className="pp-dash-avatar-stack">
                <span className="pp-avatar-circle" style={{ backgroundColor: "#DDD6FE", color: "#6D28D9" }}>AI</span>
                <span className="pp-avatar-circle" style={{ backgroundColor: "#BBF7D0", color: "#15803D" }}>P1</span>
                <span className="pp-avatar-circle pp-avatar-badge">+1</span>
              </div>
              <div className="pp-dash-add-btn">
                <span>3 Online</span>
              </div>
            </div>
          </div>

          {/* Metrics Row */}
          <div className="pp-dash-metrics-grid">
            {/* Metric 1 */}
            <div className="pp-metric-box">
              <div className="pp-metric-label">Emails Triaged Today</div>
              <div className="pp-metric-content">
                <div className="pp-metric-num">1,420</div>
                {/* Rapid Triage Sparkline */}
                <svg className="pp-sparkline-svg" viewBox="0 0 60 24" fill="none">
                  <path
                    d="M1 20 C10 16, 20 8, 30 14 C40 6, 48 10, 58 3"
                    stroke="#3562F5"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <circle cx="58" cy="3" r="2.5" fill="#3562F5" />
                  <path
                    d="M1 20 C10 16, 20 8, 30 14 C40 6, 48 10, 58 3 L58 24 L1 24 Z"
                    fill="url(#signin-spark-grad)"
                    opacity="0.15"
                  />
                  <defs>
                    <linearGradient id="signin-spark-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3562F5" />
                      <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <div className="pp-metric-badge positive">
                <span>↗</span> +34% automated
              </div>
            </div>

            {/* Metric 2 */}
            <div className="pp-metric-box">
              <div className="pp-metric-label">Avg Triage Speed</div>
              <div className="pp-metric-content">
                <div className="pp-metric-num">1.2 sec</div>
              </div>
              <div className="pp-metric-badge positive">
                <span>⚡</span> 99.4% instant
              </div>
            </div>
          </div>

          {/* Live Autonomous Feed Table */}
          <div className="pp-dash-table-wrap">
            <div className="pp-table-header-title">Recent Autonomous Actions</div>
            <table>
              <thead>
                <tr>
                  <th>Sender / Subject</th>
                  <th>Classification</th>
                  <th>Action Taken</th>
                  <th>Confidence</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div className="pp-team-cell">
                      <span className="pp-team-dot" style={{ backgroundColor: "#10B981" }} />
                      <span>Stripe Billing • Invoice #4092</span>
                    </div>
                  </td>
                  <td><span className="pp-status-badge medium">FINANCE</span></td>
                  <td>Auto-Drafted Reply</td>
                  <td style={{ fontWeight: 600, color: "#059669" }}>99.8%</td>
                  <td className="pp-bar-cell">
                    <div className="pp-bar-track">
                      <div className="pp-bar-fill" style={{ width: "95%" }} />
                    </div>
                  </td>
                </tr>

                <tr>
                  <td>
                    <div className="pp-team-cell">
                      <span className="pp-team-dot" style={{ backgroundColor: "#8B5CF6" }} />
                      <span>Acme Corp • Enterprise SLA</span>
                    </div>
                  </td>
                  <td><span className="pp-status-badge high">VIP SALES</span></td>
                  <td>Routed to Exec</td>
                  <td style={{ fontWeight: 600, color: "#059669" }}>99.2%</td>
                  <td className="pp-bar-cell">
                    <div className="pp-bar-track">
                      <div className="pp-bar-fill" style={{ width: "88%" }} />
                    </div>
                  </td>
                </tr>

                <tr>
                  <td>
                    <div className="pp-team-cell">
                      <span className="pp-team-dot" style={{ backgroundColor: "#3B82F6" }} />
                      <span>Datadog • Incident #819</span>
                    </div>
                  </td>
                  <td><span className="pp-status-badge low">TECH OPS</span></td>
                  <td>Resolved & Tagged</td>
                  <td style={{ fontWeight: 600, color: "#059669" }}>100%</td>
                  <td className="pp-bar-cell">
                    <div className="pp-bar-track">
                      <div className="pp-bar-fill" style={{ width: "100%" }} />
                    </div>
                  </td>
                </tr>

                <tr>
                  <td>
                    <div className="pp-team-cell">
                      <span className="pp-team-dot" style={{ backgroundColor: "#F97316" }} />
                      <span>Talent Hunt • Lead Engineer</span>
                    </div>
                  </td>
                  <td><span className="pp-status-badge medium">HIRING</span></td>
                  <td>Calendar Sent</td>
                  <td style={{ fontWeight: 600, color: "#059669" }}>98.6%</td>
                  <td className="pp-bar-cell">
                    <div className="pp-bar-track">
                      <div className="pp-bar-fill" style={{ width: "75%" }} />
                    </div>
                  </td>
                </tr>

                <tr>
                  <td>
                    <div className="pp-team-cell">
                      <span className="pp-team-dot" style={{ backgroundColor: "#64748B" }} />
                      <span>AWS Cloud • Usage Summary</span>
                    </div>
                  </td>
                  <td><span className="pp-status-badge low">SYSTEM</span></td>
                  <td>Archived & Synced</td>
                  <td style={{ fontWeight: 600, color: "#059669" }}>99.9%</td>
                  <td className="pp-bar-cell">
                    <div className="pp-bar-track">
                      <div className="pp-bar-fill" style={{ width: "90%" }} />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Floating "Autonomous AI Agent" Overlapping Card */}
        <div className="pp-floating-agent-card">
          <div className="pp-agent-header">
            <div className="pp-agent-title-row">
              <span className="pp-agent-pulse-dot" />
              <span className="pp-agent-title">Smart Auto-Draft</span>
            </div>
            <span className="pp-agent-badge">Pilot-01</span>
          </div>

          <div className="pp-agent-preview-box">
            <div className="pp-agent-recipient">
              To: <span>sarah@acme.com</span>
            </div>
            <div className="pp-agent-snippet">
              &ldquo;Hi Sarah, our team reviewed the SLA terms. All SOC2 compliance items are confirmed and approved...&rdquo;
            </div>
          </div>

          <div className="pp-agent-confidence">
            <span>Context Precision</span>
            <span className="pp-conf-score">99.4% Match</span>
          </div>

          <div className="pp-agent-actions">
            <button type="button" className="pp-btn-approve">
              <span>✓</span> Approve & Send
            </button>
            <button type="button" className="pp-btn-edit">
              Edit
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Client Logos Strip */}
      <div className="pp-showcase-logos-bar">
        {/* WeChat */}
        <div className="pp-partner-logo" title="WeChat">
          <svg width="68" height="20" viewBox="0 0 100 30" fill="currentColor">
            <circle cx="12" cy="13" r="10" opacity="0.9" />
            <circle cx="26" cy="18" r="8" opacity="0.9" />
            <circle cx="8" cy="11" r="1.5" fill="#204be5" />
            <circle cx="15" cy="11" r="1.5" fill="#204be5" />
            <circle cx="23" cy="17" r="1.2" fill="#204be5" />
            <circle cx="28" cy="17" r="1.2" fill="#204be5" />
            <text x="38" y="20" fontSize="13" fontWeight="600" fill="#ffffff" fontFamily="sans-serif">WeChat</text>
          </svg>
        </div>

        {/* Booking.com */}
        <div className="pp-partner-logo" title="Booking.com">
          <svg width="88" height="18" viewBox="0 0 120 24" fill="currentColor">
            <text x="0" y="18" fontSize="15" fontWeight="800" fill="#ffffff" letterSpacing="-0.5" fontFamily="sans-serif">
              Booking.com
            </text>
          </svg>
        </div>

        {/* Google */}
        <div className="pp-partner-logo" title="Google">
          <svg width="64" height="20" viewBox="0 0 74 24" fill="currentColor">
            <text x="0" y="18" fontSize="17" fontWeight="600" fill="#ffffff" letterSpacing="-0.2" fontFamily="sans-serif">
              Google
            </text>
          </svg>
        </div>

        {/* Spotify */}
        <div className="pp-partner-logo" title="Spotify">
          <svg width="74" height="22" viewBox="0 0 90 26" fill="currentColor">
            <circle cx="11" cy="13" r="9" />
            <path d="M6 10 C9 8, 14 8, 17 10" stroke="#204be5" strokeWidth="1.8" strokeLinecap="round" fill="none" />
            <path d="M7 13 C9.5 11.5, 13 11.5, 15.5 13" stroke="#204be5" strokeWidth="1.6" strokeLinecap="round" fill="none" />
            <path d="M8 16 C9.8 15, 12.2 15, 14 16" stroke="#204be5" strokeWidth="1.4" strokeLinecap="round" fill="none" />
            <text x="24" y="18" fontSize="14" fontWeight="700" fill="#ffffff" fontFamily="sans-serif">Spotify</text>
          </svg>
        </div>

        {/* Stripe */}
        <div className="pp-partner-logo" title="stripe">
          <svg width="50" height="20" viewBox="0 0 60 24" fill="currentColor">
            <text x="0" y="18" fontSize="17" fontWeight="800" fill="#ffffff" letterSpacing="-0.5" fontFamily="sans-serif">
              stripe
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
}
