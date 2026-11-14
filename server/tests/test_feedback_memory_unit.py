"""Unit tests for Feedback & Outcome Memory (Memory 7) — no network, no database."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.services import feedback_memory as fm
from app.services.feedback_memory import (
    FeedbackMemoryService,
    classify_edit,
    classify_outcome,
    derive_lesson_candidates,
    format_guidance,
    intent_from_response,
    length_ratio,
    primary_intent,
    strip_quoted,
    text_similarity,
)

T = "org_feedback_test"
DRAFT = (
    "Hi Asha,\n\nThank you for your enquiry. The 304 SS Grab Bar (600 mm) is priced at Rs 1,450 "
    "per piece and is in stock. Delivery takes 5-7 working days.\n\nBest regards,\nDolphy Sales"
)


# ---------------------------------------------------------------------------
# Edit-diff analysis
# ---------------------------------------------------------------------------


def test_strip_quoted_keeps_only_new_text():
    body = "Sounds good, please proceed.\n\nOn Mon, 10 Nov 2026 at 10:00, Sales <s@x.in> wrote:\n> old text\n> more"
    assert strip_quoted(body) == "Sounds good, please proceed."
    assert strip_quoted("> only quoted\n> lines") == ""
    assert strip_quoted(None) == ""


def test_similarity_ignores_formatting_and_detects_edits():
    assert text_similarity(DRAFT, DRAFT.replace("\n", " ").upper()) == 1.0
    lightly = DRAFT.replace("5-7 working days", "3-5 working days")
    assert classify_edit(text_similarity(DRAFT, lightly)) == "approved"
    edited = DRAFT.replace("Thank you for your enquiry.", "Thanks for reaching out! We would love to help.") \
                  .replace("Delivery takes 5-7 working days.", "We can also offer a 10% bulk discount above 50 units.")
    assert classify_edit(text_similarity(DRAFT, edited)) == "edited"
    replaced = "Hello, please call our office at your convenience to discuss your project requirements."
    assert classify_edit(text_similarity(DRAFT, replaced)) == "replaced_by_human"
    assert text_similarity("", "") == 1.0 and text_similarity("x", "") == 0.0


def test_length_ratio():
    assert length_ratio("one two three four", "one two") == 0.5
    assert length_ratio("", "anything") is None


# ---------------------------------------------------------------------------
# Outcome classification
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("text,expected", [
    ("Thanks a lot, please send the quotation", "positive"),
    ("We will order 20 pcs, please proceed.", "positive"),
    ("Thank you, very helpful!", "positive"),
    ("Can you share the price for the 900 mm version?", "follow_up_question"),
    ("This is wrong, not what I asked. Very disappointed.", "negative"),
    ("Thanks, but the price you quoted is incorrect.", "negative"),
    ("Not interested.", "negative"),
    ("ok", "neutral"),
    ("", "neutral"),
])
def test_outcome_classification(text, expected):
    outcome, confidence, _ = classify_outcome(text)
    assert outcome == expected, (text, outcome)
    assert 0.0 < confidence <= 0.95


def test_outcome_ignores_quoted_history():
    body = "Great, thanks!\n\nOn Tue, Sales wrote:\n> Sorry this is wrong and we apologise"
    assert classify_outcome(body)[0] == "positive"


# ---------------------------------------------------------------------------
# Learning: derived lessons
# ---------------------------------------------------------------------------


def test_recurring_rejection_reason_becomes_lesson():
    rows = [("rejected", "too_long", None)] * 3 + [("approved", None, 1.0)] * 5
    out = derive_lesson_candidates(rows)
    assert "reason:too_long" in out and out["reason:too_long"][1] == 3


def test_rare_reason_is_not_a_lesson():
    rows = [("rejected", "too_long", None)] * 3 + [("approved", None, 1.0)] * 20  # 13% share
    assert "reason:too_long" not in derive_lesson_candidates(rows)
    assert derive_lesson_candidates([]) == {}


def test_consistent_trimming_becomes_length_lesson():
    rows = [("edited", None, 0.55)] * 5 + [("approved", None, 1.0)] * 2
    out = derive_lesson_candidates(rows)
    assert "length:shorter" in out and "55%" in out["length:shorter"][0]
    assert "length:shorter" not in derive_lesson_candidates([("edited", None, 0.55)] * 4)


# ---------------------------------------------------------------------------
# Recall
# ---------------------------------------------------------------------------


def test_guidance_is_bounded_and_labelled():
    g = format_guidance(["Keep replies short."], ["Hi, thanks for asking. " * 100])
    assert g.startswith("TEAM LESSONS") and "APPROVED REPLY EXAMPLES" in g
    assert len(g) <= fm.GUIDANCE_MAX_CHARS
    assert format_guidance([], []) is None


def test_intent_helpers():
    pkg = SimpleNamespace(requirements=[SimpleNamespace(intent=""), SimpleNamespace(intent="product_lookup")])
    assert primary_intent(pkg) == "product_lookup"
    assert primary_intent(SimpleNamespace(requirements=[])) is None
    assert intent_from_response(SimpleNamespace(generation_instructions='{"intent": "pricing"}')) == "pricing"
    assert intent_from_response(SimpleNamespace(generation_instructions="not json")) is None


async def test_guidance_never_raises_and_serves_stale_on_error(monkeypatch):
    svc = FeedbackMemoryService()

    async def ok(tenant_id, intent):
        return "TEAM LESSONS:\n- be brief"

    async def boom(tenant_id, intent):
        raise ConnectionError("db down")

    monkeypatch.setattr(svc, "_load_guidance", ok)
    assert await svc.build_prompt_guidance(T, "x") == "TEAM LESSONS:\n- be brief"
    monkeypatch.setattr(svc, "_load_guidance", boom)
    monkeypatch.setattr(fm, "GUIDANCE_CACHE_TTL_SECONDS", 0.0)
    assert await svc.build_prompt_guidance(T, "x") == "TEAM LESSONS:\n- be brief"  # stale-on-error
    svc.invalidate(T)
    assert await svc.build_prompt_guidance(T, "x") is None


async def test_capture_paths_never_raise(monkeypatch):
    def broken():
        raise ConnectionError("db down")

    monkeypatch.setattr(fm, "db_manager", SimpleNamespace(session_factory=broken))
    svc = FeedbackMemoryService()
    assert await svc.capture_human_outbound(T, "th", "m", "ext", "hi", None) is None
    assert await svc.capture_outcome(T, "th", "m", "thanks", None) is None
    assert await svc.refresh_derived_lessons(T) == 0


# ---------------------------------------------------------------------------
# Explicit review validation (no DB reached)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("kwargs,msg", [
    ({"action": "sent"}, "action must be"),
    ({"action": "rejected"}, "reason_code or comment"),
    ({"action": "edited", "final_text": "  "}, "final_text is required"),
    ({"action": "rejected", "reason_code": "bad_vibes"}, "invalid reason_code"),
])
async def test_review_validation(kwargs, msg):
    with pytest.raises(ValueError, match=msg):
        await FeedbackMemoryService().review_draft(None, T, "ares_1", reviewer_user_id="usr_1", **kwargs)
