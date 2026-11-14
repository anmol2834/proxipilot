"""Integration Management API Endpoints.

Provides:
- GET /integrations: Tenant-scoped listing of all connected accounts with zero credential leaks.
- GET /integrations/gmail/connect: Generates secure Google OAuth 2.0 authorization URL.
- GET /integrations/gmail/oauth/callback: Handles Google redirect, exchanges tokens, creates watch, and redirects to UI.
- DELETE /integrations/gmail/{integration_id}: Organization-scoped mailbox disconnect without impacting peers.
- POST /integrations/gmail/{integration_id}/reconnect: Reconnect flow for invalid/revoked accounts.
- POST /integrations/gmail/{integration_id}/sync: Manual synchronization trigger.
- GET /integrations/gmail/{integration_id}/health: Granular connection health and cursor diagnosis.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import urllib.parse
from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import get_settings
from app.core.database import get_db
from app.core.logging import logger
from app.core.redis import redis_manager
from app.core.security import TokenPayload, get_current_user
from app.models.audit import AuditAction, AuditActorType, AuditEvent
from app.models.organization import MembershipStatus, OrganizationMember
from app.models.integration import (
    ConnectedIntegrationAccount,
    ConnectionHealthStatus,
    EmailProvider,
    IntegrationStatus,
    SyncCursor,
)
from app.services.gmail_client import GmailReauthRequiredException
from app.services.gmail_oauth import gmail_oauth_service
from app.services.gmail_sync import gmail_sync_engine
from app.services.gmail_watch import gmail_watch_service

router = APIRouter(prefix="/integrations", tags=["Integrations"])


# ==============================================================================
# Response Schemas (Strictly Zero Secrets)
# ==============================================================================

class IntegrationAccountDTO(BaseModel):
    """Sanitized integration account representation safe for frontend presentation."""

    id: str
    organization_id: str
    provider: str
    email_address: str
    display_name: Optional[str] = None
    provider_account_id: Optional[str] = None
    status: str
    connection_status: str
    scopes: List[str] = Field(default_factory=list)
    last_synced_at: Optional[str] = None
    last_successful_sync_at: Optional[str] = None
    last_connected_at: Optional[str] = None
    last_error_code: Optional[str] = None
    created_at: str
    updated_at: str


class ConnectUrlResponse(BaseModel):
    auth_url: str
    state: str


class HealthStatusDTO(BaseModel):
    account_id: str
    email_address: str
    provider: str
    status: str
    connection_status: str
    watch_active: bool
    watch_expires_at: Optional[str] = None
    current_history_id: Optional[str] = None
    last_successful_sync_at: Optional[str] = None
    last_error_code: Optional[str] = None


async def _resolve_tenant_id(
    user: TokenPayload,
    db: AsyncSession,
    header_org_id: Optional[str] = None,
    query_org_id: Optional[str] = None,
) -> str:
    """Authoritatively resolve organization/tenant ID for authenticated user."""
    # 1. If explicit header or query parameter passed, sanitize
    target_org_id = header_org_id or query_org_id
    if target_org_id and target_org_id.strip().lower() in ("default", "undefined", "null", ""):
        target_org_id = None

    # 2. If token already contains verified tenant_id and no override requested, return it directly
    if not target_org_id and user.tenant_id:
        return user.tenant_id

    # 3. If target_org_id matches user.tenant_id, it is already authenticated and verified
    if target_org_id and user.tenant_id and target_org_id == user.tenant_id:
        return target_org_id

    # Fast-path: Check Redis cache for verified (user_id, organization_id) membership
    if target_org_id:
        try:
            cached_ok = await redis_manager.client.get(f"auth:mem:{user.sub}:{target_org_id}")
            if cached_ok == "1":
                return target_org_id
        except Exception:
            pass

    # 4. If still not found, resolve user's primary organization membership from database
    if not target_org_id:
        stmt = (
            select(OrganizationMember.organization_id)
            .where(
                OrganizationMember.user_id == user.sub,
                OrganizationMember.status.in_(["ACTIVE", "active"]),
            )
            .order_by(OrganizationMember.created_at.asc())
            .limit(1)
        )
        res = await db.execute(stmt)
        target_org_id = res.scalar_one_or_none()

    if not target_org_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context required: User belongs to no active organization.",
        )

    # 5. Verify user membership in requested organization
    mem_stmt = select(OrganizationMember).where(
        OrganizationMember.user_id == user.sub,
        OrganizationMember.organization_id == target_org_id,
        OrganizationMember.status.in_(["ACTIVE", "active"]),
    )
    mem_res = await db.execute(mem_stmt)
    membership = mem_res.scalar_one_or_none()
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to requested organization.",
        )

    # Cache verified membership in Redis for 10 minutes to eliminate repetitive DB queries
    try:
        await redis_manager.client.set(f"auth:mem:{user.sub}:{target_org_id}", "1", ex=600)
    except Exception:
        pass

    return target_org_id


# ==============================================================================
# Routes
# ==============================================================================

@router.get("", response_model=Dict[str, Any])
async def list_integrations(
    header_org_id: Optional[str] = Header(None, alias="X-Organization-Id"),
    query_org_id: Optional[str] = Query(None, alias="organization_id"),
    user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """List all connected integration accounts for the authenticated organization."""
    tenant_id = await _resolve_tenant_id(user, db, header_org_id, query_org_id)

    stmt = (
        select(ConnectedIntegrationAccount, SyncCursor)
        .outerjoin(SyncCursor, SyncCursor.integration_account_id == ConnectedIntegrationAccount.id)
        .where(
            ConnectedIntegrationAccount.tenant_id == tenant_id,
            ConnectedIntegrationAccount.status != IntegrationStatus.DISCONNECTED.value,
        )
        .order_by(ConnectedIntegrationAccount.created_at.desc())
    )
    res = await db.execute(stmt)
    rows = res.all()
    now = datetime.now(timezone.utc)

    dtos: List[Dict[str, Any]] = []
    for acc, cursor in rows:
        # Enterprise Self-Healing: If an account has status or connection_status == 'syncing',
        # verify if the distributed lock is actually held. If no worker is actively holding the lock,
        # heal the database state back to CONNECTED / HEALTHY immediately.
        if (
            acc.status == IntegrationStatus.SYNCING.value
            or acc.connection_status == ConnectionHealthStatus.SYNCING.value
        ):
            try:
                lock_held = await redis_manager.client.exists(f"gmail:sync:{acc.id}")
                if not lock_held:
                    logger.info("Self-healing stuck syncing account status", account_id=acc.id, email=acc.email_address)
                    acc.status = IntegrationStatus.CONNECTED.value
                    acc.connection_status = ConnectionHealthStatus.HEALTHY.value
                    from sqlalchemy import update
                    await db.execute(
                        update(ConnectedIntegrationAccount)
                        .where(ConnectedIntegrationAccount.id == acc.id)
                        .values(
                            status=IntegrationStatus.CONNECTED.value,
                            connection_status=ConnectionHealthStatus.HEALTHY.value,
                        )
                    )
                    if cursor and cursor.sync_state in ("syncing", "recovering"):
                        cursor.sync_state = "idle"
                        await db.execute(
                            update(SyncCursor)
                            .where(SyncCursor.id == cursor.id)
                            .values(sync_state="idle")
                        )
                    await db.commit()
            except Exception as heal_err:
                logger.warning("Failed to auto-heal stuck sync status", error=str(heal_err))

        scope_list = acc.scopes.split(" ") if acc.scopes else []
        watch_active = False
        watch_expired = False
        if cursor and cursor.watch_expires_at:
            try:
                exp = datetime.fromisoformat(cursor.watch_expires_at)
                watch_active = exp > now
                watch_expired = exp <= now
            except Exception:
                watch_expired = True

        needs_reconnect = (
            acc.status == IntegrationStatus.REAUTH_REQUIRED.value
            or acc.connection_status == ConnectionHealthStatus.REAUTH_REQUIRED.value
            or acc.last_error_code in ("invalid_grant", "REAUTH_REQUIRED", "unauthorized_client")
            or watch_expired
        )

        reconnect_reason = None
        if acc.status == IntegrationStatus.REAUTH_REQUIRED.value or acc.last_error_code in ("invalid_grant", "REAUTH_REQUIRED", "unauthorized_client"):
            reconnect_reason = "Google OAuth authorization expired or was revoked. Please reconnect the account to restore email syncing."
        elif watch_expired:
            reconnect_reason = "Gmail 7-day sync watch has expired. Please reconnect your account to renew Google Pub/Sub push notifications."

        dtos.append({
            "id": acc.id,
            "organization_id": acc.tenant_id,
            "provider": acc.provider,
            "email_address": acc.email_address,
            "display_name": acc.display_name,
            "provider_account_id": acc.provider_account_id,
            "status": acc.status,
            "connection_status": acc.connection_status,
            "scopes": scope_list,
            "last_synced_at": acc.last_synced_at,
            "last_successful_sync_at": acc.last_successful_sync_at,
            "last_connected_at": acc.last_connected_at,
            "last_error_code": acc.last_error_code,
            "watch_active": watch_active,
            "watch_expires_at": cursor.watch_expires_at if cursor else None,
            "watch_expired": watch_expired,
            "needs_reconnect": needs_reconnect,
            "reconnect_reason": reconnect_reason,
            "automation_enabled": getattr(acc, "automation_enabled", True),
            "created_at": acc.created_at,
            "updated_at": acc.updated_at,
        })

    return {"success": True, "data": dtos}


@router.get("/gmail/connect", response_model=Dict[str, Any])
async def connect_gmail(
    email_hint: Optional[str] = Query(default=None, description="Optional Google email login hint"),
    display_name: Optional[str] = Query(default=None, description="Optional custom label for mailbox"),
    return_url: Optional[str] = Query(default=None, description="Frontend route to redirect after OAuth"),
    header_org_id: Optional[str] = Header(None, alias="X-Organization-Id"),
    query_org_id: Optional[str] = Query(None, alias="organization_id"),
    user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Initiate server-side Google OAuth 2.0 flow for Gmail."""
    tenant_id = await _resolve_tenant_id(user, db, header_org_id, query_org_id)

    result = await gmail_oauth_service.create_authorization_url(
        tenant_id=tenant_id,
        user_id=user.sub,
        email_hint=email_hint,
        display_name=display_name,
        return_url=return_url,
    )
    return {"success": True, "data": result}


