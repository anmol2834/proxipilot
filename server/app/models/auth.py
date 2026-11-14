"""Authentication Domain Models.

Tables owned by this module:
- authentication_identities: Provider-neutral identity records (PASSWORD/GOOGLE/MICROSOFT)
- sessions: Server-backed session records for revocation tracking
- email_verification_challenges: OTP challenge metadata (secrets stored in Redis)

Architectural rules:
- AuthenticationIdentity is decoupled from users. One user can have multiple identities.
- PASSWORD identity: provider_subject = user_id, credential validated via users.hashed_password.
- OAuth identities: provider_subject = stable provider sub/oid claim (never email).
- Session revocation is enforced server-side. Expired/revoked sessions are rejected at middleware.
- EmailVerificationChallenge stores only challenge metadata. The OTP hash lives in Redis only.
- challenge_id is the only linkage between the frontend OTP form and the Redis OTP state.
"""

import uuid
from typing import TYPE_CHECKING
from enum import Enum
from sqlalchemy import Boolean, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.organization import User


class AuthProvider(str, Enum):
    """Supported authentication providers."""

    PASSWORD = "PASSWORD"
    GOOGLE = "GOOGLE"
    MICROSOFT = "MICROSOFT"


class AccountStatus(str, Enum):
    """User account lifecycle status."""

    PENDING_VERIFICATION = "PENDING_VERIFICATION"  # Email not yet verified
    ACTIVE = "ACTIVE"                               # Verified and able to sign in
    SUSPENDED = "SUSPENDED"                         # Admin-suspended (can still view but limited)
    DISABLED = "DISABLED"                           # Permanently disabled


class AuthenticationIdentity(Base, TimestampMixin):
    """Provider-neutral authentication identity record.

    Invariants:
    - (user_id, provider) must be unique per user.
    - (provider, provider_subject) must be globally unique (prevents account duplication).
    - For PASSWORD: provider_subject = user_id. Hashed password stored on the User record.
    - For GOOGLE/MICROSOFT: provider_subject = stable provider account ID (sub/oid claim).
    """

    __tablename__ = "authentication_identities"
    __table_args__ = (
        UniqueConstraint("user_id", "provider", name="uq_identity_user_provider"),
        UniqueConstraint("provider", "provider_subject", name="uq_identity_provider_subject"),
    )

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"aid_{uuid.uuid4().hex}",
    )
    user_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user: Mapped["User"] = relationship(
        "User",
        back_populates="identities",
        foreign_keys=[user_id],
    )
    provider: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        index=True,
        comment="Authentication provider: PASSWORD | GOOGLE | MICROSOFT",
    )
    provider_subject: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
        comment=(
            "Provider-stable unique identifier. "
            "For PASSWORD: user_id. "
            "For OAuth: provider sub/oid claim."
        ),
    )
    provider_email: Mapped[str] = mapped_column(
        String(320),
        nullable=True,
        default=None,
        comment="Email associated with this provider identity (for display/debugging only)",
    )
    provider_display_name: Mapped[str] = mapped_column(
        String(255),
        nullable=True,
        default=None,
    )
    provider_avatar_url: Mapped[str] = mapped_column(
        String(2048),
        nullable=True,
        default=None,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_used_at: Mapped[str] = mapped_column(
        String(64),
        nullable=True,
        default=None,
        index=True,
    )

    def __repr__(self) -> str:
        return (
            f"<AuthenticationIdentity id={self.id} "
            f"user={self.user_id} provider={self.provider}>"
        )


class Session(Base, TimestampMixin):
    """Server-backed session record for revocation and multi-device management.

    One session = one login event on one device.
    The session_identifier is the jti (JWT ID) embedded in the access token.
    When a session is revoked, the jti is blocklisted and validation fails.

    Refresh token rotation:
    - Each refresh creates a new session record (or updates refresh_token_hash).
    - Reuse of an old refresh token → entire session family is revoked (suspicious activity).
    """

    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"ses_{uuid.uuid4().hex}",
    )
    user_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user: Mapped["User"] = relationship(
        "User",
        back_populates="sessions",
        foreign_keys=[user_id],
    )
    # The JWT jti claim — used to block specific tokens
    jti: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        unique=True,
        index=True,
        comment="JWT ID embedded in access token. Used for revocation blocklisting.",
    )
    # Hashed refresh token identifier (not the raw token)
    refresh_token_hash: Mapped[str] = mapped_column(
        String(128),
        nullable=True,
        default=None,
        comment="SHA-256 hash of the refresh token. Used to verify refresh requests.",
    )
    # Device/context metadata (non-sensitive, for display in "Active sessions" UI)
    user_agent: Mapped[str] = mapped_column(
        String(512),
        nullable=True,
        default=None,
    )
    ip_address: Mapped[str] = mapped_column(
        String(64),
        nullable=True,
        default=None,
    )
    # Lifecycle
    expires_at: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        comment="ISO 8601 UTC expiry. Sessions past this are automatically invalid.",
    )
    last_seen_at: Mapped[str] = mapped_column(
        String(64),
        nullable=True,
        default=None,
    )
    revoked_at: Mapped[str] = mapped_column(
        String(64),
        nullable=True,
        default=None,
        index=True,
    )
    revocation_reason: Mapped[str] = mapped_column(
        String(64),
        nullable=True,
        default=None,
        comment="signout | token_reuse | admin | expired",
    )

    def __repr__(self) -> str:
        return f"<Session id={self.id} user={self.user_id} revoked={self.revoked_at is not None}>"


class EmailVerificationChallenge(Base, TimestampMixin):
    """OTP challenge metadata stored in Postgres.

    IMPORTANT: The actual OTP code and its hash are stored ONLY in Redis.
    This table stores only challenge metadata for audit and ownership validation.

    Security invariants:
    - challenge_id is cryptographically random — unpredictable to attackers.
    - Ownership: only the challenge's user_id can verify it.
    - is_used prevents replay after successful verification.
    - is_invalidated prevents use after max_attempts exceeded or manually cancelled.
    """

    __tablename__ = "email_verification_challenges"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"chl_{uuid.uuid4().hex}",
        comment="challenge_id returned to frontend. Used as Redis OTP key.",
    )
    user_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user: Mapped["User"] = relationship(
        "User",
        foreign_keys=[user_id],
    )
    email: Mapped[str] = mapped_column(
        String(320),
        nullable=False,
        comment="Email address the OTP was sent to.",
    )
    purpose: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="EMAIL_VERIFICATION",
        comment="EMAIL_VERIFICATION | PASSWORD_RESET",
    )
    is_used: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="True after successful verification. Prevents replay.",
    )
    is_invalidated: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="True if max attempts exceeded or manually cancelled.",
    )
    attempt_count: Mapped[int] = mapped_column(
        default=0,
        nullable=False,
        comment="Number of failed verification attempts.",
    )
    resend_count: Mapped[int] = mapped_column(
        default=0,
        nullable=False,
        comment="Number of OTP resends requested.",
    )
    expires_at: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        comment="ISO 8601 UTC expiry of the OTP.",
    )
    used_at: Mapped[str] = mapped_column(String(64), nullable=True, default=None)

    def __repr__(self) -> str:
        return (
            f"<EmailVerificationChallenge id={self.id} "
            f"user={self.user_id} used={self.is_used}>"
        )
