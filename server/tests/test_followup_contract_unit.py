"""AI #2 decision contract: strict schema, grounded validation, no business vocabulary."""

import json
import re
from pathlib import Path

import pytest

from app.services.followups import contracts
from app.services.followups.assessor import SYSTEM_PROMPT
from app.services.followups.composer import validate_grounded


def base(**over):
    d = {
        "temperature": "warm", "label_confidence": 0.8, "buying_interest": 0.6, "sales_relevance": "sales",
        "reason_codes": ["comparing_options"], "explanation": "Customer compared two options.",
        "evidence_message_ids": ["m2"], "outcome": "open_unconfirmed", "next_actor": "team",
        "next_action": "Send the comparison.", "decision": "wait_team", "matched_opportunity_key": "units",
        "opportunities": [{"key": "units", "subject": "40 units", "status": "open", "temperature": "warm",
                           "evidence_message_ids": ["m2"]}],
        "timing": {"kind": "none", "phrase": None, "source_message_id": None, "local_date": None, "local_time": None,
                   "window_end_date": None, "timezone": None, "timezone_evidence": None, "precision": "unknown",
                   "ambiguous": False, "alternatives": [], "internal_reminder_note": None, "cadence_reason": None},
        "constraints": {"refusal_scope": "none", "refusal_until_date": None, "refusal_quote": None,
                        "changed_date": False, "possible_completion": False, "conflicting_evidence": False,
                        "missing_context": False, "uncertainty": "low"},
    }
    for k, v in over.items():
        if k in ("timing", "constraints"):
            d[k] = {**d[k], **v}
        else:
            d[k] = v
    return d


KW = dict(known_message_ids=["m1", "m2"], latest_message_id="m2",
          customer_texts=["Aage se kabhi message mat karna."], latest_is_outbound=False)


def _walk(schema):
    yield schema
    for v in (schema.get("properties") or {}).values():
        yield from _walk(v)
    if isinstance(schema.get("items"), dict):
        yield from _walk(schema["items"])


def test_schema_is_strict_everywhere():
    assert contracts.SCHEMA["strict"] is True
    for node in _walk(contracts.SCHEMA["schema"]):
        if node.get("type") == "object":
            assert node["additionalProperties"] is False
            assert set(node["required"]) == set(node["properties"])


def test_valid_result_round_trips():
    a = contracts.validate(base(), **KW)
    again = contracts.from_json(json.loads(json.dumps(a.to_json())))
    assert again.to_json() == a.to_json() and a.warnings == []


@pytest.mark.parametrize("field,value", [("temperature", "boiling"), ("decision", "email_now"),
                                         ("label_confidence", 1.7), ("outcome", "won")])
def test_structural_violations_are_rejected(field, value):
    with pytest.raises(contracts.ContractError):
        contracts.validate(base(**{field: value}), **KW)


def test_unknown_evidence_ids_are_dropped_not_trusted():
    a = contracts.validate(base(evidence_message_ids=["m2", "invented"]), **KW)
    assert a.evidence_message_ids == ["m2"] and "evidence_unknown_id" in a.warnings


def test_dated_kind_without_date_never_invents_one():
    a = contracts.validate(base(timing={"kind": "customer_commitment", "local_date": "next-ish"}), **KW)
    assert a.timing.local_date is None and a.timing.precision == "unknown"
    assert {"local_date_not_iso", "timing_without_date"} <= set(a.warnings)


def test_refusal_quote_must_appear_in_customer_text():
    ok = contracts.validate(base(decision="suppress", constraints={
        "refusal_scope": "all_contact", "refusal_quote": "aage se kabhi message mat karna"}), **KW)
    assert ok.constraints.quote_verified
    bad = contracts.validate(base(decision="suppress", constraints={
        "refusal_scope": "all_contact", "refusal_quote": "never email me"}), **KW)
    assert not bad.constraints.quote_verified and "refusal_quote_not_found" in bad.warnings


@pytest.mark.parametrize("decision,outcome", [("schedule", "open_unconfirmed"), ("defer", "open_unconfirmed"),
                                              ("wait_team", "open_unconfirmed"), ("none", "completed")])
def test_action_without_evidence_becomes_needs_review(decision, outcome):
    a = contracts.validate(base(decision=decision, outcome=outcome, evidence_message_ids=[]), **KW)
    assert a.decision == "needs_review" and "decision_without_evidence" in a.warnings
    if outcome == "completed":
        assert a.outcome == "unknown"                     # an uncited "completed" never closes a lead


def test_verified_refusal_needs_no_extra_evidence():
    a = contracts.validate(base(decision="suppress", evidence_message_ids=[], constraints={
        "refusal_scope": "all_contact", "refusal_quote": "Aage se kabhi message mat karna"}), **KW)
    assert a.decision == "suppress"
    b = contracts.validate(base(decision="suppress", evidence_message_ids=[], constraints={
        "refusal_scope": "all_contact", "refusal_quote": "stop everything"}), **KW)
    assert b.decision == "needs_review"


