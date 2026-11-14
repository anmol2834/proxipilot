"""Authentication & Session Domain Service — Enterprise Security Foundation.

Core Responsibilities:
- Password hashing and verification via native bcrypt
- OTP generation, Redis caching, attempt tracking, single-use burning, and cooldown limits
- Server-backed sessions with revocation tracking and Redis session caching
- Multi-device login support
- Audit logging on signin, signout, and email verification
- IDOR and brute-force protections
"""

from datetime import datetime, timedelta, timezone
import json
import secrets
from typing import List, Optional, Tuple
import uuid
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.contracts.auth import (
    ResendOtpRequest,
    ResendOtpResponse,
    SigninRequest,
    SigninResponse,
    SignupRequest,
    SignupResponse,
    UserMeResponse,
    UserOrgSummary,
    VerifyOtpRequest,
    VerifyOtpResponse,
)
from app.core.config import get_api_settings, get_settings
from app.core.logging import logger
from app.core.redis import redis_manager
from app.core.security import create_access_token, hash_password, verify_password
from app.models.audit import AuditAction, AuditActorType
from app.models.auth import (
    AccountStatus,
    AuthenticationIdentity,
    AuthProvider,
    EmailVerificationChallenge,
    Session as UserSession,
)
from app.models.organization import MembershipStatus, Organization, OrganizationMember, Role, User
from app.services.audit import audit_service


