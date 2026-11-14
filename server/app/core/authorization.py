"""Central Authorization Service — Enterprise Multi-Tenant Foundation.

Security Rules:
1. Authorization is 100% server-side. Frontend permission state is UX-only.
2. Every protected resource verification establishes tenant boundaries:
   resource.organization_id == current_organization.id
3. Permissions are resolved via Role -> RolePermission -> Permission.
4. NO scattered `if role == "owner"` or `if role == "admin"`.
5. Inactive, suspended, or removed memberships are denied all access.
"""

from typing import Optional, Set
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.core.logging import logger
from app.models.organization import (
    MembershipStatus,
    OrganizationMember,
    Permission,
    Role,
    RolePermission,
)


class AuthorizationError(HTTPException):
    """Exception raised when an authorization or permission check fails."""

    def __init__(self, detail: str = "Access denied: insufficient permissions"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )


class TenantMismatchError(HTTPException):
    """Exception raised when a resource does not belong to the active tenant."""

    def __init__(self, detail: str = "Resource not found or access denied"):
        # Prevent IDOR enumeration by returning 404 or 403
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
        )


class AuthorizationService:
    """Central authority for resolving user permissions and enforcing RBAC within a tenant."""

    async def get_membership(
        self,
        db: AsyncSession,
        user_id: str,
        organization_id: str,
    ) -> Optional[OrganizationMember]:
        """Fetch active membership with role in a single fast joined round-trip."""
        from sqlalchemy.orm import joinedload
        stmt = (
            select(OrganizationMember)
            .where(
                OrganizationMember.user_id == user_id,
                OrganizationMember.organization_id == organization_id,
            )
            .options(
                joinedload(OrganizationMember.role)
            )
            .limit(1)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_permissions(
        self,
        db: AsyncSession,
        user_id: str,
        organization_id: str,
    ) -> Set[str]:
        """Return the set of permission keys granted to the user in this organization.
        
        Cached in Redis with sub-millisecond response times.
        """
        import json
        from app.core.redis import redis_manager

        cache_key = f"tenant:perms:{user_id}:{organization_id}"
        redis_client = redis_manager.client
        try:
            cached = await redis_client.get(cache_key)
            if cached:
                return set(json.loads(cached))
        except Exception:
            pass

        # Single high-performance JOIN query
        stmt = (
            select(Permission.key)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .join(Role, Role.id == RolePermission.role_id)
            .join(OrganizationMember, OrganizationMember.role_id == Role.id)
            .where(
                OrganizationMember.user_id == user_id,
                OrganizationMember.organization_id == organization_id,
                OrganizationMember.status == MembershipStatus.ACTIVE,
            )
        )
        result = await db.execute(stmt)
        perms = set(result.scalars().all())

        try:
            await redis_client.set(cache_key, json.dumps(list(perms)), ex=300)
        except Exception:
            pass

        return perms

    async def invalidate_permissions(
        self,
        user_id: str,
        organization_id: str,
    ) -> None:
        """Evict cached permissions upon role or membership changes."""
        try:
            from app.core.redis import redis_manager
            await redis_manager.client.delete(f"tenant:perms:{user_id}:{organization_id}")
        except Exception:
            pass

    async def can(
        self,
        db: AsyncSession,
        user_id: str,
        organization_id: str,
        permission_key: str,
    ) -> bool:
        """Check if user holds the specified permission within the organization."""
        permissions = await self.get_permissions(db, user_id, organization_id)
        return permission_key in permissions

    async def require(
        self,
        db: AsyncSession,
        user_id: str,
        organization_id: str,
        permission_key: str,
    ) -> OrganizationMember:
        """Enforce permission requirement; raises AuthorizationError if not authorized."""
        member = await self.get_membership(db, user_id, organization_id)
        if not member:
            logger.warn(
                "Access rejected: caller is not a member of the organization",
                user_id=user_id,
                organization_id=organization_id,
                permission=permission_key,
            )
            raise AuthorizationError("Caller is not a member of the requested organization.")

        if member.status != MembershipStatus.ACTIVE:
            logger.warn(
                "Access rejected: membership is not active",
                user_id=user_id,
                organization_id=organization_id,
                status=member.status,
                permission=permission_key,
            )
            raise AuthorizationError(f"Membership is {member.status.lower()}. Access denied.")

        granted_keys = await self.get_permissions(db, user_id, organization_id)

        if permission_key not in granted_keys:
            logger.warn(
                "Access rejected: missing required permission",
                user_id=user_id,
                organization_id=organization_id,
                role=member.role.name if member.role else "NONE",
                required_permission=permission_key,
            )
            raise AuthorizationError(
                f"Action requires permission '{permission_key}', which is not granted to role '{member.role.name if member.role else 'Unknown'}'."
            )

        return member

    def verify_resource_tenancy(
        self,
        resource_org_id: str,
        current_org_id: str,
    ) -> None:
        """Verify that a target resource belongs to the current active organization.

        Prevents Insecure Direct Object Reference (IDOR) attacks across tenants.
        """
        if resource_org_id != current_org_id:
            logger.warn(
                "IDOR attempt prevented: resource tenant mismatch",
                resource_tenant_id=resource_org_id,
                current_tenant_id=current_org_id,
            )
            raise TenantMismatchError()


# Global Singleton
authorization_service = AuthorizationService()
