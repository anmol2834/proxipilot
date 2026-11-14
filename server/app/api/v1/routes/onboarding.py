"""Onboarding, Business Profile, and Workspace Preferences API Routes.

Endpoints:
- GET /api/v1/onboarding/state: Resolve user's authoritative onboarding step & next route.
- GET /api/v1/organizations/{id}/business-profile: Fetch organization business profile.
- PATCH /api/v1/organizations/{id}/business-profile: Save/update business profile.
- GET /api/v1/organizations/{id}/preferences: Fetch workspace preferences.
- PATCH /api/v1/organizations/{id}/preferences: Save/update workspace preferences & complete onboarding.
"""

from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.contracts.onboarding import (
    BusinessProfileCreateUpdateRequest,
    BusinessProfileResponse,
    OnboardingStateResponse,
    WorkspacePreferencesResponse,
    WorkspacePreferencesUpdateRequest,
)
from app.core.database import get_db
from app.core.security import TokenPayload, get_current_user
from app.services.onboarding import onboarding_service

router = APIRouter(tags=["Onboarding & Multi-Tenant Setup"])


@router.get(
    "/onboarding/state",
    response_model=Dict[str, Any],
    summary="Get authoritative onboarding state",
    description="Resolves where the user currently stands in the onboarding progression and returns the exact next route.",
)
async def get_onboarding_state(
    db: AsyncSession = Depends(get_db),
    user_payload: TokenPayload = Depends(get_current_user),
    header_org_id: Optional[str] = Header(None, alias="X-Organization-Id"),
    query_org_id: Optional[str] = Query(None, alias="organization_id"),
) -> Dict[str, Any]:
    target_org_id = header_org_id or query_org_id
    state = await onboarding_service.resolve_onboarding_state(
        db=db,
        user_id=user_payload.sub,
        organization_id=target_org_id,
    )
    return {
        "success": True,
        "data": state.model_dump(mode="json"),
    }


@router.get(
    "/onboarding/activation-status",
    response_model=Dict[str, Any],
    summary="Get authoritative workspace activation status",
    description="Resolves real database counts for connected mailboxes and indexed knowledge items.",
)
async def get_activation_status(
    db: AsyncSession = Depends(get_db),
    user_payload: TokenPayload = Depends(get_current_user),
    header_org_id: Optional[str] = Header(None, alias="X-Organization-Id"),
    query_org_id: Optional[str] = Query(None, alias="organization_id"),
) -> Dict[str, Any]:
    target_org_id = header_org_id or query_org_id or user_payload.tenant_id
    status_data = await onboarding_service.resolve_activation_status(
        db=db,
        user_id=user_payload.sub,
        organization_id=target_org_id,
    )
    return {
        "success": True,
        "data": status_data,
    }


@router.get(
    "/organizations/{id}/business-profile",
    summary="Get organization business profile",
    description="Retrieves the business profile for an organization. Requires verified membership.",
)
async def get_business_profile(
    id: str,
    db: AsyncSession = Depends(get_db),
    user_payload: TokenPayload = Depends(get_current_user),
) -> Dict[str, Any]:
    profile = await onboarding_service.get_business_profile(
        db=db,
        user_id=user_payload.sub,
        organization_id=id,
    )
    return {
        "success": True,
        "data": profile.model_dump(mode="json") if profile else None,
    }


@router.patch(
    "/organizations/{id}/business-profile",
    summary="Save organization business profile",
    description="Persists or updates the business description and service profile. Advances onboarding step 3.",
)
@router.post(
    "/organizations/{id}/business-profile",
    include_in_schema=False,
)
async def save_business_profile(
    id: str,
    payload: BusinessProfileCreateUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user_payload: TokenPayload = Depends(get_current_user),
) -> Dict[str, Any]:
    profile = await onboarding_service.save_business_profile(
        db=db,
        user_id=user_payload.sub,
        organization_id=id,
        payload=payload,
    )
    return {
        "success": True,
        "data": profile.model_dump(mode="json"),
    }


@router.get(
    "/organizations/{id}/preferences",
    summary="Get workspace preferences",
    description="Retrieves timezone and AI response preferences for an organization.",
)
async def get_workspace_preferences(
    id: str,
    db: AsyncSession = Depends(get_db),
    user_payload: TokenPayload = Depends(get_current_user),
) -> Dict[str, Any]:
    prefs = await onboarding_service.get_workspace_preferences(
        db=db,
        user_id=user_payload.sub,
        organization_id=id,
    )
    return {
        "success": True,
        "data": prefs.model_dump(mode="json"),
    }


@router.patch(
    "/organizations/{id}/preferences",
    summary="Save workspace preferences",
    description="Persists timezone, language, and AI style. Finalizes the onboarding flow.",
)
@router.post(
    "/organizations/{id}/preferences",
    include_in_schema=False,
)
async def save_workspace_preferences(
    id: str,
    payload: WorkspacePreferencesUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user_payload: TokenPayload = Depends(get_current_user),
) -> Dict[str, Any]:
    prefs = await onboarding_service.save_workspace_preferences(
        db=db,
        user_id=user_payload.sub,
        organization_id=id,
        payload=payload,
    )
    return {
        "success": True,
        "data": prefs.model_dump(mode="json"),
    }
