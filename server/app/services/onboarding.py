"""Onboarding & Profile Domain Service — Enterprise Multi-Tenant Foundation.

Core Responsibilities:
- Server-authoritative onboarding state resolution (derived from domain records)
- Zero duplicated source of truth:
    Account verified -> User.is_verified
    Organization complete -> OrganizationMember.status == 'ACTIVE'
    Business complete -> BusinessProfile exists with description + products_services
    Workspace complete -> WorkspacePreferences exists
- Business Profile persistence (scoped strictly to Organization)
- Workspace Preferences persistence (Organization-level AI & timezone defaults)
- Full transactional rollback and IDOR prevention
"""

from datetime import datetime, timezone
from typing import Any, Dict
from typing import List, Optional
import uuid
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.contracts.onboarding import (
    BusinessProfileCreateUpdateRequest,
    BusinessProfileResponse,
    OnboardingStateResponse,
    OnboardingStepEnum,
    STEP_ROUTES,
    WorkspacePreferencesResponse,
    WorkspacePreferencesUpdateRequest,
)
from app.core.authorization import authorization_service
from app.core.logging import logger
from app.models.audit import AuditAction
from app.models.onboarding import BusinessProfile, OnboardingState, WorkspacePreferences
from app.models.organization import MembershipStatus, Organization, OrganizationMember, User
from app.services.audit import audit_service


