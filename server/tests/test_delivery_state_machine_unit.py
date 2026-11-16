"""Delivery state machine: unknown outcomes are reconciled with Gmail BEFORE any retry, so a timeout
after Gmail accepted the message never causes a duplicate, and a lost send is never silent."""

import asyncio
from types import SimpleNamespace

import httpx
import pytest

from app.models.outbound import DeliveryStatus as S
from app.services import gmail_client as gc
from app.services.reply_planner import delivery_state as ds


class _Db:
    def __init__(self, out):
        self.out, self.commits = out, []

    async def commit(self):
        self.commits.append(self.out.delivery_status)


def _out():
    return SimpleNamespace(id="out_1", delivery_status=S.PENDING.value, send_attempts=0, max_send_attempts=3,
                           last_attempt_at=None, last_error=None, provider_message_id=None)


def _run(monkeypatch, send, find=None, token="tok"):
    async def get_token(_acc, _db):
        if token is None:
            raise RuntimeError("oauth down")
        return token
    calls = {}

    async def send_message(**kw):
        calls["kw"] = kw
        return await send(**kw)

    async def find_sent(_tok, _thread, out_id):
        calls["found_for"] = out_id
        return await find() if find else None
    monkeypatch.setattr(gc.gmail_client, "get_valid_access_token", get_token)
    monkeypatch.setattr(gc.gmail_client, "send_message", send_message)
    monkeypatch.setattr(gc.gmail_client, "find_sent_by_outbound_id", find_sent)
    out = _out()
    db = _Db(out)

    async def go():
        return await ds.dispatch_with_reconciliation(db, out, SimpleNamespace(), gmail_thread_id="t1",
                                                     send_kwargs={"to_email": "c@x.com"})
    return out, db, calls, go


def test_success_marks_attempt_before_sending_and_tags_outbound_id(monkeypatch):
    async def ok(**kw):
        return {"id": "g1"}
    out, db, calls, go = _run(monkeypatch, ok)
    res = asyncio.run(go())
    assert res["id"] == "g1" and out.delivery_status == S.PROVIDER_ACCEPTED.value
    assert db.commits[0] == S.SEND_ATTEMPTED.value          # durable marker before the provider call
    assert calls["kw"]["outbound_id"] == "out_1" and out.send_attempts == 1


def test_timeout_but_gmail_accepted_is_reconciled_not_resent(monkeypatch):
    async def timeout(**kw):
        raise httpx.ReadTimeout("slow")

    async def found():
        return "g9"
    out, db, calls, go = _run(monkeypatch, timeout, found)
    res = asyncio.run(go())
    assert res["reconciled"] and res["id"] == "g9"
    assert out.delivery_status == S.PROVIDER_ACCEPTED.value and S.DELIVERY_UNKNOWN.value in db.commits


def test_timeout_verified_not_sent_becomes_retryable(monkeypatch):
    async def timeout(**kw):
        raise httpx.ConnectError("down")
    out, db, calls, go = _run(monkeypatch, timeout, None)
    with pytest.raises(httpx.ConnectError):
        asyncio.run(go())
    assert out.delivery_status == S.FAILED_RETRYABLE.value and calls["found_for"] == "out_1"


def test_unverifiable_outcome_requires_reconciliation(monkeypatch):
    async def five_hundred(**kw):
        raise gc.GmailApiException("boom", status_code=503)

    async def gmail_unreachable():
        raise gc.GmailApiException("still down", status_code=503)
    out, db, calls, go = _run(monkeypatch, five_hundred, gmail_unreachable)
    with pytest.raises(ds.DeliveryOutcomeUnknown):
        asyncio.run(go())
    assert out.delivery_status == S.RECONCILIATION_REQUIRED.value


@pytest.mark.parametrize("status,expected", [(400, S.FAILED_FINAL.value), (403, S.FAILED_FINAL.value),
                                             (429, S.FAILED_RETRYABLE.value), (401, S.FAILED_RETRYABLE.value)])
def test_definite_rejections_are_not_reconciled(monkeypatch, status, expected):
    async def rejected(**kw):
        raise gc.GmailApiException("no", status_code=status)
    out, db, calls, go = _run(monkeypatch, rejected)
    with pytest.raises(gc.GmailApiException):
        asyncio.run(go())
    assert out.delivery_status == expected and "found_for" not in calls


def test_attempts_exhausted_is_final(monkeypatch):
    async def timeout(**kw):
        raise httpx.ReadTimeout("slow")
    out, db, calls, go = _run(monkeypatch, timeout, None)
    out.send_attempts = 2      # this attempt is the 3rd of 3
    with pytest.raises(httpx.ReadTimeout):
        asyncio.run(go())
    assert out.delivery_status == S.FAILED_FINAL.value


def test_token_failure_is_retryable_without_reconcile(monkeypatch):
    async def never(**kw):
        raise AssertionError("must not send without a token")
    out, db, calls, go = _run(monkeypatch, never, token=None)
    with pytest.raises(RuntimeError):
        asyncio.run(go())
    assert out.delivery_status == S.FAILED_RETRYABLE.value


def test_blocking_states_cover_every_uncertain_state():
    for st in (S.SENT, S.PROVIDER_ACCEPTED, S.SEND_ATTEMPTED, S.DELIVERY_UNKNOWN, S.RECONCILIATION_REQUIRED,
               S.FAILED_RETRYABLE):
        assert st.value in ds.BLOCKING_STATUSES
    assert S.FAILED_FINAL.value not in ds.BLOCKING_STATUSES and S.CANCELLED.value not in ds.BLOCKING_STATUSES
