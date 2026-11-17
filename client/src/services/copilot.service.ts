/**
 * AI Reply Copilot — typed client for POST /api/v1/copilot/threads/{threadId}/refine.
 *
 * The endpoint only PROPOSES text. It never writes the editor and never sends email; the panel
 * applies a proposal only when the editor still holds the draft the proposal was based on.
 */

import { apiClient } from "@/lib/api/client";

export type CopilotOperation = "WRITING_ONLY" | "EVIDENCE_REUSE" | "NEW_RETRIEVAL" | "MIXED" | "CLARIFY";

export interface CopilotFact {
  fact_id: string;
  entity_id?: string | null;
  entity_code?: string | null;
  entity_title?: string | null;
  attribute: string;
  value: string;
  source: "context_record" | "cache" | "retrieval";
  authority: string;
  version_id?: string | null;
}

export interface CopilotIssue {
  code: string;
  detail: string;
}

export interface CopilotResult {
  request_id: string;
  thread_id: string;
  operation: CopilotOperation;
  proposal: string;
  changes_summary: string;
  base_draft_revision: string | null;
  apply_allowed: boolean;
  facts_used: CopilotFact[];
  unresolved: string[];
  issues: CopilotIssue[];
  clarification_question: string | null;
  evidence_status: string;
  metrics: Record<string, unknown>;
}

export interface CopilotTurn {
  instruction: string;
  applied: boolean;
}

/** Stable revision id of an editor text (FNV-1a 32-bit + length): equal text => equal revision. */
export function draftRevision(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `r${text.length.toString(36)}-${h.toString(36)}`;
}

export const copilotService = {
  async refine(
    threadId: string,
    body: { instruction: string; draft_text: string; draft_revision: string; history: CopilotTurn[] },
    signal?: AbortSignal
  ) {
    return (
      await apiClient.post<CopilotResult>(`/copilot/threads/${encodeURIComponent(threadId)}/refine`, body, {
        timeoutMs: 160_000,
        signal,
      })
    ).data;
  },
};
