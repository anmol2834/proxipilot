export type IntegrationProvider =
  | "gmail"
  | "outlook"
  | "imap"
  | "salesforce"
  | "hubspot"
  | "slack"
  | "google-drive";

export type ConnectionStatus =
  | "connected"
  | "syncing"
  | "healthy"
  | "needs_attention"
  | "disconnected"
  | "reconnecting"
  | "error";

export interface ConnectedIntegrationAccount {
  id: string;
  organizationId: string;
  provider: IntegrationProvider;
  providerAccountId: string;
  emailAddress: string;
  displayName: string;
  avatarUrl?: string;
  status: ConnectionStatus;
  scopes: string[];
  lastSyncedAt: string;
  connectedByUserId: string;
  connectedByUserName: string;
  createdAt: string;
  updatedAt: string;
  syncProgress?: number;
  totalSyncedEmails?: number;
  errorMessage?: string;
  watchExpiresAt?: string;
  watchActive?: boolean;
  watchExpired?: boolean;
  needsReconnect?: boolean;
  reconnectReason?: string;
}

export interface IntegrationProviderMeta {
  id: IntegrationProvider;
  name: string;
  description: string;
  category: "email" | "crm" | "collaboration" | "storage";
  isAvailable: boolean;
  badgeLabel?: string;
}

export interface IntegrationRequestPayload {
  toolName: string;
  useCase?: string;
  requestedByEmail?: string;
}
