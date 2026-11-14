"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/query-keys";
import { integrationsApi } from "@/lib/api";
import { ConnectedIntegrationAccount } from "@/types/integrations.types";
import { toast } from "@/stores/notification.store";
import { useTenant } from "./use-tenant";

export function useIntegrations() {
  const queryClient = useQueryClient();
  const { organizationId } = useTenant();
  const activeOrgId = organizationId || undefined;
  const cacheOrgId = organizationId || "active";

  // List accounts query with intelligent dynamic polling during active syncing
  const {
    data: accounts = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ConnectedIntegrationAccount[], Error>({
    queryKey: queryKeys.integrations.list(cacheOrgId),
    queryFn: () => integrationsApi.list(activeOrgId),
    staleTime: 10 * 1000, // 10 seconds
    gcTime: 5 * 60 * 1000,
    refetchInterval: (query) => {
      const data = query.state.data;
      const isAnySyncing = data?.some((a) => a.status === "syncing");
      return isAnySyncing ? 3000 : false;
    },
  });

  // Connect mutation: fetches Google OAuth URL and opens in browser
  const connectMutation = useMutation({
    mutationFn: async ({
      emailHint,
      displayName,
    }: {
      emailHint?: string;
      displayName?: string;
      /** Return true to skip the redirect (the user cancelled while the URL was being fetched). */
      isCancelled?: () => boolean;
    }) => {
      const res = await integrationsApi.getConnectUrl(
        emailHint,
        displayName,
        "/dashboard/integrations",
        activeOrgId
      );
      return res;
    },
    onSuccess: (data, variables) => {
      if (data?.auth_url && !variables?.isCancelled?.()) {
        window.location.href = data.auth_url;
      }
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail || err?.message || "Failed to generate Google authorization URL";
      toast.error(typeof detail === "string" ? detail : "Failed to initiate Google authorization", "Connection Error");
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: (integrationId: string) => integrationsApi.disconnect(integrationId, activeOrgId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.list(cacheOrgId),
      });
    },
  });

  // Reconnect mutation
  const reconnectMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      const res = await integrationsApi.reconnect(integrationId, activeOrgId);
      return res;
    },
    onSuccess: (data) => {
      if (data?.auth_url) {
        window.location.href = data.auth_url;
      }
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail || err?.message || "Could not generate reconnection URL";
      toast.error(typeof detail === "string" ? detail : "Could not generate reconnection URL", "Reconnect Error");
    },
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: (integrationId: string) => integrationsApi.triggerSync(integrationId, activeOrgId),
    onSuccess: async () => {
      toast.success("Manual mailbox synchronization initiated.", "Sync Queued");
      await queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.list(cacheOrgId),
      });
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail || err?.message || "Sync failed";
      toast.error(
        typeof detail === "string" ? detail : "Cannot sync account requiring re-authorization. Please reconnect.",
        "Sync Error"
      );
    },
  });

  return {
    accounts,
    isLoading,
    isError,
    error,
    refetch,
    connectGmail: connectMutation.mutateAsync,
    isConnecting: connectMutation.isPending,
    disconnectAccount: disconnectMutation.mutateAsync,
    isDisconnecting: disconnectMutation.isPending,
    reconnectAccount: reconnectMutation.mutateAsync,
    isReconnecting: reconnectMutation.isPending,
    triggerManualSync: syncMutation.mutateAsync,
    isSyncing: syncMutation.isPending,
  };
}
