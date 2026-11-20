"""LIVE AI #2 semantic evaluation (opt-in; calls the configured model). NOT part of CI.

    DATABASE_URL=<local throwaway db> python -m tests.evals.followup_live_eval

Builds synthetic multi-turn conversations (unrelated industries, English / Hinglish, refusals,
short replies, changed and ambiguous dates, mixed sales/support), builds the exact production
context for each message and asks the real model. Each expectation is annotated independently of
the model and checked per message. Prints a per-check table and accuracy; semantic accuracy is
reported separately from the deterministic reliability suite.
"""

from __future__ import annotations

import asyncio
import json
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Callable, Dict, List, Tuple

from app.core.database import db_manager
from app.services.followups import assessor, contracts, engine
from tests.followup_world import build_world, destroy_world, is_local_database

UTC = timezone.utc
Check = Tuple[str, Callable[[contracts.Assessment], bool]]


def at(d: date, hh: int = 6) -> datetime:
    return datetime(d.year, d.month, d.day, hh, 0, tzinfo=UTC)


MON = date(2026, 11, 30)


def thursday_after(d: date) -> str:
    x = d
    while x.weekday() != 3:
        x += timedelta(days=1)
    return x.isoformat()


# (business, [(direction, sender, text, day_offset, checks)])
SCENARIOS: List[Tuple[str, List[Tuple[str, str, str, int, List[Check]]]]] = [
    ("industrial supplier (Meera)", [
        ("inbound", "meera@plant.example", "Bas catalogue bhej dijiye, buying plan abhi nahi hai.", 0, [
            ("low interest -> cold/unknown", lambda a: a.temperature in ("cold", "unknown")),
            ("buying_interest < 0.4", lambda a: a.buying_interest < 0.4),
            ("no customer outreach scheduled", lambda a: a.decision != "schedule"),
        ]),
        ("inbound", "meera@plant.example", "We shortlisted two models. Can you compare warranty?", 1, [
            ("evaluation -> warm", lambda a: a.temperature == "warm"),
            ("team owes the comparison", lambda a: a.next_actor == "team"),
        ]),
        ("inbound", "meera@plant.example",
         "We need 40 units. Please send the final quote by Thursday so I can release the PO.", 2, [
            ("firm intent -> hot", lambda a: a.temperature == "hot"),
            ("team owes the quote", lambda a: a.next_actor == "team"),
            ("decision wait_team", lambda a: a.decision == "wait_team"),
            ("Thursday resolved", lambda a: a.timing.local_date and a.timing.local_date.isoformat() == thursday_after(MON + timedelta(days=2))),
        ]),
    ]),
    ("training consultancy (Kavya)", [
        ("inbound", "kavya@training.example",
         "We intend to book the workshop on 15 December 2026. Please contact me that afternoon at 3 PM IST.", 0, [
            ("hot", lambda a: a.temperature == "hot"),
            ("schedule/defer contact", lambda a: a.decision in ("schedule", "defer")),
            ("date 2026-12-15", lambda a: a.timing.local_date == date(2026, 12, 15)),
            ("time 15:00", lambda a: a.timing.local_time is not None and a.timing.local_time.strftime("%H:%M") == "15:00"),
            ("zone IST", lambda a: (a.timing.timezone or "").upper() in ("IST", "ASIA/KOLKATA") or "Kolkata" in (a.timing.timezone or "")),
        ]),
        ("inbound", "kavya@training.example", "Jan 8 at the same time instead.", 2, [
            ("changed_date", lambda a: a.constraints.changed_date),
            ("date 2027-01-08 (year from context)", lambda a: a.timing.local_date == date(2027, 1, 8)),
            ("time kept 15:00", lambda a: a.timing.local_time is not None and a.timing.local_time.strftime("%H:%M") == "15:00"),
        ]),
    ]),
    ("software company (Arjun)", [
        ("outbound", None, "Hi Arjun, attached is our proposal for the deployment (annual plan).", 0, []),
        ("inbound", "arjun@saas.example", "Finance is still reviewing.", 3, [
            ("purchase unconfirmed stays open", lambda a: a.outcome == "open_unconfirmed"),
            ("not declined/closed", lambda a: a.outcome not in ("declined", "completed")),
            ("not suppressed", lambda a: a.decision != "suppress"),
        ]),
        ("inbound", "arjun@saas.example", "We signed yesterday.", 6, [
            ("completed", lambda a: a.outcome == "completed"),
            ("no further sales follow-up", lambda a: a.decision in ("none", "wait_team")),
        ]),
    ]),
    ("design agency (Nisha)", [
        ("inbound", "nisha@brand.example", "Loved the moodboards! Let's discuss the package next week.", 0, [
            ("interested", lambda a: a.temperature in ("warm", "hot")),
        ]),
        ("inbound", "nisha@brand.example", "Aage se kabhi message mat karna.", 2, [
            ("decision suppress", lambda a: a.decision == "suppress"),
            ("all_contact scope", lambda a: a.constraints.refusal_scope == "all_contact"),
            ("quote verified", lambda a: a.constraints.quote_verified),
        ]),
    ]),
    ("logistics firm", [
        ("inbound", "ops@freight.example", "No to the annual contract. Please quote only for the November shipment.", 0, [
            ("scoped refusal, not a ban", lambda a: a.constraints.refusal_scope in ("opportunity_only", "none")),
            ("not suppress", lambda a: a.decision != "suppress"),
            ("an opportunity declined", lambda a: any(o["status"] == "declined" for o in a.opportunities)),
            ("an opportunity open", lambda a: any(o["status"] in ("open", "unknown") for o in a.opportunities)),
            ("team owes the quote", lambda a: a.next_actor == "team"),
        ]),
    ]),
    ("IT services (outage)", [
        ("inbound", "admin@clinic.example", "Server is down, call urgently", 0, [
            ("support, not sales", lambda a: a.sales_relevance in ("support", "service")),
            ("not a hot lead", lambda a: a.temperature != "hot"),
        ]),
    ]),
    ("IT services (renewal thanks)", [
        ("inbound", "cfo@retail.example", "Confirmed — please renew our support plan for another year.", 0, [
            ("renewal confirmed", lambda a: a.outcome == "completed"),
        ]),
        ("outbound", None, "Done — your renewal is processed. Thank you!", 0, []),
        ("inbound", "cfo@retail.example", "Thank you", 1, [
            ("courtesy does not reopen", lambda a: a.outcome == "completed" and a.decision in ("none",)),
        ]),
    ]),
    ("consulting firm (03/04)", [
        ("inbound", "partner@board.example", "We may decide around 03/04 after the board meeting.", 0, [
            ("ambiguous date flagged", lambda a: a.timing.ambiguous or a.timing.local_date is None),
            ("no invented exact date", lambda a: a.timing.ambiguous or a.timing.local_date is None),
        ]),
        ("inbound", "cfo@board.example", "That works", 0, [
            ("still no exact date", lambda a: a.timing.ambiguous or a.timing.local_date is None),
        ]),
    ]),
    ("equipment distributor (two items)", [
        ("inbound", "buyer@factory.example", "Please quote two items: the compressor and the dryer.", 0, []),
        ("outbound", None, "Quotes attached for the compressor and the dryer.", 1, []),
        ("inbound", "buyer@factory.example",
         "PO attached for the compressor. The dryer we are still evaluating.", 3, [
            ("one opportunity completed", lambda a: any(o["status"] == "completed" for o in a.opportunities)),
            ("other still open", lambda a: any(o["status"] in ("open", "unknown", "deferred") for o in a.opportunities)),
            ("not closed overall", lambda a: a.outcome != "declined"),
        ]),
    ]),
    ("unseen business: event venue (Hinglish short reply)", [
        ("outbound", None, "Shall I block the hall for the 20th for your event?", 0, []),
        ("inbound", "host@party.example", "Haan, kar dijiye", 0, [
            ("short yes to booking -> hot", lambda a: a.temperature == "hot"),
        ]),
        ("inbound", "host@party.example", "Okay", 1, [
            ("'okay' after commitment does not downgrade", lambda a: a.temperature in ("hot", "warm")),
        ]),
    ]),
    ("unseen business: courier (brochure offer)", [
        ("outbound", None, "Should I email you our brochure?", 0, []),
        ("inbound", "desk@courier.example", "Haan, kar dijiye", 0, [
            ("yes to a brochure is not hot", lambda a: a.temperature != "hot"),
        ]),
    ]),
    ("unseen business: tutor (not this quarter)", [
        ("inbound", "parent@family.example", "Not this quarter please, reach out in April.", 0, [
            ("deferral, not a ban", lambda a: a.decision in ("defer", "none", "schedule") and a.constraints.refusal_scope != "all_contact"),
        ]),
    ]),
    ("unseen business: printer (call, no email)", [
        ("inbound", "owner@shop.example", "Interested in the bulk print offer, but no emails please — just call me.", 0, [
            ("email-only restriction", lambda a: a.constraints.refusal_scope == "email_only"),
            ("not a full ban", lambda a: a.decision != "suppress"),
        ]),
    ]),
]


