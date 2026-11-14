# Gmail Server-Side OAuth 2.0 Architecture

## 1. Flow Diagram
```
Frontend (Next.js)                 API Gateway / Backend               Google OAuth 2.0
      │                                      │                                 │
      │── 1. GET /integrations/gmail/connect ─►│                                 │
      │                                      │── 2. Gen Random State & Nonce ──┤
      │                                      │── 3. Store State in Redis (TTL) ─┤
      │◄── 4. Return Google Auth URL ────────│                                 │
      │                                                                        │
      │── 5. Redirect User to Google Consent Screen ──────────────────────────►│
      │                                                                        │
      │◄── 6. Callback with ?code=...&state=... ────────────────────────────────┤
      │                                                                        │
      │── 7. GET /integrations/gmail/oauth/callback?code=...&state=... ───────►│
      │                                      │                                 │
      │                                      │── 8. Validate & Delete State ───┤ (Single-use)
      │                                      │── 9. Exchange Code for Tokens ─►│
      │                                      │◄── 10. Access & Refresh Tokens ─┤
      │                                      │                                 │
      │                                      │── 11. AES-256-GCM Encrypt ──────┤
      │                                      │── 12. Upsert Account in DB ─────┤
      │                                      │── 13. Register users.watch() ──►│
      │                                      │── 14. Queue Initial Full Sync ──┤
      │◄── 15. Redirect to /dashboard/integrations ────────────────────────────│
```

## 2. Security Guarantees
1. **Single-Use State**:
   - Stored in Redis with prefix `oauth:state:{state_token}` and a 600-second TTL.
   - Atomically retrieved and deleted (`redis.getdel` or pipeline) upon callback. Replay attempts immediately return HTTP 400.
2. **Encrypted Token Storage**:
   - Tokens are encrypted using AES-256-GCM (`app/core/crypto.py`) with 12-byte cryptographically secure random IVs before being persisted to `connected_integration_accounts`.
   - Format: `iv:auth_tag:ciphertext` (Base64).
3. **Zero Secret Leakage**:
   - API endpoints (`GET /api/v1/integrations`) return only public metadata: `id`, `provider`, `email_address`, `display_name`, `status`, `connection_status`, `last_synced_at`.
   - Client secrets, access tokens, and refresh tokens are excluded from all schemas and responses.
