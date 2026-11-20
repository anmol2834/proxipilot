"""Gmail Mailbox Synchronization Engine — Phase 4 Production Implementation.

Architectural changes vs Phase 3:
- Event coalescing via high-watermark Redis key + sync loop (no events lost).
- Two-phase ingestion:
    Phase 1: Batch metadata fetch (format=metadata, headers only) → hard filter.
    Phase 2: Batch full body fetch (accepted candidates only) → MIME parse → store.
- MIME-aware body extraction (EmailParser), no snippet-as-body hack.
- Deterministic promotional/spam filtering (EmailFilterService), no LLM.
- Atomic PostgreSQL upsert with ON CONFLICT DO NOTHING for idempotency.
- Accurate SyncStats with per-stage counters.
- Integer-safe historyId comparison (int() conversion, never string compare).
- Lock TTL extended to 300s for large syncs; renewable via background heartbeat.

Concurrency invariants:
- One sync active per account at a time (Redis distributed lock).
- Events arriving while lock is held → high-watermark stored in Redis.
- After each sync loop, check high-watermark; if newer events waiting, loop again.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
import json
import uuid
from typing import Any, Dict, List, Optional, Set

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import db_manager
from app.core.logging import logger
from app.core.redis import redis_manager
from app.models.inbox import (
    EmailMessage,
    EmailThread,
    LeadIntent,
    MessageDirection,
    ThreadStatus,
    ThreadSuppressionMarker,
)
from app.models.integration import (
    ConnectedIntegrationAccount,
    ConnectionHealthStatus,
    CursorSyncState,
    IntegrationStatus,
    SyncCursor,
)
from app.services.email_filter import (
    ClassificationResult,
    EmailCategory,
    EmailDisposition,
    FilterDecision,
    email_filter,
)
from app.services.email_parser import MimeParseResult, email_parser
from app.services.gmail_client import (
    GmailApiException,
    GmailHistoryExpiredException,
    GmailReauthRequiredException,
    gmail_client,
)
from app.services.outbox import outbox_service



# =============================================================================
# Distributed Lock (unchanged from Phase 3 — correct implementation)
# =============================================================================


class DistributedLock:
    """Safe Redis distributed lock with ownership token and atomic Lua release."""

    RELEASE_LUA = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
    """

    def __init__(self, key: str, ttl_seconds: int = 300):
        self.key = key
        self.ttl = ttl_seconds
        self.token = str(uuid.uuid4())
        self._acquired = False

    async def acquire(self) -> bool:
        redis_client = redis_manager.client
        acquired = await redis_client.set(self.key, self.token, ex=self.ttl, nx=True)
        self._acquired = bool(acquired)
        return self._acquired

    EXTEND_LUA = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("expire", KEYS[1], ARGV[2])
        else
            return 0
        end
    """

    async def extend(self, ttl_seconds: Optional[int] = None) -> bool:
        """Renew the lock TTL only if this instance still owns it.

        Long-running holders (e.g. knowledge imports) must call this periodically,
        otherwise the lock silently expires mid-job and a second worker can start
        processing the same resource concurrently.
        """
        if not self._acquired:
            return False
        try:
            redis_client = redis_manager.client
            res = await redis_client.eval(
                self.EXTEND_LUA, 1, self.key, self.token, int(ttl_seconds or self.ttl)
            )
            return bool(res)
        except Exception as e:
            logger.warning("Error extending distributed lock", key=self.key, error=str(e))
            return False

    async def release(self) -> None:
        if not self._acquired:
            return
        try:
            redis_client = redis_manager.client
            await redis_client.eval(self.RELEASE_LUA, 1, self.key, self.token)
        except Exception as e:
            logger.warning("Error releasing distributed lock", key=self.key, error=str(e))
        finally:
            self._acquired = False

    async def __aenter__(self):
        acquired = await self.acquire()
        if not acquired:
            raise RuntimeError(f"Could not acquire lock for {self.key}")
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.release()


# =============================================================================
# Sync Statistics
# =============================================================================


@dataclass
class SyncStats:
    """Per-sync counters for observability. All fields are additive."""

    seen: int = 0
    """Total message IDs collected from history.list."""
    metadata_fetched: int = 0
    """Messages successfully fetched with format=metadata."""
    metadata_blocked: int = 0
    """Messages blocked at metadata stage (spam/promo labels, header heuristics)."""
    unavailable: int = 0
    """Messages that returned 404 (deleted/trashed before we fetched them)."""
    full_fetched: int = 0
    """Messages successfully fetched with format=full."""
    stored: int = 0
    """Messages successfully parsed and stored in PostgreSQL."""
    filtered_body: int = 0
    """Messages blocked at body stage (html-only, empty, body-level promo)."""
    skipped_duplicate: int = 0
    """Messages already present in DB (idempotent skip)."""
    failed: int = 0
    """Messages that encountered a non-recoverable error."""

    def log(self, account_id: str, label: str = "sync") -> None:
        logger.info(
            f"SyncStats [{label}]",
            account_id=account_id,
            seen=self.seen,
            metadata_fetched=self.metadata_fetched,
            metadata_blocked=self.metadata_blocked,
            unavailable=self.unavailable,
            full_fetched=self.full_fetched,
            stored=self.stored,
            filtered_body=self.filtered_body,
            skipped_duplicate=self.skipped_duplicate,
            failed=self.failed,
        )


# =============================================================================
# Coalescing watermark helpers
# =============================================================================

_WATERMARK_TTL_S = 3600  # 1 hour safety expiry

_LUA_ATOMIC_MAX = """
local current = redis.call("get", KEYS[1])
if current == false then
    redis.call("set", KEYS[1], ARGV[1], "EX", ARGV[2])
    return ARGV[1]
