"use client";

/**
 * Dashboard overview. Every number and list on this screen comes from the server
 * (GET /dashboard/overview, /auth/me, setup status) and is computed from the organization's own
 * data. When there is no data yet, the UI says so ("—" or an empty state) instead of inventing it.
 */
import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  IconMail,
  IconSparkles,
  IconCheck,
  IconAlertTriangle,
  IconArrowRight,
  IconClock,
  IconDatabase,
  IconBolt,
  IconUsers,
  IconBrandGmail,
  IconBrandOffice,
  IconFileText,
  IconBrain,
  IconChartBar,
  IconInbox,
} from "@tabler/icons-react";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
import { useSetupStatus } from "@/hooks/use-setup-status";
import { useDashboardOverview } from "@/hooks/use-dashboard-overview";
import type { ActivityStatus, DashboardOverview } from "@/services/dashboard.service";

// ---------------------------------------------------------------------------
// Formatting helpers (no data -> "—")
// ---------------------------------------------------------------------------
const DASH = "—";
const fmtInt = (n: number | null | undefined) => (typeof n === "number" ? n.toLocaleString("en-IN") : DASH);
const fmtPct = (ratio: number | null | undefined) =>
  typeof ratio === "number" ? `${Math.round(ratio * 1000) / 10}%` : DASH;
const fmtPctValue = (pct: number | null | undefined) => (typeof pct === "number" ? `${pct}%` : DASH);

function fmtMinutes(min: number | null | undefined): string {
  if (typeof min !== "number") return DASH;
  if (min < 1) return `${Math.max(1, Math.round(min * 60))} sec`;
  if (min < 60) return `${Math.round(min * 10) / 10} min`;
  return `${Math.round((min / 60) * 10) / 10} h`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const STATUS_BADGE: Record<ActivityStatus, { label: string; bg: string; color: string }> = {
  replied: { label: "Replied", bg: "#ecfdf5", color: "#16a34a" },
  draft_ready: { label: "Draft ready for review", bg: "#eff6ff", color: "#2563eb" },
  sending: { label: "Sending", bg: "#f5f3ff", color: "#7c3aed" },
  needs_reply: { label: "Needs a reply", bg: "#fff7ed", color: "#ea580c" },
  awaiting_ai: { label: "AI drafting", bg: "#f8fafc", color: "#64748b" },
};

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------
const card = { whileHover: { y: -2 }, transition: { duration: 0.2 } } as const;

function CardTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
      {icon}
      <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>{children}</h3>
    </div>
  );
}

