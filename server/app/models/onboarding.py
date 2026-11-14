"""Onboarding Domain Models.

Tables owned by this module:
- organization_onboarding_states: Authoritative server-side step completion tracking
- business_profiles: Business description and product/service information
- workspace_preferences: Timezone, AI response style, language preferences

Architectural rules:
- OnboardingState is ALWAYS server-authoritative. Frontend store is UX-only draft state.
- Step completion order: account → organization → business → workspace → completed
- Dashboard access requires onboarding_complete = True (enforced at API middleware).
- BusinessProfile belongs to the organization, not the user.
- WorkspacePreferences are organization-level defaults (user overrides can be added later).
- Onboarding state maps to the EXACT fields in the frontend registration store.
"""

import uuid
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.organization import Organization, User


class OnboardingState(Base, TimestampMixin):
    """Authoritative server-side onboarding progress for an organization.

    Maps exactly to the frontend RegistrationStep type:
    account → organization → business → workspace → completed

    Security invariant:
    - `onboarding_complete` = True is required to access /dashboard.
    - Frontend cannot self-report this; it is set by the backend.
    """

    __tablename__ = "organization_onboarding_states"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"obs_{uuid.uuid4().hex}",
    )
    organization_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
        comment="One onboarding state per organization.",
    )
    user_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="User who initiated onboarding (org owner).",
    )
    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="onboarding_state",
        foreign_keys=[organization_id],
    )
    user: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[user_id],
    )

    # Step completion flags
    account_complete: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
        comment="True after email verified and account created.",
    )
    organization_complete: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
        comment="True after organization step submitted.",
    )
    business_complete: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
        comment="True after business step submitted.",
    )
    workspace_complete: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
        comment="True after workspace step submitted.",
    )
    onboarding_complete: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, index=True,
        comment="True when all 4 steps are complete. Required for dashboard access.",
    )

    # Lifecycle timestamps
    account_completed_at: Mapped[str] = mapped_column(String(64), nullable=True, default=None)
    organization_completed_at: Mapped[str] = mapped_column(String(64), nullable=True, default=None)
    business_completed_at: Mapped[str] = mapped_column(String(64), nullable=True, default=None)
    workspace_completed_at: Mapped[str] = mapped_column(String(64), nullable=True, default=None)
    onboarding_completed_at: Mapped[str] = mapped_column(String(64), nullable=True, default=None)

    @property
    def is_completed(self) -> bool:
        """Convenience alias matching OnboardingStateResponse.is_completed."""
        return self.onboarding_complete

    def __repr__(self) -> str:
        return (
            f"<OnboardingState org={self.organization_id} "
            f"complete={self.onboarding_complete}>"
        )


class BusinessProfile(Base, TimestampMixin):
    """Business description and profile for an organization.

    Stores the data submitted in the frontend BusinessStepForm.
    Maps exactly to BusinessDraft in the registration store:
    - businessDescription → description
    - customerType → customer_type
    - industryServed → industry_served
    - productsServices → products_services
    - additionalDetails → additional_context

    This is the authoritative source for business context fed into the AI knowledge pipeline.
    """

    __tablename__ = "business_profiles"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"bp_{uuid.uuid4().hex}",
    )
    organization_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
        comment="One business profile per organization.",
    )
    organization: Mapped["Organization"] = relationship(
        "Organization",
        foreign_keys=[organization_id],
    )

    # Maps directly to frontend BusinessDraft fields
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="What the business does. Maps to businessDescription field.",
    )
    customer_type: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        default=None,
        comment="Who the business serves. Maps to customerType field.",
    )
    industry_served: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        default=None,
        comment="Industry/category served. Maps to industryServed field.",
    )
    products_services: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Main products or services. Maps to productsServices field.",
    )
    additional_context: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        default=None,
        comment="Additional details. Maps to additionalDetails field.",
    )

    def __repr__(self) -> str:
        return f"<BusinessProfile id={self.id} org={self.organization_id}>"


class WorkspacePreferences(Base, TimestampMixin):
    """Organization-level workspace preferences.

    Stores the data submitted in the frontend WorkspaceStepForm.
    Maps exactly to WorkspaceDraft in the registration store:
    - timezone → timezone
    - responseStyle → default_response_style
    - language → language

    These are organization-level defaults used by the AI response generation pipeline.
    User-level overrides can be implemented in a future phase.
    """

    __tablename__ = "workspace_preferences"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"wp_{uuid.uuid4().hex}",
    )
    organization_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
        comment="One workspace preferences record per organization.",
    )
    organization: Mapped["Organization"] = relationship(
        "Organization",
        foreign_keys=[organization_id],
    )

    # Maps directly to frontend WorkspaceDraft fields
    timezone: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        default="Asia/Kolkata (GMT +5:30)",
        comment="Organization primary timezone. Maps to timezone field.",
    )
    default_response_style: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="Professional",
        comment=(
            "Default AI response style: Professional | Friendly | Concise | Executive. "
            "Maps to responseStyle field."
        ),
    )
    language: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="English",
        comment="Default response language. Maps to language field.",
    )

    def __repr__(self) -> str:
        return (
            f"<WorkspacePreferences id={self.id} "
            f"org={self.organization_id} tz={self.timezone}>"
        )
