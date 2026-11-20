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
