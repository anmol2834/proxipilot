/**
 * Memory Service — typed client for ProxiPilot's AI memories (backend /api/v1).
 *
 *   Memory 2  Communication Style       /style/*
 *   Memory 3  Thread & Conversation     /conversations/{threadId}/memory
 *   Memory 4  Contact & Relationship    /contacts/*
 *   Memory 5  Organizational Experience /practices/*
 *   Memory 6  Decision & Commitment     /commitments/*
 *   Memory 7  Feedback & Outcome        /feedback/*
 *   Engine    Context Intelligence      /context/preview
 *
 * (Memory 1 + 8 — Company Knowledge and Update & Sync — live in knowledge.service.ts.)
 * The tenant is resolved server-side from the session; every call is tenant-scoped there.
 */

import { apiClient } from "@/lib/api/client";

// =============================================================================
// Shared
// =============================================================================

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// =============================================================================
// Memory 4 — Contacts
// =============================================================================

export type ContactType = "customer" | "prospect" | "supplier" | "partner" | "internal" | "unknown";
export type ContactFactType = "preference" | "interest" | "need" | "issue" | "attribute" | "note";

export interface ContactSummary {
  id: string;
  email: string;
  display_name: string | null;
  company_name: string | null;
  contact_type: ContactType;
  lead_temperature: string | null;
  inbound_count: number;
  outbound_count: number;
  last_interaction_at: string | null;
  is_blocked: boolean;
}

export interface ContactFact {
  id: string;
  key: string;
  value: string;
  confidence?: number;
  source_type: string;
  status?: string;
  observed_at?: string | null;
  occurrences?: number;
}

export interface ContactProfile {
  id: string;
  email: string;
  display_name: string | null;
  domain?: string | null;
  contact_type: ContactType;
  company_name: string | null;
  job_title: string | null;
  phone: string | null;
  preferred_language: string | null;
  tags?: string | null; // JSON-encoded list
  lead_temperature?: string | null;
  last_intent?: string | null;
  is_blocked: boolean;
  type_locked?: boolean;
  stats: {
    inbound_count: number;
    outbound_count: number;
    thread_count: number;
    first_interaction_at: string | null;
    last_interaction_at: string | null;
  };
  facts: Partial<Record<ContactFactType, ContactFact[]>>;
  recent_threads: { id: string; subject: string | null; status: string; latest_message_at: string | null }[];
}

export interface ContactUpdate {
  display_name?: string | null;
  contact_type?: ContactType;
  company_name?: string | null;
  job_title?: string | null;
  phone?: string | null;
  preferred_language?: string | null;
  is_blocked?: boolean;
}

// =============================================================================
// Memory 6 — Commitments
// =============================================================================

export type CommitmentKind = "commitment" | "decision" | "action_item";
export type CommitmentParty = "company" | "customer" | "internal";
export type CommitmentStatus = "open" | "fulfilled" | "cancelled" | "superseded";
export const COMMITMENT_CATEGORIES = [
  "quote", "pricing", "discount", "delivery", "document", "callback", "meeting", "payment", "order", "support",
  "policy", "other",
] as const;
export type CommitmentCategory = (typeof COMMITMENT_CATEGORIES)[number];

export interface Commitment {
  id: string;
  kind: CommitmentKind;
  owed_by: CommitmentParty;
  category: CommitmentCategory;
  statement: string;
  thread_id: string | null;
  counterparty_email: string | null;
  owner_email: string | null;
  approved_by: string | null;
  due_at: string | null;
  due_text: string | null;
  is_overdue: boolean;
  status: CommitmentStatus;
  confidence: number;
  source_type: string;
  source_message_id: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  superseded_by_id: string | null;
  created_at: string | null;
}

export interface CommitmentSummary {
  open: number;
  overdue: number;
  due_48h: number;
  decisions_in_force: number;
  we_owe: number;
  customer_owes: number;
  action_items: number;
}

