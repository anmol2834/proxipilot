"""Centralized Typed Configuration Layer for ProxiPilot Backend.

Architectural Rules:
- All environment variables are validated into strongly typed Pydantic models.
- Code NEVER accesses os.getenv() directly.
- Configuration is divided into shared infrastructure and service-scoped settings.
- Services/Workers consume ONLY the sub-configurations they require.
- Seamlessly integrates with cloud secret managers (AWS/Azure/GCP/Vault) via environment injection.
- SecuritySettings validates that insecure defaults are not used in production.
"""

from functools import lru_cache
from typing import List, Literal
from pydantic import Field, computed_field, model_validator
import functools

from pydantic_settings import BaseSettings, SettingsConfigDict


class BaseAppConfig(BaseSettings):
    """Shared base settings config across all models."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


class DatabaseSettings(BaseAppConfig):
    """Relational Database (PostgreSQL / Neon Serverless) Settings."""

    database_url: str = Field(
        default="postgresql://postgres:postgres@localhost:5432/proxipilot",
        alias="DATABASE_URL",
    )
    pool_size: int = Field(default=10, alias="DB_POOL_SIZE")
    max_overflow: int = Field(default=20, alias="DB_MAX_OVERFLOW")
    pool_timeout_seconds: int = Field(default=30, alias="DB_POOL_TIMEOUT_SECONDS")
    # Recycling forces a brand-new TLS connection (seconds on high-latency links), so
    # keep it long; the keepalive task keeps the warm connections healthy.
    pool_recycle_seconds: int = Field(default=1800, alias="DB_POOL_RECYCLE_SECONDS")
    # Pooled connections opened at startup and pinged periodically so user requests
    # never pay connection setup / serverless compute wake-up latency.
    warm_connections: int = Field(default=3, alias="DB_WARM_CONNECTIONS", ge=0, le=20)
    keepalive_interval_seconds: int = Field(default=60, alias="DB_KEEPALIVE_INTERVAL_SECONDS", ge=0)
    # Liveness ping on every pool checkout. Over a cross-region link each ping costs several
    # round trips (~240 ms measured EC2 ap-south-1 -> Neon ap-southeast-1) on EVERY session.
    # Can be disabled where connections are kept warm (keepalive + LIFO + recycle) and callers
    # retry transient errors; dead connections are still invalidated on first use.
    pool_pre_ping: bool = Field(default=True, alias="DB_POOL_PRE_PING")

    @computed_field  # type: ignore[prop-decorator]
    @property
    def async_database_url(self) -> str:
        """Ensure SQLAlchemy asyncpg driver scheme is present and clean incompatible query parameters."""
        url_str = self.database_url
        try:
            from sqlalchemy.engine import make_url

            url = make_url(url_str)
            if url.drivername.startswith("postgres"):
                query = dict(url.query)
                sslmode = query.pop("sslmode", None)
                query.pop("channel_binding", None)

                # asyncpg uses 'ssl' keyword argument instead of libpq's 'sslmode'
                if sslmode in ("require", "prefer", "allow", "verify-ca", "verify-full") or (
                    url.host and "neon.tech" in url.host
                ):
                    query.setdefault("ssl", "require")
                elif sslmode == "disable":
                    query.pop("ssl", None)

                return url.set(drivername="postgresql+asyncpg", query=query).render_as_string(
                    hide_password=False
                )
            return url_str
        except Exception:
            if url_str.startswith("postgresql://"):
                return url_str.replace("postgresql://", "postgresql+asyncpg://", 1)
            elif url_str.startswith("postgres://"):
                return url_str.replace("postgres://", "postgresql+asyncpg://", 1)
            return url_str


class RedisSettings(BaseAppConfig):
    """Redis Cache & Streams (Upstash / Standalone) Settings."""

    url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")
    max_connections: int = Field(default=50, alias="REDIS_MAX_CONNECTIONS")
    socket_timeout_seconds: int = Field(default=5, alias="REDIS_SOCKET_TIMEOUT_SECONDS")


class QdrantSettings(BaseAppConfig):
    """Qdrant Vector Database Settings."""

    url: str = Field(default="http://localhost:6333", alias="QDRANT_URL")
    api_key: str = Field(default="", alias="QDRANT_API_KEY")
    timeout_seconds: int = Field(default=10, alias="QDRANT_TIMEOUT_SECONDS")
    collection_name: str = Field(default="proxipilot_knowledge", alias="QDRANT_COLLECTION_NAME")
    vector_name: str = Field(default="dense", alias="QDRANT_DENSE_VECTOR_NAME")


class EmbeddingSettings(BaseAppConfig):
    """Embedding Provider and Pipeline Settings (Phase 10 Foundation)."""

    provider: str = Field(default="local", alias="EMBEDDING_PROVIDER")  # "voyage", "cohere", "openai", "local"
    voyage_api_key: str = Field(default="", alias="VOYAGE_API_KEY")
    cohere_api_key: str = Field(default="", alias="COHERE_API_KEY")
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    model_name: str = Field(default="voyage-4-large", alias="EMBEDDING_MODEL_NAME")
    model_version: str = Field(default="2026-v1", alias="EMBEDDING_MODEL_VERSION")
    dimension: int = Field(default=1024, alias="EMBEDDING_DIMENSION")
    batch_size: int = Field(default=32, alias="EMBEDDING_BATCH_SIZE")
    max_concurrency: int = Field(default=4, alias="EMBEDDING_MAX_CONCURRENCY")
    cache_enabled: bool = Field(default=True, alias="EMBEDDING_CACHE_ENABLED")
    cache_ttl_seconds: int = Field(default=604800, alias="EMBEDDING_CACHE_TTL_SECONDS")  # 7 days
    request_timeout_seconds: float = Field(default=15.0, alias="EMBEDDING_TIMEOUT_SECONDS")
    max_retries: int = Field(default=3, alias="EMBEDDING_MAX_RETRIES")


class SecuritySettings(BaseAppConfig):
    """Authentication, Tokens and Cryptographic Settings."""

    jwt_secret_key: str = Field(
        default="change-me-in-production-min-32-chars", alias="JWT_SECRET_KEY"
    )
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(
        default=60 * 24 * 7, alias="JWT_ACCESS_TOKEN_EXPIRE_MINUTES"
    )
    refresh_token_expire_days: int = Field(default=180, alias="JWT_REFRESH_TOKEN_EXPIRE_DAYS")
    tenant_header_key: str = "x-tenant-id"

    # Loaded from parent settings for cross-validation. Injected by model_validator.
    environment: Literal["development", "staging", "production", "test"] = Field(
        default="development", alias="ENVIRONMENT"
    )

    _INSECURE_DEFAULT_KEY = "change-me-in-production-min-32-chars"

    @model_validator(mode="after")
    def validate_production_security(self) -> "SecuritySettings":
        """Fail fast in production if the JWT secret key is still the insecure default.

        This validator prevents accidental production deployments with placeholder secrets.
        In CI/staging it is a no-op unless ENVIRONMENT=production.
        """
        if self.environment == "production":
            if self.jwt_secret_key == self._INSECURE_DEFAULT_KEY:
                raise ValueError(
                    "CRITICAL SECURITY ERROR: JWT_SECRET_KEY is still the insecure default. "
                    "Set a cryptographically random 64-character secret in JWT_SECRET_KEY "
                    "before deploying to production. "
                    "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
                )
            if len(self.jwt_secret_key) < 32:
                raise ValueError(
                    "JWT_SECRET_KEY must be at least 32 characters in production. "
                    f"Current length: {len(self.jwt_secret_key)}"
                )
        return self


class AuthSettings(BaseAppConfig):
    """Authentication-specific settings: OTP, cookies, rate limiting."""

    # OTP Configuration
    otp_expire_seconds: int = Field(default=600, alias="OTP_EXPIRE_SECONDS")
    otp_max_attempts: int = Field(default=5, alias="OTP_MAX_ATTEMPTS")
    otp_resend_cooldown_seconds: int = Field(default=60, alias="OTP_RESEND_COOLDOWN_SECONDS")
    otp_max_resends: int = Field(default=3, alias="OTP_MAX_RESENDS")
    otp_length: int = Field(default=6, alias="OTP_LENGTH")

    # Cookie Configuration
    cookie_secure: bool = Field(default=False, alias="COOKIE_SECURE")
    cookie_samesite: str = Field(default="lax", alias="COOKIE_SAMESITE")
    cookie_domain: str = Field(default="", alias="COOKIE_DOMAIN")
    access_token_cookie_name: str = Field(
        default="pp_access_token", alias="ACCESS_TOKEN_COOKIE_NAME"
    )
    refresh_token_cookie_name: str = Field(
        default="pp_refresh_token", alias="REFRESH_TOKEN_COOKIE_NAME"
    )

    # Token Expiry (override SecuritySettings defaults for auth operations)
    access_token_expire_minutes: int = Field(
        default=15, alias="AUTH_ACCESS_TOKEN_EXPIRE_MINUTES"
    )
    refresh_token_expire_days: int = Field(
        default=7, alias="AUTH_REFRESH_TOKEN_EXPIRE_DAYS"
    )

    # Rate Limiting (per dimension)
    signup_rate_limit_per_ip: int = Field(
        default=10, alias="SIGNUP_RATE_LIMIT_PER_IP"
    )  # per hour
    signin_rate_limit_per_ip: int = Field(
        default=20, alias="SIGNIN_RATE_LIMIT_PER_IP"
    )  # per 15 minutes
    signin_rate_limit_per_email: int = Field(
        default=10, alias="SIGNIN_RATE_LIMIT_PER_EMAIL"
    )  # per 15 minutes

    # Development mode: return OTP in API response for easy testing
    otp_reveal_in_dev: bool = Field(default=True, alias="OTP_REVEAL_IN_DEV")

    environment: Literal["development", "staging", "production", "test"] = Field(
        default="development", alias="ENVIRONMENT"
    )


class EmailProviderSettings(BaseAppConfig):
    """OAuth & API credentials for inbound/outbound email providers and Pub/Sub."""

    google_client_id: str = Field(default="", alias="GOOGLE_CLIENT_ID")
    google_client_secret: str = Field(default="", alias="GOOGLE_CLIENT_SECRET")
    google_redirect_uri: str = Field(
        default="http://localhost:8000/api/v1/auth/google/callback",
        alias="GOOGLE_REDIRECT_URI",
    )
    # Dedicated Gmail Integration Settings
    google_cloud_project_id: str = Field(default="", alias="GOOGLE_CLOUD_PROJECT_ID")
    gmail_client_id: str = Field(default="", alias="GOOGLE_GMAIL_CLIENT_ID")
    gmail_client_secret: str = Field(default="", alias="GOOGLE_GMAIL_CLIENT_SECRET")
    gmail_redirect_uri: str = Field(
        default="http://localhost:8000/api/v1/integrations/gmail/oauth/callback",
        alias="GOOGLE_GMAIL_REDIRECT_URI",
    )
    gmail_pubsub_topic: str = Field(
        default="projects/proxipilot/topics/gmail-events", alias="GMAIL_PUBSUB_TOPIC"
    )
    gmail_pubsub_subscription: str = Field(default="", alias="GMAIL_PUBSUB_SUBSCRIPTION")
    gmail_pubsub_webhook_url: str = Field(
        default="http://localhost:8000/api/v1/webhooks/gmail/pubsub",
        alias="GMAIL_PUBSUB_WEBHOOK_URL",
    )
    gmail_pubsub_push_audience: str = Field(default="", alias="GMAIL_PUBSUB_PUSH_AUDIENCE")
    gmail_pubsub_push_service_account: str = Field(
        default="", alias="GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT"
    )
    gmail_watch_renewal_days: int = Field(default=5, alias="GMAIL_WATCH_RENEWAL_DAYS")
    # Safety net when Pub/Sub push does not reach the webhook (e.g. a restarted quick
    # tunnel): every N seconds each mailbox gets one cheap getProfile check. 0 disables.
    gmail_fallback_poll_seconds: int = Field(default=30, alias="GMAIL_FALLBACK_POLL_SECONDS", ge=0)
    gmail_history_page_size: int = Field(default=100, alias="GMAIL_HISTORY_PAGE_SIZE")
    gmail_sync_workers: int = Field(default=8, alias="GMAIL_SYNC_WORKERS")
    gmail_renewal_workers: int = Field(default=4, alias="GMAIL_RENEWAL_WORKERS")
    gmail_recovery_workers: int = Field(default=4, alias="GMAIL_RECOVERY_WORKERS")
    gmail_api_timeout: float = Field(default=30.0, alias="GMAIL_API_TIMEOUT")
    gmail_max_retries: int = Field(default=5, alias="GMAIL_MAX_RETRIES")
    encryption_secret_key: str = Field(default="", alias="ENCRYPTION_SECRET_KEY")

    def get_effective_gmail_client_id(self) -> str:
        return self.gmail_client_id or self.google_client_id

    def get_effective_gmail_client_secret(self) -> str:
        return self.gmail_client_secret or self.google_client_secret

    microsoft_client_id: str = Field(default="", alias="MICROSOFT_CLIENT_ID")
    microsoft_client_secret: str = Field(default="", alias="MICROSOFT_CLIENT_SECRET")
    microsoft_tenant_id: str = Field(default="", alias="MICROSOFT_TENANT_ID")
    microsoft_redirect_uri: str = Field(
        default="http://localhost:8000/api/v1/auth/microsoft/callback",
        alias="MICROSOFT_REDIRECT_URI",
    )


class RetrievalBudgetSettings(BaseAppConfig):
    """Bounded progressive retrieval (indexed search projection). All values are per (sub-)query."""

    # Max index rows examined for a family / constraint query before declaring the search
    # "not exhaustive" (the reply then never claims the business lacks the item).
    index_candidate_budget: int = Field(default=2000, alias="RETRIEVAL_INDEX_BUDGET", ge=50, le=50000)
    # Tenants with more active items than this use the GIN full-text prefilter for keyword search.
    lexical_prefilter_threshold: int = Field(default=20000, alias="RETRIEVAL_LEXICAL_PREFILTER_THRESHOLD", ge=0)
    lexical_prefilter_limit: int = Field(default=1500, alias="RETRIEVAL_LEXICAL_PREFILTER_LIMIT", ge=50, le=20000)


@functools.lru_cache(maxsize=1)
def get_retrieval_budget() -> "RetrievalBudgetSettings":
    return RetrievalBudgetSettings()


class LlmSettings(BaseAppConfig):
    """AI and LLM Provider Settings (OpenAI / Inference)."""

    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    openai_model: str = Field(default="gpt-5-mini", alias="OPENAI_MODEL")
    openai_timeout_seconds: int = Field(default=60, alias="OPENAI_TIMEOUT_SECONDS")
    openai_max_retries: int = Field(default=3, alias="OPENAI_MAX_RETRIES")


class WorkerSettings(BaseAppConfig):
    """Background Worker Concurrency and Stream Configurations."""

    ai_worker_concurrency: int = Field(default=4, alias="AI_WORKER_CONCURRENCY")
    email_worker_concurrency: int = Field(default=8, alias="EMAIL_WORKER_CONCURRENCY")
    automation_worker_concurrency: int = Field(default=4, alias="AUTOMATION_WORKER_CONCURRENCY")
    stream_prefix: str = Field(default="proxipilot:stream:", alias="EVENT_BUS_STREAM_PREFIX")


class ObservabilitySettings(BaseAppConfig):
    """Structured Logging & Metrics Settings."""

    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    log_format_json: bool = Field(default=True, alias="LOG_FORMAT_JSON")
    enable_metrics: bool = Field(default=True, alias="ENABLE_METRICS")


class StorageSettings(BaseAppConfig):
    """File & Object Storage Settings (Phase 8.1)."""

    storage_backend: Literal["local", "s3", "gcs"] = Field(
        default="local", alias="STORAGE_BACKEND"
    )
    storage_local_root: str = Field(
        default="./storage/uploads", alias="STORAGE_LOCAL_ROOT"
    )
    knowledge_max_upload_size_bytes: int = Field(
        default=52_428_800, alias="KNOWLEDGE_MAX_UPLOAD_SIZE_BYTES"
    )
    storage_temp_prefix: str = Field(
        default=".uploading", alias="STORAGE_TEMP_PREFIX"
    )
    stale_upload_retention_seconds: int = Field(
        default=7200, alias="STALE_UPLOAD_RETENTION_SECONDS"
    )


class ParserSettings(BaseAppConfig):
    """CSV & Excel Parser Resource Limit Settings (Phase 8.2)."""

    parser_max_rows: int = Field(default=500_000, alias="PARSER_MAX_ROWS")
    parser_max_columns: int = Field(default=200, alias="PARSER_MAX_COLUMNS")
    parser_max_cell_length: int = Field(default=65_536, alias="PARSER_MAX_CELL_LENGTH")
    parser_max_sheets: int = Field(default=50, alias="PARSER_MAX_SHEETS")
    parser_sample_size: int = Field(default=5, alias="PARSER_SAMPLE_SIZE")
    parser_max_enum_cardinality: int = Field(default=25, alias="PARSER_MAX_ENUM_CARDINALITY")
    parser_header_scan_rows: int = Field(default=10, alias="PARSER_HEADER_SCAN_ROWS")


class KnowledgeImportSettings(BaseAppConfig):
    """Knowledge Import Batch Persistence Settings (Phase 8.5).

    Controls how the bulk canonical persistence layer batches and commits records
    to PostgreSQL during the IMPORTING stage of the import worker pipeline.
    """

    # Number of normalized records processed per database transaction.
    # Smaller batches → lower memory, more round trips, finer-grained rollback on failure.
    # Larger batches → higher throughput, larger memory footprint per batch.
    # Evidence-based default: 500 (benchmarked as optimal P95 for mixed attribute payloads).
    knowledge_import_batch_size: int = Field(
        default=500,
        alias="KNOWLEDGE_IMPORT_BATCH_SIZE",
        ge=50,
        le=5000,
    )

    # After how many rows to write a progress checkpoint to the import_job table.
    # Avoids per-row DB UPDATE write amplification.
    # Decoupled from batch_size to allow frequent progress without small batches.
    # Number of batches persisted + indexed concurrently during a streaming import.
    # Overlaps network round trips of different batches (big win on high-latency DBs).
    # Persist semantic chunk rows during bulk imports. Off by default: for imported rows
    # the chunk text duplicates KnowledgeVersion.content_text (~25% of upload bytes),
    # vectors are built from memory, and the chunk table is a projection cache that the
    # single-item indexer regenerates on demand when rows are missing.
    knowledge_import_persist_semantic_chunks: bool = Field(
        default=False,
        alias="KNOWLEDGE_IMPORT_PERSIST_SEMANTIC_CHUNKS",
    )

    # Batches uploading to PostgreSQL at the same time. Uploads are bandwidth-bound:
    # measured on a remote DB link, 1 vs 3 parallel COPY streams gave the same total
    # time, but 3 streams doubled p95 latency of every other request (status polls,
    # heartbeats). Parsing, projection and vector indexing still overlap the upload.
    knowledge_import_db_write_concurrency: int = Field(
        default=1,
        alias="KNOWLEDGE_IMPORT_DB_WRITE_CONCURRENCY",
        ge=1,
        le=8,
    )

    knowledge_import_pipeline_concurrency: int = Field(
        default=3,
        alias="KNOWLEDGE_IMPORT_PIPELINE_CONCURRENCY",
        ge=1,
        le=16,
    )

    knowledge_import_progress_interval: int = Field(
        default=1000,
        alias="KNOWLEDGE_IMPORT_PROGRESS_INTERVAL",
        ge=100,
    )

    # -------------------------------------------------------------------------
    # Phase 8.6: Semantic Projection Settings
    # -------------------------------------------------------------------------

    # Maximum characters per semantic chunk before a forced word-boundary split.
    # Controls chunk granularity for Phase 10 embedding without coupling to a model.
    # Phase 10 may impose tighter limits; this is the Phase 8.6 upper bound.
    semantic_max_chars: int = Field(
        default=2000,
        alias="SEMANTIC_MAX_CHARS",
        ge=200,
        le=8000,
    )

    # Overlap characters when a section is split into multiple chunks.
    # Preserves cross-boundary context for retrieval without full duplication.
    semantic_overlap_chars: int = Field(
        default=100,
        alias="SEMANTIC_OVERLAP_CHARS",
        ge=0,
        le=500,
    )

    # Projection schema version. Increment to trigger re-projection of existing
    # versions when the formatting templates change.
    # DISTINCT from KnowledgeVersion.version_number (business content version).
    semantic_projection_version: int = Field(
        default=2,
        alias="SEMANTIC_PROJECTION_VERSION",
        ge=1,
    )




# ==============================================================================
# Service-Specific Scoped Configurations
# ==============================================================================


class ApiSettings(BaseAppConfig):
    """Configuration consumed specifically by the FastAPI HTTP Gateway process."""

    app_name: str = Field(default="ProxiPilot Backend", alias="APP_NAME")
    environment: Literal["development", "staging", "production", "test"] = Field(
        default="development", alias="ENVIRONMENT"
    )
    debug: bool = Field(default=False, alias="DEBUG")
    port: int = Field(default=8000, alias="PORT")
    host: str = Field(default="0.0.0.0", alias="HOST")
    cors_origins: List[str] = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000"], alias="CORS_ORIGINS"
    )
    frontend_url: str = Field(default="http://localhost:3000", alias="FRONTEND_URL")

    db: DatabaseSettings = Field(default_factory=DatabaseSettings)
    redis: RedisSettings = Field(default_factory=RedisSettings)
    security: SecuritySettings = Field(default_factory=SecuritySettings)
    auth: AuthSettings = Field(default_factory=AuthSettings)
    providers: EmailProviderSettings = Field(default_factory=EmailProviderSettings)
    observability: ObservabilitySettings = Field(default_factory=ObservabilitySettings)
    storage: StorageSettings = Field(default_factory=StorageSettings)
    parser: ParserSettings = Field(default_factory=ParserSettings)
    knowledge_import: KnowledgeImportSettings = Field(default_factory=KnowledgeImportSettings)


class AiWorkerSettings(BaseAppConfig):
    """Configuration consumed specifically by the AI / RAG Worker process."""

    environment: Literal["development", "staging", "production", "test"] = Field(
        default="development", alias="ENVIRONMENT"
    )
    db: DatabaseSettings = Field(default_factory=DatabaseSettings)
    redis: RedisSettings = Field(default_factory=RedisSettings)
    qdrant: QdrantSettings = Field(default_factory=QdrantSettings)
    embedding: EmbeddingSettings = Field(default_factory=EmbeddingSettings)
    llm: LlmSettings = Field(default_factory=LlmSettings)
    worker: WorkerSettings = Field(default_factory=WorkerSettings)
    observability: ObservabilitySettings = Field(default_factory=ObservabilitySettings)


class EmailWorkerSettings(BaseAppConfig):
    """Configuration consumed specifically by the Email Ingestion & Send Worker process."""

    environment: Literal["development", "staging", "production", "test"] = Field(
        default="development", alias="ENVIRONMENT"
    )
    db: DatabaseSettings = Field(default_factory=DatabaseSettings)
    redis: RedisSettings = Field(default_factory=RedisSettings)
    providers: EmailProviderSettings = Field(default_factory=EmailProviderSettings)
    worker: WorkerSettings = Field(default_factory=WorkerSettings)
    observability: ObservabilitySettings = Field(default_factory=ObservabilitySettings)


class AutomationWorkerSettings(BaseAppConfig):
    """Configuration consumed specifically by the Automation Worker process."""

    environment: Literal["development", "staging", "production", "test"] = Field(
        default="development", alias="ENVIRONMENT"
    )
    db: DatabaseSettings = Field(default_factory=DatabaseSettings)
    redis: RedisSettings = Field(default_factory=RedisSettings)
    worker: WorkerSettings = Field(default_factory=WorkerSettings)
    observability: ObservabilitySettings = Field(default_factory=ObservabilitySettings)


class Settings(BaseAppConfig):
    """Master composite settings for local development and unified tooling."""

    app_name: str = Field(default="ProxiPilot Backend", alias="APP_NAME")
    environment: Literal["development", "staging", "production", "test"] = Field(
        default="development", alias="ENVIRONMENT"
    )
    debug: bool = Field(default=False, alias="DEBUG")
    port: int = Field(default=8000, alias="PORT")
    host: str = Field(default="0.0.0.0", alias="HOST")
    cors_origins: List[str] = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000"], alias="CORS_ORIGINS"
    )
    frontend_url: str = Field(default="http://localhost:3000", alias="FRONTEND_URL")

    db: DatabaseSettings = Field(default_factory=DatabaseSettings)
    redis: RedisSettings = Field(default_factory=RedisSettings)
    qdrant: QdrantSettings = Field(default_factory=QdrantSettings)
    embedding: EmbeddingSettings = Field(default_factory=EmbeddingSettings)
    security: SecuritySettings = Field(default_factory=SecuritySettings)
    auth: AuthSettings = Field(default_factory=AuthSettings)
    providers: EmailProviderSettings = Field(default_factory=EmailProviderSettings)
    llm: LlmSettings = Field(default_factory=LlmSettings)
    worker: WorkerSettings = Field(default_factory=WorkerSettings)
    observability: ObservabilitySettings = Field(default_factory=ObservabilitySettings)
    storage: StorageSettings = Field(default_factory=StorageSettings)
    parser: ParserSettings = Field(default_factory=ParserSettings)
    knowledge_import: KnowledgeImportSettings = Field(default_factory=KnowledgeImportSettings)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Singleton getter for master settings."""
    return Settings()


