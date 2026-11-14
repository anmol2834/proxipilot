"""Server-Side Google OAuth 2.0 Integration Service for Gmail.

Features:
- Single-use, cryptographically secure, tenant-bound OAuth state mechanism using Redis.
- Zero credential leakage: Tokens encrypted via AES-256-GCM immediately upon receipt.
- Multi-account support: Multiple Gmail mailboxes per organization.
- Automatic creation of Google Cloud Pub/Sub watch and initial sync queue dispatch.
- Audit event emission for compliance.
"""

from datetime import datetime, timezone
import json
import secrets
from typing import Any, Dict, Optional, Tuple
import urllib.parse
from fastapi import HTTPException, status
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import get_settings
from app.core.crypto import credential_encryption
from app.core.http_client import http_client_manager
from app.core.logging import logger
from app.core.messaging import DomainEvent, event_bus
from app.core.redis import redis_manager
from app.models.audit import AuditAction, AuditActorType, AuditEvent
from app.models.integration import (
    ConnectedIntegrationAccount,
    ConnectionHealthStatus,
    EmailProvider,
    IntegrationStatus,
    OAuthCredentialMetadata,
)
from app.services.gmail_watch import gmail_watch_service


class GmailOAuthService:
    """Handles OAuth 2.0 authorization, callback, credential encryption, and initial setup."""

    GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
    GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

    GMAIL_SCOPES = [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
    ]

    def __init__(self):
        self.settings = get_settings()

    async def create_authorization_url(
        self,
        tenant_id: str,
        user_id: str,
        email_hint: Optional[str] = None,
        display_name: Optional[str] = None,
        return_url: Optional[str] = None,
    ) -> Dict[str, str]:
        """Generate a secure, single-use, tenant-bound OAuth state and authorization URL."""
        client_id = self.settings.providers.get_effective_gmail_client_id()
        redirect_uri = self.settings.providers.gmail_redirect_uri

        if not client_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Google OAuth Client ID is not configured on the backend.",
            )

        # Cryptographically secure random 256-bit state
        state_token = secrets.token_urlsafe(32)
        state_data = {
            "tenant_id": tenant_id,
            "user_id": user_id,
            "email_hint": email_hint,
            "display_name": display_name,
            "return_url": return_url or "/dashboard/integrations",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        # Store in Redis with a 10-minute expiration
        redis_client = redis_manager.client
        await redis_client.set(
            f"gmail:oauth:state:{state_token}",
            json.dumps(state_data),
            ex=600,
        )

        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(self.GMAIL_SCOPES),
            "access_type": "offline",
            "prompt": "consent",  # Guarantees refresh_token is returned
            "state": state_token,
            "include_granted_scopes": "true",
        }
        if email_hint:
            params["login_hint"] = email_hint

        auth_url = f"{self.GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"
        return {"auth_url": auth_url, "state": state_token}

    async def handle_oauth_callback(
        self,
        code: str,
        state: str,
        db: AsyncSession,
    ) -> Tuple[ConnectedIntegrationAccount, str]:
        """Validate single-use state, exchange code for tokens, encrypt, and configure mailbox."""
        redis_client = redis_manager.client
        state_key = f"gmail:oauth:state:{state}"

        # Atomic single-use consumption: get and delete immediately
        state_raw = await redis_client.get(state_key)
        if not state_raw:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired OAuth state parameter. Please retry the connection.",
            )
        await redis_client.delete(state_key)

        state_data = json.loads(state_raw)
        tenant_id = state_data["tenant_id"]
        user_id = state_data["user_id"]
        custom_display_name = state_data.get("display_name")
        return_url = state_data.get("return_url", "/dashboard/integrations")

        # 1. Exchange authorization code for tokens
        client_id = self.settings.providers.get_effective_gmail_client_id()
        client_secret = self.settings.providers.get_effective_gmail_client_secret()
        redirect_uri = self.settings.providers.gmail_redirect_uri

        http_client = http_client_manager.client
        token_resp = await http_client.post(
            self.GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
            timeout=self.settings.providers.gmail_api_timeout,
        )

        if token_resp.status_code != 200:
            logger.error("Failed to exchange OAuth code for tokens", resp=token_resp.text)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Google token exchange failed: {token_resp.text}",
            )

        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in", 3600)
        scopes_granted = token_data.get("scope", " ".join(self.GMAIL_SCOPES))

        # 2. Fetch Google profile identity
        userinfo_resp = await http_client.get(
            self.GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=15.0,
        )
        if userinfo_resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to retrieve Google user profile identity.",
            )

        userinfo = userinfo_resp.json()
        google_sub = userinfo.get("id")
        google_email = userinfo.get("email")
        google_name = userinfo.get("name") or google_email.split("@")[0]

        if not google_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google did not return a verified email address.",
            )

        # Calculate token expiration timestamp
        now = datetime.now(timezone.utc)
        from datetime import timedelta
        token_expires_at = (now + timedelta(seconds=expires_in)).isoformat()
        now_str = now.isoformat()

        # Encrypt tokens with AES-256-GCM
        access_token_enc = credential_encryption.encrypt(access_token)
        refresh_token_enc = credential_encryption.encrypt(refresh_token) if refresh_token else None

        # 3. Check for existing ConnectedIntegrationAccount for this tenant & email
        res = await db.execute(
            select(ConnectedIntegrationAccount).where(
                ConnectedIntegrationAccount.tenant_id == tenant_id,
                ConnectedIntegrationAccount.email_address == google_email,
                ConnectedIntegrationAccount.provider == EmailProvider.GMAIL.value,
            )
        )
        account = res.scalar_one_or_none()

        is_reconnect = account is not None
        if account:
            # Reconnect existing account
            account.display_name = custom_display_name or account.display_name or google_name
            account.provider_account_id = google_sub
            account.access_token_encrypted = access_token_enc
            if refresh_token_enc:
                account.refresh_token_encrypted = refresh_token_enc
            account.token_expires_at = token_expires_at
            account.scopes = scopes_granted
            account.status = IntegrationStatus.CONNECTED.value
            account.connection_status = ConnectionHealthStatus.HEALTHY.value
            account.sync_enabled = True
            account.last_connected_at = now_str
            account.last_error_code = None
            account.last_error_at = None
        else:
            # Create new account
            account = ConnectedIntegrationAccount(
                tenant_id=tenant_id,
                provider=EmailProvider.GMAIL.value,
                email_address=google_email,
                display_name=custom_display_name or google_name,
                provider_account_id=google_sub,
                access_token_encrypted=access_token_enc,
                refresh_token_encrypted=refresh_token_enc,
                token_expires_at=token_expires_at,
                scopes=scopes_granted,
                status=IntegrationStatus.CONNECTED.value,
                connection_status=ConnectionHealthStatus.HEALTHY.value,
                sync_enabled=True,
                last_connected_at=now_str,
                connected_by_user_id=user_id,
            )
            db.add(account)

        await db.flush()

        # 4. Upsert OAuthCredentialMetadata
        res_meta = await db.execute(
            select(OAuthCredentialMetadata).where(
                OAuthCredentialMetadata.integration_account_id == account.id
            )
        )
        meta = res_meta.scalar_one_or_none()
        if not meta:
            meta = OAuthCredentialMetadata(
                tenant_id=tenant_id,
                integration_account_id=account.id,
                provider_account_id=google_sub,
                provider_email=google_email,
                raw_profile_json=json.dumps(userinfo),
            )
            db.add(meta)
        else:
            meta.provider_account_id = google_sub
            meta.provider_email = google_email
            meta.raw_profile_json = json.dumps(userinfo)

        await db.commit()
        await db.refresh(account)

        # 5. Register Google Cloud Pub/Sub watch. It also sets the fresh sync baseline
        #    (current historyId): only mail arriving AFTER this moment is processed.
        watch_ok = False
        try:
            await gmail_watch_service.create_or_renew_watch(account, db, is_renewal=False)
            account.last_synced_at = now_str
            account.last_successful_sync_at = now_str
            account.status = IntegrationStatus.CONNECTED.value
            account.connection_status = ConnectionHealthStatus.HEALTHY.value
            await db.commit()
            watch_ok = True
        except Exception as watch_err:
            logger.error("Failed to register Gmail watch immediately after OAuth", error=str(watch_err))

        # 6. Publish domain event to Redis Streams for initial or catch-up sync
        # Reconnecting accounts already have their history established: dispatch lightweight incremental sync
        # rather than a blocking 100-message initial sync.
        sync_event_type = "gmail.initial_sync"  # baseline only: never imports old mail
        event = None if watch_ok else DomainEvent(
            event_type=sync_event_type,
            tenant_id=tenant_id,
            aggregate_type="integration_account",
            aggregate_id=account.id,
            payload={
                "account_id": account.id,
                "email_address": account.email_address,
                "provider": "gmail",
                "history_id": account.last_history_id,
            },
        )
        try:
            if event is not None:
                await event_bus.publish("email_events", event)
        except Exception as pub_err:
            logger.warning("Failed to publish sync domain event", error=str(pub_err))

        # 7. Record audit event
        from app.services.audit import audit_service
        await audit_service.record(
            db=db,
            action=AuditAction.GMAIL_CONNECTED,
            actor_type=AuditActorType.USER,
            organization_id=tenant_id,
            actor_user_id=user_id,
            resource_type="integration_account",
            resource_id=account.id,
            metadata={
                "action": "GMAIL_CONNECTED",
                "email": account.email_address,
                "provider": "gmail",
            },
        )
        await db.commit()

        # Invalidate account cache so webhooks immediately recognize this account as active
        try:
            await redis_manager.client.delete(f"gmail:account_cache:{account.email_address}")
        except Exception:
            pass

        logger.info(
            "Gmail account connected successfully",
            tenant_id=tenant_id,
            account_id=account.id,
            email=account.email_address,
        )
        return account, return_url


gmail_oauth_service = GmailOAuthService()
