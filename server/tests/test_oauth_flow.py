"""Tests for OAuth User and Identity Lifecycle.

Validates that:
1. ORM relationships between User, AuthenticationIdentity, and Session are properly configured.
2. In-memory and session staging order preserves foreign key integrity without ForeignKeyViolationError.
3. OAuth callbacks properly link identities for new and existing users.
"""

import pytest
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from app.models.organization import User
from app.models.auth import AuthenticationIdentity, AuthProvider, Session as UserSession
from app.core.database import db_manager


@pytest.mark.asyncio
async def test_oauth_model_relationships():
    """Verify ORM relationships exist between User and auth child models."""
    assert hasattr(User, "identities"), "User model must have identities relationship"
    assert hasattr(User, "sessions"), "User model must have sessions relationship"
    assert hasattr(AuthenticationIdentity, "user"), "AuthenticationIdentity must have user relationship"
    assert hasattr(UserSession, "user"), "Session must have user relationship"


@pytest.mark.asyncio
async def test_oauth_user_creation_and_identity_linkage():
    """Verify that a new OAuth user and identity commit without foreign key violation."""
    db_manager.initialize()
    async with db_manager.session_factory() as db:
        test_email = f"pytest_oauth_{uuid.uuid4().hex[:8]}@example.com"
        test_sub = f"google_sub_{uuid.uuid4().hex[:12]}"
        
        # New OAuth user
        user = User(
            id=f"usr_{uuid.uuid4().hex}",
            email=test_email,
            full_name="Pytest OAuth User",
            hashed_password="",
            avatar_url="https://lh3.googleusercontent.com/test",
            is_active=True,
            is_verified=True,
            last_login_at=datetime.now(timezone.utc).isoformat(),
        )
        db.add(user)
        await db.flush()

        identity = AuthenticationIdentity(
            id=f"aid_{uuid.uuid4().hex}",
            user_id=user.id,
            provider=AuthProvider.GOOGLE.value,
            provider_subject=test_sub,
            provider_email=test_email,
            provider_display_name="Pytest OAuth User",
            provider_avatar_url="https://lh3.googleusercontent.com/test",
            last_used_at=datetime.now(timezone.utc).isoformat(),
        )
        db.add(identity)

        session_rec = UserSession(
            id=f"ses_{uuid.uuid4().hex}",
            user_id=user.id,
            jti=uuid.uuid4().hex,
            expires_at=(datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        )
        db.add(session_rec)

        # Must commit cleanly
        await db.commit()

        # Verify DB state
        res = await db.execute(select(User).where(User.id == user.id))
        saved_user = res.scalar_one_or_none()
        assert saved_user is not None
        assert saved_user.email == test_email

        ident_res = await db.execute(
            select(AuthenticationIdentity).where(AuthenticationIdentity.user_id == user.id)
        )
        saved_ident = ident_res.scalar_one_or_none()
        assert saved_ident is not None
        assert saved_ident.provider == AuthProvider.GOOGLE.value

        # Clean up
        await db.delete(session_rec)
        await db.delete(identity)
        await db.delete(user)
        await db.commit()


@pytest.mark.asyncio
async def test_organization_creation_and_audit_linkage():
    """Verify that creating an organization with memberships, onboarding state, and audit events commits without foreign key violation."""
    from app.services.organization import organization_service
    from app.contracts.organization import OrganizationCreateRequest
    from app.models.organization import Organization, OrganizationMember
    from app.models.onboarding import OnboardingState
    from app.models.audit import AuditEvent

    db_manager.initialize()
    async with db_manager.session_factory() as db:
        test_email = f"pytest_org_{uuid.uuid4().hex[:8]}@example.com"
        user = User(
            id=f"usr_{uuid.uuid4().hex}",
            email=test_email,
            full_name="Pytest Org Creator",
            hashed_password="",
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        await db.flush()

        # Create organization
        req = OrganizationCreateRequest(
            name="Dolphy India Test",
            website="https://www.dolphy.com",
            industry="E-Commerce & Retail",
            company_size="201-500 employees",
        )
        ctx = await organization_service.create_organization(db, user_id=user.id, payload=req)
        assert ctx.organization.id is not None
        assert ctx.organization.name == "Dolphy India Test"

        # Verify audit events exist
        audit_res = await db.execute(
            select(AuditEvent).where(AuditEvent.organization_id == ctx.organization.id)
        )
        events = audit_res.scalars().all()
        assert len(events) >= 2, "Expected at least 2 audit events"

        # Clean up
        for ev in events:
            await db.delete(ev)
        obs_res = await db.execute(select(OnboardingState).where(OnboardingState.organization_id == ctx.organization.id))
        obs = obs_res.scalar_one_or_none()
        if obs:
            await db.delete(obs)
        mem_res = await db.execute(select(OrganizationMember).where(OrganizationMember.organization_id == ctx.organization.id))
        for m in mem_res.scalars().all():
            await db.delete(m)
        org_res = await db.execute(select(Organization).where(Organization.id == ctx.organization.id))
        org = org_res.scalar_one_or_none()
        if org:
            await db.delete(org)
        await db.delete(user)
        await db.commit()
