# ProxiPilot Backend V1 — Canonical Data Contracts

## 1. Data Contract Standards
- **Primary Keys**: UUID v4 formatted as string (`uuid_generate_v4()` in PostgreSQL).
- **Timezone**: All timestamps are UTC `TIMESTAMPTZ` (`DateTime(timezone=True)`).
- **Naming Conventions**: `snake_case` for columns and tables, `camelCase` in JSON API responses.
- **Tenant Scoping**: All tenant-owned tables must include `organization_id VARCHAR(64) NOT NULL INDEXED`.

---

## 2. Core Entities

### 2.1 Organization (`organizations`)
- **Purpose**: Root isolation boundary for multi-tenancy.
- **Ownership**: Platform.
- **Fields**:
  - `id`: `VARCHAR(64)` PK
  - `name`: `VARCHAR(255)` NOT NULL
  - `slug`: `VARCHAR(128)` NOT NULL UNIQUE
  - `plan`: `VARCHAR(64)` NOT NULL DEFAULT `'free'`
  - `status`: `VARCHAR(32)` NOT NULL DEFAULT `'active'` (active, suspended, archived)
  - `settings`: `JSONB` NOT NULL DEFAULT `'{}'`
  - `created_at`: `TIMESTAMPTZ` NOT NULL
  - `updated_at`: `TIMESTAMPTZ` NOT NULL
- **Deletion Policy**: Soft delete via status `'archived'`; 90-day purge retention.

### 2.2 User (`users`)
- **Purpose**: Global user identity across organizations.
- **Ownership**: Auth module.
- **Fields**:
  - `id`: `VARCHAR(64)` PK
  - `email`: `VARCHAR(255)` NOT NULL UNIQUE INDEX
  - `full_name`: `VARCHAR(255)` NOT NULL
  - `avatar_url`: `VARCHAR(512)` NULL
  - `is_active`: `BOOLEAN` NOT NULL DEFAULT `true`
  - `is_superadmin`: `BOOLEAN` NOT NULL DEFAULT `false`
  - `created_at`: `TIMESTAMPTZ` NOT NULL
  - `updated_at`: `TIMESTAMPTZ` NOT NULL
- **Deletion Policy**: Soft delete; PII anonymization upon request.

### 2.3 Organization Membership (`organization_memberships`)
- **Purpose**: N:M relationship between Users and Organizations.
- **Ownership**: Organization module.
- **Fields**:
  - `id`: `VARCHAR(64)` PK
  - `organization_id`: `VARCHAR(64)` NOT NULL FK(`organizations.id` ON DELETE CASCADE)
  - `user_id`: `VARCHAR(64)` NOT NULL FK(`users.id` ON DELETE CASCADE)
  - `role`: `VARCHAR(32)` NOT NULL DEFAULT `'member'` (owner, admin, member, viewer)
  - `status`: `VARCHAR(32)` NOT NULL DEFAULT `'active'` (active, invited, suspended)
  - `created_at`: `TIMESTAMPTZ` NOT NULL
  - `updated_at`: `TIMESTAMPTZ` NOT NULL
- **Constraints**: `UNIQUE(organization_id, user_id)`

### 2.4 Connected Integration Account (`connected_integration_accounts`)
- **Purpose**: Mailbox connector entity supporting multiple Gmail/Outlook accounts per organization.
- **Ownership**: Integrations module.
- **Fields**:
  - `id`: `VARCHAR(64)` PK
  - `organization_id`: `VARCHAR(64)` NOT NULL FK(`organizations.id` ON DELETE CASCADE)
  - `provider`: `VARCHAR(32)` NOT NULL (gmail, outlook, imap)
  - `provider_account_id`: `VARCHAR(255)` NOT NULL
  - `email_address`: `VARCHAR(255)` NOT NULL
  - `display_name`: `VARCHAR(255)` NULL
  - `status`: `VARCHAR(32)` NOT NULL DEFAULT `'connected'` (connected, syncing, healthy, needs_attention, disconnected, error)
  - `scopes`: `JSONB` NOT NULL DEFAULT `'[]'`
  - `sync_cursor`: `VARCHAR(255)` NULL
  - `last_synced_at`: `TIMESTAMPTZ` NULL
  - `connected_by_user_id`: `VARCHAR(64)` NOT NULL FK(`users.id`)
  - `created_at`: `TIMESTAMPTZ` NOT NULL
  - `updated_at`: `TIMESTAMPTZ` NOT NULL
- **Constraints**: `UNIQUE(organization_id, provider, provider_account_id)`
- **Indexes**: `(organization_id, status)`

