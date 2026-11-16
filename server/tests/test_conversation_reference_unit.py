"""Unit tests (production thread 2026-11-15, generalised): conversation reference resolution,
near-code suggestions and identifier grounding. Synthetic data only."""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.contracts.requirement_plan import IntentType, PlannedEntity, PlannedRequirement, RequirementPlan
from app.services.conversation_selection import PresentedItem, latest_presented_list, resolve_selection
from app.services.evidence_package.service import unknown_identifier_report
from app.services.reply_planner.validator import _ungrounded_codes
from app.services.requirement_planner.service import apply_result_breadth, apply_selection_state
from app.services.retrieval_router.structured_retriever import _edit_distance, _numeric_gap

T0 = datetime(2026, 11, 15, 12, 0, tzinfo=timezone.utc)
FIRST = [PresentedItem(f"ki_{c}", c, t, T0 + timedelta(minutes=1), "out_1") for c, t in (
    ("AB-101", "Alpha Basic Unit Small"), ("AB-102", "Alpha Premium Unit Small"),
    ("AB-103", "Beta Compact Unit Small"))]
SECOND = [PresentedItem("ki_AB-201", "AB-201", "Gamma Large Unit", T0 + timedelta(minutes=5), "out_2"),
          PresentedItem("ki_AB-202", "AB-202", "Delta Large Unit", T0 + timedelta(minutes=5), "out_2")]


def _env(history, current):
    prev = [SimpleNamespace(direction="inbound", body_text=b, sent_at=at.isoformat()) for b, at in history]
    return SimpleNamespace(relevant_previous_messages=prev, current_message=SimpleNamespace(body_text=current))


def _plan(intent=IntentType.PRODUCT_LOOKUP, entities=(), **kw):
    return RequirementPlan(tenant_id="t", integration_account_id="a", thread_id="th", message_id="m",
                           context_revision=1, intent=intent, entities=list(entities), **kw)


def _prop(scope="none", codes=(), all_=False):
    return SimpleNamespace(reference_scope=scope, referenced_item_codes=list(codes), wants_all_matching=all_)


# --- selection is time-aware -----------------------------------------------------------------

def test_opening_request_cannot_select_an_item_shown_later():
    # "alpha premium unit" names AB-102 by distinguishing words, but it was written BEFORE we listed it
    msgs = ["price of the alpha premium unit and others", "thanks"]
    sel = resolve_selection(msgs, FIRST, message_times=[T0.isoformat(), None])
    assert sel is None
    # the same words AFTER the list select it
    sel = resolve_selection(["price please", "I want the alpha premium unit"], FIRST,
                            message_times=[T0.isoformat(), None])
    assert sel is not None and sel.item.external_key == "AB-102"


def test_latest_list_is_the_most_recent_reply():
    assert {i.external_key for i in latest_presented_list(FIRST + SECOND)} == {"AB-201", "AB-202"}


# --- reference scope enforcement -------------------------------------------------------------

def test_listed_items_focus_on_the_whole_latest_list_never_excluded():
    env = _env([("all small units price", T0)], "tell me the codes of these")
    out = apply_selection_state(_plan(intent=IntentType.MORE_OPTIONS), env, FIRST, _prop("listed_items"))
    assert set(out.focus_entity_ids) == {i.entity_id for i in FIRST}
    assert set(out.focus_keys) == {"AB-101", "AB-102", "AB-103"}
    assert out.excluded_entity_ids == [] and out.intent == IntentType.PRODUCT_LOOKUP and not out.is_continuation


def test_listed_items_narrowed_by_codes():
    env = _env([], "codes of the two alpha ones")
    out = apply_selection_state(_plan(), env, FIRST, _prop("listed_items", ["AB-101", "ab-102", "ZZ-999"]))
    assert out.focus_keys == ["AB-101", "AB-102"]


def test_new_code_overrides_an_earlier_selection():
    env = _env([("I want the alpha premium unit", T0 + timedelta(minutes=2))], "need XY-777 price")
    code = PlannedEntity(entity_type="sku", original_text="XY-777", canonical_value="XY-777")
    out = apply_selection_state(_plan(entities=[code]), env, FIRST, _prop("none"))
    assert out.focus_entity_ids == [] and out.active_selection is None and out.reference_scope == "new_request"


