"""Unit tests for Organizational Experience Memory (Memory 5) — no network, no database, no LLM."""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from app.services import org_memory as om
from app.services.org_memory import (
    OrgMemoryService,
    PracticeView,
    build_guidance,
    detect_situations,
    format_practices,
    match_practices,
    validate_suggestions,
)

T = "org_practice_test"


def P(pid, title, situation="general", kws=(), rules=(), approval=False, escalate=False, priority=50,
      approver=None, exceptions=None, desc=None):
    return PracticeView.from_row({
        "id": pid, "title": title, "situation": situation, "trigger_keywords": json.dumps(list(kws)),
        "description": desc or f"How we handle {title.lower()}.", "rules": json.dumps(list(rules)),
        "exceptions": exceptions, "requires_approval": approval, "approver": approver,
        "escalate_to_human": escalate, "priority": priority,
    })


PRACTICES = [
    P("op_disc", "Discount requests", "negotiation", kws=["discount", "best price"],
      rules=["Standard bulk discount is 5% above 50 units"], approval=True, approver="Sales Head"),
    P("op_dmg", "Damaged goods", "complaint", rules=["Ask for photos", "Replace within 7 days"],
      exceptions="Glass items are not replaced after 48 hours"),
    P("op_refund", "Refunds", "return_refund", escalate=True),
    P("op_gst", "GST mention", "general", rules=["Prices are exclusive of GST"], priority=30),
    P("op_tone", "Always thank the customer", "general", priority=70),
    P("op_proj", "Hotel projects", "general", kws=["hotel project"], priority=80),
]


# ---------------------------------------------------------------------------
# Situations
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("text,expected", [
    ("The grab bar arrived damaged and the box was broken.", {"complaint"}),
    ("Can you give us your best price for 200 units? Too expensive.", {"negotiation"}),
    ("I want to return it and get a refund.", {"return_refund"}),
    ("When will the dispatch happen? Please share tracking.", {"delivery"}),
    ("Please send the proforma invoice and bank details.", {"payment", "quotation"}),
    ("Hello, how are you?", set()),
])
def test_detect_situations(text, expected):
    assert detect_situations(text) == expected


def test_situations_ignore_quoted_history():
    assert detect_situations("Thanks!\n\nOn Mon, X wrote:\n> the item was damaged") == set()


# ---------------------------------------------------------------------------
# Matching
# ---------------------------------------------------------------------------


def test_keyword_matches_rank_first_and_generals_are_capped():
    ms = match_practices(PRACTICES, "Could you offer a discount? Also the last batch was damaged.")
    ids = [m.practice.id for m in ms]
    assert ids[:2] == ["op_disc", "op_dmg"]             # keyword match before situation match
    assert ids[2:] == ["op_tone", "op_gst"]             # generals by priority, max 2
    assert "op_proj" not in ids                         # keyword-gated general practice not triggered
    assert ms[0].reason == "keyword:discount" and ms[1].reason == "situation:complaint"


def test_keyword_matching_is_whole_word_and_phrase_aware():
    assert not any(m.practice.id == "op_disc" for m in match_practices(PRACTICES, "We are discounting nothing"))
    hit = match_practices(PRACTICES, "This is for a big hotel   project in Goa")
    assert any(m.practice.id == "op_proj" and m.strong for m in hit)


def test_escalation_only_for_strong_matches_needing_approval():
    g = build_guidance(PRACTICES, "Please give a discount for 100 pieces")
    assert [e["id"] for e in g.escalations] == ["op_disc"]
    assert "Discount requests" in g.escalation_reason
    assert build_guidance(PRACTICES, "Please share the catalogue").escalations == []
    assert [e["id"] for e in build_guidance(PRACTICES, "I need a refund now").escalations] == ["op_refund"]


def test_context_is_bounded_and_marks_approvals():
    ctx = format_practices(match_practices(PRACTICES, "best price please, item damaged"))
    assert "Discount requests" in ctx and "Requires internal approval (Sales Head)" in ctx
    assert "do NOT commit" in ctx and "Exceptions: Glass items" in ctx
    big = [P(f"op_{i}", f"Practice {i}", "complaint", desc="x" * 400, rules=["r" * 200] * 6) for i in range(10)]
    assert len(format_practices(match_practices(big, "damaged item"))) <= om.CONTEXT_MAX_CHARS
    huge = [P("op_h", "Huge discount rule", "negotiation", desc="d" * 400, rules=["r" * 200] * 6,
              approval=True, approver="CEO")]
    ctx_h = format_practices(match_practices(huge, "need a discount"))
    assert ctx_h and "Huge discount rule" in ctx_h and "Requires internal approval (CEO)" in ctx_h
    assert len(ctx_h) <= om.CONTEXT_MAX_CHARS
    assert format_practices([]) is None


# ---------------------------------------------------------------------------
# Mining validation
# ---------------------------------------------------------------------------


def _sug(**over):
    s = {"title": "Bulk discount approval", "situation": "negotiation", "trigger_keywords": ["discount", " "],
         "description": "Discounts above 5% on bulk orders are approved by the sales head before quoting.",
         "rules": ["Never offer more than 5% without approval", "ok"], "exceptions": "",
         "requires_approval": True, "approver": "Sales Head", "escalate_to_human": False, "confidence": 0.8,
         "evidence": "3 decisions approved by Sales Head"}
    s.update(over)
    return s


def test_suggestion_validation():
    out = validate_suggestions({"practices": [
        _sug(), _sug(title="bulk DISCOUNT approval!"),                 # duplicate key
        _sug(title="Low", confidence=0.9), _sug(title="Unsure practice", confidence=0.3),
        _sug(title="Bad situation", situation="party"), _sug(title="Existing one"),
    ]}, existing_keys={"existing one"})
    assert [s["title"] for s in out] == ["Bulk discount approval", "Bad situation"]
    assert out[0]["trigger_keywords"] == ["discount"] and out[0]["rules"] == ["Never offer more than 5% without approval"]
    assert out[1]["situation"] == "general" and out[0]["exceptions"] is None
    assert validate_suggestions("garbage", set()) == []


# ---------------------------------------------------------------------------
# Never-raise / safety
# ---------------------------------------------------------------------------


async def test_guidance_never_raises(monkeypatch):
    def broken():
        raise ConnectionError("db down")

    monkeypatch.setattr(om, "db_manager", SimpleNamespace(session_factory=broken))
    g = await OrgMemoryService().get_guidance(T, "msg_1")
    assert g.context is None and g.escalations == []


async def test_mining_needs_enough_history(monkeypatch):
    async def llm(_m):
        raise AssertionError("LLM must not be called without history")

    svc = OrgMemoryService(llm=llm)

    async def evidence(_t):
        return {"decisions": [], "commitment_outcomes": [], "reply_pairs": [], "reviewer_comments": [],
                "existing_practices": [], "_existing_keys": set()}

    monkeypatch.setattr(svc, "_gather_evidence", evidence)
    assert (await svc.mine_practices(T))["status"] == "insufficient_history"
