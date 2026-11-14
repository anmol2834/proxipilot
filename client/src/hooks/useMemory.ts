"use client";

/**
 * React Query hooks for ProxiPilot's memories.
 *
 * - Every query is keyed under ["memory", <area>, ...] so a mutation invalidates exactly the
 *   views it affects (e.g. reviewing a draft refreshes drafts + metrics + lessons).
 * - Mutations surface the server's own message on failure (403 "not allowed", 409 conflict,
 *   422 validation detail), so the UI never fails silently.
 * - Network blips are retried once for reads; writes are never retried automatically
 *   (they are not all idempotent).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/stores/notification.store";
import {
  memoryService,
  CommitmentCreate,
  CommitmentFilters,
  CommitmentUpdate,
  ContactFactType,
  ContactType,
  ContactUpdate,
  DraftReviewInput,
  PracticeInput,
  PracticeSituation,
  PracticeStatus,
  StyleSettingsInput,
} from "@/services/memory.service";

export const memoryKeys = {
  all: ["memory"] as const,
  contacts: (p?: object) => ["memory", "contacts", p ?? {}] as const,
  contact: (id: string) => ["memory", "contact", id] as const,
  commitments: (f?: object) => ["memory", "commitments", f ?? {}] as const,
  commitmentSummary: () => ["memory", "commitments-summary"] as const,
  practices: (p?: object) => ["memory", "practices", p ?? {}] as const,
  practiceInsights: () => ["memory", "practice-insights"] as const,
  style: () => ["memory", "style"] as const,
  drafts: (s: string) => ["memory", "drafts", s] as const,
  lessons: () => ["memory", "lessons"] as const,
  feedbackMetrics: (d: number) => ["memory", "feedback-metrics", d] as const,
  conversation: (threadId: string) => ["memory", "conversation", threadId] as const,
  context: (messageId: string) => ["memory", "context", messageId] as const,
  threadDraft: (threadId: string) => ["memory", "thread-draft", threadId] as const,
};

const READ_OPTS = { staleTime: 30_000, gcTime: 5 * 60_000, retry: 1, refetchOnWindowFocus: false } as const;

export function errorMessage(err: unknown): string {
  const e = err as { statusCode?: number; message?: string };
  if (e?.statusCode === 403) return "You don't have permission to change this.";
  if (e?.statusCode === 404) return "This item no longer exists — it may have been removed.";
  return e?.message || "Something went wrong. Please try again.";
}

function useMemoryMutation<TVars, TData>(
  fn: (v: TVars) => Promise<TData>,
  opts: { success?: string | ((d: TData) => string); invalidate: (v: TVars) => readonly (readonly unknown[])[] }
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    retry: false,
    onSuccess: (data, vars) => {
      opts.invalidate(vars).forEach((key) => qc.invalidateQueries({ queryKey: key }));
      const msg = typeof opts.success === "function" ? opts.success(data) : opts.success;
      if (msg) toast.success(msg);
    },
    onError: (err) => toast.error(errorMessage(err), "Couldn't save"),
  });
}

// ---------------------------------------------------------------------------- Contacts
export function useContacts(params: { search?: string; type?: ContactType; limit?: number; offset?: number }) {
  return useQuery({ queryKey: memoryKeys.contacts(params), queryFn: () => memoryService.listContacts(params),
                    placeholderData: (prev) => prev, ...READ_OPTS });
}
export function useContact(id: string | null) {
  return useQuery({ queryKey: memoryKeys.contact(id ?? "none"), queryFn: () => memoryService.getContact(id!),
                    enabled: Boolean(id), ...READ_OPTS });
}
export function useUpdateContact() {
  return useMemoryMutation(({ id, body }: { id: string; body: ContactUpdate }) => memoryService.updateContact(id, body), {
    success: "Contact updated", invalidate: ({ id }) => [memoryKeys.contact(id), ["memory", "contacts"]] });
}
export function useAddContactFact() {
  return useMemoryMutation(
    ({ id, body }: { id: string; body: { fact_type: ContactFactType; key: string; value: string } }) =>
      memoryService.addContactFact(id, body),
    { success: "Saved to the contact's memory", invalidate: ({ id }) => [memoryKeys.contact(id)] });
}
export function useRetractContactFact() {
  return useMemoryMutation(({ id, factId }: { id: string; factId: string }) => memoryService.retractContactFact(id, factId), {
    success: "Removed from the contact's memory", invalidate: ({ id }) => [memoryKeys.contact(id)] });
}

// ---------------------------------------------------------------------------- Commitments
export function useCommitments(filters: CommitmentFilters) {
  return useQuery({ queryKey: memoryKeys.commitments(filters), queryFn: () => memoryService.listCommitments(filters),
                    placeholderData: (prev) => prev, ...READ_OPTS });
}
export function useCommitmentSummary() {
  return useQuery({ queryKey: memoryKeys.commitmentSummary(), queryFn: () => memoryService.commitmentSummary(), ...READ_OPTS });
}
const commitmentKeys = () => [["memory", "commitments"], memoryKeys.commitmentSummary(), ["memory", "context"]] as const;
export function useCreateCommitment() {
  return useMemoryMutation((body: CommitmentCreate) => memoryService.createCommitment(body), {
    success: "Saved to commitment memory", invalidate: () => commitmentKeys() });
}
export function useUpdateCommitment() {
  return useMemoryMutation(({ id, body }: { id: string; body: CommitmentUpdate }) => memoryService.updateCommitment(id, body), {
    success: (c) => (c.status === "open" ? "Commitment updated" : `Marked ${c.status}`), invalidate: () => commitmentKeys() });
}

// ---------------------------------------------------------------------------- Practices
export function usePractices(params: { status?: PracticeStatus | "all"; situation?: PracticeSituation } = {}) {
  return useQuery({ queryKey: memoryKeys.practices(params), queryFn: () => memoryService.listPractices(params), ...READ_OPTS });
}
export function usePracticeInsights() {
  return useQuery({ queryKey: memoryKeys.practiceInsights(), queryFn: () => memoryService.practiceInsights(90), ...READ_OPTS });
}
export function useSavePractice() {
  return useMemoryMutation(
    ({ id, body }: { id?: string; body: Partial<PracticeInput> & { status?: "active" | "disabled" | "archived" } }) =>
      id ? memoryService.updatePractice(id, body) : memoryService.createPractice(body as PracticeInput),
    { success: (p) => (p.status === "active" ? `"${p.title}" is live` : `"${p.title}" saved`),
      invalidate: () => [["memory", "practices"], memoryKeys.practiceInsights()] });
}
export function useMinePractices() {
  return useMemoryMutation(() => memoryService.minePractices(), {
    success: (r) => r.status === "ok" ? `${r.suggested} new suggestion(s) to review`
      : r.status === "insufficient_history" ? "Not enough history yet to learn practices from"
      : r.status === "already_running" ? "Already learning — try again shortly" : "Learning is unavailable",
    invalidate: () => [["memory", "practices"]] });
}
export function useTestPractices() {
  return useMutation({ mutationFn: (text: string) => memoryService.testPractices(text), retry: false,
                       onError: (e) => toast.error(errorMessage(e), "Test failed") });
}

// ---------------------------------------------------------------------------- Style
export function useStyleProfiles() {
  return useQuery({ queryKey: memoryKeys.style(), queryFn: () => memoryService.listStyleProfiles(), ...READ_OPTS });
}
export function useSaveStyle() {
  return useMemoryMutation((body: StyleSettingsInput) => memoryService.saveStyleSettings(body), {
    success: "Writing style saved — new drafts use it immediately", invalidate: () => [memoryKeys.style(), ["memory", "context"]] });
}
export function useRebuildStyle() {
  return useMemoryMutation((forceGuide: boolean) => memoryService.rebuildStyle(forceGuide), {
    success: (r) => (r.usable ? `Learned from ${r.usable} hand-written email(s)` : "No hand-written emails to learn from yet"),
    invalidate: () => [memoryKeys.style()] });
}

// ---------------------------------------------------------------------------- Feedback
export function useDrafts(status: string) {
  return useQuery({ queryKey: memoryKeys.drafts(status), queryFn: () => memoryService.listDrafts(status), ...READ_OPTS });
}
export function useReviewDraft() {
  return useMemoryMutation(({ id, body }: { id: string; body: DraftReviewInput }) => memoryService.reviewDraft(id, body), {
    success: (r) => (r.action === "rejected" ? "Draft rejected — the AI will learn from your reason" : "Review saved — thanks, the AI learns from this"),
    invalidate: () => [["memory", "drafts"], ["memory", "feedback-metrics"], memoryKeys.lessons()] });
}
export function useLessons() {
  return useQuery({ queryKey: memoryKeys.lessons(), queryFn: () => memoryService.listLessons(true), ...READ_OPTS });
}
export function useSaveLesson() {
  return useMemoryMutation(
    ({ id, body }: { id?: string; body: { instruction?: string; priority?: number; status?: "active" | "suggested" | "disabled" } }) =>
      id ? memoryService.updateLesson(id, body) : memoryService.createLesson({ instruction: body.instruction!, priority: body.priority }),
    { success: "Lesson saved", invalidate: () => [memoryKeys.lessons()] });
}
export function useFeedbackMetrics(days = 30) {
  return useQuery({ queryKey: memoryKeys.feedbackMetrics(days), queryFn: () => memoryService.feedbackMetrics(days), ...READ_OPTS });
}

// ---------------------------------------------------------------------------- Conversation + engine
export function useConversationMemory(threadId: string | null) {
  return useQuery({ queryKey: memoryKeys.conversation(threadId ?? "none"),
                    queryFn: () => memoryService.getConversationMemory(threadId!), enabled: Boolean(threadId), ...READ_OPTS });
}
export function useUpdateConversationMemory() {
  return useMemoryMutation(
    ({ threadId, body }: { threadId: string; body: Parameters<typeof memoryService.updateConversationMemory>[1] }) =>
      memoryService.updateConversationMemory(threadId, body),
    { success: "Conversation memory updated", invalidate: ({ threadId }) => [memoryKeys.conversation(threadId), ["memory", "context"]] });
}
export function useRebuildConversationMemory() {
  return useMemoryMutation((threadId: string) => memoryService.rebuildConversationMemory(threadId), {
    success: "Conversation memory rebuilt", invalidate: (threadId) => [memoryKeys.conversation(threadId), ["memory", "context"]] });
}
export function useContextPreview(messageId: string | null) {
  return useQuery({ queryKey: memoryKeys.context(messageId ?? "none"),
                    queryFn: () => memoryService.contextPreview(messageId!), enabled: Boolean(messageId), ...READ_OPTS });
}

// ---------------------------------------------------------------------------- Inbox draft + send
export function useThreadDraft(threadId: string | null) {
  return useQuery({
    queryKey: memoryKeys.threadDraft(threadId ?? "none"),
    queryFn: () => memoryService.getThreadDraft(threadId!),
    enabled: Boolean(threadId),
    staleTime: 0,
    retry: 1,
    refetchOnWindowFocus: true,
    // While the AI is still writing a reply for a new customer message, poll until it lands.
    refetchInterval: (q) => (q.state.data?.generating ? 4000 : false),
  });
}

export function useSendDraft(threadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, bodyText }: { id: string; bodyText?: string }) => memoryService.sendDraft(id, bodyText),
    retry: false,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: memoryKeys.threadDraft(threadId) });
      qc.invalidateQueries({ queryKey: ["inbox"] });
      qc.invalidateQueries({ queryKey: ["memory", "drafts"] });
      toast.success(r.status === "already_sent" ? "This reply was already sent." : `Reply sent${r.to_email ? ` to ${r.to_email}` : ""}`);
    },
    onError: (err) => toast.error(errorMessage(err), "Couldn't send"),
  });
}

export function useSendManualReply(threadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bodyText, clientToken }: { bodyText: string; clientToken: string }) =>
      memoryService.sendManualReply(threadId, bodyText, clientToken),
    retry: false,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: memoryKeys.threadDraft(threadId) });
      qc.invalidateQueries({ queryKey: ["inbox"] });
      toast.success(r.status === "already_sent" ? "This reply was already sent." : `Reply sent${r.to_email ? ` to ${r.to_email}` : ""}`);
    },
    onError: (err) => toast.error(errorMessage(err), "Couldn't send"),
  });
}

export function useDiscardDraft(threadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      memoryService.reviewDraft(id, { action: "rejected", reason_code: "other", comment: "Discarded from the inbox" }),
    retry: false,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: memoryKeys.threadDraft(threadId) });
      qc.invalidateQueries({ queryKey: ["memory", "drafts"] });
      toast.success("Draft discarded");
    },
    onError: (err) => toast.error(errorMessage(err), "Couldn't discard"),
  });
}
