"""Authentication API Contracts & Validation Schemas.

Strict Input Validation & Standardized Output Envelopes.
"""

from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    """Initial account registration request."""

    first_name: str = Field(min_length=1, max_length=100, description="User's first name")
    last_name: str = Field(min_length=1, max_length=100, description="User's last name")
    email: EmailStr = Field(description="Primary work email address")
    password: str = Field(min_length=8, max_length=128, description="Plaintext password")
    agreed_to_terms: bool = Field(default=True, description="Consent to terms and privacy policy")


class SignupResponse(BaseModel):
    """Response returned upon account registration."""

    user_id: str
    email: str
    challenge_id: str
    status: str
    message: str = "Verification code dispatched to email."


class VerifyOtpRequest(BaseModel):
    """Email verification challenge verification request."""

    email: EmailStr
    challenge_id: str = Field(description="Challenge ID returned from signup or resend")
    otp: str = Field(min_length=6, max_length=6, description="6-digit verification code")


class VerifyOtpResponse(BaseModel):
    """Response returned upon successful OTP verification."""

    user_id: str
    email: str
    is_verified: bool
    access_token: str
    session_id: str
    token_type: str = "bearer"
    message: str = "Email verified successfully."


class ResendOtpRequest(BaseModel):
    """Request to resend OTP for an existing challenge."""

    challenge_id: str = Field(description="Active challenge ID")
    email: EmailStr


class ResendOtpResponse(BaseModel):
    """Response returned upon OTP resend dispatch."""

    challenge_id: str
    cooldown_seconds: int = 45
    status: str = "DISPATCHED"
    message: str = "New verification code dispatched."


class SigninRequest(BaseModel):
    """Email and password sign-in request."""

    email: EmailStr
    password: str = Field(min_length=1, description="Account password")
    remember_me: bool = Field(default=False, description="Long-lived session flag")


class SigninResponse(BaseModel):
    """Response returned upon successful credential validation."""

    user_id: str
    email: str
    access_token: str
    session_id: str
    token_type: str = "bearer"
    organization_id: Optional[str] = None
    role: Optional[str] = None


class UserOrgSummary(BaseModel):
    """Summary of an organization the user belongs to."""

    id: str
    organization_id: Optional[str] = None
    name: str
    slug: str
    role: str
    status: str
    member_count: int = 0


class UserMeResponse(BaseModel):
    """Profile of the currently authenticated user."""

    id: str
    user_id: Optional[str] = None
    email: str
    full_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    is_verified: bool
    status: str
    primary_organization_id: Optional[str] = None
    organizations: List[UserOrgSummary] = []
    # Sign-ins completed after registration (0 = still in the first session).
    login_count: int = 0
