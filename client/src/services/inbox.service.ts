/**
 * Inbox Service — ProxiPilot Clean Inbox Read Model
 *
 * Connects to the real backend /api/v1/inbox/threads API.
 * Replaces the previous mock data implementation.
 *
 * API contract:
 *   GET  /api/v1/inbox/threads                          → PaginatedThreadsResponse
 *   GET  /api/v1/inbox/threads/{id}                     → ThreadDTO
 *   GET  /api/v1/inbox/threads/{id}/messages            → PaginatedMessagesResponse
 *   PATCH /api/v1/inbox/threads/{id}/read               → { id, is_read }
 *   PATCH /api/v1/inbox/threads/{id}/lead-temperature   → { id, lead_temperature }
 *   DELETE /api/v1/inbox/threads/{id}                   → { id, status }
 */

import { apiClient } from "@/lib/api/client";
import {
  Conversation,
  Message,
  LeadTemperature,
  PaginatedConversationsResponse,
  PaginatedMessagesResponse,
  ConversationSender,
} from "@/types/inbox.types";

// =============================================================================
// Backend DTO types (as returned by FastAPI)
// =============================================================================

interface BackendSender {
  name: string | null;
  email: string;
}

interface BackendAISummary {
  intent: string | null;
  bullet_points: string[];
  confidence: number | null;
}

interface BackendThread {
  id: string;
  subject: string | null;
  sender: BackendSender;
  snippet: string | null;
  latest_message_at: string | null;
  message_count: number;
  unread_count: number;
  is_unread: boolean;
  has_followup?: boolean;
  followup_status?: string | null;
  followup_due_at?: string | null;
  followup_time_suggested?: boolean;
  lead_temperature: string | null;
  status: string;
  ai_summary: BackendAISummary | null;
  integration_account_id: string;
  created_at: string;
  updated_at: string;
}

interface BackendMessage {
  id: string;
  sender: BackendSender;
  to_emails: string[];
  cc_emails: string[];
  sent_at: string | null;
  body_text: string | null;
  direction: string;
  from_me?: boolean;
  integration_account_id: string;
  created_at: string;
}

interface BackendPaginatedThreads {
  items: BackendThread[];
  next_cursor: string | null;
  has_more: boolean;
  total_returned: number;
}

interface BackendPaginatedMessages {
  items: BackendMessage[];
  previous_cursor: string | null;
  has_more: boolean;
  total_returned: number;
  total_count?: number | null;
  mailbox?: BackendSender | null;
}

// =============================================================================
// Avatar / initials helpers
// =============================================================================

const AVATAR_PALETTES: Array<{ bg: string; color: string }> = [
  { bg: "#EDE9FE", color: "#6D28D9" }, // purple
  { bg: "#CCFBF1", color: "#0F766E" }, // teal
  { bg: "#F3E8FF", color: "#7E22CE" }, // violet
  { bg: "#D1FAE5", color: "#065F46" }, // green
  { bg: "#FEF9C3", color: "#92400E" }, // amber
  { bg: "#FEE2E2", color: "#B91C1C" }, // red
  { bg: "#E0F2FE", color: "#0369A1" }, // sky
  { bg: "#F5F3FF", color: "#4C1D95" }, // deep purple
];

function _getAvatarForEmail(email: string): { bg: string; color: string } {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (hash * 31 + email.charCodeAt(i)) & 0xffffffff;
  }
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
}

