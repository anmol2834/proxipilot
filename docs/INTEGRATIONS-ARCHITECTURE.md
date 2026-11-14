# Integrations Architecture

## Overview
The ProxiPilot Integrations module is architected to enable organizations to connect, manage, and monitor multiple external mailboxes and business tools. The architecture is explicitly designed around **provider-agnostic integration account entities** and **multi-tenant isolation**, allowing future connectors (Microsoft Outlook, IMAP, Salesforce, HubSpot, Slack, Google Drive) to be added without architectural refactoring.

---

## 1. Domain Entities & Data Modeling

### 1.1 Integration Account Model
Rather than a naive boolean flag (e.g. `gmailConnected: boolean`), integrations are modeled as independent, organization-scoped accounts:

```typescript
interface ConnectedIntegrationAccount {
  id: string;                      // Internal UUID
  organizationId: string;          // Multi-tenant organization scoping
  provider: IntegrationProvider;   // 'gmail' | 'outlook' | 'imap' | ...
  providerAccountId: string;       // Unique identifier from provider (e.g. Google sub)
  emailAddress: string;            // Primary mailbox email
  displayName: string;             // Organization-facing label (e.g. Support Desk)
  avatarUrl?: string;              // Optional profile avatar
  status: ConnectionStatus;        // 'connected' | 'syncing' | 'healthy' | 'needs_attention' | 'error'
  scopes: string[];                // Explicitly granted OAuth scopes
  lastSyncedAt: string;            // Timestamp of latest sync cycle
  connectedByUserId: string;       // User who authorized the connection
  connectedByUserName: string;     // Audit trace user name
  createdAt: string;
  updatedAt: string;
  syncProgress?: number;           // Initial indexing progress (0-100%)
  totalSyncedEmails?: number;      // Total email count indexed by AI
  errorMessage?: string;
}
```

---

## 2. Multi-Gmail & Multi-Account Support

An organization can connect **$1..N$** Gmail accounts simultaneously:
```text
Organization (e.g., Acme Inc.)
   ├── Mailbox 1: support@acme.com  (● Healthy, 1,420 conversations)
   ├── Mailbox 2: sales@acme.com    (● Healthy, 850 conversations)
   └── Mailbox 3: billing@acme.com  (● Syncing..., 65%)
```

### Key Invariants:
1. **Independent Lifecycle**: Disconnecting `support@acme.com` never alters or affects `sales@acme.com`.
2. **Independent Status & Health**: Each account tracks its own tokens, sync schedule, indexing progress, and error alerts.
3. **No Cross-Tenant Leaks**: All integration operations are strictly isolated by `organizationId` derived from the server session.

---

## 3. OAuth 2.0 Security & Flow

1. **Initiation**: Client clicks `Connect Gmail` or `Connect another Gmail`.
2. **Server-Side Redirect**: Initiates Google OAuth consent screen with requested scopes:
   - `gmail.readonly`: Read and analyze incoming message context
   - `gmail.send`: Dispatch AI-drafted automated replies upon trigger
   - `gmail.modify`: Manage threads and tags
3. **Secure Callback**:
   - The OAuth code is exchanged for tokens **strictly on the backend**.
   - Tokens (access & refresh tokens) are encrypted at rest with AES-256-GCM.
   - Refresh tokens are **never** exposed to the browser or stored in `localStorage`.
4. **Initial Sync Pipeline**:
   - Backend registers webhooks (Google Cloud Pub/Sub) for real-time push notifications.
   - Kicks off background worker to index existing mailbox history with progressive progress updates.

---

## 4. Routing Architecture

- `/dashboard/integrations`: Main ecosystem overview, active integrations hero, connected accounts list, and upcoming tools catalog.
- `/dashboard/integrations/gmail/[id]`: Deep-linkable management screen for a specific connected Gmail mailbox (scopes, health, sync controls, disconnection).
- Future routes:
  - `/dashboard/integrations/outlook/[id]`
  - `/dashboard/integrations/imap/[id]`

---

## 5. Extensibility: Adding Future Providers

When Outlook or CRMs graduate from "Coming soon" to "Available":
1. Add provider type to `IntegrationProvider`.
2. Implement provider-specific token exchange adapter on the backend.
3. The frontend `ConnectedAccountsSection` automatically accommodates any provider adhering to `ConnectedIntegrationAccount`.
