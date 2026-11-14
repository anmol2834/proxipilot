"""End-to-end API contract test for all seven memories, the Context Intelligence Engine and
Memory Update & Sync — over real HTTP (ASGI), real PostgreSQL and real Qdrant.

Two throwaway organisations (A, B) and two throwaway users are created:
  * agent  — member of A with every permission
  * viewer — member of A with ``inbox.read`` only
Every memory is exercised on its normal path AND its worst cases:
  * another tenant's ids          -> 404 (never leaks existence)
  * read-only role writing        -> 403
  * malformed / invalid input     -> 422
  * impossible state transitions  -> 409 / 422
Everything is removed afterwards.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from sqlalchemy import text

from conftest import purge_tenant

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Environment: orgs, users, roles, tokens, a conversation with an AI draft
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
async def env():
    from app.core.database import db_manager
    from app.core.security import create_access_token
    from app.main import app

    tag = uuid.uuid4().hex[:10]
    org_a, org_b = f"org_itest_a_{tag}", f"org_itest_b_{tag}"
    users = {"agent": f"usr_itest_ag_{tag}", "viewer": f"usr_itest_vw_{tag}", "other": f"usr_itest_ot_{tag}"}
    roles = {"agent": f"rol_itest_ag_{tag}", "viewer": f"rol_itest_vw_{tag}", "other": f"rol_itest_ot_{tag}"}
    now = datetime.now(timezone.utc)
    ids = {"org_a": org_a, "org_b": org_b, "acc": f"int_itest_{tag}", "acc_b": f"int_itest_b_{tag}",
           "thread": f"thr_itest_{tag}", "thread_b": f"thr_itest_b_{tag}", "msg_in": f"msg_itest_in_{tag}",
           "msg_out": f"msg_itest_out_{tag}", "msg_b": f"msg_itest_b_{tag}", "run": f"air_itest_{tag}",
           "draft": f"ares_itest_{tag}", "draft_sent": f"ares_itest_s_{tag}", "review": f"rev_itest_{tag}"}
    async with db_manager.session_factory() as db:
        for org in (org_a, org_b):
            await db.execute(text("""INSERT INTO organizations (id, name, slug, status, plan_tier, is_active,
                max_integrations, max_members, created_at, updated_at)
                VALUES (:id, 'Integration Test Catalogue', :slug, 'ACTIVE', 'free', true, 5, 10, now(), now())"""),
                {"id": org, "slug": f"it-{org[-14:]}"})
        all_perms = (await db.execute(text("SELECT id, key FROM permissions"))).all()
        for who, org in (("agent", org_a), ("viewer", org_a), ("other", org_b)):
            await db.execute(text("""INSERT INTO users (id, email, hashed_password, full_name, is_active, is_verified,
                created_at, updated_at) VALUES (:id, :e, 'x', :n, true, true, now(), now())"""),
                {"id": users[who], "e": f"{who}-{tag}@itest.example", "n": f"IT {who}"})
            await db.execute(text("""INSERT INTO roles (id, organization_id, name, is_system_role, created_at, updated_at)
                VALUES (:id, :o, :n, false, now(), now())"""), {"id": roles[who], "o": org, "n": f"itest-{who}"})
            perms = all_perms if who != "viewer" else [p for p in all_perms if p.key == "inbox.read"]
            for p in perms:
                await db.execute(text("INSERT INTO role_permissions (id, role_id, permission_id, created_at, updated_at) "
                                      "VALUES (:id, :r, :p, now(), now())"),
                                 {"id": f"rp_{uuid.uuid4().hex[:16]}", "r": roles[who], "p": p.id})
            await db.execute(text("""INSERT INTO organization_members (id, organization_id, user_id, role_id, status,
                created_at, updated_at) VALUES (:id, :o, :u, :r, 'ACTIVE', now(), now())"""),
                {"id": f"mem_{uuid.uuid4().hex[:16]}", "o": org, "u": users[who], "r": roles[who]})
        # conversation in A (customer -> AI draft pending review), and one in B
        for acc, org, th, mid, body in ((ids["acc"], org_a, ids["thread"], ids["msg_in"],
                                         "Hi, can we get a discount on 200 grab bars? Please send a quotation."),
                                        (ids["acc_b"], org_b, ids["thread_b"], ids["msg_b"], "Other tenant mail")):
            await db.execute(text("""INSERT INTO connected_integration_accounts (id, tenant_id, provider, email_address,
                status, connection_status, sync_enabled, automation_enabled, created_at, updated_at)
                VALUES (:a, :t, 'gmail', :e, 'active', 'connected', false, false, now(), now())"""),
                {"a": acc, "t": org, "e": f"sales-{acc}@itest.example"})
            await db.execute(text("""INSERT INTO email_threads (id, tenant_id, integration_account_id, external_thread_id,
                subject, status, message_count, unread_count, is_read, is_starred, context_revision, first_message_at,
                latest_message_at, created_at, updated_at) VALUES (:th, :t, :a, :ext, 'Grab bars', 'open', 1, 1, false,
                false, 1, :at, :at, now(), now())"""), {"th": th, "t": org, "a": acc, "ext": f"ext_{th}", "at": now})
            await db.execute(text("""INSERT INTO email_messages (id, tenant_id, thread_id, integration_account_id,
                external_message_id, direction, from_email, to_emails, body_text, sent_at, filter_reason, created_at,
                updated_at) VALUES (:id, :t, :th, :a, :ext, 'inbound', 'buyer@itest.example', '[]', :b, :at, 'ACCEPT',
                now(), now())"""), {"id": mid, "t": org, "th": th, "a": acc, "ext": f"ext_{mid}", "b": body,
                                     "at": now - timedelta(minutes=5)})
        await db.execute(text("""INSERT INTO ai_runs (id, tenant_id, thread_id, trigger_event_id, correlation_id,
            pipeline_stage, status, created_at, updated_at) VALUES (:id, :t, :th, :m, :m, 'completed', 'completed',
            now(), now())"""), {"id": ids["run"], "t": org_a, "th": ids["thread"], "m": ids["msg_in"]})
        for did, st in ((ids["draft"], "pending_review"), (ids["draft_sent"], "sent")):
            await db.execute(text("""INSERT INTO ai_responses (id, tenant_id, ai_run_id, thread_id, draft_subject,
                draft_body, draft_body_plain, approval_status, has_policy_violations, generation_instructions,
                created_at, updated_at) VALUES (:id, :t, :r, :th, 'Re: Grab bars', :b, :b, :st, false, :gi,
                now(), now())"""), {"id": did, "t": org_a, "r": ids["run"], "th": ids["thread"], "st": st,
                                    "gi": json.dumps({"intent": "price_quote"}),
                                    "b": "Dear Sir,\n\nThank you for your enquiry. The 304 SS grab bar is available. "
                                         "Our team will share the quotation shortly.\n\nRegards,\nSales"})
        await db.execute(text("""INSERT INTO human_reviews (id, tenant_id, ai_response_id, thread_id, ai_run_id,
            triage_reason, priority, status, sla_breached, created_at, updated_at) VALUES (:id, :t, :d, :th, :r,
            'sensitive_topic', 'medium', 'open', false, now(), now())"""),
            {"id": ids["review"], "t": org_a, "d": ids["draft"], "th": ids["thread"], "r": ids["run"]})
        await db.commit()

    def client(who: str) -> httpx.AsyncClient:
        org = org_b if who == "other" else org_a
        token = create_access_token(users[who], tenant_id=org)
        return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://itest/api/v1",
                                 headers={"Authorization": f"Bearer {token}", "X-Organization-Id": org}, timeout=120)

    clients = {who: client(who) for who in users}
    try:
        yield {**ids, "c": clients}
    finally:
        for c in clients.values():
            await c.aclose()
        for org in (org_a, org_b):
            await purge_tenant(org)
        async with db_manager.session_factory() as db:
            await db.execute(text("DELETE FROM users WHERE id = ANY(:u)"), {"u": list(users.values())})
            await db.commit()


def ok(r: httpx.Response, code: int = 200):
    assert r.status_code == code, f"{r.request.method} {r.request.url.path} -> {r.status_code}: {r.text[:400]}"
    return r.json() if r.content else None


# ---------------------------------------------------------------------------
# Memory 1 + 8: Company Knowledge, Update & Publish, versions, rollback
# ---------------------------------------------------------------------------


async def test_memory_1_and_8_knowledge_update_publish_rollback(env):
    a, v, o = env["c"]["agent"], env["c"]["viewer"], env["c"]["other"]
    item = ok(await a.post("/knowledge", json={
        "category": "products_services", "title": "ITEST Grab Bar 600 mm", "description": "304 SS grab bar",
        "pricing": "1450", "currency": "INR", "code": f"ITEST-GB-{uuid.uuid4().hex[:6]}"}), 201)
    item_id = item["id"]
    ok(await a.patch(f"/knowledge/{item_id}", json={"pricing": "1550", "currency": "INR",
                                                     "change_summary": "price increase"}))
    versions = ok(await a.get(f"/knowledge/{item_id}/versions"))
    vlist = versions if isinstance(versions, list) else versions.get("items", versions.get("versions", []))
    assert len(vlist) >= 2, versions
    # worst cases
    assert (await a.post(f"/knowledge/{item_id}/rollback", json={"target_version_number": 999})).status_code in (404, 409, 422)
    assert (await a.post("/knowledge", json={"category": "not_a_category", "title": "x"})).status_code in (400, 422)
    assert (await o.get(f"/knowledge/{item_id}")).status_code == 404            # other tenant can't see it
    assert (await v.patch(f"/knowledge/{item_id}", json={"title": "hack"})).status_code == 403
    # rollback to version 1 restores the old price, and only one vector (the current version) is searchable
    ok(await a.post(f"/knowledge/{item_id}/rollback", json={"target_version_number": 1, "reason": "itest"}))
    cur = ok(await a.get(f"/knowledge/{item_id}"))
    assert "1450" in json.dumps(cur), "rollback did not restore version 1 content"
    from app.core.config import get_settings
    url = str(get_settings().qdrant.url).rstrip("/")
    async with httpx.AsyncClient(base_url=url, timeout=30) as q:
        pts = (await q.post("/collections/proxipilot_knowledge/points/scroll", json={
            "limit": 10, "with_payload": True, "filter": {"must": [
                {"key": "knowledge_item_id", "match": {"value": item_id}}]}})).json()["result"]["points"]
    assert len(pts) == 1, f"expected exactly one live vector after rollback, found {len(pts)}"
    ok(await a.delete(f"/knowledge/{item_id}"))


# ---------------------------------------------------------------------------
# Memory 4: Contact & Relationship
# ---------------------------------------------------------------------------


async def test_memory_4_contacts(env):
    a, v, o = env["c"]["agent"], env["c"]["viewer"], env["c"]["other"]
    from app.services.contact_memory import contact_memory_service as cms

    await cms.record_message_interaction(env["org_a"], "inbound", "Asha Rao <asha.itest@acme.example>", "Asha Rao",
                                         [], [], datetime.now(timezone.utc), ["sales@itest.example"])
    page = ok(await a.get("/contacts", params={"search": "asha.itest"}))
    assert page["total"] == 1
    cid = page["items"][0]["id"]
    prof = ok(await a.patch(f"/contacts/{cid}", json={"contact_type": "customer", "company_name": "Acme Hotels"}))
    assert prof["contact_type"] == "customer"
    fact = ok(await a.post(f"/contacts/{cid}/facts", json={"fact_type": "preference", "key": "Preferred Language",
                                                           "value": "Hindi"}), 201)
    assert fact["key"] == "preferred_language"                                  # key normalised
    ok(await a.delete(f"/contacts/{cid}/facts/{fact['id']}"))
    # worst cases
    assert (await a.post(f"/contacts/{cid}/facts", json={"fact_type": "gossip", "key": "k", "value": "v"})).status_code == 422
    assert (await a.patch(f"/contacts/{cid}", json={})).status_code == 422
    assert (await a.get("/contacts/ct_does_not_exist")).status_code == 404
    assert (await o.get(f"/contacts/{cid}")).status_code == 404
    assert (await v.patch(f"/contacts/{cid}", json={"company_name": "x"})).status_code == 403
    assert (await v.get(f"/contacts/{cid}")).status_code == 200                 # viewer can read


# ---------------------------------------------------------------------------
# Memory 7: Feedback & Outcome
# ---------------------------------------------------------------------------


async def test_memory_7_feedback(env):
    a, v, o = env["c"]["agent"], env["c"]["viewer"], env["c"]["other"]
    drafts = ok(await a.get("/feedback/drafts"))
    assert any(d["id"] == env["draft"] for d in drafts["items"])
    # worst cases first
    assert (await a.post(f"/feedback/drafts/{env['draft']}/review", json={"action": "rejected"})).status_code == 422
    assert (await a.post(f"/feedback/drafts/{env['draft']}/review", json={"action": "edited", "final_text": " "})).status_code == 422
    assert (await a.post(f"/feedback/drafts/{env['draft_sent']}/review", json={"action": "approved"})).status_code == 422
    assert (await a.post("/feedback/drafts/ares_missing/review", json={"action": "approved"})).status_code == 404
    assert (await o.post(f"/feedback/drafts/{env['draft']}/review", json={"action": "approved"})).status_code == 404
    assert (await v.post(f"/feedback/drafts/{env['draft']}/review", json={"action": "approved"})).status_code == 403
    fb = ok(await a.post(f"/feedback/drafts/{env['draft']}/review", json={
        "action": "edited", "final_text": "Dear Sir,\n\nThanks! Quotation attached for 200 grab bars.\n\nRegards,\nSales",
        "reason_code": "missing_info", "comment": "itest"}))
    assert fb["action"] == "edited" and 0 < fb["similarity"] < 1
    lesson = ok(await a.post("/feedback/lessons", json={"instruction": "Always mention GST is extra.",
                                                         "priority": 70}), 201)
    ok(await a.patch(f"/feedback/lessons/{lesson['id']}", json={"status": "disabled"}))
    assert (await a.patch(f"/feedback/lessons/{lesson['id']}", json={"instruction": "   "})).status_code == 422
    assert (await o.patch(f"/feedback/lessons/{lesson['id']}", json={"priority": 1})).status_code == 404
    m = ok(await a.get("/feedback/metrics", params={"days": 30}))
    assert m["drafts_reviewed"] >= 1 and m["edit_rate"] is not None
    assert (await a.get("/feedback/metrics", params={"days": 0})).status_code == 422


# ---------------------------------------------------------------------------
# Memory 6: Decision & Commitment
# ---------------------------------------------------------------------------


async def test_memory_6_commitments(env):
    a, v, o = env["c"]["agent"], env["c"]["viewer"], env["c"]["other"]
    due = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    c = ok(await a.post("/commitments", json={"kind": "commitment", "owed_by": "company", "category": "quote",
                                               "statement": "Send revised quotation for 200 grab bars",
                                               "thread_id": env["thread"], "due_at": due}), 201)
    assert c["is_overdue"] is True and c["status"] == "open"
    d = ok(await a.post("/commitments", json={"kind": "decision", "owed_by": "internal", "category": "discount",
                                               "statement": "5% discount approved for 200+ units",
                                               "approved_by": "Sales Head"}), 201)
    s = ok(await a.get("/commitments/summary"))
    assert s["open"] >= 2 and s["overdue"] >= 1 and s["decisions_in_force"] >= 1
    lst = ok(await a.get("/commitments", params={"overdue": "true"}))
    assert [x["id"] for x in lst["items"]] == [c["id"]]
    done = ok(await a.patch(f"/commitments/{c['id']}", json={"status": "fulfilled", "resolution_note": "sent"}))
    assert done["status"] == "fulfilled" and done["resolved_at"] and done["is_overdue"] is False
    reopened = ok(await a.patch(f"/commitments/{c['id']}", json={"status": "open"}))
    assert reopened["resolved_at"] is None
    # worst cases
    assert (await a.post("/commitments", json={"kind": "commitment", "owed_by": "company", "statement": "Naive date test",
                                                "due_at": "2026-11-14T18:00:00"})).status_code == 422
    assert (await a.post("/commitments", json={"kind": "promise", "owed_by": "company", "statement": "Bad kind here"})).status_code == 422
    assert (await a.patch(f"/commitments/{c['id']}", json={})).status_code == 422
    assert (await o.patch(f"/commitments/{c['id']}", json={"status": "cancelled"})).status_code == 404
    assert (await v.post("/commitments", json={"kind": "decision", "owed_by": "internal", "statement": "Viewer cannot"})).status_code == 403
    from app.core.database import db_manager
    async with db_manager.session_factory() as db:
        await db.execute(text("UPDATE commitments SET status='superseded' WHERE id=:i"), {"i": d["id"]})
        await db.commit()
    assert (await a.patch(f"/commitments/{d['id']}", json={"status": "open"})).status_code == 409
    assert (await a.post("/commitments/extract", json={"message_id": "msg_missing"})).status_code in (404, 503)


# ---------------------------------------------------------------------------
# Memory 2: Communication Style
# ---------------------------------------------------------------------------


async def test_memory_2_style(env):
    a, v = env["c"]["agent"], env["c"]["viewer"]
    prof = ok(await a.put("/style/settings", json={"scope": "company", "overrides": {
        "greeting": "Dear {name},", "sign_off": "Thanks & Regards,", "formality": "formal", "max_words": 150},
        "employee_guide": "Always mention GST is extra"}))
    assert prof["overrides"]["greeting"] == "Dear {name}," and prof["status"] in ("insufficient_data", "active")
    pv = ok(await a.get("/style/preview", params={"message_id": env["msg_in"]}))
    assert pv["style_context"] and "Dear {name}," in pv["style_context"] and "GST is extra" in pv["style_context"]
    ok(await a.put("/style/settings", json={"scope": "company", "enabled": False}))
    pv2 = ok(await a.get("/style/preview", params={"message_id": env["msg_in"]}))
    assert not pv2["style_context"], "a disabled style profile must not reach the drafter"
    ok(await a.put("/style/settings", json={"scope": "company", "enabled": True}))
    # worst cases
    assert (await a.put("/style/settings", json={"scope": "sender", "scope_key": "not-an-email", "employee_guide": "x"})).status_code == 422
    assert (await a.put("/style/settings", json={"scope": "company"})).status_code == 422
    assert (await a.put("/style/settings", json={"overrides": {"max_words": 5}})).status_code == 422
    # The signature block was removed: an old client sending one must not store it.
    legacy = ok(await a.put("/style/settings", json={"overrides": {
        "greeting": "Dear {name},", "sign_off": "Thanks & Regards,", "signature": "Ravi\nSales"}}))
    assert "signature" not in legacy["overrides"] and legacy["overrides"]["greeting"] == "Dear {name},"
    assert (await v.put("/style/settings", json={"employee_guide": "viewer"})).status_code == 403
    res = ok(await a.post("/style/rebuild"))
    # Only the draft edited in the feedback test is human-written: too few samples to learn from,
    # so the profile must stay 'insufficient_data' (employee settings still apply) — and never crash.
    assert res["usable"] <= 1
    profiles = ok(await a.get("/style/profiles"))
    company = next(p for p in profiles if p["scope"] == "company")
    assert company["status"] == "insufficient_data" and company["overrides"]["greeting"] == "Dear {name},"


# ---------------------------------------------------------------------------
# Memory 5: Organizational Experience
# ---------------------------------------------------------------------------


async def test_memory_5_practices(env):
    a, v, o = env["c"]["agent"], env["c"]["viewer"], env["c"]["other"]
    p = ok(await a.post("/practices", json={
        "title": "Discount requests", "situation": "negotiation", "trigger_keywords": ["discount", "best price"],
        "description": "Bulk discounts are limited; anything beyond the standard needs approval.",
        "rules": ["Standard bulk discount is 5% above 100 units"], "requires_approval": True,
        "approver": "Sales Head"}), 201)
    t = ok(await a.post("/practices/test", json={"text": "Can you give a discount for 300 units?"}))
    assert t["escalate_to_human_review"] is True and "Discount requests" in (t["drafter_context"] or "")
    t2 = ok(await a.post("/practices/test", json={"text": "Please share the catalogue"}))
    assert t2["escalate_to_human_review"] is False
    ok(await a.patch(f"/practices/{p['id']}", json={"status": "disabled"}))
    t3 = ok(await a.post("/practices/test", json={"text": "Can you give a discount?"}))
    assert t3["escalate_to_human_review"] is False, "disabled practice must not apply"
    upd = ok(await a.patch(f"/practices/{p['id']}", json={"status": "active", "priority": 90}))
    assert upd["version"] == 3
    # worst cases
    assert (await a.patch(f"/practices/{p['id']}", json={"status": "suggested"})).status_code == 422
    assert (await a.patch(f"/practices/{p['id']}", json={"description": ""})).status_code == 422
    assert (await a.post("/practices", json={"title": "x", "description": "short"})).status_code == 422
    assert (await o.patch(f"/practices/{p['id']}", json={"priority": 1})).status_code == 404
    assert (await v.post("/practices", json={"title": "Viewer practice", "description": "should be forbidden"})).status_code == 403
    mine = ok(await a.post("/practices/mine"))
    assert mine["status"] in ("insufficient_history", "ok", "disabled")
    ins = ok(await a.get("/practices/insights"))
    assert "commitment_turnaround" in ins and "approvals" in ins


# ---------------------------------------------------------------------------
# Memory 3: Thread & Conversation
# ---------------------------------------------------------------------------


async def test_memory_3_conversations(env):
    a, v, o = env["c"]["agent"], env["c"]["viewer"], env["c"]["other"]
    m = ok(await a.get(f"/conversations/{env['thread']}/memory"))
    assert m["status"] in ("not_built", "ok")
    pinned = ok(await a.patch(f"/conversations/{env['thread']}/memory", json={"pinned_notes": "VIP hotel chain"}))
    assert pinned["pinned_notes"] == "VIP hotel chain"
    pv = ok(await a.get("/conversations/memory/preview", params={"message_id": env["msg_in"]}))
    assert pv["thread_context"] is None or "VIP hotel chain" in pv["thread_context"]
    # worst cases
    assert (await a.patch(f"/conversations/{env['thread']}/memory",
                          json={"requirements": [{"id": "rq_nope", "status": "answered"}]})).status_code == 422
    assert (await a.patch(f"/conversations/{env['thread']}/memory", json={})).status_code == 422
    assert (await a.get(f"/conversations/{env['thread_b']}/memory")).status_code == 404   # B's thread from A
    assert (await o.get(f"/conversations/{env['thread']}/memory")).status_code == 404
    assert (await v.patch(f"/conversations/{env['thread']}/memory", json={"pinned_notes": "x"})).status_code == 403


# ---------------------------------------------------------------------------
# Context Intelligence Engine
# ---------------------------------------------------------------------------


async def test_context_engine_preview(env):
    a, o = env["c"]["agent"], env["c"]["other"]
    b = ok(await a.get("/context/preview", params={"message_id": env["msg_in"]}))
    assert 0.0 <= b["confidence"] <= 1.0 and isinstance(b["risks"], list)
    assert b["memory_failed"] == [] or isinstance(b["memory_failed"], list)
    assert "negotiation" in b["situations"] and "quotation" in b["situations"]
    assert (await a.get("/context/preview", params={"message_id": "msg_missing"})).status_code == 404
    assert (await o.get("/context/preview", params={"message_id": env["msg_in"]})).status_code == 404
    assert (await a.get("/context/preview")).status_code == 422
