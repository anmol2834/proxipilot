# Gmail Mailbox Synchronization Architecture

## 1. Concurrency Control: Distributed Lock
Multiple parallel workers must never process the same mailbox cursor concurrently. 
- **Lock Key**: `gmail:sync:{integration_account_id}`
- **TTL**: 90 seconds (with safe renewal if long operations occur)
- **Token**: UUIDv4 ownership token stored in value
- **Safe Release**: Atomic Lua script comparing stored token before key deletion:
  ```lua
  if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
  else
      return 0
  end
  ```

## 2. Incremental Sync vs. Full Sync Fallback
1. **Incremental Sync (`history.list`)**:
   - Worker queries `users.history.list` starting at `SyncCursor.cursor_value` (`startHistoryId`).
   - Handles pagination via `nextPageToken`.
   - Collects all modified message IDs (`messagesAdded`, `labelsAdded`, etc.).
   - Ingests changed messages into `email_threads` and `email_messages`.
   - Advances cursor transactionally.
2. **HTTP 404 Cursor Expiration Fallback**:
   - If Google history has expired (~7-14 days or after platform downtime), `history.list` raises `GmailHistoryExpiredException` (HTTP 404).
   - The engine catches this error, does NOT mark the account as broken, and automatically invokes `execute_full_sync()`.
   - Obtains fresh `historyId` from `users.getProfile()`, ingests recent mailbox threads, and updates `SyncCursor` atomically.
