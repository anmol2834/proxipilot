# ADR-010: Organization-Scoped Multi-Mailbox Integration Model

## Status
Accepted (Phase 0 Architecture Freeze)

## Context
Organizations frequently operate multiple operational mailboxes (e.g. `support@acme.com`, `sales@acme.com`, `billing@acme.com`). The backend integration model must avoid naive 1:1 user or organization-to-mailbox assumptions.

## Decision
Mailbox connections are modeled as `ConnectedIntegrationAccount` entities belonging to an `organization_id`.
An organization can connect $1..N$ integration accounts across Gmail and future providers (Outlook, IMAP). Every email thread and message records `integration_account_id` to maintain strict source provenance.

## Consequences
- **Positive**: Support for multi-department organizations, clean lifecycle management per mailbox, decoupled from individual user credentials.
- **Negative**: Queries aggregating all organization mailboxes must handle multi-account cursor streams.
