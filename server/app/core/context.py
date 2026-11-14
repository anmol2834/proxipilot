"""Tenant Context Resolution & Dependency Injection — Enterprise Multi-Tenant Foundation.

Resolution Flow:
Request
  ↓
Authenticated Session / Token (`get_current_user`)
  ↓
Target Organization Resolution (Path param > Header `X-Organization-Id` > Query > Primary Org)
  ↓
Authoritative Membership Verification in PostgreSQL (Active status enforced)
  ↓
Current Organization Context (`TenantContext`)
  ↓
Permission Check (`require_permission`)
  ↓
Business Logic

Security Invariants:
- NEVER blindly trust `X-Organization-Id` without active membership verification.
- Users can belong to multiple organizations; context switches are safe and verified.
- Does NOT pollute the global User model with a hardcoded organization_id.
"""

import time
from dataclasses import dataclass
from typing import Callable, Dict, Optional, Set, Tuple
from fastapi import Depends, Header, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.logging import logger
from app.core.security import TokenPayload, get_current_user
from app.models.organization import (
    MembershipStatus,
    Organization,
    OrganizationMember,
    Role,
    RolePermission,
)


@dataclass
class TenantContext:
    """Validated, high-performance request context containing active tenant identity and RBAC."""

    user_id: str
    organization_id: str
    organization: Organization
    membership: OrganizationMember
    role_name: str
    permissions: Set[str]

    def has_permission(self, permission_key: str) -> bool:
        """Helper to quickly check permission within domain logic."""
        return permission_key in self.permissions


# In-memory TTL cache for tenant context: (user_id, org_id) -> (expires_at, TenantContext)
_tenant_context_cache: Dict[Tuple[str, str], Tuple[float, TenantContext]] = {}
_user_default_org_cache: Dict[str, Tuple[float, str]] = {}


async def get_tenant_context(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user_payload: TokenPayload = Depends(get_current_user),
    header_org_id: Optional[str] = Header(None, alias="X-Organization-Id"),
    query_org_id: Optional[str] = Query(None, alias="organization_id"),
) -> TenantContext:
    """Canonical FastAPI dependency to resolve and authenticate tenant context.

    Prioritizes organization identification:
    1. Route path parameter (`id` on `/organizations/{id}` or `org_id` / `organization_id`)
    2. Header `X-Organization-Id`
    3. Query parameter `organization_id`
    4. Default: User's first active organization membership
    """
    user_id = user_payload.sub

    # Determine requested organization ID
    target_org_id: Optional[str] = None

    # Check path parameters
    path_params = request.path_params
    if "organization_id" in path_params:
        target_org_id = path_params["organization_id"]
    elif "id" in path_params and ("/organizations/" in request.url.path or request.url.path.endswith(f"/organizations/{path_params['id']}")):
        target_org_id = path_params["id"]

    # Fallback to header, query param, or token tenant_id
    if not target_org_id:
        target_org_id = header_org_id or query_org_id or user_payload.tenant_id

    # If no org ID specified at all, check fast RAM cache before querying database
    if not target_org_id:
        cached_user_org = _user_default_org_cache.get(user_id)
        now_mono = time.monotonic()
        if cached_user_org and now_mono < cached_user_org[0]:
            target_org_id = cached_user_org[1]
        else:
            default_stmt = (
                select(OrganizationMember.organization_id)
                .where(
                    OrganizationMember.user_id == user_id,
                    OrganizationMember.status == MembershipStatus.ACTIVE,
                )
                .order_by(OrganizationMember.created_at.asc())
                .limit(1)
            )
            default_res = await db.execute(default_stmt)
            target_org_id = default_res.scalar_one_or_none()
            if target_org_id:
                _user_default_org_cache[user_id] = (now_mono + 60.0, target_org_id)

    if not target_org_id:
        logger.warn("Tenant resolution failed: user has no active organization", user_id=user_id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No organization specified and user belongs to no active organizations.",
        )

    # Fast in-memory cache check (30s TTL) for rapid successive requests / polling
    cache_key = (user_id, target_org_id)
    now_mono = time.monotonic()
    if cache_key in _tenant_context_cache:
        cached_exp, cached_ctx = _tenant_context_cache[cache_key]
        if now_mono < cached_exp:
            return cached_ctx
        else:
            _tenant_context_cache.pop(cache_key, None)

    # Authoritative verification in PostgreSQL with single-roundtrip eager loading
    stmt = (
        select(OrganizationMember)
        .where(
            OrganizationMember.user_id == user_id,
            OrganizationMember.organization_id == target_org_id,
        )
        .options(
            selectinload(OrganizationMember.organization),
            selectinload(OrganizationMember.role)
            .selectinload(Role.permissions)
            .selectinload(RolePermission.permission),
        )
    )
    res = await db.execute(stmt)
    member: Optional[OrganizationMember] = res.scalar_one_or_none()

    if not member:
        logger.warn(
            "Access denied: user is not a member of the requested organization",
            user_id=user_id,
            organization_id=target_org_id,
        )
        # 403 Forbidden to prevent cross-tenant enumeration
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to requested organization.",
        )

    if member.status != MembershipStatus.ACTIVE:
        logger.warn(
            "Access denied: membership is inactive",
            user_id=user_id,
            organization_id=target_org_id,
            status=member.status,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Organization membership is {member.status.lower()}.",
        )

    if not member.organization or not member.organization.is_active or member.organization.status != "ACTIVE":
        logger.warn(
            "Access denied: organization is suspended or inactive",
            organization_id=target_org_id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization is inactive or suspended.",
        )

    # Resolve active permissions set
    permissions: Set[str] = set()
    role_name = member.role.name if member.role else "UNKNOWN"
    if member.role and member.role.permissions:
        permissions = {
            rp.permission.key
            for rp in member.role.permissions
            if rp.permission and rp.permission.key
        }

    ctx = TenantContext(
        user_id=user_id,
        organization_id=target_org_id,
        organization=member.organization,
        membership=member,
        role_name=role_name,
        permissions=permissions,
    )
    _tenant_context_cache[cache_key] = (time.monotonic() + 30.0, ctx)
    return ctx


def require_permission(permission_key: str) -> Callable:
    """FastAPI dependency factory to enforce fine-grained RBAC permission on an endpoint."""

    async def _dependency(
        context: TenantContext = Depends(get_tenant_context),
    ) -> TenantContext:
        if permission_key not in context.permissions:
            logger.warn(
                "Access denied: caller lacks required permission",
                user_id=context.user_id,
                organization_id=context.organization_id,
                role=context.role_name,
                required_permission=permission_key,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Action requires permission '{permission_key}', which is not granted to role '{context.role_name}'.",
            )
        return context

    return _dependency
