"""Gmail fallback poller — new mail is processed even when Pub/Sub push never arrives.

Why
---
Real-time sync depends on Google Cloud Pub/Sub POSTing to our webhook. In development
that webhook is a Cloudflare *quick* tunnel whose URL changes on every restart, and the
push subscription's endpoint is configured in Google Cloud (nothing in the app can
update it without GCP admin credentials). After a tunnel restart Google keeps pushing to
the old, dead URL, so incoming mail was silently never processed. The same failure mode
exists in production whenever push delivery breaks (endpoint down, subscription edited,
auth misconfigured).

How
---
Every ``GMAIL_FALLBACK_POLL_SECONDS`` each connected Gmail mailbox gets ONE cheap
``users.getProfile`` call (1 quota unit, no DB writes) comparing Gmail's current
historyId with our stored sync cursor. Only when Gmail is ahead is an
``gmail.incremental_sync`` event published — the exact path a push notification takes
(per-account distributed lock + watermark coalescing in ``GmailSyncEngine``), so a
push and a poll for the same change can never double-process a message.

With healthy push the poll always finds nothing to do; with broken push, mail is
picked up within one poll interval instead of never.
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict, List

from sqlalchemy import select

from app.core.database import db_manager
from app.core.logging import logger
from app.core.messaging import DomainEvent, event_bus
from app.models.integration import ConnectedIntegrationAccount, IntegrationStatus, SyncCursor
from app.services.gmail_client import gmail_client

_ACTIVE_STATUSES = (IntegrationStatus.CONNECTED.value, "CONNECTED", IntegrationStatus.SYNCING.value)


def _as_int(v: Any) -> int:
    try:
        return int(str(v))
    except (TypeError, ValueError):
        return 0


class GmailFallbackPoller:
    def __init__(self, max_concurrency: int = 4) -> None:
        self._sem = asyncio.Semaphore(max_concurrency)
        self._warned_push_missing: set = set()

    async def _active_accounts(self) -> List[Dict[str, Any]]:
        async with db_manager.session_factory() as db:
            rows = (await db.execute(
                select(ConnectedIntegrationAccount, SyncCursor.cursor_value)
                .join(SyncCursor, SyncCursor.integration_account_id == ConnectedIntegrationAccount.id)
                .where(
                    ConnectedIntegrationAccount.provider == "gmail",
                    ConnectedIntegrationAccount.sync_enabled.is_(True),
                    ConnectedIntegrationAccount.status.in_(_ACTIVE_STATUSES),
                    ConnectedIntegrationAccount.access_token_encrypted.is_not(None),
                    SyncCursor.cursor_value.is_not(None),
                )
            )).all()
        return [{"account": acc, "cursor": cur} for acc, cur in rows]

    async def _check(self, account: ConnectedIntegrationAccount, cursor: str) -> bool:
        """True when Gmail has changes beyond our cursor (and a sync was requested)."""
        async with self._sem:
            async with db_manager.session_factory() as db:
                token = await gmail_client.get_valid_access_token(account, db)
            profile = await gmail_client.get_profile(token)
            latest = str(profile.get("historyId") or "")
            if _as_int(latest) <= _as_int(cursor):
                return False
            await event_bus.publish("email_events", DomainEvent(
                event_type="gmail.incremental_sync",
                tenant_id=account.tenant_id,
                aggregate_type="integration_account",
                aggregate_id=account.id,
                payload={"account_id": account.id, "email_address": account.email_address,
                         "provider": "gmail", "history_id": latest, "source": "fallback_poll"},
            ))
            if account.id not in self._warned_push_missing:
                # Push should have delivered this already: tell operators once per account.
                self._warned_push_missing.add(account.id)
                logger.warning(
                    "Gmail change found by fallback poll (push notification not received). "
                    "If you use a quick tunnel, update the Pub/Sub subscription push endpoint "
                    "to the current GMAIL_PUBSUB_WEBHOOK_URL.",
                    account_id=account.id, cursor=cursor, gmail_history_id=latest,
                )
            return True

    async def poll_once(self) -> int:
        """Check every active mailbox once. Returns how many syncs were requested."""
        items = await self._active_accounts()
        if not items:
            return 0
        results = await asyncio.gather(
            *(self._check(i["account"], i["cursor"]) for i in items), return_exceptions=True
        )
        requested = 0
        for item, res in zip(items, results):
            if isinstance(res, BaseException):
                logger.debug("Gmail fallback poll failed for account", account_id=item["account"].id,
                             error=f"{type(res).__name__}: {str(res)[:200]}")
            elif res:
                requested += 1
        return requested

    async def run_forever(self, interval_seconds: float) -> None:
        await asyncio.sleep(min(10.0, interval_seconds))  # let startup settle, then catch up quickly
        while True:
            try:
                await self.poll_once()
            except asyncio.CancelledError:
                raise
            except Exception as err:  # noqa: BLE001 — the poller must never die
                logger.warning("Gmail fallback poll cycle failed", error=str(err)[:300])
            await asyncio.sleep(interval_seconds)


gmail_fallback_poller = GmailFallbackPoller()
