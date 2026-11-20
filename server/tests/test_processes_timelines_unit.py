"""Knowledge taxonomy: 6 categories; Processes & Timelines replaces Operations; contact details live in
Company Info. Pure unit tests (no database)."""

from types import SimpleNamespace

import pytest

from app.algorithms.deduplication.category_identity import CategoryIdentityResolver
from app.contracts.evidence_fusion import CandidateRole, RequirementType
from app.contracts.flexible_schema import CATEGORY_CANONICAL_ALIASES
from app.contracts.knowledge import (
    KnowledgeInvalidCategoryError,
    category_registry,
    normalize_category_key,
)
from app.contracts.requirement_plan import IntentType, PlannedRequirement, RequirementPlan
from app.models.knowledge import KnowledgeCategory
from app.services.evidence_fusion.grouper import RequirementGrouper, _PROCESS_TIMELINE_RE
from app.services.evidence_fusion.normalizer import CandidateNormalizer, provides_contact_details
from app.services.knowledge_projection import _PROJECTORS
from app.services.requirement_planner.decomposer import MultiIntentDecomposer

SIX = ["company_info", "products_services", "policies", "support_faqs", "offers_promotions", "processes_timelines"]


def test_taxonomy_is_exactly_six_categories():
    assert [c.value for c in KnowledgeCategory] == SIX
    assert [d.category.value for d in category_registry.list_all()] == SIX


@pytest.mark.parametrize("removed", ["contacts", "operations", "locations", "brand_communication",
                                     "brand-communication", "team_directory", "offices", "brand"])
def test_removed_categories_are_rejected(removed):
    with pytest.raises(KnowledgeInvalidCategoryError):
        normalize_category_key(removed)


@pytest.mark.parametrize("key", ["processes-timelines", "Processes & Timelines", "processes", "timelines",
                                 "lead_times", "sop", "procedures"])
def test_process_aliases_normalize(key):
    assert normalize_category_key(key) == "processes_timelines"


def test_processes_schema_and_column_aliases():
    d = category_registry.get("processes_timelines")
    assert d.display_name == "Processes & Timelines"
    assert [n for n, f in d.fields.items() if f.is_required] == ["process_name"]
    for col in ("lead_time", "tat", "confirmation_time", "dispatch_time", "turnaround", "sla"):
        assert CATEGORY_CANONICAL_ALIASES[("processes_timelines", col)] == "timeline"
    assert not any(cat in ("contacts", "operations", "locations", "brand_communication")
                   for cat, _ in CATEGORY_CANONICAL_ALIASES)
    company = category_registry.get("company_info").fields
    assert {"email", "phone", "address", "business_hours"} <= set(company)


def test_company_info_record_validates_with_contact_details():
    res = category_registry.validate_record("company_info", {
        "company_name": "Acme", "phone": "+91 80000 00000", "address": "12 Example Road, Pune",
        "business_hours": "Mon-Sat 10-6"})
    assert res.is_valid, res.errors


def test_process_record_validates_and_requires_a_name():
    ok = category_registry.validate_record("processes_timelines", {
        "process_name": "Purchase order confirmation", "trigger": "After the PO is received",
        "timeline": "Within 24 working hours"})
    assert ok.is_valid, ok.errors
    assert not category_registry.validate_record("processes_timelines", {"timeline": "2 days"}).is_valid


def test_dedup_identity_keeps_process_variants_apart():
    key = lambda **d: CategoryIdentityResolver.resolve_identity_key("t", "processes_timelines", d)
    std = key(process_name="PO confirmation")
    bulk = key(process_name="PO confirmation", applies_to="Bulk orders")
    assert std != bulk
    assert std == key(process_name="  po CONFIRMATION ")


def test_process_projection_keeps_timeline_together():
    item = SimpleNamespace(title="PO confirmation", description=None)
    version = SimpleNamespace()
    sections = _PROJECTORS["processes_timelines"].build_sections(item, version, {
        "process_name": "Purchase order confirmation", "trigger": "After the PO is received",
        "timeline": "Within 24 working hours", "conditions": "Bulk orders: 2 working days"}, {})
    text = "\n".join(t for _, t in sections)
    assert "Process: Purchase order confirmation" in text
    assert "Starts: After the PO is received\nTimeline: Within 24 working hours" in text
    assert "Bulk orders: 2 working days" in text


def test_company_projection_includes_every_contact_detail():
    item = SimpleNamespace(title="Acme", description=None)
    sections = _PROJECTORS["company_info"].build_sections(item, SimpleNamespace(), {
        "email": "hi@acme.example", "phone": "+91 1", "address": "12 Road", "business_hours": "10-6"}, {})
    text = "\n".join(t for _, t in sections)
    for part in ("Email: hi@acme.example", "Phone: +91 1", "Address: 12 Road", "Business Hours: 10-6"):
        assert part in text