@lru_cache(maxsize=1)
def get_api_settings() -> ApiSettings:
    """Singleton getter for API service scoped settings."""
    return ApiSettings()


@lru_cache(maxsize=1)
def get_ai_worker_settings() -> AiWorkerSettings:
    """Singleton getter for AI worker scoped settings."""
    return AiWorkerSettings()


@lru_cache(maxsize=1)
def get_email_worker_settings() -> EmailWorkerSettings:
    """Singleton getter for Email worker scoped settings."""
    return EmailWorkerSettings()


@lru_cache(maxsize=1)
def get_automation_worker_settings() -> AutomationWorkerSettings:
    """Singleton getter for Automation worker scoped settings."""
    return AutomationWorkerSettings()


class TransactionalEmailSettings(BaseAppConfig):
    """System email sent by ProxiPilot itself (verification and password-reset codes).

    EMAIL_DELIVERY selects how mail leaves:
      - smtp:   any SMTP service (SendGrid, AWS SES, Resend, Postmark, Google Workspace relay)
      - twilio: Twilio Email REST API (POST comms.twilio.com/v1/Emails, API key SID + secret)
      - log:    the default; sends nothing and only logs. Fine locally, but users never receive codes.
    """

    email_delivery: Literal["log", "smtp", "twilio"] = Field(default="log", alias="EMAIL_DELIVERY")
    smtp_host: str = Field(default="", alias="SMTP_HOST")
    smtp_port: int = Field(default=587, alias="SMTP_PORT")
    smtp_username: str = Field(default="", alias="SMTP_USERNAME")
    smtp_password: str = Field(default="", alias="SMTP_PASSWORD", repr=False)
    smtp_security: Literal["starttls", "ssl", "none"] = Field(default="starttls", alias="SMTP_SECURITY")
    smtp_timeout_seconds: float = Field(default=15.0, alias="SMTP_TIMEOUT_SECONDS")
    email_from_address: str = Field(default="no-reply@proxipilot.com", alias="EMAIL_FROM_ADDRESS")
    email_from_name: str = Field(default="ProxiPilot", alias="EMAIL_FROM_NAME")
    email_reply_to: str = Field(default="", alias="EMAIL_REPLY_TO")
    twilio_api_key_sid: str = Field(default="", alias="TWILIO_API_KEY_SID")
    twilio_api_key_secret: str = Field(default="", alias="TWILIO_API_KEY_SECRET", repr=False)
    twilio_email_api_url: str = Field(
        default="https://comms.twilio.com/v1/Emails", alias="TWILIO_EMAIL_API_URL"
    )

    @model_validator(mode="after")
    def _require_provider_details(self) -> "TransactionalEmailSettings":
        if self.email_delivery == "smtp" and not (self.smtp_host and self.email_from_address):
            raise ValueError("EMAIL_DELIVERY=smtp needs SMTP_HOST and EMAIL_FROM_ADDRESS.")
        if self.email_delivery == "twilio" and not (
            self.twilio_api_key_sid and self.twilio_api_key_secret and self.email_from_address
        ):
            raise ValueError(
                "EMAIL_DELIVERY=twilio needs TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET and EMAIL_FROM_ADDRESS."
            )
        return self


@lru_cache(maxsize=1)
def get_transactional_email_settings() -> TransactionalEmailSettings:
    """Singleton getter for system email delivery settings."""
    return TransactionalEmailSettings()
