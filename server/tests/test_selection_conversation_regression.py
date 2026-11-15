"""Regression: the production hand-dryer conversation, replayed on an isolated synthetic tenant.

Production failure (2026-11-14): after the customer chose one listed product, the system treated the
choice as "more options" (excluding the chosen item), and every follow-up ("how do I order", "5 qty and
best discount") rediscovered the catalogue and listed other products; HUMAN_REVIEW drafts were also
auto-sent. Same conversation shape here, on the home-appliance services fixture (a different business),
through the real planner (AI #1), retrieval, fusion, packaging and drafter (AI #2).
"""

import re
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text

from app.contracts.reply_planner import ReplyDisposition
from app.core.database import db_manager
from app.services.context_resolver import ContextEnvelope, ContextMessage
from app.services.conversation_selection import PresentedItem
from app.services.evidence_fusion import evidence_fusion_service
from app.services.evidence_package import evidence_package_service
from app.services.reply_planner import reply_planner_service
from app.services.requirement_planner import requirement_planner_service
from app.services.requirement_planner.service import RequirementPlannerService
from app.services.retrieval_router import retrieval_router_service

PRESENTED_KEYS = ("HA-003", "HA-001", "HA-002")       # AC Gas Refill, AC General Service, AC Deep Cleaning
SELECTED_KEY = "HA-003"


async def _presented(tenant: str):
    async with db_manager.session_factory() as db:
        rows = (await db.execute(text(
            "SELECT id, external_identity_key, title FROM knowledge_items WHERE tenant_id=:t AND external_identity_key = ANY(:k)"),
            {"t": tenant, "k": list(PRESENTED_KEYS)})).all()
    return [PresentedItem(entity_id=r.id, external_key=r.external_identity_key, title=r.title) for r in rows]


def _envelope(tenant: str, history, current: str, turn: int) -> ContextEnvelope:
    t0 = datetime(2026, 11, 14, 17, 0, tzinfo=timezone.utc)
    prev = [ContextMessage(id=f"msg_sel_{i}", external_message_id=f"ext_sel_{i}", direction=d,
                           from_email="customer@example.com" if d == "inbound" else "sales@example.com",
                           subject="Enquiry", body_text=b, sent_at=(t0 + timedelta(minutes=i)).isoformat())
            for i, (d, b) in enumerate(history)]
    cur = ContextMessage(id=f"msg_sel_cur{turn}", external_message_id=f"ext_sel_cur{turn}", direction="inbound",
                         from_email="customer@example.com", subject="Enquiry", body_text=current,
                         sent_at=(t0 + timedelta(minutes=len(history))).isoformat())
    return ContextEnvelope(tenant_id=tenant, integration_account_id="itest", provider_thread_id="pt_sel_itest",
                           thread_id=f"thr_sel_itest_{turn}", current_message_id=cur.id, context_revision=turn,
                           current_message=cur, relevant_previous_messages=prev)


async def _turn(tenant, history, message, turn, presented, monkeypatch):
    async def fake_presented(_envelope):
        return presented
    monkeypatch.setattr(RequirementPlannerService, "_load_presented", staticmethod(fake_presented))
    env = _envelope(tenant, history, message, turn)
    plan = await requirement_planner_service.plan_requirements(envelope=env, dispatch_event=False)
    ret = await retrieval_router_service.route_and_retrieve(tenant_id=tenant, plan=plan, dispatch_event=False)
    fus = await evidence_fusion_service.fuse_and_verify(tenant_id=tenant, plan=plan, retrieval_result=ret, dispatch_event=False)
    pkg = await evidence_package_service.build_package(tenant_id=tenant, fusion_result=fus, plan=plan, dispatch_event=False)
    rp = await reply_planner_service.plan_and_draft_reply(tenant_id=tenant, package=pkg, db=None, dispatch_event=False)
    return plan, ret, rp


def _other_titles(presented, body: str):
    return [p.title for p in presented if p.external_key != SELECTED_KEY and p.title.lower() in body.lower()]


@pytest.mark.asyncio
async def test_selected_item_is_kept_through_order_and_discount(seeded_tenant, monkeypatch):
    presented = await _presented(seeded_tenant)
    assert len(presented) == 3
    selected = next(p for p in presented if p.external_key == SELECTED_KEY)
    history = [("inbound", "Hello, I need AC servicing. Please share prices for your AC services."),
               ("outbound", "Here are our AC services: AC Gas Refill, AC General Service, AC Deep Cleaning.")]

    # Turn 2: the customer selects one listed item.
    plan, ret, rp = await _turn(seeded_tenant, history, "Okay so I want the AC gas refill.", 2, presented, monkeypatch)
    assert plan.active_selection and plan.active_selection["external_key"] == SELECTED_KEY
    assert plan.intent.value not in ("more_options", "different_options")
    assert selected.entity_id not in plan.excluded_entity_ids
    assert [i.external_identity_key for i in ret.results] == [SELECTED_KEY]
    body = rp.draft.body_text if rp.draft else ""
    assert not _other_titles(presented, body), body
    assert "additional option" not in body.lower(), body

    # Turn 3: order placement about the selected item.
    history += [("inbound", "Okay so I want the AC gas refill."), ("outbound", rp.draft.body_text if rp.draft else "")]
    plan, ret, rp = await _turn(seeded_tenant, history, "Now tell me how can I place the order?", 3, presented, monkeypatch)
    assert plan.active_selection["external_key"] == SELECTED_KEY
    assert [i.external_identity_key for i in ret.results] == [SELECTED_KEY]
    body = rp.draft.body_text if rp.draft else ""
    assert not _other_titles(presented, body), body

    # Turn 4: quantity + discount. Selection kept, no invented discount, held for the team.
    history += [("inbound", "Now tell me how can I place the order?"), ("outbound", body)]
    plan, ret, rp = await _turn(seeded_tenant, history, "I want 5 qty and best discount also.", 4, presented, monkeypatch)
    assert plan.active_selection["external_key"] == SELECTED_KEY
    assert [i.external_identity_key for i in ret.results] == [SELECTED_KEY]
    body = rp.draft.body_text if rp.draft else ""
    assert not _other_titles(presented, body), body
    assert not re.search(r"\b\d{1,2}\s?%\s*(?:off|discount)|discount of\s*[₹\d]", body, re.I), body
    assert rp.disposition != ReplyDisposition.SEND          # discount needs the team; never auto-sent


@pytest.mark.asyncio
async def test_asking_for_alternatives_clears_the_selection(seeded_tenant, monkeypatch):
    presented = await _presented(seeded_tenant)
    history = [("inbound", "Please share prices for your AC services."),
               ("outbound", "Here are our AC services: AC Gas Refill, AC General Service, AC Deep Cleaning."),
               ("inbound", "Okay so I want the AC gas refill."),
               ("outbound", "Sure, AC Gas Refill is available.")]
    plan, ret, _rp = await _turn(seeded_tenant, history, "Can you show me some other options?", 5, presented, monkeypatch)
    assert plan.active_selection is None and not plan.focus_entity_ids