def _build_frontend_redirect_url(path_or_url: str) -> str:
    """Ensure redirect URL points to the frontend application rather than the API server."""
    if path_or_url.startswith("http://") or path_or_url.startswith("https://"):
        return path_or_url
    settings = get_settings()
    frontend_base = getattr(settings, "frontend_url", "http://localhost:3000").rstrip("/")
    if not path_or_url.startswith("/"):
        path_or_url = "/" + path_or_url
    return f"{frontend_base}{path_or_url}"


@router.get("/gmail/oauth/callback")
async def gmail_oauth_callback(
    code: Optional[str] = Query(default=None),
    state: Optional[str] = Query(default=None),
    error: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Public redirect URI registered in Google Cloud Console."""
    if error or not code or not state:
        logger.warning("OAuth callback received error or missing parameters", error=error)
        dest = _build_frontend_redirect_url(f"/dashboard/integrations?error={urllib.parse.quote(error or 'missing_code')}")
        return RedirectResponse(url=dest)

    try:
        account, return_url = await gmail_oauth_service.handle_oauth_callback(
            code=code,
            state=state,
            db=db,
        )
        safe_return = return_url or "/dashboard/integrations"
        sep = "&" if "?" in safe_return else "?"
        dest = _build_frontend_redirect_url(
            f"{safe_return}{sep}connected=true&email={urllib.parse.quote(account.email_address)}"
        )
        return RedirectResponse(url=dest)
    except Exception as exc:
        logger.error("OAuth callback processing failed", error=str(exc))
        dest = _build_frontend_redirect_url(f"/dashboard/integrations?error={urllib.parse.quote(str(exc))}")
        return RedirectResponse(url=dest)


@router.delete("/gmail/{integration_id}", response_model=Dict[str, Any])
async def disconnect_gmail(
    integration_id: str,
    header_org_id: Optional[str] = Header(None, alias="X-Organization-Id"),
    query_org_id: Optional[str] = Query(None, alias="organization_id"),
    user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Disconnect a connected Gmail mailbox. Strictly isolated by organization."""
    tenant_id = await _resolve_tenant_id(user, db, header_org_id, query_org_id)

    # Authoritative organization-scoped lookup
    stmt = select(ConnectedIntegrationAccount).where(
        ConnectedIntegrationAccount.id == integration_id,
        ConnectedIntegrationAccount.tenant_id == tenant_id,
    )
    res = await db.execute(stmt)
    account = res.scalar_one_or_none()

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration account not found or access denied.",
        )

    now_str = datetime.now(timezone.utc).isoformat()

    # 1. Terminate Google Pub/Sub watch
    await gmail_watch_service.stop_watch(account, db)

    # 2. Mark account disconnected
    account.status = IntegrationStatus.DISCONNECTED.value
    account.connection_status = ConnectionHealthStatus.DISCONNECTED.value
    account.last_disconnected_at = now_str
    account.sync_enabled = False

    # 3. Record audit event
    from app.services.audit import audit_service
    await audit_service.record(
        db=db,
        action=AuditAction.GMAIL_DISCONNECTED,
        actor_type=AuditActorType.USER,
        organization_id=tenant_id,
        actor_user_id=user.sub,
        resource_type="integration_account",
        resource_id=account.id,
        metadata={
            "action": "GMAIL_DISCONNECTED",
            "email": account.email_address,
        },
    )
    await db.commit()

    # Invalidate account cache so webhooks immediately stop processing
    try:
        await redis_manager.client.delete(f"gmail:account_cache:{account.email_address}")
    except Exception:
        pass

    logger.info(
        "Gmail account disconnected successfully",
        tenant_id=tenant_id,
        account_id=account.id,
        email=account.email_address,
    )
    return {"success": True, "message": f"Successfully disconnected {account.email_address}"}