### 2.5 Email Thread (`email_threads`)
- **Purpose**: Aggregate root for email conversations.
- **Ownership**: Inbox module.
- **Fields**:
  - `id`: `VARCHAR(64)` PK
  - `organization_id`: `VARCHAR(64)` NOT NULL FK(`organizations.id` ON DELETE CASCADE)
  - `integration_account_id`: `VARCHAR(64)` NOT NULL FK(`connected_integration_accounts.id` ON DELETE CASCADE)
  - `provider_thread_id`: `VARCHAR(255)` NOT NULL
  - `subject`: `VARCHAR(512)` NOT NULL
  - `snippet`: `TEXT` NOT NULL
  - `participant_emails`: `JSONB` NOT NULL DEFAULT `'[]'`
  - `latest_message_at`: `TIMESTAMPTZ` NOT NULL INDEX
  - `unread`: `BOOLEAN` NOT NULL DEFAULT `true`
  - `starred`: `BOOLEAN` NOT NULL DEFAULT `false`
  - `lead_temperature`: `VARCHAR(16)` NULL (hot, warm, cold)
  - `created_at`: `TIMESTAMPTZ` NOT NULL
  - `updated_at`: `TIMESTAMPTZ` NOT NULL
- **Indexes**: `(organization_id, latest_message_at DESC)`, `(organization_id, lead_temperature)`, `(organization_id, starred)`
- **Constraints**: `UNIQUE(integration_account_id, provider_thread_id)`

### 2.6 Email Message (`email_messages`)
- **Purpose**: Individual email message entity in a thread.
- **Ownership**: Inbox module.
- **Fields**:
  - `id`: `VARCHAR(64)` PK
  - `organization_id`: `VARCHAR(64)` NOT NULL FK(`organizations.id` ON DELETE CASCADE)
  - `thread_id`: `VARCHAR(64)` NOT NULL FK(`email_threads.id` ON DELETE CASCADE)
  - `integration_account_id`: `VARCHAR(64)` NOT NULL FK(`connected_integration_accounts.id`)
  - `provider_message_id`: `VARCHAR(255)` NOT NULL
  - `sender`: `JSONB` NOT NULL (name, email)
  - `recipients`: `JSONB` NOT NULL DEFAULT `'[]'`
  - `cc`: `JSONB` NOT NULL DEFAULT `'[]'`
  - `bcc`: `JSONB` NOT NULL DEFAULT `'[]'`
  - `subject`: `VARCHAR(512)` NOT NULL
  - `body_text`: `TEXT` NOT NULL
  - `body_html`: `TEXT` NULL
  - `direction`: `VARCHAR(16)` NOT NULL (inbound, outbound)
  - `sent_at`: `TIMESTAMPTZ` NOT NULL INDEX
  - `created_at`: `TIMESTAMPTZ` NOT NULL
  - `updated_at`: `TIMESTAMPTZ` NOT NULL
- **Constraints**: `UNIQUE(integration_account_id, provider_message_id)`
- **Indexes**: `(organization_id, thread_id, sent_at ASC)`

### 2.7 Knowledge Item (`knowledge_items`)
- **Purpose**: Stable conceptual container for business knowledge.
- **Ownership**: Knowledge module.
- **Categories**:
  - `company_info`, `products_services` (includes pricing), `contacts`, `policies`, `support_faqs`, `offers_promotions`, `operations`, `locations`, `brand_communication`.
- **Fields**:
  - `id`: `VARCHAR(64)` PK
  - `organization_id`: `VARCHAR(64)` NOT NULL FK(`organizations.id` ON DELETE CASCADE)
  - `category`: `VARCHAR(64)` NOT NULL INDEX
  - `title`: `VARCHAR(255)` NOT NULL
  - `current_version_id`: `VARCHAR(64)` NULL
  - `status`: `VARCHAR(32)` NOT NULL DEFAULT `'published'`
  - `created_at`: `TIMESTAMPTZ` NOT NULL
  - `updated_at`: `TIMESTAMPTZ` NOT NULL
- **Indexes**: `(organization_id, category)`

