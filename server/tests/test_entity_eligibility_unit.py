"""Regression + unit tests for requirement-aware eligibility (no DB, no network).

Fixtures are shaped like real catalogue rows (incl. the uploaded workbook's inconsistent ones)
plus a synthetic laptop domain. Nothing here is used by production code: production logic
contains no business vocabulary — these tests prove it generalises across domains.
"""
from types import SimpleNamespace as N

import pytest

from app.services.retrieval_router.entity_eligibility import (
    FamilyEntry,
    ProductRole,
    TenantVocabulary,
    _VOCAB_CACHE,
    build_request_spec,
    classify_candidate,
    evaluate,
    family_label,
    family_tokens,
)
from app.services.requirement_planner.decomposer import MultiIntentDecomposer
from app.services.units import parse_dimensions, parse_quantities, primary_length_mm


def _vocab(*labels, brands=()):
    bt = frozenset(t for b in brands for t in b.lower().split())
    return TenantVocabulary(
        families=[FamilyEntry(label=l, tokens=frozenset(family_tokens(l, bt)), item_count=10) for l in labels],
        brand_tokens=bt)


def _plan(q, intent="product_discovery", entities=()):
    return N(query_text=q, entities=list(entities), requirements=[], intent=N(value=intent))


def _row(title, category, product_type, entity_type=None, **extra):
    cd = {"name": title, "custom_attributes": {"category": category, "product_type": product_type, **extra}}
    if entity_type:
        cd["entity_type"] = entity_type
    return cd, title


# Rows shaped exactly like the uploaded workbook (category / product type as in the source)
AIR_CURTAINS = [
    _row("ABS Air Curtain With Remote Control 1200 x 230 x 220", "Air Curtain", "Finish Goods", "PRODUCT"),
    _row("Metal Air Curtain With ON/OFF Switch And Sensor 900X230X212", "Air Curtain", "Finish Goods", "PRODUCT"),
    _row("Air Curtain Stainless Steel SS 304 Size: 6 Feet", "Air Curtain", "Finish Goods", "PRODUCT"),
    _row("Ceiling Mounted Air Curtain 1220x290x235 mm", "Air Curtain", "Finish Goods", "PRODUCT"),
]
DISTRACTORS = [
    _row("Body Suitable For Model DAHD0012", "Spare Parts", "Spare Parts", "PART"),
    _row("Motor Cover Suitable For Model DAHD0042", "Spare Parts", "Spare Parts", "PART"),
    _row("Activate Carbon Foam Filter Suitable For Model DAHD0057", "Spare Parts", "Spare Parts", "PART"),
    _row("Single Door Air Curtain Sensor", "Spare Parts", "Finish Goods", "PRODUCT"),        # inconsistent source row
    _row("Double Door Air Curtain Sensor Suitable For Model DACN0004 To 06", "Accessories", "Finish Goods"),
    _row("Air Curtain Motor 230V", "Air Curtain Raw Material", "Spare Parts", "PART"),
    _row("Air Curtain Carton Box", "Air Curtain Packing Material", "Spare Parts", "PART"),
    _row("Led Hand Dryer 2 Wave Black 1800W", "Hand Dryer", "Finish Goods", "PRODUCT"),
]
VOCAB = _vocab("Air Curtain", "Hand Dryer", "Spare Parts", "Accessories", "E-Commerce Product", "Laptop",
               brands=["DOLPHY INDIA PVT LTD."])


# ---------------------------------------------------------------- units
def test_units_conversions_and_false_positives():
    q = {x.original: x for x in parse_quantities("door 4 feet, 48 inches, 1.2 m, 16GB RAM, 500W, 8kg, 1.2 L")}
    assert round(q["4 feet"].value, 1) == 1219.2 and q["4 feet"].kind == "length"
    assert round(q["48 inches"].value, 1) == 1219.2
    assert q["1.2 m"].value == 1200 and q["16GB"].kind == "data_size" and q["16GB"].context == "ram"
    assert q["500W"].value == 500 and q["8kg"].value == 8000 and q["1.2 L"].value == 1200
    assert parse_quantities("5 in stock") == [] and parse_quantities("model DAHD0012") == []
    d = parse_dimensions("ABS Air Curtain 1200 x 230 x 220")[0]
    assert d.values_mm == (1200, 230, 220) and d.assumed_unit
    assert primary_length_mm("Air Curtain Size: 6 Feet")[0] == pytest.approx(1828.8)


