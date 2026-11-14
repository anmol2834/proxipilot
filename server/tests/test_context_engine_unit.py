"""Unit tests for the Context Intelligence Engine — no network, no database, no LLM."""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace

from app.services import context_engine as ce
from app.services.context_engine import (
    ContextEngine,
    Risk,
    apply_budget,
    check_commitments,
    check_language,
    check_outdated_facts,
    check_price_drift,
    check_sentiment,
    score_confidence,
)

NOW = datetime(2026, 11, 12, 6, 0, tzinfo=timezone.utc)


def fact(title="304 SS Grab Bar 600 mm", attr="price", value=Decimal("1550"), temporal="current",
         verification="VERIFIED", until=None):
    return SimpleNamespace(entity_title=title, entity_id="ent_1", attribute_name=attr, typed_value=value,
                           temporal_status=SimpleNamespace(value=temporal),
                           verification_status=SimpleNamespace(value=verification), effective_until=until)


def package(facts=(), status="VALID"):
    return SimpleNamespace(tenant_id="org_t", message_id="msg_1", package_id="evp_1",
                           package_status=SimpleNamespace(value=status),
                           requirements=[SimpleNamespace(facts=list(facts), intent="product_lookup")])


# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------


def test_outdated_and_conflicting_facts_are_flagged():
    risks = check_outdated_facts([
        fact(), fact(temporal="expired"), fact(verification="CONFLICT_DETECTED"),
        fact(until=(NOW - timedelta(days=1)).isoformat()), fact(until=(NOW + timedelta(days=5)).isoformat()),
    ], NOW)
    assert [r.code for r in risks] == ["OUTDATED_FACT"] * 3 and all(r.severity == "medium" for r in risks)


def test_price_drift_detects_changed_quote_including_decimal_prices():
    stated = ["Quoted price for 304 SS grab bar 600 mm: Rs 1,450 per unit", "Sites: 3 hotels in Goa"]
    risks = check_price_drift([fact()], stated, "Can you share the delivery time?")
    assert len(risks) == 1 and risks[0].code == "PRICE_CHANGED" and risks[0].severity == "medium"
    assert "₹1,450" in risks[0].message and "₹1,550.00" in risks[0].message
    ordering = check_price_drift([fact()], stated, "Great, please go ahead and send the invoice for 80 units")
    assert ordering[0].severity == "high" and ordering[0].escalates


def test_price_drift_no_false_positives():
    same = ["Company quoted Rs 1,550/unit for the 304 SS grab bar 600 mm (Rs 1,24,000 total)."]
    assert check_price_drift([fact()], same, "") == []                     # matching price present
    other = ["Quoted Rs 900 per unit for the automatic hand dryer"]
    assert check_price_drift([fact()], other, "") == []                    # different product
    budget = ["Customer budget for 304 SS grab bar 600 mm project is Rs 50,000"]
    assert check_price_drift([fact()], budget, "") == []                   # not a quote
    assert check_price_drift([], same, "") == []                           # no verified price
    assert check_price_drift([fact(value=True)], same, "") == []           # booleans are not prices


def test_overdue_promise_and_chasing_customer():
    overdue = [{"statement": "Send revised quotation", "due_at": NOW - timedelta(days=2)}]
    r = check_commitments(overdue, "Thanks for the info.", "neutral", NOW)
    assert [x.code for x in r] == ["OVERDUE_PROMISE"]
    r2 = check_commitments(overdue, "Any update? Still waiting for the quote.", "neutral", NOW)
    assert [x.code for x in r2] == ["OVERDUE_PROMISE", "CUSTOMER_CHASING"] and r2[1].escalates
    r3 = check_commitments(overdue, "ok", "negative", NOW)
    assert r3[-1].code == "CUSTOMER_CHASING"
    assert check_commitments([], "Any update?", "negative", NOW) == []


def test_language_and_sentiment():
    assert check_language("English", "Hinglish")[0].instruction.startswith("Reply in Hinglish")
    assert check_language(None, "Hindi")[0].instruction == "Reply in Hindi."
    assert check_language("English", "English") == [] and check_language(None, None) == []
    assert check_sentiment("negative", "issue")[0].severity == "medium"
    assert check_sentiment("positive", "quoted") == []


def test_confidence_scoring():
    assert score_confidence("VALID", [], [])[0] == 1.0
    risks = [Risk("A", "high", "m", "i"), Risk("B", "medium", "m", "i"), Risk("C", "low", "m", "")]
    score, reasons = score_confidence("PARTIAL_EVIDENCE", risks, ["style"])
    assert score == round(1 - 0.15 - 0.3 - 0.1 - 0.02 - 0.05, 2) and len(reasons) == 5
    assert score_confidence("NO_EVIDENCE", risks * 3, ["a", "b"])[0] == 0.0


def test_budget_trims_least_important_first_by_whole_lines():
    sections = {"org": "o" * 3000, "commitments": "c" * 1000, "thread": "t" * 2000,
                "contact": "p" * 800, "feedback": "\n".join(["f" * 100] * 10), "style": "\n".join(["s" * 100] * 20)}
    trimmed = apply_budget(sections, budget=7500)
    assert trimmed[0] == "style" and sections["org"] == "o" * 3000 and sections["thread"] == "t" * 2000
    assert sum(len(v) for v in sections.values() if v) <= 7500
    assert all(set(ln) == {"s"} for ln in (sections["style"] or "").split("\n") if ln)
    assert apply_budget({"org": "x"}, budget=10) == []


