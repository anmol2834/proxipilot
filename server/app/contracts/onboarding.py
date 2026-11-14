"""Onboarding, Business Profile & Workspace Preference Contracts.

Defines:
- Authoritative Onboarding State representations
- Business Profile request & response schemas
- Workspace Preferences request & response schemas
- Canonical step enum mapping to frontend routes
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator


class OnboardingStepEnum(str, Enum):
    """Canonical onboarding step progression."""

    ACCOUNT = "account"
    ORGANIZATION = "organization"
    BUSINESS = "business"
    WORKSPACE = "workspace"
    COMPLETED = "completed"


STEP_ROUTES = {
    OnboardingStepEnum.ACCOUNT: "/signup",
    OnboardingStepEnum.ORGANIZATION: "/signup/organization",
    OnboardingStepEnum.BUSINESS: "/signup/business",
    OnboardingStepEnum.WORKSPACE: "/signup/workspace",
    OnboardingStepEnum.COMPLETED: "/dashboard",
}


class OnboardingStateResponse(BaseModel):
    """Server-authoritative onboarding progress."""

    model_config = ConfigDict(from_attributes=True)

    current_step: OnboardingStepEnum
    completed_steps: List[OnboardingStepEnum]
    is_completed: bool
    next_route: str
    organization_id: Optional[str] = None
    organization_name: Optional[str] = None


class BusinessProfileCreateUpdateRequest(BaseModel):
    """Schema for creating or updating an organization's business profile."""

    model_config = ConfigDict(populate_by_name=True)

    description: str = Field(
        ...,
        min_length=5,
        max_length=3000,
        validation_alias=AliasChoices("description", "businessDescription"),
        description="Detailed description of what the business does",
        examples=["We provide residential appliance repair services across the metro area."],
    )
    industry_served: str = Field(
        ...,
        min_length=2,
        max_length=255,
        validation_alias=AliasChoices("industry_served", "industry", "industryServed"),
        description="Primary industry or category served",
        examples=["Home Services & Maintenance"],
    )
    products_services: str = Field(
        ...,
        min_length=3,
        max_length=3000,
        validation_alias=AliasChoices("products_services", "main_products_services", "productsServices"),
        description="Key products and services offered",
        examples=["AC repair, refrigerator maintenance, washing machine servicing"],
    )
    customer_type: Optional[str] = Field(
        default=None,
        max_length=255,
        validation_alias=AliasChoices("customer_type", "customerType"),
        description="Target audience or client profile (B2B, B2C, Enterprise)",
        examples=["Homeowners and property managers"],
    )
    additional_context: Optional[str] = Field(
        default=None,
        max_length=5000,
        validation_alias=AliasChoices("additional_context", "additionalDetails"),
        description="Additional context, working hours, pricing notes, or service policies",
    )

    @field_validator("description", "products_services")
    @classmethod
    def clean_text(cls, v: str) -> str:
        trimmed = v.strip()
        if len(trimmed) < 3:
            raise ValueError("Field must contain meaningful text (minimum 3 characters)")
        return trimmed


class BusinessProfileResponse(BaseModel):
    """Public representation of an organization's business profile."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    organization_id: str
    description: str
    industry_served: Optional[str] = None
    products_services: str
    customer_type: Optional[str] = None
    additional_context: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class WorkspacePreferencesUpdateRequest(BaseModel):
    """Schema for organization workspace settings and AI response preferences."""

    model_config = ConfigDict(populate_by_name=True)

    timezone: str = Field(
        default="Asia/Kolkata (GMT +5:30)",
        max_length=128,
        description="Primary organization timezone",
        examples=["Asia/Kolkata (GMT +5:30)", "America/New_York (EST / GMT -5:00)"],
    )
    default_response_style: str = Field(
        default="Professional",
        max_length=64,
        validation_alias=AliasChoices("default_response_style", "response_style", "responseStyle"),
        description="Default AI tone / response style (Professional, Friendly, Concise, Executive)",
        examples=["Professional", "Friendly", "Concise", "Executive"],
    )
    language: str = Field(
        default="English",
        max_length=32,
        description="Default communication language",
        examples=["English", "Spanish", "French"],
    )

    @field_validator("default_response_style")
    @classmethod
    def validate_style(cls, v: str) -> str:
        valid_styles = {"Professional", "Friendly", "Concise", "Executive"}
        trimmed = v.strip().title()
        if trimmed not in valid_styles:
            # Fallback gracefully to Professional if unrecognized
            return "Professional"
        return trimmed


class WorkspacePreferencesResponse(BaseModel):
    """Public representation of organization workspace preferences."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    organization_id: str
    timezone: str
    default_response_style: str
    language: str
    created_at: datetime
    updated_at: datetime