### 2.8 Knowledge Version (`knowledge_versions`)
- **Purpose**: Immutable revision of a knowledge item.
- **Ownership**: Knowledge module.
- **Fields**:
  - `id`: `VARCHAR(64)` PK
  - `knowledge_item_id`: `VARCHAR(64)` NOT NULL FK(`knowledge_items.id` ON DELETE CASCADE)
  - `organization_id`: `VARCHAR(64)` NOT NULL FK(`organizations.id` ON DELETE CASCADE)
  - `version_number`: `INTEGER` NOT NULL
  - `status`: `VARCHAR(32)` NOT NULL (draft, processing, published, archived, needs_review)
  - `content`: `TEXT` NOT NULL
  - `structured_data`: `JSONB` NOT NULL DEFAULT `'{}'`
  - `effective_from`: `TIMESTAMPTZ` NOT NULL DEFAULT NOW()
  - `effective_until`: `TIMESTAMPTZ` NULL
  - `source_type`: `VARCHAR(64)` NOT NULL (manual, document, website, integration)
  - `authority_score`: `FLOAT` NOT NULL DEFAULT `1.0`
  - `created_by_user_id`: `VARCHAR(64)` NOT NULL FK(`users.id`)
  - `created_at`: `TIMESTAMPTZ` NOT NULL
  - `updated_at`: `TIMESTAMPTZ` NOT NULL
- **Constraints**: `UNIQUE(knowledge_item_id, version_number)`
- **Indexes**: `(organization_id, status, effective_from, effective_until)`

### 2.9 Business Entity (`business_entities`)
- **Purpose**: Authoritative structured business records (Products, Services, Policies, Locations).
- **Ownership**: Knowledge module.
- **Fields**:
  - `id`: `VARCHAR(64)` PK
  - `organization_id`: `VARCHAR(64)` NOT NULL FK(`organizations.id` ON DELETE CASCADE)
  - `entity_type`: `VARCHAR(64)` NOT NULL (product, service, contact, location, offer)
  - `name`: `VARCHAR(255)` NOT NULL
  - `status`: `VARCHAR(32)` NOT NULL DEFAULT `'active'`
  - `attributes`: `JSONB` NOT NULL DEFAULT `'{}'`
  - `version`: `INTEGER` NOT NULL DEFAULT `1`
  - `created_at`: `TIMESTAMPTZ` NOT NULL
  - `updated_at`: `TIMESTAMPTZ` NOT NULL
- **Indexes**: `(organization_id, entity_type)`

### 2.10 AI Run (`ai_runs`)
- **Purpose**: Full traceability record of an AI execution.
- **Ownership**: AI module.
- **Fields**:
  - `id`: `VARCHAR(64)` PK
  - `organization_id`: `VARCHAR(64)` NOT NULL FK(`organizations.id` ON DELETE CASCADE)
  - `thread_id`: `VARCHAR(64)` NOT NULL FK(`email_threads.id`)
  - `message_id`: `VARCHAR(64)` NOT NULL FK(`email_messages.id`)
  - `run_type`: `VARCHAR(64)` NOT NULL (intent_extraction, requirement_planning, draft_synthesis)
  - `model`: `VARCHAR(64)` NOT NULL
  - `model_version`: `VARCHAR(64)` NOT NULL
  - `status`: `VARCHAR(32)` NOT NULL (started, completed, failed)
  - `latency_ms`: `INTEGER` NULL
  - `input_tokens`: `INTEGER` NULL
  - `output_tokens`: `INTEGER` NULL
  - `error_message`: `TEXT` NULL
  - `created_at`: `TIMESTAMPTZ` NOT NULL
- **Indexes**: `(organization_id, thread_id, created_at DESC)`

### 2.11 Evidence Record (`evidence_records`)
- **Purpose**: Fact attribution explaining why the AI is permitted to state a claim.
- **Ownership**: AI module.
- **Fields**:
  - `id`: `VARCHAR(64)` PK
  - `organization_id`: `VARCHAR(64)` NOT NULL FK(`organizations.id` ON DELETE CASCADE)
  - `ai_run_id`: `VARCHAR(64)` NOT NULL FK(`ai_runs.id` ON DELETE CASCADE)
  - `requirement_key`: `VARCHAR(128)` NOT NULL
  - `source_type`: `VARCHAR(64)` NOT NULL (structured_entity, knowledge_version, live_api)
  - `source_id`: `VARCHAR(64)` NOT NULL
  - `content_snippet`: `TEXT` NOT NULL
  - `authority_score`: `FLOAT` NOT NULL
  - `relevance_score`: `FLOAT` NOT NULL
  - `created_at`: `TIMESTAMPTZ` NOT NULL
- **Indexes**: `(organization_id, ai_run_id)`

### 2.12 AI Response (`ai_responses`)
- **Purpose**: Synthesized email response text prior to delivery.
- **Ownership**: AI module.
- **Fields**:
  - `id`: `VARCHAR(64)` PK
  - `organization_id`: `VARCHAR(64)` NOT NULL FK(`organizations.id` ON DELETE CASCADE)
  - `thread_id`: `VARCHAR(64)` NOT NULL FK(`email_threads.id`)
  - `ai_run_id`: `VARCHAR(64)` NOT NULL FK(`ai_runs.id`)
  - `response_text`: `TEXT` NOT NULL
  - `confidence_score`: `FLOAT` NOT NULL
  - `status`: `VARCHAR(32)` NOT NULL DEFAULT `'draft'` (draft, approved, flagged_for_review, rejected)
  - `validation_feedback`: `JSONB` NULL
  - `created_at`: `TIMESTAMPTZ` NOT NULL
