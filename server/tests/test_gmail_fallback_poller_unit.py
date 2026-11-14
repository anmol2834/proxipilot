"""Fallback poller: one getProfile per mailbox; publish a sync ONLY when Gmail is ahead."""
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services import gmail_fallback_poller as mod


class _Ctx:
    async def __aenter__(self):
        return MagicMock()

    async def __aexit__(self, *a):
        return False


@pytest.mark.asyncio
async def test_publishes_only_when_gmail_is_ahead_and_survives_failures(monkeypatch):
    accounts = [
        {"account": SimpleNamespace(id="int_ahead", tenant_id="org_a", email_address="a@x.test"), "cursor": "100"},
        {"account": SimpleNamespace(id="int_same", tenant_id="org_b", email_address="b@x.test"), "cursor": "200"},
        {"account": SimpleNamespace(id="int_err", tenant_id="org_c", email_address="c@x.test"), "cursor": "300"},
    ]
    profiles = {"tok_int_ahead": {"historyId": "150"}, "tok_int_same": {"historyId": "200"}}

    client = MagicMock()
    client.get_valid_access_token = AsyncMock(side_effect=lambda acc, db: f"tok_{acc.id}")

    async def _profile(tok):
        if tok not in profiles:
            raise RuntimeError("token revoked")
        return profiles[tok]
    client.get_profile = AsyncMock(side_effect=_profile)
    bus = MagicMock()
    bus.publish = AsyncMock()
    monkeypatch.setattr(mod, "gmail_client", client)
    monkeypatch.setattr(mod, "event_bus", bus)
    monkeypatch.setattr(mod, "db_manager", SimpleNamespace(session_factory=lambda: _Ctx()))

    poller = mod.GmailFallbackPoller()
    monkeypatch.setattr(poller, "_active_accounts", AsyncMock(return_value=accounts))

    assert await poller.poll_once() == 1
    bus.publish.assert_awaited_once()
    stream, event = bus.publish.await_args.args
    assert stream == "email_events"
    assert event.event_type == "gmail.incremental_sync"
    assert event.payload["account_id"] == "int_ahead" and event.payload["history_id"] == "150"
