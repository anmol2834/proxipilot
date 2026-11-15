"""Authentication & Session HTTP API Routes — Enterprise Security Foundation.

Endpoints:
- POST /auth/signup
- POST /auth/verify-otp
- POST /auth/resend-otp
- POST /auth/signin
- POST /auth/signout
- GET  /auth/me
"""

from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.contracts.auth import (
    ResendOtpRequest,
    ResendOtpResponse,
    SigninRequest,
    SigninResponse,
    SignupRequest,
    SignupResponse,
    UserMeResponse,
    VerifyOtpRequest,
    VerifyOtpResponse,
)
from app.core.database import get_db
from app.core.security import TokenPayload, get_current_user
from app.services.auth import auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/signup",
    response_model=SignupResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register account and generate OTP challenge",
)
async def signup(
    payload: SignupRequest,
    db: AsyncSession = Depends(get_db),
) -> SignupResponse:
    """Create a pending user account and dispatch email OTP verification."""
    return await auth_service.signup(db, payload)


@router.post(
    "/verify-otp",
    response_model=VerifyOtpResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify email OTP challenge and activate account",
)
async def verify_otp(
    payload: VerifyOtpRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> VerifyOtpResponse:
    """Verify 6-digit OTP code, mark email verified, and issue authentication credentials."""
    user_agent = request.headers.get("user-agent")
    ip_address = request.client.host if request.client else None

    result = await auth_service.verify_otp(
        db=db,
        payload=payload,
        user_agent=user_agent,
        ip_address=ip_address,
    )

    # Set secure HttpOnly session cookie
    response.set_cookie(
        key="session_id",
        value=result.session_id,
        httponly=True,
        samesite="lax",
        secure=False,  # Set true in production via HTTPS
        max_age=7 * 24 * 3600,
    )

    return result


@router.post(
    "/resend-otp",
    response_model=ResendOtpResponse,
    status_code=status.HTTP_200_OK,
    summary="Resend verification code subject to cooldown",
)
async def resend_otp(
    payload: ResendOtpRequest,
    db: AsyncSession = Depends(get_db),
) -> ResendOtpResponse:
    """Issue a new verification code if the 45-second cooldown period has elapsed."""
    return await auth_service.resend_otp(db, payload)


@router.post(
    "/signin",
    response_model=SigninResponse,
    status_code=status.HTTP_200_OK,
    summary="Sign in with email and password",
)
async def signin(
    payload: SigninRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> SigninResponse:
    """Validate credentials and establish server session."""
    user_agent = request.headers.get("user-agent")
    ip_address = request.client.host if request.client else None

    result = await auth_service.signin(
        db=db,
        payload=payload,
        user_agent=user_agent,
        ip_address=ip_address,
    )

    max_age = 30 * 24 * 3600 if payload.remember_me else 24 * 3600

    response.set_cookie(
        key="session_id",
        value=result.session_id,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=max_age,
    )

    return result


@router.post(
    "/signout",
    status_code=status.HTTP_200_OK,
    summary="Sign out and revoke active session",
)
async def signout(
    request: Request,
    response: Response,
    current_user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke active session and delete session cookie."""
    session_id = getattr(current_user, "session_id", None) or request.cookies.get("session_id")
    await auth_service.signout(db, user_id=current_user.sub, session_id=session_id)
    response.delete_cookie("session_id")
    return {"success": True, "message": "Signed out successfully."}


@router.get(
    "/me",
    response_model=UserMeResponse,
    status_code=status.HTTP_200_OK,
    summary="Get profile of current authenticated user",
)
async def get_me(
    current_user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserMeResponse:
    """Fetch current user identity and active tenant memberships."""
    return await auth_service.get_me(db, user_id=current_user.sub)


# ============================================================================
# OAuth Social Authentication (Google & Microsoft)
# ============================================================================

import asyncio
import urllib.parse
import httpx
import json
from datetime import datetime, timedelta, timezone
import uuid
from sqlalchemy import select
from fastapi.responses import RedirectResponse
from app.core.config import get_settings
from app.core.redis import redis_manager
from app.core.security import create_access_token
from app.services.session_cache import cache_session
from app.models.organization import User, Organization, OrganizationMember, MembershipStatus, Role
from app.models.auth import AuthenticationIdentity, AuthProvider, Session as UserSession
from app.models.onboarding import OnboardingState
from app.services.onboarding import onboarding_service


async def _oauth_failure_redirect(db: AsyncSession, provider: str, exc: Exception) -> RedirectResponse:
    """Log an unexpected OAuth callback failure and send the user back to sign-in."""
    from app.core.logging import logger

    logger.exception("OAuth callback failed", provider=provider, error=str(exc)[:300])
    try:
        await db.rollback()
    except Exception:
        pass
    frontend_base = getattr(get_settings(), "frontend_url", "http://localhost:3000").rstrip("/")
    return RedirectResponse(
        url=f"{frontend_base}/signin?error=signin_unavailable",
        status_code=status.HTTP_302_FOUND,
    )


@router.get("/google", summary="Initiate Google OAuth flow")
async def google_login():
    """Redirect to Google Accounts OAuth 2.0 authorization endpoint."""
    settings = get_settings()
    client_id = settings.providers.google_client_id
    redirect_uri = settings.providers.google_redirect_uri

    if not client_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth is not configured on the server.",
        )

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
    }
    url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
    return RedirectResponse(url=url, status_code=status.HTTP_302_FOUND)


@router.get("/google/callback", summary="Google OAuth callback")
async def google_callback(
    code: Optional[str] = None,
    error: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Never show a raw 500 page to a user returning from the provider."""
    try:
        return await _google_callback(code=code, error=error, db=db)
    except Exception as exc:
        return await _oauth_failure_redirect(db, "google", exc)


async def _google_callback(
    code: Optional[str],
    error: Optional[str],
    db: AsyncSession,
):
    """Handle Google OAuth code exchange, user creation/lookup, and issue session."""
    settings = get_settings()
    frontend_base = getattr(settings, "frontend_url", "http://localhost:3000").rstrip("/")
    if error or not code:
        return RedirectResponse(url=f"{frontend_base}/signin?error={urllib.parse.quote(error or 'oauth_failed')}")

    client_id = settings.providers.google_client_id
    client_secret = settings.providers.google_client_secret
    redirect_uri = settings.providers.google_redirect_uri

    async with httpx.AsyncClient(timeout=15.0) as client:
        token_res = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        if token_res.status_code != 200:
            return RedirectResponse(url=f"{frontend_base}/signin?error=token_exchange_failed")

        tokens = token_res.json()
        access_token = tokens.get("access_token")

        userinfo_res = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if userinfo_res.status_code != 200:
            return RedirectResponse(url=f"{frontend_base}/signin?error=userinfo_failed")

        userinfo = userinfo_res.json()

    sub = userinfo.get("sub")
    email = userinfo.get("email", "").strip().lower()
    full_name = userinfo.get("name") or email.split("@")[0]
    avatar_url = userinfo.get("picture")

    if not email:
        return RedirectResponse(url=f"{frontend_base}/signin?error=email_not_provided")

    # Find or create User
    stmt = select(User).where(User.email == email).limit(1)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()
    is_new_user = False

    if not user:
        is_new_user = True
        user = User(
            id=f"usr_{uuid.uuid4().hex}",
            email=email,
            full_name=full_name,
            hashed_password="",  # OAuth user
            avatar_url=avatar_url,
            is_active=True,
            is_verified=True,
            last_login_at=datetime.now(timezone.utc).isoformat(),
        )
        db.add(user)
        # Flush user immediately so users.id exists before child foreign keys are written
        await db.flush()

        # Link identity
        identity = AuthenticationIdentity(
            id=f"aid_{uuid.uuid4().hex}",
            user_id=user.id,
            provider=AuthProvider.GOOGLE.value,
            provider_subject=sub,
            provider_email=email,
            provider_display_name=full_name,
            provider_avatar_url=avatar_url,
            last_used_at=datetime.now(timezone.utc).isoformat(),
        )
        db.add(identity)
    else:
        user.last_login_at = datetime.now(timezone.utc).isoformat()
        user.login_count = (user.login_count or 0) + 1  # returning user signing in again
        if avatar_url and not user.avatar_url:
            user.avatar_url = avatar_url

        # Check identity
        ident_stmt = select(AuthenticationIdentity).where(
            AuthenticationIdentity.user_id == user.id,
            AuthenticationIdentity.provider == AuthProvider.GOOGLE.value,
        ).limit(1)
        ident_res = await db.execute(ident_stmt)
        existing_identity = ident_res.scalar_one_or_none()
        if not existing_identity:
            identity = AuthenticationIdentity(
                id=f"aid_{uuid.uuid4().hex}",
                user_id=user.id,
                provider=AuthProvider.GOOGLE.value,
                provider_subject=sub,
                provider_email=email,
                provider_display_name=full_name,
                provider_avatar_url=avatar_url,
                last_used_at=datetime.now(timezone.utc).isoformat(),
            )
            db.add(identity)
        else:
            existing_identity.last_used_at = datetime.now(timezone.utc).isoformat()
            if avatar_url and not existing_identity.provider_avatar_url:
                existing_identity.provider_avatar_url = avatar_url

    # Create session
    now_dt = datetime.now(timezone.utc)
    session_id = f"ses_{uuid.uuid4().hex}"
    jti = uuid.uuid4().hex
    expires_at = now_dt + timedelta(days=7)

    session_rec = UserSession(
        id=session_id,
        user_id=user.id,
        jti=jti,
        expires_at=expires_at.isoformat(),
    )
    db.add(session_rec)
    # Commit all writes in a single batch atomic transaction
    await db.commit()

    # Best-effort cache; the committed DB session is authoritative.
    await cache_session(
        jti=jti,
        session_id=session_id,
        user_id=user.id,
        expires_at_iso=expires_at.isoformat(),
        ttl_seconds=int(timedelta(days=7).total_seconds()),
    )

    settings = get_settings()
    frontend_base = getattr(settings, "frontend_url", "http://localhost:3000").rstrip("/")

    if is_new_user:
        dest_url = f"{frontend_base}/signup/organization"
        from app.contracts.onboarding import OnboardingStateResponse, OnboardingStepEnum
        await onboarding_service._set_cached_state(
            f"onboarding:state:{user.id}:default",
            OnboardingStateResponse(
                current_step=OnboardingStepEnum.ORGANIZATION,
                completed_steps=[OnboardingStepEnum.ACCOUNT],
                is_completed=False,
                next_route="/signup/organization",
            ),
        )
    else:
        onboarding = await onboarding_service.resolve_onboarding_state(db, user.id)
        dest_url = f"{frontend_base}{onboarding.next_route}"

    response = RedirectResponse(url=dest_url, status_code=status.HTTP_302_FOUND)
    response.set_cookie(
        key="session_id",
        value=session_id,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=7 * 24 * 3600,
    )
    return response


@router.get("/microsoft", summary="Initiate Microsoft OAuth flow")
async def microsoft_login():
    """Redirect to Microsoft identity platform authorization endpoint."""
    settings = get_settings()
    client_id = settings.providers.microsoft_client_id
    tenant_id = settings.providers.microsoft_tenant_id or "common"
    redirect_uri = settings.providers.microsoft_redirect_uri

    if not client_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Microsoft OAuth is not configured on the server.",
        )

    params = {
        "client_id": client_id,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "response_mode": "query",
        "scope": "openid email profile User.Read",
        "prompt": "select_account",
    }
    url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/authorize?{urllib.parse.urlencode(params)}"
    return RedirectResponse(url=url, status_code=status.HTTP_302_FOUND)


@router.get("/microsoft/callback", summary="Microsoft OAuth callback")
async def microsoft_callback(
    code: Optional[str] = None,
    error: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Never show a raw 500 page to a user returning from the provider."""
    try:
        return await _microsoft_callback(code=code, error=error, db=db)
    except Exception as exc:
        return await _oauth_failure_redirect(db, "microsoft", exc)


async def _microsoft_callback(
    code: Optional[str],
    error: Optional[str],
    db: AsyncSession,
):
    """Handle Microsoft OAuth code exchange, user creation/lookup, and issue session."""
    settings = get_settings()
    frontend_base = getattr(settings, "frontend_url", "http://localhost:3000").rstrip("/")
    if error or not code:
        return RedirectResponse(url=f"{frontend_base}/signin?error={urllib.parse.quote(error or 'oauth_failed')}")
    client_id = settings.providers.microsoft_client_id
    client_secret = settings.providers.microsoft_client_secret
    tenant_id = settings.providers.microsoft_tenant_id or "common"
    redirect_uri = settings.providers.microsoft_redirect_uri

    async with httpx.AsyncClient(timeout=15.0) as client:
        token_res = await client.post(
            f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        if token_res.status_code != 200:
            return RedirectResponse(url=f"{frontend_base}/signin?error=token_exchange_failed")

        tokens = token_res.json()
        access_token = tokens.get("access_token")

        userinfo_res = await client.get(
            "https://graph.microsoft.com/v1.0/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if userinfo_res.status_code != 200:
            return RedirectResponse(url=f"{frontend_base}/signin?error=userinfo_failed")

        userinfo = userinfo_res.json()

    sub = userinfo.get("id")
    email = (userinfo.get("mail") or userinfo.get("userPrincipalName", "")).strip().lower()
    full_name = userinfo.get("displayName") or email.split("@")[0]

    if not email:
        return RedirectResponse(url=f"{frontend_base}/signin?error=email_not_provided")

    stmt = select(User).where(User.email == email).limit(1)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()
    is_new_user = False

    if not user:
        is_new_user = True
        user = User(
            id=f"usr_{uuid.uuid4().hex}",
            email=email,
            full_name=full_name,
            hashed_password="",
            is_active=True,
            is_verified=True,
            last_login_at=datetime.now(timezone.utc).isoformat(),
        )
        db.add(user)
        # Flush user immediately so users.id exists before child foreign keys are written
        await db.flush()

        identity = AuthenticationIdentity(
            id=f"aid_{uuid.uuid4().hex}",
            user_id=user.id,
            provider=AuthProvider.MICROSOFT.value,
            provider_subject=sub,
            provider_email=email,
            provider_display_name=full_name,
            last_used_at=datetime.now(timezone.utc).isoformat(),
        )
        db.add(identity)
    else:
        user.last_login_at = datetime.now(timezone.utc).isoformat()
        user.login_count = (user.login_count or 0) + 1  # returning user signing in again
        # Check identity
        ident_stmt = select(AuthenticationIdentity).where(
            AuthenticationIdentity.user_id == user.id,
            AuthenticationIdentity.provider == AuthProvider.MICROSOFT.value,
        ).limit(1)
        ident_res = await db.execute(ident_stmt)
        existing_identity = ident_res.scalar_one_or_none()
        if not existing_identity:
            identity = AuthenticationIdentity(
                id=f"aid_{uuid.uuid4().hex}",
                user_id=user.id,
                provider=AuthProvider.MICROSOFT.value,
                provider_subject=sub,
                provider_email=email,
                provider_display_name=full_name,
                last_used_at=datetime.now(timezone.utc).isoformat(),
            )
            db.add(identity)
        else:
            existing_identity.last_used_at = datetime.now(timezone.utc).isoformat()

    now_dt = datetime.now(timezone.utc)
    session_id = f"ses_{uuid.uuid4().hex}"
    jti = uuid.uuid4().hex
    expires_at = now_dt + timedelta(days=7)

    session_rec = UserSession(
        id=session_id,
        user_id=user.id,
        jti=jti,
        expires_at=expires_at.isoformat(),
    )
    db.add(session_rec)
    await db.commit()

    # Best-effort cache; the committed DB session is authoritative.
    await cache_session(
        jti=jti,
        session_id=session_id,
        user_id=user.id,
        expires_at_iso=expires_at.isoformat(),
        ttl_seconds=int(timedelta(days=7).total_seconds()),
    )

    if is_new_user:
        dest_url = f"{frontend_base}/signup/organization"
        from app.contracts.onboarding import OnboardingStateResponse, OnboardingStepEnum
        await onboarding_service._set_cached_state(
            f"onboarding:state:{user.id}:default",
            OnboardingStateResponse(
                current_step=OnboardingStepEnum.ORGANIZATION,
                completed_steps=[OnboardingStepEnum.ACCOUNT],
                is_completed=False,
                next_route="/signup/organization",
            ),
        )
    else:
        onboarding = await onboarding_service.resolve_onboarding_state(db, user.id)
        dest_url = f"{frontend_base}{onboarding.next_route}"

    response = RedirectResponse(url=dest_url, status_code=status.HTTP_302_FOUND)
    response.set_cookie(
        key="session_id",
        value=session_id,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=7 * 24 * 3600,
    )
    return response