def test_customer_date_must_be_quoted_from_customer_text():
    kw = {**KW, "customer_texts": ["We intend to book on 15 December 2026. Please call that afternoon at 3 PM IST."]}
    ok = contracts.validate(base(decision="schedule", timing={
        "kind": "customer_commitment", "phrase": "15 December 2026 ... that afternoon at 3 PM IST",
        "local_date": "2026-12-15", "local_time": "15:00", "precision": "instant"}), **kw)
    assert not ok.timing.ambiguous and "customer_date_not_quoted" not in ok.warnings
    bad = contracts.validate(base(decision="schedule", timing={
        "kind": "customer_commitment", "phrase": "mid December", "local_date": "2026-12-15",
        "local_time": "15:00", "precision": "instant"}), **kw)
    assert bad.timing.ambiguous and bad.timing.alternatives == ["2026-12-15 15:00"]
    assert "customer_date_not_quoted" in bad.warnings
    team = contracts.validate(base(decision="wait_team", timing={
        "kind": "team_deadline", "phrase": "by Thursday", "local_date": "2026-12-03"}), **kw)
    assert not team.timing.ambiguous                      # the rule applies to customer-given dates only


def test_outbound_message_cannot_raise_customer_interest():
    a = contracts.validate(base(temperature="hot"), **{**KW, "latest_is_outbound": True},
                           prior_ai_temperature="warm")
    assert a.temperature == "warm" and "outbound_cannot_raise_temperature" in a.warnings
    b = contracts.validate(base(temperature="cold"), **{**KW, "latest_is_outbound": True},
                           prior_ai_temperature="warm")
    assert b.temperature == "cold"                    # lowering / ownership changes are allowed


def test_opportunity_keys_are_normalised_and_bad_ones_dropped():
    a = contracts.validate(base(opportunities=[
        {"key": "Annual Contract", "subject": "annual", "status": "declined", "temperature": "cold",
         "evidence_message_ids": ["m2"]},
        {"key": "", "subject": "x", "status": "open", "temperature": "warm", "evidence_message_ids": []},
    ], matched_opportunity_key="annual_contract"), **KW)
    assert [o["key"] for o in a.opportunities] == ["annual_contract"] and "opportunity_dropped" in a.warnings


FORBIDDEN = re.compile(r"dolphy|air curtain|hand dryer|laptop|\bsku\b|lenovo|dell|warranty|workshop|invoice\s*=",
                       re.IGNORECASE)


def test_no_business_vocabulary_in_classification_or_scheduling_code():
    root = Path(__file__).resolve().parents[1] / "app" / "services" / "followups"
    for f in root.glob("*.py"):
        assert not FORBIDDEN.search(f.read_text(encoding="utf-8")), f"business vocabulary in {f.name}"
    assert not FORBIDDEN.search(SYSTEM_PROMPT)


@pytest.mark.parametrize("body,problem", [
    ("Just checking in on the 40 units you asked about.", None),
    ("Just checking in on the 45 units you asked about.", "ungrounded_number:45"),
    ("Hi [Name], following up.", "placeholder_or_markup"),
    ("Please see https://evil.example/offer for details.", "ungrounded_link"),
    ("ok", "length_out_of_bounds"),
])
def test_follow_up_text_must_be_grounded(body, problem):
    thread = "We need 40 units. Please send the final quote by Thursday."
    got = validate_grounded(body, thread)
    assert (got is None) if problem is None else (got == problem)


# ---------------------------------------------------------------------------------------------
# Customer follow-up text: human voice, closing, own-system-mail guard, time-suggestion verdicts
# ---------------------------------------------------------------------------------------------

from datetime import datetime, timedelta, timezone  # noqa: E402

from app.services.followups import composer, engine, timing as tm  # noqa: E402


@pytest.mark.parametrize("text", [
    "Hi Kavya, I hope this email finds you well. Any update on the quote?",
    "Hi Kavya, just following up on the quote.",
    "Hi Kavya, just checking in about the workshop.",
    "Hi Kavya, circling back on the proposal.",
    "Hello, touching base about next steps.",
    "Hi, please don't hesitate to contact us about the quote.",
    "As an AI, I wanted to remind you about the quote.",
    "Hi Kavya, this is a friendly reminder about the workshop booking.",
    "Hi Kavya, a quick recap:\n- the quote\n- the delivery window",
    "Hi Kavya, **the quote** is ready whenever you are.",
])
def test_voice_validator_rejects_automated_sounding_text(text):
    assert composer.validate_voice(text) is not None


