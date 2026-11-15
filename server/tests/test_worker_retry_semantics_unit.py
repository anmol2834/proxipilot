"""Regression: a transient failure before delivery must be retried, never silently dropped.

Before the fix, the AI worker logged and swallowed every pipeline exception (the stream message
was acknowledged), and the per-message locks (5 min) blocked any retry: a Neon / OpenAI / Qdrant
blip meant the customer's email got no reply, no draft and no retry. Delivery failures stay
non-retryable (Gmail may already have accepted the send).
"""

import asyncio
from types import SimpleNamespace

import pytest

from app.core.messaging import DomainEvent
from app.workers import ai_worker as ai_mod
from app.workers import email_worker as email_mod


class _FakeRedis:
    def __init__(self):
        self.keys = {}
        self.deleted = []

    async def set(self, key, value, nx=False, ex=None):
        if nx and key in self.keys:
            return False
        self.keys[key] = value
        return True

    async def delete(self, *keys):
        for k in keys:
            self.deleted.append(k)
            self.keys.pop(k, None)
        return len(keys)


@pytest.fixture
def fake_redis(monkeypatch):
    from app.core import redis as redis_core

    r = _FakeRedis()
    monkeypatch.setattr(redis_core.redis_manager, "_client", r, raising=False)
    monkeypatch.setattr(type(redis_core.redis_manager), "client", property(lambda self: r))
    return r


def _plan_event():
    payload = {"tenant_id": "t_rt", "integration_account_id": "a", "thread_id": "th_rt", "message_id": "m_rt",
               "context_revision": 1, "plan_id": "plan_rt"}
    return DomainEvent(event_type="email.requirement_plan.created", tenant_id="t_rt", payload=payload)


def test_failure_before_delivery_is_retryable_and_frees_lock(fake_redis, monkeypatch):
    from app.services.retrieval_router import retrieval_router_service

    async def boom(**_):
        raise ConnectionError("neon connection reset")
    monkeypatch.setattr(retrieval_router_service, "route_and_retrieve", boom)

    worker = ai_mod.AiWorker()
    with pytest.raises(ConnectionError):
        asyncio.run(worker.process_event(_plan_event()))
    lock = "ai_worker:lock:t_rt:th_rt:m_rt"
    assert lock in fake_redis.deleted and lock not in fake_redis.keys

    # The retry is no longer blocked by the lock: it reaches the pipeline again.
    with pytest.raises(ConnectionError):
        asyncio.run(worker.process_event(_plan_event()))


def test_delivery_failure_is_not_retried(fake_redis, monkeypatch):
    from app.services import evidence_fusion, evidence_package, reply_planner, retrieval_router

    class _Result(SimpleNamespace):
        """Stage result stub: any attribute the worker only logs resolves to another stub."""

        value = "x"

        def __getattr__(self, _name):
            return _Result()

    async def ok(**_):
        return _Result(results=[], requirements=[], verified_facts=[], package_id="pkg",
                       validation_report=_Result(is_sendable=True),
                       disposition=_Result(value="send"), plan_id="rp")

    async def send_fails(**_):
        raise RuntimeError("gmail 500 after accept")

    monkeypatch.setattr(retrieval_router.retrieval_router_service, "route_and_retrieve", ok)
    monkeypatch.setattr(evidence_fusion.evidence_fusion_service, "fuse_and_verify", ok)
    monkeypatch.setattr(evidence_package.evidence_package_service, "build_package", ok)
    monkeypatch.setattr(reply_planner.reply_planner_service, "plan_and_draft_reply", ok)
    monkeypatch.setattr(reply_planner.outbound_delivery_service, "deliver_reply", send_fails)
    monkeypatch.setattr(ai_mod, "_capture_contact_insights", lambda *a, **k: None)

    class _Sess:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False
    monkeypatch.setattr(ai_mod.db_manager, "_session_factory", lambda: _Sess(), raising=False)
    monkeypatch.setattr(type(ai_mod.db_manager), "session_factory", property(lambda self: (lambda: _Sess())))

    asyncio.run(ai_mod.AiWorker().process_event(_plan_event()))  # does not raise -> acknowledged
    assert "ai_worker:lock:t_rt:th_rt:m_rt" in fake_redis.keys  # lock kept: no duplicate attempt


def test_context_resolve_failure_frees_lock_and_reraises(fake_redis, monkeypatch):
    from app.services import context_resolver as cr

    class _Res:
        def scalar_one_or_none(self):
            return None

    class _Sess:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, _model, _id):
            return SimpleNamespace(direction="inbound", external_message_id="ext_m")

        async def execute(self, _stmt):
            return _Res()

    monkeypatch.setattr(type(email_mod.db_manager), "session_factory", property(lambda self: (lambda: _Sess())))

    async def resolve_fails(**_):
        raise TimeoutError("db timeout")
    monkeypatch.setattr(cr.context_resolver, "resolve_context", resolve_fails)

    ev = DomainEvent(event_type="email.context.resolve", tenant_id="t_rt",
                     payload={"account_id": "a", "thread_id": "th_rt", "message_id": "m_rt", "tenant_id": "t_rt"})
    with pytest.raises(TimeoutError):
        asyncio.run(email_mod.EmailWorker().process_event(ev))
    assert "email:context_resolve:t_rt:th_rt:m_rt" in fake_redis.deleted
