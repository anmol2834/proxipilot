"""Authentication & Session Domain Service — Enterprise Security Foundation.

Core Responsibilities:
- Password hashing and verification via native bcrypt
- OTP generation, Redis caching, attempt tracking, single-use burning, and cooldown limits
- Server-backed sessions with revocation tracking and Redis session caching
- Multi-device login support
- Audit logging on signin, signout, and email verification
- IDOR and brute-force protections
"""

import asyncio
from datetime import datetime, timedelta, timezone
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
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
    ResetPasswordVerifyRequest,
    ResetPasswordVerifyResponse,
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
from app.services.session_cache import cache_session
from app.services.transactional_email import EmailDeliveryError, send_code_email

# Keep references to fire-and-forget email tasks so they are not garbage-collected mid-send.
_background_tasks: set = set()


def accepts_dev_master_otp(environment: str) -> bool:
    """Whether the fixed developer OTP (123456) is accepted. Fail closed: only local
    development and automated tests, never a hosted environment (staging previously did)."""
    return environment in ("development", "test")


class AuthService:
    """Domain service managing user authentication, sessions, and verification challenges."""

    OTP_TTL_SECONDS = 600  # 10 minutes
    OTP_COOLDOWN_SECONDS = 45
    MAX_OTP_ATTEMPTS = 5
    PURPOSE_EMAIL_VERIFICATION = "EMAIL_VERIFICATION"
    PURPOSE_PASSWORD_RESET = "PASSWORD_RESET"
    RESET_TOKEN_TTL_SECONDS = 600  # 10 minutes to choose a new password after the code is verified

    @staticmethod
    def _generate_otp() -> str:
        """Generate a cryptographically secure 6-digit numeric OTP."""
        return f"{secrets.randbelow(900000) + 100000}"

    async def _send_code_or_503(self, email: str, code: str, purpose: str) -> None:
        """Email a code and surface delivery failures to the caller (signup and resend)."""
        try:
            await send_code_email(email, code, purpose, expires_minutes=self.OTP_TTL_SECONDS // 60)
        except EmailDeliveryError as exc:
            logger.error("Verification email failed", purpose=purpose, error=str(exc))
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="We couldn't send the email right now. Please try again in a moment.",
            ) from exc

    def _send_reset_code_in_background(self, email: str, code: str) -> None:
        """Password-reset codes are sent off the request path so response timing doesn't reveal
        whether an account exists. Failures are logged; the user can request a new code."""

        async def _run() -> None:
            try:
                await send_code_email(email, code, "PASSWORD_RESET", expires_minutes=self.OTP_TTL_SECONDS // 60)
            except EmailDeliveryError as exc:
                logger.error("Password reset email failed", error=str(exc))
            except Exception as exc:  # never let a background task die silently
                logger.error("Password reset email crashed", error=repr(exc))

        task = asyncio.create_task(_run())
        _background_tasks.add(task)
        task.add_done_callback(_background_tasks.discard)

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
        await self._send_code_or_503(email_clean, otp_code, "EMAIL_VERIFICATION")

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

        if (
            not challenge
            or challenge.is_invalidated
            or (challenge.purpose or self.PURPOSE_EMAIL_VERIFICATION) != self.PURPOSE_EMAIL_VERIFICATION
        ):
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
        is_dev = accepts_dev_master_otp(get_settings().environment)
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
        await cache_session(
            jti=jti,
            session_id=session_id,
            user_id=user.id,
            expires_at_iso=expires_at.isoformat(),
            ttl_seconds=int(timedelta(days=7).total_seconds()),
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

        if (
            not challenge
            or challenge.is_used
            or challenge.is_invalidated
            or (challenge.purpose or self.PURPOSE_EMAIL_VERIFICATION) != self.PURPOSE_EMAIL_VERIFICATION
        ):
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

        # Send first: if delivery fails, the previous code stays valid and no cooldown starts.
        await self._send_code_or_503(challenge.email, new_otp, "EMAIL_VERIFICATION")

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

    # ------------------------------------------------------------------
    # Password reset: forgot-password -> verify code -> set new password
    # ------------------------------------------------------------------

    async def request_password_reset(
        self,
        db: AsyncSession,
        payload: ForgotPasswordRequest,
    ) -> ForgotPasswordResponse:
        """Issue a 6-digit reset code for an active account.

        The response is identical whether or not the account exists, so the endpoint cannot be
        used to discover registered emails. The per-email cooldown also applies to unknown emails.
        Calling it again (after the cooldown) is how the client resends a code.
        """
        email_clean = payload.email.strip().lower()
        redis_client = redis_manager.client

        cooldown_key = f"pwreset:cooldown:{email_clean}"
        if await redis_client.get(cooldown_key):
            ttl = await redis_client.ttl(cooldown_key)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {max(int(ttl), 1)} seconds before requesting a new code.",
            )
        await redis_client.set(cooldown_key, "active", ex=self.OTP_COOLDOWN_SECONDS)

        user_res = await db.execute(select(User).where(User.email == email_clean).limit(1))
        user = user_res.scalar_one_or_none()

        if not user or not user.is_active:
            logger.info("Password reset requested for unknown or inactive account")
            return ForgotPasswordResponse(
                challenge_id=f"chl_{uuid.uuid4().hex}",
                email=email_clean,
                cooldown_seconds=self.OTP_COOLDOWN_SECONDS,
                expires_in_seconds=self.OTP_TTL_SECONDS,
            )

        # Only the newest reset code is valid.
        prev = await db.execute(
            select(EmailVerificationChallenge).where(
                EmailVerificationChallenge.user_id == user.id,
                EmailVerificationChallenge.purpose == self.PURPOSE_PASSWORD_RESET,
                EmailVerificationChallenge.is_used.is_(False),
                EmailVerificationChallenge.is_invalidated.is_(False),
            )
        )
        for old in prev.scalars().all():
            old.is_invalidated = True
            await redis_client.delete(f"otp:{old.id}:code")

        otp_code = self._generate_otp()
        expires_dt = datetime.now(timezone.utc) + timedelta(seconds=self.OTP_TTL_SECONDS)
        challenge = EmailVerificationChallenge(
            id=f"chl_{uuid.uuid4().hex}",
            user_id=user.id,
            email=email_clean,
            purpose=self.PURPOSE_PASSWORD_RESET,
            expires_at=expires_dt.isoformat(),
        )
        db.add(challenge)
        await db.commit()

        await redis_client.set(f"otp:{challenge.id}:code", otp_code, ex=self.OTP_TTL_SECONDS)

        logger.info(
            "Password reset challenge created",
            user_id=user.id,
            challenge_id=challenge.id,
            otp_preview=otp_code if get_settings().environment != "production" else "[REDACTED]",
        )
        self._send_reset_code_in_background(email_clean, otp_code)

        return ForgotPasswordResponse(
            challenge_id=challenge.id,
            email=email_clean,
            cooldown_seconds=self.OTP_COOLDOWN_SECONDS,
            expires_in_seconds=self.OTP_TTL_SECONDS,
        )

    async def verify_password_reset(
        self,
        db: AsyncSession,
        payload: ResetPasswordVerifyRequest,
    ) -> ResetPasswordVerifyResponse:
        """Check the reset code and exchange it for a short-lived, single-use reset token."""
        email_clean = payload.email.strip().lower()
        otp_input = payload.otp.strip()
        invalid = HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code. Please check and try again.",
        )

        res = await db.execute(
            select(EmailVerificationChallenge)
            .where(
                EmailVerificationChallenge.id == payload.challenge_id.strip(),
                EmailVerificationChallenge.purpose == self.PURPOSE_PASSWORD_RESET,
            )
            .limit(1)
        )
        challenge = res.scalar_one_or_none()

        # Unknown challenge ids (including the decoys handed out for unknown emails) look like a wrong code.
        if not challenge or challenge.email != email_clean:
            raise invalid
        if challenge.is_used or challenge.is_invalidated:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This code is no longer valid. Please request a new code.",
            )

        redis_client = redis_manager.client
        otp_key = f"otp:{challenge.id}:code"
        cached_otp = await redis_client.get(otp_key)
        if not cached_otp:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This code has expired. Please request a new code.",
            )

        is_dev = accepts_dev_master_otp(get_settings().environment)
        if cached_otp != otp_input and not (is_dev and otp_input == "123456"):
            challenge.attempt_count += 1
            if challenge.attempt_count >= self.MAX_OTP_ATTEMPTS:
                challenge.is_invalidated = True
                await redis_client.delete(otp_key)
                await db.commit()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Too many incorrect attempts. Please request a new code.",
                )
            await db.commit()
            raise invalid

        await redis_client.delete(otp_key)
        challenge.is_used = True
        challenge.used_at = datetime.now(timezone.utc).isoformat()
        await db.commit()

        reset_token = secrets.token_urlsafe(32)
        await redis_client.set(
            f"pwreset:token:{reset_token}", challenge.id, ex=self.RESET_TOKEN_TTL_SECONDS
        )
        return ResetPasswordVerifyResponse(
            reset_token=reset_token, expires_in_seconds=self.RESET_TOKEN_TTL_SECONDS
        )

    async def reset_password(
        self,
        db: AsyncSession,
        payload: ResetPasswordRequest,
    ) -> ResetPasswordResponse:
        """Set the new password, then sign the account out of every existing session."""
        redis_client = redis_manager.client
        token_key = f"pwreset:token:{payload.reset_token}"
        challenge_id = await redis_client.get(token_key)
        if not challenge_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your reset link has expired. Please start again.",
            )

        res = await db.execute(
            select(EmailVerificationChallenge)
            .where(
                EmailVerificationChallenge.id == challenge_id,
                EmailVerificationChallenge.purpose == self.PURPOSE_PASSWORD_RESET,
            )
            .limit(1)
        )
        challenge = res.scalar_one_or_none()
        user = None
        if challenge:
            user_res = await db.execute(select(User).where(User.id == challenge.user_id).limit(1))
            user = user_res.scalar_one_or_none()
        if not challenge or not user or not user.is_active:
            await redis_client.delete(token_key)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your reset link has expired. Please start again.",
            )

        # Single use: burn the token before changing anything.
        await redis_client.delete(token_key)

        user.hashed_password = hash_password(payload.new_password)
        user.is_verified = True  # the reset code proved control of this mailbox

        identity_res = await db.execute(
            select(AuthenticationIdentity)
            .where(
                AuthenticationIdentity.user_id == user.id,
                AuthenticationIdentity.provider == AuthProvider.PASSWORD.value,
            )
            .limit(1)
        )
        if not identity_res.scalar_one_or_none():
            db.add(
                AuthenticationIdentity(
                    user_id=user.id,
                    provider=AuthProvider.PASSWORD.value,
                    provider_subject=user.id,
                    provider_email=user.email,
                    provider_display_name=user.full_name,
                )
            )

        now_iso = datetime.now(timezone.utc).isoformat()
        sessions_res = await db.execute(
            select(UserSession).where(UserSession.user_id == user.id, UserSession.revoked_at.is_(None))
        )
        revoked = 0
        for sess in sessions_res.scalars().all():
            sess.revoked_at = now_iso
            sess.revocation_reason = "password_reset"
            await redis_client.delete(f"session:{sess.jti}")
            await redis_client.delete(f"session:id:{sess.id}")
            revoked += 1

        await audit_service.record(
            db=db,
            action=AuditAction.PASSWORD_RESET,
            resource_type="user",
            resource_id=user.id,
            actor_user_id=user.id,
            metadata={"sessions_revoked": revoked},
        )
        await db.commit()

        logger.info("Password reset completed", user_id=user.id, sessions_revoked=revoked)
        return ResetPasswordResponse(email=user.email)

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

        # A completed sign-in after registration: the dashboard now greets "Welcome back".
        user.login_count = (user.login_count or 0) + 1
        user.last_login_at = now_dt.isoformat()

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
        await cache_session(
            jti=jti,
            session_id=session_id,
            user_id=user.id,
            expires_at_iso=expires_at.isoformat(),
            ttl_seconds=int(session_duration.total_seconds()),
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

        # Real member counts for the organization switcher (one grouped query).
        if orgs:
            from sqlalchemy import func as _func

            counts = dict((await db.execute(
                select(OrganizationMember.organization_id, _func.count())
                .where(OrganizationMember.organization_id.in_([o.id for o in orgs]),
                       OrganizationMember.status == MembershipStatus.ACTIVE)
                .group_by(OrganizationMember.organization_id)
            )).all())
            for o in orgs:
                o.member_count = int(counts.get(o.id, 0))

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
            login_count=int(user.login_count or 0),
        )

        try:
            await redis_client.set(cache_key, resp.model_dump_json(), ex=15)
        except Exception:
            pass

        return resp


auth_service = AuthService()
