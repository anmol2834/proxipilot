"""create_initial_schema_and_rbac

Revision ID: 5e277eeef470
Revises: 
Create Date: 2026-09-17 05:54:07.751958

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '5e277eeef470'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Clean up legacy tables before creating canonical domain model
    op.execute("DROP TABLE IF EXISTS user_settings CASCADE;")
    op.execute("DROP TABLE IF EXISTS es_conversations CASCADE;")
    op.execute("DROP TABLE IF EXISTS auth_store CASCADE;")
    op.execute("DROP TABLE IF EXISTS es_messages CASCADE;")
    op.execute("DROP TABLE IF EXISTS email_accounts CASCADE;")

    # 2. Modernize users table (ensure users table exists first)
    op.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(64) PRIMARY KEY,
            email VARCHAR(320) NOT NULL UNIQUE,
            hashed_password VARCHAR(128) NOT NULL DEFAULT '',
            full_name VARCHAR(255) NOT NULL DEFAULT '',
            avatar_url VARCHAR(2048),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            is_verified BOOLEAN NOT NULL DEFAULT TRUE,
            last_login_at VARCHAR(64),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """)
    op.execute("ALTER TABLE users ALTER COLUMN id TYPE VARCHAR(64) USING id::text;")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS hashed_password VARCHAR(128) DEFAULT '';")
    op.execute("DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password_hash') THEN UPDATE users SET hashed_password = password_hash WHERE hashed_password = '' AND password_hash IS NOT NULL; END IF; END $$;")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(2048);")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT TRUE;")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at VARCHAR(64);")
    op.alter_column('users', 'email',
               existing_type=sa.VARCHAR(length=255),
               type_=sa.String(length=320),
               comment='RFC 5321 max email length = 320 chars',
               existing_nullable=False)
    op.alter_column('users', 'created_at',
               existing_type=postgresql.TIMESTAMP(),
               type_=sa.DateTime(timezone=True),
               existing_nullable=False)
    op.alter_column('users', 'updated_at',
               existing_type=postgresql.TIMESTAMP(),
               type_=sa.DateTime(timezone=True),
               existing_nullable=False)
    op.execute("DROP INDEX IF EXISTS ix_users_id;")
    op.create_index(op.f('ix_users_created_at'), 'users', ['created_at'], unique=False)
    op.create_index(op.f('ix_users_is_active'), 'users', ['is_active'], unique=False)
    for col in ['profile_pic', 'industry', 'target_audience', 'communication_tone', 'use_cases', 'business_type', 'business_description', 'password_hash', 'timezone', 'business_name', 'country']:
        op.execute(f"ALTER TABLE users DROP COLUMN IF EXISTS {col};")

    # 3. Create canonical domain tables
    op.create_table('business_entities',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('entity_type', sa.String(length=64), nullable=False, comment='Structured type: product_service | team_member | office | policy | faq'),
    sa.Column('name', sa.String(length=512), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('attributes_json', sa.Text(), nullable=True, comment='JSON object of entity-type-specific attributes (e.g. price, SKU, phone)'),
    sa.Column('authority_score', sa.Float(), nullable=False, comment='Source authority weight for hybrid retrieval ranking (0.0–1.0)'),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('effective_from', sa.String(length=64), nullable=True, comment='ISO 8601 date from which this entity is valid'),
    sa.Column('effective_until', sa.String(length=64), nullable=True, comment='ISO 8601 date until which this entity is valid (null = indefinite)'),
    sa.Column('created_by_user_id', sa.String(length=64), nullable=True),
    sa.Column('tenant_id', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_business_entities_created_at'), 'business_entities', ['created_at'], unique=False)
    op.create_index(op.f('ix_business_entities_entity_type'), 'business_entities', ['entity_type'], unique=False)
    op.create_index(op.f('ix_business_entities_is_active'), 'business_entities', ['is_active'], unique=False)
    op.create_index(op.f('ix_business_entities_name'), 'business_entities', ['name'], unique=False)
    op.create_index(op.f('ix_business_entities_tenant_id'), 'business_entities', ['tenant_id'], unique=False)
    op.create_table('connected_integration_accounts',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('provider', sa.String(length=32), nullable=False, comment='Email provider: gmail | outlook | smtp'),
    sa.Column('email_address', sa.String(length=320), nullable=False, comment='The connected mailbox email address'),
    sa.Column('display_name', sa.String(length=255), nullable=True, comment='User-facing display name for this account'),
    sa.Column('access_token_encrypted', sa.Text(), nullable=True, comment='AES-256-GCM encrypted OAuth access token ciphertext'),
    sa.Column('refresh_token_encrypted', sa.Text(), nullable=True, comment='AES-256-GCM encrypted OAuth refresh token ciphertext'),
    sa.Column('token_expires_at', sa.String(length=64), nullable=True, comment='ISO 8601 UTC timestamp when access token expires'),
    sa.Column('scopes', sa.Text(), nullable=True, comment='Space-separated OAuth scopes granted'),
    sa.Column('status', sa.String(length=32), nullable=False),
    sa.Column('sync_enabled', sa.Boolean(), nullable=False),
    sa.Column('last_synced_at', sa.String(length=64), nullable=True, comment='Last successful full sync timestamp'),
    sa.Column('last_history_id', sa.String(length=128), nullable=True, comment='Gmail historyId or delta token for incremental sync'),
    sa.Column('connected_by_user_id', sa.String(length=64), nullable=True, comment='User who initiated the OAuth flow'),
    sa.Column('tenant_id', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_connected_integration_accounts_created_at'), 'connected_integration_accounts', ['created_at'], unique=False)
    op.create_index(op.f('ix_connected_integration_accounts_email_address'), 'connected_integration_accounts', ['email_address'], unique=False)
    op.create_index(op.f('ix_connected_integration_accounts_provider'), 'connected_integration_accounts', ['provider'], unique=False)
    op.create_index(op.f('ix_connected_integration_accounts_status'), 'connected_integration_accounts', ['status'], unique=False)
    op.create_index(op.f('ix_connected_integration_accounts_tenant_id'), 'connected_integration_accounts', ['tenant_id'], unique=False)
    op.create_table('knowledge_items',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('title', sa.String(length=512), nullable=False),
    sa.Column('category', sa.String(length=64), nullable=False),
    sa.Column('source_type', sa.String(length=32), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('tags', sa.Text(), nullable=True, comment='JSON array of user-defined tag strings'),
    sa.Column('current_version_id', sa.String(length=64), nullable=True, comment='FK to the active KnowledgeVersion. NULL when only drafts exist.'),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_by_user_id', sa.String(length=64), nullable=True),
    sa.Column('tenant_id', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_knowledge_items_category'), 'knowledge_items', ['category'], unique=False)
    op.create_index(op.f('ix_knowledge_items_created_at'), 'knowledge_items', ['created_at'], unique=False)
    op.create_index(op.f('ix_knowledge_items_current_version_id'), 'knowledge_items', ['current_version_id'], unique=False)
    op.create_index(op.f('ix_knowledge_items_tenant_id'), 'knowledge_items', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_knowledge_items_title'), 'knowledge_items', ['title'], unique=False)
    op.create_table('permissions',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('key', sa.String(length=128), nullable=False, comment='Stable permission key, e.g. organization.read, inbox.reply'),
    sa.Column('description', sa.String(length=255), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_permissions_created_at'), 'permissions', ['created_at'], unique=False)
    op.create_index(op.f('ix_permissions_key'), 'permissions', ['key'], unique=True)
    op.create_table('authentication_identities',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('user_id', sa.String(length=64), nullable=False),
    sa.Column('provider', sa.String(length=32), nullable=False, comment='Authentication provider: PASSWORD | GOOGLE | MICROSOFT'),
    sa.Column('provider_subject', sa.String(length=512), nullable=False, comment='Provider-stable unique identifier. For PASSWORD: user_id. For OAuth: provider sub/oid claim.'),
    sa.Column('provider_email', sa.String(length=320), nullable=True, comment='Email associated with this provider identity (for display/debugging only)'),
    sa.Column('provider_display_name', sa.String(length=255), nullable=True),
    sa.Column('provider_avatar_url', sa.String(length=2048), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('last_used_at', sa.String(length=64), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('provider', 'provider_subject', name='uq_identity_provider_subject'),
    sa.UniqueConstraint('user_id', 'provider', name='uq_identity_user_provider')
    )
    op.create_index(op.f('ix_authentication_identities_created_at'), 'authentication_identities', ['created_at'], unique=False)
    op.create_index(op.f('ix_authentication_identities_last_used_at'), 'authentication_identities', ['last_used_at'], unique=False)
    op.create_index(op.f('ix_authentication_identities_provider'), 'authentication_identities', ['provider'], unique=False)
    op.create_index(op.f('ix_authentication_identities_user_id'), 'authentication_identities', ['user_id'], unique=False)
    op.create_table('email_threads',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('integration_account_id', sa.String(length=64), nullable=False),
    sa.Column('external_thread_id', sa.String(length=512), nullable=False, comment='Provider thread ID (e.g. Gmail threadId). Used for idempotent ingestion.'),
    sa.Column('subject', sa.String(length=998), nullable=True),
    sa.Column('snippet', sa.String(length=500), nullable=True, comment='Short preview of the latest message content'),
    sa.Column('sender_email', sa.String(length=320), nullable=True),
    sa.Column('sender_name', sa.String(length=255), nullable=True),
    sa.Column('status', sa.String(length=32), nullable=False),
    sa.Column('lead_intent', sa.String(length=16), nullable=True, comment='Categorical AI lead intent: hot | warm | cold | unknown'),
    sa.Column('lead_intent_score', sa.Float(), nullable=True, comment='AI confidence score 0.0–1.0 for lead intent classification'),
    sa.Column('ai_summary', sa.Text(), nullable=True, comment='AI-generated thread summary shown in UI'),
    sa.Column('is_read', sa.Boolean(), nullable=False),
    sa.Column('is_starred', sa.Boolean(), nullable=False),
    sa.Column('message_count', sa.Integer(), nullable=False),
    sa.Column('unread_count', sa.Integer(), nullable=False),
    sa.Column('first_message_at', sa.String(length=64), nullable=True),
    sa.Column('last_message_at', sa.String(length=64), nullable=True),
    sa.Column('tenant_id', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['integration_account_id'], ['connected_integration_accounts.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_email_threads_created_at'), 'email_threads', ['created_at'], unique=False)
    op.create_index(op.f('ix_email_threads_external_thread_id'), 'email_threads', ['external_thread_id'], unique=False)
    op.create_index(op.f('ix_email_threads_integration_account_id'), 'email_threads', ['integration_account_id'], unique=False)
    op.create_index(op.f('ix_email_threads_is_read'), 'email_threads', ['is_read'], unique=False)
    op.create_index(op.f('ix_email_threads_last_message_at'), 'email_threads', ['last_message_at'], unique=False)
    op.create_index(op.f('ix_email_threads_lead_intent'), 'email_threads', ['lead_intent'], unique=False)
    op.create_index(op.f('ix_email_threads_status'), 'email_threads', ['status'], unique=False)
    op.create_index(op.f('ix_email_threads_tenant_id'), 'email_threads', ['tenant_id'], unique=False)
    op.create_table('email_verification_challenges',
    sa.Column('id', sa.String(length=64), nullable=False, comment='challenge_id returned to frontend. Used as Redis OTP key.'),
    sa.Column('user_id', sa.String(length=64), nullable=False),
    sa.Column('email', sa.String(length=320), nullable=False, comment='Email address the OTP was sent to.'),
    sa.Column('purpose', sa.String(length=32), nullable=False, comment='EMAIL_VERIFICATION | PASSWORD_RESET'),
    sa.Column('is_used', sa.Boolean(), nullable=False, comment='True after successful verification. Prevents replay.'),
    sa.Column('is_invalidated', sa.Boolean(), nullable=False, comment='True if max attempts exceeded or manually cancelled.'),
    sa.Column('attempt_count', sa.Integer(), nullable=False, comment='Number of failed verification attempts.'),
    sa.Column('resend_count', sa.Integer(), nullable=False, comment='Number of OTP resends requested.'),
    sa.Column('expires_at', sa.String(length=64), nullable=False, comment='ISO 8601 UTC expiry of the OTP.'),
    sa.Column('used_at', sa.String(length=64), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_email_verification_challenges_created_at'), 'email_verification_challenges', ['created_at'], unique=False)
    op.create_index(op.f('ix_email_verification_challenges_expires_at'), 'email_verification_challenges', ['expires_at'], unique=False)
    op.create_index(op.f('ix_email_verification_challenges_user_id'), 'email_verification_challenges', ['user_id'], unique=False)
    op.create_table('knowledge_versions',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('knowledge_item_id', sa.String(length=64), nullable=False),
    sa.Column('version_number', sa.Integer(), nullable=False, comment='Monotonically increasing per knowledge_item_id'),
    sa.Column('status', sa.String(length=32), nullable=False),
    sa.Column('content_text', sa.Text(), nullable=True, comment='Extracted plain text content for AI retrieval. Not the binary.'),
    sa.Column('storage_object_key', sa.String(length=2048), nullable=True, comment='Object storage key for the source binary (PDF/DOCX/etc.)'),
    sa.Column('source_url', sa.String(length=2048), nullable=True, comment='Origin URL if source_type=url_scrape'),
    sa.Column('original_filename', sa.String(length=512), nullable=True),
    sa.Column('mime_type', sa.String(length=128), nullable=True),
    sa.Column('size_bytes', sa.Integer(), nullable=True),
    sa.Column('vector_ids', sa.Text(), nullable=True, comment="JSON array of Qdrant point UUIDs for this version's chunk embeddings"),
    sa.Column('chunk_count', sa.Integer(), nullable=True, comment='Number of chunks this version was split into for embedding'),
    sa.Column('embedding_model', sa.String(length=128), nullable=True, comment='Model used to generate embeddings (e.g. text-embedding-3-small)'),
    sa.Column('published_at', sa.String(length=64), nullable=True),
    sa.Column('archived_at', sa.String(length=64), nullable=True),
    sa.Column('published_by_user_id', sa.String(length=64), nullable=True),
    sa.Column('processing_error', sa.Text(), nullable=True),
    sa.Column('processing_duration_ms', sa.Integer(), nullable=True),
    sa.Column('tenant_id', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['knowledge_item_id'], ['knowledge_items.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_knowledge_versions_created_at'), 'knowledge_versions', ['created_at'], unique=False)
    op.create_index(op.f('ix_knowledge_versions_knowledge_item_id'), 'knowledge_versions', ['knowledge_item_id'], unique=False)
    op.create_index(op.f('ix_knowledge_versions_status'), 'knowledge_versions', ['status'], unique=False)
    op.create_index(op.f('ix_knowledge_versions_tenant_id'), 'knowledge_versions', ['tenant_id'], unique=False)
    op.create_table('oauth_credential_metadata',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('integration_account_id', sa.String(length=64), nullable=False),
    sa.Column('provider_account_id', sa.String(length=256), nullable=True, comment='Provider-internal subject/account ID (e.g. Google sub claim)'),
    sa.Column('provider_email', sa.String(length=320), nullable=True),
    sa.Column('raw_profile_json', sa.Text(), nullable=True, comment='Full provider profile JSON stored for debugging (no tokens)'),
    sa.Column('token_refresh_count', sa.Integer(), nullable=False),
    sa.Column('last_refresh_error', sa.Text(), nullable=True),
    sa.Column('tenant_id', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['integration_account_id'], ['connected_integration_accounts.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_oauth_credential_metadata_created_at'), 'oauth_credential_metadata', ['created_at'], unique=False)
    op.create_index(op.f('ix_oauth_credential_metadata_integration_account_id'), 'oauth_credential_metadata', ['integration_account_id'], unique=True)
    op.create_index(op.f('ix_oauth_credential_metadata_tenant_id'), 'oauth_credential_metadata', ['tenant_id'], unique=False)
    op.create_table('organizations',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('slug', sa.String(length=100), nullable=False, comment='URL-safe unique identifier for the organization'),
    sa.Column('website', sa.String(length=2048), nullable=True, comment='Organization primary website URL from onboarding step 2'),
    sa.Column('industry', sa.String(length=255), nullable=True, comment='Industry category from onboarding step 2'),
    sa.Column('company_size', sa.String(length=64), nullable=True, comment='Team/Company size range from onboarding step 2'),
    sa.Column('status', sa.String(length=32), nullable=False, comment='Lifecycle status: ACTIVE | SUSPENDED | ARCHIVED'),
    sa.Column('plan_tier', sa.String(length=32), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('max_integrations', sa.Integer(), nullable=False),
    sa.Column('max_members', sa.Integer(), nullable=False),
    sa.Column('created_by', sa.String(length=64), nullable=True, comment='User ID of creator / initial owner'),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_organizations_created_at'), 'organizations', ['created_at'], unique=False)
    op.create_index(op.f('ix_organizations_created_by'), 'organizations', ['created_by'], unique=False)
    op.create_index(op.f('ix_organizations_is_active'), 'organizations', ['is_active'], unique=False)
    op.create_index(op.f('ix_organizations_plan_tier'), 'organizations', ['plan_tier'], unique=False)
    op.create_index(op.f('ix_organizations_slug'), 'organizations', ['slug'], unique=True)
    op.create_index(op.f('ix_organizations_status'), 'organizations', ['status'], unique=False)
    op.create_table('sessions',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('user_id', sa.String(length=64), nullable=False),
    sa.Column('jti', sa.String(length=128), nullable=False, comment='JWT ID embedded in access token. Used for revocation blocklisting.'),
    sa.Column('refresh_token_hash', sa.String(length=128), nullable=True, comment='SHA-256 hash of the refresh token. Used to verify refresh requests.'),
    sa.Column('user_agent', sa.String(length=512), nullable=True),
    sa.Column('ip_address', sa.String(length=64), nullable=True),
    sa.Column('expires_at', sa.String(length=64), nullable=False, comment='ISO 8601 UTC expiry. Sessions past this are automatically invalid.'),
    sa.Column('last_seen_at', sa.String(length=64), nullable=True),
    sa.Column('revoked_at', sa.String(length=64), nullable=True),
    sa.Column('revocation_reason', sa.String(length=64), nullable=True, comment='signout | token_reuse | admin | expired'),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_sessions_created_at'), 'sessions', ['created_at'], unique=False)
    op.create_index(op.f('ix_sessions_expires_at'), 'sessions', ['expires_at'], unique=False)
    op.create_index(op.f('ix_sessions_jti'), 'sessions', ['jti'], unique=True)
    op.create_index(op.f('ix_sessions_revoked_at'), 'sessions', ['revoked_at'], unique=False)
    op.create_index(op.f('ix_sessions_user_id'), 'sessions', ['user_id'], unique=False)
    op.create_table('ai_runs',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('thread_id', sa.String(length=64), nullable=False),
    sa.Column('trigger_event_id', sa.String(length=128), nullable=True, comment='DomainEvent.event_id that triggered this AI run (for correlation)'),
    sa.Column('correlation_id', sa.String(length=128), nullable=True, comment='End-to-end trace ID for distributed log correlation'),
    sa.Column('pipeline_stage', sa.String(length=64), nullable=False),
    sa.Column('status', sa.String(length=32), nullable=False),
    sa.Column('model_used', sa.String(length=128), nullable=True, comment='LLM model name (e.g. gpt-4o-mini, gpt-4o)'),
    sa.Column('embedding_model_used', sa.String(length=128), nullable=True, comment='Embedding model used for retrieval'),
    sa.Column('confidence_score', sa.Float(), nullable=True, comment='Overall pipeline confidence score 0.0–1.0'),
    sa.Column('confidence_threshold_met', sa.Boolean(), nullable=True, comment="Whether confidence_score exceeded the org's configured threshold"),
    sa.Column('prompt_tokens', sa.Integer(), nullable=True),
    sa.Column('completion_tokens', sa.Integer(), nullable=True),
    sa.Column('total_tokens', sa.Integer(), nullable=True),
    sa.Column('duration_ms', sa.Integer(), nullable=True),
    sa.Column('error_message', sa.Text(), nullable=True),
    sa.Column('error_stage', sa.String(length=64), nullable=True),
    sa.Column('started_at', sa.String(length=64), nullable=True),
    sa.Column('completed_at', sa.String(length=64), nullable=True),
    sa.Column('tenant_id', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['thread_id'], ['email_threads.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ai_runs_created_at'), 'ai_runs', ['created_at'], unique=False)
    op.create_index(op.f('ix_ai_runs_pipeline_stage'), 'ai_runs', ['pipeline_stage'], unique=False)
    op.create_index(op.f('ix_ai_runs_started_at'), 'ai_runs', ['started_at'], unique=False)
    op.create_index(op.f('ix_ai_runs_status'), 'ai_runs', ['status'], unique=False)
    op.create_index(op.f('ix_ai_runs_tenant_id'), 'ai_runs', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_ai_runs_thread_id'), 'ai_runs', ['thread_id'], unique=False)
    op.create_table('business_profiles',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('organization_id', sa.String(length=64), nullable=False, comment='One business profile per organization.'),
    sa.Column('description', sa.Text(), nullable=False, comment='What the business does. Maps to businessDescription field.'),
    sa.Column('customer_type', sa.String(length=255), nullable=True, comment='Who the business serves. Maps to customerType field.'),
    sa.Column('industry_served', sa.String(length=255), nullable=True, comment='Industry/category served. Maps to industryServed field.'),
    sa.Column('products_services', sa.Text(), nullable=False, comment='Main products or services. Maps to productsServices field.'),
    sa.Column('additional_context', sa.Text(), nullable=True, comment='Additional details. Maps to additionalDetails field.'),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_business_profiles_created_at'), 'business_profiles', ['created_at'], unique=False)
    op.create_index(op.f('ix_business_profiles_organization_id'), 'business_profiles', ['organization_id'], unique=True)
    op.create_table('email_messages',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('thread_id', sa.String(length=64), nullable=False),
    sa.Column('integration_account_id', sa.String(length=64), nullable=False),
    sa.Column('external_message_id', sa.String(length=512), nullable=False, comment='Provider message ID (e.g. Gmail messageId). Used for idempotent ingestion.'),
    sa.Column('from_email', sa.String(length=320), nullable=False),
    sa.Column('from_name', sa.String(length=255), nullable=True),
    sa.Column('to_emails', sa.Text(), nullable=True, comment='JSON array of recipient email addresses'),
    sa.Column('cc_emails', sa.Text(), nullable=True, comment='JSON array of CC email addresses'),
    sa.Column('bcc_emails', sa.Text(), nullable=True, comment='JSON array of BCC email addresses (if available)'),
    sa.Column('reply_to_email', sa.String(length=320), nullable=True),
    sa.Column('subject', sa.String(length=998), nullable=True),
    sa.Column('body_html', sa.Text(), nullable=True, comment='Full HTML body. Used for rendering.'),
    sa.Column('body_text', sa.Text(), nullable=True, comment='Plain text body. Used for AI processing (no HTML noise).'),
    sa.Column('sent_at', sa.String(length=64), nullable=True, comment='ISO 8601 UTC timestamp from email Date header'),
    sa.Column('raw_headers', sa.Text(), nullable=True, comment='JSON blob of raw email headers for debugging/compliance'),
    sa.Column('in_reply_to_external_id', sa.String(length=512), nullable=True, comment='external_message_id of the message this replies to (threading)'),
    sa.Column('tenant_id', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['integration_account_id'], ['connected_integration_accounts.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['thread_id'], ['email_threads.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_email_messages_created_at'), 'email_messages', ['created_at'], unique=False)
    op.create_index(op.f('ix_email_messages_external_message_id'), 'email_messages', ['external_message_id'], unique=False)
    op.create_index(op.f('ix_email_messages_integration_account_id'), 'email_messages', ['integration_account_id'], unique=False)
    op.create_index(op.f('ix_email_messages_sent_at'), 'email_messages', ['sent_at'], unique=False)
    op.create_index(op.f('ix_email_messages_tenant_id'), 'email_messages', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_email_messages_thread_id'), 'email_messages', ['thread_id'], unique=False)
    op.create_table('organization_onboarding_states',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('organization_id', sa.String(length=64), nullable=False, comment='One onboarding state per organization.'),
    sa.Column('user_id', sa.String(length=64), nullable=True, comment='User who initiated onboarding (org owner).'),
    sa.Column('account_complete', sa.Boolean(), nullable=False, comment='True after email verified and account created.'),
    sa.Column('organization_complete', sa.Boolean(), nullable=False, comment='True after organization step submitted.'),
    sa.Column('business_complete', sa.Boolean(), nullable=False, comment='True after business step submitted.'),
    sa.Column('workspace_complete', sa.Boolean(), nullable=False, comment='True after workspace step submitted.'),
    sa.Column('onboarding_complete', sa.Boolean(), nullable=False, comment='True when all 4 steps are complete. Required for dashboard access.'),
    sa.Column('account_completed_at', sa.String(length=64), nullable=True),
    sa.Column('organization_completed_at', sa.String(length=64), nullable=True),
    sa.Column('business_completed_at', sa.String(length=64), nullable=True),
    sa.Column('workspace_completed_at', sa.String(length=64), nullable=True),
    sa.Column('onboarding_completed_at', sa.String(length=64), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_organization_onboarding_states_created_at'), 'organization_onboarding_states', ['created_at'], unique=False)
    op.create_index(op.f('ix_organization_onboarding_states_onboarding_complete'), 'organization_onboarding_states', ['onboarding_complete'], unique=False)
    op.create_index(op.f('ix_organization_onboarding_states_organization_id'), 'organization_onboarding_states', ['organization_id'], unique=True)
    op.create_index(op.f('ix_organization_onboarding_states_user_id'), 'organization_onboarding_states', ['user_id'], unique=False)
    op.create_table('roles',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('name', sa.String(length=64), nullable=False, comment='Role name, e.g. OWNER, ADMIN, MEMBER, or custom title'),
    sa.Column('description', sa.String(length=255), nullable=True),
    sa.Column('is_system_role', sa.Boolean(), nullable=False, comment='True if built-in system role; false if custom per-tenant role'),
    sa.Column('organization_id', sa.String(length=64), nullable=True, comment='NULL for global system roles; tenant ID for custom roles'),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_roles_created_at'), 'roles', ['created_at'], unique=False)
    op.create_index(op.f('ix_roles_name'), 'roles', ['name'], unique=False)
    op.create_index(op.f('ix_roles_organization_id'), 'roles', ['organization_id'], unique=False)
    op.create_table('workspace_preferences',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('organization_id', sa.String(length=64), nullable=False, comment='One workspace preferences record per organization.'),
    sa.Column('timezone', sa.String(length=128), nullable=False, comment='Organization primary timezone. Maps to timezone field.'),
    sa.Column('default_response_style', sa.String(length=64), nullable=False, comment='Default AI response style: Professional | Friendly | Concise | Executive. Maps to responseStyle field.'),
    sa.Column('language', sa.String(length=32), nullable=False, comment='Default response language. Maps to language field.'),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_workspace_preferences_created_at'), 'workspace_preferences', ['created_at'], unique=False)
    op.create_index(op.f('ix_workspace_preferences_organization_id'), 'workspace_preferences', ['organization_id'], unique=True)
    op.create_table('ai_responses',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('ai_run_id', sa.String(length=64), nullable=False),
    sa.Column('thread_id', sa.String(length=64), nullable=False),
    sa.Column('draft_subject', sa.String(length=998), nullable=True),
    sa.Column('draft_body', sa.Text(), nullable=False, comment='Full generated response body (HTML or plain text)'),
    sa.Column('draft_body_plain', sa.Text(), nullable=True, comment='Plain text version for non-HTML email clients'),
    sa.Column('tone', sa.String(length=64), nullable=True, comment='Detected/applied tone: professional | friendly | formal | neutral'),
    sa.Column('language', sa.String(length=16), nullable=True, comment='ISO 639-1 language code of the generated response'),
    sa.Column('generation_instructions', sa.Text(), nullable=True, comment='Prompt or planning instructions used to generate this response'),
    sa.Column('policy_violations', sa.Text(), nullable=True, comment='JSON array of policy violation codes detected during validation'),
    sa.Column('has_policy_violations', sa.Boolean(), nullable=False),
    sa.Column('approval_status', sa.String(length=32), nullable=False),
    sa.Column('reviewed_by_user_id', sa.String(length=64), nullable=True),
    sa.Column('reviewed_at', sa.String(length=64), nullable=True),
    sa.Column('reviewer_notes', sa.Text(), nullable=True),
    sa.Column('tenant_id', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['ai_run_id'], ['ai_runs.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['thread_id'], ['email_threads.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ai_responses_ai_run_id'), 'ai_responses', ['ai_run_id'], unique=False)
    op.create_index(op.f('ix_ai_responses_approval_status'), 'ai_responses', ['approval_status'], unique=False)
    op.create_index(op.f('ix_ai_responses_created_at'), 'ai_responses', ['created_at'], unique=False)
    op.create_index(op.f('ix_ai_responses_has_policy_violations'), 'ai_responses', ['has_policy_violations'], unique=False)
    op.create_index(op.f('ix_ai_responses_tenant_id'), 'ai_responses', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_ai_responses_thread_id'), 'ai_responses', ['thread_id'], unique=False)
    op.create_table('attachment_metadata',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('message_id', sa.String(length=64), nullable=False),
    sa.Column('filename', sa.String(length=512), nullable=False),
    sa.Column('mime_type', sa.String(length=128), nullable=True),
    sa.Column('size_bytes', sa.Integer(), nullable=True),
    sa.Column('storage_object_key', sa.String(length=2048), nullable=True, comment='Object storage key (S3/GCS/Azure path) for binary retrieval'),
    sa.Column('is_inline', sa.Boolean(), nullable=False, comment='True if attachment is embedded inline in HTML body'),
    sa.Column('tenant_id', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['message_id'], ['email_messages.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_attachment_metadata_created_at'), 'attachment_metadata', ['created_at'], unique=False)
    op.create_index(op.f('ix_attachment_metadata_message_id'), 'attachment_metadata', ['message_id'], unique=False)
    op.create_index(op.f('ix_attachment_metadata_tenant_id'), 'attachment_metadata', ['tenant_id'], unique=False)
    op.create_table('evidence',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('ai_run_id', sa.String(length=64), nullable=False),
    sa.Column('source_type', sa.String(length=64), nullable=False, comment='Type of source retrieved (knowledge_version, business_entity, etc.)'),
    sa.Column('source_id', sa.String(length=64), nullable=False, comment='PK of the source entity (KnowledgeVersion.id, BusinessEntity.id, etc.)'),
    sa.Column('qdrant_point_id', sa.String(length=128), nullable=True, comment='Qdrant point UUID for vector-retrieved chunks'),
    sa.Column('relevance_score', sa.Float(), nullable=True, comment='Similarity / relevance score from retrieval (0.0–1.0)'),
    sa.Column('authority_score', sa.Float(), nullable=True, comment='Source authority weight from knowledge hierarchy'),
    sa.Column('excerpt', sa.Text(), nullable=True, comment='Exact text chunk fed into the AI context for this evidence'),
    sa.Column('retrieval_rank', sa.Integer(), nullable=True, comment='Rank position of this chunk in the retrieval result set'),
    sa.Column('tenant_id', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['ai_run_id'], ['ai_runs.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_evidence_ai_run_id'), 'evidence', ['ai_run_id'], unique=False)
    op.create_index(op.f('ix_evidence_created_at'), 'evidence', ['created_at'], unique=False)
    op.create_index(op.f('ix_evidence_source_type'), 'evidence', ['source_type'], unique=False)
    op.create_index(op.f('ix_evidence_tenant_id'), 'evidence', ['tenant_id'], unique=False)
    op.create_table('organization_members',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('organization_id', sa.String(length=64), nullable=False),
    sa.Column('user_id', sa.String(length=64), nullable=False),
    sa.Column('role_id', sa.String(length=64), nullable=False),
    sa.Column('status', sa.String(length=32), nullable=False, comment='ACTIVE | INVITED | SUSPENDED | REMOVED'),
    sa.Column('invited_by_user_id', sa.String(length=64), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('organization_id', 'user_id', name='uq_org_user_membership')
    )
    op.create_index('ix_org_member_lookup', 'organization_members', ['user_id', 'organization_id', 'status'], unique=False)
    op.create_index(op.f('ix_organization_members_created_at'), 'organization_members', ['created_at'], unique=False)
    op.create_index(op.f('ix_organization_members_organization_id'), 'organization_members', ['organization_id'], unique=False)
    op.create_index(op.f('ix_organization_members_role_id'), 'organization_members', ['role_id'], unique=False)
    op.create_index(op.f('ix_organization_members_status'), 'organization_members', ['status'], unique=False)
    op.create_index(op.f('ix_organization_members_user_id'), 'organization_members', ['user_id'], unique=False)
    op.create_table('role_permissions',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('role_id', sa.String(length=64), nullable=False),
    sa.Column('permission_id', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['permission_id'], ['permissions.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('role_id', 'permission_id', name='uq_role_permission')
    )
    op.create_index(op.f('ix_role_permissions_created_at'), 'role_permissions', ['created_at'], unique=False)
    op.create_index(op.f('ix_role_permissions_permission_id'), 'role_permissions', ['permission_id'], unique=False)
    op.create_index(op.f('ix_role_permissions_role_id'), 'role_permissions', ['role_id'], unique=False)
    op.create_table('human_reviews',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('ai_response_id', sa.String(length=64), nullable=False, comment='The AI-generated response draft being reviewed. One-to-one.'),
    sa.Column('thread_id', sa.String(length=64), nullable=False),
    sa.Column('ai_run_id', sa.String(length=64), nullable=True),
    sa.Column('triage_reason', sa.String(length=64), nullable=False, comment='Primary reason this review was created'),
    sa.Column('triage_context', sa.Text(), nullable=True, comment='Additional context JSON explaining the triage decision'),
    sa.Column('confidence_score_at_triage', sa.Float(), nullable=True, comment='AI confidence score at the time this review was created'),
    sa.Column('priority', sa.String(length=16), nullable=False),
    sa.Column('assigned_to_user_id', sa.String(length=64), nullable=True, comment='User assigned to review this item. NULL = in global queue.'),
    sa.Column('assigned_at', sa.String(length=64), nullable=True),
    sa.Column('status', sa.String(length=32), nullable=False),
    sa.Column('reviewed_by_user_id', sa.String(length=64), nullable=True),
    sa.Column('reviewer_notes', sa.Text(), nullable=True, comment='Free-text notes from the reviewer explaining their decision'),
    sa.Column('override_body', sa.Text(), nullable=True, comment='Full manual response body if reviewer chose to override the AI draft'),
    sa.Column('resolved_at', sa.String(length=64), nullable=True),
    sa.Column('sla_deadline_at', sa.String(length=64), nullable=True, comment='Computed SLA deadline based on priority. NULL = no SLA configured.'),
    sa.Column('sla_breached', sa.Boolean(), nullable=False, comment='True if resolved_at > sla_deadline_at'),
    sa.Column('tenant_id', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['ai_response_id'], ['ai_responses.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['ai_run_id'], ['ai_runs.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['thread_id'], ['email_threads.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_human_reviews_ai_response_id'), 'human_reviews', ['ai_response_id'], unique=True)
    op.create_index(op.f('ix_human_reviews_ai_run_id'), 'human_reviews', ['ai_run_id'], unique=False)
    op.create_index(op.f('ix_human_reviews_assigned_to_user_id'), 'human_reviews', ['assigned_to_user_id'], unique=False)
    op.create_index(op.f('ix_human_reviews_created_at'), 'human_reviews', ['created_at'], unique=False)
    op.create_index(op.f('ix_human_reviews_priority'), 'human_reviews', ['priority'], unique=False)
    op.create_index(op.f('ix_human_reviews_resolved_at'), 'human_reviews', ['resolved_at'], unique=False)
    op.create_index(op.f('ix_human_reviews_status'), 'human_reviews', ['status'], unique=False)
    op.create_index(op.f('ix_human_reviews_tenant_id'), 'human_reviews', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_human_reviews_thread_id'), 'human_reviews', ['thread_id'], unique=False)
    op.create_index(op.f('ix_human_reviews_triage_reason'), 'human_reviews', ['triage_reason'], unique=False)
    op.create_table('outbound_messages',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('thread_id', sa.String(length=64), nullable=False),
    sa.Column('ai_response_id', sa.String(length=64), nullable=True, comment='AI-generated response that this message dispatches. NULL for manual sends.'),
    sa.Column('integration_account_id', sa.String(length=64), nullable=False, comment='The sending mailbox (connected integration account)'),
    sa.Column('sent_by_user_id', sa.String(length=64), nullable=True, comment='User who triggered the send (NULL for fully automated sends)'),
    sa.Column('to_emails', sa.Text(), nullable=False, comment='JSON array of recipient email addresses'),
    sa.Column('cc_emails', sa.Text(), nullable=True, comment='JSON array of CC email addresses'),
    sa.Column('subject', sa.String(length=998), nullable=True),
    sa.Column('body_html', sa.Text(), nullable=False),
    sa.Column('body_text', sa.Text(), nullable=True),
    sa.Column('idempotency_key', sa.String(length=128), nullable=False, comment='Unique key checked before provider API calls to prevent duplicate sends'),
    sa.Column('provider_message_id', sa.String(length=512), nullable=True, comment='Provider-assigned message ID after successful dispatch (e.g. Gmail messageId)'),
    sa.Column('in_reply_to_external_id', sa.String(length=512), nullable=True, comment='external_message_id of the message being replied to (for threading headers)'),
    sa.Column('delivery_status', sa.String(length=32), nullable=False),
    sa.Column('send_attempts', sa.Integer(), nullable=False),
    sa.Column('max_send_attempts', sa.Integer(), nullable=False),
    sa.Column('last_attempt_at', sa.String(length=64), nullable=True),
    sa.Column('last_error', sa.Text(), nullable=True, comment='Error message from the most recent failed send attempt'),
    sa.Column('scheduled_at', sa.String(length=64), nullable=True, comment='ISO 8601 UTC timestamp for scheduled delivery. NULL = send immediately.'),
    sa.Column('sent_at', sa.String(length=64), nullable=True, comment='ISO 8601 UTC timestamp of confirmed provider delivery'),
    sa.Column('tenant_id', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['ai_response_id'], ['ai_responses.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['integration_account_id'], ['connected_integration_accounts.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['thread_id'], ['email_threads.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_outbound_messages_ai_response_id'), 'outbound_messages', ['ai_response_id'], unique=False)
    op.create_index(op.f('ix_outbound_messages_created_at'), 'outbound_messages', ['created_at'], unique=False)
    op.create_index(op.f('ix_outbound_messages_delivery_status'), 'outbound_messages', ['delivery_status'], unique=False)
    op.create_index(op.f('ix_outbound_messages_idempotency_key'), 'outbound_messages', ['idempotency_key'], unique=True)
    op.create_index(op.f('ix_outbound_messages_integration_account_id'), 'outbound_messages', ['integration_account_id'], unique=False)
    op.create_index(op.f('ix_outbound_messages_provider_message_id'), 'outbound_messages', ['provider_message_id'], unique=False)
    op.create_index(op.f('ix_outbound_messages_tenant_id'), 'outbound_messages', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_outbound_messages_thread_id'), 'outbound_messages', ['thread_id'], unique=False)
    
    # === SEED CANONICAL ROLES AND PERMISSIONS ===
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    
    roles_table = sa.table(
        'roles',
        sa.column('id', sa.String),
        sa.column('name', sa.String),
        sa.column('description', sa.String),
        sa.column('is_system_role', sa.Boolean),
        sa.column('organization_id', sa.String),
        sa.column('created_at', sa.DateTime(timezone=True)),
        sa.column('updated_at', sa.DateTime(timezone=True)),
    )
    
    permissions_table = sa.table(
        'permissions',
        sa.column('id', sa.String),
        sa.column('key', sa.String),
        sa.column('description', sa.String),
        sa.column('created_at', sa.DateTime(timezone=True)),
        sa.column('updated_at', sa.DateTime(timezone=True)),
    )
    
    role_permissions_table = sa.table(
        'role_permissions',
        sa.column('id', sa.String),
        sa.column('role_id', sa.String),
        sa.column('permission_id', sa.String),
        sa.column('created_at', sa.DateTime(timezone=True)),
        sa.column('updated_at', sa.DateTime(timezone=True)),
    )
    
    # 1. Seed Permissions
    permissions_data = [
        ("perm_org_read", "organization.read", "View organization profile and details"),
        ("perm_org_update", "organization.update", "Update organization profile and settings"),
        ("perm_org_delete", "organization.delete", "Archive or delete organization"),
        ("perm_team_read", "team.read", "View organization members"),
        ("perm_team_invite", "team.invite", "Invite new organization members"),
        ("perm_team_manage_roles", "team.manage_roles", "Change member roles"),
        ("perm_team_remove", "team.remove", "Remove members from organization"),
        ("perm_know_read", "knowledge.read", "Read knowledge items and versions"),
        ("perm_know_create", "knowledge.create", "Create or upload knowledge items"),
        ("perm_know_update", "knowledge.update", "Update existing knowledge items"),
        ("perm_know_delete", "knowledge.delete", "Delete knowledge items"),
        ("perm_int_read", "integration.read", "View connected integrations"),
        ("perm_int_connect", "integration.connect", "Connect mailbox integrations"),
        ("perm_int_disconnect", "integration.disconnect", "Disconnect integrations"),
        ("perm_inbox_read", "inbox.read", "View inbox email threads and messages"),
        ("perm_inbox_reply", "inbox.reply", "Create AI or manual reply drafts"),
        ("perm_inbox_send", "inbox.send", "Send outbound emails"),
        ("perm_inbox_delete", "inbox.delete", "Delete email threads"),
        ("perm_bill_read", "billing.read", "View subscription and billing details"),
        ("perm_bill_manage", "billing.manage", "Manage subscriptions and payment methods"),
        ("perm_set_read", "settings.read", "View workspace preferences"),
        ("perm_set_update", "settings.update", "Update workspace preferences"),
    ]
    
    op.bulk_insert(
        permissions_table,
        [
            {"id": p_id, "key": p_key, "description": p_desc, "created_at": now, "updated_at": now}
            for p_id, p_key, p_desc in permissions_data
        ]
    )
    
    # 2. Seed System Roles
    roles_data = [
        ("rol_system_owner", "OWNER", "Full organization owner with all administrative and billing privileges", True, None),
        ("rol_system_admin", "ADMIN", "Administrator with organizational and operational management rights", True, None),
        ("rol_system_member", "MEMBER", "Standard member with operational access to day-to-day features", True, None),
    ]
    
    op.bulk_insert(
        roles_table,
        [
            {"id": r_id, "name": r_name, "description": r_desc, "is_system_role": r_sys, "organization_id": r_org, "created_at": now, "updated_at": now}
            for r_id, r_name, r_desc, r_sys, r_org in roles_data
        ]
    )
    
    # 3. Seed Role-Permissions Matrix
    all_perm_keys = [p[1] for p in permissions_data]
    perm_id_by_key = {p[1]: p[0] for p in permissions_data}
    
    admin_perm_keys = [
        "organization.read", "organization.update",
        "team.read", "team.invite", "team.remove",
        "knowledge.read", "knowledge.create", "knowledge.update", "knowledge.delete",
        "integration.read", "integration.connect", "integration.disconnect",
        "inbox.read", "inbox.reply", "inbox.send", "inbox.delete",
        "billing.read",
        "settings.read", "settings.update",
    ]
    
    member_perm_keys = [
        "organization.read",
        "team.read",
        "knowledge.read", "knowledge.create", "knowledge.update",
        "integration.read",
        "inbox.read", "inbox.reply", "inbox.send",
        "settings.read",
    ]
    
    rp_rows = []
    rp_idx = 1
    # Owner gets everything
    for k in all_perm_keys:
        rp_rows.append({
            "id": f"rp_seed_{rp_idx}",
            "role_id": "rol_system_owner",
            "permission_id": perm_id_by_key[k],
            "created_at": now,
            "updated_at": now,
        })
        rp_idx += 1
        
    # Admin gets admin permissions
    for k in admin_perm_keys:
        rp_rows.append({
            "id": f"rp_seed_{rp_idx}",
            "role_id": "rol_system_admin",
            "permission_id": perm_id_by_key[k],
            "created_at": now,
            "updated_at": now,
        })
        rp_idx += 1
        
    # Member gets member permissions
    for k in member_perm_keys:
        rp_rows.append({
            "id": f"rp_seed_{rp_idx}",
            "role_id": "rol_system_member",
            "permission_id": perm_id_by_key[k],
            "created_at": now,
            "updated_at": now,
        })
        rp_idx += 1
        
    op.bulk_insert(role_permissions_table, rp_rows)
    # ### end Alembic commands ###



def downgrade() -> None:
    """Downgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('users', sa.Column('country', sa.VARCHAR(length=100), autoincrement=False, nullable=False))
    op.add_column('users', sa.Column('business_name', sa.VARCHAR(length=255), autoincrement=False, nullable=False))
    op.add_column('users', sa.Column('timezone', sa.VARCHAR(length=100), autoincrement=False, nullable=False))
    op.add_column('users', sa.Column('password_hash', sa.VARCHAR(length=255), autoincrement=False, nullable=False))
    op.add_column('users', sa.Column('business_description', sa.TEXT(), autoincrement=False, nullable=True))
    op.add_column('users', sa.Column('business_type', sa.VARCHAR(length=100), autoincrement=False, nullable=False))
    op.add_column('users', sa.Column('use_cases', postgresql.JSON(astext_type=sa.Text()), autoincrement=False, nullable=True))
    op.add_column('users', sa.Column('communication_tone', sa.VARCHAR(length=50), autoincrement=False, nullable=True))
    op.add_column('users', sa.Column('target_audience', sa.TEXT(), autoincrement=False, nullable=True))
    op.add_column('users', sa.Column('industry', postgresql.JSON(astext_type=sa.Text()), autoincrement=False, nullable=True))
    op.add_column('users', sa.Column('profile_pic', sa.VARCHAR(length=500), autoincrement=False, nullable=True))
    op.drop_index(op.f('ix_users_is_active'), table_name='users')
    op.drop_index(op.f('ix_users_created_at'), table_name='users')
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.alter_column('users', 'updated_at',
               existing_type=sa.DateTime(timezone=True),
               type_=postgresql.TIMESTAMP(),
               existing_nullable=False)
    op.alter_column('users', 'created_at',
               existing_type=sa.DateTime(timezone=True),
               type_=postgresql.TIMESTAMP(),
               existing_nullable=False)
    op.alter_column('users', 'email',
               existing_type=sa.String(length=320),
               type_=sa.VARCHAR(length=255),
               comment=None,
               existing_comment='RFC 5321 max email length = 320 chars',
               existing_nullable=False)
    op.alter_column('users', 'id',
               existing_type=sa.String(length=64),
               type_=sa.UUID(),
               existing_nullable=False)
    op.drop_column('users', 'last_login_at')
    op.drop_column('users', 'is_verified')
    op.drop_column('users', 'is_active')
    op.drop_column('users', 'avatar_url')
    op.drop_column('users', 'hashed_password')
    op.create_table('email_accounts',
    sa.Column('id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('user_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('email_address', sa.VARCHAR(length=255), autoincrement=False, nullable=False),
    sa.Column('display_name', sa.VARCHAR(length=255), autoincrement=False, nullable=True),
    sa.Column('provider', postgresql.ENUM('GMAIL', 'OUTLOOK', 'SMTP', 'YAHOO', 'ZOHO', name='emailprovider'), autoincrement=False, nullable=False),
    sa.Column('provider_account_id', sa.VARCHAR(length=255), autoincrement=False, nullable=True),
    sa.Column('access_token', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('refresh_token', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('token_expiry', postgresql.TIMESTAMP(), autoincrement=False, nullable=True),
    sa.Column('smtp_host', sa.VARCHAR(length=255), autoincrement=False, nullable=True),
    sa.Column('smtp_port', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('smtp_username', sa.VARCHAR(length=255), autoincrement=False, nullable=True),
    sa.Column('smtp_password', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('smtp_use_tls', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('imap_host', sa.VARCHAR(length=255), autoincrement=False, nullable=True),
    sa.Column('imap_port', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('connection_status', postgresql.ENUM('CONNECTED', 'DISCONNECTED', 'ERROR', name='connectionstatus'), autoincrement=False, nullable=False),
    sa.Column('sync_status', postgresql.ENUM('IDLE', 'SYNCING', 'FAILED', name='syncstatus'), autoincrement=False, nullable=False),
    sa.Column('last_error_message', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('daily_send_limit', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('daily_sent_count', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('warmup_enabled', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('last_synced_at', postgresql.TIMESTAMP(), autoincrement=False, nullable=True),
    sa.Column('last_history_id', sa.VARCHAR(length=64), autoincrement=False, nullable=True),
    sa.Column('watch_expiry', postgresql.TIMESTAMP(), autoincrement=False, nullable=True),
    sa.Column('watch_status', sa.VARCHAR(length=20), autoincrement=False, nullable=False),
    sa.Column('last_watch_started_at', postgresql.TIMESTAMP(), autoincrement=False, nullable=True),
    sa.Column('account_state', sa.VARCHAR(length=20), autoincrement=False, nullable=False),
    sa.Column('is_active', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('is_primary', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('automation_enabled', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('created_at', postgresql.TIMESTAMP(), autoincrement=False, nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(), autoincrement=False, nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('email_accounts_pkey')),
    sa.UniqueConstraint('user_id', 'email_address', name=op.f('uq_email_accounts_user_email'), postgresql_include=[], postgresql_nulls_not_distinct=False)
    )
    op.create_index(op.f('ix_email_accounts_watch_status'), 'email_accounts', ['provider', 'is_active', 'watch_status'], unique=False)
    op.create_index(op.f('ix_email_accounts_user_status'), 'email_accounts', ['user_id', 'connection_status'], unique=False)
    op.create_index(op.f('ix_email_accounts_user_id'), 'email_accounts', ['user_id'], unique=False)
    op.create_index(op.f('ix_email_accounts_user_active'), 'email_accounts', ['user_id', 'is_active'], unique=False)
    op.create_index(op.f('ix_email_accounts_account_state'), 'email_accounts', ['provider', 'account_state'], unique=False)
    op.create_table('es_messages',
    sa.Column('id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('message_id', sa.VARCHAR(length=512), autoincrement=False, nullable=False),
    sa.Column('thread_id', sa.VARCHAR(length=512), autoincrement=False, nullable=True),
    sa.Column('user_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('email_account_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('provider', sa.VARCHAR(length=50), autoincrement=False, nullable=False),
    sa.Column('from_email', sa.TEXT(), autoincrement=False, nullable=False),
    sa.Column('to_emails', postgresql.JSONB(astext_type=sa.Text()), autoincrement=False, nullable=False),
    sa.Column('cc_emails', postgresql.JSONB(astext_type=sa.Text()), autoincrement=False, nullable=True),
    sa.Column('subject', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('content', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('draft_message', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('message_state', postgresql.ENUM('RECEIVED', 'DRAFTED', 'QUEUED', 'SENT', 'FAILED', name='messagestateenum'), autoincrement=False, nullable=True),
    sa.Column('timestamp', postgresql.TIMESTAMP(), autoincrement=False, nullable=False),
    sa.Column('direction', postgresql.ENUM('INCOMING', 'OUTGOING', name='messagedirection'), autoincrement=False, nullable=False),
    sa.Column('status', postgresql.ENUM('RECEIVED', 'SENT', 'FAILED', 'QUEUED', name='messagestatus'), autoincrement=False, nullable=False),
    sa.Column('is_read', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('has_attachments', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('created_at', postgresql.TIMESTAMP(), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('es_messages_pkey')),
    sa.UniqueConstraint('user_id', 'message_id', name=op.f('uq_es_messages_user_message'), postgresql_include=[], postgresql_nulls_not_distinct=False)
    )
    op.create_index(op.f('ix_es_messages_user_recent'), 'es_messages', ['user_id', 'created_at'], unique=False)
    op.create_index(op.f('ix_es_messages_unread'), 'es_messages', ['user_id', 'is_read', 'timestamp'], unique=False)
    op.create_index(op.f('ix_es_messages_thread'), 'es_messages', ['user_id', 'thread_id', 'timestamp'], unique=False)
    op.create_index(op.f('ix_es_messages_draft'), 'es_messages', ['user_id', 'message_state'], unique=False)
    op.create_index(op.f('ix_es_messages_direction'), 'es_messages', ['user_id', 'direction', 'timestamp'], unique=False)
    op.create_index(op.f('ix_es_messages_created_at'), 'es_messages', ['created_at'], unique=False)
    op.create_index(op.f('ix_es_messages_account'), 'es_messages', ['email_account_id', 'timestamp'], unique=False)
    op.create_table('auth_store',
    sa.Column('key', sa.TEXT(), autoincrement=False, nullable=False),
    sa.Column('value', sa.TEXT(), autoincrement=False, nullable=False),
    sa.Column('expires_at', postgresql.TIMESTAMP(), autoincrement=False, nullable=False),
    sa.PrimaryKeyConstraint('key', name=op.f('auth_store_pkey'))
    )
    op.create_index(op.f('ix_auth_store_expires_at'), 'auth_store', ['expires_at'], unique=False)
    op.create_table('es_conversations',
    sa.Column('id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('thread_id', sa.VARCHAR(length=512), autoincrement=False, nullable=False),
    sa.Column('user_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('email_account_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('provider', sa.VARCHAR(length=50), autoincrement=False, nullable=False),
    sa.Column('subject', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('participants', postgresql.JSONB(astext_type=sa.Text()), autoincrement=False, nullable=True),
    sa.Column('message_count', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('last_message_id', sa.VARCHAR(length=512), autoincrement=False, nullable=True),
    sa.Column('last_message_at', postgresql.TIMESTAMP(), autoincrement=False, nullable=False),
    sa.Column('is_read', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('status', sa.VARCHAR(length=50), autoincrement=False, nullable=False),
    sa.Column('intent_type', sa.VARCHAR(length=100), autoincrement=False, nullable=True),
    sa.Column('priority_score', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True),
    sa.Column('lead_status', postgresql.ENUM('HOT', 'WARM', 'COLD', name='leadstatus'), autoincrement=False, nullable=True),
    sa.Column('follow_up_required', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('last_follow_up_at', postgresql.TIMESTAMP(), autoincrement=False, nullable=True),
    sa.Column('tags', postgresql.JSONB(astext_type=sa.Text()), autoincrement=False, nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('es_conversations_pkey')),
    sa.UniqueConstraint('user_id', 'thread_id', name=op.f('uq_es_conversations_user_thread'), postgresql_include=[], postgresql_nulls_not_distinct=False)
    )
    op.create_index(op.f('ix_es_conv_priority'), 'es_conversations', ['user_id', 'priority_score', 'last_message_at'], unique=False)
    op.create_index(op.f('ix_es_conv_lead'), 'es_conversations', ['user_id', 'lead_status', 'last_message_at'], unique=False)
    op.create_index(op.f('ix_es_conv_intent'), 'es_conversations', ['user_id', 'intent_type', 'status'], unique=False)
    op.create_index(op.f('ix_es_conv_inbox'), 'es_conversations', ['user_id', 'status', 'is_read', 'last_message_at'], unique=False)
    op.create_index(op.f('ix_es_conv_account'), 'es_conversations', ['email_account_id', 'last_message_at'], unique=False)
    op.create_table('user_settings',
    sa.Column('id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('user_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('auto_sync_replies', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('sync_sent_folder', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('sync_frequency', sa.VARCHAR(length=10), autoincrement=False, nullable=False),
    sa.Column('automation_level', sa.VARCHAR(length=20), autoincrement=False, nullable=False),
    sa.Column('learn_from_edits', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('personalize_per_lead', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('avoid_repetition', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('max_reply_length', sa.VARCHAR(length=10), autoincrement=False, nullable=False),
    sa.Column('automation_enabled', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('pause_on_weekends', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('respect_sending_hours', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('delay_between_steps', sa.VARCHAR(length=10), autoincrement=False, nullable=False),
    sa.Column('stop_on_reply', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('max_emails_per_lead', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('email_new_reply', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('email_campaign_complete', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('email_lead_status', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('email_weekly_digest', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('inapp_realtime_replies', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('inapp_ai_actions', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('inapp_team_activity', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('inapp_system_alerts', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('notification_batching', sa.VARCHAR(length=10), autoincrement=False, nullable=False),
    sa.Column('two_factor_enabled', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('require_2fa_for_team', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('workspace_name', sa.VARCHAR(length=255), autoincrement=False, nullable=True),
    sa.Column('default_member_role', sa.VARCHAR(length=20), autoincrement=False, nullable=False),
    sa.Column('invite_by_domain', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('require_admin_approval', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('analytics_improvement', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('personalization_data', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('third_party_integrations', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('created_at', postgresql.TIMESTAMP(), autoincrement=False, nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('user_settings_user_id_fkey'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('user_settings_pkey'))
    )
    op.create_index(op.f('ix_user_settings_user_id'), 'user_settings', ['user_id'], unique=True)
    op.create_index(op.f('ix_user_settings_id'), 'user_settings', ['id'], unique=False)
    op.drop_index(op.f('ix_outbound_messages_thread_id'), table_name='outbound_messages')
    op.drop_index(op.f('ix_outbound_messages_tenant_id'), table_name='outbound_messages')
    op.drop_index(op.f('ix_outbound_messages_provider_message_id'), table_name='outbound_messages')
    op.drop_index(op.f('ix_outbound_messages_integration_account_id'), table_name='outbound_messages')
    op.drop_index(op.f('ix_outbound_messages_idempotency_key'), table_name='outbound_messages')
    op.drop_index(op.f('ix_outbound_messages_delivery_status'), table_name='outbound_messages')
    op.drop_index(op.f('ix_outbound_messages_created_at'), table_name='outbound_messages')
    op.drop_index(op.f('ix_outbound_messages_ai_response_id'), table_name='outbound_messages')
    op.drop_table('outbound_messages')
    op.drop_index(op.f('ix_human_reviews_triage_reason'), table_name='human_reviews')
    op.drop_index(op.f('ix_human_reviews_thread_id'), table_name='human_reviews')
    op.drop_index(op.f('ix_human_reviews_tenant_id'), table_name='human_reviews')
    op.drop_index(op.f('ix_human_reviews_status'), table_name='human_reviews')
    op.drop_index(op.f('ix_human_reviews_resolved_at'), table_name='human_reviews')
    op.drop_index(op.f('ix_human_reviews_priority'), table_name='human_reviews')
    op.drop_index(op.f('ix_human_reviews_created_at'), table_name='human_reviews')
    op.drop_index(op.f('ix_human_reviews_assigned_to_user_id'), table_name='human_reviews')
    op.drop_index(op.f('ix_human_reviews_ai_run_id'), table_name='human_reviews')
    op.drop_index(op.f('ix_human_reviews_ai_response_id'), table_name='human_reviews')
    op.drop_table('human_reviews')
    op.drop_index(op.f('ix_role_permissions_role_id'), table_name='role_permissions')
    op.drop_index(op.f('ix_role_permissions_permission_id'), table_name='role_permissions')
    op.drop_index(op.f('ix_role_permissions_created_at'), table_name='role_permissions')
    op.drop_table('role_permissions')
    op.drop_index(op.f('ix_organization_members_user_id'), table_name='organization_members')
    op.drop_index(op.f('ix_organization_members_status'), table_name='organization_members')
    op.drop_index(op.f('ix_organization_members_role_id'), table_name='organization_members')
    op.drop_index(op.f('ix_organization_members_organization_id'), table_name='organization_members')
    op.drop_index(op.f('ix_organization_members_created_at'), table_name='organization_members')
    op.drop_index('ix_org_member_lookup', table_name='organization_members')
    op.drop_table('organization_members')
    op.drop_index(op.f('ix_evidence_tenant_id'), table_name='evidence')
    op.drop_index(op.f('ix_evidence_source_type'), table_name='evidence')
    op.drop_index(op.f('ix_evidence_created_at'), table_name='evidence')
    op.drop_index(op.f('ix_evidence_ai_run_id'), table_name='evidence')
    op.drop_table('evidence')
    op.drop_index(op.f('ix_attachment_metadata_tenant_id'), table_name='attachment_metadata')
    op.drop_index(op.f('ix_attachment_metadata_message_id'), table_name='attachment_metadata')
    op.drop_index(op.f('ix_attachment_metadata_created_at'), table_name='attachment_metadata')
    op.drop_table('attachment_metadata')
    op.drop_index(op.f('ix_ai_responses_thread_id'), table_name='ai_responses')
    op.drop_index(op.f('ix_ai_responses_tenant_id'), table_name='ai_responses')
    op.drop_index(op.f('ix_ai_responses_has_policy_violations'), table_name='ai_responses')
    op.drop_index(op.f('ix_ai_responses_created_at'), table_name='ai_responses')
    op.drop_index(op.f('ix_ai_responses_approval_status'), table_name='ai_responses')
    op.drop_index(op.f('ix_ai_responses_ai_run_id'), table_name='ai_responses')
    op.drop_table('ai_responses')
    op.drop_index(op.f('ix_workspace_preferences_organization_id'), table_name='workspace_preferences')
    op.drop_index(op.f('ix_workspace_preferences_created_at'), table_name='workspace_preferences')
    op.drop_table('workspace_preferences')
    op.drop_index(op.f('ix_roles_organization_id'), table_name='roles')
    op.drop_index(op.f('ix_roles_name'), table_name='roles')
    op.drop_index(op.f('ix_roles_created_at'), table_name='roles')
    op.drop_table('roles')
    op.drop_index(op.f('ix_organization_onboarding_states_user_id'), table_name='organization_onboarding_states')
    op.drop_index(op.f('ix_organization_onboarding_states_organization_id'), table_name='organization_onboarding_states')
    op.drop_index(op.f('ix_organization_onboarding_states_onboarding_complete'), table_name='organization_onboarding_states')
    op.drop_index(op.f('ix_organization_onboarding_states_created_at'), table_name='organization_onboarding_states')
    op.drop_table('organization_onboarding_states')
    op.drop_index(op.f('ix_email_messages_thread_id'), table_name='email_messages')
    op.drop_index(op.f('ix_email_messages_tenant_id'), table_name='email_messages')
    op.drop_index(op.f('ix_email_messages_sent_at'), table_name='email_messages')
    op.drop_index(op.f('ix_email_messages_integration_account_id'), table_name='email_messages')
    op.drop_index(op.f('ix_email_messages_external_message_id'), table_name='email_messages')
    op.drop_index(op.f('ix_email_messages_created_at'), table_name='email_messages')
    op.drop_table('email_messages')
    op.drop_index(op.f('ix_business_profiles_organization_id'), table_name='business_profiles')
    op.drop_index(op.f('ix_business_profiles_created_at'), table_name='business_profiles')
    op.drop_table('business_profiles')
    op.drop_index(op.f('ix_ai_runs_thread_id'), table_name='ai_runs')
    op.drop_index(op.f('ix_ai_runs_tenant_id'), table_name='ai_runs')
    op.drop_index(op.f('ix_ai_runs_status'), table_name='ai_runs')
    op.drop_index(op.f('ix_ai_runs_started_at'), table_name='ai_runs')
    op.drop_index(op.f('ix_ai_runs_pipeline_stage'), table_name='ai_runs')
    op.drop_index(op.f('ix_ai_runs_created_at'), table_name='ai_runs')
    op.drop_table('ai_runs')
    op.drop_index(op.f('ix_sessions_user_id'), table_name='sessions')
    op.drop_index(op.f('ix_sessions_revoked_at'), table_name='sessions')
    op.drop_index(op.f('ix_sessions_jti'), table_name='sessions')
    op.drop_index(op.f('ix_sessions_expires_at'), table_name='sessions')
    op.drop_index(op.f('ix_sessions_created_at'), table_name='sessions')
    op.drop_table('sessions')
    op.drop_index(op.f('ix_organizations_status'), table_name='organizations')
    op.drop_index(op.f('ix_organizations_slug'), table_name='organizations')
    op.drop_index(op.f('ix_organizations_plan_tier'), table_name='organizations')
    op.drop_index(op.f('ix_organizations_is_active'), table_name='organizations')
    op.drop_index(op.f('ix_organizations_created_by'), table_name='organizations')
    op.drop_index(op.f('ix_organizations_created_at'), table_name='organizations')
    op.drop_table('organizations')
    op.drop_index(op.f('ix_oauth_credential_metadata_tenant_id'), table_name='oauth_credential_metadata')
    op.drop_index(op.f('ix_oauth_credential_metadata_integration_account_id'), table_name='oauth_credential_metadata')
    op.drop_index(op.f('ix_oauth_credential_metadata_created_at'), table_name='oauth_credential_metadata')
    op.drop_table('oauth_credential_metadata')
    op.drop_index(op.f('ix_knowledge_versions_tenant_id'), table_name='knowledge_versions')
    op.drop_index(op.f('ix_knowledge_versions_status'), table_name='knowledge_versions')
    op.drop_index(op.f('ix_knowledge_versions_knowledge_item_id'), table_name='knowledge_versions')
    op.drop_index(op.f('ix_knowledge_versions_created_at'), table_name='knowledge_versions')
    op.drop_table('knowledge_versions')
    op.drop_index(op.f('ix_email_verification_challenges_user_id'), table_name='email_verification_challenges')
    op.drop_index(op.f('ix_email_verification_challenges_expires_at'), table_name='email_verification_challenges')
    op.drop_index(op.f('ix_email_verification_challenges_created_at'), table_name='email_verification_challenges')
    op.drop_table('email_verification_challenges')
    op.drop_index(op.f('ix_email_threads_tenant_id'), table_name='email_threads')
    op.drop_index(op.f('ix_email_threads_status'), table_name='email_threads')
    op.drop_index(op.f('ix_email_threads_lead_intent'), table_name='email_threads')
    op.drop_index(op.f('ix_email_threads_last_message_at'), table_name='email_threads')
    op.drop_index(op.f('ix_email_threads_is_read'), table_name='email_threads')
    op.drop_index(op.f('ix_email_threads_integration_account_id'), table_name='email_threads')
    op.drop_index(op.f('ix_email_threads_external_thread_id'), table_name='email_threads')
    op.drop_index(op.f('ix_email_threads_created_at'), table_name='email_threads')
    op.drop_table('email_threads')
    op.drop_index(op.f('ix_authentication_identities_user_id'), table_name='authentication_identities')
    op.drop_index(op.f('ix_authentication_identities_provider'), table_name='authentication_identities')
    op.drop_index(op.f('ix_authentication_identities_last_used_at'), table_name='authentication_identities')
    op.drop_index(op.f('ix_authentication_identities_created_at'), table_name='authentication_identities')
    op.drop_table('authentication_identities')
    op.drop_index(op.f('ix_permissions_key'), table_name='permissions')
    op.drop_index(op.f('ix_permissions_created_at'), table_name='permissions')
    op.drop_table('permissions')
    op.drop_index(op.f('ix_knowledge_items_title'), table_name='knowledge_items')
    op.drop_index(op.f('ix_knowledge_items_tenant_id'), table_name='knowledge_items')
    op.drop_index(op.f('ix_knowledge_items_current_version_id'), table_name='knowledge_items')
    op.drop_index(op.f('ix_knowledge_items_created_at'), table_name='knowledge_items')
    op.drop_index(op.f('ix_knowledge_items_category'), table_name='knowledge_items')
    op.drop_table('knowledge_items')
    op.drop_index(op.f('ix_connected_integration_accounts_tenant_id'), table_name='connected_integration_accounts')
    op.drop_index(op.f('ix_connected_integration_accounts_status'), table_name='connected_integration_accounts')
    op.drop_index(op.f('ix_connected_integration_accounts_provider'), table_name='connected_integration_accounts')
    op.drop_index(op.f('ix_connected_integration_accounts_email_address'), table_name='connected_integration_accounts')
    op.drop_index(op.f('ix_connected_integration_accounts_created_at'), table_name='connected_integration_accounts')
    op.drop_table('connected_integration_accounts')
    op.drop_index(op.f('ix_business_entities_tenant_id'), table_name='business_entities')
    op.drop_index(op.f('ix_business_entities_name'), table_name='business_entities')
    op.drop_index(op.f('ix_business_entities_is_active'), table_name='business_entities')
    op.drop_index(op.f('ix_business_entities_entity_type'), table_name='business_entities')
    op.drop_index(op.f('ix_business_entities_created_at'), table_name='business_entities')
    op.drop_table('business_entities')
    # ### end Alembic commands ###