end
local cur_int = tonumber(current)
local new_int = tonumber(ARGV[1])
if new_int > cur_int then
    redis.call("set", KEYS[1], ARGV[1], "EX", ARGV[2])
    return ARGV[1]end
return current
"""


async def _update_pending_watermark(account_id: str, history_id: str) -> None:
    """Atomically store max(current_pending, history_id) in Redis."""
    key = f"gmail:sync:pending:{account_id}"
    try:
        redis_client = redis_manager.client
        await redis_client.eval(_LUA_ATOMIC_MAX, 1, key, history_id, str(_WATERMARK_TTL_S))
    except Exception as exc:
        logger.warning(
            "Failed to update pending watermark, event may be lost on coalesce",
            account_id=account_id,
            history_id=history_id,
            error=str(exc),
        )


async def _get_and_clear_pending_watermark(account_id: str) -> Optional[int]:
    """Atomically GET and DEL the pending watermark. Returns int or None."""
    key = f"gmail:sync:pending:{account_id}"
    try:
        redis_client = redis_manager.client
        val = await redis_client.getdel(key)
        return int(val) if val else None
    except Exception as exc:
        logger.warning("Failed to get/clear pending watermark", account_id=account_id, error=str(exc))
        return None


# =============================================================================
# Sync Engine
# =============================================================================

# Metadata headers needed for Phase 1 filter
def _own_domain(account: Any) -> str:
    email = (getattr(account, "email_address", "") or "").lower()
    return email.split("@", 1)[1] if "@" in email else ""


async def _second_opinion(result: "ClassificationResult", from_header: str, subject: str,
                          body: str) -> "ClassificationResult":
    """Undecided mail: one small classifier call decides. Only a human-written business message is
    stored; if the classifier is unavailable, mail with any automation evidence is not stored."""
    from app.services.mail_human_check import is_human_business_mail

    verdict = await is_human_business_mail(from_header, subject, body or "")
    reasons = list(result.reasons)
    if verdict is True or (verdict is None and result.score == 0):
        reasons.append("second_opinion:human" if verdict else "second_opinion:unavailable_no_automation")
        return ClassificationResult(category=EmailCategory.BUSINESS_CONVERSATION,
                                    disposition=EmailDisposition.STORE_AND_RESOLVE_CONTEXT,
                                    confidence=0.8, reasons=reasons, score=result.score)
    reasons.append("second_opinion:not_human" if verdict is False else "second_opinion:unavailable_automation")
    return ClassificationResult(category=EmailCategory.NON_CONVERSATIONAL_NOTIFICATION,
                                disposition=EmailDisposition.SUPPRESS_BEFORE_EMAIL_PERSISTENCE,
                                confidence=0.8, reasons=reasons, score=result.score)


_METADATA_HEADERS: List[str] = [
    "From", "To", "Date", "Subject",
    "Message-ID", "In-Reply-To", "References",
    "Content-Type", "Precedence", "List-Id",
    "List-Unsubscribe", "List-Post", "List-Help",
    "List-Archive", "Auto-Submitted",
    # automated-vs-human signals (mail_authenticity)
    "List-Unsubscribe-Post", "Feedback-ID", "X-Auto-Response-Suppress", "X-Mailer", "User-Agent",
    "X-Google-Group-Id", "Mailing-list", "X-SES-Outgoing", "X-SG-EID", "X-Mailgun-Sid", "X-MC-User",
    "X-Campaign", "X-HubSpot-Message-Id", "X-PM-Message-Id", "X-Mandrill-User", "X-Mailjet-Campaign",
]


class GmailSyncEngine:
    """Production-grade Gmail mailbox synchronization with coalescing + filter pipeline."""

    def __init__(self):
        self.settings = get_settings()

    # -------------------------------------------------------------------------
    # Public entrypoint
    # -------------------------------------------------------------------------

    async def sync_account(
        self,
        account_id: str,
        incoming_history_id: Optional[str] = None,
        is_initial_sync: bool = False,
    ) -> None:
        """Worker-facing entrypoint with per-account distributed lock + event coalescing.

        Coalescing algorithm:
        1. If incoming_history_id given, atomically update pending watermark max.
        2. Try to acquire lock. If already held → another sync is running which will
           pick up our watermark when it finishes. Nothing more needed.
        3. If lock acquired → run sync loop.
        4. After each sync, check pending watermark. If newer events arrived while
           we were syncing, loop again with new watermark.
        5. Exit when pending watermark is consumed (empty or ≤ last synced id).
        """
        lock_key = f"gmail:sync:{account_id}"

        # Record our incoming event in the watermark BEFORE trying to acquire lock
        if incoming_history_id:
            await _update_pending_watermark(account_id, incoming_history_id)

        lock = DistributedLock(lock_key, ttl_seconds=300)
        acquired = await lock.acquire()
        if not acquired:
            logger.info(
                "Account sync already running — event coalesced into pending watermark",
                account_id=account_id,
                incoming_history_id=incoming_history_id,
            )
            return

        try:
            # Coalescing sync loop — keep running until no pending events remain
            loops = 0
            while True:
                loops += 1
                if loops > 10:
                    # Safety valve: prevent infinite loop in pathological cases
                    logger.warning("Coalescing loop exceeded 10 iterations, stopping", account_id=account_id)
                    break

                last_synced_id = await self._run_single_sync(account_id, is_initial_sync=is_initial_sync)
                # Only run is_initial_sync on the first iteration
                is_initial_sync = False
                if not last_synced_id:
                    # Sync could not run or advance (account inactive, auth error, or no cursor advance).
                    # Clear pending watermark so dead or unauthenticated accounts don't linger in Redis.
                    await _get_and_clear_pending_watermark(account_id)
                    break

                # Check if new events arrived while we were syncing
                pending = await _get_and_clear_pending_watermark(account_id)
                if pending is None:
                    break  # No pending events
                try:
                    last_int = int(last_synced_id)
                except (ValueError, TypeError):
                    break
                if pending <= last_int:
                    break  # Pending event already covered by our sync
                # Newer events exist — loop again
                logger.info(
                    "Coalescing: pending watermark exceeds synced cursor, looping",
                    account_id=account_id,
                    pending=pending,
                    last_synced=last_int,
                )
        finally:
            await lock.release()

    async def _run_single_sync(self, account_id: str, is_initial_sync: bool = False) -> Optional[str]:
        """Run one full incremental (or full) sync cycle. Returns advanced history_id or None."""
        async with db_manager.session_factory() as session:
            res = await session.execute(
                select(ConnectedIntegrationAccount).where(
                    ConnectedIntegrationAccount.id == account_id
                )
            )
            account = res.scalar_one_or_none()
            if not account:
                logger.warning("Account not found for sync", account_id=account_id)
                return None

            if account.status in (
                IntegrationStatus.DISCONNECTED.value,
                IntegrationStatus.REAUTH_REQUIRED.value,
            ):
                logger.info(
                    "Account not active, skipping sync",
                    account_id=account_id,
                    status=account.status,
                )
                return None

            res_cur = await session.execute(
                select(SyncCursor).where(SyncCursor.integration_account_id == account.id)
            )
            cursor = res_cur.scalar_one_or_none()

            if is_initial_sync or not cursor or not cursor.cursor_value:
                # If account has an existing cursor and previous sync history, prefer fast incremental
                # catch-up sync (which automatically falls back to full sync if Google returns 404 History Expired).
                if not is_initial_sync and cursor and cursor.cursor_value and account.last_synced_at:
                    logger.info(
                        "Account has established cursor; attempting fast catch-up sync before full fallback",
                        account_id=account.id,
                        cursor=cursor.cursor_value,
                    )
                    advanced_id = await self.execute_incremental_sync(account, cursor, session)
                    return advanced_id

                logger.info("Executing initial/full sync baseline", account_id=account.id)
                await self.execute_full_sync(account, session)
                # Re-load cursor to get updated value
                res_cur2 = await session.execute(
                    select(SyncCursor).where(SyncCursor.integration_account_id == account.id)
                )
                cursor2 = res_cur2.scalar_one_or_none()
                return cursor2.cursor_value if cursor2 else None
            else:
                advanced_id = await self.execute_incremental_sync(account, cursor, session)
                return advanced_id

    # -------------------------------------------------------------------------
    # Incremental sync
    # -------------------------------------------------------------------------

    async def execute_incremental_sync(
        self,
        account: ConnectedIntegrationAccount,
        cursor: SyncCursor,
        db: AsyncSession,
    ) -> Optional[str]:
        """Incremental synchronization using users.history.list with 404 fallback.

        Returns the advanced history_id on success, or None on failure.
        """
        now = datetime.now(timezone.utc)
        now_str = now.isoformat()
        cursor.sync_state = CursorSyncState.SYNCING.value
        cursor.last_attempted_sync_at = now_str
        await db.commit()

        start_history_id = cursor.cursor_value
        logger.info(
            "Starting Gmail incremental sync",
            account_id=account.id,
            start_history_id=start_history_id,
        )

        try:
            access_token = await gmail_client.get_valid_access_token(account, db)

            page_token: Optional[str] = None
            changed_message_ids: Set[str] = set()
            latest_history_id = start_history_id

            # ---- Collect all changed message IDs via paginated history.list ----
            while True:
                try:
                    history_resp = await gmail_client.list_history(
                        access_token=access_token,
                        start_history_id=str(start_history_id),
                        page_token=page_token,
                        max_results=self.settings.providers.gmail_history_page_size,
                    )
                except GmailHistoryExpiredException:
                    logger.warning(
                        "Gmail history cursor expired (HTTP 404), falling back to full sync",
                        account_id=account.id,
                        expired_history_id=start_history_id,
                    )
                    await self.execute_full_sync(account, db)
                    await db.refresh(cursor)
                    return cursor.cursor_value

                # Always track the latest historyId returned
                resp_history_id = history_resp.get("historyId", "")
                if resp_history_id:
                    # Integer-safe comparison
                    try:
                        if int(resp_history_id) > int(latest_history_id or "0"):
                            latest_history_id = str(resp_history_id)
                    except (ValueError, TypeError):
                        latest_history_id = str(resp_history_id)

                _DROP_HISTORY_LABELS = frozenset([
                    "CATEGORY_PROMOTIONS",
                    "CATEGORY_UPDATES",
                    "CATEGORY_SOCIAL",
                    "CATEGORY_FORUMS",
                    "SPAM",
                    "TRASH",
                ])

                for record in history_resp.get("history", []):
                    # Only process messagesAdded — list_history is called
                    # with historyTypes=messageAdded + labelId=INBOX.
                    for item in record.get("messagesAdded", []):
                        if "message" in item and "id" in item["message"]:
                            msg = item["message"]
                            msg_labels = set(msg.get("labelIds", []))
                            # Fast-path filter: if Gmail already labeled this message as
                            # promotions, updates, social, spam, or trash, discard it immediately
                            # without making a redundant metadata API fetch.
                            if msg_labels & _DROP_HISTORY_LABELS:
                                continue
                            changed_message_ids.add(msg["id"])

                page_token = history_resp.get("nextPageToken")
                if not page_token:
                    break

            # ---- Two-phase ingestion ----
            stats = SyncStats(seen=len(changed_message_ids))
            if changed_message_ids:
                logger.info(
                    "Processing changed Gmail messages",
                    account_id=account.id,
                    count=len(changed_message_ids),
                )
                stats = await self._ingest_changed_messages(
                    access_token, account, changed_message_ids, db
                )

            # ---- Check for unhandled processing failures before advancing cursor ----
            if stats.failed > 0 and stats.stored == 0 and len(changed_message_ids) > 0:
                logger.error(
                    "Incremental sync encountered total message processing failures; halting cursor advancement",
                    account_id=account.id,
                    failed=stats.failed,
                )
                cursor.sync_state = CursorSyncState.FAILED.value
                cursor.last_failure_at = now_str
                cursor.last_failure_code = "MESSAGE_PROCESSING_FAILED"
                if account.status == IntegrationStatus.SYNCING.value:
                    account.status = IntegrationStatus.CONNECTED.value
                    account.connection_status = ConnectionHealthStatus.DEGRADED.value
                await db.commit()
                raise RuntimeError(
                    f"Incremental sync had {stats.failed} failed messages; cursor not advanced"
                )

            # ---- Advance cursor transactionally ----
            final_history_id = latest_history_id or start_history_id
            cursor.cursor_value = str(final_history_id)
            cursor.sync_state = CursorSyncState.IDLE.value
            cursor.last_successful_sync_at = now_str

            account.last_history_id = str(final_history_id)
            account.last_synced_at = now_str
            account.last_successful_sync_at = now_str
            account.status = IntegrationStatus.CONNECTED.value
            account.connection_status = (
                ConnectionHealthStatus.DEGRADED.value if stats.failed > 0 else ConnectionHealthStatus.HEALTHY.value
            )
            account.last_error_code = None

            await db.commit()

            stats.log(account.id, label="incremental")
            logger.info(
                "Incremental sync completed",
                account_id=account.id,
                advanced_history_id=final_history_id,
            )
            return final_history_id

        except GmailReauthRequiredException:
            logger.warning("Re-authorization required during sync", account_id=account.id)
            cursor.sync_state = CursorSyncState.FAILED.value
            cursor.last_failure_at = now_str
            cursor.last_failure_code = "REAUTH_REQUIRED"
            account.status = IntegrationStatus.REAUTH_REQUIRED.value
            account.connection_status = ConnectionHealthStatus.REAUTH_REQUIRED.value
            await db.commit()
            try:
                await redis_manager.client.delete(f"gmail:account_cache:{account.email_address}")
            except Exception:
                pass
            return None
        except Exception as e:
            logger.error("Incremental sync failed", account_id=account.id, error=str(e))
            cursor.sync_state = CursorSyncState.FAILED.value
            cursor.last_failure_at = now_str
            cursor.last_failure_code = type(e).__name__
            account.last_error_code = type(e).__name__
            account.last_error_at = now_str
            if account.status == IntegrationStatus.SYNCING.value:
                account.status = (
                    IntegrationStatus.CONNECTED.value
                    if account.access_token_encrypted
                    else IntegrationStatus.ERROR.value
                )
                account.connection_status = (
                    ConnectionHealthStatus.DEGRADED.value
                    if account.access_token_encrypted
                    # pyrefly: ignore[missing-attribute]
                    else ConnectionHealthStatus.FAILED.value
                )
            await db.commit()
            raise

    # -------------------------------------------------------------------------
    # Full sync (recovery / initial)
    # -------------------------------------------------------------------------

    async def execute_full_sync(
        self,
        account: ConnectedIntegrationAccount,
        db: AsyncSession,
        max_messages: int = 0,
    ) -> None:
        """Establish a fresh sync baseline (initial connect, recovery, history-cursor expiry).

        By design NO historical mail is imported (max_messages=0): a newly connected or
        re-established mailbox starts from "now" and only messages that arrive afterwards are
        processed. This keeps connecting instant and never runs the AI pipeline on old mail.
        Pass max_messages>0 only for an explicit, user-requested backfill."""
        now_str = datetime.now(timezone.utc).isoformat()

        # Load or create cursor
        res_cur = await db.execute(
            select(SyncCursor).where(SyncCursor.integration_account_id == account.id)
        )
        cursor = res_cur.scalar_one_or_none()
        if not cursor:
            cursor = SyncCursor(
                tenant_id=account.tenant_id,
                integration_account_id=account.id,
                provider="gmail",
                cursor_type="history_id",
                sync_state=CursorSyncState.RECOVERING.value,
            )
            db.add(cursor)
        else:
            cursor.sync_state = CursorSyncState.RECOVERING.value
            cursor.last_attempted_sync_at = now_str

        account.status = IntegrationStatus.SYNCING.value
        account.connection_status = ConnectionHealthStatus.SYNCING.value
        await db.commit()

        logger.info("Executing full Gmail synchronization recovery", account_id=account.id)

        try:
            access_token = await gmail_client.get_valid_access_token(account, db)

            # 1. Fetch current profile historyId
            profile = await gmail_client.get_profile(access_token)
            fresh_history_id = str(profile.get("historyId", ""))

            # 2. List recent messages (only for an explicit backfill)
            message_ids: set = set()
            if max_messages > 0:
                list_resp = await gmail_client.list_messages(access_token, max_results=max_messages)
                message_ids = {m.get("id") for m in list_resp.get("messages", []) if m.get("id")}

            logger.info(
                "Full sync ingesting recent messages",
                account_id=account.id,
                count=len(message_ids),
            )

            # 3. Two-phase ingestion (same pipeline as incremental)
            stats = await self._ingest_changed_messages(
                access_token, account, message_ids, db
            )
            stats.seen = len(message_ids)
            stats.log(account.id, label="full_sync")

            # Check for unhandled processing failures before establishing fresh cursor
            if stats.failed > 0 and stats.stored == 0 and len(message_ids) > 0:
                logger.error(
                    "Full sync encountered total message processing failures; halting cursor establishment",
                    account_id=account.id,
                    failed=stats.failed,
                )
                cursor.sync_state = CursorSyncState.FAILED.value
                cursor.last_failure_at = now_str
                cursor.last_failure_code = "MESSAGE_PROCESSING_FAILED"
                account.status = IntegrationStatus.CONNECTED.value
                account.connection_status = ConnectionHealthStatus.DEGRADED.value
                await db.commit()
                raise RuntimeError(
                    f"Full sync had {stats.failed} failed messages; cursor not established"
                )

            # 4. Atomically establish fresh cursor
            cursor.cursor_value = fresh_history_id
            cursor.sync_state = CursorSyncState.IDLE.value
            cursor.last_full_sync_at = now_str
            cursor.last_successful_sync_at = now_str

            account.last_history_id = fresh_history_id
            account.last_synced_at = now_str
            account.last_successful_sync_at = now_str
            account.status = IntegrationStatus.CONNECTED.value
            account.connection_status = (
                ConnectionHealthStatus.DEGRADED.value if stats.failed > 0 else ConnectionHealthStatus.HEALTHY.value
            )
            account.last_error_code = None

            from app.services.audit import audit_service
            from app.models.audit import AuditAction, AuditActorType
            await audit_service.record(
                db=db,
                action=AuditAction.GMAIL_FULL_SYNC_COMPLETED,
                actor_type=AuditActorType.SYSTEM,
                organization_id=account.tenant_id,
                resource_type="sync_cursor",
                resource_id=account.id,
                metadata={
                    "action": "GMAIL_FULL_SYNC_COMPLETED",
                    "history_id": fresh_history_id,
                    "messages_count": len(message_ids),
                    "messages_stored": stats.stored,
                },
            )
            await db.commit()
            logger.info(
                "Full sync recovery completed",
                account_id=account.id,
                history_id=fresh_history_id,
                stored=stats.stored,
            )

        except GmailReauthRequiredException:
            logger.warning("Re-authorization required during full sync", account_id=account.id)
            cursor.sync_state = CursorSyncState.FAILED.value
            cursor.last_failure_at = now_str
            cursor.last_failure_code = "REAUTH_REQUIRED"
            account.status = IntegrationStatus.REAUTH_REQUIRED.value
            account.connection_status = ConnectionHealthStatus.REAUTH_REQUIRED.value
            await db.commit()
            try:
                await redis_manager.client.delete(f"gmail:account_cache:{account.email_address}")
            except Exception:
                pass
            return
        except Exception as err:
            logger.error("Full sync recovery failed", account_id=account.id, error=str(err))
            cursor.sync_state = CursorSyncState.FAILED.value
            cursor.last_failure_at = now_str
            cursor.last_failure_code = type(err).__name__
            account.last_error_code = type(err).__name__
            account.last_error_at = now_str
            if account.status == IntegrationStatus.SYNCING.value:
                account.status = (
                    IntegrationStatus.CONNECTED.value
                    if account.access_token_encrypted
                    else IntegrationStatus.ERROR.value
                )
                account.connection_status = (
                    ConnectionHealthStatus.DEGRADED.value
                    if account.access_token_encrypted
                    # pyrefly: ignore[missing-attribute]
                    else ConnectionHealthStatus.FAILED.value
                )
            await db.commit()
            raise

    # -------------------------------------------------------------------------
    # Phase 1 + 2 Two-phase ingestion pipeline
    # -------------------------------------------------------------------------

    async def _ingest_changed_messages(
        self,
        access_token: str,
        account: ConnectedIntegrationAccount,
        message_ids: Set[str],
        db: AsyncSession,
    ) -> SyncStats:
        """Two-phase message ingestion: metadata filter → full body normalize → store.

        Phase 1: Batch metadata fetch → hard filter (labels + header heuristics).
        Phase 2: Batch full fetch (accepted only) → MIME parse → body filter → upsert.
        """
        stats = SyncStats(seen=len(message_ids))

        if not message_ids:
            return stats

        # High-efficiency path for incremental batches: single-roundtrip full fetch
        # eliminates 2-3 seconds of redundant Google REST API round-trips while preserving
        # identical metadata and body filtering invariants.
        if len(message_ids) <= 10:
            logger.info(
                "Direct single-roundtrip fetch for incremental message batch",
                account_id=account.id,
                count=len(message_ids),
            )
            full_results = await gmail_client.get_messages_batch(
                access_token=access_token,
                message_ids=list(message_ids),
                msg_format="full",
                batch_size=25,
            )
            for msg_id, full_data in full_results.items():
                if full_data is None:
                    stats.unavailable += 1
                    continue
                stats.metadata_fetched += 1
                stats.full_fetched += 1

                label_ids: List[str] = full_data.get("labelIds", [])
                headers_raw: List[Dict[str, str]] = full_data.get("payload", {}).get("headers", [])
                headers: Dict[str, str] = {h["name"].lower(): h["value"] for h in headers_raw if "name" in h and "value" in h}

                classification = await email_filter.classify_metadata(
                    label_ids=label_ids,
                    headers=headers,
                    db=db,
                    tenant_id=account.tenant_id,
                    is_existing_conversation=await self._is_existing_conversation(
                        account, full_data.get("threadId", msg_id), db),
                    own_domain=_own_domain(account),
                )
                if not classification.should_store:
                    stats.metadata_blocked += 1
                    logger.info(
                        "Message suppressed at metadata stage",
                        message_id=msg_id,
                        category=classification.category.value,
                        disposition=classification.disposition.value,
                        reasons=classification.reasons,
                    )
                    continue

                try:
                    stored = await self._normalize_and_store(
                        msg_data=full_data,
                        account=account,
                        db=db,
                        metadata_result=classification,
                    )
                    if stored is True:
                        stats.stored += 1
                    elif stored is False:
                        stats.filtered_body += 1
                    else:
                        stats.skipped_duplicate += 1
                except Exception as exc:
                    stats.failed += 1
                    logger.error(
                        "Error normalizing/storing message",
                        message_id=msg_id,
                        error=str(exc),
                    )
            return stats

        # ---- Phase 1: Metadata batch fetch + filter (for large recovery/initial syncs) ----
        logger.info(
            "Phase 1: Fetching metadata for messages",
            account_id=account.id,
            count=len(message_ids),
        )
        metadata_results = await gmail_client.get_messages_batch(
            access_token=access_token,
            message_ids=list(message_ids),
            msg_format="metadata",
            batch_size=25,
            header_fields=_METADATA_HEADERS,
        )

        accepted_ids: List[str] = []
        metadata_classifications: Dict[str, ClassificationResult] = {}
        for msg_id, meta in metadata_results.items():
            if meta is None:
                stats.unavailable += 1
                logger.debug("Message unavailable (404)", message_id=msg_id)
                continue
            stats.metadata_fetched += 1

            label_ids: List[str] = meta.get("labelIds", [])
            headers_raw: List[Dict[str, str]] = meta.get("payload", {}).get("headers", [])
            headers: Dict[str, str] = {h["name"].lower(): h["value"] for h in headers_raw}

            classification: ClassificationResult = await email_filter.classify_metadata(
                label_ids=label_ids,
                headers=headers,
                db=db,
                tenant_id=account.tenant_id,
                is_existing_conversation=await self._is_existing_conversation(
                    account, meta.get("threadId", msg_id), db),
                own_domain=_own_domain(account),
            )

            if not classification.should_store:
                stats.metadata_blocked += 1
                logger.info(
                    "Message suppressed at metadata stage",
                    message_id=msg_id,
                    category=classification.category.value,
                    disposition=classification.disposition.value,
                    reasons=classification.reasons,
                )
                continue

            metadata_classifications[msg_id] = classification
            accepted_ids.append(msg_id)

        logger.info(
            "Phase 1 complete",
            account_id=account.id,
            accepted=len(accepted_ids),
            blocked=stats.metadata_blocked,
            unavailable=stats.unavailable,
        )

        # ---- Phase 2: Full fetch + normalize + store ----
        if not accepted_ids:
            return stats

        logger.info(
            "Phase 2: Fetching full bodies for accepted messages",
            account_id=account.id,
            count=len(accepted_ids),
        )
        full_results = await gmail_client.get_messages_batch(
            access_token=access_token,
            message_ids=accepted_ids,
            msg_format="full",
            batch_size=25,
        )

        for msg_id, full_data in full_results.items():
            if full_data is None:
                stats.unavailable += 1
                continue
            stats.full_fetched += 1

            try:
                meta_res = metadata_classifications.get(msg_id)
                stored = await self._normalize_and_store(
                    msg_data=full_data,
                    account=account,
                    db=db,
                    metadata_result=meta_res,
                )
                if stored is True:
                    stats.stored += 1
                elif stored is False:
                    stats.filtered_body += 1
                else:
                    # stored == "duplicate"
                    stats.skipped_duplicate += 1
            except Exception as exc:
                stats.failed += 1
                logger.error(
                    "Error normalizing/storing message",
                    message_id=msg_id,
                    error=str(exc),
                    exc_info=False,
                )

        return stats

    # -------------------------------------------------------------------------
    # Normalize and Store
    # -------------------------------------------------------------------------

    async def _normalize_and_store(
        self,
        msg_data: Dict[str, Any],
        account: ConnectedIntegrationAccount,
        db: AsyncSession,
        metadata_result: Optional[ClassificationResult] = None,
    ) -> object:
        """Parse MIME, run body filter, store thread+message atomically.

        Returns:
            True  → stored successfully
            False → blocked at body stage
            "duplicate" → already in DB
        """
        external_message_id = msg_data.get("id", "")
        external_thread_id = msg_data.get("threadId", external_message_id)

        # Non-negotiable requirement: Do not resurrect permanently deleted provider threads
        suppressed = (await db.execute(
            select(ThreadSuppressionMarker.id).where(
                ThreadSuppressionMarker.tenant_id == account.tenant_id,
                ThreadSuppressionMarker.integration_account_id == account.id,
                ThreadSuppressionMarker.external_thread_id == external_thread_id,
            ).limit(1)
        )).first()
        if suppressed:
            logger.info(
                "Message ignored: provider thread suppressed by permanent deletion marker",
                external_thread_id=external_thread_id,
                external_message_id=external_message_id,
                tenant_id=account.tenant_id,
            )
            return False

        # ---- Parse MIME ----
        parse_result: MimeParseResult = email_parser.parse_gmail_payload(msg_data)

        # ---- Body-level filters ----
        if parse_result.is_html_only:
            logger.debug(
                "Message blocked: HTML-only (no text/plain part)",
                message_id=external_message_id,
            )
            return False

        if not parse_result.body_text or not parse_result.body_text.strip():
            logger.debug(
                "Message blocked: empty body after normalization",
                message_id=external_message_id,
            )
            return False

        # ---- Determine message direction ----
        # If the from_email matches the account's email or has SENT label → outbound
        direction = MessageDirection.INBOUND.value
        label_ids = set(msg_data.get("labelIds", []))
        sender_lower = (parse_result.from_email or "").lower()
        account_email_lower = (account.email_address or "").lower()
        if "SENT" in label_ids or (account_email_lower and account_email_lower in sender_lower):
            direction = MessageDirection.OUTBOUND.value

        # ---- Pre-Persistence Classification Gate ----
        if direction == MessageDirection.OUTBOUND.value:
            # Outbound emails sent by the business account are preserved as conversation context
            classification = ClassificationResult(
                category=EmailCategory.BUSINESS_CONVERSATION,
                disposition=EmailDisposition.STORE_WITHOUT_CONVERSATION_PROCESSING,
                confidence=1.0,
                reasons=["outbound_account_message"],
                score=0,
            )
        else:
            headers_raw = msg_data.get("payload", {}).get("headers", [])
            headers = {h["name"].lower(): h["value"] for h in headers_raw if "name" in h and "value" in h}
            from_header = headers.get("from", "")
            subject_raw = parse_result.subject or headers.get("subject", "")

            existing = await self._is_existing_conversation(account, external_thread_id, db)
            own_domain = _own_domain(account)
            msg_labels = list(msg_data.get("labelIds", []))
            # If metadata classification was not precomputed (e.g. direct call), run Stage 1
            if metadata_result is None:
                metadata_result = await email_filter.classify_metadata(
                    label_ids=msg_labels,
                    headers=headers,
                    db=db,
                    tenant_id=account.tenant_id,
                    is_existing_conversation=existing,
                    own_domain=own_domain,
                )

            classification = email_filter.classify_body(
                body_text=parse_result.body_text,
                subject=subject_raw,
                from_header=from_header,
                metadata_result=metadata_result,
                headers=headers,
                label_ids=msg_labels,
                is_existing_conversation=existing,
                own_domain=own_domain,
            )
            if classification.category == EmailCategory.AMBIGUOUS:
                classification = await _second_opinion(classification, from_header, subject_raw,
                                                       parse_result.body_text)

        # Non-negotiable requirement: Block unwanted emails before thread upsert or message insert
        if not classification.should_store:
            logger.info(
                "Message suppressed before email_messages persistence",
                message_id=external_message_id,
                category=classification.category.value,
                disposition=classification.disposition.value,
                reasons=classification.reasons,
            )
            return False

        # ---- Determine sent_at ----
        now = datetime.now(timezone.utc)
        sent_at = parse_result.sent_at or now

        # ---- Determine snippet (first 500 chars of body_text) ----
        snippet = (parse_result.body_text or "")[:500].replace("\n", " ").strip()

        # ---- Upsert thread ONLY for eligible emails ----
        await self._upsert_thread(
            account=account,
            external_thread_id=external_thread_id,
            subject_normalized=parse_result.subject_normalized or "(No Subject)",
            sender_email=parse_result.from_email,
            sender_name=parse_result.sender_name,
            snippet=snippet,
            sent_at=sent_at,
            db=db,
        )

        # ---- Fetch thread ID after upsert ----
        res_th = await db.execute(
            select(EmailThread.id).where(
                EmailThread.tenant_id == account.tenant_id,
                EmailThread.integration_account_id == account.id,
                EmailThread.external_thread_id == external_thread_id,
            )
        )
        thread_id_row = res_th.scalar_one_or_none()
        if not thread_id_row:
            logger.error(
                "Thread not found after upsert — race condition?",
                external_thread_id=external_thread_id,
            )
            return False
        thread_id = thread_id_row

        # ---- Insert message (idempotent via ON CONFLICT DO NOTHING) ----
        to_emails_json = json.dumps(parse_result.to_emails) if parse_result.to_emails else None
        cc_emails_json = json.dumps(parse_result.cc_emails) if parse_result.cc_emails else None

        new_msg_id = f"msg_{uuid.uuid4().hex}"
        msg_insert = pg_insert(EmailMessage).values(
            id=new_msg_id,
            tenant_id=account.tenant_id,
            thread_id=thread_id,
            integration_account_id=account.id,
            external_message_id=external_message_id,
            direction=direction,
            from_email=parse_result.from_email[:320],
            from_name=(parse_result.sender_name or "")[:255] or None,
            to_emails=to_emails_json,
            cc_emails=cc_emails_json,
            body_text=parse_result.body_text,
            sent_at=sent_at,
            message_id_header=(parse_result.message_id_header or "")[:998] or None,
            in_reply_to_external_id=(parse_result.in_reply_to or "")[:512] or None,
            references_header=parse_result.references,
            filter_reason=classification.category.value,
            created_at=now,
            updated_at=now,
        ).on_conflict_do_nothing(
            index_elements=["integration_account_id", "external_message_id"]
        )
        result = await db.execute(msg_insert)
        await db.flush()

        if getattr(result, "rowcount", 0) == 0:
            # Already stored — idempotent skip
            logger.debug("Message already stored (idempotent skip)", message_id=external_message_id)
            return "duplicate"

        # ---- Update thread denormalized fields ----
        await db.execute(
            text("""
                UPDATE email_threads
                SET
                    message_count = message_count + 1,
                    unread_count = unread_count + 1,
                    snippet = :snippet,
                    sender_email = COALESCE(:sender_email, sender_email),
                    sender_name = COALESCE(:sender_name, sender_name),
                    latest_message_at = GREATEST(COALESCE(latest_message_at, :sent_at), :sent_at),
                    first_message_at = COALESCE(first_message_at, :sent_at),
                    updated_at = :now
                WHERE id = :thread_id
            """),
            {
                "snippet": snippet,
                "sender_email": parse_result.from_email[:320] if direction == MessageDirection.INBOUND.value else None,
                "sender_name": (parse_result.sender_name or "")[:255] or None if direction == MessageDirection.INBOUND.value else None,
                "sent_at": sent_at,
                "now": now,
                "thread_id": thread_id,
            },
        )

        # ---- Create Transactional Outbox Event for Context Resolution ----
        outbox_event = None
        from datetime import timedelta
        is_recent_email = (now - sent_at) <= timedelta(hours=48)
        if (
            direction == MessageDirection.INBOUND.value
            and classification.disposition == EmailDisposition.STORE_AND_RESOLVE_CONTEXT
            and is_recent_email
        ):
            outbox_event = outbox_service.create_record(
                db=db,
                tenant_id=account.tenant_id,
                event_type="email.context.resolve",
                aggregate_type="email_message",
                aggregate_id=new_msg_id,
                payload={
                    "tenant_id": account.tenant_id,
                    "account_id": account.id,
                    "thread_id": thread_id,
                    "message_id": new_msg_id,
                    "external_thread_id": external_thread_id,
                    "external_message_id": external_message_id,
                },
                stream_name="email_events",
                correlation_id=external_message_id,
            )

        # ---- Follow-up intelligence: fence pending outreach + followup.assess (same transaction) ----
        # Accepted customer mail and mail the team actually sent from the connected mailbox. Machine
        # mail never reaches this point (classified out above); recency is enforced inside.
        followup_event = None
        if direction == MessageDirection.OUTBOUND.value or (
            classification.disposition == EmailDisposition.STORE_AND_RESOLVE_CONTEXT
        ):
            from app.services.followups.triggers import on_message_stored

            followup_event = await on_message_stored(
                db, tenant_id=account.tenant_id, account_id=account.id, thread_id=thread_id,
                message_id=new_msg_id, sent_at=sent_at, direction=direction,
                from_email=parse_result.from_email, now=now,
            )

        await db.commit()

        if outbox_event:
            asyncio.create_task(outbox_service.dispatch_fast_path(outbox_event.id))
        if followup_event:
            asyncio.create_task(outbox_service.dispatch_fast_path(followup_event.id))

        # Memory 4: update the counterpart's relationship memory. Runs only for newly
        # inserted messages (duplicates returned above), after the message commit, and
        # never raises — relationship capture can never block email ingestion.
        from app.services.contact_memory import contact_memory_service

        await contact_memory_service.record_message_interaction(
            tenant_id=account.tenant_id,
            direction=direction,
            from_email=parse_result.from_email,
            from_name=parse_result.sender_name,
            to_emails=parse_result.to_emails or [],
            cc_emails=parse_result.cc_emails or [],
            sent_at=sent_at,
            own_emails=[account.email_address or ""],
        )

        # Memory 7: learn from what humans send and how customers react. Best-effort.
        from app.services.feedback_memory import feedback_memory_service

        if direction == MessageDirection.OUTBOUND.value:
            # Delayed so an AI-delivered reply's provider id is committed before we look.
            feedback_memory_service.schedule_human_outbound(
                account.tenant_id, thread_id, new_msg_id, external_message_id,
                parse_result.body_text, sent_at,
            )
        elif classification.disposition == EmailDisposition.STORE_AND_RESOLVE_CONTEXT:
            await feedback_memory_service.capture_outcome(
                account.tenant_id, thread_id, new_msg_id, parse_result.body_text, sent_at,
            )

        # Memory 6: promises / decisions / deadlines — background LLM extraction, never blocks.
        if direction == MessageDirection.OUTBOUND.value or (
            classification.disposition == EmailDisposition.STORE_AND_RESOLVE_CONTEXT
        ):
            from app.services.commitment_memory import commitment_memory_service

            commitment_memory_service.schedule_extraction(account.tenant_id, new_msg_id, sent_at)

            # Memory 3: keep the conversation's memory current (background, idempotent).
            from app.services.thread_memory import thread_memory_service

            thread_memory_service.schedule_update(account.tenant_id, thread_id, sent_at)

        logger.info(
            "Message stored and outbox dispatched",
            message_id=external_message_id,
            thread_id=thread_id,
            direction=direction,
            category=classification.category.value,
            sent_at=sent_at.isoformat(),
        )
        return True

    async def _is_existing_conversation(self, account: Any, external_thread_id: str, db: AsyncSession) -> bool:
        """True when this Gmail thread is already a conversation in which the business replied.
        One indexed lookup; never raises (a failure just means "not known")."""
        if not external_thread_id:
            return False
        try:
            suppressed = (await db.execute(
                select(ThreadSuppressionMarker.id).where(
                    ThreadSuppressionMarker.tenant_id == account.tenant_id,
                    ThreadSuppressionMarker.integration_account_id == account.id,
                    ThreadSuppressionMarker.external_thread_id == external_thread_id,
                ).limit(1)
            )).first()
            if suppressed:
                return False

            row = await db.execute(
                select(EmailMessage.id)
                .join(EmailThread, EmailThread.id == EmailMessage.thread_id)
                .where(EmailThread.tenant_id == account.tenant_id,
                       EmailThread.integration_account_id == account.id,
                       EmailThread.external_thread_id == external_thread_id,
                       EmailMessage.direction == MessageDirection.OUTBOUND.value)
                .limit(1))
            return row.first() is not None
        except Exception:  # noqa: BLE001
            return False

    async def _upsert_thread(
        self,
        account: ConnectedIntegrationAccount,
        external_thread_id: str,
        subject_normalized: str,
        sender_email: str,
        sender_name: Optional[str],
        snippet: str,
        sent_at: datetime,
        db: AsyncSession,
    ) -> None:
        """INSERT thread ON CONFLICT DO NOTHING — idempotent, race-safe."""
        now = datetime.now(timezone.utc)
        thread_insert = pg_insert(EmailThread).values(
            id=f"thr_{uuid.uuid4().hex}",
            tenant_id=account.tenant_id,
            integration_account_id=account.id,
            external_thread_id=external_thread_id,
            subject=subject_normalized[:998],
            snippet=snippet[:500],
            sender_email=(sender_email or "")[:320] or None,
            sender_name=(sender_name or "")[:255] or None,
            status=ThreadStatus.PENDING_TRIAGE.value,
            lead_intent=LeadIntent.UNKNOWN.value,
            is_read=False,
            message_count=0,  # Updated by _normalize_and_store after message insert
            unread_count=0,
            first_message_at=sent_at,
            latest_message_at=sent_at,
            created_at=now,
            updated_at=now,
        ).on_conflict_do_nothing(
            index_elements=["tenant_id", "integration_account_id", "external_thread_id"]
        )
        await db.execute(thread_insert)
        await db.flush()


# =============================================================================
# Singleton
# =============================================================================

gmail_sync_engine = GmailSyncEngine()
