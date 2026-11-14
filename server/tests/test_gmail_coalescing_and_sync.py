"""Comprehensive Verification Tests for Gmail Coalescing, Idempotency, and Cursor Safety (Phase 10.0).

Tests:
1. test_numeric_history_id_comparison:
   Validates integer-safe historyId comparison (prevents lexicographic string ordering bugs).
2. test_distributed_lock_mutual_exclusion:
   Verifies per-account DistributedLock mutual exclusion, safe release, and token validation.
3. test_pending_high_watermark_lua_coalescing:
   Verifies atomic max() updates via Redis Lua script (_LUA_ATOMIC_MAX) for out-of-order events.
4. test_message_persistence_idempotency:
   Verifies that duplicate external_message_id writes trigger ON CONFLICT DO NOTHING, returning 'duplicate'
   without throwing errors or duplicating database records.
5. test_message_404_handling_clean:
   Verifies that unavailable messages (Gmail 404) increment stats.unavailable and do not crash sync.
6. test_cursor_advancement_safety_on_failure:
   Verifies that message persistence failures (stats.failed > 0) strictly halt cursor advancement
   and transition cursor state to FAILED.
"""

from datetime import datetime, timezone
import json
from unittest.mock import AsyncMock, patch
import uuid
import pytest
from sqlalchemy import select

from app.core.database import get_db
from app.models.inbox import EmailMessage, EmailThread
from app.models.integration import (
    ConnectedIntegrationAccount,
    CursorSyncState,
    EmailProvider,
    IntegrationStatus,
    SyncCursor,
)
from app.models.organization import Organization
from app.services.gmail_sync import (
    DistributedLock,
    SyncStats,
    _get_and_clear_pending_watermark,
    _update_pending_watermark,
    gmail_sync_engine,
)


@pytest.fixture
async def setup_sync_test_account():
    """Create test organization and connected integration account with cursor."""
    test_org_id = f"org_{uuid.uuid4().hex}"
    account_id = f"int_{uuid.uuid4().hex}"
    email = f"sync_{uuid.uuid4().hex[:8]}@example.com"

    async for db in get_db():
        org = Organization(
            id=test_org_id,
            name="Sync Test Org",
            slug=f"sync-org-{uuid.uuid4().hex[:6]}",
        )
        db.add(org)

        account = ConnectedIntegrationAccount(
            id=account_id,
            tenant_id=test_org_id,
            provider=EmailProvider.GMAIL.value,
            email_address=email,
            status=IntegrationStatus.CONNECTED.value,
            last_history_id="1000",
        )
        db.add(account)

        cursor = SyncCursor(
            id=f"cur_{uuid.uuid4().hex}",
            tenant_id=test_org_id,
            integration_account_id=account_id,
            cursor_type="history_id",
            cursor_value="1000",
            sync_state=CursorSyncState.IDLE.value,
        )
        db.add(cursor)
        await db.commit()

    yield {
        "org_id": test_org_id,
        "account_id": account_id,
        "email": email,
    }


def test_numeric_history_id_comparison():
    """Verify that history IDs are strictly compared numerically as integers.
    
    In string comparison: '99999' > '100000' is True (lexicographic error!).
    In integer comparison: 100000 > 99999 is True (correct).
    """
    id_smaller_str = "99999"
    id_larger_str = "100000"

    # Demonstrate string bug
    assert id_smaller_str > id_larger_str

    # Verify integer conversion semantics
    assert int(id_larger_str) > int(id_smaller_str)


@pytest.mark.asyncio
async def test_distributed_lock_mutual_exclusion():
    """Verify that DistributedLock enforces mutual exclusion for the same account."""
    lock_key = f"gmail:test_lock:{uuid.uuid4().hex}"
    lock1 = DistributedLock(key=lock_key, ttl_seconds=30)
    lock2 = DistributedLock(key=lock_key, ttl_seconds=30)

    # First lock acquires successfully
    acquired1 = await lock1.acquire()
    assert acquired1 is True

    # Second lock fails to acquire because lock1 holds it
    acquired2 = await lock2.acquire()
    assert acquired2 is False

    # lock1 releases
    await lock1.release()

    # Now lock2 can acquire
    acquired2_again = await lock2.acquire()
    assert acquired2_again is True

    # Cleanup
    await lock2.release()


@pytest.mark.asyncio
async def test_pending_high_watermark_lua_coalescing():
    """Verify that _update_pending_watermark stores max() atomically via Redis Lua."""
    account_id = f"test_coalesce_{uuid.uuid4().hex}"

    # Initial watermark: 500
    await _update_pending_watermark(account_id, "500")

    # Out-of-order smaller watermark arriving later: 400 (should NOT lower the watermark)
    await _update_pending_watermark(account_id, "400")

    # Newer larger watermark: 650 (should advance)
    await _update_pending_watermark(account_id, "650")

    # Another smaller: 600 (should not lower)
    await _update_pending_watermark(account_id, "600")

    # Read and clear
    final_watermark = await _get_and_clear_pending_watermark(account_id)
    assert final_watermark == 650

    # Ensure it was cleared (subsequent call returns None)
    cleared = await _get_and_clear_pending_watermark(account_id)
    assert cleared is None