class AuthService:
    """Domain service managing user authentication, sessions, and verification challenges."""

    OTP_TTL_SECONDS = 600  # 10 minutes
    OTP_COOLDOWN_SECONDS = 45
    MAX_OTP_ATTEMPTS = 5

    @staticmethod
    def _generate_otp() -> str:
        """Generate a cryptographically secure 6-digit numeric OTP."""
        return f"{secrets.randbelow(900000) + 100000}"

    async def signup(
        self,
        db: AsyncSession,
        payload: SignupRequest,
    ) -> SignupResponse:
        """Register a new user account and generate an email verification OTP challenge."""
        email_clean = payload.email.strip().lower()

        # Check existing user
        stmt = select(User).where(User.email == email_clean).limit(1)
        res = await db.execute(stmt)
        existing_user = res.scalar_one_or_none()

        if existing_user:
            if existing_user.is_verified:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An account with this email already exists.",
                )
            user = existing_user
            user.hashed_password = hash_password(payload.password)
            user.full_name = f"{payload.first_name} {payload.last_name}".strip()
        else:
            full_name = f"{payload.first_name} {payload.last_name}".strip()
            user = User(
                id=f"usr_{uuid.uuid4().hex}",
                email=email_clean,
                hashed_password=hash_password(payload.password),
                full_name=full_name,
                is_active=True,
                is_verified=False,
            )
            db.add(user)
            await db.flush()

            identity = AuthenticationIdentity(
                user_id=user.id,
                provider=AuthProvider.PASSWORD.value,
                provider_subject=user.id,
                provider_email=email_clean,
                provider_display_name=full_name,
            )
            db.add(identity)

        # Generate OTP
        otp_code = self._generate_otp()
        now_dt = datetime.now(timezone.utc)
        expires_dt = now_dt + timedelta(seconds=self.OTP_TTL_SECONDS)

        challenge = EmailVerificationChallenge(
            id=f"chl_{uuid.uuid4().hex}",
            user_id=user.id,
            email=email_clean,
            expires_at=expires_dt.isoformat(),
        )
        db.add(challenge)
        await db.commit()
        await db.refresh(challenge)

        # Cache OTP in Redis with TTL
        redis_client = redis_manager.client
        otp_key = f"otp:{challenge.id}:code"
        cooldown_key = f"otp:{challenge.id}:cooldown"

        await redis_client.set(otp_key, otp_code, ex=self.OTP_TTL_SECONDS)
        await redis_client.set(cooldown_key, "active", ex=self.OTP_COOLDOWN_SECONDS)

        logger.info(
            "User signup challenge created",
            user_id=user.id,
            email=email_clean,
            challenge_id=challenge.id,
            otp_preview=otp_code if get_settings().environment != "production" else "[REDACTED]",
        )

        return SignupResponse(
            user_id=user.id,
            email=email_clean,
            challenge_id=challenge.id,
            status="PENDING_VERIFICATION",
        )

    async def verify_otp(
        self,
        db: AsyncSession,
        payload: VerifyOtpRequest,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> VerifyOtpResponse:
        """Validate the submitted OTP code and activate the user account."""
        challenge_id = payload.challenge_id.strip()
        otp_input = payload.otp.strip()

        stmt = select(EmailVerificationChallenge).where(EmailVerificationChallenge.id == challenge_id).limit(1)
        res = await db.execute(stmt)
        challenge = res.scalar_one_or_none()

        if not challenge or challenge.is_invalidated:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification challenge.",
            )

        if challenge.is_used:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification code has already been used.",
            )

        redis_client = redis_manager.client
        otp_key = f"otp:{challenge.id}:code"
        cached_otp = await redis_client.get(otp_key)

        if not cached_otp:
            # Check if expired
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification code has expired. Please request a new code.",
            )

        # Verification check (in dev environment, allow 123456 for fast developer/testing experience)
        is_dev = get_settings().environment != "production"
        if cached_otp != otp_input and not (is_dev and otp_input == "123456"):
            challenge.attempt_count += 1
            if challenge.attempt_count >= self.MAX_OTP_ATTEMPTS:
                challenge.is_invalidated = True
                await redis_client.delete(otp_key)
                await db.commit()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Maximum verification attempts exceeded. Please request a new code.",
                )
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification code. Please check and try again.",
            )

        # Single-use burn: delete from Redis
        await redis_client.delete(otp_key)

        now_dt = datetime.now(timezone.utc)
        challenge.is_used = True
        challenge.used_at = now_dt.isoformat()

        user_stmt = select(User).where(User.id == challenge.user_id).limit(1)
        user_res = await db.execute(user_stmt)
        user = user_res.scalar_one()

        user.is_verified = True
        user.is_active = True

        # Record EMAIL_VERIFIED audit event
        await audit_service.record(
            db=db,
            action=AuditAction.EMAIL_VERIFIED,
            resource_type="user",
            resource_id=user.id,
            actor_user_id=user.id,
            metadata={"email": user.email},
        )

        # Establish authenticated session
        session_id = f"ses_{uuid.uuid4().hex}"
        jti = uuid.uuid4().hex
        expires_at = now_dt + timedelta(days=7)

        session_rec = UserSession(
            id=session_id,
            user_id=user.id,
            jti=jti,
            user_agent=user_agent[:500] if user_agent else None,
            ip_address=ip_address,
            expires_at=expires_at.isoformat(),
        )
        db.add(session_rec)
        await db.commit()

        # Cache session in Redis
        await redis_client.set(f"session:{jti}", user.id, ex=int(timedelta(days=7).total_seconds()))
        await redis_client.set(
            f"session:id:{session_id}",
            json.dumps({"user_id": user.id, "expires_at": expires_at.isoformat()}),
            ex=int(timedelta(days=7).total_seconds()),
        )

        # Generate JWT access token with session_id
        access_token = create_access_token(
            user_id=user.id,
            session_id=session_id,
            email=user.email,
            expires_delta=timedelta(days=7),
        )

        return VerifyOtpResponse(
            user_id=user.id,
            email=user.email,
            is_verified=True,
            access_token=access_token,
            session_id=session_id,
        )

    async def resend_otp(
        self,
        db: AsyncSession,
        payload: ResendOtpRequest,
    ) -> ResendOtpResponse:
        """Resend a new 6-digit OTP code if cooldown has expired."""
        challenge_id = payload.challenge_id.strip()

        stmt = select(EmailVerificationChallenge).where(EmailVerificationChallenge.id == challenge_id).limit(1)
        res = await db.execute(stmt)
        challenge = res.scalar_one_or_none()

        if not challenge or challenge.is_used or challenge.is_invalidated:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot resend code for this challenge.",
            )

        redis_client = redis_manager.client
        cooldown_key = f"otp:{challenge.id}:cooldown"
        cooldown_val = await redis_client.get(cooldown_key)

        if cooldown_val:
            ttl = await redis_client.ttl(cooldown_key)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {ttl} seconds before requesting a new code.",
            )

        new_otp = self._generate_otp()
        otp_key = f"otp:{challenge.id}:code"

        await redis_client.set(otp_key, new_otp, ex=self.OTP_TTL_SECONDS)
        await redis_client.set(cooldown_key, "active", ex=self.OTP_COOLDOWN_SECONDS)

        challenge.resend_count += 1
        challenge.attempt_count = 0  # reset attempt counter on resend
        challenge.expires_at = (datetime.now(timezone.utc) + timedelta(seconds=self.OTP_TTL_SECONDS)).isoformat()
        await db.commit()

        logger.info(
            "OTP resent",
            challenge_id=challenge.id,
            otp_preview=new_otp if get_settings().environment != "production" else "[REDACTED]",
        )

        return ResendOtpResponse(
            challenge_id=challenge.id,
            cooldown_seconds=self.OTP_COOLDOWN_SECONDS,
        )

    async def signin(
        self,
        db: AsyncSession,
        payload: SigninRequest,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> SigninResponse:
        """Validate credentials, establish server session, and issue access token."""
        email_clean = payload.email.strip().lower()

        stmt = select(User).where(User.email == email_clean).limit(1)
        res = await db.execute(stmt)
        user = res.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )

        if not verify_password(payload.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )

        if not user.is_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email address is not verified. Please verify your email first.",
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is suspended or disabled.",
            )

        # Check primary organization and role
        org_stmt = (
            select(OrganizationMember)
            .where(
                OrganizationMember.user_id == user.id,
                OrganizationMember.status == MembershipStatus.ACTIVE,
            )
            .options(selectinload(OrganizationMember.role))
            .limit(1)
        )
        org_res = await db.execute(org_stmt)
        primary_mem = org_res.scalar_one_or_none()

        org_id = primary_mem.organization_id if primary_mem else None
        role_name = primary_mem.role.name if primary_mem and primary_mem.role else "Member"

        # Session creation
        now_dt = datetime.now(timezone.utc)
        session_duration = timedelta(days=30 if payload.remember_me else 1)
        expires_at = now_dt + session_duration

        session_id = f"ses_{uuid.uuid4().hex}"
        jti = uuid.uuid4().hex

        session_rec = UserSession(
            id=session_id,
            user_id=user.id,
            jti=jti,
            user_agent=user_agent[:500] if user_agent else None,
            ip_address=ip_address,
            expires_at=expires_at.isoformat(),
        )
        db.add(session_rec)

        # Record USER_SIGNED_IN audit event
        await audit_service.record(
            db=db,
            action=AuditAction.USER_SIGNED_IN,
            resource_type="session",
            resource_id=session_id,
            organization_id=org_id,
            actor_user_id=user.id,
            metadata={"ip": ip_address, "remember_me": payload.remember_me},
        )

        await db.commit()

        # Cache in Redis
        redis_client = redis_manager.client
        await redis_client.set(f"session:{jti}", user.id, ex=int(session_duration.total_seconds()))
        await redis_client.set(
            f"session:id:{session_id}",
            json.dumps({"user_id": user.id, "expires_at": expires_at.isoformat()}),
            ex=int(session_duration.total_seconds()),
        )

        access_token = create_access_token(
            user_id=user.id,
            session_id=session_id,
            tenant_id=org_id or "",
            role=role_name,
            email=user.email,
            expires_delta=session_duration,
        )

        return SigninResponse(
            user_id=user.id,
            email=user.email,
            access_token=access_token,
            session_id=session_id,
            organization_id=org_id,
            role=role_name,
        )

    async def signout(
        self,
        db: AsyncSession,
        user_id: str,
        session_id: Optional[str] = None,
    ) -> bool:
        """Revoke active session and record signout audit event."""
        if session_id:
            stmt = select(UserSession).where(UserSession.id == session_id, UserSession.user_id == user_id).limit(1)
        else:
            stmt = (
                select(UserSession)
                .where(UserSession.user_id == user_id, UserSession.revoked_at.is_(None))
                .order_by(UserSession.created_at.desc())
                .limit(1)
            )

        res = await db.execute(stmt)
        session_rec = res.scalar_one_or_none()

        if session_rec:
            session_rec.revoked_at = datetime.now(timezone.utc).isoformat()
            session_rec.revocation_reason = "signout"

            # Invalidate in Redis
            redis_client = redis_manager.client
            await redis_client.delete(f"session:{session_rec.jti}")
            await redis_client.delete(f"session:id:{session_rec.id}")
            await redis_client.delete(f"onboarding:state:{user_id}")

            await audit_service.record(
                db=db,
                action=AuditAction.USER_SIGNED_OUT,
                resource_type="session",
                resource_id=session_rec.id,
                actor_user_id=user_id,
            )
            await db.commit()

        return True

    async def get_me(
        self,
        db: AsyncSession,
        user_id: str,
    ) -> UserMeResponse:
        """Fetch current authenticated user profile with organization memberships.

        Optimized: Employs short-lived Redis caching and joinedload for single SQL query execution.
        """
        from app.core.redis import redis_manager
        redis_client = redis_manager.client
        cache_key = f"user:me:{user_id}"
        try:
            cached = await redis_client.get(cache_key)
            if cached:
                return UserMeResponse.model_validate_json(cached)
        except Exception:
            pass

        from sqlalchemy.orm import joinedload

        stmt = (
            select(User)
            .where(User.id == user_id)
            .options(
                joinedload(User.memberships).joinedload(OrganizationMember.organization),
                joinedload(User.memberships).joinedload(OrganizationMember.role),
            )
            .limit(1)
        )
        res = await db.execute(stmt)
        user = res.unique().scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

        orgs: List[UserOrgSummary] = []
        primary_org_id: Optional[str] = None

        for mem in user.memberships:
            if mem.organization and mem.status == MembershipStatus.ACTIVE:
                if not primary_org_id:
                    primary_org_id = mem.organization.id
                orgs.append(
                    UserOrgSummary(
                        id=mem.organization.id,
                        organization_id=mem.organization.id,
                        name=mem.organization.name,
                        slug=mem.organization.slug,
                        role=mem.role.name if mem.role else "Member",
                        status=mem.status,
                    )
                )

        parts = (user.full_name or "").split()
        first_name = parts[0] if parts else ""
        last_name = " ".join(parts[1:]) if len(parts) > 1 else ""

        resp = UserMeResponse(
            id=user.id,
            user_id=user.id,
            email=user.email,
            full_name=user.full_name or f"{first_name} {last_name}".strip(),
            first_name=first_name,
            last_name=last_name,
            is_verified=user.is_verified,
            status="ACTIVE" if user.is_active else "INACTIVE",
            primary_organization_id=primary_org_id,
            organizations=orgs,
        )

        try:
            await redis_client.set(cache_key, resp.model_dump_json(), ex=15)
        except Exception:
            pass

        return resp


auth_service = AuthService()