# ---------------------------------------------------------------- candidate roles
@pytest.mark.parametrize("cd,title,role", [
    (*AIR_CURTAINS[0], ProductRole.FINISHED),
    (*DISTRACTORS[0], ProductRole.PART),
    (*DISTRACTORS[3], ProductRole.PART),          # category says spare parts despite "Finish Goods"
    (*DISTRACTORS[4], ProductRole.ACCESSORY),
    (*DISTRACTORS[5], ProductRole.RAW_MATERIAL),
    (*DISTRACTORS[6], ProductRole.PACKAGING),
    ({"name": "AC repair visit", "entity_type": "SERVICE"}, "AC repair visit", ProductRole.SERVICE),
    ({"name": "Pump", "custom_attributes": {"product_type": "Finish Goods"}}, "Pump suitable for model X100", ProductRole.PART),
])
def test_candidate_role(cd, title, role):
    assert classify_candidate(cd, title).role == role


def test_family_label_strips_role_words():
    assert family_label("Air Curtain Raw Material") == "Air Curtain"
    assert family_label("Air Curtain Packing Material") == "Air Curtain"
    assert family_label("Spare Parts") == ""


# ---------------------------------------------------------------- Scenario A: air curtain regression
def test_air_curtain_request_admits_only_complete_air_curtains():
    spec = build_request_spec(_plan("I am looking to purchase air curtains for a door with a width of 4 feet. "
                                    "Please suggest models and prices"), VOCAB)
    assert [f.label for f in spec.families] == ["Air Curtain"]
    assert spec.wanted_roles == {ProductRole.FINISHED, ProductRole.SERVICE}
    assert spec.length_mm.value == pytest.approx(1219.2)
    for cd, title in AIR_CURTAINS:
        assert evaluate(cd, title, None, spec).eligible, title
    for cd, title in DISTRACTORS:
        assert not evaluate(cd, title, None, spec).eligible, title


def test_air_curtain_fit_note_never_claims_exact_fit():
    spec = build_request_spec(_plan("air curtain for a 4 feet door"), VOCAB)
    el = evaluate(*AIR_CURTAINS[0], None, spec)
    note = el.notes[0]
    assert "close to" in note and "confirm" in note and "1200" in note
    near, far = el.fit_bonus, evaluate(*AIR_CURTAINS[2], None, spec).fit_bonus      # 1200 mm vs 6 ft
    assert near > far


# ---------------------------------------------------------------- Scenario B: functional request
def test_functional_request_excludes_parts_without_family_hardcoding():
    spec = build_request_spec(_plan("I need a device that can dry my wet hands"), VOCAB)
    assert spec.families == []                       # no keyword rule: semantic ranking resolves the family
    assert evaluate(*DISTRACTORS[7], None, spec).eligible           # complete hand dryer
    for cd, title in DISTRACTORS[:3]:                               # its parts
        assert not evaluate(cd, title, None, spec).eligible


def test_family_in_channel_category_matches_by_title():
    spec = build_request_spec(_plan("do you sell hand dryers"), VOCAB)
    cd, title = _row("Hand Dryer Pink 1800W", "E-Commerce Product", "Finish Goods", "PRODUCT")
    assert evaluate(cd, title, None, spec).eligible


# ---------------------------------------------------------------- Scenario D: parts for a model
def test_spare_parts_for_model_require_compatibility_evidence():
    spec = build_request_spec(_plan("I need spare parts for model DAHD0012"), VOCAB)
    assert spec.target_models == ["DAHD0012"] and "DAHD0012" not in spec.exact_keys
    assert ProductRole.PART in spec.wanted_roles
    assert evaluate(*DISTRACTORS[0], None, spec).eligible                 # body for DAHD0012
    assert not evaluate(*DISTRACTORS[1], None, spec).eligible             # cover for DAHD0042
    hand_dryer = _row("Led Hand Dryer 2 Wave Black 1800W", "Hand Dryer", "Finish Goods", "PRODUCT")
    assert not evaluate(*hand_dryer, "DAHD0012", spec).eligible           # the parent itself is not a part