export interface CommitmentFilters {
  status?: CommitmentStatus | "all";
  kind?: CommitmentKind;
  owed_by?: CommitmentParty;
  thread_id?: string;
  overdue?: boolean;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface CommitmentCreate {
  kind: CommitmentKind;
  owed_by: CommitmentParty;
  category: CommitmentCategory;
  statement: string;
  thread_id?: string | null;
  counterparty_email?: string | null;
  owner_email?: string | null;
  approved_by?: string | null;
  due_at?: string | null; // ISO with offset
}

export interface CommitmentUpdate {
  statement?: string;
  category?: CommitmentCategory;
  owner_email?: string | null;
  approved_by?: string | null;
  due_at?: string | null;
  status?: "open" | "fulfilled" | "cancelled";
  resolution_note?: string | null;
}

// =============================================================================
// Memory 5 — Practices
// =============================================================================

export const PRACTICE_SITUATIONS = [
  "general", "complaint", "return_refund", "negotiation", "quotation", "order", "payment", "delivery", "support",
  "approval",
] as const;
export type PracticeSituation = (typeof PRACTICE_SITUATIONS)[number];
export type PracticeStatus = "active" | "suggested" | "disabled" | "archived";

export interface Practice {
  id: string;
  title: string;
  situation: PracticeSituation;
  trigger_keywords: string[];
  description: string;
  rules: string[];
  exceptions: string | null;
  requires_approval: boolean;
  approver: string | null;
  escalate_to_human: boolean;
  priority: number;
  status: PracticeStatus;
  origin: "employee" | "learned";
  confidence: number;
  evidence: { summary?: string | null; evidence_items?: number } | null;
  version: number;
  updated_at: string | null;
}

export interface PracticeInput {
  title: string;
  situation: PracticeSituation;
  trigger_keywords: string[];
  description: string;
  rules: string[];
  exceptions?: string | null;
  requires_approval: boolean;
  approver?: string | null;
  escalate_to_human: boolean;
  priority: number;
}

export interface PracticeTestResult {
  situations: string[];
  escalate_to_human_review: boolean;
  escalation_reason: string | null;
  matched: { id: string; title: string; reason: string }[];
  drafter_context: string | null;
}

export interface PracticeInsights {
  window_days: number;
  commitment_turnaround: {
    category: string;
    owed_by: string;
    total: number;
    fulfilled: number;
    overdue: number;
    median_hours_to_fulfil: number | null;
    on_time_pct: number | null;
  }[];
  approvals: { approver: string; category: string; decisions: number }[];
  practices: { status: string; origin: string; n: number }[];
}

// =============================================================================
// Memory 2 — Style
// =============================================================================

export interface StyleOverrides {
  greeting?: string;
  sign_off?: string;
  language?: "english" | "hindi" | "hinglish";
  formality?: "formal" | "neutral" | "casual";
  max_words?: number;
  use_bullets?: boolean;
}

export interface StyleProfile {
  id: string;
  scope: "company" | "sender";
  scope_key: string;
  status: "active" | "insufficient_data" | "disabled";
  sample_count: number;
  version: number;
  computed_at: string | null;
  learned: Record<string, any> | null;
  learned_guide: { tone?: string; situational?: { situation: string; practice: string }[] } | null;
  overrides: StyleOverrides;
  employee_guide: string | null;
}

export interface StyleSettingsInput {
  scope: "company" | "sender";
  scope_key?: string;
  overrides?: StyleOverrides;
  employee_guide?: string | null;
  enabled?: boolean;
}

// =============================================================================
// Memory 7 — Feedback
// =============================================================================

export const FEEDBACK_REASONS = [
  "wrong_facts", "missing_info", "wrong_tone", "too_long", "too_short", "off_topic", "policy", "other",
] as const;
export type FeedbackReason = (typeof FEEDBACK_REASONS)[number];

export interface DraftItem {
  id: string;
  thread_id: string;
  subject: string | null;
  body: string | null;
  approval_status: string;
  tone: string | null;
  has_policy_violations: boolean;
  reviewed_at: string | null;
  created_at: string | null;
}

export interface DraftReviewInput {
  action: "approved" | "edited" | "rejected";
  final_text?: string;
  reason_code?: FeedbackReason;
  comment?: string;
}

export interface FeedbackLesson {
  id: string;
  instruction: string;
  scope_intent: string | null;
  origin: "employee" | "derived";
  derived_key: string | null;
  evidence_count: number;
  status: "active" | "suggested" | "disabled";
  priority: number;
  updated_at: string | null;
}

export interface FeedbackMetrics {
  window_days: number;
  drafts_reviewed: number;
  actions: Record<string, number>;
  approval_rate: number | null;
  edit_rate: number | null;
  rejection_rate: number | null;
  rejection_reasons: Record<string, number>;
  outcomes: Record<string, Record<string, number>>;
  positive_outcome_rate: { ai: number | null; human: number | null };
}

// =============================================================================
// Memory 3 — Conversation
// =============================================================================

export interface ConversationRequirement {
  id: string;
  text: string;
  status: "open" | "answered" | "cancelled";
  since?: string | null;
  resolved_by?: string | null;
}

export interface ConversationMemory {
  thread_id: string;
  status: "ok" | "error" | "not_built";
  summary?: string | null;
  stage?: string | null;
  sentiment?: string | null;
  language?: string | null;
  last_customer_ask?: string | null;
  customer_requirements?: ConversationRequirement[];
  open_issues?: { text: string; owner: "company" | "customer" }[];
  key_facts?: string[];
  pinned_notes?: string | null;
  messages_included: number;
  version?: number;
  last_error?: string | null;
  updated_at?: string | null;
}

// =============================================================================
// Context Intelligence Engine
// =============================================================================

export interface ContextRisk {
  code: string;
  severity: "low" | "medium" | "high";
  message: string;
  instruction: string;
}

export interface ContextPreview {
  message_id: string;
  thread_id: string;
  confidence: number;
  confidence_reasons: string[];
  risks: ContextRisk[];
  escalations: string[];
  sections: Record<string, string | null>;
  alerts: string | null;
  situations: string[];
  memories_used: string[];
  memory_failed: string[];
  memory_timings_ms: Record<string, number>;
}

export interface ThreadDraftState {
  thread_id: string;
  generating: boolean;
  latest_inbound_at: string | null;
  draft: {
    id: string;
    subject: string | null;
    body: string | null;
    approval_status: string;
    has_policy_violations: boolean;
    review_reason: string | null;
    created_at: string | null;
  } | null;
}

// =============================================================================
// Service
// =============================================================================

const clean = <T extends Record<string, unknown>>(obj: T): Partial<T> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;

export const memoryService = {
  // ---- Contacts (Memory 4)
  async listContacts(params: { search?: string; type?: ContactType; limit?: number; offset?: number }) {
    return (await apiClient.get<Page<ContactSummary>>("/contacts", { params })).data;
  },
  async getContact(id: string) {
    return (await apiClient.get<ContactProfile>(`/contacts/${encodeURIComponent(id)}`)).data;
  },
  async updateContact(id: string, body: ContactUpdate) {
    return (await apiClient.patch<ContactProfile>(
      `/contacts/${encodeURIComponent(id)}`, clean(body as Record<string, unknown>))).data;
  },
  async addContactFact(id: string, body: { fact_type: ContactFactType; key: string; value: string }) {
    return (await apiClient.post<ContactFact>(`/contacts/${encodeURIComponent(id)}/facts`, body)).data;
  },
  async retractContactFact(id: string, factId: string) {
    await apiClient.delete(`/contacts/${encodeURIComponent(id)}/facts/${encodeURIComponent(factId)}`);
  },
  async rebuildContacts() {
    return (await apiClient.post<Record<string, unknown>>("/contacts/rebuild", {}, { timeoutMs: 120_000 })).data;
  },

  // ---- Commitments (Memory 6)
  async listCommitments(filters: CommitmentFilters) {
    return (await apiClient.get<Page<Commitment>>("/commitments", { params: clean(filters as Record<string, unknown>) as any })).data;
  },
  async commitmentSummary() {
    return (await apiClient.get<CommitmentSummary>("/commitments/summary")).data;
  },
  async createCommitment(body: CommitmentCreate) {
    return (await apiClient.post<Commitment>("/commitments", clean(body as unknown as Record<string, unknown>))).data;
  },
  async updateCommitment(id: string, body: CommitmentUpdate) {
    return (await apiClient.patch<Commitment>(`/commitments/${encodeURIComponent(id)}`, clean(body as Record<string, unknown>))).data;
  },

  // ---- Practices (Memory 5)
  async listPractices(params: { status?: PracticeStatus | "all"; situation?: PracticeSituation } = {}) {
    return (await apiClient.get<Practice[]>("/practices", { params })).data;
  },
  async createPractice(body: PracticeInput) {
    return (await apiClient.post<Practice>("/practices", body)).data;
  },
  async updatePractice(id: string, body: Partial<PracticeInput> & { status?: "active" | "disabled" | "archived" }) {
    return (await apiClient.patch<Practice>(`/practices/${encodeURIComponent(id)}`, body)).data;
  },
  async minePractices() {
    return (await apiClient.post<{ status: string; suggested: number; evidence_items?: number }>(
      "/practices/mine", {}, { timeoutMs: 180_000 })).data;
  },
  async testPractices(text: string, includeSuggested = false) {
    return (await apiClient.post<PracticeTestResult>("/practices/test", { text, include_suggested: includeSuggested })).data;
  },
  async practiceInsights(days = 90) {
    return (await apiClient.get<PracticeInsights>("/practices/insights", { params: { days } })).data;
  },

  // ---- Style (Memory 2)
  async listStyleProfiles() {
    return (await apiClient.get<StyleProfile[]>("/style/profiles")).data;
  },
  async saveStyleSettings(body: StyleSettingsInput) {
    return (await apiClient.put<StyleProfile>("/style/settings", body)).data;
  },
  async rebuildStyle(forceGuide = false) {
    return (await apiClient.post<{ emails_scanned: number; usable: number; profiles: Record<string, unknown> }>(
      "/style/rebuild", {}, { params: { force_guide: forceGuide }, timeoutMs: 180_000 })).data;
  },

  // ---- Feedback (Memory 7)
  async listDrafts(approvalStatus: string = "pending_review", limit = 25, offset = 0) {
    return (await apiClient.get<Page<DraftItem>>("/feedback/drafts", {
      params: { approval_status: approvalStatus, limit, offset } })).data;
  },
  async reviewDraft(id: string, body: DraftReviewInput) {
    return (await apiClient.post<{ id: string; action: string; similarity: number | null }>(
      `/feedback/drafts/${encodeURIComponent(id)}/review`, clean(body as unknown as Record<string, unknown>))).data;
  },
  async listLessons(includeDisabled = false) {
    return (await apiClient.get<FeedbackLesson[]>("/feedback/lessons", { params: { include_disabled: includeDisabled } })).data;
  },
  async createLesson(body: { instruction: string; scope_intent?: string | null; priority?: number }) {
    return (await apiClient.post<FeedbackLesson>("/feedback/lessons", clean(body))).data;
  },
  async updateLesson(id: string, body: { instruction?: string; priority?: number; status?: "active" | "suggested" | "disabled" }) {
    return (await apiClient.patch<FeedbackLesson>(`/feedback/lessons/${encodeURIComponent(id)}`, clean(body))).data;
  },
  async feedbackMetrics(days = 30) {
    return (await apiClient.get<FeedbackMetrics>("/feedback/metrics", { params: { days } })).data;
  },

  // ---- Conversation (Memory 3)
  async getConversationMemory(threadId: string) {
    return (await apiClient.get<ConversationMemory>(`/conversations/${encodeURIComponent(threadId)}/memory`)).data;
  },
  async updateConversationMemory(
    threadId: string,
    body: { pinned_notes?: string | null; requirements?: { id: string; status: ConversationRequirement["status"] }[] }
  ) {
    return (await apiClient.patch<ConversationMemory>(`/conversations/${encodeURIComponent(threadId)}/memory`, body)).data;
  },
  async rebuildConversationMemory(threadId: string) {
    return (await apiClient.post<{ result: Record<string, unknown>; memory: ConversationMemory }>(
      `/conversations/${encodeURIComponent(threadId)}/memory/rebuild`, {}, { timeoutMs: 180_000 })).data;
  },

  // ---- Inbox: AI draft for a conversation + one-click send into the same Gmail thread
  async getThreadDraft(threadId: string) {
    return (await apiClient.get<ThreadDraftState>(`/feedback/threads/${encodeURIComponent(threadId)}/draft`)).data;
  },
  async sendDraft(id: string, bodyText?: string) {
    return (await apiClient.post<{ status: string; provider_message_id?: string | null; to_email?: string; edited?: boolean }>(
      `/feedback/drafts/${encodeURIComponent(id)}/send`, bodyText === undefined ? {} : { body_text: bodyText },
      { timeoutMs: 60_000 })).data;
  },
  /** Send a reply typed by the user; `clientToken` makes retries/double clicks send once. */
  async sendManualReply(threadId: string, bodyText: string, clientToken: string) {
    return (await apiClient.post<{ status: string; provider_message_id?: string | null; to_email?: string }>(
      `/feedback/threads/${encodeURIComponent(threadId)}/reply`, { body_text: bodyText, client_token: clientToken },
      { timeoutMs: 60_000 })).data;
  },

  // ---- Context Intelligence Engine
  async contextPreview(messageId: string) {
    return (await apiClient.get<ContextPreview>("/context/preview", { params: { message_id: messageId } })).data;
  },
};
