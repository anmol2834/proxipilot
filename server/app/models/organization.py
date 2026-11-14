"""Organization Domain Models — Enterprise Multi-Tenant Foundation.

Tables owned by this module:
- organizations: Tenant root entity (1 org = 1 tenant boundary)
- roles: Extensible system and org-scoped RBAC roles
- permissions: Canonical discrete permission keys
- role_permissions: N:M association between roles and permissions
- users: Global identity records (independent of organizations)
- organization_members: N:M link between users and organizations with role and status

Architectural rules:
- Users do NOT have an organization_id column; membership is N:M via organization_members.
- Role-based authorization is resolved via Role -> RolePermission -> Permission.
- Roles can be system-wide (organization_id IS NULL) or tenant-custom.
- Invariant: (organization_id, user_id) is unique.
- Invariant: (role_id, permission_id) is unique.
"""

from enum import Enum
from typing import List, Optional, TYPE_CHECKING
import uuid
from sqlalchemy import Boolean, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.auth import AuthenticationIdentity, Session
    from app.models.audit import AuditEvent
    from app.models.onboarding import OnboardingState


class OrgPlanTier(str, Enum):
    """Subscription plan tiers."""

    FREE = "free"
    STARTER = "starter"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"


class OrgStatus(str, Enum):
    """Organization lifecycle status."""

    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    ARCHIVED = "ARCHIVED"


class MembershipStatus(str, Enum):
    """Organization membership lifecycle status."""

    ACTIVE = "ACTIVE"
    INVITED = "INVITED"
    SUSPENDED = "SUSPENDED"
    REMOVED = "REMOVED"


class SystemRole(str, Enum):
    """Default system roles."""

    OWNER = "OWNER"
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"


# Backwards compatibility alias for code expecting MemberRole enum
class MemberRole(str, Enum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"


class Role(Base, TimestampMixin):
    """Extensible role definition.

    System roles have organization_id = None.
    Custom tenant roles have organization_id pointing to their owning tenant.
    """

    __tablename__ = "roles"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"rol_{uuid.uuid4().hex}",
    )
    name: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        comment="Role name, e.g. OWNER, ADMIN, MEMBER, or custom title",
    )
    description: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        default=None,
    )
    is_system_role: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        comment="True if built-in system role; false if custom per-tenant role",
    )
    organization_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        comment="NULL for global system roles; tenant ID for custom roles",
    )

    # Relationships
    permissions: Mapped[List["RolePermission"]] = relationship(
        "RolePermission",
        back_populates="role",
        cascade="all, delete-orphan",
    )
    members: Mapped[List["OrganizationMember"]] = relationship(
        "OrganizationMember",
        back_populates="role",
    )

    def __repr__(self) -> str:
        return f"<Role id={self.id} name={self.name} system={self.is_system_role}>"