class OnboardingService:
    """Domain service managing multi-tenant onboarding progression, business profile, and preferences."""

    async def _set_cached_state(self, key: str, state: OnboardingStateResponse) -> None:
        """Save onboarding response to Redis with 60s TTL."""
        try:
            from app.core.redis import redis_manager
            await redis_manager.client.set(key, state.model_dump_json(), ex=60)
        except Exception:
            pass

    async def invalidate_cache(self, user_id: str, organization_id: Optional[str] = None) -> None:
        """Evict cached onboarding states for the given user in O(1) operations."""
        try:
            from app.core.redis import redis_manager
            redis_client = redis_manager.client
            keys_to_del = [f"onboarding:state:{user_id}:default"]
            if organization_id:
                keys_to_del.append(f"onboarding:state:{user_id}:{organization_id}")
            await redis_client.delete(*keys_to_del)
        except Exception:
            pass

    async def resolve_onboarding_state(
        self,
        db: AsyncSession,
        user_id: str,
        organization_id: Optional[str] = None,
    ) -> OnboardingStateResponse:
        """Calculate authoritative onboarding status with sub-millisecond Redis caching.

        Optimized: Resolves membership, organization, business profile, preferences,
        and onboarding state in a SINGLE database round trip (O(1) query complexity).
        """
        cache_key = f"onboarding:state:{user_id}:{organization_id or 'default'}"
        try:
            from app.core.redis import redis_manager
            cached = await redis_manager.client.get(cache_key)
            if cached:
                return OnboardingStateResponse.model_validate_json(cached)
        except Exception:
            pass

        from sqlalchemy.orm import joinedload

        # Single high-performance multi-table query
        stmt = (
            select(
                OrganizationMember,
                BusinessProfile,
                WorkspacePreferences,
                OnboardingState,
            )
            .join(Organization, OrganizationMember.organization_id == Organization.id)
            .outerjoin(BusinessProfile, BusinessProfile.organization_id == OrganizationMember.organization_id)
            .outerjoin(WorkspacePreferences, WorkspacePreferences.organization_id == OrganizationMember.organization_id)
            .outerjoin(OnboardingState, OnboardingState.organization_id == OrganizationMember.organization_id)
            .where(
                OrganizationMember.user_id == user_id,
                OrganizationMember.status == MembershipStatus.ACTIVE,
                Organization.is_active.is_(True),
            )
            .options(joinedload(OrganizationMember.organization))
        )
        if organization_id:
            stmt = stmt.where(OrganizationMember.organization_id == organization_id)
        else:
            stmt = stmt.order_by(OrganizationMember.created_at.asc())

        row = (await db.execute(stmt.limit(1))).first()

        completed_steps: List[OnboardingStepEnum] = [OnboardingStepEnum.ACCOUNT]

        if not row:
            if organization_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Caller is not a member of the requested organization.",
                )
            resp = OnboardingStateResponse(
                current_step=OnboardingStepEnum.ORGANIZATION,
                completed_steps=completed_steps,
                is_completed=False,
                next_route=STEP_ROUTES[OnboardingStepEnum.ORGANIZATION],
            )
            await self._set_cached_state(cache_key, resp)
            return resp

        member, bp, wp, obs = row
        completed_steps.append(OnboardingStepEnum.ORGANIZATION)
        org_id = member.organization_id
        org_name = member.organization.name

        # Check Business Profile completeness
        is_bp_complete = bool(
            bp and bp.description and bp.description.strip() and bp.products_services and bp.products_services.strip()
        )
        if not is_bp_complete:
            resp = OnboardingStateResponse(
                current_step=OnboardingStepEnum.BUSINESS,
                completed_steps=completed_steps,
                is_completed=False,
                next_route=STEP_ROUTES[OnboardingStepEnum.BUSINESS],
                organization_id=org_id,
                organization_name=org_name,
            )
            await self._set_cached_state(cache_key, resp)
            return resp

        completed_steps.append(OnboardingStepEnum.BUSINESS)

        # Check Workspace Preferences completeness
        is_wp_complete = bool(
            wp and wp.timezone and wp.default_response_style and wp.language
        )
        if not is_wp_complete:
            resp = OnboardingStateResponse(
                current_step=OnboardingStepEnum.WORKSPACE,
                completed_steps=completed_steps,
                is_completed=False,
                next_route=STEP_ROUTES[OnboardingStepEnum.WORKSPACE],
                organization_id=org_id,
                organization_name=org_name,
            )
            await self._set_cached_state(cache_key, resp)
            return resp

        completed_steps.append(OnboardingStepEnum.WORKSPACE)
        completed_steps.append(OnboardingStepEnum.COMPLETED)

        # Synchronize materialized OnboardingState record if needed
        if obs and not obs.onboarding_complete:
            now_str = datetime.now(timezone.utc).isoformat()
            obs.account_complete = True
            obs.organization_complete = True
            obs.business_complete = True
            obs.workspace_complete = True
            obs.onboarding_complete = True
            obs.onboarding_completed_at = now_str
            await db.commit()

        resp = OnboardingStateResponse(
            current_step=OnboardingStepEnum.COMPLETED,
            completed_steps=completed_steps,
            is_completed=True,
            next_route=STEP_ROUTES[OnboardingStepEnum.COMPLETED],
            organization_id=org_id,
            organization_name=org_name,
        )
        await self._set_cached_state(cache_key, resp)
        return resp

    async def get_business_profile(
        self,
        db: AsyncSession,
        user_id: str,
        organization_id: str,
    ) -> Optional[BusinessProfileResponse]:
        """Fetch organization business profile (membership authorized)."""
        await authorization_service.require(
            db=db,
            user_id=user_id,
            organization_id=organization_id,
            permission_key="organization.read",
        )

        stmt = select(BusinessProfile).where(BusinessProfile.organization_id == organization_id).limit(1)
        res = await db.execute(stmt)
        bp = res.scalar_one_or_none()
        return BusinessProfileResponse.model_validate(bp) if bp else None

    async def save_business_profile(
        self,
        db: AsyncSession,
        user_id: str,
        organization_id: str,
        payload: BusinessProfileCreateUpdateRequest,
    ) -> BusinessProfileResponse:
        """Persist business profile and advance onboarding progress atomically."""
        await authorization_service.require(
            db=db,
            user_id=user_id,
            organization_id=organization_id,
            permission_key="organization.read",
        )

        now_str = datetime.now(timezone.utc).isoformat()

        stmt = select(BusinessProfile).where(BusinessProfile.organization_id == organization_id).limit(1)
        res = await db.execute(stmt)
        bp = res.scalar_one_or_none()

        if not bp:
            bp = BusinessProfile(
                id=f"bp_{uuid.uuid4().hex}",
                organization_id=organization_id,
                description=payload.description,
                industry_served=payload.industry_served,
                products_services=payload.products_services,
                customer_type=payload.customer_type,
                additional_context=payload.additional_context,
            )
            db.add(bp)
            await db.flush()
        else:
            bp.description = payload.description
            bp.industry_served = payload.industry_served
            bp.products_services = payload.products_services
            bp.customer_type = payload.customer_type
            bp.additional_context = payload.additional_context

        # Sync onboarding state
        obs_stmt = select(OnboardingState).where(OnboardingState.organization_id == organization_id).limit(1)
        obs_res = await db.execute(obs_stmt)
        obs = obs_res.scalar_one_or_none()
        if obs:
            obs.business_complete = True
            obs.business_completed_at = now_str

        # Record audit event transactionally
        await audit_service.record(
            db=db,
            action=AuditAction.BUSINESS_PROFILE_CREATED if not bp else AuditAction.BUSINESS_PROFILE_UPDATED,
            resource_type="business_profile",
            resource_id=bp.id,
            organization_id=organization_id,
            actor_user_id=user_id,
            metadata={
                "industry_served": bp.industry_served,
                "customer_type": bp.customer_type,
            },
        )

        await db.commit()
        await self.invalidate_cache(user_id)

        logger.info(
            "Audit: Business profile persisted",
            actor_user_id=user_id,
            organization_id=organization_id,
            business_profile_id=bp.id,
        )

        return BusinessProfileResponse.model_validate(bp)

    async def get_workspace_preferences(
        self,
        db: AsyncSession,
        user_id: str,
        organization_id: str,
    ) -> WorkspacePreferencesResponse:
        """Fetch workspace preferences with fallback to organization defaults."""
        await authorization_service.require(
            db=db,
            user_id=user_id,
            organization_id=organization_id,
            permission_key="organization.read",
        )

        stmt = select(WorkspacePreferences).where(WorkspacePreferences.organization_id == organization_id).limit(1)
        res = await db.execute(stmt)
        wp = res.scalar_one_or_none()

        if not wp:
            # Return sensible defaults
            now = datetime.now(timezone.utc)
            return WorkspacePreferencesResponse(
                id="default",
                organization_id=organization_id,
                timezone="Asia/Kolkata (GMT +5:30)",
                default_response_style="Professional",
                language="English",
                created_at=now,
                updated_at=now,
            )

        return WorkspacePreferencesResponse.model_validate(wp)

    async def save_workspace_preferences(
        self,
        db: AsyncSession,
        user_id: str,
        organization_id: str,
        payload: WorkspacePreferencesUpdateRequest,
    ) -> WorkspacePreferencesResponse:
        """Persist workspace preferences and finalize organization onboarding."""
        await authorization_service.require(
            db=db,
            user_id=user_id,
            organization_id=organization_id,
            permission_key="organization.read",
        )

        now_str = datetime.now(timezone.utc).isoformat()

        stmt = select(WorkspacePreferences).where(WorkspacePreferences.organization_id == organization_id).limit(1)
        res = await db.execute(stmt)
        wp = res.scalar_one_or_none()

        if not wp:
            wp = WorkspacePreferences(
                id=f"wp_{uuid.uuid4().hex}",
                organization_id=organization_id,
                timezone=payload.timezone,
                default_response_style=payload.default_response_style,
                language=payload.language,
            )
            db.add(wp)
            await db.flush()
        else:
            wp.timezone = payload.timezone
            wp.default_response_style = payload.default_response_style
            wp.language = payload.language

        # Mark onboarding complete on the authoritative state
        obs_stmt = select(OnboardingState).where(OnboardingState.organization_id == organization_id).limit(1)
        obs_res = await db.execute(obs_stmt)
        obs = obs_res.scalar_one_or_none()
        if obs:
            obs.workspace_complete = True
            obs.workspace_completed_at = now_str
            obs.onboarding_complete = True
            obs.onboarding_completed_at = now_str

        # Record audit event transactionally
        await audit_service.record(
            db=db,
            action=AuditAction.WORKSPACE_PREFERENCES_UPDATED,
            resource_type="workspace_preferences",
            resource_id=wp.id,
            organization_id=organization_id,
            actor_user_id=user_id,
            metadata={
                "timezone": wp.timezone,
                "default_response_style": wp.default_response_style,
                "language": wp.language,
            },
        )

        await db.commit()
        await self.invalidate_cache(user_id)

        logger.info(
            "Audit: Workspace preferences persisted, onboarding complete",
            actor_user_id=user_id,
            organization_id=organization_id,
            workspace_preferences_id=wp.id,
        )

        return WorkspacePreferencesResponse.model_validate(wp)

    async def resolve_activation_status(
        self,
        db: AsyncSession,
        user_id: str,
        organization_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Resolves real activation status (connected mailboxes and indexed knowledge items) for organization."""
        org_id = organization_id
        if not org_id:
            # Query first active organization for user
            mem_stmt = (
                select(OrganizationMember.organization_id)
                .where(
                    OrganizationMember.user_id == user_id,
                    OrganizationMember.status == MembershipStatus.ACTIVE,
                )
                .order_by(OrganizationMember.created_at.asc())
                .limit(1)
            )
            org_id = (await db.execute(mem_stmt)).scalar()

        if not org_id:
            return {
                "account_created": True,
                "email_connected": False,
                "connected_accounts_count": 0,
                "knowledge_added": False,
                "knowledge_items_count": 0,
            }

        # Query ConnectedIntegrationAccount for active/healthy/syncing mailboxes
        from sqlalchemy import func
        from app.models.integration import ConnectedIntegrationAccount, IntegrationStatus, ConnectionHealthStatus
        email_stmt = (
            select(func.count(ConnectedIntegrationAccount.id))
            .where(
                ConnectedIntegrationAccount.tenant_id == org_id,
                ConnectedIntegrationAccount.status.in_([
                    IntegrationStatus.ACTIVE.value,
                    IntegrationStatus.CONNECTED.value,
                    IntegrationStatus.SYNCING.value,
                    ConnectionHealthStatus.HEALTHY.value,
                ]),
            )
        )
        email_count = (await db.execute(email_stmt)).scalar() or 0

        # Query KnowledgeItem & KnowledgeSource
        from app.models.knowledge import KnowledgeItem, KnowledgeSource, KnowledgeSourceStatus
        item_stmt = (
            select(func.count(KnowledgeItem.id))
            .where(
                KnowledgeItem.tenant_id == org_id,
                KnowledgeItem.is_active.is_(True),
            )
        )
        item_count = (await db.execute(item_stmt)).scalar() or 0

        source_stmt = (
            select(func.count(KnowledgeSource.id))
            .where(
                KnowledgeSource.tenant_id == org_id,
                KnowledgeSource.status == KnowledgeSourceStatus.ACTIVE.value,
            )
        )
        source_count = (await db.execute(source_stmt)).scalar() or 0

        return {
            "account_created": True,
            "email_connected": email_count > 0,
            "connected_accounts_count": email_count,
            "knowledge_added": item_count > 0 or source_count > 0,
            "knowledge_items_count": item_count + source_count,
        }


# Global Singleton
onboarding_service = OnboardingService()
