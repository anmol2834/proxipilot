"use client";

import React from "react";
import { Conversation } from "@/types/inbox.types";

interface ConversationListItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onSelect: () => void;
}

// Brand-aware or deterministic palette for avatars
function getAvatarStyle(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("shiprocket")) return { bg: "#F3E8FF", color: "#9333EA" };
  if (lower.includes("derma")) return { bg: "#D1FAE5", color: "#059669" };
  if (lower.includes("indeed")) return { bg: "#EDE9FE", color: "#4F46E5" };
  if (lower.includes("quora")) return { bg: "#CCFBF1", color: "#0D9488" };
  if (lower.includes("zomato")) return { bg: "#EF4444", color: "#FFFFFF" };

  const PALETTE = [
    { bg: "#EFF6FF", color: "#2563EB" },
    { bg: "#F0FDF4", color: "#16A34A" },
    { bg: "#FEF3C7", color: "#D97706" },
    { bg: "#FDF2F8", color: "#C026D3" },
    { bg: "#F0F9FF", color: "#0284C7" },
    { bg: "#FFF1F2", color: "#E11D48" },
    { bg: "#F5F3FF", color: "#7C3AED" },
    { bg: "#ECFDF5", color: "#059669" },
  ];
  return PALETTE[name.charCodeAt(0) % PALETTE.length];
}

// Chip colours for lead temperature tags
const TEMP_CHIP: Record<string, { bg: string; color: string; icon: string; label: string }> = {
  hot: { bg: "#FEF2F2", color: "#DC2626", icon: "🔥", label: "Hot" },
  warm: { bg: "#FFFBEB", color: "#D97706", icon: "☀️", label: "Warm" },
  cold: { bg: "#F0F9FF", color: "#0284C7", icon: "❄️", label: "Cold" },
};

// Derive category chip matching reference design
function guessCategory(subject: string, senderName: string): { label: string; bg: string; color: string } | null {
  const s = `${subject} ${senderName}`.toLowerCase();
  if (s.includes("logistics")) return { label: "Logistics", bg: "#EFF6FF", color: "#2563EB" };
  if (s.includes("delivery")) return { label: "Delivery", bg: "#EFF6FF", color: "#2563EB" };
  if (s.includes("order") || s.includes("shipment") || s.includes("derma") || s.includes("zomato")) {
    return { label: "Order Update", bg: "#EFF6FF", color: "#2563EB" };
  }
  if (s.includes("career") || s.includes("job") || s.includes("trainer") || s.includes("indeed")) {
    return { label: "Careers", bg: "#EFF6FF", color: "#2563EB" };
  }
  if (s.includes("digest") || s.includes("stories") || s.includes("quora")) {
    return { label: "Digest", bg: "#EFF6FF", color: "#2563EB" };
  }
  if (s.includes("invoice") || s.includes("billing") || s.includes("payment")) {
    return { label: "Billing", bg: "#ECFDF5", color: "#059669" };
  }
  return null;
}

/** Compact follow-up badge for the list (server already filters to active follow-up states). */
function followupBadge(status: string | null, dueAt: string | null): { label: string; title: string; color: string; bg: string } | null {
  if (!status) return null;
  const due = dueAt ? new Date(dueAt) : null;
  const overdue = due ? due.getTime() <= Date.now() : false;
  if (status === "needs_review") return { label: "Review", title: "Follow-up needs a decision", color: "#B91C1C", bg: "#FEE2E2" };
  if (due && overdue) return { label: "Follow-up due", title: `Due ${due.toLocaleString()}`, color: "#B91C1C", bg: "#FEE2E2" };
  if (due) {
    return { label: `Follow up ${due.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`,
             title: `Due ${due.toLocaleString()}`, color: "#1D4ED8", bg: "#DBEAFE" };
  }
  if (status === "waiting_team") return { label: "Team owes reply", title: "Your team owes the next step", color: "#B45309", bg: "#FEF3C7" };
  return null;
}

