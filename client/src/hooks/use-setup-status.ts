"use client";

/**
 * useSetupStatus — Enterprise-grade derived setup state hook
 *
 * Single source of truth for the "Get Started" checklist on the Overview page.
 * Derives emailConnected and knowledgeAdded from REAL server data:
 *
 *   - emailConnected: derived from the React Query cache of /api/v1/integrations
 *     (i.e. whether there is at least one healthy/connected Gmail account on the server).
 *     useIntegrations() already starts fetching on mount automatically via useQuery.
 *
 *   - knowledgeAdded: the server's verdict in /dashboard/overview (`knowledge.ready`): the
 *     business has added Products & Services and at least one more category of its own.
 *     Registration data (the auto-built Company Info record) never counts.
 *
 * This replaces the phantom boolean flags in dashboard.store.ts which were set
 * immediately on button click (before any OAuth flow or upload actually completed),
 * causing the checklist to falsely show "Connected" / "Indexed" even when the user
 * had not performed the actual action.
 */

import { useMemo } from "react";
import { useIntegrations } from "./use-integrations";
import type { DashboardOverview } from "@/services/dashboard.service";

export interface SetupStatus {
  /** Always true once the user has an account (they are logged in) */
  accountCreated: boolean;
  /**
   * True only when the server confirms at least one active Gmail integration
   * with status 'healthy' or 'connected'. Derived from useIntegrations() query or overview.
   */
  emailConnected: boolean;
  /** True when the business's own knowledge meets the server rule (Products & Services + at least 2 categories). */
  knowledgeAdded: boolean;
  /** What is still missing, for the checklist guidance (null when done or unknown). */
  knowledgeNextStep: "add_products_services" | "add_another_category" | null;
  /** True when both emailConnected and knowledgeAdded are true */
  isSetupComplete: boolean;
  /** Whether the integration list is still loading from the server */
  isEmailLoading: boolean;
  /** Whether the knowledge items list is still loading from the server */
  isKnowledgeLoading: boolean;
  /**
   * True while initial data is being fetched and setup completion has not been confirmed.
   */
  isInitialLoading: boolean;
}

export function useSetupStatus(overviewData?: DashboardOverview): SetupStatus {
  const { accounts, isLoading: isEmailLoading } = useIntegrations();

  const emailConnected = useMemo(() => {
    const hasActiveAccount = accounts.some(
      (a) => a.status === "healthy" || a.status === "connected"
    );
    if (hasActiveAccount) return true;
    if (overviewData && (overviewData.workspace?.mailboxes ?? 0) > 0) return true;
    return false;
  }, [accounts, overviewData]);

  // Server-side rule only: a raw item count would also count the registration-built Company Info.
  const knowledgeAdded = overviewData?.knowledge?.ready === true;
  const knowledgeNextStep = overviewData?.knowledge ? overviewData.knowledge.next_step : null;
  const isKnowledgeLoading = !overviewData;

  const isSetupComplete = emailConnected && knowledgeAdded;

  const isInitialLoading = !isSetupComplete && (isEmailLoading || isKnowledgeLoading);

  return {
    accountCreated: true, // always true — user is authenticated to reach this page
    emailConnected,
    knowledgeAdded,
    knowledgeNextStep,
    isSetupComplete,
    isEmailLoading,
    isKnowledgeLoading,
    isInitialLoading,
  };
}
