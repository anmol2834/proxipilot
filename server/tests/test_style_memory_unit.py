"""Unit tests for Communication Style Memory (Memory 2) — no network, no database, no LLM."""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from app.services import style_memory as sm
from app.services.style_memory import (
    StyleMemoryService,
    aggregate,
    classify_situation,
    compose_context,
    format_style_context,
    greeting_template,
    merge_overrides,
    parse_email,
    validate_guide,
)

T = "org_style_test"


def email(greeting="Dear Mr. Sharma,", body=None, sign="Thanks & Regards,",
          sig="Ravi Kumar\nSales Manager | Dolphy India\n+91 98xxxxxx10", quoted=True):
    body = body or ("Kindly find attached the quotation for the 304 SS grab bars as requested.\n\n"
                    "Please find the delivery schedule below and do let us know if you need any changes.")
    parts = [greeting, "", body, "", sign, sig]
    if quoted:
        parts += ["", "On Mon, 10 Nov 2026 at 10:00, Buyer <b@x.com> wrote:", "> old question"]
    return "\n".join(p for p in parts if p is not None)


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("line,expected", [
    ("Dear Mr. Sharma,", "Dear {name},"),
    ("Hi Asha,", "Hi {name},"),
    ("Dear Sir,", "Dear Sir,"),
    ("Dear Sir/Madam,", "Dear Sir/Madam,"),
    ("Hello Team,", "Hello Team,"),
    ("Hello,", "Hello,"),
    ("Respected Sharma ji,", "Respected {name} ji,"),
    ("Good morning Priya,", "Good morning {name},"),
    ("Thanks for your order and here is a long sentence", None),
    ("Hi there team members of the very big company,", None),
])
def test_greeting_templates(line, expected):
    assert greeting_template(line) == expected


def test_parse_email_extracts_structure_and_ignores_quotes():
    s = parse_email(email())
    assert s.greeting == "Dear {name}," and s.sign_off == "Thanks & Regards,"
    assert s.signature.startswith("Ravi Kumar\nSales Manager")
    assert "old question" not in s.core and "Ravi Kumar" not in s.core
    assert s.language == "english" and s.formal_hits >= 3 and s.paragraphs == 2
    assert s.situation in ("quotation", "delivery")


def test_parse_email_gmail_signature_delimiter():
    s = parse_email("Hi Asha,\n\nWe have dispatched your order today via Blue Dart courier.\n--\nRavi | Dolphy")
    assert s.sign_off is None and s.signature == "Ravi | Dolphy" and "Ravi" not in s.core


def test_parse_email_skips_unusable():
    assert parse_email("") is None
    assert parse_email("Ok.") is None
    assert parse_email("---------- Forwarded message ---------\nFrom: x") is None
    assert parse_email("Automatic reply: I am out of office until Monday and will reply then.") is None


def test_language_detection():
    assert parse_email("Namaste Sharma ji,\n\nAapka order kal tak bhej denge, kripya thoda wait kijiye.").language == "hinglish"
    assert parse_email("नमस्ते,\n\nआपका ऑर्डर कल तक भेज दिया जाएगा। कृपया प्रतीक्षा करें।").language == "hindi"


def test_situations():
    assert classify_situation("Sorry for the inconvenience caused by the damaged item") == "complaint"
    assert classify_situation("Please find the proforma and our best price") == "quotation"
    assert classify_situation("Just a gentle reminder on our last mail") == "follow_up"
    assert classify_situation("Have a nice day") == "other"


# ---------------------------------------------------------------------------
# Aggregation
# ---------------------------------------------------------------------------


def _samples(n=8):
    out = [parse_email(email()) for _ in range(n - 2)]
    out.append(parse_email(email(greeting="Hi Asha,", sign="Regards,")))
    out.append(parse_email(email(greeting=None, sig="Ravi")))
    return out


def test_aggregate_finds_dominant_habits():
    stats = aggregate(_samples())
    assert stats["sample_count"] == 8
    assert stats["greeting"] == "Dear {name}," and stats["greeting_share"] == 0.75
    assert stats["sign_off"] == "Thanks & Regards," and "signature" not in stats  # no signature feature
    assert stats["formality"] == "formal" and stats["language"] == "english"
    assert stats["emoji_rate"] == 0 and stats["exclamation_rate"] == 0
    assert "let us know" in stats["phrases"]
    assert not any(p.split()[0] in sm._STOP or p.split()[-1] in sm._STOP for p in stats["phrases"])
    assert not any("ravi" in p for p in stats["phrases"])  # signature text is never a "phrase"


def test_aggregate_without_clear_habit_reports_none():
    mixed = [parse_email(email(greeting=g, sign=s)) for g, s in
             [("Hi A,", "Regards,"), ("Hello,", "Best,"), ("Dear Sir,", "Cheers,"), ("Hey B,", "Thanks,")]]
    stats = aggregate(mixed)
    assert stats["greeting"] is None and stats["sign_off"] is None
    assert aggregate([]) == {"sample_count": 0}


def test_employee_overrides_win():
    merged = merge_overrides({"greeting": "Hi {name},", "median_words": 80},
                             {"greeting": "Dear {name},", "max_words": 120, "evil": "x", "sign_off": ""})
    assert merged["greeting"] == "Dear {name}," and merged["greeting_source"] == "employee"
    assert merged["max_words"] == 120 and "evil" not in merged and "sign_off" not in merged


