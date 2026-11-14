"""Gmail 30-Day Platform Downtime & Self-Healing Startup Recovery Engine.

Guarantees:
1. Zero User Manual Reconnect:
   - If ProxiPilot was completely offline for 30 days, the stored encrypted OAuth refresh
     tokens remain durably stored in PostgreSQL.
   - On startup, the recovery engine identifies all accounts with expired watches.
   - Refreshes expired access tokens.
   - Re-registers Gmail Pub/Sub watch via users.watch().
   - Attempts incremental sync from the last stored cursor; if Gmail returns HTTP 404
     (because history expired during the 30 days), it automatically falls back to full synchronization.
   - Restores the account to HEALTHY status without prompting the user to reconnect.
2. Startup Reconciliation:
   - Repairs stuck 'syncing' states from prior process crashes.
   - Rebuilds in-memory watch renewal min-heap.
"""

from datetime import datetime, timezone
from typing import Dict, List, Optional
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import db_manager
from app.core.logging import logger
from app.models.integration import (
    ConnectedIntegrationAccount,
    ConnectionHealthStatus,
    CursorSyncState,
    IntegrationStatus,
    SyncCursor,
)
from app.services.gmail_client import (
    GmailApiException,
    GmailReauthRequiredException,
    gmail_client,
)
from app.services.gmail_renewal_scheduler import gmail_renewal_scheduler
from app.services.gmail_sync import gmail_sync_engine
from app.services.gmail_watch import gmail_watch_service


class GmailRecoveryService:
    """Self-healing platform downtime recovery service."""

    async def reconcile_all_accounts(self, limit: int = 500, account_id: Optional[str] = None) -> Dict[str, int]:
        """Execute full startup reconciliation and 30-day downtime recovery."""
        logger.info("Starting Gmail startup reconciliation and self-healing recovery...")
        stats = {
            "scanned": 0,
            "watches_recreated": 0,
            "syncs_recovered": 0,
            "reauth_required": 0,
            "stuck_repaired": 0,
        }

        now = datetime.now(timezone.utc)
        now_str = now.isoformat()

        async with db_manager.session_factory() as db:
            # 1. Query all connected/active accounts
            conditions = [
                ConnectedIntegrationAccount.provider == "gmail",
                ConnectedIntegrationAccount.status.in_([
                    IntegrationStatus.CONNECTED.value,
                    IntegrationStatus.ACTIVE.value,
                    IntegrationStatus.SYNCING.value,
                    IntegrationStatus.DEGRADED.value,
                ]),
            ]
            if account_id:
                conditions.append(ConnectedIntegrationAccount.id == account_id)

            stmt = select(ConnectedIntegrationAccount).where(*conditions).limit(limit)
            res = await db.execute(stmt)
            accounts = res.scalars().all()
            stats["scanned"] = len(accounts)

            for account in accounts:
                try:
                    # 1. Repair stuck syncing states
                    if account.status == IntegrationStatus.SYNCING.value:
                        account.status = IntegrationStatus.CONNECTED.value
                        account.connection_status = ConnectionHealthStatus.HEALTHY.value
                        stats["stuck_repaired"] += 1

                    # 2. Check sync cursor & watch expiration
                    res_cur = await db.execute(
                        select(SyncCursor).where(SyncCursor.integration_account_id == account.id)
                    )
                    cursor = res_cur.scalar_one_or_none()

                    watch_expired = False
                    if not cursor or not cursor.watch_expires_at:
                        watch_expired = True
                    else:
                        try:
                            exp_dt = datetime.fromisoformat(cursor.watch_expires_at)
                            if exp_dt <= now:
                                watch_expired = True
                        except Exception:
                            watch_expired = True

                    # 3. If watch expired (e.g. 30 days offline), recreate watch automatically
                    if watch_expired:
                        logger.info(
                            "Detected expired or missing watch registration after platform downtime — recreating",
                            account_id=account.id,
                            email=account.email_address,
                        )
                        await gmail_watch_service.create_or_renew_watch(account, db, is_renewal=False)
                        stats["watches_recreated"] += 1

                    # 4. Trigger sync recovery (which cleanly handles 404 via full sync fallback)
                    await gmail_sync_engine.sync_account(account.id)
                    stats["syncs_recovered"] += 1

                except GmailReauthRequiredException:
                    logger.warning(
                        "Google authorization revoked for account during recovery",
                        account_id=account.id,
                        email=account.email_address,
                    )
                    account.status = IntegrationStatus.REAUTH_REQUIRED.value
                    account.connection_status = ConnectionHealthStatus.REAUTH_REQUIRED.value
                    account.last_error_code = "REAUTH_REQUIRED"
                    account.last_error_at = now_str
                    await db.commit()
                    stats["reauth_required"] += 1
                except Exception as exc:
                    logger.error(
                        "Error recovering account during startup reconciliation",
                        account_id=account.id,
                        error=str(exc),
                    )

            # 5. Rebuild priority renewal min-heap from updated state
            await gmail_renewal_scheduler.rebuild_from_db(db)

        logger.info("Gmail startup reconciliation completed", **stats)
        return stats


gmail_recovery_service = GmailRecoveryService()