class Permission(Base, TimestampMixin):
    """Canonical fine-grained permission key."""

    __tablename__ = "permissions"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"perm_{uuid.uuid4().hex}",
    )
    key: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        unique=True,
        index=True,
        comment="Stable permission key, e.g. organization.read, inbox.reply",
    )
    description: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        default=None,
    )

    # Relationships
    role_permissions: Mapped[List["RolePermission"]] = relationship(
        "RolePermission",
        back_populates="permission",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Permission id={self.id} key={self.key}>"


class RolePermission(Base, TimestampMixin):
    """Association between Role and Permission."""

    __tablename__ = "role_permissions"
    __table_args__ = (
        UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),
    )

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"rp_{uuid.uuid4().hex}",
    )
    role_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("roles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    permission_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("permissions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Relationships
    role: Mapped["Role"] = relationship("Role", back_populates="permissions")
    permission: Mapped["Permission"] = relationship("Permission", back_populates="role_permissions")

    def __repr__(self) -> str:
        return f"<RolePermission role_id={self.role_id} perm_id={self.permission_id}>"


class Organization(Base, TimestampMixin):
    """Tenant root entity. One organization = one isolated tenant boundary."""

    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"org_{uuid.uuid4().hex}",
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
        comment="URL-safe unique identifier for the organization",
    )
    website: Mapped[Optional[str]] = mapped_column(
        String(2048),
        nullable=True,
        default=None,
        comment="Organization primary website URL from onboarding step 2",
    )
    industry: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        default=None,
        comment="Industry category from onboarding step 2",
    )
    company_size: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
        comment="Team/Company size range from onboarding step 2",
    )
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=OrgStatus.ACTIVE,
        index=True,
        comment="Lifecycle status: ACTIVE | SUSPENDED | ARCHIVED",
    )
    plan_tier: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=OrgPlanTier.FREE,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    timezone: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True, default=None,
        comment="IANA zone for business deadlines; NULL = DEFAULT_BUSINESS_TIMEZONE",
    )
    max_integrations: Mapped[int] = mapped_column(default=5, nullable=False)
    max_members: Mapped[int] = mapped_column(default=10, nullable=False)
    created_by: Mapped[Optional[str]] = mapped_column(
        String(64),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="User ID of creator / initial owner",
    )

    # Relationships
    memberships: Mapped[List["OrganizationMember"]] = relationship(
        "OrganizationMember",
        back_populates="organization",
        cascade="all, delete-orphan",
    )
    creator: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[created_by],
    )
    audit_events: Mapped[List["AuditEvent"]] = relationship(
        "AuditEvent",
        back_populates="organization",
        cascade="all, delete-orphan",
        foreign_keys="[AuditEvent.organization_id]",
    )
    onboarding_state: Mapped[Optional["OnboardingState"]] = relationship(
        "OnboardingState",
        back_populates="organization",
        uselist=False,
        cascade="all, delete-orphan",
        foreign_keys="[OnboardingState.organization_id]",
    )

    def __repr__(self) -> str:
        return f"<Organization id={self.id} slug={self.slug} status={self.status}>"


class User(Base, TimestampMixin):
    """Global user identity record. Access to organizations is via OrganizationMember.

    A user can belong to multiple organizations with different roles.
    """

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"usr_{uuid.uuid4().hex}",
    )
    email: Mapped[str] = mapped_column(
        String(320),
        nullable=False,
        unique=True,
        index=True,
        comment="RFC 5321 max email length = 320 chars",
    )
    hashed_password: Mapped[str] = mapped_column(String(128), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    avatar_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True, default=None)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    last_login_at: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, default=None)

    # Relationships
    memberships: Mapped[List["OrganizationMember"]] = relationship(
        "OrganizationMember",
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="[OrganizationMember.user_id]",
    )
    identities: Mapped[List["AuthenticationIdentity"]] = relationship(
        "AuthenticationIdentity",
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="[AuthenticationIdentity.user_id]",
    )
    sessions: Mapped[List["Session"]] = relationship(
        "Session",
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="[Session.user_id]",
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email}>"


class OrganizationMember(Base, TimestampMixin):
    """N:M association between User and Organization with role and status.

    Invariants:
    - Each (organization_id, user_id) pair must be unique.
    - Role is resolved via foreign key to roles.id (never free text).
    """

    __tablename__ = "organization_members"
    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", name="uq_org_user_membership"),
        Index("ix_org_member_lookup", "user_id", "organization_id", "status"),
    )

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"mem_{uuid.uuid4().hex}",
    )
    organization_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("roles.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=MembershipStatus.ACTIVE,
        index=True,
        comment="ACTIVE | INVITED | SUSPENDED | REMOVED",
    )
    invited_by_user_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        default=None,
    )

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="memberships")
    user: Mapped["User"] = relationship("User", back_populates="memberships", foreign_keys=[user_id])
    role: Mapped["Role"] = relationship("Role", back_populates="members")

    def __repr__(self) -> str:
        return (
            f"<OrganizationMember org={self.organization_id} "
            f"user={self.user_id} role_id={self.role_id} status={self.status}>"
        )


# Backward compatibility alias
OrganizationMembership = OrganizationMember
