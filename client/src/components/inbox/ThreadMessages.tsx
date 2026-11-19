"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { IconChevronDown, IconChevronUp, IconRefresh } from "@tabler/icons-react";
import type { Mailbox, Message } from "@/types/inbox.types";
import styles from "./thread.module.css";

/** Start loading the next older batch when the reader is this close (px) to the top. */
const LOAD_OLDER_THRESHOLD_PX = 320;
/** Bodies longer than this are clipped until the reader asks for the rest. */
const LONG_BODY_CHARS = 1600;

interface ThreadMessagesProps {
  conversationId: string;
  /** Chronological (oldest first) messages loaded so far. */
  messages: Message[];
  mailbox: Mailbox | null;
  totalCount: number | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  hasOlder: boolean;
  loadingOlder: boolean;
  olderError: boolean;
  onLoadOlder: () => void;
  /** The scrolling element that contains this list (the detail pane body). */
  scrollRef: React.RefObject<HTMLDivElement | null>;
  /** Shown when the thread has no stored message bodies at all. */
  fallbackText?: string;
}

// ── formatting helpers ────────────────────────────────────────────────────────

function dayKey(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(iso) === dayKey(today.toISOString())) return "Today";
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return "Yesterday";
  return d.toLocaleDateString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(d.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
  });
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function fullTimestamp(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString([], { dateStyle: "full", timeStyle: "short" });
}

const ME_AVATAR = { bg: "#DBEAFE", color: "#1D4ED8" };

// ── one message ───────────────────────────────────────────────────────────────

