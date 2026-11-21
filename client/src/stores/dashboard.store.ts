"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * DashboardSetupState
 *
 * IMPORTANT — Source of truth change (Oct 2026):
 * `emailConnected` and `knowledgeAdded` are NO LONGER used as setup checklist
 * state. The Overview page and SetupChecklist now derive those flags from:
 *   - emailConnected  → useIntegrations().accounts (real server data via React Query)
 *   - knowledgeAdded  → /dashboard/overview knowledge.ready (server rule)
 *
 * `connectEmail()` and `addKnowledge()` are kept as no-ops for backward
 * compatibility (no existing call sites should be broken). Do NOT call them
 * to mark setup steps as complete — they have no effect on the checklist.
 *
 * `resetSetup()` is retained for developer/testing convenience only.
 * `accountCreated` stays as-is — it is always true once a user is authenticated.
 */
export interface DashboardSetupState {
  accountCreated: boolean;
  /** @deprecated Derived from real server state. Do not use to track email connection. */
  emailConnected: boolean;
  /** @deprecated Derived from real server state. Do not use to track knowledge upload. */
  knowledgeAdded: boolean;

  // Actions
  /** @deprecated No-op. Email connection status is derived from useIntegrations(). */
  connectEmail: () => void;
  /** @deprecated No-op. Email disconnection status is derived from useIntegrations(). */
  disconnectEmail: () => void;
  /** @deprecated No-op. Knowledge status is derived from useKnowledgeStore(). */
  addKnowledge: () => void;
  /** @deprecated No-op. Knowledge status is derived from useKnowledgeStore(). */
  removeKnowledge: () => void;
  completeAllSetup: () => void;
  /** Resets for developer testing — has no effect on real server data */
  resetSetup: () => void;
}

export const useDashboardStore = create<DashboardSetupState>()(
  persist(
    (set) => ({
      accountCreated: true,
      emailConnected: false,
      knowledgeAdded: false,

      // No-ops — real state is derived from server data in useSetupStatus hook
      connectEmail: () => {},
      disconnectEmail: () => {},
      addKnowledge: () => {},
      removeKnowledge: () => {},

      completeAllSetup: () =>
        set({
          accountCreated: true,
          emailConnected: true,
          knowledgeAdded: true,
        }),
      resetSetup: () =>
        set({
          accountCreated: true,
          emailConnected: false,
          knowledgeAdded: false,
        }),
    }),
    {
      name: "proxipilot-dashboard-setup-v1",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
