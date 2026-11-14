# ProxiPilot Backend Architecture

```text
                               ┌──────────────────────┐
                               │   Next.js Frontend   │
                               │   Mobile / Webhook   │
                               └──────────┬───────────┘
                                          │ HTTPS
                               ┌──────────▼───────────┐
                               │   Cloudflare CDN/WAF │
                               └──────────┬───────────┘
                                          │
                               ┌──────────▼───────────┐
                               │  FastAPI API Gateway │ (Stateless, Connection-Pooled)
                               └─────┬──────────┬─────┘
                     DB Writes / Reads│          │ Stream Publish
                                     │          │
                 ┌───────────────────┘          └───────────────────┐
                 ▼                                                  ▼
      ┌────────────────────┐                             ┌────────────────────┐
      │ Neon PostgreSQL    │                             │ Upstash Redis      │
      │ (Authoritative DB) │                             │ (Cache + Streams)  │
      └────────────────────┘                             └─────────┬──────────┘
                                                                   │
                                              Consumer Groups      │
                                    ┌──────────────────────────────┼──────────────────────────────┐
                                    ▼                              ▼                              ▼
                             ┌──────────────┐               ┌──────────────┐               ┌──────────────┐
                             │  AI Worker   │               │ Email Worker │               │  Automation  │
                             │   (RAG/LLM)  │               │ (Send/Sync)  │               │    Worker    │
                             └──────┬───────┘               └──────┬───────┘               └──────────────┘
                                    │                              │
                          ┌─────────┴─────────┐                    ▼
                          ▼                   ▼            Gmail / Graph API
                   Qdrant Vector DB     OpenAI API
```

---

## 1. Architectural Philosophy: Modular Monolith First

ProxiPilot rejects premature microservices. The backend is organized as a **modular monolith** with independently runnable background workers:
- **Shared Domain Modules**: Single codebase, shared models, utilities, and typed config.
- **Independently Scalable Run Times**: The API Gateway, AI Workers, Email Workers, and Automation Workers can scale from 1 process on a single VM up to hundreds of distributed container instances depending on queue depth.
- **Minimal Latency**: Zero internal RPC or network hops for simple CRUD; event-driven streams for heavy asynchronous workflows.

---

## 2. Core Execution Paths

### Path A: Asynchronous Email Ingestion & Processing
1. **Webhook Reception**: Gmail/Outlook webhook hits FastAPI `/api/v1/email/webhook`.
2. **Lightweight Validation & Persistence**: Webhook is verified, message ID deduplicated, and an immutable event is published to `proxipilot:stream:email_events`. Endpoint returns `HTTP 200 OK` in <50ms.
3. **Email Worker**: Consumes the event, resolves mailbox credentials, extracts raw content, and publishes `ai_processing` event.
4. **AI Worker**:
   - Classifies intent via fast-path classifier.
   - Executes search plan against Qdrant (enforcing `tenant_id` filter) and Neon PostgreSQL for live customer data.
   - Gathers evidence and evaluates confidence.
   - Generates response via OpenAI (`gpt-4o-mini`).
   - Validates response (no hallucinations, no unsupported claims, no duplicate reply).
   - Publishes `email_send` event.
5. **Outbound Send**: Email worker dispatches via provider API with bounded exponential backoff and idempotency keys.

### Path B: Synchronous Dashboard & CRUD Operations
1. Client requests data via authenticated session cookie.
2. FastAPI middleware validates session and resolves authenticated user.
3. Target tenant is resolved and active membership verified (`get_tenant_context`).
4. Service checks Redis L2 cache (`tenant:{organization_id}:{namespace}:{key}`).
5. On cache miss, executes indexed query against Neon PostgreSQL via `asyncpg`.
6. Returns typed response envelope with `x-request-id` and `x-response-time-ms`.

### Path C: Onboarding & Tenant Resolution Flow
1. **Authentication**: User logs in or registers; session cookie set.
2. **Server-Authoritative State Check**: Client calls `GET /api/v1/onboarding/state`.
3. **State Derivation**: `OnboardingService` evaluates user verification, organization membership, business profile, and workspace preferences.
4. **Resumable Navigation**: If incomplete, user is guided to `next_route`; once complete, redirected directly to `/dashboard`.
5. **Tenant Scoping Guard**: Organization-level operations (Business Profile, Preferences) strictly enforce tenant membership and invalidate Redis cache keys on change.