def test_exact_identifier_is_always_eligible():
    spec = build_request_spec(_plan("price of DAHD12-BODY"), VOCAB)
    assert evaluate(*DISTRACTORS[0], "DAHD12-BODY", spec).eligible


# ---------------------------------------------------------------- Scenario C: synthetic laptop domain
LAPTOPS = [
    _row("ZenBook 14 i5 16GB RAM 512GB SSD", "Laptop", "Finish Goods", "PRODUCT"),
    _row("Aspire 3 i3 8GB RAM 256GB SSD", "Laptop", "Finish Goods", "PRODUCT"),
    _row("ThinkBook 15 Ryzen 5", "Laptop", "Finish Goods", "PRODUCT"),                 # RAM not stated
    _row("Laptop Battery 16GB", "Spare Parts", "Spare Parts", "PART"),
]


def test_laptop_hard_spec_minimums_and_unverified_specs():
    spec = build_request_spec(_plan("I want a powerful laptop under Rs 50,000 with 16GB RAM and a good processor"), VOCAB)
    assert [f.label for f in spec.families] == ["Laptop"]
    assert [(c.hint, c.value) for c in spec.min_constraints] == [("ram", 16.0)]
    ok, low, unknown, part = (evaluate(cd, t, None, spec) for cd, t in LAPTOPS)
    assert ok.eligible and any("meets" in s for s in ok.satisfied)
    assert not low.eligible and any("below" in u for u in low.unmet)
    assert unknown.eligible and any("unverified" in n for n in unknown.notes)   # never claimed as matching
    assert not part.eligible


# ---------------------------------------------------------------- decomposition (root cause #1)
def test_email_lines_greeting_and_signature_are_not_requirements():
    body = ("Hello there,\n\nI am looking to purchase air curtains for a door with a width of 4 feet.\n\n"
            "Could you please suggest the appropriate models for this requirement and\n"
            "share the corresponding pricing details?\n\nRegards,\nRishiraj Sinha")
    reqs = MultiIntentDecomposer.decompose(body)
    assert len(reqs) == 1 and reqs[0].category == "products_services"
    assert "Regards" not in reqs[0].query_text and "Rishiraj" not in reqs[0].query_text
    assert "pricing details" in reqs[0].query_text


def test_multi_intent_email_keeps_every_independent_requirement():
    body = ("Hi team,\nI want a laptop below Rs 50,000 with 16GB RAM.\n1. What is the warranty?\n"
            "2. Delivery to Surat timeline?\n3. Any offers or discounts?\n4. Retailer contact for bulk orders\n"
            "5. Return policy?\nThanks,\nAmit\n\nOn Mon, X wrote:\n> old question about something else")
    cats = [r.category for r in MultiIntentDecomposer.decompose(body)]
    assert cats == ["products_services", "policies", "operations", "offers_promotions", "contacts", "policies"]


# ---------------------------------------------------------------- tenant isolation
def test_vocabulary_cache_is_tenant_scoped():
    _VOCAB_CACHE["org_a"] = _vocab("Air Curtain")
    _VOCAB_CACHE["org_b"] = _vocab("Laptop")
    try:
        assert [f.label for f in _VOCAB_CACHE["org_a"].families] == ["Air Curtain"]
        assert [f.label for f in _VOCAB_CACHE["org_b"].families] == ["Laptop"]
        spec_b = build_request_spec(_plan("air curtain for a door"), _VOCAB_CACHE["org_b"])
        assert spec_b.families == []      # org_b's vocabulary never knows org_a's families
    finally:
        _VOCAB_CACHE.pop("org_a", None)
        _VOCAB_CACHE.pop("org_b", None)


def test_unknown_intent_still_excludes_parts():
    spec = build_request_spec(_plan("I want to buy air curtain", intent="unknown"), VOCAB)
    assert spec.wanted_roles == {ProductRole.FINISHED, ProductRole.SERVICE}
    assert not evaluate(*DISTRACTORS[4], None, spec).eligible      # accessory
    assert evaluate(*AIR_CURTAINS[0], None, spec).eligible
