"""Conversation intelligence & follow-ups — end-to-end behaviour on a real (throwaway) Postgres.

Runs the PRODUCTION trigger, assessment service, engine, scheduler, gate, notice fan-out, delivery
path and API. AI #2 output is scripted per message (the model decides meaning; these tests verify
everything the application does with that meaning). Every external side effect is a spy:
  * model client  -> scripted results, counted (a real model call fails the test)
  * Gmail send    -> ``dispatch_with_reconciliation`` spy, counted
  * team email    -> ``transactional_email.send_email`` spy, counted per recipient
Refuses to run against anything but a local database.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone

import httpx
import pytest
from sqlalchemy import func, select, text

from tests.followup_world import R, World, build_world, destroy_world, is_local_database

if not is_local_database():
    pytest.skip("follow-up integration tests run only against a local throwaway database",
                allow_module_level=True)

from app.core.database import db_manager  # noqa: E402
from app.models.followup import (  # noqa: E402
    ContactSuppression, FollowupNoticeDelivery, FollowupOccurrence, MessageAssessment, ThreadFollowupControl,
)
from app.models.outbound import DeliveryStatus, OutboundMessage  # noqa: E402
from app.models.outbox import OutboxEvent  # noqa: E402
from app.services.followups import engine, gate  # noqa: E402
from app.services.followups.flags import reset_flags_cache  # noqa: E402
from app.services.followups.scheduler import FollowupScheduler, idem_key  # noqa: E402

UTC = timezone.utc
CUSTOMER = "buyer@client.example"


def utc(*a):
    return datetime(*a, tzinfo=UTC)


# ---------------------------------------------------------------------------------------------
# fixtures: isolated world + spies on every provider
# ---------------------------------------------------------------------------------------------

@pytest.fixture
async def w(monkeypatch):
    monkeypatch.setenv("FOLLOWUP_ASSESSMENT_ENABLED", "true")
    monkeypatch.setenv("FOLLOWUP_SHADOW_MODE", "false")
    monkeypatch.setenv("FOLLOWUP_REMINDERS_ENABLED", "true")
    monkeypatch.setenv("FOLLOWUP_CUSTOMER_SEND_ENABLED", "false")
    monkeypatch.setenv("FOLLOWUP_ASSESS_MAX_AGE_HOURS", "48")
    reset_flags_cache()
    world = await build_world(uuid.uuid4().hex[:10])

    async def fake_model(ctx):
        world.spies.model_calls.append(ctx.message_id)
        if ctx.message_id not in world.scripts:
            raise RuntimeError("no scripted result")
        return world.scripts[ctx.message_id]

    async def fake_compose(payload):
        world.spies.compose_calls += 1
        return world.scripts.get("__compose__", "Just checking in on the 40 units you asked about.")

    async def gmail_spy(db, outbound, account, *, gmail_thread_id, send_kwargs):
        world.spies.gmail_calls.append({"to": send_kwargs["to_email"], "idem": outbound.idempotency_key})
        outbound.delivery_status = DeliveryStatus.SEND_ATTEMPTED.value
        await db.commit()
        if world.scripts.get("__gmail_fail__"):
            outbound.delivery_status = DeliveryStatus.DELIVERY_UNKNOWN.value
            await db.commit()
            raise RuntimeError("connection reset after send")
        return {"id": f"prov_{len(world.spies.gmail_calls)}_{uuid.uuid4().hex[:6]}"}

    async def team_mail_spy(to, subject, text_body, html_body):
        world.spies.team_mail.append({"to": to, "subject": subject, "text": text_body})
        hook = world.scripts.get("__mail_hook__")
        if hook:
            return await hook(to)
        return world.scripts.get("__mail_mode__", False)       # False = log mode

    async def no_real_llm(*a, **k):
        raise AssertionError("a real model call was attempted")

    monkeypatch.setattr("app.services.followups.assessor.call_model", fake_model)
    monkeypatch.setattr("app.services.followups.composer.call_composer", fake_compose)
    monkeypatch.setattr("app.services.llm_retry.create_with_retry", no_real_llm)
    monkeypatch.setattr("app.services.reply_planner.delivery.dispatch_with_reconciliation", gmail_spy)
    monkeypatch.setattr("app.services.transactional_email.send_email", team_mail_spy)
    try:
        yield world
    finally:
        await destroy_world(world)
        reset_flags_cache()


def enable_customer_send(monkeypatch):
    monkeypatch.setenv("FOLLOWUP_CUSTOMER_SEND_ENABLED", "true")
    reset_flags_cache()


async def permit_customer_email(w: World, thread_id: str, *, by: str = "member", recipient: str = CUSTOMER):
    async with db_manager.session_factory() as db:
        c = await engine.get_or_create_control(db, w.tenant_id, thread_id)
        c.customer_email_enabled, c.customer_recipient_email = True, recipient
        c.customer_email_enabled_by, c.customer_email_enabled_at = w.users[by], datetime.now(UTC)
        c.version += 1
        await engine.reapply_latest(db, tenant_id=w.tenant_id, thread_id=thread_id)
        await db.commit()


ACTIVE_TEAM = ("owner", "admin", "member", "viewer")


# ---------------------------------------------------------------------------------------------
# Scenario 1 — industrial supplier (Meera): cold -> warm -> hot; the team owes the quote
# ---------------------------------------------------------------------------------------------

async def test_meera_reassesses_each_message_and_tracks_team_promise(w):
    t0 = utc(2026, 11, 30, 5, 0)                                       # Monday 10:30 IST
    th = await w.thread("Catalogue request")
    await w.say(th, "inbound", "Bas catalogue bhej dijiye, buying plan abhi nahi hai.", t0,
                R(temperature="cold", buying_interest=0.1, decision="wait_team", next_actor="team",
                  next_action="Send the catalogue", outcome="unknown"))
    s = await w.state(th)
    assert (s.suggested_temperature, s.effective_temperature, s.temperature_source) == ("cold", "cold", "ai")
    await w.say(th, "inbound", "We shortlisted two models. Can you compare warranty?", t0 + timedelta(days=1),
                R(temperature="warm", buying_interest=0.55, decision="wait_team", next_actor="team",
                  next_action="Send the comparison"))
    assert (await w.state(th)).effective_temperature == "warm"
    m3 = await w.say(
        th, "inbound", "We need 40 units. Please send the final quote by Thursday so I can release the PO.",
        t0 + timedelta(days=2),
        R(temperature="hot", buying_interest=0.9, decision="wait_team", next_actor="team",
          next_action="Send the final quote for 40 units",
          opportunities=[{"key": "units_40", "subject": "40 units", "status": "open", "temperature": "hot",
                          "evidence_message_ids": []}],
          timing={"kind": "team_deadline", "phrase": "by Thursday", "local_date": "2026-12-03",
                  "precision": "date", "internal_reminder_note": "Send the final quote before Thursday"}))
    s = await w.state(th)
    assert s.effective_temperature == "hot" and s.status == "waiting_team" and s.next_actor == "team"
    assert s.last_message_id == m3 and not s.stale
    live = await w.live(th)
    assert len(live) == 1 and live[0].origin == "ai" and live[0].customer_status == "not_applicable"
    assert live[0].due_at == utc(2026, 12, 3, 4, 30)                     # Thursday 10:00 IST internal task
    assert len(w.spies.model_calls) == 3                                 # every message reassessed
    assert (await w.sql("SELECT lead_intent FROM email_threads WHERE id=:t", t=th))[0][0] == "hot"


# ---------------------------------------------------------------------------------------------
# Scenario 2 — training consultancy (Kavya): exact instants, team fan-out, zero customer email
# ---------------------------------------------------------------------------------------------

KAVYA = R(temperature="hot", buying_interest=0.85, decision="schedule", next_actor="team",
          next_action="Call Kavya to book the workshop", outcome="open_unconfirmed",
          timing={"kind": "customer_commitment", "phrase": "15 December 2026 ... that afternoon at 3 PM IST",
                  "local_date": "2026-12-15", "local_time": "15:00", "timezone": "IST",
                  "timezone_evidence": "3 PM IST", "precision": "instant"})


async def test_kavya_exact_due_notice_and_team_fanout_with_zero_customer_email(w):
    th = await w.thread("Workshop booking")
    sent = utc(2026, 12, 1, 6, 0)
    await w.say(th, "inbound", "We intend to book the workshop on 15 December 2026. Please contact me that "
                "afternoon at 3 PM IST.", sent, KAVYA)
    s = await w.state(th)
    assert s.status == "scheduled" and s.due_at == utc(2026, 12, 15, 9, 30)
    assert s.notice_at == utc(2026, 12, 14, 4, 30) and s.due_source == "customer_date" and s.due_tz == "Asia/Kolkata"
    [occ] = await w.live(th)
    assert occ.customer_status == "not_applicable"                         # reminder-only by default

    sch = FollowupScheduler()
    assert (await sch.run_once(now=utc(2026, 12, 14, 4, 29), tenant_id=w.tenant_id))["advance"] == 0
    await sch.run_once(now=utc(2026, 12, 14, 4, 30), tenant_id=w.tenant_id)
    to = sorted(m["to"] for m in w.spies.team_mail)
    assert to == sorted(w.emails[k] for k in ACTIVE_TEAM)                # removed/invited/suspended excluded
    viewer_mail = next(m for m in w.spies.team_mail if m["to"] == w.emails["viewer"])
    assert "Workshop booking" not in viewer_mail["subject"]               # generic notice for no-inbox role
    rows = await w.sql("SELECT status FROM followup_notice_deliveries WHERE occurrence_id=:o", o=occ.id)
    assert {r[0] for r in rows} == {"logged"}                              # log mode is never "accepted"

    await sch.run_once(now=utc(2026, 12, 14, 4, 40), tenant_id=w.tenant_id)   # no duplicate notices
    assert len(w.spies.team_mail) == 4

    w.scripts["__mail_mode__"] = True                                       # provider accepts
    await sch.run_once(now=utc(2026, 12, 15, 9, 30), tenant_id=w.tenant_id)
    due_mail = w.spies.team_mail[4:]
    assert len(due_mail) == 4 and all("has NOT been emailed" in m["text"] for m in due_mail
                                      if m["to"] != w.emails["viewer"])
    assert w.spies.gmail_calls == [] and w.spies.compose_calls == 0         # zero customer drafts / sends
    occ = (await w.occurrences(th))[0]
    assert occ.status == "done" and occ.due_notice_status == "done" and occ.advance_status == "done"
    assert (await w.state(th)).attempts_used == 1
    acc = await w.sql("SELECT status, count(*) FROM followup_notice_deliveries WHERE occurrence_id=:o "
                      "AND notice_type='due' GROUP BY status", o=occ.id)
    assert acc == [("accepted", 4)]


async def test_kavya_changes_date_supersedes_december_work(w):
    th = await w.thread("Workshop booking")
    sent = utc(2026, 12, 1, 6, 0)
    await w.say(th, "inbound", "Book 15 December, call me at 3 PM IST.", sent, KAVYA)
    [dec] = await w.live(th)
    await w.say(th, "inbound", "Jan 8 at the same time instead.", utc(2026, 12, 3, 6, 0), R(
        **{**KAVYA, "timing": {**KAVYA["timing"], "phrase": "Jan 8 at the same time", "local_date": "2027-01-08"},
           "constraints": {**KAVYA["constraints"], "changed_date": True}}))
    occs = {o.id: o for o in await w.occurrences(th)}
    assert occs[dec.id].status == "superseded"
    [jan] = await w.live(th)
    assert jan.due_at == utc(2027, 1, 8, 9, 30) and jan.notice_at == utc(2027, 1, 7, 4, 30)
    await FollowupScheduler().run_once(now=utc(2026, 12, 14, 4, 30), tenant_id=w.tenant_id)
    assert w.spies.team_mail == []                                          # December reminders never fire


async def test_owner_who_schedules_gets_one_notice_per_stage(w):
    th = await w.thread("Manual schedule")
    await w.msg(th, "inbound", "Let's talk next month.", utc(2026, 12, 1, 6, 0))
    day = (datetime.now(UTC) + timedelta(days=40)).date()
    while day.weekday() != 1:                                              # a Tuesday ~6 weeks out
        day += timedelta(days=1)
    async with api(w, "owner") as cl:
        version = (await cl.get(f"/followups/threads/{th}")).json()["version"]
        r = await cl.post(f"/followups/threads/{th}/schedule",
                          json={"version": version, "local_date": day.isoformat(), "local_time": "11:00"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["due"]["at"].startswith(f"{day.isoformat()}T05:30") and body["status"] == "waiting_team"
        notice_at = datetime.fromisoformat(body["notice"]["at"])
        assert notice_at.astimezone(timezone(timedelta(hours=5, minutes=30))).strftime("%a %H:%M") == "Mon 10:00"
        r2 = await cl.post(f"/followups/threads/{th}/schedule",
                           json={"version": version, "local_date": day.isoformat(), "local_time": "12:00"})
        assert r2.status_code == 409                                       # concurrent edit is refused
    await FollowupScheduler().run_once(now=notice_at, tenant_id=w.tenant_id)
    owners = [m for m in w.spies.team_mail if m["to"] == w.emails["owner"]]
    assert len(owners) == 1 and len(w.spies.team_mail) == 4


# ---------------------------------------------------------------------------------------------
# Scenario 3 — software company (Arjun): purchase unconfirmed stays open; "we signed" closes
# ---------------------------------------------------------------------------------------------

async def test_arjun_open_unconfirmed_then_signed_closes_matching_followup(w):
    th = await w.thread("Deployment proposal")
    t = utc(2026, 12, 7, 6, 0)                                             # Monday
    await w.msg(th, "outbound", "Attached is our proposal for the deployment.", t - timedelta(days=1))
    await w.say(th, "inbound", "Finance is still reviewing.", t, R(
        temperature="warm", outcome="open_unconfirmed", decision="schedule", next_actor="customer",
        opportunities=[{"key": "subscription", "subject": "deployment subscription", "status": "open",
                        "temperature": "warm", "evidence_message_ids": []}],
        timing={"kind": "cadence", "cadence_reason": "decision pending with finance; a light check-in fits"}))
    s = await w.state(th)
    assert s.status == "scheduled" and s.outcome == "open_unconfirmed"
    [occ] = await w.live(th)
    assert occ.origin == "cadence" and occ.due_at == utc(2026, 12, 10, 4, 30)   # 3 business days, 10:00 IST
    await w.say(th, "inbound", "We signed yesterday.", t + timedelta(days=1), R(
        temperature="hot", outcome="completed", decision="none", next_actor="team",
        opportunities=[{"key": "subscription", "subject": "deployment subscription", "status": "completed",
                        "temperature": "hot", "evidence_message_ids": []}]))
    s = await w.state(th)
    assert s.status == "closed" and s.outcome == "completed" and await w.live(th) == []
    assert (await w.occurrences(th))[0].status == "cancelled"


# ---------------------------------------------------------------------------------------------
# Scenario 4 — design agency (Nisha): refusal fences, suppresses durably, zero customer sends
# ---------------------------------------------------------------------------------------------

HOT_SCHEDULED = R(temperature="hot", buying_interest=0.9, decision="schedule", next_actor="customer",
                  timing={"kind": "customer_request", "local_date": "2026-12-04", "local_time": "11:00",
                          "precision": "instant"})


async def test_nisha_refusal_invalidates_queued_email_and_cannot_be_revived(w, monkeypatch):
    enable_customer_send(monkeypatch)
    th = await w.thread("Brand refresh")
    t = utc(2026, 12, 1, 6, 0)
    await w.say(th, "inbound", "Love the moodboard, let's talk Friday 11am.", t, HOT_SCHEDULED)
    await permit_customer_email(w, th)
    [queued] = await w.live(th)
    assert queued.customer_status == "pending"

    # The refusal is stored; BEFORE AI #2 runs, the fence already blocks the queued send.
    refusal = await w.msg(th, "inbound", "Aage se kabhi message mat karna.", t + timedelta(days=1))
    async with db_manager.session_factory() as db:
        occ = await db.get(FollowupOccurrence, queued.id)
        g = await gate.evaluate(db, occ, utc(2026, 12, 4, 5, 30))
        assert not g.ok and g.reason == "awaiting_assessment_of_new_message"
    await FollowupScheduler().run_once(now=utc(2026, 12, 4, 5, 30), tenant_id=w.tenant_id)
    assert w.spies.gmail_calls == []

    w.script(refusal, R(temperature="cold", decision="suppress", outcome="declined", next_actor="unclear",
                        constraints={"refusal_scope": "all_contact", "refusal_quote": "Aage se kabhi message mat karna"}))
    assert (await w.assess(refusal, th, t + timedelta(days=1, minutes=1))) == "applied"
    s = await w.state(th)
    assert s.status == "suppressed" and await w.live(th) == []
    sup = (await w.sql("SELECT scope, recipient_email FROM contact_suppressions WHERE tenant_id=:t", t=w.tenant_id))
    assert sup == [("all", CUSTOMER)]

    # Worker retry of the same event: idempotent, no second model call.
    calls = len(w.spies.model_calls)
    assert await w.assess(refusal, th, t + timedelta(days=1, minutes=2)) == "duplicate"
    assert len(w.spies.model_calls) == calls

    # A later-imported OLDER email with a Hot reading cannot revive it.
    old = await w.msg(th, "inbound", "So excited to start!", t + timedelta(hours=2))
    w.script(old, HOT_SCHEDULED)
    assert (await w.assess(old, th, t + timedelta(days=1, minutes=3))) == "superseded"
    assert (await w.state(th)).status == "suppressed"

    # A different thread for the same recipient in this tenant: a Hot label cannot re-open contact.
    th2 = await w.thread("New idea")
    await w.say(th2, "inbound", "One more idea for you", t + timedelta(days=2), HOT_SCHEDULED)
    assert (await w.state(th2)).status == "suppressed" and await w.live(th2) == []

    await FollowupScheduler().run_once(now=utc(2026, 12, 20, 5, 30), tenant_id=w.tenant_id)
    assert w.spies.gmail_calls == [] and w.spies.compose_calls == 0       # zero new customer sends


async def test_no_email_please_call_allows_internal_task_only(w, monkeypatch):
    enable_customer_send(monkeypatch)
    th = await w.thread("Quote")
    t = utc(2026, 12, 1, 6, 0)
    await w.say(th, "inbound", "Interested. Please don't email, call me Friday 11am.", t, R(
        **{**HOT_SCHEDULED, "constraints": {**HOT_SCHEDULED["constraints"], "refusal_scope": "email_only",
                                            "refusal_quote": "Please don't email, call me"}}))
    [occ] = await w.live(th)
    assert (await w.state(th)).status == "scheduled"                    # internal task still planned
    async with db_manager.session_factory() as db:
        assert (await db.execute(select(ContactSuppression.scope).where(
            ContactSuppression.tenant_id == w.tenant_id))).scalars().all() == ["email"]
    async with api(w, "member") as cl:                                    # cannot enable email for them
        body = (await cl.get(f"/followups/threads/{th}")).json()
        r = await cl.patch(f"/followups/threads/{th}/controls", json={
            "version": body["version"], "customer_email_enabled": True, "customer_recipient_email": CUSTOMER})
        assert r.status_code == 409
    await FollowupScheduler().run_once(now=utc(2026, 12, 4, 5, 30), tenant_id=w.tenant_id)
    assert w.spies.gmail_calls == [] and len(w.spies.team_mail) == 4       # team reminded, customer not emailed


# ---------------------------------------------------------------------------------------------
# Scenario 5 — logistics: scoped refusal closes one opportunity only
# ---------------------------------------------------------------------------------------------

async def test_logistics_scoped_refusal_closes_only_annual_contract(w):
    th = await w.thread("Freight")
    await w.say(th, "inbound", "No to the annual contract. Please quote only for the November shipment.",
                utc(2026, 11, 2, 6, 0), R(
        temperature="warm", decision="wait_team", next_actor="team", next_action="Quote the November shipment",
        matched_opportunity_key="november_shipment",
        opportunities=[
            {"key": "annual_contract", "subject": "annual contract", "status": "declined", "temperature": "cold",
             "evidence_message_ids": []},
            {"key": "november_shipment", "subject": "November shipment", "status": "open", "temperature": "warm",
             "evidence_message_ids": []}],
        constraints={"refusal_scope": "opportunity_only", "refusal_quote": "No to the annual contract"}))
    s = await w.state(th)
    opps = {o["key"]: o["status"] for o in s.opportunities}
    assert opps == {"annual_contract": "declined", "november_shipment": "open"}
    assert s.status == "waiting_team" and s.effective_temperature == "warm"
    assert (await w.sql("SELECT count(*) FROM contact_suppressions WHERE tenant_id=:t", t=w.tenant_id))[0][0] == 0


# ---------------------------------------------------------------------------------------------
# Scenario 6 — IT services: outage is support, not a Hot lead; "thank you" keeps renewal closed
# ---------------------------------------------------------------------------------------------

async def test_outage_is_support_and_courtesy_reply_does_not_reopen(w):
    th = await w.thread("Server down")
    await w.say(th, "inbound", "Server is down, call urgently", utc(2026, 12, 1, 6, 0), R(
        temperature="unknown", sales_relevance="support", decision="wait_team", next_actor="team",
        outcome="unknown", next_action="Route to support and call back"))
    s = await w.state(th)
    assert s.effective_temperature == "unknown" and s.status == "waiting_team"
    th2 = await w.thread("Renewal")
    await w.say(th2, "inbound", "Confirmed, renew for another year.", utc(2026, 12, 1, 6, 0), R(
        temperature="hot", outcome="completed", decision="none",
        opportunities=[{"key": "renewal", "subject": "renewal", "status": "completed", "temperature": "hot",
                        "evidence_message_ids": []}]))
    await w.say(th2, "inbound", "Thank you", utc(2026, 12, 2, 6, 0), R(
        temperature="hot", outcome="completed", decision="none", sales_relevance="administrative",
        opportunities=[{"key": "renewal", "subject": "renewal", "status": "completed", "temperature": "hot",
                        "evidence_message_ids": []}]))
    assert (await w.state(th2)).status == "closed" and await w.live(th2) == []


# ---------------------------------------------------------------------------------------------
# Scenario 7 — consulting: "03/04" stays uncertain; nothing exact, nobody emailed
# ---------------------------------------------------------------------------------------------

async def test_ambiguous_numeric_date_needs_review_and_never_contacts(w, monkeypatch):
    enable_customer_send(monkeypatch)
    th = await w.thread("Board decision")
    t = utc(2026, 12, 1, 6, 0)
    await w.say(th, "inbound", "We may decide around 03/04 after the board meeting.", t, R(
        decision="defer", timing={"kind": "customer_commitment", "phrase": "around 03/04", "ambiguous": True,
                                  "alternatives": ["2027-03-04", "2027-04-03"]}))
    await permit_customer_email(w, th)
    await w.say(th, "inbound", "That works", t + timedelta(hours=1), R(
        decision="needs_review", timing={"kind": "customer_commitment", "phrase": "around 03/04",
                                                           "ambiguous": True,
                                                           "alternatives": ["2027-03-04", "2027-04-03"]}),
        sender="colleague@client.example")
    s = await w.state(th)
    assert s.status == "needs_review" and s.needs_review and s.due_at is None
    assert "ambiguous_date" in s.review_reason and "2027-03-04" in s.review_reason and "2027-04-03" in s.review_reason
    assert [o for o in await w.live(th) if o.customer_status == "pending"] == []
    await FollowupScheduler().run_once(now=utc(2027, 4, 5), tenant_id=w.tenant_id)
    assert w.spies.gmail_calls == []


# ---------------------------------------------------------------------------------------------
# Scenario 8 — two opportunities / two threads; tenant isolation
# ---------------------------------------------------------------------------------------------

async def test_verified_order_closes_only_matching_opportunity_and_tenants_do_not_leak(w):
    t = utc(2026, 12, 1, 6, 0)
    a = await w.thread("Quote A")
    b = await w.thread("Quote B")
    for th, key in ((a, "item_a"), (b, "item_b")):
        await w.say(th, "inbound", f"Please hold the quote for {key}", t, R(
            decision="schedule", timing={"kind": "cadence"}, opportunities=[
                {"key": key, "subject": key, "status": "open", "temperature": "warm", "evidence_message_ids": []}]))
    await w.say(a, "inbound", "PO attached for item A.", t + timedelta(hours=2), R(
        outcome="completed", decision="none", temperature="hot", matched_opportunity_key="item_a",
        opportunities=[{"key": "item_a", "subject": "item_a", "status": "completed", "temperature": "hot",
                        "evidence_message_ids": []}]))
    assert (await w.state(a)).status == "closed" and (await w.state(b)).status == "scheduled"
    assert len(await w.live(b)) == 1

    other = await build_world(uuid.uuid4().hex[:10])
    try:
        async with db_manager.session_factory() as db:          # same email refused in the OTHER tenant
            db.add(ContactSuppression(tenant_id=other.tenant_id, recipient_email=CUSTOMER, scope="all"))
            await db.commit()
        th_other = await other.thread("Theirs")
        async with api(other, "owner") as cl:
            assert (await cl.get(f"/followups/threads/{b}")).status_code == 404       # no cross-tenant read
            assert (await cl.patch(f"/followups/threads/{b}/controls",
                                   json={"version": 1, "planning_enabled": False})).status_code == 404
        async with db_manager.session_factory() as db:
            sups = await engine.active_suppressions(db, w.tenant_id, [CUSTOMER], t)
            assert sups == []                                   # other tenant's restriction is not ours
        assert (await w.state(b)).status == "scheduled"
        assert th_other
    finally:
        await destroy_world(other)


# ---------------------------------------------------------------------------------------------
# Races & reliability
# ---------------------------------------------------------------------------------------------

async def test_reverse_order_model_results_cannot_overwrite_newer_decision(w):
    th = await w.thread("Race")
    t = utc(2026, 12, 1, 6, 0)
    m1 = await w.msg(th, "inbound", "Maybe later.", t)
    m2 = await w.msg(th, "inbound", "Actually, send the order form today.", t + timedelta(minutes=5))
    w.script(m1, R(temperature="cold", decision="none"))
    w.script(m2, R(temperature="hot", decision="wait_team", next_actor="team"))
    assert await w.assess(m2, th, t + timedelta(minutes=6)) == "applied"
    assert await w.assess(m1, th, t + timedelta(minutes=7)) == "superseded"       # never even calls the model
    assert w.spies.model_calls == [m2]
    # Even a result that already exists for the older message is not applied.
    async with db_manager.session_factory() as db:
        from app.services.followups import contracts
        row = MessageAssessment(tenant_id=w.tenant_id, thread_id=th, message_id=m1, message_sent_at=t,
                                prompt_version="manual-test", status="valid")
        db.add(row)
        await db.flush()
        res = contracts.validate(R(temperature="cold", decision="none"), known_message_ids=[m1], latest_message_id=m1,
                                 customer_texts=[], latest_is_outbound=False)
        out = await engine.apply_assessment(db, tenant_id=w.tenant_id, row=row, result=res, now=t + timedelta(minutes=8))
        await db.commit()
    assert not out.applied and out.reason == "superseded_by_newer_message"
    assert (await w.state(th)).effective_temperature == "hot"


async def test_model_failure_keeps_last_decision_stale_and_retries(w):
    th = await w.thread("Flaky")
    t = utc(2026, 12, 1, 6, 0)
    await w.say(th, "inbound", "Interested, call Friday.", t, HOT_SCHEDULED)
    m2 = await w.msg(th, "inbound", "One more question", t + timedelta(hours=1))   # no script -> provider error
    with pytest.raises(RuntimeError):
        await w.assess(m2, th, t + timedelta(hours=1, minutes=1))
    s = await w.state(th)
    assert s.stale and s.stale_reason == "assessment_failed" and s.effective_temperature == "hot"
    w.script(m2, R(temperature="hot", decision="wait_team", next_actor="team"))
    assert await w.assess(m2, th, t + timedelta(hours=1, minutes=5)) == "applied"
    assert not (await w.state(th)).stale


async def test_customer_send_happy_path_uses_one_idempotent_provider_call(w, monkeypatch):
    enable_customer_send(monkeypatch)
    th = await w.thread("40 units")
    t = utc(2026, 12, 1, 6, 0)
    await w.say(th, "inbound", "We need 40 units; check with me Friday 11am.", t, HOT_SCHEDULED)
    await permit_customer_email(w, th)
    [occ] = await w.live(th)
    stats = await FollowupScheduler().run_once(now=utc(2026, 12, 4, 5, 30), tenant_id=w.tenant_id)
    assert stats["customer_sent"] == 1
    assert w.spies.gmail_calls == [{"to": CUSTOMER, "idem": idem_key(occ.id)}]
    occ = (await w.occurrences(th))[0]
    assert occ.customer_status == "sent" and occ.status == "done"
    due_texts = [m["text"] for m in w.spies.team_mail if m["to"] == w.emails["owner"]]
    assert any("ProxiPilot emailed the customer" in x for x in due_texts)
    # the sent follow-up is a new team message: one assessment event, no duplicate on the echo
    events = await w.sql("SELECT count(*) FROM outbox_events WHERE tenant_id=:t AND event_type='followup.assess'",
                         t=w.tenant_id)
    assert events[0][0] == 2
    await FollowupScheduler().run_once(now=utc(2026, 12, 4, 6, 30), tenant_id=w.tenant_id)
    assert len(w.spies.gmail_calls) == 1                                  # never a second send


async def test_refusal_arriving_between_claim_and_send_produces_zero_provider_calls(w, monkeypatch):
    enable_customer_send(monkeypatch)
    th = await w.thread("Race to send")
    t = utc(2026, 12, 1, 6, 0)
    await w.say(th, "inbound", "Check with me Friday 11am.", t, HOT_SCHEDULED)
    await permit_customer_email(w, th)

    async def compose_while_customer_refuses(payload):
        w.spies.compose_calls += 1
        await w.msg(th, "inbound", "Please stop emailing me.", utc(2026, 12, 4, 5, 29))
        return "Just checking in about Friday."

    monkeypatch.setattr("app.services.followups.composer.call_composer", compose_while_customer_refuses)
    await FollowupScheduler().run_once(now=utc(2026, 12, 4, 5, 30), tenant_id=w.tenant_id)
    assert w.spies.compose_calls == 1 and w.spies.gmail_calls == []
    occ = (await w.occurrences(th))[0]
    assert occ.customer_status == "held" and occ.hold_reason == "awaiting_assessment_of_new_message"


async def test_kill_switch_revocation_and_mailbox_flag_block_sends_and_reconciler_resends(w, monkeypatch):
    enable_customer_send(monkeypatch)
    th = await w.thread("Gates")
    t = utc(2026, 12, 1, 6, 0)
    await w.say(th, "inbound", "Check with me Friday 11am.", t, HOT_SCHEDULED)
    await permit_customer_email(w, th)
    [occ] = await w.live(th)
    due = utc(2026, 12, 4, 5, 30)
    async with db_manager.session_factory() as db:
        o = await db.get(FollowupOccurrence, occ.id)
        assert (await gate.evaluate(db, o, due)).ok
        from app.models.integration import ConnectedIntegrationAccount
        acct = await db.get(ConnectedIntegrationAccount, w.account_id)
        acct.automation_enabled = False
        await db.commit()
        assert (await gate.evaluate(db, o, due)).reason == "mailbox_automation_disabled"
        acct.automation_enabled = True
        await db.commit()

    # A failed-retryable follow-up outbound: the reconciler re-runs the gate before any resend.
    async with db_manager.session_factory() as db:
        out = OutboundMessage(id=f"out_{uuid.uuid4().hex[:12]}", tenant_id=w.tenant_id, thread_id=th,
                              integration_account_id=w.account_id, to_emails=f'["{CUSTOMER}"]', subject="Re:",
                              body_text="x", body_html="<p>x</p>", idempotency_key=idem_key(occ.id),
                              delivery_status=DeliveryStatus.FAILED_RETRYABLE.value, created_at=due)
        db.add(out)
        await db.commit()
        from app.services.reply_planner.delivery_reconciler import DeliveryReconciler
        from app.models.inbox import EmailThread
        thread = await db.get(EmailThread, th)
        assert await DeliveryReconciler._resend_blocker(db, out, thread, due + timedelta(minutes=5)) is None
        monkeypatch.setenv("FOLLOWUP_CUSTOMER_SEND_ENABLED", "false")
        reset_flags_cache()
        assert "kill_switch" in await DeliveryReconciler._resend_blocker(db, out, thread, due + timedelta(minutes=5))
        enable_customer_send(monkeypatch)
        c = await db.get(ThreadFollowupControl, th)
        c.customer_email_enabled = False                                   # revoked during retry
        await db.commit()
        assert "customer_email_not_permitted" in await DeliveryReconciler._resend_blocker(db, out, thread, due + timedelta(minutes=5))


async def test_crash_before_and_after_provider_acceptance(w, monkeypatch):
    enable_customer_send(monkeypatch)
    th = await w.thread("Crash")
    t = utc(2026, 12, 1, 6, 0)
    await w.say(th, "inbound", "Check with me Friday 11am.", t, HOT_SCHEDULED)
    await permit_customer_email(w, th)
    [occ] = await w.live(th)
    # Crash BEFORE the dispatcher recorded anything: 'sending' with no outbound row -> safe to retry.
    async with db_manager.session_factory() as db:
        o = await db.get(FollowupOccurrence, occ.id)
        o.customer_status = "sending"
        await db.commit()
    sch = FollowupScheduler()
    assert await sch._sync_inflight(utc(2026, 12, 4, 5, 0), w.tenant_id) == 1
    assert (await w.occurrences(th))[0].customer_status == "pending"
    # Crash AFTER acceptance: the outbound exists as SENT -> marked sent, never re-sent.
    async with db_manager.session_factory() as db:
        db.add(OutboundMessage(id=f"out_{uuid.uuid4().hex[:12]}", tenant_id=w.tenant_id, thread_id=th,
                               integration_account_id=w.account_id, to_emails="[]", body_text="x", body_html="<p>x</p>",
                               idempotency_key=idem_key(occ.id), delivery_status=DeliveryStatus.SENT.value))
        await db.commit()
    await sch.run_once(now=utc(2026, 12, 4, 5, 30), tenant_id=w.tenant_id)
    assert w.spies.gmail_calls == [] and (await w.occurrences(th))[0].customer_status == "sent"


async def test_uncertain_gmail_send_is_left_to_reconciliation_not_retried_blindly(w, monkeypatch):
    enable_customer_send(monkeypatch)
    th = await w.thread("Uncertain")
    t = utc(2026, 12, 1, 6, 0)
    await w.say(th, "inbound", "Check with me Friday 11am.", t, HOT_SCHEDULED)
    await permit_customer_email(w, th)
    w.scripts["__compose__"] = "Just checking in about Friday, as you asked."
    w.scripts["__gmail_fail__"] = True
    await FollowupScheduler().run_once(now=utc(2026, 12, 4, 5, 30), tenant_id=w.tenant_id)
    occ = (await w.occurrences(th))[0]
    assert occ.customer_status == "unknown" and len(w.spies.gmail_calls) == 1
    await FollowupScheduler().run_once(now=utc(2026, 12, 4, 7, 0), tenant_id=w.tenant_id)
    assert len(w.spies.gmail_calls) == 1                                  # no blind second attempt


async def test_partial_team_failure_retries_only_that_member_and_removal_mid_fanout(w):
    th = await w.thread("Fan-out")
    await w.say(th, "inbound", "Book 15 December, call me at 3 PM IST.", utc(2026, 12, 1, 6, 0), KAVYA)
    from app.services.transactional_email import EmailDeliveryError

    async def hook(to):
        if to == w.emails["admin"]:
            raise EmailDeliveryError("Twilio Email rejected the message: HTTP 400")
        if to == w.emails["owner"]:
            async with db_manager.session_factory() as db:           # member removed during the fan-out
                await db.execute(text("UPDATE organization_members SET status='REMOVED' WHERE user_id=:u"),
                                 {"u": w.users["member"]})
                await db.commit()
        if to == w.emails["viewer"]:
            raise EmailDeliveryError("SMTP delivery failed: SMTPServerDisconnected: lost")
        return True

    w.scripts["__mail_hook__"] = hook
    sch = FollowupScheduler()
    await sch.run_once(now=utc(2026, 12, 14, 4, 30), tenant_id=w.tenant_id)
    rows = dict(await w.sql("SELECT email, status FROM followup_notice_deliveries WHERE notice_type='advance' "
                            "AND tenant_id=:t", t=w.tenant_id))
    assert rows[w.emails["owner"]] == "accepted" and rows[w.emails["admin"]] == "failed"
    assert rows[w.emails["viewer"]] == "unknown"                         # acceptance unknowable: not retried
    assert rows[w.emails["member"]] in ("skipped", "accepted")
    first = len(w.spies.team_mail)
    w.scripts["__mail_hook__"] = None
    w.scripts["__mail_mode__"] = True
    await sch.run_once(now=utc(2026, 12, 14, 4, 40), tenant_id=w.tenant_id)
    retried = [m["to"] for m in w.spies.team_mail[first:]]
    assert retried == [w.emails["admin"]]                                  # only the failed member


async def test_leases_prevent_double_processing_and_expire(w):
    th = await w.thread("Lease")
    await w.say(th, "inbound", "Book 15 December, call me at 3 PM IST.", utc(2026, 12, 1, 6, 0), KAVYA)
    from app.services.followups.scheduler import _claim
    O = FollowupOccurrence
    now = utc(2026, 12, 14, 4, 30)
    where = O.status == "scheduled"
    first = await _claim(where, now, w.tenant_id)
    second = await _claim(where, now + timedelta(minutes=1), w.tenant_id)
    third = await _claim(where, now + timedelta(minutes=6), w.tenant_id)
    assert len(first) == 1 and second == [] and third == first


async def test_assessment_disabled_freezes_label_and_holds_customer_email(w, monkeypatch):
    enable_customer_send(monkeypatch)
    th = await w.thread("Frozen")
    t = utc(2026, 12, 1, 6, 0)
    await w.say(th, "inbound", "Check with me Friday 11am.", t, HOT_SCHEDULED)
    await permit_customer_email(w, th)
    async with db_manager.session_factory() as db:
        c = await engine.get_or_create_control(db, w.tenant_id, th)
        c.assessment_enabled = False
        await db.commit()
    m2 = await w.msg(th, "inbound", "Hmm, wait.", t + timedelta(hours=1))
    assert await w.assess(m2, th, t + timedelta(hours=1, minutes=1)) == "assessment_disabled"
    assert w.spies.model_calls.count(m2) == 0
    s = await w.state(th)
    assert s.effective_temperature == "hot" and s.needs_review
    assert (await w.live(th))[0].customer_status == "held"


async def test_shadow_mode_records_but_never_acts(w, monkeypatch):
    monkeypatch.setenv("FOLLOWUP_SHADOW_MODE", "true")
    reset_flags_cache()
    th = await w.thread("Shadow")
    mid = await w.msg(th, "inbound", "Call me Friday", utc(2026, 12, 1, 6, 0))
    w.script(mid, HOT_SCHEDULED)
    assert await w.assess(mid, th, utc(2026, 12, 1, 6, 1)) == "shadow"
    assert await w.live(th) == [] and (await w.state(th)).status == "none"
    async with db_manager.session_factory() as db:
        row = (await db.execute(select(MessageAssessment).where(MessageAssessment.message_id == mid))).scalar_one()
        assert row.status == "valid" and row.not_applied_reason == "shadow_mode" and row.decision == "schedule"


async def test_historical_mail_never_triggers_a_launch_burst(w):
    th = await w.thread("Old")
    old = await w.msg(th, "inbound", "From last month", utc(2026, 11, 1), now=utc(2026, 12, 1))
    assert old
    n = await w.sql("SELECT count(*) FROM outbox_events WHERE tenant_id=:t", t=w.tenant_id)
    assert n[0][0] == 0 and await w.state(th) is None


async def test_manual_temperature_survives_ai_and_never_authorizes_email(w, monkeypatch):
    enable_customer_send(monkeypatch)
    th = await w.thread("Manual label")
    t = utc(2026, 12, 1, 6, 0)
    await w.say(th, "inbound", "Just browsing.", t, R(temperature="cold", decision="none"))
    async with api(w, "member") as cl:
        r = await cl.patch(f"/inbox/threads/{th}/lead-temperature", json={"lead_temperature": "hot"})
        assert r.status_code == 200 and r.json()["temperature_source"] == "manual"
    await w.say(th, "inbound", "Still just browsing.", t + timedelta(days=1), R(temperature="cold", decision="none"))
    s = await w.state(th)
    assert (s.effective_temperature, s.suggested_temperature, s.temperature_source) == ("hot", "cold", "manual")
    assert await w.live(th) == []                                         # Hot label scheduled nothing
    async with api(w, "member") as cl:
        r = await cl.patch(f"/inbox/threads/{th}/lead-temperature", json={"lead_temperature": None})
        assert r.json()["lead_temperature"] == "cold" and r.json()["temperature_source"] == "ai"
    assert w.spies.gmail_calls == []


async def test_legacy_label_is_preserved_as_override(w):
    th = await w.thread("Legacy")
    async with db_manager.session_factory() as db:
        await db.execute(text("UPDATE email_threads SET lead_intent='warm' WHERE id=:t"), {"t": th})
        await db.commit()
    await w.say(th, "inbound", "Not now.", utc(2026, 12, 1, 6, 0), R(temperature="cold", decision="none"))
    s = await w.state(th)
    assert (s.effective_temperature, s.suggested_temperature, s.temperature_source) == ("warm", "cold", "legacy")


# ---------------------------------------------------------------------------------------------
# API & RBAC
# ---------------------------------------------------------------------------------------------

def api(w: World, who: str) -> httpx.AsyncClient:
    from app.core.security import create_access_token
    from app.main import app

    token = create_access_token(w.users[who], tenant_id=w.tenant_id)
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://itest/api/v1",
                             headers={"Authorization": f"Bearer {token}", "X-Organization-Id": w.tenant_id},
                             timeout=60)


async def test_api_rbac_versions_and_participant_validation(w):
    th = await w.thread("API")
    await w.say(th, "inbound", "Interested, call Friday 11am.", utc(2026, 12, 1, 6, 0), HOT_SCHEDULED)
    async with api(w, "member") as cl:
        panel = (await cl.get(f"/followups/threads/{th}")).json()
        assert panel["controls"]["customer_email_enabled"] is False and panel["participants"] == [CUSTOMER]
        assert panel["capabilities"]["can_send"] is True
        r = await cl.patch(f"/followups/threads/{th}/controls", json={
            "version": panel["version"], "customer_email_enabled": True,
            "customer_recipient_email": "stranger@else.example"})
        assert r.status_code == 422                                       # not a verified participant
        r = await cl.patch(f"/followups/threads/{th}/controls", json={"version": 999, "planning_enabled": False})
        assert r.status_code == 409                                       # stale version
        r = await cl.patch(f"/followups/threads/{th}/controls", json={
            "version": panel["version"], "customer_email_enabled": True, "customer_recipient_email": CUSTOMER})
        assert r.status_code == 200 and r.json()["controls"]["customer_email_enabled"] is True
        assert [o["customer_status"] for o in r.json()["occurrences"] if o["status"] == "scheduled"] == ["pending"]
        v = r.json()["version"]
        r = await cl.patch(f"/followups/threads/{th}/controls", json={"version": v, "planning_enabled": False})
        assert r.json()["status"] == "stopped" and [o for o in r.json()["occurrences"] if o["status"] == "scheduled"] == []
        assert (await cl.get("/followups/policy")).status_code == 200
        assert (await cl.patch("/followups/policy", json={"version": 0, "cadence_hot_days": 2})).status_code == 403
    async with api(w, "viewer") as cl:
        assert (await cl.get(f"/followups/threads/{th}")).status_code == 403
    async with api(w, "admin") as cl:
        pol = (await cl.get("/followups/policy")).json()
        r = await cl.patch("/followups/policy", json={"version": pol["version"], "cadence_hot_days": 2,
                                                       "workdays": [0, 1, 2, 3, 4, 5], "timezone": "Asia/Kolkata (GMT +5:30)"})
        assert r.status_code == 200 and r.json()["cadence_hot_days"] == 2 and r.json()["timezone"] == "Asia/Kolkata"
        assert (await cl.patch("/followups/policy", json={"version": pol["version"], "max_attempts": 4})).status_code == 409


async def test_observe_only_workspace_records_then_admin_activates_and_applies(w):
    await w.sql("SELECT 1")
    async with db_manager.session_factory() as db:
        await db.execute(text("UPDATE followup_policies SET mode='shadow' WHERE tenant_id=:t"), {"t": w.tenant_id})
        await db.commit()
    th = await w.thread("Observe")
    mid = await w.msg(th, "inbound", "Call me Friday 11am", utc(2026, 12, 1, 6, 0))
    w.script(mid, HOT_SCHEDULED)
    assert await w.assess(mid, th, utc(2026, 12, 1, 6, 1)) == "shadow"
    assert await w.live(th) == [] and w.spies.team_mail == []
    async with api(w, "member") as cl:
        panel = (await cl.get(f"/followups/threads/{th}")).json()
        assert panel["workspace"]["mode"] == "shadow"
        assert panel["latest_suggestion"]["decision"] == "schedule" and panel["latest_suggestion"]["is_latest_message"]
        r = await cl.post(f"/followups/threads/{th}/apply-suggestion", params={"version": panel["version"]})
        assert r.status_code == 409                                         # observe-only: nothing applies
        assert (await cl.patch("/followups/policy", json={"version": 1, "mode": "active"})).status_code == 403
    async with api(w, "admin") as cl:
        pol = (await cl.get("/followups/policy")).json()
        assert pol["mode"] == "shadow" and pol["platform"]["customer_send_enabled"] is False
        r = await cl.patch("/followups/policy", json={"version": pol["version"], "mode": "active"})
        assert r.status_code == 200 and r.json()["mode"] == "active"
    async with api(w, "member") as cl:
        panel = (await cl.get(f"/followups/threads/{th}")).json()
        r = await cl.post(f"/followups/threads/{th}/apply-suggestion", params={"version": panel["version"]})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "scheduled" and r.json()["due"]["at"].startswith("2026-12-04T05:30")
    assert len(await w.live(th)) == 1


async def test_customer_email_needs_workspace_allowance(w, monkeypatch):
    enable_customer_send(monkeypatch)
    th = await w.thread("Allowance")
    await w.say(th, "inbound", "Check with me Friday 11am.", utc(2026, 12, 1, 6, 0), HOT_SCHEDULED)
    async with db_manager.session_factory() as db:
        await db.execute(text("UPDATE followup_policies SET customer_email_allowed=false WHERE tenant_id=:t"),
                         {"t": w.tenant_id})
        await db.commit()
    async with api(w, "member") as cl:
        panel = (await cl.get(f"/followups/threads/{th}")).json()
        assert panel["workspace"]["customer_email_allowed"] is False
        r = await cl.patch(f"/followups/threads/{th}/controls", json={
            "version": panel["version"], "customer_email_enabled": True, "customer_recipient_email": CUSTOMER})
        assert r.status_code == 409 and "Settings" in r.json().get("detail", r.text)
    await permit_customer_email(w, th)                                     # consent set behind the API's back
    [occ] = await w.live(th)
    async with db_manager.session_factory() as db:
        g = await gate.evaluate(db, await db.get(FollowupOccurrence, occ.id), utc(2026, 12, 4, 5, 30))
        assert not g.ok and g.reason == "workspace_disallows_customer_email"
    await FollowupScheduler().run_once(now=utc(2026, 12, 4, 5, 30), tenant_id=w.tenant_id)
    assert w.spies.gmail_calls == []


async def test_snooze_defers_reminders_until_it_ends(w):
    th = await w.thread("Snooze")
    await w.say(th, "inbound", "Book 15 December, call me at 3 PM IST.", utc(2026, 12, 1, 6, 0), KAVYA)
    async with db_manager.session_factory() as db:
        c = await engine.get_or_create_control(db, w.tenant_id, th)
        c.snoozed_until = utc(2026, 12, 16, 0, 0)
        await db.commit()
    sch = FollowupScheduler()
    await sch.run_once(now=utc(2026, 12, 14, 4, 30), tenant_id=w.tenant_id)     # advance notice time
    await sch.run_once(now=utc(2026, 12, 15, 9, 30), tenant_id=w.tenant_id)     # due time
    assert w.spies.team_mail == []                                              # snoozed: nothing sent
    await sch.run_once(now=utc(2026, 12, 16, 0, 1), tenant_id=w.tenant_id)      # snooze over
    kinds = {m["subject"].split(":")[0] for m in w.spies.team_mail if m["to"] != w.emails["viewer"]}
    assert kinds == {"Follow-up due now"} and len(w.spies.team_mail) == 4      # one due notice each, no stale advance


async def test_status_classification_is_distinct(w):
    t = utc(2026, 12, 1, 6, 0)
    a = await w.thread("Scheduled")
    await w.say(a, "inbound", "Call Friday 11am", t, HOT_SCHEDULED)
    b = await w.thread("Review")
    await w.say(b, "inbound", "around 03/04", t, R(decision="defer", timing={"kind": "customer_commitment",
                                                                             "ambiguous": True}))
    c = await w.thread("Closed")
    await w.say(c, "inbound", "Signed", t, R(outcome="completed", decision="none"))
    d = await w.thread("Refused")
    await w.say(d, "inbound", "Stop contacting me", t, R(decision="suppress",
                constraints={"refusal_scope": "all_contact"}), sender="other@client.example")
    statuses = {k: (await w.state(th)).status for k, th in (("a", a), ("b", b), ("c", c), ("d", d))}
    assert statuses == {"a": "scheduled", "b": "needs_review", "c": "closed", "d": "suppressed"}
    assert (await w.state(b)).needs_review and not (await w.state(a)).needs_review
    assert len(await w.live(a)) == 1 and await w.live(d) == []           # refused: nothing actionable
