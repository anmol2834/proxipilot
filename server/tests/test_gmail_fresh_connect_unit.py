"""Unit tests: connecting / re-establishing Gmail never backfills old mail.

- execute_full_sync only records the current historyId baseline (no messages listed/ingested)
- renewing an EXPIRED watch resets the cursor to "now" (no replay of the downtime backlog)
- renewing a still-valid watch keeps the cursor (no message lost)
"""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.integration import IntegrationStatus
from app.services import gmail_sync as gmail_sync_mod
from app.services import gmail_watch as gmail_watch_mod


def _db_returning(obj):
    res = MagicMock()
    res.scalar_one_or_none.return_value = obj
    db = MagicMock()
    db.execute = AsyncMock(return_value=res)
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.add = MagicMock()
    return db


@pytest.mark.asyncio
async def test_full_sync_sets_baseline_without_importing_mail(monkeypatch):
    client = MagicMock()
    client.get_valid_access_token = AsyncMock(return_value="tok")
    client.get_profile = AsyncMock(return_value={"historyId": "999"})
    client.list_messages = AsyncMock(side_effect=AssertionError("must not list old mail"))
    monkeypatch.setattr(gmail_sync_mod, "gmail_client", client)
    import app.services.audit as audit_mod
    monkeypatch.setattr(audit_mod.audit_service, "record", AsyncMock())

    cursor = SimpleNamespace(cursor_value=None, sync_state=None, last_attempted_sync_at=None,
                             last_full_sync_at=None, last_successful_sync_at=None)
    account = SimpleNamespace(id="int_1", tenant_id="org_1", status=None, connection_status=None,
                              last_history_id=None, last_synced_at=None, last_successful_sync_at=None,
                              last_error_code=None, access_token_encrypted="x", email_address="a@b.c")
    engine = gmail_sync_mod.GmailSyncEngine()
    # Ingestion may be called with an empty set (no-op) but never with message ids.
    monkeypatch.setattr(engine, "_ingest_changed_messages",
                        AsyncMock(return_value=gmail_sync_mod.SyncStats(seen=0)))

    await engine.execute_full_sync(account, _db_returning(cursor))

    client.list_messages.assert_not_called()
    assert cursor.cursor_value == "999" and account.last_history_id == "999"
    assert account.status == IntegrationStatus.CONNECTED.value
    args = engine._ingest_changed_messages.await_args
    assert args is None or not args.args[2]  # never called with message ids


def _watch_setup(monkeypatch, prev_expiry):
    client = MagicMock()
    client.get_valid_access_token = AsyncMock(return_value="tok")
    future_ms = int((datetime.now(timezone.utc) + timedelta(days=7)).timestamp() * 1000)
    client.watch_user = AsyncMock(return_value={"historyId": "500", "expiration": str(future_ms)})
    monkeypatch.setattr(gmail_watch_mod, "gmail_client", client)
    import app.services.audit as audit_mod
    monkeypatch.setattr(audit_mod.audit_service, "record", AsyncMock())
    svc = gmail_watch_mod.gmail_watch_service
    monkeypatch.setattr(svc.settings.providers, "gmail_pubsub_topic", "projects/x/topics/y", raising=False)
    cursor = SimpleNamespace(cursor_value="100", watch_expires_at=prev_expiry, sync_state=None,
                             last_successful_sync_at=None)
    account = SimpleNamespace(id="int_1", tenant_id="org_1", status=IntegrationStatus.CONNECTED.value,
                              connection_status="healthy", last_history_id="100", email_address="a@b.c")
    return svc, cursor, account


@pytest.mark.asyncio
async def test_renewing_expired_watch_starts_fresh(monkeypatch):
    expired = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    svc, cursor, account = _watch_setup(monkeypatch, expired)
    await svc.create_or_renew_watch(account, _db_returning(cursor), is_renewal=True)
    assert cursor.cursor_value == "500"  # downtime backlog is NOT replayed


@pytest.mark.asyncio
async def test_renewing_valid_watch_keeps_cursor(monkeypatch):
    valid = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    svc, cursor, account = _watch_setup(monkeypatch, valid)
    await svc.create_or_renew_watch(account, _db_returning(cursor), is_renewal=True)
    assert cursor.cursor_value == "100"  # live watch: nothing skipped
