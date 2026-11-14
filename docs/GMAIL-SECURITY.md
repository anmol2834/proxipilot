# Gmail Security Architecture & Threat Model

## 1. Cryptographic Standard: AES-256-GCM
All OAuth access tokens and refresh tokens stored in `connected_integration_accounts` are encrypted with authenticated AES-256-GCM:
- **12-byte random Initialization Vector (IV)** per encryption operation.
- **16-byte authentication tag** ensuring ciphertext integrity and authenticity.
- **Envelope Storage**: `iv:auth_tag:ciphertext` (Base64 encoded).

## 2. Threat Model & Mitigations
| Threat Vector | Severity | Mitigation Implemented |
|---|---|---|
| **OAuth CSRF / State Tampering** | High | Cryptographically random, single-use, Redis-stored state token with 600s TTL. Validated and deleted atomically on callback. |
| **Cross-Tenant IDOR** | Critical | Strict organization scoping. All integration queries and actions filter by `tenant_id == current_user.organization_id`. Verified by automated multi-tenant test suite. |
| **Token Leakage to Frontend** | Critical | Zero tokens returned in any API response or stored in frontend state (no localStorage, Zustand, cookies, or URLs). |
| **Webhook Spoofing** | High | Google Cloud Pub/Sub push requests validated via Google JWT Bearer tokens and audience matching `GMAIL_PUBSUB_PUSH_AUDIENCE`. |
| **Pub/Sub Replay / Duplication** | Medium | Dual-layer idempotency: Fast-path Redis key (`SETNX`) + PostgreSQL unique constraint `provider_events(provider, provider_event_id)`. |
| **Rate Limit Hammering (429)** | Medium | Exponential backoff with jitter on 429/5xx status codes; circuit breaker pauses requests if quota exhausted. |
