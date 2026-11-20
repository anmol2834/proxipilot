"use client";

import React, { useEffect, useRef, useState } from "react";
import { Conversation } from "@/types/inbox.types";
import { ConversationListItem } from "./ConversationListItem";
import {
  IconEdit,
  IconSearch,
  IconAdjustmentsHorizontal,
} from "@tabler/icons-react";

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
}

type TabId = "all" | "unread" | "followup" | "priority";

interface Tab {
  id: TabId;
  label: string;
  count?: number;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
}: ConversationListProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const unreadCount = conversations.filter((c) => c.unread).length;
  const followupCount = conversations.filter((c) => c.hasFollowup).length;
  const priorityCount = conversations.filter(
    (c) => c.leadTemperature === "hot"
  ).length;

  const tabs: Tab[] = [
    { id: "all", label: "All", count: conversations.length },
    { id: "unread", label: "Unread", count: unreadCount },
    { id: "followup", label: "Follow-up", count: followupCount },
    { id: "priority", label: "Priority", count: priorityCount },
  ];

  const filtered = conversations.filter((c) => {
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "unread" && c.unread) ||
      (activeTab === "followup" && c.hasFollowup) ||
      (activeTab === "priority" && c.leadTemperature === "hot");
    const matchesSearch =
      !searchQuery ||
      c.sender.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.snippet.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  // Infinite scroll observer: strictly scoped to scroll container
  useEffect(() => {
    if (!sentinelRef.current || !scrollContainerRef.current || !hasNextPage || isFetchingNextPage) return;
    const container = scrollContainerRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { root: container, rootMargin: "40px", threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        background: "#FFFFFF",
        overflow: "hidden",
      }}
    >
      {/* ── Header: Inbox title + unread badge + compose ── */}
      <div
        style={{
          padding: "16px 16px 0 16px",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "#0F172A",
                letterSpacing: "-0.02em",
              }}
            >
              Inbox
            </span>
            {unreadCount > 0 && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  background: "#EFF6FF",
                  color: "#2563EB",
                  fontSize: 11.5,
                  fontWeight: 600,
                  padding: "2px 7px",
                  borderRadius: 99,
                  border: "1px solid #DBEAFE",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#2563EB",
                    display: "inline-block",
                  }}
                />
                {unreadCount} unread
              </span>
            )}
          </div>

          {/* Compose button */}
          <button
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "#2563EB",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              flexShrink: 0,
              boxShadow: "0 1px 4px rgba(37,99,235,0.25)",
              transition: "background 0.15s",
            }}
            title="Compose"
          >
            <IconEdit size={16} stroke={2} />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginBottom: 10,
          }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 9px",
                  borderRadius: 7,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 500,
                  background: isActive ? "#2563EB" : "#F1F5F9",
                  color: isActive ? "#FFFFFF" : "#64748B",
                  transition: "all 0.15s",
                }}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    style={{
                      background: isActive ? "rgba(255,255,255,0.25)" : "#E2E8F0",
                      color: isActive ? "#fff" : "#475569",
                      borderRadius: 5,
                      fontSize: 10.5,
                      fontWeight: 600,
                      padding: "0px 5px",
                      lineHeight: "16px",
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Search bar ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#F8FAFC",
            border: "1px solid #E8ECF0",
            borderRadius: 8,
            padding: "7px 10px",
            marginBottom: 8,
          }}
        >
          <IconSearch size={15} stroke={2} color="#94A3B8" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            style={{
              border: "none",
              background: "transparent",
              outline: "none",
              fontSize: 13,
              color: "#0F172A",
              flex: 1,
              fontFamily: "inherit",
            }}
          />
          {/* Filter icon */}
          <button
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#94A3B8",
              padding: 0,
              display: "flex",
              alignItems: "center",
            }}
            title="Filter"
          >
            <IconAdjustmentsHorizontal size={15} stroke={2} />
          </button>
        </div>
      </div>

      {/* ── Scrollable list ── */}
      <div
        ref={scrollContainerRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "4px 6px 8px 6px",
          minHeight: 0,
        }}
      >
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{
                padding: "12px 10px",
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  background: "#F1F5F9",
                  flexShrink: 0,
                  animation: "pulse 1.5s infinite",
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ height: 12, background: "#F1F5F9", borderRadius: 4, width: "55%", marginBottom: 6 }} />
                <div style={{ height: 11, background: "#F1F5F9", borderRadius: 4, width: "85%", marginBottom: 5 }} />
                <div style={{ height: 10, background: "#F1F5F9", borderRadius: 4, width: "40%" }} />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "48px 16px",
              color: "#94A3B8",
            }}
          >
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ display: "block", margin: "0 auto 10px", opacity: 0.5 }}
            >
              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
              <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
            </svg>
            <p style={{ fontSize: 13.5, fontWeight: 600, color: "#475569", margin: "0 0 4px" }}>
              {activeTab === "followup" ? "No conversations requiring follow-up" : "No conversations"}
            </p>
            <p style={{ fontSize: 12.5, margin: 0 }}>
              {activeTab === "followup"
                ? "Conversations with active commitments or pending follow-ups will appear here."
                : "Incoming customer emails will appear here."}
            </p>
          </div>
        ) : (
          filtered.map((conversation) => (
            <ConversationListItem
              key={conversation.id}
              conversation={conversation}
              isSelected={selectedId === conversation.id}
              onSelect={() => onSelect(conversation.id)}
            />
          ))
        )}

        {/* Sentinel — only rendered when additional pages exist */}
        {hasNextPage && <div ref={sentinelRef} style={{ height: 10, marginTop: 4 }} />}

        {isFetchingNextPage && (
          <div style={{ textAlign: "center", padding: "12px 0", fontSize: 12, color: "#94A3B8" }}>
            Loading more…
          </div>
        )}
      </div>
    </div>
  );
}
