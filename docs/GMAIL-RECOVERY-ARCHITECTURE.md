# Gmail 30-Day Platform Downtime & Self-Healing Recovery

## 1. The Core Enterprise Invariant
A user must **NEVER** be prompted to manually reconnect Gmail simply because:
- The server, worker, or Kubernetes cluster restarted.
- Redis or RabbitMQ restarted.
- The platform was completely offline for 30 consecutive days.
- The 7-day Gmail `watch()` registration naturally expired during downtime.

The only acceptable reason for user intervention (`REAUTH_REQUIRED`) is if the user or Google admin explicitly revoked OAuth access tokens on Google's security dashboard.

## 2. 30-Day Downtime Recovery Workflow
```
Platform Returns Online (Startup Reconciliation)
                     │
                     ▼
1. Query All Accounts with Expired Watches or Missing Watch Expiration
   (SELECT ... WHERE watch_expires_at <= NOW() OR watch_expires_at IS NULL)
                     │
                     ▼
2. Proactive OAuth Token Refresh
   - Decrypt stored refresh token with AES-256-GCM.
   - Exchange refresh token for fresh access token at Google OAuth endpoint.
   - Persist updated access token securely.
                     │
                     ▼
3. Recreate Gmail Watch Registration
   - Call gmail.users.watch() with target Pub/Sub topic.
   - Store fresh 7-day expiration timestamp in SyncCursor.
                     │
                     ▼
4. Attempt Incremental Sync from Stored Cursor
   - Call users.history.list(startHistoryId=stored_cursor)
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
   Cursor Valid              Cursor Expired (HTTP 404)
(Downtime < 7 days)         (Downtime >= 7-30 days)
        │                         │
   Process Delta             Trigger Full Sync Fallback
   Advance Cursor            - Call users.getProfile() for fresh historyId
        │                    - Ingest recent messages
        │                    - Atomically update cursor
        └────────────┬────────────┘
                     │
                     ▼
5. Restore Account to HEALTHY & Emit Audit Event
   - Status = CONNECTED
   - Health = HEALTHY
   - Zero User Manual Reconnect Required!
```
