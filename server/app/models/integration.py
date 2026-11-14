"""Integration Domain Models.

Tables owned by this module:
- connected_integration_accounts: One row per connected Gmail / Outlook mailbox
- oauth_credential_metadata: Provider-specific OAuth token & profile metadata
- sync_cursors: Durable cursors (Gmail historyId) and watch expiration metadata
- provider_events: Audit & durable idempotency log for incoming provider push notifications

Architectural rules:
- An organization can connect MULTIPLE Gmail accounts (multi-account model).
- OAuth tokens (access_token, refresh_token) are stored encrypted at rest with AES-256-GCM.
- Raw token values are NEVER stored plaintext. Only encrypted ciphertext.
- All operations are strictly organization (tenant_id) scoped.
- Synchronization cursors advance ONLY transactionally upon successful change processing.
- provider_events guarantees deterministic deduplication via composite unique constraint.
"""

import uuid
from enum import Enum
from typing import List, Optional
from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TenantAwareMixin, TimestampMixin


class EmailProvider(str, Enum):
    """Supported email provider adapters."""

    GMAIL = "gmail"
    OUTLOOK = "outlook"
    SMTP = "smtp"


class IntegrationStatus(str, Enum):
    """Lifecycle status of a connected integration account."""

    ACTIVE = "active"
    CONNECTED = "connected"
    CONNECTING = "connecting"
    SYNCING = "syncing"
    DEGRADED = "degraded"
    REAUTH_REQUIRED = "reauth_required"
    DISCONNECTED = "disconnected"
    ERROR = "error"


class ConnectionHealthStatus(str, Enum):
    """User-facing connection health status."""

    HEALTHY = "healthy"
    SYNCING = "syncing"
    DEGRADED = "degraded"
    REAUTH_REQUIRED = "reauth_required"
    DISCONNECTED = "disconnected"
    ERROR = "error"


class CursorSyncState(str, Enum):
    """Synchronization state of a mailbox cursor."""

    IDLE = "idle"
    SYNCING = "syncing"
    RECOVERING = "recovering"
    FAILED = "failed"


class ProviderEventStatus(str, Enum):
    """Status of an ingested provider push event."""

    RECEIVED = "received"
    QUEUED = "queued"
    PROCESSED = "processed"
    DUPLICATE = "duplicate"
    FAILED = "failed"


class ConnectedIntegrationAccount(Base, TenantAwareMixin):
    """One row per connected email mailbox within an organization.

    Multi-account invariant:
    - Multiple ConnectedIntegrationAccount rows can reference the same organization_id.
    - Each represents a distinct email address / mailbox.
    - The tuple (organization_id, email_address, provider) is unique for active connections.
    """

    __tablename__ = "connected_integration_accounts"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"int_{uuid.uuid4().hex}",
    )
    # tenant_id comes from TenantAwareMixin (= organization_id)
    provider: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=EmailProvider.GMAIL.value,
        index=True,
        comment="Email provider: gmail | outlook | smtp",
    )
    email_address: Mapped[str] = mapped_column(
        String(320),
        nullable=False,
        index=True,
        comment="The connected mailbox email address",
    )
    display_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        default=None,
        comment="User-facing display name for this account",
    )
    provider_account_id: Mapped[Optional[str]] = mapped_column(
        String(256),
        nullable=True,
        default=None,
        comment="Google sub / subject claim identifying the provider account",
    )

    # Encrypted credential storage — AES-256-GCM encrypted, NEVER plaintext
    access_token_encrypted: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        default=None,
        comment="AES-256-GCM encrypted OAuth access token ciphertext",
    )
    refresh_token_encrypted: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        default=None,
        comment="AES-256-GCM encrypted OAuth refresh token ciphertext",
    )
    token_expires_at: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
        comment="ISO 8601 UTC timestamp when access token expires",
    )
    scopes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        default=None,
        comment="Space-separated OAuth scopes granted",
    )

    # Sync and Lifecycle state
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=IntegrationStatus.CONNECTED.value,
        index=True,
    )
    connection_status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=ConnectionHealthStatus.HEALTHY.value,
        index=True,
    )
    sync_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    automation_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    
    last_connected_at: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
    )
    last_disconnected_at: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
    )
    last_synced_at: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
        comment="Last successful sync timestamp",
    )
    last_successful_sync_at: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
    )
    last_event_received_at: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
    )
    last_error_code: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
    )
    last_error_at: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
    )
    last_history_id: Mapped[Optional[str]] = mapped_column(
        String(128),
        nullable=True,
        default=None,
        comment="Gmail historyId or delta token for incremental sync",
    )
    connected_by_user_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
        comment="User who initiated the OAuth flow",
    )

    # Relationships
    oauth_metadata: Mapped[Optional["OAuthCredentialMetadata"]] = relationship(
        back_populates="integration_account",
        cascade="all, delete-orphan",
        uselist=False,
    )
    sync_cursor: Mapped[Optional["SyncCursor"]] = relationship(
        back_populates="integration_account",
        cascade="all, delete-orphan",
        uselist=False,
    )
    provider_events: Mapped[List["ProviderEvent"]] = relationship(
        back_populates="integration_account",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return (
            f"<ConnectedIntegrationAccount id={self.id} "
            f"provider={self.provider} email={self.email_address} status={self.status}>"
        )


class OAuthCredentialMetadata(Base, TenantAwareMixin):
    """Provider-specific OAuth profile metadata for a connected account.

    Stores non-sensitive provider identifiers and profile data for display.
    """

    __tablename__ = "oauth_credential_metadata"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"oam_{uuid.uuid4().hex}",
    )
    integration_account_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("connected_integration_accounts.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    provider_account_id: Mapped[Optional[str]] = mapped_column(
        String(256),
        nullable=True,
        default=None,
        comment="Provider-internal subject/account ID (e.g. Google sub claim)",
    )
    provider_email: Mapped[Optional[str]] = mapped_column(
        String(320),
        nullable=True,
        default=None,
    )
    raw_profile_json: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        default=None,
        comment="Full provider profile JSON stored for debugging (no tokens)",
    )
    token_refresh_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_refresh_error: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        default=None,
    )

    # Relationships
    integration_account: Mapped["ConnectedIntegrationAccount"] = relationship(
        back_populates="oauth_metadata"
    )

    def __repr__(self) -> str:
        return (
            f"<OAuthCredentialMetadata id={self.id} "
            f"account={self.integration_account_id}>"
        )