async def run() -> int:
    if not is_local_database():
        print("refusing: set DATABASE_URL to the local throwaway database")
        return 2
    w = await build_world(f"eval{uuid.uuid4().hex[:8]}")
    results: List[Tuple[str, str, bool, str]] = []
    try:
        for business, turns in SCENARIOS:
            th = await w.thread(business[:60])
            for direction, sender, text, offset, checks in turns:
                mid = await w.msg(th, direction, text, at(MON + timedelta(days=offset)), sender=sender, trigger=False)
                if not checks:
                    continue
                async with db_manager.session_factory() as db:
                    cal = await engine.load_calendar(db, w.tenant_id)
                    ctx = await assessor.build_context(db, tenant_id=w.tenant_id, thread_id=th, message_id=mid, cal=cal)
                try:
                    raw = await assessor.call_model(ctx)
                    a = contracts.validate(raw, known_message_ids=ctx.known_ids, latest_message_id=mid,
                                           customer_texts=ctx.customer_texts, latest_is_outbound=ctx.latest_is_outbound,
                                           prior_ai_temperature=ctx.prior_ai_temperature)
                except Exception as exc:  # noqa: BLE001
                    for name, _ in checks:
                        results.append((business, name, False, f"model/contract error: {exc}"[:120]))
                    continue
                # Keep the prior decision for the next turn's context (as production does).
                async with db_manager.session_factory() as db:
                    from app.models.followup import MessageAssessment
                    row = MessageAssessment(tenant_id=w.tenant_id, thread_id=th, message_id=mid,
                                            message_sent_at=at(MON + timedelta(days=offset)), status="valid",
                                            result=a.to_json(), suggested_temperature=a.temperature, decision=a.decision)
                    db.add(row)
                    await db.flush()
                    await engine.apply_assessment(db, tenant_id=w.tenant_id, row=row, result=a,
                                                  now=at(MON + timedelta(days=offset)) + timedelta(minutes=1))
                    await db.commit()
                for name, fn in checks:
                    try:
                        ok = bool(fn(a))
                    except Exception:  # noqa: BLE001
                        ok = False
                    detail = json.dumps({"t": a.temperature, "d": a.decision, "o": a.outcome, "actor": a.next_actor,
                                         "date": a.timing.local_date.isoformat() if a.timing.local_date else None,
                                         "amb": a.timing.ambiguous, "scope": a.constraints.refusal_scope})
                    results.append((business, name, ok, detail))
    finally:
        await destroy_world(w)
    passed = sum(1 for r in results if r[2])
    for b, n, ok, d in results:
        print(f"{'PASS' if ok else 'FAIL'} | {b} | {n} | {d}")
    print(f"\nSEMANTIC ACCURACY: {passed}/{len(results)} checks = {100 * passed / max(1, len(results)):.1f}%")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(run()))
