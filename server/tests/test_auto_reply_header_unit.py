"""Regression (2026-11-16): automatic replies carry RFC 3834 Auto-Submitted so another automated
responder (e.g. a second ProxiPilot tenant connected to the customer's mailbox) never answers
them; human-approved sends are not marked."""

import asyncio
import base64
from email import message_from_bytes
from types import SimpleNamespace

from app.services import gmail_client as gc


def _send(monkeypatch, auto):
    captured = {}

    class Client:
        async def post(self, url, headers=None, json=None, timeout=None):
            captured["raw"] = json["raw"]
            return SimpleNamespace(status_code=200, json=lambda: {"id": "m1", "threadId": "t1"},
                                   raise_for_status=lambda: None, text="")

    monkeypatch.setattr(gc, "http_client_manager", SimpleNamespace(client=Client()))
    asyncio.run(gc.gmail_client.send_message(access_token="x", to_email="c@example.com", subject="Re: q",
                                             body_text="hi", auto_submitted=auto))
    raw = captured["raw"] + "=" * (-len(captured["raw"]) % 4)
    return message_from_bytes(base64.urlsafe_b64decode(raw))


def test_automatic_reply_is_marked(monkeypatch):
    msg = _send(monkeypatch, True)
    assert msg["Auto-Submitted"] == "auto-replied" and msg["X-Auto-Response-Suppress"] == "All"


def test_human_approved_send_is_not_marked(monkeypatch):
    assert _send(monkeypatch, False)["Auto-Submitted"] is None