@router.post("/gmail/{integration_id}/reconnect", response_model=Dict[str, Any])
async def reconnect_gmail(
    integration_id: str,
    header_org_id: Optional[str] = Header(None, alias="X-Organization-Id"),
    query_org_id: Optional[str] = Query(None, alias="organization_id"),
    user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Initiate reauthorization for an account requiring re-auth."""
    tenant_id = await _resolve_tenant_id(user, db, header_org_id, query_org_id)
    stmt = select(ConnectedIntegrationAccount).where(
        ConnectedIntegrationAccount.id == integration_id,
        ConnectedIntegrationAccount.tenant_id == tenant_id,
    )
    res = await db.execute(stmt)
    account = res.scalar_one_or_none()

    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    result = await gmail_oauth_service.create_authorization_url(
        tenant_id=tenant_id,
        user_id=user.sub,
        email_hint=account.email_address,
        display_name=account.display_name,
        return_url="/dashboard/integrations",
    )
    return {"success": True, "data": result}


@router.post("/gmail/{integration_id}/sync", response_model=Dict[str, Any])
async def trigger_manual_sync(
    integration_id: str,
    background_tasks: BackgroundTasks,
    header_org_id: Optional[str] = Header(None, alias="X-Organization-Id"),
    query_org_id: Optional[str] = Query(None, alias="organization_id"),
    user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Trigger manual background synchronization for a connected Gmail account."""
    tenant_id = await _resolve_tenant_id(user, db, header_org_id, query_org_id)
    stmt = select(ConnectedIntegrationAccount).where(
        ConnectedIntegrationAccount.id == integration_id,
        ConnectedIntegrationAccount.tenant_id == tenant_id,
    )
    res = await db.execute(stmt)
    account = res.scalar_one_or_none()

    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    if account.status == IntegrationStatus.DISCONNECTED.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot sync disconnected account")

    if (
        account.status == IntegrationStatus.REAUTH_REQUIRED.value
        or account.connection_status == ConnectionHealthStatus.REAUTH_REQUIRED.value
        or account.last_error_code in ("invalid_grant", "REAUTH_REQUIRED", "unauthorized_client")
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot sync account requiring re-authorization. The 7-day Gmail watch or Google authorization has expired. Please reconnect the account first.",
        )

    # Check if watch is expired and attempt auto-renewal if tokens allow
    res_cur = await db.execute(select(SyncCursor).where(SyncCursor.integration_account_id == account.id))
    cursor = res_cur.scalar_one_or_none()
    if cursor and cursor.watch_expires_at:
        try:
            exp = datetime.fromisoformat(cursor.watch_expires_at)
            now = datetime.now(timezone.utc)
            if exp <= now:
                # Try to renew watch automatically using refresh token
                try:
                    await gmail_watch_service.create_or_renew_watch(account, db, is_renewal=True)
                except GmailReauthRequiredException:
                    account.status = IntegrationStatus.REAUTH_REQUIRED.value
                    account.connection_status = ConnectionHealthStatus.REAUTH_REQUIRED.value
                    account.last_error_code = "REAUTH_REQUIRED"
                    await db.commit()
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Cannot sync account requiring re-authorization. The 7-day Gmail watch has expired and authorization needs renewal. Please reconnect the account first.",
                    )
                except Exception as w_err:
                    logger.warning("Failed to auto-renew expired watch before sync", error=str(w_err))
        except HTTPException:
            raise
        except Exception:
            pass

    background_tasks.add_task(gmail_sync_engine.sync_account, account.id)
    return {"success": True, "message": f"Manual synchronization queued for {account.email_address}"}