# ---------------------------------------------------------------------------
# Context composition
# ---------------------------------------------------------------------------


def test_style_context_is_complete_and_bounded():
    stats = aggregate(_samples())
    ctx = format_style_context(stats, {"tone": "Warm but formal.", "situational": [
        {"situation": "a customer complains", "practice": "apologise once and give a concrete date"}]},
        "Always mention GST is extra\nNever promise same-day dispatch", "company")
    assert "Greeting: \"Dear {name},\"" in ctx
    # The closing is composed by the server (reply_planner/closing.py), never asked of the model.
    assert "Sign-off" not in ctx and "Signature" not in ctx and "register: formal" in ctx and "Avoid: emojis, exclamation marks" in ctx
    assert "When a customer complains: apologise once" in ctx and "• Always mention GST is extra" in ctx
    assert len(ctx) <= sm.CONTEXT_MAX_CHARS
    huge = format_style_context({"greeting": "x" * 2000}, None, "y" * 3000, "company")
    assert len(huge) <= sm.CONTEXT_MAX_CHARS
    assert format_style_context({}, None, None, "company") is None


def test_employee_rules_survive_the_size_cap():
    many_rules = {"tone": "t" * 200, "situational": [
        {"situation": f"situation {i}", "practice": "p" * 190} for i in range(6)]}
    ctx = format_style_context(aggregate(_samples()), many_rules, "Always mention that GST is extra", "company")
    assert "GST is extra" in ctx and len(ctx) <= sm.CONTEXT_MAX_CHARS
    assert ctx.splitlines()[-1].endswith("p" * 190)  # whole lines only, never cut mid-sentence


def test_phrases_do_not_overlap_and_are_deterministic():
    stats = aggregate(_samples())
    phrases = stats["phrases"]
    for i, a in enumerate(phrases):
        for b in phrases[i + 1:]:
            assert len(set(a.split()) & set(b.split())) < 2, (a, b)
    assert aggregate(_samples())["phrases"] == phrases


def _row(scope, status="active", stats=None, overrides=None, guide=None, n=12):
    return {"scope": scope, "scope_key": "*" if scope == "company" else "ravi@dolphy.in", "status": status,
            "stats": json.dumps(stats or {}), "learned_guide": None, "overrides": json.dumps(overrides or {}),
            "employee_guide": guide, "sample_count": n}


def test_compose_prefers_active_sender_and_merges_employee_settings():
    company = _row("company", stats={"greeting": "Dear {name},"}, overrides={"max_words": 150}, guide="Mention GST")
    sender = _row("sender", stats={"greeting": "Hi {name},"}, overrides={"sign_off": "Cheers,"})
    ctx = compose_context([company, sender])
    assert "this mailbox's own sent emails" in ctx and "Hi {name}," in ctx
    assert "Cheers," not in ctx and "at most 150 words" in ctx and "Mention GST" in ctx
    assert sm.resolve_style([company, sender])[0]["sign_off"] == "Cheers,"  # used by the closing
    ctx2 = compose_context([company, _row("sender", status="insufficient_data", stats={"greeting": "Yo {name}"})])
    assert "the company's sent emails" in ctx2 and "Dear {name}," in ctx2 and "Yo" not in ctx2


def test_compose_with_only_employee_settings_and_nothing():
    rows = [_row("company", status="insufficient_data", overrides={"sign_off": "Warm regards,", "max_words": 90}, n=0)]
    ctx = compose_context(rows)
    assert "employee-defined style settings" in ctx and "at most 90 words" in ctx and "Warm regards," not in ctx
    assert sm.resolve_style(rows)[0]["sign_off"] == "Warm regards,"
    assert compose_context([]) is None
    assert compose_context([_row("company", status="insufficient_data", n=1)]) is None


# ---------------------------------------------------------------------------
# Guide validation & safety
# ---------------------------------------------------------------------------


def test_guide_validation_strips_pii_and_bounds():
    g = validate_guide({"tone": "Warm and formal.", "situational": [
        {"situation": "complaints", "practice": "Apologise once, then give a firm date."},
        {"situation": "pricing", "practice": "Quote ₹1,450 per piece always"},          # price => dropped
        {"situation": "contact", "practice": "Ask them to call +91 98765 43210 now"},  # phone => dropped
        {"situation": "x", "practice": "short"},
    ] + [{"situation": f"s{i}", "practice": "Confirm next steps clearly."} for i in range(10)]})
    assert g["tone"] == "Warm and formal."
    assert [r["situation"] for r in g["situational"]][:1] == ["complaints"] and len(g["situational"]) <= 6
    assert all("₹" not in r["practice"] and "98765" not in r["practice"] for r in g["situational"])
    assert validate_guide("nope") is None and validate_guide({"tone": "", "situational": []}) is None


async def test_context_never_raises(monkeypatch):
    def broken():
        raise ConnectionError("db down")

    monkeypatch.setattr(sm, "db_manager", SimpleNamespace(session_factory=broken))
    assert await StyleMemoryService().build_prompt_context(T, "msg_1") is None
    assert await StyleMemoryService().refresh_stale() == 0
