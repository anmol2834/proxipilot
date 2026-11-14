# Gmail Subsystem Operations & Runbook

## 1. Environment Configuration Reference
| Variable | Description | Default |
|---|---|---|
| `GOOGLE_GMAIL_CLIENT_ID` | OAuth 2.0 Client ID from Google Cloud Console | Required |
| `GOOGLE_GMAIL_CLIENT_SECRET` | OAuth 2.0 Client Secret | Required |
| `GOOGLE_GMAIL_REDIRECT_URI` | Full OAuth callback redirect URL | `http://localhost:8000/api/v1/integrations/gmail/oauth/callback` |
| `GMAIL_PUBSUB_TOPIC` | Full Cloud Pub/Sub topic path | `projects/<project-id>/topics/gmail-events` |
| `GMAIL_PUBSUB_PUSH_AUDIENCE` | Expected JWT audience for push webhook | Configured audience |
| `GMAIL_WATCH_RENEWAL_DAYS` | Proactive renewal window in days before expiration | `2` |
| `GMAIL_HISTORY_PAGE_SIZE` | Page size for `users.history.list` queries | `100` |
| `GMAIL_SYNC_WORKERS` | Parallel worker pool concurrency | `4` |

## 2. Health Monitoring & Observability
- Endpoint: `GET /api/v1/integrations/gmail/{id}/health`
- Returns:
  - `status`: `CONNECTED`, `SYNCING`, `DEGRADED`, `REAUTH_REQUIRED`, `DISCONNECTED`
  - `connection_status`: `HEALTHY`, `SYNCING`, `DEGRADED`, `REAUTH_REQUIRED`, `DISCONNECTED`
  - `last_synced_at`: ISO timestamp
  - `last_error_code`: Error classification string
  - `sync_cursor`: `cursor_value`, `watch_expires_at`, `sync_state`

## 3. Operational Runbooks
### 3.1 Worker or Redis Crash Recovery
Run the recovery service or restart worker:
```bash
python -m app.workers.email_worker
```
The startup sequence automatically executes `GmailRecoveryService.reconcile_all_accounts()`, clearing stuck locks, renewing expiring watches, and resuming ingestion from PostgreSQL state.

### 3.2 Forcing Manual Mailbox Resynchronization
If an operator needs to manually re-sync an account:
```bash
POST /api/v1/integrations/gmail/{integration_id}/sync
```
This queues a fresh background sync job without touching watch registrations or requiring user reauthorization.
