"""Unit tests for Contact & Relationship Memory (Memory 4) — no network, no database."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import Any, List

import pytest

from app.models.contact import ContactFact
from app.services import contact_memory as cm
from app.services.contact_memory import (
    ContactMemoryService,
    _counterparts,
    _initial_type,
    normalize_email,
)

T = "org_contact_test"


# ---------------------------------------------------------------------------
# Normalisation & counterpart extraction
# ---------------------------------------------------------------------------


def test_normalize_email_handles_display_names_and_rejects_automated_senders():
    assert normalize_email('  "Asha Rao" <Asha.Rao@Acme.IN> ') == "asha.rao@acme.in"
    assert normalize_email("buyer@shop.com") == "buyer@shop.com"
    assert normalize_email("replyall.team@shop.com") == "replyall.team@shop.com"  # no false positive
    for bad in ["no-reply@n.dribbble.com", "noreply@github.com", "mailer-daemon@x.com",
                "googleplay-noreply@google.com", "no.reply@x.com",
                "notifications+abc@x.com", "not-an-email", "", None]:
        assert normalize_email(bad) is None, bad


def test_counterparts_inbound_is_sender_outbound_is_recipients_excluding_self():
    own = ["sales@dolphy.in"]
    assert _counterparts("inbound", "Asha <asha@acme.in>", "Asha", [], [], own) == [("asha@acme.in", "Asha")]
    out = _counterparts("outbound", "sales@dolphy.in", None,
                        ["asha@acme.in", "Sales@Dolphy.in"], ["ravi@acme.in", "asha@acme.in"], own)
    assert out == [("asha@acme.in", None), ("ravi@acme.in", None)]
    assert _counterparts("inbound", "sales@dolphy.in", None, [], [], own) == []  # own address


def test_internal_type_only_for_company_domains_not_free_mail():
    assert _initial_type("ravi@dolphy.in", ["sales@dolphy.in"]) == "internal"
    assert _initial_type("friend@gmail.com", ["owner@gmail.com"]) == "unknown"
    assert _initial_type("asha@acme.in", ["sales@dolphy.in"]) == "unknown"


# ---------------------------------------------------------------------------
# Fact memory: dedupe, supersession, authority
# ---------------------------------------------------------------------------


class FactSession:
    def __init__(self, active: List[ContactFact]):
        self.active = active
        self.added: List[Any] = []

    async def execute(self, stmt, params=None):
        rows = list(self.active)
        return SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: rows))

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        for o in self.added:
            if not getattr(o, "id", None):
                o.id = f"cf_new_{len(self.added)}"


def _fact(key, value, source, ftype="preference", fid="cf_old"):
    return ContactFact(
        id=fid, tenant_id=T, contact_id="ct_1", fact_type=ftype, key=key, value=value,
        value_normalized=cm.normalize_value(value), confidence=0.7, source_type=source,
        status="active", observed_at=datetime.now(timezone.utc) - timedelta(days=3), occurrences=1,
    )


async def test_same_value_is_reinforced_not_duplicated():
    old = _fact("preferred_language", "Hindi", "ai_inference")
    db = FactSession([old])
    res = await ContactMemoryService().upsert_fact(
        db, T, "ct_1", "preference", "preferred_language", "  hindi ", "email", 0.9, "msg_1")
    assert res is old and not db.added
    assert old.occurrences == 2 and old.confidence == 0.9
    assert old.source_type == "email"  # upgraded to the more authoritative source


async def test_new_value_supersedes_old_for_single_valued_key_keeping_history():
    old = _fact("preferred_language", "Hindi", "email")
    db = FactSession([old])
    new = await ContactMemoryService().upsert_fact(
        db, T, "ct_1", "preference", "preferred_language", "English", "employee", 1.0, "usr_1", "usr_1")
    assert new is not None and new.status == "active" and new.value == "English"
    assert old.status == "superseded" and old.superseded_by_id == new.id


async def test_ai_cannot_override_employee_confirmed_fact():
    held = _fact("preferred_language", "English", "employee")
    db = FactSession([held])
    res = await ContactMemoryService().upsert_fact(
        db, T, "ct_1", "preference", "preferred_language", "Hindi", "ai_inference", 0.8, "msg_9")
    assert res is None and not db.added and held.status == "active"


async def test_interests_accumulate_as_multi_valued_facts():
    old = _fact("product_interest", "Grab Bar", "ai_inference", ftype="interest")
    db = FactSession([old])
    new = await ContactMemoryService().upsert_fact(
        db, T, "ct_1", "interest", "product_interest", "Soap Dispenser", "ai_inference", 0.7, "msg_2")
    assert new is not None and old.status == "active"  # both remain active


async def test_invalid_fact_type_and_source_are_rejected():
    db = FactSession([])
    with pytest.raises(ValueError):
        await ContactMemoryService().upsert_fact(db, T, "ct_1", "gossip", "k", "v", "employee")
    with pytest.raises(ValueError):
        await ContactMemoryService().upsert_fact(db, T, "ct_1", "note", "k", "v", "rumour")


# ---------------------------------------------------------------------------
# Recall: prompt context
# ---------------------------------------------------------------------------


def _profile(**over):
    p = {
        "email": "asha@acme.in", "display_name": "Asha Rao", "contact_type": "customer",
        "company_name": "Acme Hotels", "job_title": "Procurement Head", "preferred_language": "Hindi",
        "is_blocked": False,
        "stats": {"inbound_count": 9, "outbound_count": 6, "thread_count": 4,
                  "first_interaction_at": "2026-02-01T10:00:00+00:00"},
        "facts": {
            "interest": [{"key": "product_interest", "value": "304 SS Grab Bar"}],
            "issue": [{"key": "complaint", "value": "Late delivery on order #4411"}],
            "note": [{"key": "note", "value": "Prefers quotes as PDF"}],
            "preference": [{"key": "payment_terms", "value": "30 days credit"}],
        },
    }
    p.update(over)
    return p


def test_prompt_context_is_compact_and_grounded():
    ctx = ContactMemoryService.format_prompt_context(_profile())
    assert "Asha Rao" in ctx and "Acme Hotels" in ctx and "customer" in ctx
    assert "15 emails exchanged across 4 conversations since 2026-02-01" in ctx
    assert "Preferred language: Hindi" in ctx
    assert "304 SS Grab Bar" in ctx and "Late delivery" in ctx and "payment terms: 30 days credit" in ctx
    assert len(ctx) <= cm.PROMPT_CONTEXT_MAX_CHARS


def test_prompt_context_marks_first_time_contacts_and_is_bounded():
    first = ContactMemoryService.format_prompt_context(
        _profile(stats={"inbound_count": 1, "outbound_count": 0, "thread_count": 1}, facts={})
    )
    assert "first-time contact" in first
    huge = _profile(facts={"note": [{"key": "note", "value": "x" * 3000}] * 5})
    assert len(ContactMemoryService.format_prompt_context(huge)) <= cm.PROMPT_CONTEXT_MAX_CHARS


async def test_prompt_context_never_raises_when_db_is_down(monkeypatch):
    def broken():
        raise ConnectionError("db down")

    monkeypatch.setattr(cm, "db_manager", SimpleNamespace(session_factory=broken))
    assert await ContactMemoryService().build_prompt_context(T, "msg_1") is None


async def test_interaction_capture_never_raises_on_db_failure(monkeypatch):
    class Boom:
        async def __aenter__(self):
            raise ConnectionError("db down")

        async def __aexit__(self, *a):
            return False

    monkeypatch.setattr(cm, "db_manager", SimpleNamespace(session_factory=lambda: Boom()))
    n = await ContactMemoryService().record_message_interaction(
        T, "inbound", "asha@acme.in", "Asha", [], [], datetime.now(timezone.utc), ["sales@dolphy.in"])
    assert n == 0


async def test_interaction_capture_builds_single_idempotent_upsert():
    captured = []

    class DB:
        async def execute(self, stmt, params=None):
            captured.append(stmt)

    n = await ContactMemoryService().record_message_interaction(
        T, "outbound", "sales@dolphy.in", None, ["asha@acme.in", "ravi@dolphy.in"], [],
        datetime.now(timezone.utc), ["sales@dolphy.in"], db=DB())
    assert n == 2 and len(captured) == 1
    sql = str(captured[0].compile(compile_kwargs={"literal_binds": False}))
    assert "ON CONFLICT ON CONSTRAINT uq_contacts_tenant_email DO UPDATE" in sql
