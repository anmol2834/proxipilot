/**
 * Inbox Domain Types — ProxiPilot Clean Inbox Read Model
 *
 * Type contract:
 * - Subject lives on Conversation only, NOT on Message.
 * - body_text is plain text (never HTML).
 * - sender includes avatar palette fields for UI rendering.
 */

export type LeadTemperature = "hot" | "warm" | "cold" | null;

export interface ConversationSender {
  name: string;
  email: string;
  initials: string;
  avatarBg: string;
  avatarColor: string;
}

export interface AISummary {
  intent: string;
  bulletPoints: string[];
  confidence?: number;
  generatedAt?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  providerMessageId: string;
  sender: ConversationSender;
  recipients: string[];
  /** Empty string — subject lives on Conversation, not individual messages. */
  subject: string;
  /** Normalized plain-text body. No HTML. No MIME. */
  body: string;
  sentAt: string;
  timestampFormatted: string;
  direction: "inbound" | "outbound";
  createdAt: string;
}

export interface Conversation {
  id: string;
  organizationId: string;
  integrationAccountId: string;
  provider: "gmail" | "outlook" | "imap";
  threadId: string;
  sender: ConversationSender;
  /** Thread-level subject. Normalized: Re:/Fwd: prefixes stripped. */
  subject: string;
  /** Short preview from latest message body_text. */
  snippet: string;
  /** Formatted display timestamp (e.g. "10:24 AM", "Yesterday", "Mon"). */
  latestMessageAt: string;
  leadTemperature: LeadTemperature;
  starred: boolean;
  unread: boolean;
  createdAt: string;
  updatedAt: string;
  aiSummary: AISummary;
  threadCount?: number;
}

export interface PaginatedConversationsResponse {
  items: Conversation[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface PaginatedMessagesResponse {
  items: Message[];
  previousCursor: string | null;
  hasMore: boolean;
}
