"""Thread message history API: newest page first, cursor walks back through older pages.

Creates a throwaway organisation with one mailbox and a 12-message thread (customer and our
replies alternating), calls the route function directly, then deletes everything it created.
"""

import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlalchemy import text

from app.api.v1.routes.inbox import list_thread_messages
from app.core.database import db_manager
from app.models.organization import Organization
from tests.conftest import purge_tenant

N_MESSAGES = 12


@pytest.fixture
async def thread_fixture():
    db_manager.initialize()
    tag = uuid.uuid4().hex[:12]
    org_id = f"org_itest_inbox_{tag}"
    ids = {"org": org_id, "account": f"int_itest_{tag}", "thread": f"thr_itest_{tag}",
           "mailbox": f"sales-{tag}@itest.example", "customer": "buyer@itest.example"}
    base = datetime(2026, 1, 5, 9, 0, tzinfo=timezone.utc)
    async with db_manager.session_factory() as db:
        db.add(Organization(id=org_id, name="Inbox Test Org", slug=f"inbox-test-{tag}"))
        await db.flush()
        await db.execute(text("""
            INSERT INTO connected_integration_accounts (id, tenant_id, provider, email_address, display_name,
                status, connection_status, sync_enabled, automation_enabled, created_at, updated_at)
            VALUES (:a, :o, 'gmail', :e, 'Acme Sales', 'active', 'connected', false, false, now(), now())"""),
            {"a": ids["account"], "o": org_id, "e": ids["mailbox"]})
        await db.execute(text("""
            INSERT INTO email_threads (id, tenant_id, integration_account_id, external_thread_id, subject,
                sender_email, sender_name, status, message_count, unread_count, is_read,
                context_revision, first_message_at, latest_message_at, created_at, updated_at)
            VALUES (:th, :o, :a, :ext, 'Quote request', :c, 'Buyer', 'responded', 6, 0, true, 1,
                    :first, :latest, now(), now())"""),
            {"th": ids["thread"], "o": org_id, "a": ids["account"], "ext": f"ext_{tag}", "c": ids["customer"],
             "first": base, "latest": base + timedelta(minutes=N_MESSAGES)})
        for i in range(N_MESSAGES):
            inbound = i % 2 == 0
            await db.execute(text("""
                INSERT INTO email_messages (id, tenant_id, thread_id, integration_account_id,
                    external_message_id, direction, from_email, from_name, to_emails, body_text,
                    sent_at, created_at, updated_at)
                VALUES (:id, :o, :th, :a, :ext, :dir, :frm, :name, :to, :body, :at, now(), now())"""),
                {"id": f"msg_itest_{tag}_{i:02d}", "o": org_id, "th": ids["thread"], "a": ids["account"],
                 "ext": f"ext_msg_{tag}_{i}", "dir": "inbound" if inbound else "outbound",
                 "frm": ids["customer"] if inbound else ids["mailbox"],
                 "name": "Buyer" if inbound else None,
                 "to": f'["{ids["mailbox"] if inbound else ids["customer"]}"]',
                 "body": f"message {i}", "at": base + timedelta(minutes=i)})
        await db.commit()
    try:
        yield ids
    finally:
        await purge_tenant(org_id)


def _ctx(org_id: str):
    return SimpleNamespace(organization_id=org_id)


async def _page(thread_id, org_id, before=None, limit=5):
    async with db_manager.session_factory() as db:
        return await list_thread_messages(thread_id=thread_id, limit=limit, before=before, db=db, context=_ctx(org_id))


@pytest.mark.asyncio
async def test_pages_walk_backwards_from_the_newest(thread_fixture):
    ids = thread_fixture

    first = await _page(ids["thread"], ids["org"])
    # Opening the thread shows the NEWEST five, oldest-to-newest within the page.
    assert [m.body_text for m in first.items] == [f"message {i}" for i in range(7, 12)]
    assert first.has_more and first.previous_cursor
    assert first.total_count == N_MESSAGES
    assert first.mailbox.email == ids["mailbox"] and first.mailbox.name == "Acme Sales"

    second = await _page(ids["thread"], ids["org"], before=first.previous_cursor)
    assert [m.body_text for m in second.items] == [f"message {i}" for i in range(2, 7)]
    assert second.has_more and second.total_count is None  # count only on the first page

    third = await _page(ids["thread"], ids["org"], before=second.previous_cursor)
    assert [m.body_text for m in third.items] == ["message 0", "message 1"]
    assert not third.has_more and third.previous_cursor is None

    seen = [m.id for p in (third, second, first) for m in p.items]
    assert len(seen) == len(set(seen)) == N_MESSAGES  # no gaps, no duplicates


@pytest.mark.asyncio
async def test_messages_say_who_sent_them(thread_fixture):
    ids = thread_fixture
    page = await _page(ids["thread"], ids["org"], limit=2)
    by_dir = {m.direction: m for m in page.items}
    ours, theirs = by_dir["outbound"], by_dir["inbound"]
    assert ours.from_me and ours.sender.email == ids["mailbox"]
    assert ours.sender.name == "Acme Sales"  # provider gave no name: falls back to the mailbox's
    assert ours.to_emails == [ids["customer"]]
    assert not theirs.from_me and theirs.sender.name == "Buyer" and theirs.to_emails == [ids["mailbox"]]


@pytest.mark.asyncio
async def test_other_tenants_and_bad_cursors_are_rejected(thread_fixture):
    ids = thread_fixture
    with pytest.raises(HTTPException) as e:
        await _page(ids["thread"], "org_does_not_exist")
    assert e.value.status_code == 404
    with pytest.raises(HTTPException) as e:
        await _page(ids["thread"], ids["org"], before="not-a-cursor")
    assert e.value.status_code == 400
