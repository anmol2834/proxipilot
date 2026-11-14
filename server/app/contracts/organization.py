"""Organization & Multi-Tenant RBAC Contracts & Schemas.

Covers:
- Organization creation & update payloads
- Organization response & context payloads
- Member & role response schemas
- Canonical data protection: No mass-assignment of internal fields (plan, status, system flags).
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator


class OrganizationCreateRequest(BaseModel):
    """Schema for POST /organizations (maps directly to Frontend Step 2 form)."""

    name: str = Field(
        ...,
        min_length=2,
        max_length=255,
        description="Organization or company name",
        examples=["Acme Inc."],
    )
    website: str = Field(
        ...,
        min_length=3,
        max_length=2048,
        description="Company website URL or domain",
        examples=["https://acme.com", "acme.com"],
    )
    industry: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Industry category selected during onboarding",
        examples=["Technology & SaaS"],
    )
    company_size: Optional[str] = Field(
        default=None,
        max_length=64,
        description="Company employee range",
        examples=["11-50 employees"],
    )

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        trimmed = v.strip()
        if len(trimmed) < 2:
            raise ValueError("Organization name must be at least 2 characters long")
        return trimmed

    @field_validator("website")
    @classmethod
    def normalize_website(cls, v: str) -> str:
        trimmed = v.strip().lower()
        if not trimmed.startswith(("http://", "https://")):
            trimmed = f"https://{trimmed}"
        return trimmed


class OrganizationUpdateRequest(BaseModel):
    """Schema for PATCH /organizations/{id} (strictly controlled mutable fields)."""

    name: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=255,
        description="Updated organization name",
    )
    website: Optional[str] = Field(
        default=None,
        max_length=2048,
        description="Updated website URL",
    )
    industry: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Updated industry category",
    )
    company_size: Optional[str] = Field(
        default=None,
        max_length=64,
        description="Updated company size range",
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            trimmed = v.strip()
            if len(trimmed) < 2:
                raise ValueError("Organization name must be at least 2 characters long")
            return trimmed
        return v

    @field_validator("website")
    @classmethod
    def validate_website(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.strip():
            trimmed = v.strip().lower()
            if not trimmed.startswith(("http://", "https://")):
                trimmed = f"https://{trimmed}"
            return trimmed
        return v


class OrganizationResponse(BaseModel):
    """Public organization representation."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    slug: str
    website: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    status: str
    plan_tier: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class MembershipResponse(BaseModel):
    """User membership details within an organization."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    organization_id: str
    user_id: str
    role: str
    status: str
    created_at: datetime


class OrganizationContextResponse(BaseModel):
    """Comprehensive tenant context returned upon login, switch, or creation."""

    organization: OrganizationResponse
    membership: MembershipResponse
    permissions: List[str] = Field(
        default_factory=list,
        description="Granular permission keys active for the authenticated user in this tenant",
    )


class OrganizationListItem(BaseModel):
    """Summary item for GET /organizations (listing user's organizations)."""

    id: str
    name: str
    slug: str
    website: Optional[str] = None
    role: str
    status: str
    is_primary: bool = False
