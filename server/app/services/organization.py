"""Organization Domain Service — Enterprise Multi-Tenant Foundation.

Core Responsibilities:
- Atomic Organization + OWNER Membership creation (transactional rollback on error)
- Collision-safe URL slug generation
- Server-side authoritative OWNER role resolution (Frontend role cannot be forged)
- Linkage to OnboardingState step completion
- Structured audit event emission
- Explicit PATCH validation preventing mass assignment
"""

from datetime import datetime, timezone
import re
from typing import Dict, List, Optional, Tuple
import uuid
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.contracts.organization import (
    MembershipResponse,
    OrganizationContextResponse,
    OrganizationCreateRequest,
    OrganizationListItem,
    OrganizationResponse,
    OrganizationUpdateRequest,
)
from app.core.authorization import authorization_service
from app.core.logging import logger
from app.models.audit import AuditAction
from app.models.onboarding import OnboardingState
from app.services.audit import audit_service
from app.models.organization import (
    MembershipStatus,
    Organization,
    OrganizationMember,
    OrgStatus,
    Role,
    RolePermission,
    SystemRole,
    User,
)


import asyncio

_SYSTEM_OWNER_ROLE_ID: Optional[str] = None


def slugify(text: str) -> str:
    """Generate a clean, URL-safe slug from a string."""
    cleaned = re.sub(r"[^\w\s-]", "", text).strip().lower()
    slug = re.sub(r"[-\s]+", "-", cleaned)
    return slug[:80] if slug else "org"


