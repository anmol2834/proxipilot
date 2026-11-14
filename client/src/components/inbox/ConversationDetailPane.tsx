"use client";

import React, { useRef, useEffect, useState } from "react";
import { Conversation, Message, LeadTemperature } from "@/types/inbox.types";
import { useDiscardDraft, useSendDraft, useSendManualReply, useThreadDraft } from "@/hooks/useMemory";
import { useTenant } from "@/hooks/use-tenant";
import { can } from "@/lib/permissions";
import { UserRole } from "@/types/user.types";
import {
  IconArrowLeft,
  IconTrash,
  IconFlame,
  IconSun,
  IconSnowflake,
  IconDots,
  IconStar,
  IconStarFilled,
  IconCornerUpLeft,
  IconSparkles,
  IconTemplate,
  IconSend,
  IconChevronDown,
  IconChevronRight,
  IconMoodSmile,
  IconLink,
  IconPlus,
  IconCheck,
  IconX,
  IconArchive,
} from "@tabler/icons-react";

interface ConversationDetailPaneProps {
  conversation: Conversation | null;
  messages: Message[];
  onToggleStar: (starred: boolean) => void;
  onSetLeadTemperature: (temp: LeadTemperature) => void;
  onDeleteClick: () => void;
  onBackToList?: () => void;
}

function ToolbarBtn({
  onClick,
  children,
  title,
  danger = false,
}: {
  onClick?: () => void;
  children: React.ReactNode;
  title?: string;
  danger?: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        minWidth: 32,
        minHeight: 32,
        borderRadius: 7,
        border: `1px solid ${hov ? "#E2E8F0" : "transparent"}`,
        background: hov ? "#F8FAFC" : "transparent",
        color: danger ? (hov ? "#EF4444" : "#64748B") : "#475569",
        cursor: "pointer",
        padding: 0,
        fontFamily: "inherit",
        transition: "all 0.12s",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function EmptyDetailPane() {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#FFFFFF",
        padding: 32,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: "#F8FAFC",
          border: "1px solid #E2E8F0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#94A3B8",
          marginBottom: 14,
        }}
      >
        <IconArchive size={26} stroke={1.5} />
      </div>
      <p style={{ fontSize: 15, fontWeight: 600, color: "#0F172A", margin: "0 0 6px" }}>
        Select a conversation
      </p>
      <p style={{ fontSize: 13, color: "#94A3B8", maxWidth: 280, margin: 0 }}>
        Choose an email from your inbox to view the full thread and AI insights.
      </p>
    </div>
  );
}

function getSubjectTopic(subject: string, senderName: string): string {
  const s = `${subject} ${senderName}`.toLowerCase();
  if (s.includes("order") || s.includes("derma") || s.includes("zomato") || s.includes("delivery") || s.includes("myntra") || s.includes("bff")) {
    return "Updates";
  }
  if (s.includes("quora") || s.includes("college") || s.includes("medical") || s.includes("education")) {
    return "Education";
  }
  if (s.includes("job") || s.includes("career") || s.includes("indeed") || s.includes("trainer")) {
    return "Careers";
  }
  return "Updates";
}

function getAvatarStyle(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("shiprocket")) return { bg: "#F3E8FF", color: "#9333EA" };
  if (lower.includes("derma")) return { bg: "#D1FAE5", color: "#059669" };
  if (lower.includes("indeed")) return { bg: "#EDE9FE", color: "#4F46E5" };
  if (lower.includes("quora")) return { bg: "#CCFBF1", color: "#0D9488" };
  if (lower.includes("zomato")) return { bg: "#EF4444", color: "#FFFFFF" };
  if (lower.includes("myntra")) return { bg: "#EFF6FF", color: "#0284C7" };
  if (lower.includes("grok")) return { bg: "#ECFDF5", color: "#059669" };
  return { bg: "#EFF6FF", color: "#2563EB" };
}

