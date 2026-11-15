"""Sign-in must not fail because Redis (a session cache only) is unavailable."""

import asyncio

import pytest

from app.api.v1.routes import auth as auth_routes
from app.services import session_cache


class _BrokenRedis:
    async def set(self, *a, **k):
        raise RuntimeError("max requests limit exceeded")


class _SlowRedis:
    async def set(self, *a, **k):
        await asyncio.sleep(10)


class _OkRedis:
    def __init__(self):
        self.keys = []

    async def set(self, key, *a, **k):
        self.keys.append(key)
        return True


class _Mgr:
    def __init__(self, client):
        self.client = client


def _kwargs():
    return dict(jti="j1", session_id="ses_1", user_id="usr_1", expires_at_iso="2099-01-01T00:00:00+00:00", ttl_seconds=60)


def test_cache_session_swallows_redis_errors(monkeypatch):
    monkeypatch.setattr(session_cache, "redis_manager", _Mgr(_BrokenRedis()))
    assert asyncio.run(session_cache.cache_session(**_kwargs())) is False


def test_cache_session_times_out(monkeypatch):
    monkeypatch.setattr(session_cache, "redis_manager", _Mgr(_SlowRedis()))
    monkeypatch.setattr(session_cache, "CACHE_WRITE_TIMEOUT_SECONDS", 0.05)
    assert asyncio.run(session_cache.cache_session(**_kwargs())) is False


def test_cache_session_writes_both_keys(monkeypatch):
    client = _OkRedis()
    monkeypatch.setattr(session_cache, "redis_manager", _Mgr(client))
    assert asyncio.run(session_cache.cache_session(**_kwargs())) is True
    assert sorted(client.keys) == ["session:id:ses_1", "session:j1"]


class _Db:
    def __init__(self):
        self.rolled_back = False

    async def rollback(self):
        self.rolled_back = True


@pytest.mark.parametrize("provider", ["google", "microsoft"])
def test_oauth_callback_never_returns_raw_500(monkeypatch, provider):
    async def boom(**_):
        raise RuntimeError("backend dependency down")

    monkeypatch.setattr(auth_routes, f"_{provider}_callback", boom)
    db = _Db()
    route = getattr(auth_routes, f"{provider}_callback")
    resp = asyncio.run(route(code="abc", error=None, db=db))
    assert resp.status_code == 302
    assert resp.headers["location"].endswith("/signin?error=signin_unavailable")
    assert db.rolled_back
