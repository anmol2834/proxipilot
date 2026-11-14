"""Authentication, Cryptography, and Tenant Security Verification.

Rules:
- Passwords hashed with native bcrypt
- JWT token creation and validation
- Tenant identity resolved authoritatively from validated tokens (NEVER trust unauthenticated headers)
- RBAC permission checking matrix
"""

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
import bcrypt
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel, Field
from app.core.config import SecuritySettings, get_settings
from app.core.logging import logger

security_scheme = HTTPBearer(auto_error=False)


class TokenPayload(BaseModel):
    """Decoded JWT payload."""

    sub: str = Field(description="User ID")
    session_id: Optional[str] = Field(default=None, description="Session ID")
    tenant_id: Optional[str] = Field(default="", description="Primary Tenant / Organization ID")
    role: str = Field(default="Member", description="Role within Tenant")
    email: Optional[str] = None
    exp: Optional[int] = None


# Role-Based Access Control Permissions Matrix (Aligned with Frontend)
PERMISSIONS: Dict[str, List[str]] = {
    # Email / Inbox
    "email.read": ["Owner", "Admin", "Manager", "Member", "Viewer"],
    "email.reply": ["Owner", "Admin", "Manager", "Member"],
    "email.send": ["Owner", "Admin", "Manager", "Member"],
    "email.delete": ["Owner", "Admin"],
    # Automation
    "automation.read": ["Owner", "Admin", "Manager", "Member", "Viewer"],
    "automation.create": ["Owner", "Admin", "Manager"],
    "automation.update": ["Owner", "Admin", "Manager"],
    "automation.delete": ["Owner", "Admin"],
    "automation.execute": ["Owner", "Admin", "Manager", "Member"],
    # Knowledge base
    "knowledge.read": ["Owner", "Admin", "Manager", "Member", "Viewer"],
    "knowledge.upload": ["Owner", "Admin", "Manager", "Member"],
    "knowledge.delete": ["Owner", "Admin"],
    # Analytics
    "analytics.view": ["Owner", "Admin", "Manager", "Member", "Viewer"],
    "analytics.export": ["Owner", "Admin", "Manager"],
    # Billing
    "billing.view": ["Owner", "Admin"],
    "billing.manage": ["Owner"],
    # Team
    "team.invite": ["Owner", "Admin", "Manager"],
    "team.manage_roles": ["Owner", "Admin"],
    "team.remove_members": ["Owner", "Admin"],
    # Settings
    "settings.view": ["Owner", "Admin", "Manager", "Member"],
    "settings.update": ["Owner", "Admin"],
    # Organization
    "organization.read": ["Owner", "Admin", "Manager", "Member", "Viewer"],
    "organization.update": ["Owner", "Admin"],
    "organization.delete": ["Owner"],
}


def hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except Exception:
        return False


def create_access_token(
    user_id: str,
    session_id: Optional[str] = None,
    tenant_id: Optional[str] = "",
    role: str = "Member",
    email: Optional[str] = None,
    expires_delta: Optional[timedelta] = None,
    settings: Optional[SecuritySettings] = None,
) -> str:
    """Generate a signed JWT access token."""
    sec = settings or get_settings().security
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=sec.access_token_expire_minutes)
    )

    payload = {
        "sub": user_id,
        "session_id": session_id,
        "tenant_id": tenant_id,
        "role": role,
        "email": email,
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, sec.jwt_secret_key, algorithm=sec.jwt_algorithm)


def decode_access_token(token: str, settings: Optional[SecuritySettings] = None) -> TokenPayload:
    """Decode and validate a JWT access token."""
    sec = settings or get_settings().security
    try:
        data = jwt.decode(token, sec.jwt_secret_key, algorithms=[sec.jwt_algorithm])
        return TokenPayload(**data)
    except JWTError as err:
        logger.warn("Invalid JWT token provided", error=str(err))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


def can(role: str, permission: str) -> bool:
    """Check if the given role is granted permission."""
    allowed_roles = PERMISSIONS.get(permission, [])
    return role in allowed_roles


from fastapi import Depends, HTTPException, Request, Security, status

async def get_current_user(
    request: Request,
    auth: Optional[HTTPAuthorizationCredentials] = Security(security_scheme),
) -> TokenPayload:
    """FastAPI dependency to extract and authenticate current user from Bearer token or session cookie."""
    token: Optional[str] = None
    if auth and auth.credentials:
        token = auth.credentials
    elif request and request.cookies.get("session_id"):
        session_id = request.cookies.get("session_id")
        from app.core.redis import redis_manager
        import json

        redis_client = redis_manager.client
        session_cache_key = f"session:id:{session_id}"
        try:
            cached_session = await asyncio.wait_for(
                redis_client.get(session_cache_key),
                timeout=0.5,
            )
            if cached_session:
                data = json.loads(cached_session)
                user_id = data.get("user_id")
                expires_at = data.get("expires_at")
                if user_id and expires_at and expires_at > datetime.now(timezone.utc).isoformat():
                    return TokenPayload(
                        sub=user_id,
                        session_id=session_id,
                        tenant_id=data.get("tenant_id", "") or "",
                        role=data.get("role", "Member") or "Member",
                    )
        except Exception:
            pass

        from app.core.database import db_manager
        from app.models.auth import Session as UserSession
        from sqlalchemy import select

        async with db_manager.session_factory() as db:
            stmt = select(UserSession).where(UserSession.id == session_id).limit(1)
            res = await db.execute(stmt)
            ses = res.scalar_one_or_none()
            if ses and not ses.revoked_at:
                now_dt = datetime.now(timezone.utc)
                now_str = now_dt.isoformat()
                if ses.expires_at > now_str:
                    try:
                        exp_dt = datetime.fromisoformat(ses.expires_at)
                        ttl = int((exp_dt - now_dt).total_seconds())
                        if ttl > 0:
                            await redis_client.set(
                                session_cache_key,
                                json.dumps({"user_id": ses.user_id, "expires_at": ses.expires_at}),
                                ex=min(ttl, 86400 * 7),
                            )
                    except Exception:
                        pass
                    return TokenPayload(sub=ses.user_id, session_id=ses.id, role="Member")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired or revoked",
                headers={"WWW-Authenticate": "Bearer"},
            )

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return decode_access_token(token)


async def get_current_tenant_id(
    user: TokenPayload = Depends(get_current_user),
) -> str:
    """Authoritative tenant resolution dependency.

    Guarantees tenant_id originates from cryptographic token, never unvalidated HTTP headers.
    """
    return user.tenant_id or ""
