"""SQLAlchemy Models Package — Consolidated Alembic Discovery.

IMPORTANT: ALL model classes must be imported here so that:
1. Alembic autogenerate discovers all tables via Base.metadata.
2. SQLAlchemy relationship resolution works correctly at startup.
3. A single `from app.models import Base` gives access to all mapped tables.

Mapping inventory (28 canonical domain tables):
- Organization, User, OrganizationMember (OrganizationMembership)
- Role, Permission, RolePermission
- ConnectedIntegrationAccount, OAuthCredentialMetadata
- EmailThread, EmailMessage, AttachmentMetadata
- KnowledgeItem, KnowledgeVersion, BusinessEntity
- AIRun, Evidence, AIResponse
- OutboundMessage
- HumanReview
- AuthenticationIdentity, Session, EmailVerificationChallenge
- OnboardingState, BusinessProfile, WorkspacePreferences
"""

from app.models.base import Base, TenantAwareMixin, TimestampMixin

# Organization & Multi-Tenant RBAC Domain
from app.models.organization import (
    MemberRole,
    MembershipStatus,
    OrgPlanTier,
    OrgStatus,
    Organization,
    OrganizationMember,
    OrganizationMembership,
    Permission,
    Role,
    RolePermission,
    SystemRole,
    User,
)

# Integrations Domain
from app.models.integration import (
    ConnectedIntegrationAccount,
    ConnectionHealthStatus,
    CursorSyncState,
    EmailProvider,
    IntegrationStatus,
    OAuthCredentialMetadata,
    ProviderEvent,
    ProviderEventStatus,
    SyncCursor,
)

# Inbox Domain
from app.models.inbox import (
    AttachmentMetadata,
    EmailMessage,
    EmailThread,
    LeadIntent,
    MessageDirection,
    ThreadStatus,
    TrustedSender,
)

# Knowledge Domain
from app.models.knowledge import (
    AttributeValueType,
    BusinessEntity,
    ImportJob,
    ImportJobStage,
    ImportJobStatus,
    KnowledgeAttribute,
    KnowledgeAttributeDefinition,
    KnowledgeCategory,
    KnowledgeItem,
    KnowledgeLifecycleStatus,
    KnowledgeSchemaProfile,
    KnowledgeSemanticChunk,
    KnowledgeSource,
    KnowledgeSourceStatus,
    KnowledgeSourceType,
    KnowledgeVersion,
    SourceAuthorityLevel,
)

# AI Domain
from app.models.ai import (
    AIResponse,
    AIRun,
    AIPipelineStage,
    AIRunStatus,
    Evidence,
    EvidenceSourceType,
    ResponseApprovalStatus,
)

# Outbound Domain
from app.models.outbound import (
    DeliveryStatus,
    OutboundMessage,
    ThreadPresentedEntity,
)

# Outbox Domain (Phase 10.0)
from app.models.outbox import (
    OutboxEvent,
    OutboxStatus,
)

# Review Domain
from app.models.review import (
    HumanReview,
    ReviewPriority,
    ReviewStatus,
    TriageReason,
)

# Auth Domain
from app.models.auth import (
    AccountStatus,
    AuthenticationIdentity,
    AuthProvider,
    EmailVerificationChallenge,
    Session,
)

# Onboarding Domain
from app.models.onboarding import (
    BusinessProfile,
    OnboardingState,
    WorkspacePreferences,
)

# Thread & Conversation Memory
from app.models.thread_memory import ThreadMemory

# Organizational Experience Memory
from app.models.practice import OrgPractice, PracticeSituation, PracticeStatus

# Communication Style Memory
from app.models.style import StyleProfile, StyleProfileStatus, StyleScope

# Decision & Commitment Memory
from app.models.commitment import (
    Commitment,
    CommitmentCategory,
    CommitmentKind,
    CommitmentParty,
    CommitmentStatus,
)

# Feedback & Outcome Memory
from app.models.feedback import (
    DraftFeedback,
    FeedbackAction,
    FeedbackLesson,
    FeedbackReason,
    LessonStatus,
    OutcomeType,
    ResponseOutcome,
)

# Contact & Relationship Memory
from app.models.contact import (
    Contact,
    ContactFact,
    ContactFactSource,
    ContactFactStatus,
    ContactFactType,
    ContactType,
)

# Audit Domain
from app.models.audit import (
    AuditAction,
    AuditActorType,
    AuditEvent,
)

__all__ = [
    # Base
    "Base",
    "TenantAwareMixin",
    "TimestampMixin",
    # Organization & RBAC
    "Organization",
    "User",
    "OrganizationMember",
    "OrganizationMembership",
    "Role",
    "Permission",
    "RolePermission",
    "OrgPlanTier",
    "OrgStatus",
    "MembershipStatus",
    "SystemRole",
    "MemberRole",
    # Integration
    "ConnectedIntegrationAccount",
    "OAuthCredentialMetadata",
    "SyncCursor",
    "ProviderEvent",
    "EmailProvider",
    "IntegrationStatus",
    "ConnectionHealthStatus",
    "CursorSyncState",
    "ProviderEventStatus",
    # Thread & Conversation Memory
    "ThreadMemory",
    # Organizational Experience Memory
    "OrgPractice",
    "PracticeSituation",
    "PracticeStatus",
    # Communication Style Memory
    "StyleProfile",
    "StyleProfileStatus",
    "StyleScope",
    # Decision & Commitment Memory
    "Commitment",
    "CommitmentCategory",
    "CommitmentKind",
    "CommitmentParty",
    "CommitmentStatus",
    # Feedback & Outcome Memory
    "DraftFeedback",
    "FeedbackAction",
    "FeedbackLesson",
    "FeedbackReason",
    "LessonStatus",
    "OutcomeType",
    "ResponseOutcome",
    # Contact & Relationship Memory
    "Contact",
    "ContactFact",
    "ContactFactSource",
    "ContactFactStatus",
    "ContactFactType",
    "ContactType",
    # Inbox
    "EmailThread",
    "EmailMessage",
    "AttachmentMetadata",
    "ThreadStatus",
    "LeadIntent",
    "MessageDirection",
    "TrustedSender",
    # Knowledge
    "KnowledgeItem",
    "KnowledgeVersion",
    "KnowledgeSource",
    "KnowledgeSourceStatus",
    "ImportJob",
    "ImportJobStatus",
    "ImportJobStage",
    "KnowledgeAttribute",
    "KnowledgeAttributeDefinition",
    "KnowledgeSchemaProfile",
    "KnowledgeSemanticChunk",
    "BusinessEntity",
    "KnowledgeCategory",
    "KnowledgeSourceType",
    "SourceAuthorityLevel",
    "KnowledgeLifecycleStatus",
    "AttributeValueType",
    # AI
    "AIRun",
    "Evidence",
    "AIResponse",
    "AIPipelineStage",
    "AIRunStatus",
    "EvidenceSourceType",
    "ResponseApprovalStatus",
    # Outbound
    "OutboundMessage",
    "DeliveryStatus",
    # Outbox (Phase 10.0)
    "OutboxEvent",
    "OutboxStatus",
    # Review
    "HumanReview",
    "ReviewStatus",
    "ReviewPriority",
    "TriageReason",
    # Auth
    "AuthenticationIdentity",
    "Session",
    "EmailVerificationChallenge",
    "AuthProvider",
    "AccountStatus",
    # Onboarding
    "OnboardingState",
    "BusinessProfile",
    "WorkspacePreferences",
    # Audit
    "AuditEvent",
    "AuditAction",
    "AuditActorType",
]