function Skeleton({
  h = 18,
  w = "100%",
  r = 6,
  style,
  className = "",
}: {
  h?: number | string;
  w?: number | string;
  r?: number | string;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={`bento-skeleton ${className}`.trim()}
      style={{
        height: h,
        width: w,
        borderRadius: r,
        background: "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%)",
        backgroundSize: "200% 100%",
        animation: "bentoShimmer 1.6s ease-in-out infinite",
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

function MetricCard({
  label,
  value,
  sub,
  icon,
  accent = "#0f172a",
  subColor = "#64748b",
  glow,
  loading = false,
  valueWidth = 70,
  subWidth = 120,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  accent?: string;
  subColor?: string;
  glow?: string;
  loading?: boolean;
  valueWidth?: number | string;
  subWidth?: number | string;
}) {
  return (
    <motion.div {...card} className={`bento-card bento-col-span-1${glow ? ` ${glow}` : ""}`}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.74rem", fontWeight: 700, color: accent === "#0f172a" ? "#64748b" : accent, textTransform: "uppercase" }}>
          {label}
        </span>
        {icon}
      </div>
      {loading ? (
        <div style={{ margin: "8px 0 4px 0" }}>
          <Skeleton h={34} w={valueWidth} r={6} />
        </div>
      ) : (
        <div style={{ fontSize: "1.9rem", fontWeight: 800, color: accent, margin: "6px 0 2px 0" }}>{value}</div>
      )}
      {loading ? (
        <Skeleton h={13} w={subWidth} r={4} style={{ marginTop: 4 }} />
      ) : (
        <div style={{ fontSize: "0.75rem", color: subColor, fontWeight: 600 }}>{sub}</div>
      )}
    </motion.div>
  );
}

function RecentActivity({ data, loading }: { data?: DashboardOverview; loading: boolean }) {
  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              padding: "12px 14px",
              borderRadius: "12px",
              border: "1px solid #f1f5f9",
              backgroundColor: "#fafafa",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <Skeleton h={15} w={i === 0 ? "65%" : i === 1 ? "48%" : "58%"} r={4} />
              <Skeleton h={11} w={i === 0 ? "35%" : "28%"} r={3} style={{ marginTop: 6 }} />
            </div>
            <Skeleton h={22} w={72} r={6} style={{ flexShrink: 0 }} />
          </div>
        ))}
      </div>
    );
  }
  const items = data?.recent_activity ?? [];
  if (items.length === 0) {
    return (
      <div style={{ padding: "22px 12px", textAlign: "center", color: "#64748b", fontSize: "0.82rem" }}>
        <IconInbox size={22} color="#94a3b8" style={{ marginBottom: 6 }} />
        <div style={{ fontWeight: 700, color: "#0f172a" }}>No customer conversations yet</div>
        <div style={{ marginTop: 4 }}>New customer emails and their AI drafts will appear here as they arrive.</div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {items.map((item) => {
        const badge = STATUS_BADGE[item.status] ?? STATUS_BADGE.awaiting_ai;
        return (
          <Link
            key={item.thread_id}
            href="/dashboard/inbox"
            style={{
              padding: "12px 14px", borderRadius: "12px", border: "1px solid #f1f5f9", backgroundColor: "#fafafa",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
              textDecoration: "none", color: "inherit",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {item.subject}
              </div>
              <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "2px" }}>
                {item.contact || "Unknown sender"}
                {item.at ? ` • ${timeAgo(item.at)}` : ""}
              </div>
            </div>
            <span style={{ padding: "3px 8px", borderRadius: "6px", backgroundColor: badge.bg, color: badge.color, fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap" }}>
              {badge.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
export function BentoDashboardOverview() {
  const router = useRouter();
  const { user } = useAuth();
  const { currentOrganization } = useTenant();
  const { data, isLoading: isOverviewLoading, isPending: isOverviewPending } = useDashboardOverview(7);
  const {
    accountCreated,
    emailConnected,
    knowledgeAdded,
    isSetupComplete,
    isEmailLoading,
    isKnowledgeLoading,
    isInitialLoading: isSetupInitialLoading,
  } = useSetupStatus(data);

  // Identity from the authenticated session, never from a local draft or a hardcoded default.
  const firstName = (user?.first_name || user?.full_name?.split(" ")[0] || "").trim();
  const isReturning = (user?.login_count ?? 0) > 0;
  const greeting = `${isReturning ? "Welcome back" : "Welcome"}${firstName ? `, ${firstName}` : ""}`;
  const orgName = currentOrganization?.name || "";

  // Dynamic data loading check: true while initial data is in flight from backend.
  const isPageLoading = (!data && isOverviewPending) || isOverviewLoading || isSetupInitialLoading;

  const totalSteps = 3;
  const completedCount = [accountCreated, emailConnected, knowledgeAdded].filter(Boolean).length;
  const progressPercent = Math.round((completedCount / totalSteps) * 100);

  const pending = data?.needs_attention.pending_review ?? 0;
  const change = data?.inbound.change_pct;
  const windowLabel = `last ${data?.window_days ?? 7} days`;

  return (
    <div className="bento-dashboard-container">
      {/* 1. HEADER ROW ------------------------------------------------------ */}
      <div className="bento-grid">
        <motion.div {...card} className="bento-card bento-col-span-3 glow-blue"
          style={{ background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)", minHeight: "160px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                {isPageLoading ? (
                  <Skeleton h={24} w={150} r={9999} />
                ) : (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: "6px", padding: "3px 9px", borderRadius: "9999px",
                    backgroundColor: isSetupComplete ? "#ecfdf5" : "#eff6ff", color: isSetupComplete ? "#059669" : "#2563EB",
                    fontSize: "0.74rem", fontWeight: 700,
                  }}>
                    <span className="bento-pulse-dot" style={{ backgroundColor: isSetupComplete ? "#10b981" : "#3562f5" }} />
                    {isSetupComplete ? "AI REPLIES ACTIVE" : "SETUP IN PROGRESS"}
                  </span>
                )}
                {orgName ? (
                  <span style={{ fontSize: "0.74rem", color: "#64748b", padding: "3px 8px", borderRadius: "6px", backgroundColor: "#f1f5f9", fontWeight: 600 }}>
                    {orgName}
                  </span>
                ) : isPageLoading ? (
                  <Skeleton h={24} w={90} r={6} />
                ) : null}
              </div>
              <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.025em", lineHeight: 1.2, margin: 0 }}>
                {greeting} 👋
              </h1>
              <div style={{ fontSize: "0.88rem", color: "#64748b", marginTop: "6px", marginBottom: 0 }}>
                {isPageLoading ? (
                  <Skeleton h={16} w={380} r={4} style={{ marginTop: 6 }} />
                ) : isSetupComplete ? (
                  "ProxiPilot is reading new customer emails and drafting replies from your company knowledge."
                ) : (
                  "Complete the setup checklist below to connect your inbox and start AI-drafted replies."
                )}
              </div>
            </div>
            <button type="button" onClick={() => router.push("/dashboard/inbox")} style={{
              display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "10px",
              backgroundColor: "#3562f5", color: "#ffffff", fontSize: "0.82rem", fontWeight: 600, border: "none",
              cursor: "pointer", boxShadow: "0 2px 8px rgba(53, 98, 245, 0.25)",
            }}>
              <IconMail size={16} />
              <span>Go to Inbox</span>
            </button>
          </div>

          {/* Live workspace status (real values or wireframe skeletons) */}
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "16px", marginTop: "18px", paddingTop: "12px", borderTop: "1px solid #f1f5f9", fontSize: "0.78rem", color: "#64748b" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <IconBrandGmail size={16} color="#ea4335" />
              {isPageLoading ? (
                <Skeleton h={13} w={130} r={4} />
              ) : (
                <span>{data ? `${data.workspace.mailboxes} ${data.workspace.mailboxes === 1 ? "mailbox" : "mailboxes"} connected` : "Mailboxes: …"}</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <IconDatabase size={16} color="#2563EB" />
              {isPageLoading ? (
                <Skeleton h={13} w={160} r={4} />
              ) : (
                <span>{data ? `${fmtInt(data.workspace.knowledge_items)} knowledge items indexed` : "Knowledge: …"}</span>
              )}
            </div>
            {isPageLoading ? (
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <IconBolt size={16} color="#7c3aed" />
                <Skeleton h={13} w={110} r={4} />
              </div>
            ) : data?.ai.model ? (
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <IconBolt size={16} color="#7c3aed" />
                <span>AI model: {data.ai.model}</span>
              </div>
            ) : null}
          </div>
        </motion.div>

        {/* Draft approval (real: reviewed drafts approved without edits) */}
        <motion.div {...card} className="bento-card bento-col-span-1 glow-green"
          style={{ background: "linear-gradient(145deg, #ffffff 0%, #f0fdf4 100%)", minHeight: "160px", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#166534", textTransform: "uppercase" }}>Draft approval</span>
            <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", color: "#15803d" }}>
              <IconBrain size={18} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: "2.1rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em" }}>
              {isPageLoading ? <Skeleton h={38} w={90} r={6} style={{ margin: "4px 0" }} /> : fmtPct(data?.ai.approval_rate)}
            </div>
            <div style={{ fontSize: "0.78rem", color: "#15803d", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
              {isPageLoading ? (
                <Skeleton h={13} w={130} r={4} />
              ) : (
                <>
                  <IconCheck size={14} stroke={3} />
                  <span>{data && data.ai.drafts_reviewed > 0 ? "Sent without edits" : "No drafts reviewed yet"}</span>
                </>
              )}
            </div>
          </div>
          <div style={{ fontSize: "0.72rem", color: "#64748b", paddingTop: "8px", borderTop: "1px solid rgba(22, 101, 52, 0.1)" }}>
            {isPageLoading ? (
              <Skeleton h={12} w={180} r={4} />
            ) : (
              data ? `${fmtInt(data.ai.drafts_reviewed)} AI drafts reviewed in the ${windowLabel}.` : "Calculated from your team's reviews."
            )}
          </div>
        </motion.div>
      </div>

      {/* 2. MAIN GRID -------------------------------------------------------- */}
      {!isPageLoading && !isSetupComplete ? (
        <div className="bento-grid">
          {/* Setup checklist (real server-derived status) */}
          <motion.div {...card} className="bento-card bento-col-span-2 bento-row-span-2 glow-blue" style={{ minHeight: "340px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <div>
                  <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "#3562f5", textTransform: "uppercase", letterSpacing: "0.08em" }}>GET STARTED</span>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", margin: "4px 0 0 0" }}>Complete setup to activate ProxiPilot</h2>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#0f172a" }}>{completedCount} of {totalSteps} done</span>
                  <div style={{ width: "120px", height: "6px", backgroundColor: "#e2e8f0", borderRadius: "9999px", overflow: "hidden", marginTop: "6px" }}>
                    <div style={{ width: `${progressPercent}%`, height: "100%", backgroundColor: "#3562f5", borderRadius: "9999px", transition: "width 0.4s ease" }} />
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[
                  { done: accountCreated, n: 1, title: "Create your account", sub: "Verified email & workspace initialized", doneLabel: "Completed", loading: false },
                  { done: emailConnected, n: 2, title: "Connect business email", sub: "Sync Gmail or Microsoft Outlook", doneLabel: "Connected", href: "/dashboard/integrations", cta: "Connect now", loading: isEmailLoading },
                  { done: knowledgeAdded, n: 3, title: "Add company knowledge", sub: "Upload your product or service catalogue", doneLabel: "Indexed", href: "/dashboard/knowledge", cta: "Add knowledge", loading: isKnowledgeLoading },
                ].map((s) => (
                  <div key={s.n} style={{
                    padding: "14px 16px", borderRadius: "14px", backgroundColor: s.done ? "#f8fafc" : "#ffffff",
                    border: s.done ? "1px solid #e2e8f0" : "1px solid #bfdbfe", display: "flex", alignItems: "center",
                    justifyContent: "space-between", boxShadow: s.done ? "none" : "0 4px 12px rgba(37, 99, 235, 0.06)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%", backgroundColor: s.done ? "#22c55e" : "#eff6ff",
                        color: s.done ? "#ffffff" : "#2563eb", display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 700, fontSize: "0.8rem",
                      }}>
                        {s.loading ? <Skeleton h={16} w={16} r={9999} /> : s.done ? <IconCheck size={16} stroke={3} /> : s.n}
                      </div>
                      <div>
                        <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#0f172a" }}>{s.n}. {s.title}</div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{s.sub}</div>
                      </div>
                    </div>
                    {s.loading ? (
                      <Skeleton h={28} w={85} r={8} />
                    ) : s.done || !s.href ? (
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: s.done ? "#16a34a" : "#64748b" }}>{s.done ? s.doneLabel : ""}</span>
                    ) : (
                      <button type="button" onClick={() => router.push(s.href!)} style={{
                        padding: "6px 14px", borderRadius: "8px", backgroundColor: "#3562f5", color: "#ffffff",
                        border: "none", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
                      }}>
                        {s.cta}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginTop: "14px", fontSize: "0.74rem", color: "#64748b", display: "flex", alignItems: "center", gap: "6px" }}>
              <IconSparkles size={15} color="#3562f5" />
              <span>Once all steps are complete, your live operations dashboard unlocks automatically.</span>
            </div>
          </motion.div>

          {/* Quick launch (navigation only) */}
          <motion.div {...card} className="bento-card bento-col-span-1">
            <div>
              <CardTitle icon={<IconBolt size={18} color="#3562f5" />}>Quick Launch</CardTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[
                  { href: "/dashboard/integrations", label: "Connect Gmail", icon: <IconBrandGmail size={18} color="#ea4335" /> },
                  { href: "/dashboard/integrations", label: "Connect Outlook", icon: <IconBrandOffice size={18} color="#00a4ef" /> },
                  { href: "/dashboard/knowledge", label: "Add Knowledge", icon: <IconFileText size={18} color="#3562f5" /> },
                  { href: "/dashboard/team", label: "Invite Teammates", icon: <IconUsers size={18} color="#7c3aed" /> },
                ].map((l) => (
                  <Link key={l.label} href={l.href} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px",
                    borderRadius: "10px", border: "1px solid #e2e8f0", textDecoration: "none", color: "#0f172a",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {l.icon}
                      <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>{l.label}</span>
                    </div>
                    <IconArrowRight size={14} color="#94a3b8" />
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>

          {/* This week (real numbers, zero until mail arrives) */}
          <motion.div {...card} className="bento-card bento-col-span-1">
            <div>
              <CardTitle icon={<IconChartBar size={18} color="#3562f5" />}>This week</CardTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "0.82rem" }}>
                {[
                  ["Customer emails", isPageLoading ? <Skeleton h={14} w={40} r={4} /> : fmtInt(data?.inbound.count)],
                  ["AI drafts created", isPageLoading ? <Skeleton h={14} w={40} r={4} /> : fmtInt(data?.ai.drafts_generated)],
                  ["AI replies sent", isPageLoading ? <Skeleton h={14} w={40} r={4} /> : fmtInt(data?.ai.replies_sent)],
                  ["Avg. first reply", isPageLoading ? <Skeleton h={14} w={55} r={4} /> : fmtMinutes(data?.response_time.avg_first_reply_minutes)],
                ].map(([k, v]) => (
                  <div key={k as string} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#64748b" }}>{k}</span>
                    <strong style={{ color: "#0f172a" }}>{v}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ paddingTop: "10px", borderTop: "1px solid #f1f5f9", fontSize: "0.72rem", color: "#64748b" }}>
              Updates automatically as emails arrive.
            </div>
          </motion.div>

          {/* Recent conversations (real) */}
          <motion.div {...card} className="bento-card bento-col-span-2">
            <CardTitle icon={<IconMail size={18} color="#3562f5" />}>Recent conversations</CardTitle>
            <RecentActivity data={data} loading={isPageLoading} />
          </motion.div>
        </div>
      ) : (
        <>
          {/* Metric cards (real, last 7 days or exact wireframe) */}
          <div className="bento-grid">
            <MetricCard
              label="Customer emails"
              icon={<IconMail size={16} color="#64748b" />}
              value={fmtInt(data?.inbound.count)}
              sub={typeof change === "number" ? `${change >= 0 ? "+" : ""}${change}% vs previous ${data?.window_days} days` : windowLabel}
              subColor={typeof change === "number" ? (change >= 0 ? "#16a34a" : "#dc2626") : "#64748b"}
              loading={isPageLoading}
              valueWidth={70}
              subWidth={120}
            />
            <MetricCard
              label="AI replies sent"
              icon={<IconSparkles size={16} color="#2563eb" />}
              accent="#2563eb"
              glow="glow-blue"
              value={fmtInt(data?.ai.replies_sent)}
              sub={data ? `${fmtPctValue(data.ai.reply_coverage_pct)} of customer emails • ${fmtInt(data.ai.auto_sent)} auto-sent` : windowLabel}
              loading={isPageLoading}
              valueWidth={70}
              subWidth={140}
            />
            <MetricCard
              label="Needs review"
              icon={<IconAlertTriangle size={16} color="#ea580c" />}
              accent="#ea580c"
              glow="glow-amber"
              subColor="#ea580c"
              value={fmtInt(pending)}
              sub={pending > 0 ? "AI drafts awaiting approval" : "All caught up"}
              loading={isPageLoading}
              valueWidth={50}
              subWidth={120}
            />
            <MetricCard
              label="Avg first reply"
              icon={<IconClock size={16} color="#64748b" />}
              value={fmtMinutes(data?.response_time.avg_first_reply_minutes)}
              sub={data ? `${fmtInt(data.response_time.replied_conversations)} replied conversations • ${windowLabel}` : windowLabel}
              loading={isPageLoading}
              valueWidth={80}
              subWidth={130}
            />
          </div>

          <div className="bento-grid">
            {/* Recent activity (real or wireframe) */}
            <motion.div {...card} className="bento-card bento-col-span-2 bento-row-span-2 glow-blue">
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                  <CardTitle icon={<IconMail size={18} color="#3562f5" />}>Recent conversations</CardTitle>
                  <Link href="/dashboard/inbox" style={{ fontSize: "0.8rem", fontWeight: 700, color: "#3562f5", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}>
                    <span>View Inbox</span>
                    <IconArrowRight size={14} />
                  </Link>
                </div>
                <RecentActivity data={data} loading={isPageLoading} />
              </div>
            </motion.div>

            {/* Needs attention (real or wireframe) */}
            <motion.div {...card} className="bento-card bento-col-span-1 glow-amber">
              <div>
                <CardTitle icon={<IconAlertTriangle size={18} color="#d97706" />}>Needs your attention</CardTitle>
                {isPageLoading ? (
                  <div
                    style={{
                      padding: "14px 12px",
                      borderRadius: "12px",
                      backgroundColor: "#fffbeb",
                      border: "1px solid #fef3c7",
                      marginBottom: "10px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <Skeleton h={15} w="85%" r={4} />
                    <Skeleton h={12} w="60%" r={3} />
                  </div>
                ) : (
                  <>
                    <div style={{ padding: "12px", borderRadius: "12px", backgroundColor: pending > 0 ? "#fffbeb" : "#f0fdf4", border: `1px solid ${pending > 0 ? "#fef3c7" : "#dcfce7"}`, marginBottom: "10px" }}>
                      <div style={{ fontSize: "0.8rem", fontWeight: 700, color: pending > 0 ? "#92400e" : "#166534" }}>
                        {pending > 0 ? `${pending} AI ${pending === 1 ? "draft" : "drafts"} waiting for review` : "No drafts waiting for review"}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: pending > 0 ? "#b45309" : "#15803d", marginTop: "4px", lineHeight: 1.4 }}>
                        {pending > 0
                          ? "These replies were held for a human check before sending."
                          : "Every AI draft has been reviewed or sent."}
                      </div>
                    </div>
                    {pending > 0 && (
                      <button type="button" onClick={() => router.push("/dashboard/inbox")} style={{
                        width: "100%", padding: "8px 12px", borderRadius: "8px", backgroundColor: "#d97706", color: "#ffffff",
                        border: "none", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
                      }}>
                        Review {pending} {pending === 1 ? "draft" : "drafts"} →
                      </button>
                    )}
                  </>
                )}
              </div>
            </motion.div>

            {/* AI performance (real or wireframe) */}
            <motion.div {...card} className="bento-card bento-col-span-1">
              <div>
                <CardTitle icon={<IconBrain size={18} color="#3562f5" />}>AI performance</CardTitle>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.78rem", color: "#64748b" }}>
                  {[
                    ["Drafts created", isPageLoading ? <Skeleton h={14} w={45} r={4} /> : fmtInt(data?.ai.drafts_generated)],
                    ["Approved without edits", isPageLoading ? <Skeleton h={14} w={50} r={4} /> : fmtPct(data?.ai.approval_rate)],
                    ["Edited before sending", isPageLoading ? <Skeleton h={14} w={50} r={4} /> : fmtPct(data?.ai.edit_rate)],
                    ["Avg. drafting time", isPageLoading ? <Skeleton h={14} w={40} r={4} /> : (typeof data?.ai.avg_processing_seconds === "number" ? `${data.ai.avg_processing_seconds} s` : DASH)],
                    ["Model", isPageLoading ? <Skeleton h={14} w={65} r={4} /> : (data?.ai.model || DASH)],
                  ].map(([k, v]) => (
                    <div key={k as string} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span>{k}</span>
                      <strong style={{ color: "#0f172a", textAlign: "right" }}>{v}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ paddingTop: "10px", borderTop: "1px solid #f1f5f9", fontSize: "0.72rem", color: "#64748b" }}>
                {isPageLoading ? <Skeleton h={11} w={85} r={3} /> : windowLabel}
              </div>
            </motion.div>

            {/* Quick launchpad (navigation only) */}
            <motion.div {...card} className="bento-card bento-col-span-2">
              <CardTitle icon={<IconBolt size={18} color="#3562f5" />}>Quick Launchpad</CardTitle>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
                {[
                  { href: "/dashboard/inbox", label: "Inbox", icon: <IconMail size={20} color="#3562f5" /> },
                  { href: "/dashboard/knowledge", label: "Knowledge", icon: <IconDatabase size={20} color="#059669" /> },
                  { href: "/dashboard/integrations", label: "Mailboxes", icon: <IconBrandGmail size={20} color="#ea4335" /> },
                  { href: "/dashboard/team", label: "Team", icon: <IconUsers size={20} color="#7c3aed" /> },
                ].map((l) => (
                  <Link key={l.label} href={l.href} style={{
                    padding: "10px", borderRadius: "10px", border: "1px solid #e2e8f0", textDecoration: "none",
                    textAlign: "center", color: "#0f172a", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
                  }}>
                    {l.icon}
                    <span style={{ fontSize: "0.76rem", fontWeight: 700 }}>{l.label}</span>
                  </Link>
                ))}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </div>
  );
}