@router.get("/gmail/{integration_id}/health", response_model=Dict[str, Any])
async def get_integration_health(
    integration_id: str,
    header_org_id: Optional[str] = Header(None, alias="X-Organization-Id"),
    query_org_id: Optional[str] = Query(None, alias="organization_id"),
    user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Diagnose connection health and watch expiration status for a mailbox."""
    tenant_id = await _resolve_tenant_id(user, db, header_org_id, query_org_id)
    stmt = (
        select(ConnectedIntegrationAccount, SyncCursor)
        .outerjoin(SyncCursor, SyncCursor.integration_account_id == ConnectedIntegrationAccount.id)
        .where(
            ConnectedIntegrationAccount.id == integration_id,
            ConnectedIntegrationAccount.tenant_id == tenant_id,
        )
    )
    res = await db.execute(stmt)
    row = res.first()

    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    account, cursor = row
    now = datetime.now(timezone.utc)

    watch_active = False
    if cursor and cursor.watch_expires_at:
        try:
            exp = datetime.fromisoformat(cursor.watch_expires_at)
            watch_active = exp > now
        except Exception:
            pass

    return {
        "success": True,
        "data": {
            "account_id": account.id,
            "email_address": account.email_address,
            "provider": account.provider,
            "status": account.status,
            "connection_status": account.connection_status,
            "watch_active": watch_active,
            "watch_expires_at": cursor.watch_expires_at if cursor else None,
            "current_history_id": cursor.cursor_value if cursor else None,
            "last_successful_sync_at": account.last_successful_sync_at,
            "last_error_code": account.last_error_code,
            "automation_enabled": getattr(account, "automation_enabled", True),
        },
    }


class AutomationToggleRequest(BaseModel):
    automation_enabled: bool


@router.get("/{integration_id}/automation")
async def get_account_automation(
    integration_id: str,
    header_org_id: Optional[str] = Header(None, alias="X-Organization-Id"),
    query_org_id: Optional[str] = Query(None, alias="organization_id"),
    user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Get AI auto-reply automation state for a connected integration account."""
    tenant_id = await _resolve_tenant_id(user, db, header_org_id, query_org_id)
    stmt = select(ConnectedIntegrationAccount).where(
        ConnectedIntegrationAccount.id == integration_id,
        ConnectedIntegrationAccount.tenant_id == tenant_id,
    )
    res = await db.execute(stmt)
    account = res.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Integration account not found")

    from app.services.reply_planner.delivery import outbound_delivery_service
    is_enabled = await outbound_delivery_service.is_automation_enabled(tenant_id, account.id, db)
    return {
        "success": True,
        "data": {
            "integration_id": account.id,
            "email_address": account.email_address,
            "automation_enabled": is_enabled,
        },
    }


@router.patch("/{integration_id}/automation")
async def update_account_automation(
    integration_id: str,
    payload: AutomationToggleRequest,
    header_org_id: Optional[str] = Header(None, alias="X-Organization-Id"),
    query_org_id: Optional[str] = Query(None, alias="organization_id"),
    user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Turn AI auto-reply automation ON or OFF anytime for a connected integration account."""
    tenant_id = await _resolve_tenant_id(user, db, header_org_id, query_org_id)
    stmt = select(ConnectedIntegrationAccount).where(
        ConnectedIntegrationAccount.id == integration_id,
        ConnectedIntegrationAccount.tenant_id == tenant_id,
    )
    res = await db.execute(stmt)
    account = res.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Integration account not found")

    from app.services.reply_planner.delivery import outbound_delivery_service
    await outbound_delivery_service.set_automation_enabled(
        tenant_id=tenant_id,
        account_id=account.id,
        enabled=payload.automation_enabled,
        db=db,
    )

    return {
        "success": True,
        "message": f"AI automation {'enabled' if payload.automation_enabled else 'disabled'} successfully.",
        "data": {
            "integration_id": account.id,
            "email_address": account.email_address,
            "automation_enabled": payload.automation_enabled,
        },
    }