@pytest.mark.parametrize("text,expected", [
    ("After PO what will be confirmation time?", "processes_timelines"),
    ("How long does dispatch take after payment?", "processes_timelines"),
    ("What is the delivery lead time to Pune?", "processes_timelines"),
    ("Share your support contact number", "company_info"),
    ("What is your office address?", "company_info"),
    ("What are your working hours?", "company_info"),
    ("Price of model DAHD0034?", "products_services"),
    ("What is the warranty?", "policies"),
])
def test_segment_routing(text, expected):
    assert MultiIntentDecomposer._classify_segment(text)[0] == expected


def test_timeline_detector_is_generic_and_precise():
    hits = ["after po what will be confirmation time?", "kitne din me delivery hogi", "what is the refund process",
            "by when can you dispatch?"]
    misses = ["price of model x?", "need 40 units, send quote", "metal sheets available?", "beta version pricing"]
    assert all(_PROCESS_TIMELINE_RE.search(t) for t in hits)
    assert not any(_PROCESS_TIMELINE_RE.search(t) for t in misses)


def _plan(reqs, intent=IntentType.PRODUCT_DISCOVERY, query=""):
    return RequirementPlan(tenant_id="t", integration_account_id="a", thread_id="th", message_id="m",
                           context_revision=1, intent=intent, requirements=reqs, query_text=query)


def test_process_requirement_is_answered_from_processes_not_a_booking():
    plan = _plan([
        PlannedRequirement(requirement_id="r1", intent=IntentType.PRODUCT_DISCOVERY, category="products_services",
                           description="40 units"),
        PlannedRequirement(requirement_id="r2", intent=IntentType.ORDER_OR_DELIVERY_QUESTION,
                           category="processes_timelines", description="Confirmation time after PO"),
        PlannedRequirement(requirement_id="r3", intent=IntentType.SERVICE_LOOKUP, category="company_info",
                           description="Your contact number"),
    ])
    groups = {g.requirement_id: g for g in RequirementGrouper.decompose_requirements(plan=plan)}
    assert groups["r2"].requirement_type == RequirementType.GENERAL_INQUIRY
    assert groups["r2"].applicable_candidate_roles == {CandidateRole.PROCESS_TIMELINE}
    assert not groups["r2"].is_operational
    assert groups["r3"].requirement_type == RequirementType.CONTACT_RESOLUTION
    assert CandidateRole.GENERAL_KNOWLEDGE in groups["r3"].applicable_candidate_roles


def test_single_question_gets_a_process_group():
    plan = _plan([], query="After PO what will be confirmation time?")
    groups = RequirementGrouper.decompose_requirements(plan=plan)
    proc = [g for g in groups if g.target_category == "processes_timelines"]
    assert proc and proc[0].applicable_candidate_roles == {CandidateRole.PROCESS_TIMELINE}


def test_candidate_roles():
    assert CandidateNormalizer.infer_candidate_role("processes_timelines") == CandidateRole.PROCESS_TIMELINE
    assert CandidateNormalizer.infer_candidate_role("company_info") == CandidateRole.GENERAL_KNOWLEDGE
    with_phone = SimpleNamespace(candidate_role=CandidateRole.GENERAL_KNOWLEDGE, category="company_info",
                                 attributes={"phone": "+91 1"})
    without = SimpleNamespace(candidate_role=CandidateRole.GENERAL_KNOWLEDGE, category="company_info",
                              attributes={"industry": "x"})
    assert provides_contact_details(with_phone) and not provides_contact_details(without)


def test_retired_category_items_still_project_generically():
    from app.contracts.knowledge import stored_category_key

    assert stored_category_key("operations") == "operations"
    assert stored_category_key("processes-timelines") == "processes_timelines"
    assert stored_category_key(None) == "products_services"


def test_projectors_do_not_repeat_their_fields_as_additional_attributes():
    consumed = set()
    item = SimpleNamespace(title="PO confirmation", description=None)
    _PROJECTORS["processes_timelines"].build_sections(item, SimpleNamespace(), {
        "process_name": "PO confirmation", "timeline": "24h"}, {}, consumed_keys=consumed)
    assert {"process_name", "timeline", "trigger"} <= consumed


@pytest.mark.parametrize("text", [
    "when will the new model launch?",
    "when can you visit our office?",
    "do you have this in stock?",
])
def test_timeline_detector_ignores_non_timeline_when_questions(text):
    assert not _PROCESS_TIMELINE_RE.search(text)


@pytest.mark.parametrize("text", [
    "when will we receive the material after payment?",
    "when can you dispatch the order?",
    "what is the eta for 40 units?",
])
def test_timeline_detector_catches_real_timeline_questions(text):
    assert _PROCESS_TIMELINE_RE.search(text)