def test_catalogue_wide_question_is_not_stuck_on_selection():
    env = _env([("I want the alpha premium unit", T0 + timedelta(minutes=2))], "most affordable product you have?")
    out = apply_selection_state(_plan(intent=IntentType.CATALOGUE_REQUEST), env, FIRST, _prop("none"))
    assert out.focus_entity_ids == []


def test_follow_up_keeps_the_selection():
    env = _env([("I want the alpha premium unit", T0 + timedelta(minutes=2))], "how do I place the order?")
    out = apply_selection_state(_plan(intent=IntentType.ORDER_OR_DELIVERY_QUESTION), env, FIRST,
                                _prop("selected_item", ["AB-102"]))
    assert out.focus_keys == ["AB-102"] and out.active_selection["external_key"] == "AB-102"


def test_presented_code_typed_again_keeps_focus():
    env = _env([], "price of AB-103 again")
    code = PlannedEntity(entity_type="sku", original_text="AB-103", canonical_value="AB-103")
    out = apply_selection_state(_plan(entities=[code]), env, FIRST, _prop("selected_item", ["AB-103"]))
    assert out.focus_keys == ["AB-103"]


def test_all_matching_widens_result_count():
    req = PlannedRequirement(requirement_id="r1", query_text="all small units")
    out = apply_result_breadth(_plan(requirements=[req]), _prop(all_=True))
    assert out.requested_result_count.final_count == out.requested_result_count.max_safe_limit
    assert out.requirements[0].requested_count == out.requested_result_count.max_safe_limit
    assert apply_result_breadth(_plan(), _prop()).requested_result_count.final_count == 5


# --- near codes -------------------------------------------------------------------------------

def test_near_code_distance_and_ordering():
    assert _edit_distance("DSDR0016", "DSDR0015") == 1 and _edit_distance("DSDR0016", "DSDR0061") == 2
    assert _numeric_gap("DSDR0016", "DSDR0015") < _numeric_gap("DSDR0016", "DSDR0061")


def test_unknown_identifier_report():
    plan = _plan(entities=[PlannedEntity(entity_type="sku", original_text="AB-109", canonical_value="AB-109"),
                           PlannedEntity(entity_type="sku", original_text="AB-101", canonical_value="AB-101")])
    cand = lambda key, title, near=None: SimpleNamespace(external_identity_key=key, title=title, entity_id=f"ki_{key}",
                                                         near_match_for=near)
    fusion = SimpleNamespace(requirements=[SimpleNamespace(verified_candidates=[
        cand("AB-101", "Alpha Basic"), cand("AB-108", "Alpha Eight", "AB-109")])])
    rep = unknown_identifier_report(plan, fusion)
    assert rep == [{"requested": "AB-109", "suggestions": ["AB-108 - Alpha Eight"]}]


# --- identifier grounding in drafts ---------------------------------------------------------

def test_draft_codes_must_be_in_evidence():
    fact = SimpleNamespace(external_identity_key="AB-101", entity_title="Alpha Basic Unit 30LTR", typed_value=1999,
                           statement="")
    pkg = SimpleNamespace(requirements=[SimpleNamespace(facts=[fact], supporting_excerpts=[])],
                          unknown_identifiers=[{"requested": "AB-109", "suggestions": ["AB-108 - Alpha Eight"]}])
    body = "AB-101 costs Rs 1,999 (30LTR, 800ML). AB-109 is not listed; did you mean AB-108? Also try ZQ-4471."
    assert _ungrounded_codes(body, pkg) == ["ZQ-4471"]


# --- price ordering ("cheapest") ---------------------------------------------------------------

def test_price_order_parsing():
    from app.services.retrieval_router.verifier import price_order
    assert price_order("price_asc") == "asc" and price_order("lowest price") == "asc"
    assert price_order("most affordable") == "asc" and price_order("price_desc") == "desc"
    assert price_order("most expensive") == "desc" and price_order("rating") is None and price_order(None) is None


def test_phrases_are_never_identifiers():
    from app.services.requirement_planner.validator import looks_like_identifier as ok
    assert all(ok(v) for v in ("DMBR0008", "DMBR0002-30L-WHITE", "HA-001", "DSDR0016", "123456"))
    assert not any(ok(v) for v in ("PRODUCT CODE", "30 liters", "30L", "800ML", "40LTR", "30-liter", "800-ML", "0nly", "product model", "", None))
