"""Unit tests for Thread & Conversation Memory (Memory 3) — no network, no database, no LLM."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.services import thread_memory as tm
from app.services.commitment_memory import resolve_timezone
from app.services.thread_memory import (
    MemoryState,
    ThreadMemoryService,
    format_context,
    merge_update,
    messages_after_watermark,
)

T = "org_thread_test"
IST = resolve_timezone("Asia/Kolkata")
NOW = datetime(2026, 11, 12, 6, 0, tzinfo=timezone.utc)


def _prev():
    return MemoryState(
        summary="Asha asked for 50 grab bars for 3 hotels.", stage="enquiry", sentiment="neutral",
        requirements=[
            {"id": "rq_a", "text": "Quotation for 50 SS grab bars", "status": "open", "since": "m1", "resolved_by": None},
            {"id": "rq_b", "text": "Installation manual", "status": "open", "since": "m1", "resolved_by": None},
        ],
        key_facts=["50 units", "600 mm size"],
    )


# ---------------------------------------------------------------------------
# Merge rules
# ---------------------------------------------------------------------------


def test_merge_updates_status_and_adds_new_requirements():
    raw = {"summary": "We quoted Rs 1,450/unit; Asha now asks about delivery to Goa.", "stage": "quoted",
           "sentiment": "positive", "language": "English", "last_customer_ask": "Delivery time to Goa",
           "requirements": [{"id": "rq_a", "text": "Quotation for 50 SS grab bars", "status": "answered"},
                            {"id": "", "text": "Delivery timeline to Goa", "status": "open"}],
           "open_issues": [{"text": "Confirm delivery date", "owner": "company"}],
           "key_facts": ["50 units", "600 mm size", "Quoted Rs 1,450 per unit", "Site: Goa"]}
    s = merge_update(_prev(), raw, "m5")
    by = {r["text"]: r for r in s.requirements}
    assert by["Quotation for 50 SS grab bars"]["status"] == "answered"
    assert by["Quotation for 50 SS grab bars"]["resolved_by"] == "m5"
    new = by["Delivery timeline to Goa"]
    assert new["id"].startswith("rq_") and new["since"] == "m5" and new["status"] == "open"
    assert s.stage == "quoted" and s.sentiment == "positive" and "Site: Goa" in s.key_facts
    assert s.open_issues == [{"text": "Confirm delivery date", "owner": "company"}]


def test_merge_never_loses_a_requirement_the_model_forgot():
    raw = {"summary": "x" * 20, "requirements": [{"id": "rq_a", "text": "Quotation for 50 SS grab bars",
                                                  "status": "answered"}]}
    s = merge_update(_prev(), raw, "m6")
    assert {r["id"] for r in s.requirements} == {"rq_a", "rq_b"}
    assert next(r for r in s.requirements if r["id"] == "rq_b")["status"] == "open"


def test_merge_rejects_invented_ids_bad_enums_and_garbage():
    raw = {"stage": "partying", "sentiment": "ecstatic", "summary": "",
           "requirements": [{"id": "rq_fake", "text": "Installation manual", "status": "answered"},  # same text => match
                            {"id": "", "text": "ok", "status": "open"},                               # too short
                            {"id": "", "text": "Brochure", "status": "maybe"},                         # bad status
                            "junk"],
           "open_issues": [{"text": "Something pending", "owner": "aliens"}], "key_facts": []}
    s = merge_update(_prev(), raw, "m7")
    assert s.stage == "enquiry" and s.sentiment == "neutral" and s.summary.startswith("Asha")  # kept
    manual = next(r for r in s.requirements if r["text"] == "Installation manual")
    assert manual["id"] == "rq_b" and manual["status"] == "answered"   # matched by text, our id kept
    assert len(s.requirements) == 2
    assert s.open_issues[0]["owner"] == "company"
    assert s.key_facts == ["50 units", "600 mm size"]                    # empty list doesn't wipe facts
    assert merge_update(_prev(), "garbage", "m8").summary == _prev().summary


def test_merge_bounds_lists_and_puts_open_first():
    raw = {"summary": "s" * 2000, "requirements": [
        {"id": "", "text": f"Requirement number {i}", "status": "answered" if i % 2 else "open"} for i in range(40)],
        "key_facts": [f"fact {i}" for i in range(40)]}
    s = merge_update(MemoryState(), raw, "m9")
    assert len(s.summary) <= tm.SUMMARY_CHARS and len(s.key_facts) == tm.MAX_FACTS
    assert len(s.requirements) <= tm.MAX_REQUIREMENTS
    statuses = [r["status"] for r in s.requirements]
    assert statuses == sorted(statuses, key=lambda x: x != "open")


# ---------------------------------------------------------------------------
# Watermark
# ---------------------------------------------------------------------------


def _msgs(n):
    return [{"id": f"m{i}", "direction": "inbound" if i % 2 == 0 else "outbound", "body_text": f"message {i} body",
             "sent_at": NOW - timedelta(hours=n - i), "from_email": "a@b.com"} for i in range(n)]


def test_watermark_by_id_then_time_fallback():
    msgs = _msgs(6)
    assert [m["id"] for m in messages_after_watermark(msgs, "m3", None)] == ["m4", "m5"]
    assert messages_after_watermark(msgs, "m5", None) == []
    assert len(messages_after_watermark(msgs, None, None)) == 6
    assert [m["id"] for m in messages_after_watermark(msgs, "gone", msgs[3]["sent_at"])] == ["m4", "m5"]


# ---------------------------------------------------------------------------
# Recall formatting
# ---------------------------------------------------------------------------


def _row(state: MemoryState, notes=None):
    return {"summary": state.summary, "stage": state.stage, "sentiment": state.sentiment, "language": None,
            "last_customer_ask": None, "customer_requirements": json.dumps(state.requirements),
            "open_issues": json.dumps(state.open_issues), "key_facts": json.dumps(state.key_facts),
            "pinned_notes": notes}


def test_context_has_notes_first_requirements_and_recent_turns():
    s = _prev()
    s.requirements[1]["status"] = "answered"
    recent = [{"direction": "inbound", "body_text": "Can you deliver by Friday?\n\nOn Mon X wrote:\n> QUOTEDTEXT",
               "sent_at": NOW}]
    ctx = format_context(_row(s, notes="VIP hotel chain — CEO handles pricing"), recent, IST)
    assert ctx.startswith("Team notes (pinned by employees): VIP hotel chain")
    assert "Open customer requirements:\n  - Quotation for 50 SS grab bars" in ctx
    assert "Already answered (do not repeat unless asked): Installation manual" in ctx
    assert "[Customer, 12 Nov 11:30] Can you deliver by Friday?" in ctx and "QUOTEDTEXT" not in ctx
    assert "stage: enquiry" in ctx


def test_context_without_memory_still_shows_recent_and_is_bounded():
    recent = [{"direction": "outbound", "body_text": "Kindly find the quotation attached.", "sent_at": NOW}]
    assert "[Us," in format_context(None, recent, IST)
    assert format_context(None, [], IST) is None
    huge = MemoryState(summary="x" * 900, requirements=[{"id": f"r{i}", "text": "y" * 300, "status": "open"}
                                                       for i in range(15)], key_facts=["z" * 200] * 15)
    out = format_context(_row(huge, notes="n" * 2000), recent * 4, IST)
    assert len(out) <= tm.CONTEXT_MAX_CHARS and out.startswith("Team notes")


# ---------------------------------------------------------------------------
# Never-raise / scheduling
# ---------------------------------------------------------------------------


async def test_context_and_update_never_raise(monkeypatch):
    def broken():
        raise ConnectionError("db down")

    monkeypatch.setattr(tm, "db_manager", SimpleNamespace(session_factory=broken))

    async def llm(_m):
        return {}

    svc = ThreadMemoryService(llm=llm)
    assert await svc.build_prompt_context(T, "m1") is None
    assert (await svc.update_thread(T, "th1"))["status"] == "error"


def test_scheduling_skips_old_mail():
    async def llm(_m):
        return {}

    svc = ThreadMemoryService(llm=llm)
    assert svc.schedule_update(T, "th", datetime.now(timezone.utc) - timedelta(days=60)) is False