function _getInitials(name: string | null, email: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.trim().slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function _buildSender(backendSender: BackendSender): ConversationSender {
  const palette = _getAvatarForEmail(backendSender.email);
  return {
    name: backendSender.name || backendSender.email,
    email: backendSender.email,
    initials: _getInitials(backendSender.name, backendSender.email),
    avatarBg: palette.bg,
    avatarColor: palette.color,
  };
}

// =============================================================================
// Timestamp formatting
// =============================================================================

function _formatTimestamp(isoStr: string | null): string {
  if (!isoStr) return "";
  try {
    const dt = new Date(isoStr);
    const now = new Date();
    const diffMs = now.getTime() - dt.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return dt.toLocaleDateString([], { weekday: "short" });
    } else {
      return dt.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  } catch {
    return "";
  }
}

// =============================================================================
// Type adapters: Backend DTO → Frontend types
// =============================================================================

function _threadToConversation(t: BackendThread): Conversation {
  const sender = _buildSender(t.sender);
  return {
    id: t.id,
    organizationId: "", // resolved from JWT in context
    integrationAccountId: t.integration_account_id,
    provider: "gmail",
    threadId: t.id, // using our internal id as threadId for UI
    sender,
    subject: t.subject || "(No Subject)",
    snippet: t.snippet || "",
    latestMessageAt: t.latest_message_at
      ? _formatTimestamp(t.latest_message_at)
      : "",
    leadTemperature: (t.lead_temperature as LeadTemperature) ?? null,
    hasFollowup: Boolean(t.has_followup),
    followupStatus: t.followup_status ?? null,
    followupDueAt: t.followup_due_at ?? null,
    followupTimeSuggested: Boolean(t.followup_time_suggested),
    unread: t.is_unread,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    aiSummary: t.ai_summary
      ? {
          intent: t.ai_summary.intent || "",
          bulletPoints: t.ai_summary.bullet_points || [],
          confidence: t.ai_summary.confidence ?? undefined,
        }
      : {
          intent: "Pending AI analysis",
          bulletPoints: [],
        },
  };
}

function _messageToMessage(m: BackendMessage, conversationId: string): Message {
  const sender = _buildSender(m.sender);
  return {
    id: m.id,
    conversationId,
    providerMessageId: m.id,
    sender,
    recipients: m.to_emails || [],
    cc: m.cc_emails || [],
    subject: "", // Subject is on thread, not message
    body: m.body_text || "",
    sentAt: m.sent_at || m.created_at,
    timestampFormatted: _formatTimestamp(m.sent_at || m.created_at),
    direction: m.direction as "inbound" | "outbound",
    fromMe: m.from_me ?? m.direction === "outbound",
    createdAt: m.created_at,
  };
}

// =============================================================================
// Inbox Service
// =============================================================================

class InboxService {
  /**
   * Get paginated list of email threads.
   * Newest-first, keyset cursor pagination.
   */
  async getConversations(params: {
    cursor?: string | null;
    limit?: number;
    integrationAccountId?: string;
    leadTemperature?: LeadTemperature;
    followup?: boolean;
    status?: string;
  }): Promise<PaginatedConversationsResponse> {
    const queryParams: Record<string, string | number | boolean> = {
      limit: params.limit ?? 30,
    };
    if (params.cursor) queryParams.cursor = params.cursor;
    if (params.integrationAccountId)
      queryParams.integration_account_id = params.integrationAccountId;
    if (params.leadTemperature)
      queryParams.lead_temperature = params.leadTemperature;
    if (params.followup !== undefined)
      queryParams.followup = params.followup;
    if (params.status)
      queryParams.status = params.status;

    const response = await apiClient.get<BackendPaginatedThreads>(
      "/inbox/threads",
      { params: queryParams }
    );

    const data = response.data;
    return {
      items: (data.items || []).map(_threadToConversation),
      nextCursor: data.next_cursor ?? null,
      hasMore: data.has_more,
    };
  }

  /**
   * Get a single conversation by ID.
   */
  async getConversation(id: string): Promise<Conversation> {
    const response = await apiClient.get<BackendThread>(
      `/inbox/threads/${id}`
    );
    return _threadToConversation(response.data);
  }

  /**
   * Get one page of a thread's messages. Without `before` this is the newest page; pass the
   * previous response's `previousCursor` as `before` to load the page of older messages.
   * Items are chronological (oldest first) within each page.
   */
  async getConversationMessages(params: {
    conversationId: string;
    before?: string | null;
    limit?: number;
  }): Promise<PaginatedMessagesResponse> {
    const queryParams: Record<string, string | number> = {
      limit: params.limit ?? 30,
    };
    if (params.before) queryParams.before = params.before;

    const response = await apiClient.get<BackendPaginatedMessages>(
      `/inbox/threads/${params.conversationId}/messages`,
      { params: queryParams }
    );

    const data = response.data;
    return {
      items: (data.items || []).map((m) =>
        _messageToMessage(m, params.conversationId)
      ),
      previousCursor: data.previous_cursor ?? null,
      hasMore: data.has_more,
      totalCount: data.total_count ?? null,
      mailbox: data.mailbox ? { name: data.mailbox.name ?? null, email: data.mailbox.email } : null,
    };
  }

  /**
   * Set lead temperature classification.
   */
  async setLeadTemperature(
    id: string,
    leadTemperature: LeadTemperature
  ): Promise<Conversation> {
    await apiClient.patch<{
      id: string;
      lead_temperature: LeadTemperature;
    }>(`/inbox/threads/${id}/lead-temperature`, {
      lead_temperature: leadTemperature,
    });
    return { id, leadTemperature } as unknown as Conversation;
  }

  /**
   * Permanently delete a thread.
   */
  async deleteConversation(id: string): Promise<{ id: string; deleted: boolean }> {
    const response = await apiClient.delete<{ id: string; deleted: boolean }>(
      `/inbox/threads/${id}`
    );
    return response.data;
  }

  /**
   * Mark a thread as read.
   */
  async markAsRead(id: string): Promise<void> {
    await apiClient.patch<{ id: string; is_read: boolean }>(
      `/inbox/threads/${id}/read`,
      { is_read: true }
    );
  }
}

export const inboxService = new InboxService();
