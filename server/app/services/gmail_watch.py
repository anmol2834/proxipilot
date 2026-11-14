"""Gmail Watch Management Service.

Responsibilities:
- Registering Google Cloud Pub/Sub push topics on Gmail mailboxes via users.watch().
- Storing and updating watch expiration and initial historyId in SyncCursor.
- Automatic renewal of watches before the 7-day Google expiration deadline.
- Safely terminating watches via users.stop() upon mailbox disconnection.
- Emitting structured audit events.
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import get_settings
from app.core.logging import logger
from app.models.audit import AuditAction, AuditActorType, AuditEvent
from app.models.integration import (
    ConnectedIntegrationAccount,
    ConnectionHealthStatus,
    CursorSyncState,
    IntegrationStatus,
    SyncCursor,
)
from app.services.gmail_client import gmail_client


class GmailWatchService:
    """Service to create, renew, and terminate Gmail Pub/Sub watches."""

    def __init__(self):
        self.settings = get_settings()

    async def create_or_renew_watch(
        self,
        account: ConnectedIntegrationAccount,
        db: AsyncSession,
        is_renewal: bool = False,
    ) -> SyncCursor:
        """Call Gmail users.watch(), update SyncCursor expiration & historyId, and log audit event."""
        topic_name = self.settings.providers.gmail_pubsub_topic
        if not topic_name:
            raise ValueError("GMAIL_PUBSUB_TOPIC is not configured")

        access_token = await gmail_client.get_valid_access_token(account, db)
        watch_data = await gmail_client.watch_user(access_token, topic_name)

        history_id = str(watch_data.get("historyId", ""))
        expiration_raw = watch_data.get("expiration")  # epoch milliseconds

        # Convert epoch ms to ISO 8601 string
        watch_expires_at: Optional[str] = None
        if expiration_raw:
            try:
                exp_epoch_sec = float(expiration_raw) / 1000.0
                watch_expires_at = datetime.fromtimestamp(exp_epoch_sec, tz=timezone.utc).isoformat()
            except Exception as e:
                logger.warning("Failed to parse watch expiration epoch", raw=expiration_raw, error=str(e))

        now_str = datetime.now(timezone.utc).isoformat()

        # Load or create SyncCursor
        res = await db.execute(
            select(SyncCursor).where(SyncCursor.integration_account_id == account.id)
        )
        cursor = res.scalar_one_or_none()
        if not cursor:
            cursor = SyncCursor(
                tenant_id=account.tenant_id,
                integration_account_id=account.id,
                provider="gmail",
                cursor_type="history_id",
                cursor_value=history_id,
                sync_state=CursorSyncState.IDLE.value,
                watch_expires_at=watch_expires_at,
                last_successful_sync_at=now_str,
            )
            db.add(cursor)
        else:
            # On initial connect or reconnect (is_renewal=False), update cursor_value to
            # the fresh history_id returned by watch so we don't replay stale historical events.
            # On periodic background renewal (is_renewal=True), preserve current cursor_value.
            watch_had_expired = False
            if is_renewal and cursor.watch_expires_at:
                try:
                    prev_exp = datetime.fromisoformat(str(cursor.watch_expires_at).replace("Z", "+00:00"))
                    if prev_exp.tzinfo is None:
                        prev_exp = prev_exp.replace(tzinfo=timezone.utc)
                    watch_had_expired = prev_exp <= datetime.now(timezone.utc)
                except (ValueError, TypeError):
                    watch_had_expired = False
            # Fresh start (no backfill) on connect, reconnect, or renewal of an expired watch.
            if not is_renewal or not cursor.cursor_value or watch_had_expired:
                cursor.cursor_value = history_id
                cursor.last_successful_sync_at = now_str
            cursor.watch_expires_at = watch_expires_at
            cursor.sync_state = CursorSyncState.IDLE.value

        account.last_history_id = cursor.cursor_value or history_id
        if account.status != IntegrationStatus.CONNECTED.value:
            account.status = IntegrationStatus.CONNECTED.value
            account.connection_status = ConnectionHealthStatus.HEALTHY.value

        # Record audit event
        from app.services.audit import audit_service
        await audit_service.record(
            db=db,
            action=AuditAction.GMAIL_WATCH_RENEWED if is_renewal else AuditAction.GMAIL_WATCH_CREATED,
            actor_type=AuditActorType.SYSTEM,
            organization_id=account.tenant_id,
            resource_type="gmail_watch",
            resource_id=account.id,
            metadata={
                "action": "GMAIL_WATCH_RENEWED" if is_renewal else "GMAIL_WATCH_CREATED",
                "integration_account_id": account.id,
                "history_id": history_id,
                "watch_expires_at": watch_expires_at,
            },
        )
        await db.commit()
        await db.refresh(cursor)

        logger.info(
            "Gmail watch registered successfully",
            account_id=account.id,
            email=account.email_address,
            history_id=history_id,
            watch_expires_at=watch_expires_at,
            is_renewal=is_renewal,
        )
        return cursor

    async def stop_watch(
        self,
        account: ConnectedIntegrationAccount,
        db: AsyncSession,
    ) -> bool:
        """Terminate Gmail watch on disconnect."""
        try:
            access_token = await gmail_client.get_valid_access_token(account, db)
            await gmail_client.stop_watch(access_token)
        except Exception as e:
            logger.warning("Failed to invoke stop_watch on Gmail API during disconnect", error=str(e))

        # Clear watch expiration and cursor in SyncCursor so reconnect starts clean
        res = await db.execute(
            select(SyncCursor).where(SyncCursor.integration_account_id == account.id)
        )
        cursor = res.scalar_one_or_none()
        if cursor:
            cursor.watch_expires_at = None
            cursor.cursor_value = None
            cursor.sync_state = CursorSyncState.IDLE.value
            await db.commit()

        return True


gmail_watch_service = GmailWatchService()
