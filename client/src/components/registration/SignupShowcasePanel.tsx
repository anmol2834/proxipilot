"use client";

import React from "react";

export function SignupShowcasePanel() {
  return (
    <div className="pp-signup-right">
      {/* Top Header Text */}
      <div className="pp-showcase-header">
        <h2 className="pp-showcase-title">
          The simplest way to automate your inbox
        </h2>
        <p className="pp-showcase-subtitle">
          Enter your credentials to access your account
        </p>
      </div>

      {/* Floating Dashboard Mockup Area */}
      <div className="pp-mockup-stage">
        {/* Main White Dashboard Card */}
        <div className="pp-dashboard-card">
          {/* Top Bar Navigation */}
          <div className="pp-dash-topbar">
            <span className="pp-dash-title">Dashboard</span>

            <div className="pp-dash-controls">
              <div className="pp-dash-filter-pill">
                <span>All Teams</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>

              <div className="pp-dash-date-pill">
                <span>‹</span>
                <span>Dec 27 2025 - Jan 03, 2026</span>
                <span>›</span>
              </div>
            </div>

            <div className="pp-dash-team-actions">
              <div className="pp-dash-avatar-stack">
                <span className="pp-avatar-circle" style={{ backgroundColor: "#FDE68A", color: "#92400E" }}>AL</span>
                <span className="pp-avatar-circle" style={{ backgroundColor: "#BAE6FD", color: "#0369A1" }}>MK</span>
                <span className="pp-avatar-circle pp-avatar-badge">+2</span>
              </div>
              <div className="pp-dash-add-btn">
                <span>Add members</span>
                <span style={{ fontSize: "10px", marginLeft: "1px" }}>+</span>
              </div>
            </div>
          </div>

          {/* Metrics Row */}
          <div className="pp-dash-metrics-grid">
            {/* Metric 1 */}
            <div className="pp-metric-box">
              <div className="pp-metric-label">Productive Time / Day</div>
              <div className="pp-metric-content">
                <div className="pp-metric-num">12.4 hr</div>
                {/* Sparkline Wave Chart */}
                <svg className="pp-sparkline-svg" viewBox="0 0 60 24" fill="none">
                  <path
                    d="M1 18 C15 14, 25 21, 35 12 C42 6, 48 10, 58 4"
                    stroke="#3562F5"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <circle cx="58" cy="4" r="2.5" fill="#3562F5" />
                  <path
                    d="M1 18 C15 14, 25 21, 35 12 C42 6, 48 10, 58 4 L58 24 L1 24 Z"
                    fill="url(#sparkline-grad)"
                    opacity="0.15"
                  />
                  <defs>
                    <linearGradient id="sparkline-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3562F5" />
                      <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <div className="pp-metric-badge positive">
                <span>↗</span> +23% last week
              </div>
            </div>

            {/* Metric 2 */}
            <div className="pp-metric-box">
              <div className="pp-metric-label">Focused Time</div>
              <div className="pp-metric-content">
                <div className="pp-metric-num">8.5 hr</div>
              </div>
              <div className="pp-metric-badge neutral">
                <span>↘</span> -10% last week
              </div>
            </div>
          </div>

          {/* Utilization Table */}
          <div className="pp-dash-table-wrap">
            <div className="pp-table-header-title">Team&apos;s Utilization</div>
            <table>
              <thead>
                <tr>
                  <th>Team Name</th>
                  <th>Overall Utilization</th>
                  <th>Over Utilized</th>
                  <th>Under Utilized</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div className="pp-team-cell">
                      <span className="pp-team-dot" style={{ backgroundColor: "#3B82F6" }} />
                      <span>Marketing</span>
                    </div>
                  </td>
                  <td><span className="pp-status-badge high">HIGH</span></td>
                  <td>40.00%</td>
                  <td>20.00%</td>
                  <td className="pp-bar-cell">
                    <div className="pp-bar-track">
                      <div className="pp-bar-fill" style={{ width: "40%" }} />
                    </div>
                  </td>
                </tr>

                <tr>
                  <td>
                    <div className="pp-team-cell">
                      <span className="pp-team-dot" style={{ backgroundColor: "#10B981" }} />
                      <span>Customer Success</span>
                    </div>
                  </td>
                  <td><span className="pp-status-badge medium">MEDIUM</span></td>
                  <td>25.00%</td>
                  <td>30.00%</td>
                  <td className="pp-bar-cell">
                    <div className="pp-bar-track">
                      <div className="pp-bar-fill" style={{ width: "25%" }} />
                    </div>
                  </td>
                </tr>

                <tr>
                  <td>
                    <div className="pp-team-cell">
                      <span className="pp-team-dot" style={{ backgroundColor: "#F97316" }} />
                      <span>Dev Team</span>
                    </div>
                  </td>
                  <td><span className="pp-status-badge low">LOW</span></td>
                  <td>02.00%</td>
                  <td>60.00%</td>
                  <td className="pp-bar-cell">
                    <div className="pp-bar-track">
                      <div className="pp-bar-fill" style={{ width: "10%" }} />
                    </div>
                  </td>
                </tr>

                <tr>
                  <td>
                    <div className="pp-team-cell">
                      <span className="pp-team-dot" style={{ backgroundColor: "#6366F1" }} />
                      <span>Sales Team</span>
                    </div>
                  </td>
                  <td><span className="pp-status-badge high">HIGH</span></td>
                  <td>12.00%</td>
                  <td>12.00%</td>
                  <td className="pp-bar-cell">
                    <div className="pp-bar-track">
                      <div className="pp-bar-fill" style={{ width: "30%" }} />
                    </div>
                  </td>
                </tr>

                <tr>
                  <td>
                    <div className="pp-team-cell">
                      <span className="pp-team-dot" style={{ backgroundColor: "#14B8A6" }} />
                      <span>Publicity Team</span>
                    </div>
                  </td>
                  <td><span className="pp-status-badge medium">MEDIUM</span></td>
                  <td>15.00%</td>
                  <td>05.00%</td>
                  <td className="pp-bar-cell">
                    <div className="pp-bar-track">
                      <div className="pp-bar-fill" style={{ width: "20%" }} />
                    </div>
                  </td>
                </tr>

                <tr>
                  <td>
                    <div className="pp-team-cell">
                      <span className="pp-team-dot" style={{ backgroundColor: "#8B5CF6" }} />
                      <span>Design Team</span>
                    </div>
                  </td>
                  <td><span className="pp-status-badge low">LOW</span></td>
                  <td>02.00%</td>
                  <td>70.00%</td>
                  <td className="pp-bar-cell">
                    <div className="pp-bar-track">
                      <div className="pp-bar-fill" style={{ width: "15%" }} />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Floating "Add Member" Overlapping Dialog Card */}
        <div className="pp-floating-invite-card">
          <div className="pp-invite-header">
            <span className="pp-invite-title">Add Member</span>
            <span className="pp-invite-close">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </span>
          </div>

          <div className="pp-invite-input-row">
            <input
              type="text"
              readOnly
              value="user@gmail.com"
              className="pp-invite-input"
            />
            <span className="pp-invite-role">Viewer ▾</span>
            <button type="button" className="pp-invite-send-btn">
              Send Invite
            </button>
          </div>

          <div className="pp-invite-members-list">
            <div className="pp-invite-member-item">
              <div className="pp-member-left">
                <div className="pp-member-avatar" style={{ backgroundColor: "#10B981" }} />
                <div className="pp-member-info">
                  <span className="pp-member-name">Leslie Alexander</span>
                  <span className="pp-member-sub">2 teams</span>
                </div>
              </div>
              <span className="pp-member-role-select">Owner ▾</span>
            </div>

            <div className="pp-invite-member-item">
              <div className="pp-member-left">
                <div className="pp-member-avatar" style={{ backgroundColor: "#3B82F6" }} />
                <div className="pp-member-info">
                  <span className="pp-member-name">Courtney Henry</span>
                  <span className="pp-member-sub">1 team</span>
                </div>
              </div>
              <span className="pp-member-role-select">Editor ▾</span>
            </div>

            <div className="pp-invite-member-item">
              <div className="pp-member-left">
                <div className="pp-member-avatar" style={{ backgroundColor: "#8B5CF6" }} />
                <div className="pp-member-info">
                  <span className="pp-member-name">Robert Fox</span>
                  <span className="pp-member-sub">2 teams</span>
                </div>
              </div>
              <span className="pp-member-role-select">Editor ▾</span>
            </div>
          </div>

          <div className="pp-invite-copy-link">
            <span className="pp-copy-url">proxipilot.ai/invite/ws-38294</span>
            <button type="button" className="pp-copy-btn">
              Copy
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
