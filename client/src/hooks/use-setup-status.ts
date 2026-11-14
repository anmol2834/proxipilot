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
 *   - knowledgeAdded: derived from the knowledge store items array.
 *     On first render, if items have never been fetched, triggers fetchItems() so the
 *     knowledge count is available without requiring the user to visit the knowledge page first.
 *
 * This replaces the phantom boolean flags in dashboard.store.ts which were set
 * immediately on button click (before any OAuth flow or upload actually completed),
 * causing the checklist to falsely show "Connected" / "Indexed" even when the user
 * had not performed the actual action.
 */

import { useEffect, useMemo } from "react";
import { useIntegrations } from "./use-integrations";
import { useKnowledgeStore } from "@/stores/knowledge.store";

export interface SetupStatus {
  /** Always true once the user has an account (they are logged in) */
  accountCreated: boolean;
  /**
   * True only when the server confirms at least one active Gmail integration
   * with status 'healthy' or 'connected'. Derived from useIntegrations() query.
   */
  emailConnected: boolean;
  /**
   * True only when the server has at least one knowledge item indexed.
   * Derived from useKnowledgeStore.items (fetched from server on first use).
   */
  knowledgeAdded: boolean;
  /** True when both emailConnected and knowledgeAdded are true */
  isSetupComplete: boolean;
  /** Whether the integration list is still loading from the server */
  isEmailLoading: boolean;
  /** Whether the knowledge items list is still loading from the server */
  isKnowledgeLoading: boolean;
}

export function useSetupStatus(): SetupStatus {
  const { accounts, isLoading: isEmailLoading } = useIntegrations();
  const {
    items,
    isLoading: isKnowledgeLoading,
    isFetching: isKnowledgeFetching,
    fetchItems,
  } = useKnowledgeStore();

  /**
   * Lazily seed the knowledge store if it hasn't been populated yet.
   * This ensures the Overview page can show the correct knowledge status
   * even if the user has never visited the Knowledge page in this session.
   * Guard conditions prevent duplicate fetches:
   *   - Only runs if items array is empty (never fetched)
   *   - Only runs if not already loading or fetching
   */
  useEffect(() => {
    if (items.length === 0 && !isKnowledgeLoading && !isKnowledgeFetching) {
      fetchItems(true);
    }
    // We intentionally run only once on mount — further syncs happen on knowledge page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emailConnected = useMemo(() => {
    return accounts.some(
      (a) => a.status === "healthy" || a.status === "connected"
    );
  }, [accounts]);

  const knowledgeAdded = useMemo(() => {
    return items.length > 0;
  }, [items]);

  const isSetupComplete = emailConnected && knowledgeAdded;

  return {
    accountCreated: true, // always true — user is authenticated to reach this page
    emailConnected,
    knowledgeAdded,
    isSetupComplete,
    isEmailLoading,
    isKnowledgeLoading: isKnowledgeLoading || isKnowledgeFetching,
  };
}
