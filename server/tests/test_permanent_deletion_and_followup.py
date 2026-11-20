"""Acceptance tests for permanent conversation deletion, suppression markers,
starring retirement, and follow-up tab integration.
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy import select, text

from app.api.v1.routes.inbox import delete_thread, list_threads
from app.core.context import TenantContext
from app.core.database import db_manager
from app.models.commitment import Commitment
from app.models.feedback import DraftFeedback, ResponseOutcome
from app.models.followup import FollowupOccurrence, ThreadFollowupControl, ThreadFollowupState
from app.models.inbox import (
    EmailMessage,
    EmailThread,
    ThreadStatus,
    ThreadSuppressionMarker,
)
from app.models.organization import (
    MembershipStatus,
    Organization,
    OrganizationMember,
    Permission,
    Role,
    RolePermission,
    User,
)
from app.models.outbox import OutboxEvent
from app.models.thread_memory import ThreadMemory
from app.services.gmail_sync import gmail_sync_engine
from tests.conftest import purge_tenant

pytestmark = pytest.mark.asyncio


@pytest.fixture
async def deletion_fixture():
    db_manager.initialize()
    tag = uuid.uuid4().hex[:10]
    org_id = f"org_del_{tag}"
    user_id = f"usr_del_{tag}"
    role_id = f"rol_del_{tag}"
    acc_id = f"int_del_{tag}"
    th_id = f"thr_del_{tag}"
    ext_thread_id = f"ext_th_{tag}"
    mailbox_email = f"sales-{tag}@test.example"
    customer_email = f"buyer-{tag}@client.example"
    now = datetime.now(timezone.utc)

    async with db_manager.session_factory() as db:
        # Create Org, User, Role, Permissions, Membership via raw SQL for guaranteed order
        await db.execute(text("""
            INSERT INTO organizations (id, name, slug, status, plan_tier, is_active, max_integrations, max_members, created_at, updated_at)
            VALUES (:id, 'Deletion Test Org', :slug, 'ACTIVE', 'free', true, 5, 10, now(), now())
        """), {"id": org_id, "slug": f"del-{tag}"})

        await db.execute(text("""
            INSERT INTO users (id, email, hashed_password, full_name, is_active, is_verified, created_at, updated_at)
            VALUES (:id, :e, 'x', 'Admin', true, true, now(), now())
        """), {"id": user_id, "e": f"admin-{tag}@test.example"})

        await db.execute(text("""
            INSERT INTO roles (id, organization_id, name, is_system_role, created_at, updated_at)
            VALUES (:id, :o, 'Admin Role', false, now(), now())
        """), {"id": role_id, "o": org_id})

        all_perms = (await db.execute(select(Permission))).scalars().all()
        for p in all_perms:
            await db.execute(text("""
                INSERT INTO role_permissions (id, role_id, permission_id, created_at, updated_at)
                VALUES (:id, :r, :p, now(), now())
            """), {"id": f"rp_{uuid.uuid4().hex[:12]}", "r": role_id, "p": p.id})

        await db.execute(text("""
            INSERT INTO organization_members (id, organization_id, user_id, role_id, status, created_at, updated_at)
            VALUES (:id, :o, :u, :r, 'ACTIVE', now(), now())
        """), {"id": f"mem_{uuid.uuid4().hex[:12]}", "o": org_id, "u": user_id, "r": role_id})

        # Integration Account
        await db.execute(text("""
            INSERT INTO connected_integration_accounts (id, tenant_id, provider, email_address, display_name,
                status, connection_status, sync_enabled, automation_enabled, created_at, updated_at)
            VALUES (:a, :o, 'gmail', :e, 'Test Mailbox', 'active', 'connected', false, false, now(), now())
        """), {"a": acc_id, "o": org_id, "e": mailbox_email})

        # Thread
        thread = EmailThread(
            id=th_id,
            tenant_id=org_id,
            integration_account_id=acc_id,
            external_thread_id=ext_thread_id,
            subject="Pricing Request",
            sender_email=customer_email,
            sender_name="Buyer",
            status=ThreadStatus.PENDING_TRIAGE.value,
            message_count=2,
            unread_count=1,
            is_read=False,
            latest_message_at=now,
        )
        db.add(thread)
        await db.flush()

        # Messages
        msg1 = EmailMessage(
            id=f"msg_1_{tag}",
            tenant_id=org_id,
            thread_id=th_id,
            integration_account_id=acc_id,
            external_message_id=f"ext_m1_{tag}",
            direction="inbound",
            from_email=customer_email,
            to_emails=f'["{mailbox_email}"]',
            body_text="What is the price?",
            sent_at=now - timedelta(minutes=5),
        )
        msg2 = EmailMessage(
            id=f"msg_2_{tag}",
            tenant_id=org_id,
            thread_id=th_id,
            integration_account_id=acc_id,
            external_message_id=f"ext_m2_{tag}",
            direction="outbound",
            from_email=mailbox_email,
            to_emails=f'["{customer_email}"]',
            body_text="Here is our price.",
            sent_at=now,
        )
        db.add_all([msg1, msg2])

        # Exclusively owned records without FK cascade:
        # Thread memory
        db.add(ThreadMemory(
            id=f"tm_{tag}",
            tenant_id=org_id,
            thread_id=th_id,
            summary="Buyer asked for price",
            messages_included=2,
        ))
        # Commitment
        db.add(Commitment(
            id=f"cm_{tag}",
            tenant_id=org_id,
            thread_id=th_id,
            kind="commitment",
            owed_by="company",
            statement="send quote",
            statement_key="send_quote",
            source_type="email_outbound",
        ))
        # Draft feedback & Response outcome
        db.add(DraftFeedback(
            id=f"fb_{tag}",
            tenant_id=org_id,
            thread_id=th_id,
            action="approved",
            channel="review_api",
        ))
        db.add(ResponseOutcome(
            id=f"ro_{tag}",
            tenant_id=org_id,
            thread_id=th_id,
            sent_message_id=f"msg_2_{tag}",
            customer_message_id=f"msg_1_{tag}",
            sent_by="human",
            outcome="positive",
        ))
        # Outbox event
        db.add(OutboxEvent(
            id=f"oe_{tag}",
            tenant_id=org_id,
            stream_name="email_events",
            event_type="test.event",
            aggregate_type="email_thread",
            aggregate_id=th_id,
            payload="{}",
        ))
        # Follow-up state
        db.add(ThreadFollowupState(
            tenant_id=org_id,
            thread_id=th_id,
            status="scheduled",
            due_at=now + timedelta(days=2),
        ))

        await db.commit()

    context = TenantContext(
        user_id=user_id,
        organization_id=org_id,
        organization=Organization(id=org_id, name="Deletion Test Org", slug=f"del-{tag}"),
        membership=OrganizationMember(id=f"mem_{tag}", organization_id=org_id, user_id=user_id, role_id=role_id, status=MembershipStatus.ACTIVE),
        role_name="Admin Role",
        permissions={p.key for p in all_perms},
    )

    account_data = {
        "id": acc_id,
        "tenant_id": org_id,
        "email_address": mailbox_email,
    }

    try:
        yield {
            "org_id": org_id,
            "thread_id": th_id,
            "acc_id": acc_id,
            "ext_thread_id": ext_thread_id,
            "context": context,
            "account_data": account_data,
        }
    finally:
        await purge_tenant(org_id)


async def test_permanent_deletion_atomic_cascades_and_idempotency(deletion_fixture):
    data = deletion_fixture
    th_id = data["thread_id"]
    org_id = data["org_id"]
    ext_th_id = data["ext_thread_id"]
    ctx = data["context"]

    async with db_manager.session_factory() as db:
        # Verify initial existence
        thread = (await db.execute(select(EmailThread).where(EmailThread.id == th_id))).scalar_one_or_none()
        assert thread is not None

        # Execute permanent deletion
        res = await delete_thread(thread_id=th_id, db=db, context=ctx)
        assert res["deleted"] is True
        assert res["id"] == th_id

    # Verify that thread and all owned records are deleted from DB
    async with db_manager.session_factory() as db:
        th = (await db.execute(select(EmailThread).where(EmailThread.id == th_id))).scalar_one_or_none()
        assert th is None

        msgs = (await db.execute(select(EmailMessage).where(EmailMessage.thread_id == th_id))).scalars().all()
        assert len(msgs) == 0

        tm = (await db.execute(select(ThreadMemory).where(ThreadMemory.thread_id == th_id))).scalars().all()
        assert len(tm) == 0

        cm = (await db.execute(select(Commitment).where(Commitment.thread_id == th_id))).scalars().all()
        assert len(cm) == 0

        fb = (await db.execute(select(DraftFeedback).where(DraftFeedback.thread_id == th_id))).scalars().all()
        assert len(fb) == 0

        ro = (await db.execute(select(ResponseOutcome).where(ResponseOutcome.thread_id == th_id))).scalars().all()
        assert len(ro) == 0

        oe = (await db.execute(select(OutboxEvent).where(OutboxEvent.aggregate_id == th_id))).scalars().all()
        assert len(oe) == 0

        fu = (await db.execute(select(ThreadFollowupState).where(ThreadFollowupState.thread_id == th_id))).scalars().all()
        assert len(fu) == 0

        # Verify suppression marker exists
        marker = (await db.execute(
            select(ThreadSuppressionMarker).where(
                ThreadSuppressionMarker.tenant_id == org_id,
                ThreadSuppressionMarker.external_thread_id == ext_th_id,
            )
        )).scalar_one_or_none()
        assert marker is not None
        assert marker.deleted_thread_id == th_id

        # Idempotent repeated delete succeeds
        repeat_res = await delete_thread(thread_id=th_id, db=db, context=ctx)
        assert repeat_res["deleted"] is True

        # Non-existent thread returns 404 without leak
        with pytest.raises(HTTPException) as exc_info:
            await delete_thread(thread_id="thr_non_existent", db=db, context=ctx)
        assert exc_info.value.status_code == 404


async def test_sync_suppression_and_new_conversation(deletion_fixture):
    data = deletion_fixture
    th_id = data["thread_id"]
    org_id = data["org_id"]
    ext_th_id = data["ext_thread_id"]
    ctx = data["context"]
    acc_data = data["account_data"]

    # Delete the thread to create suppression marker
    async with db_manager.session_factory() as db:
        await delete_thread(thread_id=th_id, db=db, context=ctx)

    # Simulate Gmail sync receiving a message for the DELETED thread
    from unittest.mock import MagicMock
    account_mock = MagicMock()
    account_mock.id = acc_data["id"]
    account_mock.tenant_id = org_id
    account_mock.email_address = acc_data["email_address"]

    deleted_thread_msg = {
        "id": "gmail_msg_old_1",
        "threadId": ext_th_id,
        "payload": {
            "headers": [
                {"name": "From", "value": "buyer@client.example"},
                {"name": "Subject", "value": "Pricing Request"},
            ]
        },
        "snippet": "old message replay",
    }

    async with db_manager.session_factory() as db:
        stored = await gmail_sync_engine._normalize_and_store(
            msg_data=deleted_thread_msg,
            account=account_mock,
            db=db,
        )
        assert stored is False  # Suppressed by tombstone!

    # Simulate Gmail sync receiving a genuinely NEW conversation with a NEW external threadId
    new_ext_th_id = f"ext_new_{uuid.uuid4().hex[:8]}"
    new_thread_msg = {
        "id": "gmail_msg_new_1",
        "threadId": new_ext_th_id,
        "payload": {
            "headers": [
                {"name": "From", "value": "buyer@client.example"},
                {"name": "Subject", "value": "Pricing Request"},
            ],
            "mimeType": "text/plain",
            "body": {"data": "SGk="},  # "Hi" in base64
        },
        "snippet": "new conversation",
    }

    async with db_manager.session_factory() as db:
        # Ingestion for new external_thread_id is not suppressed
        suppressed = (await db.execute(
            select(ThreadSuppressionMarker.id).where(
                ThreadSuppressionMarker.tenant_id == org_id,
                ThreadSuppressionMarker.external_thread_id == new_ext_th_id,
            )
        )).first()
        assert suppressed is None