- **Indexes**: `(organization_id, thread_id)`

### 2.13 Outbound Message (`outbound_messages`)
- **Purpose**: Delivery attempt record for email dispatch.
- **Ownership**: Outbound module.
- **Fields**:
  - `id`: `VARCHAR(64)` PK
  - `organization_id`: `VARCHAR(64)` NOT NULL FK(`organizations.id` ON DELETE CASCADE)
  - `thread_id`: `VARCHAR(64)` NOT NULL FK(`email_threads.id`)
  - `integration_account_id`: `VARCHAR(64)` NOT NULL FK(`connected_integration_accounts.id`)
  - `idempotency_key`: `VARCHAR(255)` NOT NULL UNIQUE
  - `provider_message_id`: `VARCHAR(255)` NULL
  - `status`: `VARCHAR(32)` NOT NULL DEFAULT `'pending'` (pending, sending, sent, failed)
  - `attempt_count`: `INTEGER` NOT NULL DEFAULT `0`
  - `last_attempt_at`: `TIMESTAMPTZ` NULL
  - `error_details`: `JSONB` NULL
  - `created_at`: `TIMESTAMPTZ` NOT NULL
- **Indexes**: `(organization_id, status, created_at)`

### 2.14 Human Review (`human_reviews`)
- **Purpose**: Human-in-the-loop triage task.
- **Ownership**: Review module.
- **Fields**:
  - `id`: `VARCHAR(64)` PK
  - `organization_id`: `VARCHAR(64)` NOT NULL FK(`organizations.id` ON DELETE CASCADE)
  - `thread_id`: `VARCHAR(64)` NOT NULL FK(`email_threads.id`)
  - `ai_run_id`: `VARCHAR(64)` NULL FK(`ai_runs.id`)
  - `reason`: `VARCHAR(64)` NOT NULL (low_confidence, missing_evidence, policy_exception, sensitive_request, human_requested)
  - `priority`: `VARCHAR(16)` NOT NULL DEFAULT `'medium'` (low, medium, high, urgent)
  - `status`: `VARCHAR(32)` NOT NULL DEFAULT `'pending'` (pending, assigned, resolved, dismissed)
  - `assigned_to_user_id`: `VARCHAR(64)` NULL FK(`users.id`)
  - `resolution_notes`: `TEXT` NULL
  - `resolved_at`: `TIMESTAMPTZ` NULL
  - `created_at`: `TIMESTAMPTZ` NOT NULL
- **Indexes**: `(organization_id, status, priority)`

### 2.15 Business Profile (`business_profiles`)
- **Purpose**: Operational grounding facts for an organization's products, services, and industry.
- **Ownership**: Organization module / Tenant root.
- **Fields**:
  - `id`: `VARCHAR(36)` PK (UUIDv7)
  - `organization_id`: `VARCHAR(36)` NOT NULL UNIQUE FK(`organizations.id` ON DELETE CASCADE)
  - `description`: `TEXT` NOT NULL
  - `industry`: `VARCHAR(100)` NOT NULL
  - `customer_type`: `VARCHAR(50)` NULL
  - `main_products_services`: `TEXT` NOT NULL
  - `additional_context`: `TEXT` NULL
  - `created_at`: `TIMESTAMPTZ` NOT NULL
  - `updated_at`: `TIMESTAMPTZ` NOT NULL
- **Indexes**: `UNIQUE(organization_id)`

### 2.16 Workspace Preferences (`workspace_preferences`)
- **Purpose**: Organization-wide operational defaults including timezone, brand response style, and language.
- **Ownership**: Organization module / Tenant root.
- **Fields**:
  - `id`: `VARCHAR(36)` PK (UUIDv7)
  - `organization_id`: `VARCHAR(36)` NOT NULL UNIQUE FK(`organizations.id` ON DELETE CASCADE)
  - `timezone`: `VARCHAR(64)` NOT NULL DEFAULT `'Asia/Kolkata (GMT +5:30)'`
  - `response_style`: `VARCHAR(64)` NOT NULL DEFAULT `'Professional'`
  - `language`: `VARCHAR(32)` NOT NULL DEFAULT `'English'`
  - `created_at`: `TIMESTAMPTZ` NOT NULL
  - `updated_at`: `TIMESTAMPTZ` NOT NULL
- **Indexes**: `UNIQUE(organization_id)`