class OrganizationService:
    """Domain service managing organization lifecycle, ownership, and multi-tenancy."""

    async def _resolve_unique_slug(self, db: AsyncSession, base_name: str) -> str:
        """Generate a guaranteed unique URL slug for the organization in at most 1 round-trip."""
        base_slug = slugify(base_name)
        stmt = select(Organization.id).where(Organization.slug == base_slug).limit(1)
        res = await db.execute(stmt)
        if not res.scalar_one_or_none():
            return base_slug
        return f"{base_slug}-{uuid.uuid4().hex[:4]}"

    async def create_organization(
        self,
        db: AsyncSession,
        user_id: str,
        payload: OrganizationCreateRequest,
    ) -> OrganizationContextResponse:
        """Atomically create an organization, assign OWNER role to the creator, and advance onboarding.

        CRITICAL TRANSACTION: If any step fails, the entire transaction rolls back.
        Guarantees zero orphan organizations.
        """
        # Verify user existence and active status
        user_stmt = select(User).where(User.id == user_id).limit(1)
        user_res = await db.execute(user_stmt)
        user = user_res.scalar_one_or_none()
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive.",
            )

        # Resolve system OWNER role (cached in memory for O(1) resolution)
        global _SYSTEM_OWNER_ROLE_ID
        owner_role_id = _SYSTEM_OWNER_ROLE_ID
        if not owner_role_id:
            role_stmt = select(Role.id).where(
                Role.name == SystemRole.OWNER,
                Role.is_system_role.is_(True),
            ).limit(1)
            role_res = await db.execute(role_stmt)
            owner_role_id = role_res.scalar_one_or_none()
            if not owner_role_id:
                from app.core.rbac_seed import ensure_system_rbac
                await ensure_system_rbac(db)
                role_res = await db.execute(role_stmt)
                owner_role_id = role_res.scalar_one_or_none()
            if owner_role_id:
                _SYSTEM_OWNER_ROLE_ID = owner_role_id

        if not owner_role_id:
            logger.error("Database integrity error: System OWNER role could not be seeded.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="System role configuration could not be initialized.",
            )

        now_dt = datetime.now(timezone.utc)
        now_str = now_dt.isoformat()
        slug = await self._resolve_unique_slug(db, payload.name)

        try:
            # 1. Create Organization
            org = Organization(
                id=f"org_{uuid.uuid4().hex}",
                name=payload.name,
                slug=slug,
                website=payload.website,
                industry=payload.industry,
                company_size=payload.company_size,
                status=OrgStatus.ACTIVE,
                created_by=user_id,
                created_at=now_dt,
                updated_at=now_dt,
            )
            db.add(org)
            # Flush org immediately so organizations.id exists before child records and audit events
            await db.flush()

            # 2. Create Initial Membership with verified OWNER role
            member = OrganizationMember(
                id=f"mem_{uuid.uuid4().hex}",
                organization_id=org.id,
                user_id=user_id,
                role_id=owner_role_id,
                status=MembershipStatus.ACTIVE,
                created_at=now_dt,
                updated_at=now_dt,
            )
            db.add(member)
            await db.flush()

            # 3. Create initial Onboarding State for new org
            onboarding_state = OnboardingState(
                organization_id=org.id,
                user_id=user_id,
                account_complete=True,
                account_completed_at=now_str,
                organization_complete=True,
                organization_completed_at=now_str,
                created_at=now_dt,
                updated_at=now_dt,
            )
            db.add(onboarding_state)
            await db.flush()

            # Record audit events transactionally (adds to db session without separate flushes)
            await audit_service.record(
                db=db,
                action=AuditAction.ORGANIZATION_CREATED,
                resource_type="organization",
                resource_id=org.id,
                organization_id=org.id,
                actor_user_id=user_id,
                metadata={"name": org.name, "slug": org.slug, "plan_tier": org.plan_tier},
            )
            await audit_service.record(
                db=db,
                action=AuditAction.MEMBERSHIP_CREATED,
                resource_type="organization_member",
                resource_id=member.id,
                organization_id=org.id,
                actor_user_id=user_id,
                metadata={"role": SystemRole.OWNER, "status": MembershipStatus.ACTIVE},
            )

            # Company Info: seed the public projection from the facts just entered (same transaction,
            # no remote I/O; vectors are published after commit).
            from app.services import company_info
            ci_result = await company_info.refresh_after_owner_change(db, org.id, user_id, "registration")

            # Commit all inserts together in a single atomic database round trip
            await db.commit()
            if ci_result:
                company_info.schedule_sync(org.id, *ci_result, reason="created")

            # Evict and pre-seed caches for ultra-fast subsequent requests
            from app.services.onboarding import onboarding_service
            from app.contracts.onboarding import OnboardingStateResponse, OnboardingStepEnum, STEP_ROUTES
            await onboarding_service.invalidate_cache(user_id, org.id)

            # Pre-seed next onboarding state (BUSINESS) so frontend GET /api/v1/onboarding/state hits cache instantly
            next_state = OnboardingStateResponse(
                current_step=OnboardingStepEnum.BUSINESS,
                completed_steps=[OnboardingStepEnum.ACCOUNT, OnboardingStepEnum.ORGANIZATION],
                is_completed=False,
                next_route=STEP_ROUTES[OnboardingStepEnum.BUSINESS],
                organization_id=org.id,
                organization_name=org.name,
            )
            await asyncio.gather(
                onboarding_service._set_cached_state(f"onboarding:state:{user_id}:default", next_state),
                onboarding_service._set_cached_state(f"onboarding:state:{user_id}:{org.id}", next_state),
            )

            # Structured audit logging
            logger.info(
                "Audit: Organization and initial OWNER membership created",
                actor_user_id=user_id,
                organization_id=org.id,
                membership_id=member.id,
                role=SystemRole.OWNER,
                slug=org.slug,
            )

            # Fetch active permissions for response
            permissions = await authorization_service.get_permissions(db, user_id, org.id)

            return OrganizationContextResponse(
                organization=OrganizationResponse.model_validate(org),
                membership=MembershipResponse(
                    id=member.id,
                    organization_id=member.organization_id,
                    user_id=member.user_id,
                    role=SystemRole.OWNER,
                    status=member.status,
                    created_at=member.created_at,
                ),
                permissions=sorted(list(permissions)),
            )

        except Exception as exc:
            await db.rollback()
            logger.error(
                "Transaction failed during organization creation — rollback completed",
                error=str(exc),
                user_id=user_id,
            )
            raise

    async def get_organization(
        self,
        db: AsyncSession,
        user_id: str,
        organization_id: str,
    ) -> OrganizationContextResponse:
        """Fetch organization and membership details for an authorized member."""
        member = await authorization_service.require(
            db=db,
            user_id=user_id,
            organization_id=organization_id,
            permission_key="organization.read",
        )

        # Organization is loaded via member
        org_stmt = select(Organization).where(Organization.id == organization_id).limit(1)
        org_res = await db.execute(org_stmt)
        org = org_res.scalar_one_or_none()
        if not org:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")

        permissions = await authorization_service.get_permissions(db, user_id, organization_id)

        return OrganizationContextResponse(
            organization=OrganizationResponse.model_validate(org),
            membership=MembershipResponse(
                id=member.id,
                organization_id=member.organization_id,
                user_id=member.user_id,
                role=member.role.name if member.role else "UNKNOWN",
                status=member.status,
                created_at=member.created_at,
            ),
            permissions=sorted(list(permissions)),
        )

    async def update_organization(
        self,
        db: AsyncSession,
        user_id: str,
        organization_id: str,
        payload: OrganizationUpdateRequest,
    ) -> OrganizationResponse:
        """Update mutable organization fields (guarded by organization.update permission)."""
        await authorization_service.require(
            db=db,
            user_id=user_id,
            organization_id=organization_id,
            permission_key="organization.update",
        )

        org_stmt = select(Organization).where(Organization.id == organization_id).limit(1)
        org_res = await db.execute(org_stmt)
        org = org_res.scalar_one_or_none()
        if not org:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")

        # Explicit assignment prevents mass-assignment vulnerabilities
        changes: Dict[str, Tuple[Optional[str], Optional[str]]] = {}
        if payload.name is not None and payload.name != org.name:
            changes["name"] = (org.name, payload.name)
            org.name = payload.name
        if payload.website is not None and payload.website != org.website:
            changes["website"] = (org.website, payload.website)
            org.website = payload.website
        if payload.industry is not None and payload.industry != org.industry:
            changes["industry"] = (org.industry, payload.industry)
            org.industry = payload.industry
        if payload.company_size is not None and payload.company_size != org.company_size:
            changes["company_size"] = (org.company_size, payload.company_size)
            org.company_size = payload.company_size

        if changes:
            await audit_service.record(
                db=db,
                action=AuditAction.ORGANIZATION_UPDATED,
                resource_type="organization",
                resource_id=organization_id,
                organization_id=organization_id,
                actor_user_id=user_id,
                metadata={"changed_fields": list(changes.keys())},
            )
            from app.services import company_info
            ci_result = None
            if set(changes) & {"name", "website", "industry"}:
                ci_result = await company_info.refresh_after_owner_change(db, organization_id, user_id, "organization edited")
            await db.commit()
            if ci_result:
                company_info.schedule_sync(organization_id, *ci_result)
            await db.refresh(org)
            logger.info(
                "Audit: Organization updated",
                actor_user_id=user_id,
                organization_id=organization_id,
                changes=changes,
            )

        return OrganizationResponse.model_validate(org)

    async def list_user_organizations(
        self,
        db: AsyncSession,
        user_id: str,
    ) -> List[OrganizationListItem]:
        """List all active organizations the user is a member of."""
        stmt = (
            select(OrganizationMember)
            .where(
                OrganizationMember.user_id == user_id,
                OrganizationMember.status == MembershipStatus.ACTIVE,
            )
            .options(
                selectinload(OrganizationMember.organization),
                selectinload(OrganizationMember.role),
            )
            .order_by(OrganizationMember.created_at.asc())
        )
        res = await db.execute(stmt)
        members = res.scalars().all()

        items: List[OrganizationListItem] = []
        for idx, m in enumerate(members):
            if m.organization and m.organization.is_active:
                items.append(
                    OrganizationListItem(
                        id=m.organization.id,
                        name=m.organization.name,
                        slug=m.organization.slug,
                        website=m.organization.website,
                        role=m.role.name if m.role else "MEMBER",
                        status=m.status,
                        is_primary=(idx == 0),
                    )
                )
        return items


# Global Singleton
organization_service = OrganizationService()
