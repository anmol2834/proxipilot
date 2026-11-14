/**
 * Integrations API Client — ProxiPilot
 *
 * Enterprise-grade client interacting with the backend /api/v1/integrations endpoints.
 */

import { apiClient } from "./client";
import { ConnectedIntegrationAccount } from "@/types/integrations.types";

export interface BackendIntegrationAccount {
  id: string;
  organization_id: string;
  provider: string;
  email_address: string;
  display_name?: string;
  provider_account_id?: string;
  status: string;
  connection_status: string;
  scopes: string[];
  last_synced_at?: string;
  last_successful_sync_at?: string;
  last_connected_at?: string;
  last_error_code?: string;
  watch_active?: boolean;
  watch_expires_at?: string;
  watch_expired?: boolean;
  needs_reconnect?: boolean;
  reconnect_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface ConnectGmailResponse {
  auth_url: string;
  state: string;
}

export interface IntegrationHealthResponse {
  account_id: string;
  email_address: string;
  provider: string;
  status: string;
  connection_status: string;
  watch_active: boolean;
  watch_expires_at?: string;
  current_history_id?: string;
  last_successful_sync_at?: string;
  last_error_code?: string;
}

function mapBackendToFrontendAccount(acc: BackendIntegrationAccount): ConnectedIntegrationAccount {
  // Check if 7-day watch has expired
  const isWatchExpired =
    Boolean(acc.watch_expired) ||
    Boolean(acc.watch_expires_at && new Date(acc.watch_expires_at).getTime() <= Date.now());

  const isReauthRequired =
    acc.connection_status === "reauth_required" ||
    acc.status === "reauth_required" ||
    Boolean(acc.needs_reconnect) ||
    isWatchExpired;

  // Map backend status/connection_status to frontend ConnectionStatus
  let status: ConnectedIntegrationAccount["status"] = "connected";
  if (isReauthRequired) {
    status = "needs_attention";
  } else if (acc.connection_status === "syncing" || acc.status === "syncing") {
    status = "syncing";
  } else if (acc.connection_status === "healthy" || acc.status === "connected" || acc.status === "active") {
    status = "healthy";
  } else if (acc.connection_status === "degraded") {
    status = "needs_attention";
  } else if (acc.status === "disconnected") {
    status = "disconnected";
  } else if (acc.status === "error") {
    status = "error";
  }

  const reconnectReason =
    acc.reconnect_reason ||
    (isWatchExpired
      ? "Gmail 7-day sync watch has expired. Reconnecting is required to renew real-time email syncing."
      : isReauthRequired
      ? "Google authorization expired or was revoked. Please reconnect the account."
      : undefined);

  return {
    id: acc.id,
    organizationId: acc.organization_id,
    provider: (acc.provider as any) || "gmail",
    providerAccountId: acc.provider_account_id || acc.id,
    emailAddress: acc.email_address,
    displayName: acc.display_name || acc.email_address.split("@")[0],
    status,
    scopes: acc.scopes || [],
    lastSyncedAt: acc.last_synced_at ? new Date(acc.last_synced_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Never",
    connectedByUserId: "usr-active",
    connectedByUserName: "Organization Member",
    createdAt: acc.created_at,
    updatedAt: acc.updated_at,
    watchExpiresAt: acc.watch_expires_at,
    watchActive: acc.watch_active,
    watchExpired: isWatchExpired,
    needsReconnect: isReauthRequired,
    reconnectReason,
  };
}

export const integrationsApi = {
  /**
   * List all connected mailboxes for the current organization.
   */
  async list(tenantId?: string): Promise<ConnectedIntegrationAccount[]> {
    const res = await apiClient.get<{ success: boolean; data: BackendIntegrationAccount[] }>(
      "/integrations",
      { tenantId }
    );
    const list = res.data?.data || [];
    return list.map(mapBackendToFrontendAccount);
  },

  /**
   * Request Google OAuth 2.0 authorization URL to connect a Gmail mailbox.
   */
  async getConnectUrl(
    emailHint?: string,
    displayName?: string,
    returnUrl?: string,
    tenantId?: string
  ): Promise<ConnectGmailResponse> {
    const params: Record<string, string> = {};
    if (emailHint) params.email_hint = emailHint;
    if (displayName) params.display_name = displayName;
    if (returnUrl) params.return_url = returnUrl;

    const res = await apiClient.get<{ success: boolean; data: ConnectGmailResponse }>(
      "/integrations/gmail/connect",
      { params, tenantId, timeoutMs: 45000 }
    );
    return res.data.data;
  },

  /**
   * Disconnect an active mailbox by ID.
   */
  async disconnect(integrationId: string, tenantId?: string): Promise<void> {
    await apiClient.delete(`/integrations/gmail/${integrationId}`, { tenantId });
  },

  /**
   * Request reconnect authorization URL for an account needing re-auth.
   */
  async reconnect(integrationId: string, tenantId?: string): Promise<ConnectGmailResponse> {
    const res = await apiClient.post<{ success: boolean; data: ConnectGmailResponse }>(
      `/integrations/gmail/${integrationId}/reconnect`,
      undefined,
      { tenantId }
    );
    return res.data.data;
  },

  /**
   * Trigger manual incremental synchronization.
   */
  async triggerSync(integrationId: string, tenantId?: string): Promise<void> {
    await apiClient.post(`/integrations/gmail/${integrationId}/sync`, undefined, { tenantId });
  },

  /**
   * Fetch live connection and watch health status.
   */
  async getHealth(integrationId: string, tenantId?: string): Promise<IntegrationHealthResponse> {
    const res = await apiClient.get<{ success: boolean; data: IntegrationHealthResponse }>(
      `/integrations/gmail/${integrationId}/health`,
      { tenantId }
    );
    return res.data.data;
  },
};