# ---------------------------------------------------------------------------
# Assembly
# ---------------------------------------------------------------------------


def _engine(signals=None, fail=(), slow=(), org=None):
    async def make(name, value):
        if name in fail:
            raise ConnectionError(f"{name} down")
        if name in slow:
            await asyncio.sleep(10)
        return value

    fetchers = {
        "contact": lambda p: make("contact", "Asha Rao (customer)"),
        "feedback": lambda p: make("feedback", "TEAM LESSONS: be brief"),
        "commitments": lambda p: make("commitments", "- [WE PROMISED] Send revised quotation"),
        "style": lambda p: make("style", "Greeting: Dear {name},"),
        "org": lambda p: make("org", org or SimpleNamespace(context="- Discounts: approval", situations=["negotiation"],
                                                            escalations=[])),
        "thread": lambda p: make("thread", "Summary so far: ..."),
    }

    async def sig(t, m):
        if "signals" in fail:
            raise ConnectionError("signals down")
        return signals or {}

    return ContextEngine(fetchers=fetchers, signals_loader=sig)


async def test_assemble_happy_path():
    b = await _engine({"body_text": "Thanks!", "sentiment": "positive", "has_thread_memory": True,
                       "unsummarised": 0}).assemble(package([fact()]))
    assert set(k for k, v in b.sections.items() if v) == {"contact", "feedback", "commitments", "style", "org", "thread"}
    assert b.confidence == 1.0 and b.escalations == [] and b.alerts is None and b.failed == []
    assert b.situations == ["negotiation"] and "total" in b.timings_ms


async def test_assemble_connects_dots_and_escalates():
    signals = {"body_text": "Any update? We want to place the order now.", "sentiment": "negative",
               "stage": "negotiating", "thread_language": "Hinglish", "contact_language": "English",
               "key_facts": ["Quoted price for 304 SS grab bar 600 mm: Rs 1,450 per unit"],
               "overdue": [{"statement": "Send revised quotation for 80 units", "due_at": NOW.isoformat()}],
               "open_statements": [], "has_thread_memory": True, "unsummarised": 5,
               "thread_summary": "Customer wants 80 units. Company quoted Rs 1,450 per unit for the 304 SS grab bar 600 mm."}
    b = await _engine(signals).assemble(package([fact()]))
    codes = {r.code for r in b.risks}
    assert {"PRICE_CHANGED", "OVERDUE_PROMISE", "CUSTOMER_CHASING", "LANGUAGE", "NEGATIVE_SENTIMENT", "MEMORY_GAP"} <= codes
    assert len([r for r in b.risks if r.code == "PRICE_CHANGED"]) == 1         # deduped across facts + summary
    assert b.escalations and b.confidence < 0.5
    assert b.alerts.startswith("- [HIGH]") and "Reply in Hinglish" in b.alerts
    assert "MEMORY_GAP" not in b.alerts                                         # info-only risks carry no instruction


def test_stale_amounts_are_redacted_from_memory_sections():
    from app.services.context_engine import redact_stale_amounts
    sections = {"thread": "Company quoted Rs 1,450 per unit (Rs 1,16,000 total).\n  [Us, 9 Nov] price is ₹1450 each",
                "commitments": "- [WE PROMISED] Revised quote", "style": "Rs 1,450 untouched here"}
    n = redact_stale_amounts(sections, [1450.0])
    assert n == 2 and "1,450" not in sections["thread"] and "1450" not in sections["thread"]
    assert "Rs 1,16,000" in sections["thread"]          # other amounts untouched
    assert sections["style"] == "Rs 1,450 untouched here"  # only memory-of-fact sections


async def test_assemble_redacts_superseded_price_from_conversation():
    signals = {"body_text": "Please send the invoice", "key_facts": ["Quoted price for 304 SS grab bar 600 mm: Rs 1,450 per unit"]}
    eng = _engine(signals)
    eng._fetchers["thread"] = lambda p: asyncio.sleep(0, "Facts stated in this conversation: Quoted Rs 1,450 per unit")
    b = await eng.assemble(package([fact()]))
    assert "1,450" not in (b.sections["thread"] or "") and "superseded" in b.sections["thread"]
    assert "1,450" not in (b.alerts or "")


async def test_assemble_includes_org_escalation():
    org = SimpleNamespace(context="- Refunds", situations=["return_refund"],
                          escalations=[{"id": "op_1", "title": "Refunds", "reason": "situation:return_refund"}])
    b = await _engine({"body_text": "I want a refund"}, org=org).assemble(package())
    assert any("Company practice requires human approval: Refunds" in e for e in b.escalations)


async def test_failing_and_slow_memories_degrade_only_their_section(monkeypatch):
    monkeypatch.setattr(ce, "MEMORY_TIMEOUT_SECONDS", 0.2)
    b = await _engine({"body_text": "hi"}, fail=("contact", "signals"), slow=("style",)).assemble(package())
    assert set(b.failed) == {"contact", "signals", "style"}
    assert b.sections.get("thread") and not b.sections.get("contact") and not b.sections.get("style")
    assert b.confidence == round(1 - 0.02 - 0.15, 2)
    assert b.timings_ms["style"] >= 150


async def test_engine_never_raises_on_broken_package():
    b = await _engine({}).assemble(SimpleNamespace(tenant_id="t", message_id="m"))
    assert isinstance(b.confidence, float)
