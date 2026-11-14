"""Per-requirement retrieval on an isolated synthetic tenant (home-appliance services, not Dolphy).

A compound email asks about several unrelated things. Each requirement must be retrieved with
its own query and receive only its own evidence; one requirement's results must never answer
another, and no requirement may be silently dropped.
"""

import pytest

from app.contracts.requirement_plan import IntentType, PlannedRequirement, RequirementPlan
from app.services.evidence_fusion import evidence_fusion_service
from app.services.retrieval_router import retrieval_router_service


def _plan(tenant: str, reqs):
    return RequirementPlan(
        tenant_id=tenant, integration_account_id="itest", thread_id="thr_itest_multi", message_id="msg_itest_multi",
        context_revision=1, intent=IntentType.PRODUCT_LOOKUP,
        query_text=" ".join(r.query_text for r in reqs), requirements=reqs,
    )


@pytest.mark.asyncio
async def test_each_requirement_gets_its_own_evidence(seeded_tenant):
    reqs = [
        PlannedRequirement(requirement_id="req_ac", intent=IntentType.PRICE_QUERY, query_text="AC gas refill price", requested_count=3),
        PlannedRequirement(requirement_id="req_geyser", intent=IntentType.PRODUCT_LOOKUP, query_text="geyser not heating repair", requested_count=3),
        PlannedRequirement(requirement_id="req_tv", intent=IntentType.PRODUCT_LOOKUP, query_text="mount my TV on the wall", requested_count=3),
    ]
    plan = _plan(seeded_tenant, reqs)
    res = await retrieval_router_service.route_and_retrieve(tenant_id=seeded_tenant, plan=plan, dispatch_event=False)

    by_req = {r.requirement_id: [i for i in res.results if r.requirement_id in i.requirement_ids] for r in reqs}
    # No requirement is dropped: each one has evidence of its own.
    assert all(by_req[r] for r in by_req), {k: [i.title for i in v] for k, v in by_req.items()}
    # Each requirement's top evidence is the right service (synthetic catalogue HA-001..HA-024).
    assert by_req["req_ac"][0].external_identity_key == "HA-003", [i.title for i in by_req["req_ac"]]
    assert "geyser" in by_req["req_geyser"][0].title.lower(), [i.title for i in by_req["req_geyser"]]
    assert by_req["req_tv"][0].external_identity_key == "HA-022", [i.title for i in by_req["req_tv"]]

    # Evidence fusion keeps them apart: the TV requirement never receives geyser or AC evidence.
    fus = await evidence_fusion_service.fuse_and_verify(tenant_id=seeded_tenant, plan=plan, retrieval_result=res, dispatch_event=False)
    groups = {g.requirement_id: g for g in fus.requirements}
    assert set(groups) >= {"req_ac", "req_geyser", "req_tv"}
    for rid, group in groups.items():
        if rid not in by_req:
            continue
        own = {i.entity_id for i in by_req[rid]}
        got = [c.entity_id for c in group.verified_candidates]
        assert got, f"{rid} received no evidence"
        # Only evidence retrieved FOR this requirement (no leakage from the other two).
        assert set(got) <= own, (rid, [c.title for c in group.verified_candidates])
    assert not any("geyser" in c.title.lower() for c in groups["req_tv"].verified_candidates)


@pytest.mark.asyncio
async def test_single_requirement_path_unchanged(seeded_tenant):
    plan = _plan(seeded_tenant, [PlannedRequirement(requirement_id="req_only", query_text="RO water purifier service", requested_count=3)])
    res = await retrieval_router_service.route_and_retrieve(tenant_id=seeded_tenant, plan=plan, dispatch_event=False)
    assert res.results and all(not i.requirement_ids for i in res.results)
    assert "ro" in res.results[0].title.lower() or "purifier" in res.results[0].title.lower()


@pytest.mark.asyncio
async def test_cross_tenant_multi_requirement_plan_rejected(seeded_tenant):
    plan = _plan("org_someone_else", [
        PlannedRequirement(requirement_id="a", query_text="AC service"),
        PlannedRequirement(requirement_id="b", query_text="geyser repair"),
    ])
    with pytest.raises(PermissionError):
        await retrieval_router_service.route_and_retrieve(tenant_id=seeded_tenant, plan=plan, dispatch_event=False)
