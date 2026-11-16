"""Delivery reconciler against real PostgreSQL (throwaway org, purged afterwards); Gmail is faked.

Scenarios: a send whose outcome was unknown but Gmail had accepted it (confirmed, never resent);
verified-not-sent (resent exactly once); a stale reply (cancelled for the team); a reply superseded by
a newer customer message (cancelled)."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select, text

from conftest import purge_tenant

pytestmark = pytest.mark.asyncio


@pytest.fixture
async def world(monkeypatch):
    from app.core.database import db_manager
    from app.services import gmail_client as gc

    tag = uuid.uuid4().hex[:10]
    org, acc, th = f"org_itest_dr_{tag}", f"int_itest_dr_{tag}", f"thr_itest_dr_{tag}"
    now = datetime.now(timezone.utc)
    async with db_manager.session_factory() as db:
        await db.execute(text("""INSERT INTO organizations (id, name, slug, status, plan_tier, is_active,
            max_integrations, max_members, created_at, updated_at) VALUES (:id, 'Integration Test Catalogue',
            :slug, 'ACTIVE', 'free', true, 5, 10, now(), now())"""), {"id": org, "slug": f"it-dr-{tag}"})
        await db.execute(text("""INSERT INTO connected_integration_accounts (id, tenant_id, provider, email_address,
            status, connection_status, sync_enabled, automation_enabled, created_at, updated_at)
            VALUES (:a, :t, 'gmail', :e, 'active', 'connected', false, true, now(), now())"""),
            {"a": acc, "t": org, "e": f"sales-{tag}@itest.example"})
        await db.execute(text("""INSERT INTO email_threads (id, tenant_id, integration_account_id, external_thread_id,
            subject, status, message_count, unread_count, is_read, is_starred, context_revision, first_message_at,
            latest_message_at, created_at, updated_at) VALUES (:th, :t, :a, :ext, 'Quote', 'open', 1, 1, false,
            false, 1, :at, :at, now(), now())"""), {"th": th, "t": org, "a": acc, "ext": f"gth_{tag}", "at": now})
        await db.execute(text("""INSERT INTO email_messages (id, tenant_id, thread_id, integration_account_id,
            external_message_id, direction, from_email, to_emails, body_text, sent_at, message_id_header,
            filter_reason, created_at, updated_at) VALUES (:id, :t, :th, :a, :ext, 'inbound', 'buyer@itest.example',
            '[]', 'price please', :at, '<cust@mail>', 'ACCEPT', now(), now())"""),
            {"id": f"msg_in_{tag}", "t": org, "th": th, "a": acc, "ext": f"gin_{tag}", "at": now - timedelta(minutes=10)})
        await db.commit()

    sent_log = []

    async def token(_a, _db):
        return "tok"

    async def send_message(**kw):
        sent_log.append(kw["outbound_id"])
        return {"id": f"g_resent_{kw['outbound_id']}", "threadId": f"gth_{tag}"}

    gmail_has = {}

    async def find_sent(_tok, _thread, out_id):
        return gmail_has.get(out_id)
    monkeypatch.setattr(gc.gmail_client, "get_valid_access_token", token)
    monkeypatch.setattr(gc.gmail_client, "send_message", send_message)
    monkeypatch.setattr(gc.gmail_client, "find_sent_by_outbound_id", find_sent)

    async def make_out(status, created_ago_min=5, attempts=1, attempted_ago_min=10):
        out_id = f"out_itest_{uuid.uuid4().hex[:10]}"
        async with db_manager.session_factory() as db:
            await db.execute(text("""INSERT INTO outbound_messages (id, tenant_id, thread_id, integration_account_id,
                to_emails, subject, body_html, body_text, idempotency_key, in_reply_to_external_id, delivery_status,
                send_attempts, max_send_attempts, last_attempt_at, created_at, updated_at)
                VALUES (:id, :t, :th, :a, '["buyer@itest.example"]', 'Re: Quote', '<p>hi</p>', 'hi', :k, :inr, :st,
                :n, 3, :la, :ca, now())"""),
                {"id": out_id, "t": org, "th": th, "a": acc, "k": f"pp_itest_{out_id}", "inr": f"gin_{tag}",
                 "st": status, "n": attempts, "la": (now - timedelta(minutes=attempted_ago_min)).isoformat(),
                 "ca": now - timedelta(minutes=created_ago_min)})
            await db.commit()
        return out_id

    async def status_of(out_id):
        from app.models.outbound import OutboundMessage
        async with db_manager.session_factory() as db:
            return (await db.execute(select(OutboundMessage.delivery_status).where(OutboundMessage.id == out_id))).scalar_one()

    try:
        yield {"org": org, "th": th, "tag": tag, "make_out": make_out, "status_of": status_of,
               "sent_log": sent_log, "gmail_has": gmail_has}
    finally:
        await purge_tenant(org)


async def test_unknown_outcome_confirmed_by_gmail_is_never_resent(world):
    from app.services.reply_planner.delivery_reconciler import delivery_reconciler
    out_id = await world["make_out"]("delivery_unknown")
    world["gmail_has"][out_id] = "g_original"
    await delivery_reconciler.run_once(tenant_id=world["org"])
    assert await world["status_of"](out_id) == "sent" and world["sent_log"] == []


async def test_verified_not_sent_is_resent_exactly_once(world):
    from app.services.reply_planner.delivery_reconciler import delivery_reconciler
    out_id = await world["make_out"]("send_attempted")      # sender crashed mid-send
    await delivery_reconciler.run_once(tenant_id=world["org"])
    assert world["sent_log"] == [out_id] and await world["status_of"](out_id) == "sent"
    await delivery_reconciler.run_once(tenant_id=world["org"])                       # nothing left to do
    assert world["sent_log"] == [out_id]


async def test_stale_reply_is_cancelled_not_sent(world):
    from app.services.reply_planner.delivery_reconciler import delivery_reconciler
    out_id = await world["make_out"]("failed_retryable", created_ago_min=90)
    await delivery_reconciler.run_once(tenant_id=world["org"])
    assert await world["status_of"](out_id) == "cancelled" and world["sent_log"] == []


async def test_superseded_by_newer_customer_message_is_cancelled(world):
    from app.core.database import db_manager
    from app.services.reply_planner.delivery_reconciler import delivery_reconciler
    out_id = await world["make_out"]("failed_retryable", created_ago_min=5)
    async with db_manager.session_factory() as db:
        await db.execute(text("""INSERT INTO email_messages (id, tenant_id, thread_id, integration_account_id,
            external_message_id, direction, from_email, to_emails, body_text, sent_at, filter_reason, created_at,
            updated_at) SELECT :id, tenant_id, id, integration_account_id, :ext, 'inbound', 'buyer@itest.example',
            '[]', 'any update?', now(), 'ACCEPT', now(), now() FROM email_threads WHERE id = :th"""),
            {"id": f"msg_in2_{world['tag']}", "ext": f"gin2_{world['tag']}", "th": world["th"]})
        await db.commit()
    await delivery_reconciler.run_once(tenant_id=world["org"])
    assert await world["status_of"](out_id) == "cancelled" and world["sent_log"] == []