@pytest.mark.parametrize("text", [
    "Hi Kavya, did the workshop plan for December come together on your side? Happy to hold the afternoon slot if it still suits you.",
    "Hola Marta, ¿pudiste revisar la propuesta con tu equipo? Si te viene bien, lo vemos el lunes.",
    "Hi Arjun, were you able to get sign-off on the annual plan? If anything is still unclear I can walk your team through it.",
])
def test_voice_validator_accepts_natural_follow_ups(text):
    assert composer.validate_voice(text) is None


def test_tidy_and_first_name_and_quiet_label():
    assert composer.tidy("Hi Kavya — quick one.\n\n\n\nThanks") == "Hi Kavya - quick one.\n\nThanks"
    assert composer.first_name("kavya rao") == "Kavya"
    assert composer.first_name("Rao, Kavya") == "Kavya"
    assert composer.first_name("sales@client.example") is None
    assert composer.first_name("123 Ltd") is None
    assert not re.search(r"\d", " ".join(composer.quiet_label(d) for d in (0, 3, 7, 14, 30, 400)))


async def test_composer_repairs_once_then_appends_team_closing(monkeypatch):
    from app.services.reply_planner.closing import make_closing

    drafts = iter(["Hi Kavya, just following up on the workshop.",
                   "Hi Kavya, did the December workshop plan work out on your side?"])
    seen = []

    async def fake_call(payload):
        seen.append(dict(payload))
        return next(drafts)

    class M:
        def __init__(self, i, direction, body):
            self.id, self.direction, self.body_text, self.from_name = i, direction, body, "Kavya Rao"
            self.sent_at = datetime(2026, 12, 1, tzinfo=timezone.utc)

    async def fake_history(db, t, th):
        return [M("m1", "inbound", "We plan the workshop in December."), M("m2", "outbound", "Great, noted.")]

    class DB:
        async def get(self, *a):
            return None

    async def no_memory(t, m):
        return {"conversation_memory": "Summary so far: workshop in December.", "team_style": None}

    async def closing(t, m):
        return make_closing("Best regards,", "Acme Training")

    monkeypatch.setattr(composer, "call_composer", fake_call)
    monkeypatch.setattr(composer, "_history", fake_history)
    monkeypatch.setattr(composer, "_memory", no_memory)
    monkeypatch.setattr(composer, "_closing", closing)
    out = await composer.compose(DB(), "t", "th")
    assert out.ok, out.reason
    assert out.text.startswith("Hi Kavya, did the December workshop plan")
    assert out.text.rstrip().endswith("Best regards,\nAcme Training")
    assert len(seen) == 2 and "previous_draft_rejected_because" in seen[1]
    assert seen[0]["customer_first_name"] == "Kavya" and seen[0]["conversation_memory"]


async def test_composer_holds_when_repair_also_fails(monkeypatch):
    async def fake_call(payload):
        return "Hi, just checking in."

    class M:
        id, direction, body_text, from_name, sent_at = "m1", "inbound", "Hello", "X", None

    async def fake_history(db, t, th):
        return [M()]

    class DB:
        async def get(self, *a):
            return None

    async def no_memory(t, m):
        return {"conversation_memory": None, "team_style": None}

    monkeypatch.setattr(composer, "call_composer", fake_call)
    monkeypatch.setattr(composer, "_history", fake_history)
    monkeypatch.setattr(composer, "_memory", no_memory)
    out = await composer.compose(DB(), "t", "th")
    assert not out.ok and out.reason.startswith("templated_phrase")


def test_own_platform_mail_is_never_a_customer_conversation(monkeypatch):
    from app.services import gmail_sync

    class S:
        email_from_address = "Hello@Platform.example"

    monkeypatch.setattr("app.core.config.get_transactional_email_settings", lambda: S())
    assert gmail_sync._is_platform_sender('"ProxiPilot" <hello@platform.example>')
    assert not gmail_sync._is_platform_sender("buyer@client.example")
    S.email_from_address = ""
    assert not gmail_sync._is_platform_sender("hello@platform.example")


def _due(at, source):
    r = tm.DueResolution()
    r.due_at, r.source = at, source
    return r


def test_time_suggestion_verdicts():
    locked = datetime(2026, 12, 15, 9, 30, tzinfo=timezone.utc)
    res = contracts.validate(base(), **KW)
    assert engine.time_suggestion(_due(locked + timedelta(minutes=10), "customer_date"), res, locked) == "agree"
    assert engine.time_suggestion(_due(locked + timedelta(days=24), "customer_date"), res, locked) == "suggest"
    assert engine.time_suggestion(_due(locked + timedelta(days=3), "ai_window"), res, locked) == "suggest"
    assert engine.time_suggestion(_due(locked + timedelta(days=3), "cadence"), res, locked) is None
    assert engine.time_suggestion(_due(None, "none"), res, locked) is None
    assert engine.time_suggestion(_due(locked, "customer_date"), res, None) is None
