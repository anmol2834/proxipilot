/**
 * AI Reply Copilot — typed client for POST /api/v1/copilot/threads/{threadId}/refine.
 *
 * The endpoint only PROPOSES text. It never writes the editor and never sends email; the panel
 * applies a proposal only when the editor still holds the draft the proposal was based on.
 */

import { apiClient } from "@/lib/api/client";

export type CopilotOperation =
  | "WRITING_ONLY"
  | "EVIDENCE_REUSE"
  | "NEW_RETRIEVAL"
  | "MIXED"
  | "CLARIFY"
  | "CHAT"
  | "ANSWER";

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
  /** A message to the employee (chat reply / answer / note). Never part of the email. */
  message: string;
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
  /** What the Copilot changed in that turn (its changes_summary): the session memory. */
  summary?: string | null;
}

export type DraftSource = "editor" | "proposal";

export interface RefineBody {
  instruction: string;
  draft_text: string;
  /** Revision of the EDITOR text (used to refuse applying over newer edits). */
  draft_revision: string;
  history: CopilotTurn[];
  draft_source: DraftSource;
  session_summary: string;
}

/** Turns kept verbatim; older turns are compacted into one bounded summary line each. */
export const VERBATIM_TURNS = 6;
const SUMMARY_BUDGET = 1200;

const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1)}…`);

/**
 * Session context window (like a chat assistant's): the last VERBATIM_TURNS turns verbatim, everything
 * older compacted to "instruction -> what changed" lines, newest kept first when the budget is exceeded.
 * Bounded size whatever the session length, so requests never grow without limit.
 */
export function buildSessionContext(turns: CopilotTurn[]): { history: CopilotTurn[]; session_summary: string } {
  const history = turns.slice(-VERBATIM_TURNS).map((t) => ({
    instruction: clip(t.instruction, 1900),
    applied: t.applied,
    summary: t.summary ? clip(t.summary, 380) : null,
  }));
  const older = turns.slice(0, Math.max(0, turns.length - VERBATIM_TURNS));
  const lines: string[] = [];
  let used = 0;
  for (let i = older.length - 1; i >= 0; i--) {
    const t = older[i];
    const line = `${clip(t.instruction, 120)}${t.summary ? ` -> ${clip(t.summary, 100)}` : ""}${t.applied ? " [applied]" : ""}`;
    if (used + line.length + 2 > SUMMARY_BUDGET) break;
    lines.unshift(line);
    used += line.length + 2;
  }
  return { history, session_summary: lines.join("; ") };
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
    body: RefineBody,
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
