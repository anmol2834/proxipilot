"""Unit tests for Decision & Commitment Memory (Memory 6) — no network, no database, no LLM."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.services import commitment_memory as cmm
from app.services.commitment_memory import (
    CommitmentMemoryService,
    format_prompt_context,
    has_commitment_cues,
    parse_due,
    resolve_timezone,
    statement_key,
    statement_similarity,
    validate_extraction,
)

T = "org_commit_test"
IST = resolve_timezone("Asia/Kolkata")
# Wednesday 12 Nov 2026, 10:00 IST
SENT = datetime(2026, 11, 12, 4, 30, tzinfo=timezone.utc)


def _item(**over):
    it = {"kind": "commitment", "owed_by": "company", "category": "quote",
          "statement": "Send revised quotation for 50 SS grab bars", "due_date": "2026-11-14",
          "due_text": "by Friday", "approved_by": "", "confidence": 0.9}
    it.update(over)
    return it


# ---------------------------------------------------------------------------
# Pre-filter, keys, time zones, deadlines
# ---------------------------------------------------------------------------


def test_cue_prefilter():
    assert has_commitment_cues("I will send the quotation by Friday.")
    assert has_commitment_cues("Please find attached the proforma invoice.")
    assert has_commitment_cues("10% discount approved for this order.")
    assert has_commitment_cues("kal tak bhej denge")
    assert not has_commitment_cues("Hi, hope you are doing well. Regards, Asha")


def test_statement_key_and_similarity():
    assert statement_key("  Send the Quote, by FRIDAY! ") == "send the quote by friday"
    assert statement_similarity("Send revised quotation for 50 grab bars",
                                "Send the revised quotation for 50 grab bars") >= cmm.DEDUPE_SIMILARITY
    assert statement_similarity("Send revised quotation", "Arrange a site visit next week") < 0.5


def test_timezone_fallbacks():
    assert resolve_timezone("Europe/London").key == "Europe/London"
    assert resolve_timezone("Not/AZone").key == cmm.DEFAULT_BUSINESS_TIMEZONE
    assert resolve_timezone(None).key == cmm.DEFAULT_BUSINESS_TIMEZONE


def test_due_dates_are_business_local_and_bounded():
    due = parse_due("2026-11-14", SENT, IST)  # date only => 18:00 local
    assert due == datetime(2026, 11, 14, 12, 30, tzinfo=timezone.utc)
    assert parse_due("2026-11-13T11:00", SENT, IST) == datetime(2026, 11, 13, 5, 30, tzinfo=timezone.utc)
    assert parse_due("2025-01-01", SENT, IST) is None          # before the email
    assert parse_due("2030-01-01", SENT, IST) is None          # absurd horizon
    assert parse_due("next friday", SENT, IST) is None         # not ISO
    assert parse_due("", SENT, IST) is None
    assert parse_due("2026-02-30", SENT, IST) is None          # invalid calendar date


# ---------------------------------------------------------------------------
# Validation of untrusted model output
# ---------------------------------------------------------------------------


def test_validation_accepts_good_items_and_types_them():
    res = validate_extraction({"items": [_item()], "resolutions": []}, set(), SENT, IST)
    assert len(res.items) == 1
    it = res.items[0]
    assert it.kind == "commitment" and it.owed_by == "company" and it.category == "quote"
    assert it.due_at == datetime(2026, 11, 14, 12, 30, tzinfo=timezone.utc) and it.due_text == "by Friday"
    assert it.approved_by is None  # only decisions carry an approver


def test_validation_rejects_bad_enum_low_confidence_short_and_duplicates():
    raw = {"items": [
        _item(kind="gossip"), _item(owed_by="martians"), _item(confidence=0.3), _item(statement="ok"),
        _item(), _item(statement="send REVISED quotation for 50 SS grab-bars"),  # duplicate key
        _item(category="unknown_cat", statement="Share installation manual for hand dryer"),
    ], "resolutions": []}
    res = validate_extraction(raw, set(), SENT, IST)
    assert [i.statement for i in res.items] == ["Send revised quotation for 50 SS grab bars",
                                               "Share installation manual for hand dryer"]
    assert res.items[1].category == "other" and res.rejected == 4


def test_validation_caps_items_and_handles_garbage():
    many = {"items": [_item(statement=f"Send document number {i} to the buyer") for i in range(20)]}
    assert len(validate_extraction(many, set(), SENT, IST).items) == cmm.MAX_ITEMS_PER_EMAIL
    assert validate_extraction("not a dict", set(), SENT, IST).items == []
    assert validate_extraction({"items": ["x", None]}, set(), SENT, IST).rejected == 2


def test_resolutions_only_for_supplied_open_ids():
    raw = {"items": [], "resolutions": [
        {"id": "cm_open1", "status": "fulfilled", "note": "quotation attached"},
        {"id": "cm_invented", "status": "fulfilled", "note": "hallucinated"},
        {"id": "cm_open2", "status": "reopened", "note": "bad status"},
        {"id": "cm_open1", "status": "cancelled", "note": "duplicate"},
    ]}
    res = validate_extraction(raw, {"cm_open1", "cm_open2"}, SENT, IST)
    assert res.resolutions == [("cm_open1", "fulfilled", "quotation attached")]
    assert res.rejected == 3


def test_decision_keeps_approver():
    res = validate_extraction({"items": [_item(kind="decision", owed_by="internal", category="discount",
                                               statement="10% discount approved for orders above 50 units",
                                               approved_by="Ravi Sharma", due_date="")]}, set(), SENT, IST)
    assert res.items[0].approved_by == "Ravi Sharma" and res.items[0].due_at is None


# ---------------------------------------------------------------------------
# Recall formatting
# ---------------------------------------------------------------------------


def test_prompt_context_labels_and_overdue():
    now = datetime(2026, 11, 16, 6, 0, tzinfo=timezone.utc)
    rows = [
        {"kind": "commitment", "owed_by": "company", "statement": "Send revised quotation",
         "approved_by": None, "due_at": datetime(2026, 11, 14, 12, 30, tzinfo=timezone.utc)},
        {"kind": "commitment", "owed_by": "customer", "statement": "Share purchase order",
         "approved_by": None, "due_at": now + timedelta(days=2)},
        {"kind": "decision", "owed_by": "internal", "statement": "10% discount approved for 50+ units",
         "approved_by": "Ravi", "due_at": None},
    ]
    ctx = format_prompt_context(rows, now, IST)
    assert "[WE PROMISED] Send revised quotation — due Sat 14 Nov 2026, OVERDUE by 1 day" in ctx
    assert "[CUSTOMER PROMISED] Share purchase order — due" in ctx and "OVERDUE" not in ctx.splitlines()[1]
    assert "[DECISION IN FORCE] 10% discount approved for 50+ units (approved by Ravi)" in ctx
    assert format_prompt_context([], now, IST) is None
    huge = [dict(rows[0], statement="x" * 400)] * 30
    assert len(format_prompt_context(huge, now, IST)) <= cmm.PROMPT_CONTEXT_MAX_CHARS


# ---------------------------------------------------------------------------
# Never-raise guarantees and scheduling rules
# ---------------------------------------------------------------------------


async def test_extraction_and_recall_never_raise(monkeypatch):
    def broken():
        raise ConnectionError("db down")

    monkeypatch.setattr(cmm, "db_manager", SimpleNamespace(session_factory=broken))

    async def llm(_messages):
        return {"items": [], "resolutions": []}

    svc = CommitmentMemoryService(llm=llm)
    assert (await svc.extract_from_message(T, "msg_1"))["status"] == "error"
    assert await svc.build_prompt_context(T, "msg_1") is None


async def test_scheduling_skips_old_mail_and_disabled_llm(monkeypatch):
    async def llm(_messages):
        return {"items": [], "resolutions": []}

    svc = CommitmentMemoryService(llm=llm)
    calls = []

    async def fake_extract(tenant_id, message_id):
        calls.append(message_id)
        return {}

    monkeypatch.setattr(svc, "extract_from_message", fake_extract)
    assert svc.schedule_extraction(T, "old", datetime.now(timezone.utc) - timedelta(days=60)) is False
    assert svc.schedule_extraction(T, "new", datetime.now(timezone.utc)) is True
    for task in list(cmm._BACKGROUND):
        await task
    assert calls == ["new"]

    disabled = CommitmentMemoryService()
    monkeypatch.setattr(disabled._default_llm._settings, "openai_api_key", "")
    assert disabled.schedule_extraction(T, "x", datetime.now(timezone.utc)) is False


def test_owner_resolution():
    company = cmm.ExtractedItem("commitment", "company", "quote", "Send quote now", None, None, None, 0.9)
    customer = cmm.ExtractedItem("commitment", "customer", "order", "Share PO by Monday", None, None, None, 0.9)
    own = CommitmentMemoryService._owner_email
    assert own(company, True, "ravi@dolphy.in", "sales@dolphy.in", "asha@acme.in") == "ravi@dolphy.in"
    assert own(company, False, "asha@acme.in", "sales@dolphy.in", "asha@acme.in") == "sales@dolphy.in"
    assert own(customer, False, "asha@acme.in", "sales@dolphy.in", "asha@acme.in") == "asha@acme.in"