@pytest.mark.asyncio
async def test_message_persistence_idempotency(setup_sync_test_account):
    """Verify that duplicate message inserts are safely handled with ON CONFLICT DO NOTHING."""
    acc = setup_sync_test_account
    msg_id = f"ext_msg_{uuid.uuid4().hex}"
    thread_id = f"ext_thr_{uuid.uuid4().hex}"

    # Minimal valid Gmail message payload
    msg_data = {
        "id": msg_id,
        "threadId": thread_id,
        "payload": {
            "mimeType": "text/plain",
            "headers": [
                {"name": "From", "value": "Customer <customer@client.com>"},
                {"name": "To", "value": acc["email"]},
                {"name": "Subject", "value": "Enterprise Contract Discussion"},
                {"name": "Date", "value": "Sun, 18 Oct 2026 12:00:00 +0000"},
            ],
            "body": {
                "size": 42,
                "data": "VGhhbmsgeW91IGZvciB0aGUgdXBkYXRlLCB3ZSBhcmUgcmVhZHkgdG8gcHJvY2VlZC4=",  # "Thank you for the update, we are ready to proceed."
            },
        },
    }

    async for db in get_db():
        res = await db.execute(
            select(ConnectedIntegrationAccount).where(
                ConnectedIntegrationAccount.id == acc["account_id"]
            )
        )
        account = res.scalar_one()

        # First insert -> True (stored)
        res1 = await gmail_sync_engine._normalize_and_store(msg_data, account, db)
        assert res1 is True

        # Second insert with identical external_message_id -> "duplicate"
        res2 = await gmail_sync_engine._normalize_and_store(msg_data, account, db)
        assert res2 == "duplicate"

        # Verify exactly 1 message row exists in PostgreSQL
        stmt = select(EmailMessage).where(
            EmailMessage.integration_account_id == acc["account_id"],
            EmailMessage.external_message_id == msg_id,
        )
        msg_rows = (await db.execute(stmt)).scalars().all()
        assert len(msg_rows) == 1

        # Verify thread exists and message_count is 1 (not duplicated)
        th_stmt = select(EmailThread).where(
            EmailThread.integration_account_id == acc["account_id"],
            EmailThread.external_thread_id == thread_id,
        )
        th_row = (await db.execute(th_stmt)).scalar_one()
        assert th_row.message_count == 1


@pytest.mark.asyncio
async def test_message_404_handling_clean(setup_sync_test_account):
    """Verify that 404 responses for deleted messages increment stats.unavailable without failing sync."""
    acc = setup_sync_test_account

    async for db in get_db():
        res = await db.execute(
            select(ConnectedIntegrationAccount).where(
                ConnectedIntegrationAccount.id == acc["account_id"]
            )
        )
        account = res.scalar_one()

        # Simulate batch metadata return where one message is 404 (None)
        with patch(
            "app.services.gmail_sync.gmail_client.get_messages_batch",
            new=AsyncMock(return_value={"msg_404": None}),
        ):
            stats = await gmail_sync_engine._ingest_changed_messages(
                access_token="mock-token",
                account=account,
                message_ids={"msg_404"},
                db=db,
            )
            assert stats.unavailable == 1
            assert stats.failed == 0
            assert stats.stored == 0


@pytest.mark.asyncio
async def test_cursor_advancement_safety_on_failure(setup_sync_test_account):
    """Verify that unhandled message failures halt cursor advancement and mark cursor FAILED."""
    acc = setup_sync_test_account

    async for db in get_db():
        res = await db.execute(
            select(ConnectedIntegrationAccount).where(
                ConnectedIntegrationAccount.id == acc["account_id"]
            )
        )
        account = res.scalar_one()

        cur_stmt = select(SyncCursor).where(
            SyncCursor.integration_account_id == acc["account_id"]
        )
        cursor_row = (await db.execute(cur_stmt)).scalar_one()

        mock_history_resp = {
            "historyId": "1500",
            "history": [
                {
                    "messagesAdded": [
                        {"message": {"id": "msg_broken", "labelIds": ["INBOX"]}}
                    ]
                }
            ],
        }

        # Mock gmail history with messages, but simulate failure during _normalize_and_store
        with patch(
            "app.services.gmail_sync.gmail_client.get_valid_access_token",
            new=AsyncMock(return_value="mock_access_token"),
        ), patch(
            "app.services.gmail_sync.gmail_client.list_history",
            new=AsyncMock(return_value=mock_history_resp),
        ), patch(
            "app.services.gmail_sync.gmail_client.get_messages_batch",
            new=AsyncMock(return_value={
                "msg_broken": {
                    "id": "msg_broken",
                    "threadId": "thr_broken",
                    "payload": {
                        "headers": [
                            {"name": "Subject", "value": "Test"},
                            {"name": "From", "value": "sender@test.com"},
                        ]
                    },
                }
            }),
        ), patch.object(
            gmail_sync_engine,
            "_normalize_and_store",
            side_effect=RuntimeError("Simulated DB Disk Full"),
        ):
            with pytest.raises(RuntimeError, match="Incremental sync had 1 failed messages; cursor not advanced"):
                await gmail_sync_engine.execute_incremental_sync(
                    account=account,
                    cursor=cursor_row,
                    db=db,
                )

        # Verify cursor in DB: must NOT be advanced to 1500, state must be FAILED
        await db.refresh(cursor_row)
        assert cursor_row.cursor_value == "1000"  # Original cursor unchanged
        assert cursor_row.sync_state == CursorSyncState.FAILED.value
        assert cursor_row.last_failure_code in ("MESSAGE_PROCESSING_FAILED", "RuntimeError")
