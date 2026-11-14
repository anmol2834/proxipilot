# Inbox Architecture

## 1. Overview
The ProxiPilot Inbox is an AI-first communication workspace designed for high-velocity conversation management, lead intent triage, and response automation. It departs from traditional webmail clients (e.g. Gmail/Outlook) by eliminating mailbox folder taxonomy, draft managers, and categorization tabs, focusing instead on **conversation state, customer signals, and immediate actionability**.

---

## 2. Core Entities

```text
Organization
  └── ConnectedIntegrationAccounts (e.g. support@acme.com, sales@acme.com)
        └── Conversations (Unified multi-mailbox aggregation)
              ├── Messages (Thread timeline)
              └── AISummary (Intent, key points, confidence)
```

### 2.1 Conversation Entity
```typescript
interface Conversation {
  id: string;
  organizationId: string;
  integrationAccountId: string;
  provider: "gmail" | "outlook" | "imap";
  threadId: string;
  sender: {
    name: string;
    email: string;
    initials: string;
    avatarBg: string;
    avatarColor: string;
  };
  subject: string;
  snippet: string;
  latestMessageAt: string;
  leadTemperature: "hot" | "warm" | "cold" | null;
  starred: boolean;
  unread: boolean;
  aiSummary: {
    intent: string;
    bulletPoints: string[];
    confidence?: number;
  };
}
```

---

## 3. Server / Client Separation
- **Server Responsibilities**: Session authentication, organization tenant verification, secure provider synchronization via Google Cloud Pub/Sub webhooks, and AI summarization pipelines.
- **Client Responsibilities**: 2-pane responsive layout, cursor-based infinite list scrolling, reverse message pagination, optimistic starring/lead triage, and keyboard shortcuts (`J`/`K`/`S`).

---

## 4. Multi-Mailbox Aggregation
Conversations are unified across all connected mailboxes for an organization while preserving `integrationAccountId` and provider metadata. Future filtering can slice by mailbox without altering the core conversation schema.
