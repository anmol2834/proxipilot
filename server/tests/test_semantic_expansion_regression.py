"""Semantic-gap regression on an isolated synthetic tenant (home-appliance services, not Dolphy).

Customers describe what they need in Hinglish / functional words that share no word with the
catalogue ("kapde dhone wali machine" for a washing machine). Through the REAL AI #1 (taxonomy +
translation + HyDE) and the real retrieval router, the right service must be retrieved, and the
expansion must never make the result worse than searching the customer's own words.
"""

from datetime import datetime, timezone

import pytest

from app.services.context_resolver import ContextEnvelope, ContextMessage
from app.services.requirement_planner import requirement_planner_service
from app.services.requirement_planner.service import RequirementPlannerService
from app.services.retrieval_router import retrieval_router_service

# (customer message, acceptable record keys) — no catalogue word appears in the message.
CASES = [
    ("kapde dhone wali machine se paani bahar nahi nikal raha, tub mein bhara rehta hai", {"HA-007"}),
    ("rasoi mein dhuan khinchne wala yantra bahut chikna aur ganda ho gaya hai, saaf karwana hai", {"HA-015"}),
    ("khana garam karne wala dabba ab garam hi nahi karta", {"HA-009"}),
    ("deewar par bada screen lagwana hai, koi aa sakta hai?", {"HA-022"}),
    ("nahane ka paani garam nahi ho raha, subah thanda paani hi aata hai", {"HA-012", "HA-011"}),
]


def _envelope(tenant: str, body: str, n: int) -> ContextEnvelope:
    now = datetime.now(timezone.utc).isoformat()
    cur = ContextMessage(id=f"msg_exp_{n}", external_message_id=f"ext_exp_{n}", direction="inbound",
                         from_email="customer@example.com", subject="Enquiry", body_text=body, sent_at=now)
    return ContextEnvelope(tenant_id=tenant, integration_account_id="itest", provider_thread_id=f"pt_exp_{n}",
                           thread_id=f"thr_exp_itest_{n}", current_message_id=cur.id, context_revision=1,
                           current_message=cur, relevant_previous_messages=[])


def _rank(results, keys):
    for i, item in enumerate(results):
        if item.external_identity_key in keys:
            return i + 1
    return None


@pytest.mark.asyncio
async def test_hinglish_functional_queries_reach_the_right_record(seeded_tenant, monkeypatch):
    async def no_presented(_envelope):
        return []
    monkeypatch.setattr(RequirementPlannerService, "_load_presented", staticmethod(no_presented))

    report = []
    for n, (message, keys) in enumerate(CASES):
        plan = await requirement_planner_service.plan_requirements(envelope=_envelope(seeded_tenant, message, n),
                                                                   dispatch_event=False)
        assert plan.semantic_expansions, f"AI #1 produced no expansion for: {message}"
        exp = plan.semantic_expansions[0]
        assert exp.translated_standard_term and exp.search_concepts, exp

        with_exp = await retrieval_router_service.route_and_retrieve(tenant_id=seeded_tenant, plan=plan,
                                                                     dispatch_event=False)
        bare = plan.model_copy(update={
            "semantic_expansions": [],
            "requirements": [r.model_copy(update={"semantic_expansion": None}) for r in plan.requirements],
        })
        without = await retrieval_router_service.route_and_retrieve(tenant_id=seeded_tenant, plan=bare,
                                                                    dispatch_event=False)
        r_with, r_without = _rank(with_exp.results, keys), _rank(without.results, keys)
        report.append((message[:45], exp.translated_standard_term, r_without, r_with,
                       [i.external_identity_key for i in with_exp.results[:3]]))

    for row in report:
        print("EXPANSION", row)
    failures = [r for r in report if r[3] is None or r[3] > 3]
    assert not failures, failures
    # Never worse than searching the customer's own words.
    worse = [r for r in report if r[2] is not None and r[3] > r[2]]
    assert not worse, worse


@pytest.mark.asyncio
async def test_exact_code_bypasses_expansion(seeded_tenant, monkeypatch):
    async def no_presented(_envelope):
        return []
    monkeypatch.setattr(RequirementPlannerService, "_load_presented", staticmethod(no_presented))
    plan = await requirement_planner_service.plan_requirements(
        envelope=_envelope(seeded_tenant, "Please share the price of HA-017", 99), dispatch_event=False)
    res = await retrieval_router_service.route_and_retrieve(tenant_id=seeded_tenant, plan=plan, dispatch_event=False)
    assert res.results and res.results[0].external_identity_key == "HA-017"
