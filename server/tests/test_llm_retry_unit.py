"""Transient OpenAI failures are retried; request errors are not; exhaustion is a typed error."""

import asyncio
from types import SimpleNamespace

import pytest

from app.services import llm_retry


class _Err(Exception):
    def __init__(self, status):
        super().__init__(f"Error code: {status}")
        self.status_code = status


class _Client:
    def __init__(self, outcomes):
        self.outcomes, self.calls = list(outcomes), 0
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    async def _create(self, **kwargs):
        self.calls += 1
        out = self.outcomes.pop(0)
        if isinstance(out, Exception):
            raise out
        return out


@pytest.fixture(autouse=True)
def _fast(monkeypatch):
    monkeypatch.setattr(llm_retry, "BASE_DELAY_S", 0.0)


def test_a_single_server_error_is_retried_and_succeeds():
    c = _Client([_Err(500), "ok"])
    assert asyncio.run(llm_retry.create_with_retry(c, {}, label="t")) == "ok" and c.calls == 2


@pytest.mark.parametrize("status", [429, 502, 503])
def test_rate_limit_and_gateway_errors_are_retried(status):
    c = _Client([_Err(status), _Err(status), "ok"])
    assert asyncio.run(llm_retry.create_with_retry(c, {}, label="t")) == "ok" and c.calls == 3


def test_persistent_outage_raises_transient_error_after_three_attempts():
    c = _Client([_Err(500)] * 3)
    with pytest.raises(llm_retry.TransientLLMError):
        asyncio.run(llm_retry.create_with_retry(c, {}, label="t"))
    assert c.calls == 3


def test_request_errors_are_not_retried():
    c = _Client([_Err(400), "ok"])
    with pytest.raises(_Err):
        asyncio.run(llm_retry.create_with_retry(c, {}, label="t"))
    assert c.calls == 1
