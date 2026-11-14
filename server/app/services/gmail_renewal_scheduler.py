"""Gmail Watch Renewal Priority Scheduler.

Algorithm & DSA Architecture:
-----------------------------
1. Durable Persistence Layer:
   - PostgreSQL indexed query on (provider, sync_state, watch_expires_at).
   - Survives restarts, crashes, and multi-day platform downtime.
2. In-Memory Priority Scheduling Layer (Performance Optimization):
   - Min-Heap priority queue (heapq) storing (watch_expiration_timestamp, account_id).
   - Time Complexity:
     - Peek earliest expiration: O(1)
     - Insert / Reschedule account: O(log n)
     - Extract earliest expired: O(log n)
   - Space Complexity: O(n) memory in scheduler worker.
   - Note on Sync vs Scheduling Complexity:
     - Scheduling priority queue operations are strictly O(log n).
     - Actual mailbox synchronization is O(k) where k is the number of changed messages.
3. Resilience Invariant:
   - If the worker restarts, the in-memory min-heap is cleanly rebuilt from PostgreSQL.
"""

from datetime import datetime, timedelta, timezone
import heapq
from typing import Dict, List, Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import get_settings
from app.core.database import db_manager
from app.core.logging import logger
from app.models.integration import (
    ConnectedIntegrationAccount,
    IntegrationStatus,
    ConnectionHealthStatus,
    SyncCursor,
)
from app.services.gmail_client import GmailReauthRequiredException
from app.services.gmail_watch import gmail_watch_service


class WatchRenewalPriorityQueue:
    """Min-Heap priority queue for scheduling next-due Gmail watch renewals."""

    def __init__(self):
        # Each entry in heap is a tuple: (expiration_epoch_sec, account_id)
        self._heap: List[Tuple[float, str]] = []
        self._account_map: Dict[str, float] = {}

    def push(self, expiration_epoch_sec: float, account_id: str) -> None:
        """Insert or update next watch expiration. Complexity: O(log n)."""
        self._account_map[account_id] = expiration_epoch_sec
        heapq.heappush(self._heap, (expiration_epoch_sec, account_id))

    def peek(self) -> Optional[Tuple[float, str]]:
        """Peek at earliest expiring account without removing it. Complexity: O(1)."""
        while self._heap:
            epoch, acc_id = self._heap[0]
            # Verify if this entry matches latest timestamp (lazy invalidation)
            if self._account_map.get(acc_id) == epoch:
                return epoch, acc_id
            heapq.heappop(self._heap)
        return None

    def pop_due(self, threshold_epoch_sec: float) -> List[str]:
        """Extract all accounts whose watch expires before threshold. Complexity: O(m log n)."""
        due_accounts: List[str] = []
        while self._heap:
            epoch, acc_id = self._heap[0]
            if epoch > threshold_epoch_sec:
                break
            heapq.heappop(self._heap)
            if self._account_map.get(acc_id) == epoch:
                due_accounts.append(acc_id)
                self._account_map.pop(acc_id, None)
        return due_accounts

    def size(self) -> int:
        return len(self._account_map)

    def clear(self) -> None:
        self._heap.clear()
        self._account_map.clear()


class GmailRenewalScheduler:
    """Coordinates periodic renewal of Gmail Pub/Sub watches before the 7-day expiration."""

    def __init__(self):
        self.settings = get_settings()
        self.priority_queue = WatchRenewalPriorityQueue()

    async def rebuild_from_db(self, db: AsyncSession, limit: int = 1000) -> int:
        """Reconstruct the in-memory min-heap from durable indexed PostgreSQL state."""
        self.priority_queue.clear()
        
        # Query active accounts with sync cursors ordered by watch_expires_at
        stmt = (
            select(ConnectedIntegrationAccount.id, SyncCursor.watch_expires_at)
            .join(SyncCursor, SyncCursor.integration_account_id == ConnectedIntegrationAccount.id)
            .where(
                ConnectedIntegrationAccount.provider == "gmail",
                ConnectedIntegrationAccount.status.in_([
                    IntegrationStatus.CONNECTED.value,
                    IntegrationStatus.ACTIVE.value,
                    IntegrationStatus.DEGRADED.value,
                ]),
                SyncCursor.watch_expires_at.isnot(None),
            )
            .order_by(SyncCursor.watch_expires_at.asc())
            .limit(limit)
        )
        res = await db.execute(stmt)
        rows = res.all()

        count = 0
        for acc_id, exp_str in rows:
            if exp_str:
                try:
                    exp_dt = datetime.fromisoformat(exp_str)
                    exp_epoch = exp_dt.timestamp()
                    self.priority_queue.push(exp_epoch, acc_id)
                    count += 1
                except Exception as e:
                    logger.warning("Failed to parse watch_expires_at for heap", account_id=acc_id, error=str(e))

        logger.info("Rebuilt Gmail watch renewal min-heap from PostgreSQL", count=count)
        return count

    async def check_and_renew_due_watches(self, db: AsyncSession) -> int:
        """Check min-heap and renew all watches expiring within the configured safety window."""
        # Renewal threshold: now + renewal window (e.g. within next 2 days or past due)
        now = datetime.now(timezone.utc)
        renewal_window_sec = 2 * 86400  # 48 hours before 7-day expiration
        threshold_epoch = (now + timedelta(seconds=renewal_window_sec)).timestamp()

        due_account_ids = self.priority_queue.pop_due(threshold_epoch)
        if not due_account_ids:
            return 0

        renewed_count = 0
        for acc_id in due_account_ids:
            try:
                res = await db.execute(
                    select(ConnectedIntegrationAccount).where(ConnectedIntegrationAccount.id == acc_id)
                )
                account = res.scalar_one_or_none()
                if not account or account.status in (IntegrationStatus.DISCONNECTED.value, IntegrationStatus.REAUTH_REQUIRED.value):
                    continue

                cursor = await gmail_watch_service.create_or_renew_watch(account, db, is_renewal=True)
                if cursor.watch_expires_at:
                    new_exp_epoch = datetime.fromisoformat(cursor.watch_expires_at).timestamp()
                    self.priority_queue.push(new_exp_epoch, acc_id)
                renewed_count += 1
            except GmailReauthRequiredException as auth_err:
                logger.warning("Account requires re-auth during watch renewal", account_id=acc_id, error=str(auth_err))
                try:
                    res_err = await db.execute(
                        select(ConnectedIntegrationAccount).where(ConnectedIntegrationAccount.id == acc_id)
                    )
                    acc_err = res_err.scalar_one_or_none()
                    if acc_err:
                        acc_err.status = IntegrationStatus.REAUTH_REQUIRED.value
                        acc_err.connection_status = ConnectionHealthStatus.REAUTH_REQUIRED.value
                        acc_err.last_error_code = "REAUTH_REQUIRED"
                        acc_err.last_error_at = now.isoformat()
                        await db.commit()
                except Exception as commit_err:
                    logger.error("Failed to mark account reauth_required", account_id=acc_id, error=str(commit_err))
            except Exception as exc:
                logger.error("Failed to renew watch for account", account_id=acc_id, error=str(exc))
                # Reinsert with short backoff so it retries on next cycle
                self.priority_queue.push(now.timestamp() + 300, acc_id)

        logger.info("Renewed due Gmail watches", renewed_count=renewed_count)
        return renewed_count


gmail_renewal_scheduler = GmailRenewalScheduler()
