"""Regression: the production minibar conversation (2026-11-15), replayed generically on the isolated
home-appliance services tenant (HA-001..HA-024), through the real AI #1, retrieval, fusion, packaging
and AI #2.

Production failures reproduced here in another business's data:
  * "codes of these" was treated as "more options": the listed items were excluded and other items sent
  * an opening request ("all ... ") was treated as a selection of one item, and that stale selection
    then pinned every later turn (new codes, "most affordable", new categories) to the same item
  * a code that does not exist got "I can't verify", with no closest-code suggestion
  * codes in a reply were never checked against the evidence
"""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text

from app.core.database import db_manager
from app.services.context_resolver import ContextEnvelope, ContextMessage
from app.services.conversation_selection import PresentedItem
from app.services.evidence_fusion import evidence_fusion_service
from app.services.evidence_package import evidence_package_service
from app.services.reply_planner import reply_planner_service
from app.services.reply_planner.validator import _ungrounded_codes
from app.services.requirement_planner import requirement_planner_service
from app.services.requirement_planner.service import RequirementPlannerService
from app.services.retrieval_router import retrieval_router_service

T0 = datetime(2026, 11, 15, 12, 0, tzinfo=timezone.utc)
LISTED = ("HA-001", "HA-002", "HA-003", "HA-017", "HA-021")   # the AC services we listed


async def _items(tenant):
    async with db_manager.session_factory() as db:
        rows = (await db.execute(text(
            "SELECT id, external_identity_key AS k, title FROM knowledge_items WHERE tenant_id=:t"),
            {"t": tenant})).all()
    return {r.k: r for r in rows}


def _env(tenant, history, current, turn):
    prev = [ContextMessage(id=f"msg_ref_{i}", external_message_id=f"ext_ref_{i}", direction=d,
                           from_email="customer@example.com" if d == "inbound" else "sales@example.com",
                           subject="Enquiry", body_text=b, sent_at=at.isoformat())
            for i, (d, b, at) in enumerate(history)]
    cur = ContextMessage(id=f"msg_ref_cur{turn}", external_message_id=f"ext_ref_cur{turn}", direction="inbound",
                         from_email="customer@example.com", subject="Enquiry", body_text=current,
                         sent_at=(T0 + timedelta(minutes=30 + turn)).isoformat())
    return ContextEnvelope(tenant_id=tenant, integration_account_id="itest", provider_thread_id="pt_ref",
                           thread_id=f"thr_ref_itest_{turn}", current_message_id=cur.id, context_revision=turn,
                           current_message=cur, relevant_previous_messages=prev)


async def _turn(tenant, history, message, turn, presented, monkeypatch):
    async def fake_presented(_e):
        return presented
    monkeypatch.setattr(RequirementPlannerService, "_load_presented", staticmethod(fake_presented))
    plan = await requirement_planner_service.plan_requirements(envelope=_env(tenant, history, message, turn),
                                                               dispatch_event=False)
    ret = await retrieval_router_service.route_and_retrieve(tenant_id=tenant, plan=plan, dispatch_event=False)
    fus = await evidence_fusion_service.fuse_and_verify(tenant_id=tenant, plan=plan, retrieval_result=ret,
                                                        dispatch_event=False)
    pkg = await evidence_package_service.build_package(tenant_id=tenant, fusion_result=fus, plan=plan,
                                                       dispatch_event=False)
    rp = await reply_planner_service.plan_and_draft_reply(tenant_id=tenant, package=pkg, db=None, dispatch_event=False)
    keys = [i.external_identity_key for i in ret.results]
    body = rp.draft.body_text or ""
    assert not _ungrounded_codes(body, pkg), (message, body)       # never a code outside the evidence
    return plan, keys, pkg, body


@pytest.mark.asyncio
async def test_reference_resolution_across_a_conversation(seeded_tenant, monkeypatch):
    items = await _items(seeded_tenant)
    presented = [PresentedItem(items[k].id, k, items[k].title, T0 + timedelta(minutes=1), "out_ref_1") for k in LISTED]
    listing = "\n".join(f"- {items[k].title}" for k in LISTED)
    history = [("inbound", "Please share the price of all your AC services", T0),
               ("outbound", f"Here are our AC services:\n{listing}", T0 + timedelta(minutes=1))]

    # 1. "codes of these" -> exactly the listed items, never excluded / replaced
    plan, keys, _pkg, body = await _turn(seeded_tenant, history, "tell me the service codes of these all", 1,
                                         presented, monkeypatch)
    assert plan.reference_scope == "listed_items", plan.reference_scope
    assert set(keys) == set(LISTED), keys
    assert all(k in body for k in LISTED), body

    # 2. a code that does not exist -> said plainly, closest real codes suggested, nothing invented
    plan, keys, pkg, body = await _turn(seeded_tenant, history, "need HA-0170 price", 2, presented, monkeypatch)
    assert pkg.unknown_identifiers and pkg.unknown_identifiers[0]["requested"] == "HA-0170", pkg.unknown_identifiers
    assert pkg.unknown_identifiers[0]["suggestions"], pkg.unknown_identifiers
    assert "HA-0170" in body

    # 3. an existing code outside the list -> retrieved (not stuck on an earlier item)
    history2 = history + [("inbound", "ok I want the AC gas refill", T0 + timedelta(minutes=3))]
    plan, keys, _pkg, body = await _turn(seeded_tenant, history2, "what is the price of HA-012", 3, presented, monkeypatch)
    assert plan.focus_entity_ids == [] and "HA-012" in keys, (plan.reference_scope, keys)

    # 4. catalogue-wide question after a selection -> fresh retrieval, not the selected item only
    plan, keys, _pkg, body = await _turn(seeded_tenant, history2, "which is the most affordable service you offer?", 4,
                                         presented, monkeypatch)
    assert plan.focus_entity_ids == [], plan.reference_scope
    assert keys != ["HA-003"], keys

    # 4b. "cheapest" is decided by price over ALL eligible items, not by relevance
    async with db_manager.session_factory() as db:
        rows = (await db.execute(text("""SELECT i.external_identity_key k, v.canonical_data cd FROM knowledge_items i
            JOIN knowledge_versions v ON v.id = i.current_version_id WHERE i.tenant_id=:t"""), {"t": seeded_tenant})).all()
    def _price(cd):
        p = (cd.get("pricing") or {}).get("base_price") or cd.get("price") or cd.get("base_price")
        try:
            return float(p)
        except (TypeError, ValueError):
            return None
    ac = {r.k: _price(r.cd) for r in rows if r.k in ("HA-001", "HA-002", "HA-003", "HA-017", "HA-021") and _price(r.cd)}
    cheapest = min(ac, key=ac.get)
    plan, keys, _pkg, body = await _turn(seeded_tenant, history, "which AC service is the cheapest one? only AC please", 6,
                                         presented, monkeypatch)
    assert plan.comparison.ranking_criterion, plan.comparison
    assert keys and keys[0] == cheapest, (keys, ac)
    assert cheapest in body or items[cheapest].title in body, body

    # 5. a real follow-up on the chosen item keeps it
    plan, keys, _pkg, body = await _turn(seeded_tenant, history2, "how can I book it?", 5, presented, monkeypatch)
    assert plan.active_selection and plan.active_selection["external_key"] == "HA-003", plan.reference_scope