function MessageCard({
  message,
  isLatest,
  mailboxEmail,
  nameFor,
}: {
  message: Message;
  isLatest: boolean;
  mailboxEmail: string | null;
  nameFor: (email: string) => string | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const bodyId = `msg-body-${message.id}`;

  const { sender, fromMe } = message;
  const avatar = fromMe ? ME_AVATAR : { bg: sender.avatarBg, color: sender.avatarColor };
  const body = (message.body || "").trim();
  const isLong = body.length > LONG_BODY_CHARS;
  const shownBody = isLong && !showFull ? `${body.slice(0, LONG_BODY_CHARS).trimEnd()}…` : body;

  const describe = (email: string) => {
    if (mailboxEmail && email.toLowerCase() === mailboxEmail.toLowerCase()) return { label: "me", email };
    return { label: nameFor(email) ?? email, email };
  };
  const to = message.recipients.map(describe);
  const cc = message.cc.map(describe);
  const recipientText = (list: { label: string; email: string }[]) =>
    list.map((r) => (r.label === r.email ? r.email : `${r.label} <${r.email}>`)).join(", ");

  return (
    <article
      className={[
        styles.card,
        fromMe ? styles.cardMine : "",
        isLatest ? styles.cardLatest : "",
        collapsed ? styles.collapsed : "",
      ].join(" ")}
      aria-label={`${fromMe ? "You" : sender.name}, ${fullTimestamp(message.sentAt)}`}
    >
      <button
        type="button"
        className={styles.cardHeader}
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        aria-controls={bodyId}
        title={collapsed ? "Show message" : "Collapse message"}
      >
        <span className={styles.avatar} style={{ background: avatar.bg, color: avatar.color }} aria-hidden>
          {sender.initials}
        </span>

        <span className={styles.who}>
          <span className={styles.nameRow}>
            <span className={styles.name}>{sender.name}</span>
            {fromMe && <span className={styles.youBadge}>You</span>}
            {sender.email && sender.email !== sender.name && (
              <span className={styles.email}>&lt;{sender.email}&gt;</span>
            )}
          </span>
          {collapsed ? (
            <span className={styles.snippet}>{body.replace(/\s+/g, " ") || "(no text)"}</span>
          ) : (
            <>
              {to.length > 0 && (
                <span className={styles.recipients} title={recipientText(to)} style={{ display: "block" }}>
                  to <b>{to.map((r) => r.label).join(", ")}</b>
                  {to.length === 1 && to[0].label !== to[0].email && ` <${to[0].email}>`}
                </span>
              )}
              {cc.length > 0 && (
                <span className={styles.recipients} title={recipientText(cc)} style={{ display: "block" }}>
                  cc <b>{cc.map((r) => r.label).join(", ")}</b>
                </span>
              )}
            </>
          )}
        </span>

        <span className={styles.meta}>
          <time dateTime={message.sentAt} title={fullTimestamp(message.sentAt)}>
            {timeLabel(message.sentAt)}
          </time>
          <IconChevronDown size={14} stroke={2} className={styles.chevron} aria-hidden />
        </span>
      </button>

      {!collapsed && (
        <div id={bodyId} className={styles.body}>
          {shownBody || <span style={{ color: "#94A3B8" }}>(This message has no text.)</span>}
          {isLong && (
            <div>
              <button type="button" className={styles.showMore} onClick={() => setShowFull((v) => !v)}>
                {showFull ? "Show less" : "Show full message"}
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function SkeletonCard({ wide = false }: { wide?: boolean }) {
  return (
    <div className={styles.skeleton} aria-hidden>
      <div className={styles.skelAvatar} />
      <div className={styles.skelLines}>
        <div className={styles.skelLine} style={{ width: "38%" }} />
        <div className={styles.skelLine} style={{ width: wide ? "92%" : "74%" }} />
        <div className={styles.skelLine} style={{ width: wide ? "81%" : "56%" }} />
      </div>
    </div>
  );
}

// ── the thread ────────────────────────────────────────────────────────────────

/**
 * The full conversation, oldest at the top and newest at the bottom (opened scrolled to the
 * newest). Older batches load automatically as the reader nears the top, and the view stays
 * anchored on what the reader was looking at while they are prepended.
 */
export function ThreadMessages({
  conversationId,
  messages,
  mailbox,
  totalCount,
  loading,
  error,
  onRetry,
  hasOlder,
  loadingOlder,
  olderError,
  onLoadOlder,
  scrollRef,
  fallbackText,
}: ThreadMessagesProps) {
  // Address -> display name, learned from every loaded sender (and the mailbox itself).
  const nameFor = useMemo(() => {
    const names = new Map<string, string>();
    if (mailbox?.email && mailbox.name) names.set(mailbox.email.toLowerCase(), mailbox.name);
    for (const m of messages) {
      if (m.sender.email && m.sender.name && m.sender.name !== m.sender.email) {
        names.set(m.sender.email.toLowerCase(), m.sender.name);
      }
    }
    return (email: string) => names.get(email.toLowerCase()) ?? null;
  }, [messages, mailbox]);

  // ── scroll management ──
  const snapshot = useRef<{ height: number; top: number }>({ height: 0, top: 0 });
  const edges = useRef<{ first: string | null; last: string | null }>({ first: null, last: null });
  // The thread whose initial "scroll to the newest message" has been done.
  const openedFor = useRef<string | null>(null);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !messages.length) return;
    const first = messages[0].id;
    const last = messages[messages.length - 1].id;
    const prev = edges.current;

    if (openedFor.current !== conversationId) {
      // Thread just opened (or switched to): show the newest message.
      el.scrollTop = el.scrollHeight;
      openedFor.current = conversationId;
    } else if (prev.first && first !== prev.first && last === prev.last) {
      // Older batch prepended: keep the same content under the reader's eyes.
      el.scrollTop = snapshot.current.top + (el.scrollHeight - snapshot.current.height);
    } else if (prev.last && last !== prev.last) {
      // A new message arrived / was sent: follow it if the reader was at the bottom.
      const wasAtBottom = snapshot.current.height - snapshot.current.top - el.clientHeight < 120;
      if (wasAtBottom) el.scrollTop = el.scrollHeight;
    }
    edges.current = { first, last };
  }, [messages, conversationId, scrollRef]);

  // Remember the geometry after every commit so the next prepend can be compensated exactly.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) snapshot.current = { height: el.scrollHeight, top: el.scrollTop };
  });

  const maybeLoadOlder = useCallback(() => {
    const el = scrollRef.current;
    if (!el || openedFor.current !== conversationId || !hasOlder || loadingOlder || olderError) return;
    if (el.scrollTop < LOAD_OLDER_THRESHOLD_PX) onLoadOlder();
  }, [scrollRef, conversationId, hasOlder, loadingOlder, olderError, onLoadOlder]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      snapshot.current = { height: el.scrollHeight, top: el.scrollTop };
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        maybeLoadOlder();
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [scrollRef, maybeLoadOlder]);

  // After each batch (or once opened), keep filling while the history doesn't reach the threshold,
  // e.g. short messages that don't fill the pane yet.
  useEffect(() => {
    maybeLoadOlder();
  }, [messages.length, maybeLoadOlder]);

  // ── render ──
  if (loading && !messages.length) {
    return (
      <div className={styles.thread} aria-busy="true" aria-label="Loading conversation">
        <SkeletonCard />
        <SkeletonCard wide />
      </div>
    );
  }

  if (error && !messages.length) {
    return (
      <div className={styles.stateBox} role="alert">
        Couldn&apos;t load this conversation.
        <button type="button" className={styles.loadOlderBtn} onClick={() => onRetry()}>
          <IconRefresh size={14} stroke={2} /> Try again
        </button>
      </div>
    );
  }

  if (!messages.length) {
    return <div className={styles.stateBox}>{fallbackText || "No messages in this conversation yet."}</div>;
  }

  const remaining = totalCount != null ? Math.max(totalCount - messages.length, 0) : null;

  return (
    <section className={styles.thread} aria-label="Conversation history">
      <div className={styles.historyEdge}>
        {loadingOlder ? (
          <span className={styles.edgeNote} role="status">
            <span className={styles.spinner} aria-hidden /> Loading earlier messages…
          </span>
        ) : olderError ? (
          <span className={styles.edgeError} role="alert">
            Couldn&apos;t load earlier messages.
            <button type="button" className={styles.loadOlderBtn} onClick={() => onLoadOlder()}>
              <IconRefresh size={14} stroke={2} /> Retry
            </button>
          </span>
        ) : hasOlder ? (
          <button type="button" className={styles.loadOlderBtn} onClick={() => onLoadOlder()}>
            <IconChevronUp size={14} stroke={2.2} />
            {remaining ? `Show ${remaining} earlier message${remaining === 1 ? "" : "s"}` : "Show earlier messages"}
          </button>
        ) : (
          <span className={styles.edgeNote}>Start of conversation</span>
        )}
      </div>

      {messages.map((m, i) => {
        const showDay = i === 0 || dayKey(m.sentAt) !== dayKey(messages[i - 1].sentAt);
        return (
          <React.Fragment key={m.id}>
            {showDay && (
              <div className={styles.dayDivider} role="separator">
                {dayLabel(m.sentAt)}
              </div>
            )}
            <MessageCard
              message={m}
              isLatest={i === messages.length - 1}
              mailboxEmail={mailbox?.email ?? null}
              nameFor={nameFor}
            />
          </React.Fragment>
        );
      })}
    </section>
  );
}