class SyncCursor(Base, TenantAwareMixin):
    """Durable synchronization cursor and watch registration metadata.

    Contains:
    - Current historyId for incremental synchronization
    - Watch expiration timestamp from Gmail users.watch()
    - Failure tracking and sync state machine
    """

    __tablename__ = "sync_cursors"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"cur_{uuid.uuid4().hex}",
    )
    integration_account_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("connected_integration_accounts.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    provider: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="gmail",
        index=True,
    )
    cursor_type: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="history_id",
    )
    cursor_value: Mapped[Optional[str]] = mapped_column(
        String(128),
        nullable=True,
        default=None,
        comment="Gmail historyId for users.history.list",
    )
    sync_state: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=CursorSyncState.IDLE.value,
        index=True,
    )
    watch_resource_id: Mapped[Optional[str]] = mapped_column(
        String(128),
        nullable=True,
        default=None,
        comment="Google watch resource ID",
    )
    watch_expires_at: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
        index=True,
        comment="ISO 8601 UTC timestamp or epoch ms when watch registration expires",
    )
    last_successful_sync_at: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
    )
    last_attempted_sync_at: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
    )
    last_full_sync_at: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
    )
    last_failure_at: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
    )
    last_failure_code: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
    )

    # Relationships
    integration_account: Mapped["ConnectedIntegrationAccount"] = relationship(
        back_populates="sync_cursor"
    )

    __table_args__ = (
        Index("ix_sync_cursors_watch_renewal", "provider", "sync_state", "watch_expires_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<SyncCursor id={self.id} "
            f"account={self.integration_account_id} historyId={self.cursor_value}>"
        )


class ProviderEvent(Base, TenantAwareMixin):
    """Idempotency and observability log for incoming provider push notifications (Google Pub/Sub).

    Guarantees deterministic event deduplication via unique constraint on (provider, provider_event_id).
    """

    __tablename__ = "provider_events"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"pve_{uuid.uuid4().hex}",
    )
    integration_account_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        ForeignKey("connected_integration_accounts.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    provider: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="gmail",
        index=True,
    )
    provider_event_id: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        index=True,
        comment="Google Pub/Sub messageId or provider unique event ID",
    )
    event_type: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="gmail.mailbox_change",
    )
    event_payload_hash: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        comment="SHA-256 digest of notification payload for data integrity verification",
    )
    provider_timestamp: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        comment="Timestamp reported by provider message",
    )
    received_at: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        comment="ISO 8601 UTC timestamp when webhook accepted the event",
    )
    processed_at: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=ProviderEventStatus.RECEIVED.value,
        index=True,
    )
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_code: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
    )

    # Relationships
    integration_account: Mapped[Optional["ConnectedIntegrationAccount"]] = relationship(
        back_populates="provider_events"
    )

    __table_args__ = (
        UniqueConstraint("provider", "provider_event_id", name="uq_provider_events_provider_event_id"),
        Index("ix_provider_events_account_received", "integration_account_id", "received_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<ProviderEvent id={self.id} "
            f"provider={self.provider} event_id={self.provider_event_id} status={self.status}>"
        )
