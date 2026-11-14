"""Organization & Multi-Tenant RBAC API Routes.

Endpoints:
- POST /api/v1/organizations: Atomically create organization, assign OWNER role, sync onboarding.
- GET /api/v1/organizations: List all organizations the authenticated user belongs to.
- GET /api/v1/organizations/{id}: Retrieve organization profile + caller's RBAC context.
- PATCH /api/v1/organizations/{id}: Update organization profile (requires organization.update).
- GET /api/v1/organizations/{id}/context: Fetch current tenant context and active permissions.

Security:
- Authentication required on all routes.
- Access strictly scoped to confirmed organization membership.
- IDOR prevention: non-members cannot read or modify organization resources.
"""

from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.contracts.organization import (
    OrganizationContextResponse,
    OrganizationCreateRequest,
    OrganizationListItem,
    OrganizationResponse,
    OrganizationUpdateRequest,
)
from app.core.context import TenantContext, get_tenant_context, require_permission
from app.core.database import get_db
from app.core.security import TokenPayload, get_current_user
from app.services.organization import organization_service

router = APIRouter(prefix="/organizations", tags=["Organizations & Multi-Tenancy"])


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Create a new organization",
    description=(
        "Atomically creates a new organization, assigns the caller the OWNER system role, "
        "and updates the onboarding progress state. Transaction is strictly atomic."
    ),
)
async def create_organization(
    payload: OrganizationCreateRequest,
    db: AsyncSession = Depends(get_db),
    user_payload: TokenPayload = Depends(get_current_user),
) -> Dict[str, Any]:
    context = await organization_service.create_organization(
        db=db,
        user_id=user_payload.sub,
        payload=payload,
    )
    return {
        "success": True,
        "data": context.model_dump(mode="json"),
    }


@router.get(
    "",
    summary="List user's organizations",
    description="Returns all active organizations the authenticated user is currently a member of.",
)
async def list_organizations(
    db: AsyncSession = Depends(get_db),
    user_payload: TokenPayload = Depends(get_current_user),
) -> Dict[str, Any]:
    orgs = await organization_service.list_user_organizations(
        db=db,
        user_id=user_payload.sub,
    )
    return {
        "success": True,
        "data": [o.model_dump(mode="json") for o in orgs],
    }


@router.get(
    "/{id}",
    summary="Get organization details",
    description="Returns organization details and the caller's membership/permissions. Requires active membership.",
)
async def get_organization(
    id: str,
    db: AsyncSession = Depends(get_db),
    user_payload: TokenPayload = Depends(get_current_user),
) -> Dict[str, Any]:
    context = await organization_service.get_organization(
        db=db,
        user_id=user_payload.sub,
        organization_id=id,
    )
    return {
        "success": True,
        "data": context.model_dump(mode="json"),
    }


@router.patch(
    "/{id}",
    summary="Update organization details",
    description="Updates organization profile fields. Requires 'organization.update' permission.",
)
async def update_organization(
    id: str,
    payload: OrganizationUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user_payload: TokenPayload = Depends(get_current_user),
) -> Dict[str, Any]:
    updated_org = await organization_service.update_organization(
        db=db,
        user_id=user_payload.sub,
        organization_id=id,
        payload=payload,
    )
    return {
        "success": True,
        "data": updated_org.model_dump(mode="json"),
    }


@router.get(
    "/{id}/context",
    summary="Get active tenant context",
    description="Resolves caller tenant context, verifying active membership and listing all granted permissions.",
)
async def get_organization_context(
    context: TenantContext = Depends(get_tenant_context),
) -> Dict[str, Any]:
    return {
        "success": True,
        "data": {
            "organization_id": context.organization_id,
            "organization_name": context.organization.name,
            "organization_slug": context.organization.slug,
            "role": context.role_name,
            "membership_id": context.membership.id,
            "membership_status": context.membership.status,
            "permissions": sorted(list(context.permissions)),
        },
    }