export function ConversationDetailPane({
  conversation,
  messages,
  onToggleStar,
  onSetLeadTemperature,
  onDeleteClick,
  onBackToList,
}: ConversationDetailPaneProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isReplyOpen, setIsReplyOpen] = useState(false);
  const threadId = conversation?.id ?? "";

  // AI draft for this conversation: when one exists it is pre-filled in the reply box (already
  // open), so the user only reviews and clicks Send. Without a draft only the Reply button shows.
  const draftQ = useThreadDraft(conversation?.id ?? null);
  const draft = draftQ.data?.draft ?? null;
  const aiDrafting = Boolean(draftQ.data?.generating);
  const sendDraft = useSendDraft(threadId);
  const sendManual = useSendManualReply(threadId);
  const discardDraft = useDiscardDraft(threadId);
  const { role } = useTenant();
  const canSend = can({ role: (role ?? undefined) as UserRole | undefined }, "email.reply");
  const sending = sendDraft.isPending || sendManual.isPending;
  // One token per composed reply: retries / double clicks of the same reply are sent once.
  const replyTokenRef = useRef<string>("");
  const newReplyToken = () => {
    replyTokenRef.current =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID().replace(/-/g, "")
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  };
  // Which draft is loaded into the box (so a refetch never overwrites the user's edits).
  const [loadedDraftId, setLoadedDraftId] = useState<string | null>(null);
  const draftLoaded = Boolean(draft && loadedDraftId === draft.id);

  // Scroll to top and reset reply field when conversation changes
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setIsReplyOpen(false);
    setReplyText("");
    setLoadedDraftId(null);
    newReplyToken();
  }, [conversation?.id]);

  // A (new) AI draft arrived: open the reply box pre-filled with it, unless the user typed their own reply.
  useEffect(() => {
    if (!draft || loadedDraftId === draft.id) return;
    if (replyText.trim() && loadedDraftId === null && isReplyOpen) return; // never clobber the user's own text
    setReplyText(draft.body ?? "");
    setLoadedDraftId(draft.id);
    setIsReplyOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.id]);

  const resetComposer = () => {
    setReplyText("");
    setIsReplyOpen(false);
    setLoadedDraftId(null);
    newReplyToken();
  };

  const handleSend = () => {
    const text = replyText.trim();
    if (!text || sending || !conversation) return;
    if (draft && draftLoaded) {
      const edited = text !== (draft.body ?? "").trim();
      sendDraft.mutate({ id: draft.id, bodyText: edited ? text : undefined }, { onSuccess: resetComposer });
    } else {
      if (!replyTokenRef.current) newReplyToken();
      sendManual.mutate({ bodyText: text, clientToken: replyTokenRef.current }, { onSuccess: resetComposer });
    }
  };

  const handleCloseComposer = () => {
    if (draft && draftLoaded) {
      discardDraft.mutate(draft.id, { onSuccess: resetComposer });
    } else {
      setIsReplyOpen(false);
    }
  };

  if (!conversation) return <EmptyDetailPane />;

  const { sender, subject, leadTemperature, starred, aiSummary } = conversation;
  const primaryMessage = messages[messages.length - 1];
  const avatarStyle = getAvatarStyle(sender.name);

  const isHot = leadTemperature === "hot";
  const isWarm = leadTemperature === "warm";
  const isCold = leadTemperature === "cold";

  // Only real AI output is shown; never an invented description of the email.
  const aiSummaryText =
    (aiSummary?.intent && aiSummary.intent !== "Pending AI analysis" ? aiSummary.intent : "") ||
    (aiSummary?.bulletPoints && aiSummary.bulletPoints.length > 0
      ? aiSummary.bulletPoints.join(" ")
      : "The AI summary appears here once ProxiPilot has processed this conversation.");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxHeight: "100%",
        minHeight: 0,
        background: "#FFFFFF",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <style>{`
        @keyframes replySlideUp {
          0% {
            opacity: 0;
            transform: translateY(22px) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>

      {/* ══ TOP TOOLBAR ════════════════════════════════════════════════════ */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 18px",
          borderBottom: "1px solid #F1F5F9",
          gap: 8,
          background: "#FFFFFF",
        }}
      >
        {/* Left: Mobile back (if needed) + Delete + Mark as dropdown */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {onBackToList && (
            <ToolbarBtn onClick={onBackToList} title="Back to list">
              <IconArrowLeft size={16} stroke={2} />
            </ToolbarBtn>
          )}

          <ToolbarBtn onClick={onDeleteClick} title="Delete conversation" danger>
            <IconTrash size={16} stroke={1.8} />
          </ToolbarBtn>

          <div style={{ width: 1, height: 18, background: "#E8ECF0", margin: "0 2px" }} />

          {/* Mark as button */}
          <button
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "5px 11px",
              borderRadius: 7,
              border: "1px solid #E2E8F0",
              background: "#FFFFFF",
              color: "#475569",
              fontSize: 12.5,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Mark as
            <IconChevronDown size={13} stroke={2} />
          </button>
        </div>

        {/* Right: Hot / Warm / Cold pills + More */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={() => onSetLeadTemperature(isHot ? null : "hot")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              borderRadius: 99,
              border: `1px solid ${isHot ? "#FCA5A5" : "#E2E8F0"}`,
              background: isHot ? "#FEF2F2" : "#FFFFFF",
              color: isHot ? "#DC2626" : "#64748B",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.12s",
            }}
          >
            <IconFlame size={13} stroke={2} color={isHot ? "#DC2626" : "#EF4444"} />
            Hot
          </button>

          <button
            onClick={() => onSetLeadTemperature(isWarm ? null : "warm")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              borderRadius: 99,
              border: `1px solid ${isWarm ? "#FDE68A" : "#E2E8F0"}`,
              background: isWarm ? "#FFFBEB" : "#FFFFFF",
              color: isWarm ? "#D97706" : "#64748B",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.12s",
            }}
          >
            <IconSun size={13} stroke={2} color={isWarm ? "#D97706" : "#F59E0B"} />
            Warm
          </button>

          <button
            onClick={() => onSetLeadTemperature(isCold ? null : "cold")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              borderRadius: 99,
              border: `1px solid ${isCold ? "#BAE6FD" : "#E2E8F0"}`,
              background: isCold ? "#F0F9FF" : "#FFFFFF",
              color: isCold ? "#0284C7" : "#64748B",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.12s",
            }}
          >
            <IconSnowflake size={13} stroke={2} color={isCold ? "#0284C7" : "#0284C7"} />
            Cold
          </button>

          <ToolbarBtn title="More options">
            <IconDots size={16} stroke={1.8} />
          </ToolbarBtn>
        </div>
      </div>

      {/* ══ SCROLLABLE CONTENT BODY ════════════════════════════════════════ */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "24px 28px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Subject Header */}
        <h2
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 700,
            color: "#0F172A",
            letterSpacing: "-0.02em",
            lineHeight: 1.3,
          }}
        >
          {subject}
        </h2>

        {/* Label pills row */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: -6 }}>
          {/* Inbox label */}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              fontWeight: 600,
              color: "#2563EB",
              background: "#EFF6FF",
              border: "1px solid #BFDBFE",
              borderRadius: 6,
              padding: "2px 8px",
            }}
          >
            <IconCheck size={11} stroke={3.5} color="#2563EB" />
            Inbox
          </span>

          {/* Company pill */}
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "#334155",
              background: "#F1F5F9",
              border: "1px solid #E2E8F0",
              borderRadius: 6,
              padding: "2px 9px",
            }}
          >
            {sender.name.split(" ")[0]}
          </span>

          {/* Topic pill */}
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "#0369A1",
              background: "#E0F2FE",
              border: "1px solid #BAE6FD",
              borderRadius: 6,
              padding: "2px 9px",
            }}
          >
            {getSubjectTopic(subject, sender.name)}
          </span>

          {/* Plus button */}
          <button
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              border: "1px solid #E2E8F0",
              background: "#FFFFFF",
              color: "#94A3B8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              padding: 0,
            }}
            title="Add label"
          >
            <IconPlus size={13} stroke={2.5} />
          </button>
        </div>

        {/* Sender row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 4,
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            {/* Avatar */}
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: sender.avatarBg || avatarStyle.bg,
                color: sender.avatarColor || avatarStyle.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {sender.initials}
            </div>

            {/* Name + email + to me */}
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "nowrap" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", whiteSpace: "nowrap" }}>
                  {sender.name}
                </span>
                <span
                  style={{
                    fontSize: 12.5,
                    color: "#64748B",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  &lt;{sender.email}&gt;
                </span>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "#64748B",
                  marginTop: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  cursor: "pointer",
                }}
              >
                <span>to Anmol Sinha</span>
                <IconChevronDown size={11} stroke={2} />
              </div>
            </div>
          </div>

          {/* Timestamp + actions on right */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: "#64748B", whiteSpace: "nowrap" }}>
              {primaryMessage?.timestampFormatted || conversation.latestMessageAt || ""}
            </span>

            {/* Star */}
            <button
              onClick={() => onToggleStar(!starred)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 2,
                color: starred ? "#F59E0B" : "#94A3B8",
                display: "flex",
                alignItems: "center",
              }}
              title={starred ? "Unstar" : "Star"}
            >
              {starred ? <IconStarFilled size={16} color="#F59E0B" /> : <IconStar size={16} stroke={1.8} />}
            </button>

            {/* Quick reply shortcut */}
            <button
              onClick={() => setIsReplyOpen(true)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 2,
                color: "#94A3B8",
                display: "flex",
                alignItems: "center",
              }}
              title="Reply"
            >
              <IconCornerUpLeft size={16} stroke={1.8} />
            </button>

            {/* More */}
            <button
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 2,
                color: "#94A3B8",
                display: "flex",
                alignItems: "center",
              }}
              title="More"
            >
              <IconDots size={16} stroke={1.8} />
            </button>
          </div>
        </div>

        {/* Message body */}
        <div
          style={{
            fontSize: 14.5,
            color: "#334155",
            lineHeight: 1.75,
            whiteSpace: "pre-line",
            fontFamily: "inherit",
            paddingTop: 4,
          }}
        >
          {primaryMessage?.body || conversation.snippet}
        </div>

        {/* Expand button */}
        <button
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#94A3B8",
            fontSize: 18,
            fontWeight: 700,
            padding: "0 4px",
            letterSpacing: 2,
            alignSelf: "flex-start",
            lineHeight: 1,
          }}
          title="Show more"
        >
          ···
        </button>

        {/* ── AI Summary Card (Always rendered) ── */}
        <div
          style={{
            borderRadius: 12,
            background: "#FAFBFF",
            border: "1px solid #E8ECF0",
            padding: "14px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginTop: 4,
          }}
        >
          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <IconSparkles size={16} color="#7C3AED" />
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>
                AI Summary
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#7C3AED",
                  background: "#F5F3FF",
                  border: "1px solid #EDE9FE",
                  borderRadius: 4,
                  padding: "1px 5px",
                  letterSpacing: "0.04em",
                }}
              >
                BETA
              </span>
            </div>
            <button
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 10px",
                borderRadius: 7,
                border: "1px solid #E2E8F0",
                background: "#FFFFFF",
                color: "#475569",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              View Key Points
              <IconChevronRight size={13} stroke={2} />
            </button>
          </div>

          {/* Summary text */}
          <p style={{ fontSize: 13, color: "#475569", margin: 0, lineHeight: 1.6 }}>
            {aiSummaryText}
          </p>
        </div>
      </div>

      {/* ── Bottom Right Floating Reply Button (when reply is initially closed) ── */}
      {!isReplyOpen && (
        <button
          onClick={() => {
            if (draft && !draftLoaded) {
              setReplyText(draft.body ?? "");
              setLoadedDraftId(draft.id);
            }
            setIsReplyOpen(true);
          }}
          style={{
            position: "absolute",
            bottom: 24,
            right: 28,
            zIndex: 20,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 22px",
            borderRadius: 99,
            background: "#2563EB",
            color: "#FFFFFF",
            border: "none",
            boxShadow: "0 6px 20px rgba(37,99,235,0.35)",
            fontSize: 13.5,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px) scale(1.02)";
            e.currentTarget.style.boxShadow = "0 8px 24px rgba(37,99,235,0.45)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0) scale(1)";
            e.currentTarget.style.boxShadow = "0 6px 20px rgba(37,99,235,0.35)";
          }}
        >
          <IconCornerUpLeft size={16} stroke={2.5} />
          {draft ? "Open AI draft" : aiDrafting ? "Reply · AI drafting…" : "Reply"}
        </button>
      )}

      {/* ── Animated Reply Input Area Component (When opened) ── */}
      {isReplyOpen && (
        <div
          style={{
            flexShrink: 0,
            padding: "8px 24px 18px",
            background: "#FFFFFF",
            borderTop: "1px solid #F1F5F9",
            animation: "replySlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            zIndex: 15,
          }}
        >
          <div
            style={{
              borderRadius: 12,
              border: "1px solid #BFDBFE",
              background: "#FFFFFF",
              boxShadow: "0 8px 24px rgba(37,99,235,0.08), 0 2px 6px rgba(0,0,0,0.04)",
              overflow: "hidden",
            }}
          >
            {/* Header of reply composer */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 14px",
                borderBottom: "1px solid #F1F5F9",
                background: "#F8FAFC",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "#2563EB",
                    background: "#EFF6FF",
                    border: "1px solid #DBEAFE",
                    borderRadius: 6,
                    padding: "3px 9px",
                  }}
                >
                  <IconCornerUpLeft size={13} stroke={2.5} />
                  Replying to {sender.name}
                </span>
                {draftLoaded && (
                  <span
                    title={draft?.review_reason ? `Held for review: ${draft.review_reason}` : "Written by AI from your knowledge base. Review, edit if needed, then Send."}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: "#7C3AED",
                      background: "#F5F3FF",
                      border: "1px solid #EDE9FE",
                      borderRadius: 6,
                      padding: "3px 8px",
                    }}
                  >
                    <IconSparkles size={12} color="#7C3AED" />
                    AI draft
                  </span>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {/* Templates button */}
                <button
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: "1px solid #E2E8F0",
                    background: "#FFFFFF",
                    color: "#475569",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <IconTemplate size={13} stroke={1.8} />
                  Templates
                  <IconChevronDown size={11} stroke={2} />
                </button>

                {/* Close / Collapse button */}
                <button
                  onClick={handleCloseComposer}
                  title={draftLoaded ? "Discard AI draft" : "Close reply"}
                  disabled={sending || discardDraft.isPending}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    border: "1px solid #E2E8F0",
                    background: "#FFFFFF",
                    color: "#64748B",
                    cursor: "pointer",
                    padding: 0,
                    transition: "all 0.12s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#FEE2E2";
                    e.currentTarget.style.color = "#DC2626";
                    e.currentTarget.style.borderColor = "#FCA5A5";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#FFFFFF";
                    e.currentTarget.style.color = "#64748B";
                    e.currentTarget.style.borderColor = "#E2E8F0";
                  }}
                >
                  <IconX size={14} stroke={2} />
                </button>
              </div>
            </div>

            {/* Editable reply text area */}
            <div style={{ padding: "12px 16px 8px" }}>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Write a reply to ${sender.name}...`}
                aria-label="Reply"
                maxLength={20000}
                disabled={!canSend || sending}
                rows={draftLoaded ? 9 : 3}
                style={{
                  width: "100%",
                  minHeight: 56,
                  maxHeight: 320,
                  resize: "vertical",
                  border: "none",
                  overflowY: "auto",
                  fontSize: 13.5,
                  color: "#1E293B",
                  outline: "none",
                  lineHeight: 1.6,
                  fontFamily: "inherit",
                  background: "transparent",
                }}
              />
            </div>

            {/* Bottom toolbar: ONLY Link and Emoji on left, Improve with AI + Send on right */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 14px 10px",
                borderTop: "1px solid #F8FAFC",
                background: "#FFFFFF",
              }}
            >
              {/* Left tools: ONLY Link and Emoji */}
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  title="Insert Link"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#64748B",
                    padding: "6px",
                    borderRadius: 5,
                    display: "flex",
                    alignItems: "center",
                    transition: "color 0.12s, background 0.12s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#F1F5F9")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  <IconLink size={16} stroke={2} />
                </button>
                <button
                  title="Insert Emoji"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#64748B",
                    padding: "6px",
                    borderRadius: 5,
                    display: "flex",
                    alignItems: "center",
                    transition: "color 0.12s, background 0.12s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#F1F5F9")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  <IconMoodSmile size={16} stroke={2} />
                </button>
              </div>

              {/* Right: AI Improve + Send button */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: "1px solid #EDE9FE",
                    background: "#F5F3FF",
                    color: "#7C3AED",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "all 0.12s",
                  }}
                >
                  <IconSparkles size={14} color="#7C3AED" />
                  Improve with AI
                </button>

                {/* Send split button */}
                <div style={{ display: "flex", alignItems: "stretch" }}>
                  <button
                    onClick={handleSend}
                    disabled={!canSend || sending || !replyText.trim()}
                    title={canSend ? "Send in this conversation" : "You have read-only access"}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 16px",
                      borderRadius: "8px 0 0 8px",
                      border: "1px solid #2563EB",
                      borderRight: "none",
                      background: "#2563EB",
                      color: "#FFFFFF",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      boxShadow: "0 1px 4px rgba(37,99,235,0.3)",
                    }}
                  >
                    <IconSend size={14} />
                    {sending ? "Sending…" : "Send"}
                  </button>
                  <button
                    style={{
                      padding: "6px 9px",
                      borderRadius: "0 8px 8px 0",
                      border: "1px solid #2563EB",
                      borderLeft: "1px solid rgba(255,255,255,0.25)",
                      background: "#2563EB",
                      color: "#FFFFFF",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <IconChevronDown size={12} stroke={2} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