export function ConversationListItem({
  conversation,
  isSelected,
  onSelect,
}: ConversationListItemProps) {
  const { sender, subject, snippet, latestMessageAt, unread, leadTemperature, threadCount } = conversation;
  const avatarStyle = getAvatarStyle(sender.name);
  const tempChip = leadTemperature ? TEMP_CHIP[leadTemperature] : null;
  const followupChip = followupBadge(conversation.followupStatus ?? null, conversation.followupDueAt ?? null);
  const categoryChip = guessCategory(subject, sender.name);

  return (
    <div
      onClick={onSelect}
      style={{
        padding: "10px 10px 10px 8px",
        borderRadius: 10,
        cursor: "pointer",
        position: "relative",
        background: isSelected ? "#F0F7FF" : "transparent",
        border: `1.5px solid ${isSelected ? "#3B82F6" : "transparent"}`,
        transition: "all 0.12s ease",
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        marginBottom: 2,
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLDivElement).style.background = "#F8FAFC";
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLDivElement).style.background = "transparent";
        }
      }}
    >
      {/* Left: checkbox + unread dot column */}
      <div
        style={{
          width: 14,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 3,
          gap: 6,
        }}
      >
        {/* Checkbox */}
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: 3,
            background: isSelected ? "#2563EB" : "#FFFFFF",
            border: `1.5px solid ${isSelected ? "#2563EB" : "#CBD5E1"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "all 0.12s",
          }}
        >
          {isSelected && (
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>

        {/* Unread blue dot */}
        {unread ? (
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#2563EB",
              flexShrink: 0,
            }}
          />
        ) : (
          <div style={{ width: 6, height: 6 }} />
        )}
      </div>

      {/* Avatar */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: sender.avatarBg || avatarStyle.bg,
          color: sender.avatarColor || avatarStyle.color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 700,
          flexShrink: 0,
          letterSpacing: "0.02em",
        }}
      >
        {sender.initials}
      </div>

      {/* Main content */}
      <div style={{ minWidth: 0, flex: 1 }}>
        {/* Row 1: Name + time */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 6,
            marginBottom: 2,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#0F172A",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            {sender.name}
          </span>
          <span
            style={{
              fontSize: 11.5,
              color: unread ? "#2563EB" : "#94A3B8",
              fontWeight: unread ? 600 : 400,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {latestMessageAt}
          </span>
        </div>

        {/* Row 2: Subject */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 6,
            marginBottom: 2,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 12.5,
              fontWeight: unread ? 600 : 500,
              color: "#1E293B",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            {subject}
          </p>
        </div>

        {/* Row 3: Snippet */}
        <p
          style={{
            margin: "0 0 5px",
            fontSize: 11.5,
            color: "#64748B",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {snippet}
        </p>

        {/* Row 4: Chips & Thread Badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
          {/* Category chip */}
          {categoryChip && (
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                color: categoryChip.color,
                background: categoryChip.bg,
                borderRadius: 5,
                padding: "1px 7px",
              }}
            >
              {categoryChip.label}
            </span>
          )}

          {/* Lead temperature chip */}
          {tempChip && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                fontSize: 10.5,
                fontWeight: 600,
                color: tempChip.color,
                background: tempChip.bg,
                borderRadius: 5,
                padding: "1px 6px",
              }}
            >
              <span style={{ fontSize: 10 }}>{tempChip.icon}</span>
              {tempChip.label}
            </span>
          )}

          {/* Follow-up state (due / needs review / scheduled) */}
          {followupChip && (
            <span
              title={followupChip.title}
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: followupChip.color,
                background: followupChip.bg,
                borderRadius: 5,
                padding: "1px 6px",
              }}
            >
              {followupChip.label}
            </span>
          )}

          {/* Right end thread badge (e.g. 2) */}
          {(threadCount && threadCount > 1) ? (
            <span
              style={{
                marginLeft: "auto",
                background: "#DBEAFE",
                color: "#2563EB",
                fontSize: 11,
                fontWeight: 700,
                padding: "0 6px",
                borderRadius: 99,
                lineHeight: "16px",
              }}
            >
              {threadCount}
            </span>
          ) : isSelected ? (
            <span
              style={{
                marginLeft: "auto",
                background: "#DBEAFE",
                color: "#2563EB",
                fontSize: 11,
                fontWeight: 700,
                padding: "0 6px",
                borderRadius: 99,
                lineHeight: "16px",
              }}
            >
              2
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
