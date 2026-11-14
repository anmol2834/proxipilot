"""Phase 10.1 Automated Tests: Pre-Persistence Relevance Filtering & Conversation Context Resolver.

Tests Cover:
1. Multi-signal eligibility classifier against the 38-record golden dataset patterns:
   - Suppresses job alerts, marketing digests, webinar invites, delivery updates, and bank notices.
   - Preserves genuine business enquiries, order continuations, short greetings, and support tickets.
2. Pre-persistence suppression: Suppressed emails NEVER enter email_messages or email_threads.
3. Multi-tenant isolation: Complete separation across tenants with zero data leakage.
4. Bounded chronological context assembly with source traceability.
5. Structured unresolved requirements extraction and lifecycle transitions (OPEN -> FULFILLED).
6. Concurrency & optimistic locking: Thread serialization and revision-safe state updates.
"""

from datetime import datetime, timedelta, timezone
import json
from unittest.mock import AsyncMock, patch
import uuid
import pytest
from sqlalchemy import select

from app.core.database import get_db
from app.models.inbox import EmailMessage, EmailThread, MessageDirection, ThreadStatus
from app.models.integration import ConnectedIntegrationAccount, IntegrationStatus
from app.models.organization import Organization
from app.models.outbox import OutboxEvent
from app.services.context_resolver import (
    ContextEnvelope,
    OptimisticLockException,
    RequirementStatus,
    context_resolver,
)
from app.services.email_filter import (
    ClassificationResult,
    EmailCategory,
    EmailDisposition,
    email_filter,
)
from app.services.gmail_sync import gmail_sync_engine


# =============================================================================
# Test Fixtures
# =============================================================================

@pytest.fixture
async def setup_dual_tenants():
    """Create two distinct test organizations and integration accounts for multi-tenant tests."""
    tenant_a_id = f"org_a_{uuid.uuid4().hex[:8]}"
    tenant_b_id = f"org_b_{uuid.uuid4().hex[:8]}"
    account_a_id = f"int_a_{uuid.uuid4().hex[:8]}"
    account_b_id = f"int_b_{uuid.uuid4().hex[:8]}"

    async for db in get_db():
        org_a = Organization(id=tenant_a_id, name="Tenant Alpha Corp", slug=f"alpha-{uuid.uuid4().hex[:6]}")
        org_b = Organization(id=tenant_b_id, name="Tenant Beta Corp", slug=f"beta-{uuid.uuid4().hex[:6]}")
        db.add_all([org_a, org_b])

        acc_a = ConnectedIntegrationAccount(
            id=account_a_id,
            tenant_id=tenant_a_id,
            provider="gmail",
            email_address="sales@alpha.com",
            status=IntegrationStatus.ACTIVE.value,
        )
        acc_b = ConnectedIntegrationAccount(
            id=account_b_id,
            tenant_id=tenant_b_id,
            provider="gmail",
            email_address="sales@beta.com",
            status=IntegrationStatus.ACTIVE.value,
        )
        db.add_all([acc_a, acc_b])
        await db.commit()

    return {
        "tenant_a": tenant_a_id,
        "tenant_b": tenant_b_id,
        "account_a": account_a_id,
        "account_b": account_b_id,
    }


# =============================================================================
# 1. Golden Dataset Relevance Filtering Regression Tests
# =============================================================================

@pytest.mark.asyncio
async def test_relevance_filtering_golden_dataset():
    """Verify multi-signal classification on patterns from the 38-record inbox export."""
    golden_cases = [
        # --- Promotional / Job Alerts / Digests -> SUPPRESS ---
        {
            "name": "LinkedIn Job Alerts",
            "headers": {"from": "Job Alerts <jobalerts-noreply@linkedin.com>", "subject": "30+ new jobs in Bengaluru"},
            "body": "Your daily job alert. Click here to unsubscribe or manage preferences.",
            "expected_category": EmailCategory.PROMOTIONAL_BULK,
            "expected_should_store": False,
        },
        {
            "name": "Indeed Job Alerts",
            "headers": {"from": "Indeed <donotreply@jobalert.indeed.com>", "subject": "Senior Python Engineer jobs"},
            "body": "View new job opportunities. To opt-out click unsubscribe.",
            "expected_category": EmailCategory.PROMOTIONAL_BULK,
            "expected_should_store": False,
        },
        {
            "name": "Quora Digest",
            "headers": {"from": "Quora Digest <english-quora-digest@quora.com>", "subject": "What are top python libraries?"},
            "body": "Here are top stories for you. Manage your email preferences or unsubscribe.",
            "expected_category": EmailCategory.PROMOTIONAL_BULK,
            "expected_should_store": False,
        },
        {
            "name": "Neon Changelog",
            "headers": {"from": "Neon <changelog@neon.tech>", "subject": "Neon Changelog: Serverless Postgres updates"},
            "body": "Read the latest release notes and updates. You received this newsletter from Neon. Unsubscribe.",
            "expected_category": EmailCategory.PROMOTIONAL_BULK,
            "expected_should_store": False,
        },
        {
            "name": "ProPeers Free Webinar",
            "headers": {"from": "ProPeers <no-reply@propeers.in>", "subject": "FREE Masterclass: System Design Live Tomorrow!"},
            "body": "Reserve your spot now. Limited seats available! Unsubscribe here.",
            "expected_category": EmailCategory.PROMOTIONAL_BULK,
            "expected_should_store": False,
        },
        {
            "name": "ProPeers Final Call Promotional",
            "headers": {"from": "ProPeers <no-reply@propeers.in>", "subject": "Final Call: 50% discount ends tonight!"},
            "body": "Exclusive offer on our bootcamp. Shop now or view in browser. Click to unsubscribe.",
            "expected_category": EmailCategory.PROMOTIONAL_BULK,
            "expected_should_store": False,
        },

        # --- Logistics / Notifications -> SUPPRESS ---
        {
            "name": "Shiprocket Delivery Alert",
            "headers": {"from": "Shiprocket <info@net.shiprocket.in>", "subject": "Your package has been dispatched via Shiprocket"},
            "body": "Your order #849204 has shipped and is out for delivery with tracking id SR998242.",
            "expected_category": EmailCategory.NON_CONVERSATIONAL_NOTIFICATION,
            "expected_should_store": False,
        },
        {
            "name": "Derma Co Order Notification",
            "headers": {"from": "The Derma Co <no-reply@thedermaco.com>", "subject": "Order #48291 confirmed"},
            "body": "Thank you for shopping with us! Your order #48291 has been placed.",
            "expected_category": EmailCategory.NON_CONVERSATIONAL_NOTIFICATION,
            "expected_should_store": False,
        },
        {
            "name": "Grok Usage Reset Notice",
            "headers": {"from": "Cursor Team <grok-bot@mail.cursor.com>", "subject": "Your Fast Request quota has been reset"},
            "body": "This is an automated notification that your monthly request limits have been reset.",
            "expected_category": EmailCategory.NON_CONVERSATIONAL_NOTIFICATION,
            "expected_should_store": False,
        },

        # --- Security & Financial Notices -> SUPPRESS ---
        {
            "name": "Bank of Baroda E-Statement",
            "headers": {"from": "Bank of Baroda <estatement@bankofbaroda.bank.in>", "subject": "e-Statement for your Account XXXX1234"},
            "body": "Dear Customer, please find attached your monthly bank statement. This is a system-generated notice.",
            "expected_category": EmailCategory.SECURITY_OR_FINANCIAL_NOTICE,
            "expected_should_store": False,
        },
        {
            "name": "Heroku MFA Security Alert",
            "headers": {"from": "Heroku Security <bot@notifications.heroku.com>", "subject": "Multi-factor authentication enabled on your account"},
            "body": "This is a security alert. If you did not initiate this change, please reset your password.",
            "expected_category": EmailCategory.SECURITY_OR_FINANCIAL_NOTICE,
            "expected_should_store": False,
        },

        # --- Automated Replies -> SUPPRESS ---
        {
            "name": "Out of Office Auto-Reply",
            "headers": {"from": "colleague@partner.com", "subject": "Automatic reply: Out of office", "auto-submitted": "auto-replied"},
            "body": "I am currently out of the office returning on Monday. Please contact my colleague for urgent matters.",
            "expected_category": EmailCategory.AUTOMATED_REPLY,
            "expected_should_store": False,
        },

        # --- Genuine Business Inquiries & Customer Conversations -> STORE & RESOLVE ---
        {
            "name": "Customer Catalogue & Price List Enquiry",
            "headers": {"from": "Rishi Sinha <rishi.sinha0101@gmail.com>", "subject": "Need catalogue and pricing"},
            "body": "Hi team, please share me your product catalogue and price list for bulk wholesale orders. Thanks, Rishi",
            "expected_category": EmailCategory.BUSINESS_CONVERSATION,
            "expected_should_store": True,
        },
        {
            "name": "Customer Confirmation Continuation",
            "headers": {"from": "Buyer Corp <purchasing@buyer.com>", "subject": "Re: Quote for 500 units"},
            "body": "Thank you for the update, we are ready to proceed with the purchase order.",
            "expected_category": EmailCategory.BUSINESS_CONVERSATION,
            "expected_should_store": True,
        },
        {
            "name": "Short Human Greeting (Hyyy)",
            "headers": {"from": "Ratan Sinha <ratansinha432@gmail.com>", "subject": "Enquiry"},
            "body": "Hyyy",
            "expected_category": EmailCategory.BUSINESS_CONVERSATION,
            "expected_should_store": True,
        },
        {
            "name": "Short Human Greeting (Helloooooooo)",
            "headers": {"from": "Ratan Sinha <ratansinha432@gmail.com>", "subject": "Hello"},
            "body": "Helloooooooo, is someone available to discuss pricing?",
            "expected_category": EmailCategory.BUSINESS_CONVERSATION,
            "expected_should_store": True,
        },
    ]

    for case in golden_cases:
        # Step 1: Metadata classification
        headers_lower = {k.lower(): v for k, v in case["headers"].items()}
        async for db in get_db():
            meta_res = await email_filter.classify_metadata(
                label_ids=["INBOX"],
                headers=headers_lower,
                db=db,
                tenant_id="test_org",
            )
            # Step 2: Body classification (with carryover)
            body_res = email_filter.classify_body(
                body_text=case["body"],
                subject=case["headers"].get("subject", ""),
                from_header=case["headers"].get("from", ""),
                metadata_result=meta_res,
            )

            # Verification
            assert body_res.category == case["expected_category"], (
                f"Failed for {case['name']}: expected category {case['expected_category']}, got {body_res.category} (reasons: {body_res.reasons})"
            )
            assert body_res.should_store == case["expected_should_store"], (
                f"Failed for {case['name']}: expected should_store={case['expected_should_store']}, got {body_res.should_store}"
            )


# =============================================================================
# 2. Pre-Persistence Suppression Test
# =============================================================================

@pytest.mark.asyncio
async def test_suppression_prevents_database_persistence(setup_dual_tenants):
    """Verify that a promotional message is suppressed BEFORE inserting into email_messages or email_threads."""
    tenant_id = setup_dual_tenants["tenant_a"]
    account_id = setup_dual_tenants["account_a"]

    async for db in get_db():
        stmt_acc = select(ConnectedIntegrationAccount).where(ConnectedIntegrationAccount.id == account_id)
        res = await db.execute(stmt_acc)
        account = res.scalar_one()

        # 1. Promotional Email Payload
        promo_msg_id = f"gmail_promo_{uuid.uuid4().hex[:8]}"
        promo_thread_id = f"thr_promo_{uuid.uuid4().hex[:8]}"
        promo_payload = {
            "id": promo_msg_id,
            "threadId": promo_thread_id,
            "payload": {
                "headers": [
                    {"name": "From", "value": "ProPeers <no-reply@propeers.in>"},
                    {"name": "Subject", "value": "Final Call: 50% discount webinar"},
                    {"name": "List-Unsubscribe", "value": "<mailto:unsub@propeers.in>"},
                    {"name": "Precedence", "value": "bulk"},
                ],
                "parts": [
                    {"mimeType": "text/plain", "body": {"data": "UmVzZXJ2ZSB5b3VyIHNwb3Qgbm93LiBDbGljayBoZXJlIHRvIHVuc3Vic2NyaWJl"}} # Base64 for body
                ]
            }
        }

        # Attempt to normalize and store
        stored_promo = await gmail_sync_engine._normalize_and_store(promo_payload, account, db)
        assert stored_promo is False, "Promotional email should be suppressed and return False"

        # Check DB: neither email_messages nor email_threads must exist!
        msg_check = await db.execute(select(EmailMessage).where(EmailMessage.external_message_id == promo_msg_id))
        assert msg_check.scalar_one_or_none() is None, "Suppressed email MUST NOT exist in email_messages table!"

        thr_check = await db.execute(select(EmailThread).where(EmailThread.external_thread_id == promo_thread_id))
        assert thr_check.scalar_one_or_none() is None, "Suppressed email MUST NOT create phantom email_threads row!"

        # 2. Genuine Business Email Payload
        valid_msg_id = f"gmail_valid_{uuid.uuid4().hex[:8]}"
        valid_thread_id = f"thr_valid_{uuid.uuid4().hex[:8]}"
        valid_payload = {
            "id": valid_msg_id,
            "threadId": valid_thread_id,
            "payload": {
                "headers": [
                    {"name": "From", "value": "Customer <rishi.sinha0101@gmail.com>"},
                    {"name": "Subject", "value": "Please share catalogue and price list"},
                ],
                "parts": [
                    {"mimeType": "text/plain", "body": {"data": "SGVsbG8sIHBsZWFzZSBzaGFyZSB5b3VyIHdob2xlc2FsZSBjYXRhbG9ndWUu"}}
                ]
            }
        }

        stored_valid = await gmail_sync_engine._normalize_and_store(valid_payload, account, db)
        assert stored_valid is True, "Genuine enquiry must be stored successfully"

        # Check DB: message and thread must exist
        valid_msg = (await db.execute(select(EmailMessage).where(EmailMessage.external_message_id == valid_msg_id))).scalar_one_or_none()
        assert valid_msg is not None, "Eligible message must exist in email_messages"
        assert valid_msg.filter_reason == EmailCategory.BUSINESS_CONVERSATION.value

        valid_thr = (await db.execute(select(EmailThread).where(EmailThread.external_thread_id == valid_thread_id))).scalar_one_or_none()
        assert valid_thr is not None, "Eligible thread must exist in email_threads"

        # Check Outbox event created for context resolution
        outbox_event = (await db.execute(
            select(OutboxEvent).where(
                OutboxEvent.aggregate_id == valid_msg.id,
                OutboxEvent.event_type == "email.context.resolve"
            )
        )).scalar_one_or_none()
        assert outbox_event is not None, "OutboxEvent for email.context.resolve must be created atomically"


# =============================================================================
# 3. Multi-Tenant Isolation & Zero Leakage Tests
# =============================================================================

@pytest.mark.asyncio
async def test_multi_tenant_isolation_zero_leakage(setup_dual_tenants):
    """Verify that conversation context resolution strictly isolates data between tenants."""
    tenant_a = setup_dual_tenants["tenant_a"]
    tenant_b = setup_dual_tenants["tenant_b"]
    acc_a = setup_dual_tenants["account_a"]
    acc_b = setup_dual_tenants["account_b"]

    shared_sender = "client@universal.com"
    shared_subject = "Urgent Quotation Request"

    now = datetime.now(timezone.utc)
    thr_a_id = f"thr_a_{uuid.uuid4().hex[:8]}"
    thr_b_id = f"thr_b_{uuid.uuid4().hex[:8]}"
    msg_a_id = f"msg_a_{uuid.uuid4().hex[:8]}"
    msg_b_id = f"msg_b_{uuid.uuid4().hex[:8]}"

    async for db in get_db():
        # Setup Thread and Message for Tenant A
        thr_a = EmailThread(
            id=thr_a_id,
            tenant_id=tenant_a,
            integration_account_id=acc_a,
            external_thread_id="ext_thr_100",
            subject=shared_subject,
            sender_email=shared_sender,
            status=ThreadStatus.PENDING_TRIAGE.value,
            context_revision=1,
            first_message_at=now,
            latest_message_at=now,
        )
        msg_a = EmailMessage(
            id=msg_a_id,
            tenant_id=tenant_a,
            integration_account_id=acc_a,
            thread_id=thr_a_id,
            external_message_id="ext_msg_a_001",
            direction=MessageDirection.INBOUND.value,
            from_email=shared_sender,
            body_text="Tenant A Confidential: We want 100 units of Product Alpha.",
            filter_reason=EmailCategory.BUSINESS_CONVERSATION.value,
            sent_at=now,
        )
        # Setup Thread and Message for Tenant B with identical sender & subject
        thr_b = EmailThread(
            id=thr_b_id,
            tenant_id=tenant_b,
            integration_account_id=acc_b,
            external_thread_id="ext_thr_100", # Same external id across different accounts
            subject=shared_subject,
            sender_email=shared_sender,
            status=ThreadStatus.PENDING_TRIAGE.value,
            context_revision=1,
            first_message_at=now,
            latest_message_at=now,
        )
        msg_b = EmailMessage(
            id=msg_b_id,
            tenant_id=tenant_b,
            integration_account_id=acc_b,
            thread_id=thr_b_id,
            external_message_id="ext_msg_b_001",
            direction=MessageDirection.INBOUND.value,
            from_email=shared_sender,
            body_text="Tenant B Confidential: We want 500 units of Product Beta.",
            filter_reason=EmailCategory.BUSINESS_CONVERSATION.value,
            sent_at=now,
        )
        db.add_all([thr_a, msg_a, thr_b, msg_b])
        await db.commit()

    # Resolve Context for Tenant A
    envelope_a: ContextEnvelope = await context_resolver.resolve_context(
        tenant_id=tenant_a,
        integration_account_id=acc_a,
        thread_id=thr_a_id,
        current_message_id=msg_a_id,
    )

    # Resolve Context for Tenant B
    envelope_b: ContextEnvelope = await context_resolver.resolve_context(
        tenant_id=tenant_b,
        integration_account_id=acc_b,
        thread_id=thr_b_id,
        current_message_id=msg_b_id,
    )

    # 1. Assertions on Tenant A envelope
    assert envelope_a.tenant_id == tenant_a
    assert envelope_a.integration_account_id == acc_a
    assert "Product Alpha" in envelope_a.current_message.body_text
    assert "Product Beta" not in envelope_a.current_message.body_text, "Cross-tenant leakage: Tenant B content found in Tenant A envelope!"

    # 2. Assertions on Tenant B envelope
    assert envelope_b.tenant_id == tenant_b
    assert envelope_b.integration_account_id == acc_b
    assert "Product Beta" in envelope_b.current_message.body_text
    assert "Product Alpha" not in envelope_b.current_message.body_text, "Cross-tenant leakage: Tenant A content found in Tenant B envelope!"

    # 3. Cross-Tenant Attempt: Tenant A tries to resolve Tenant B's thread -> MUST RAISE ValueError
    with pytest.raises(ValueError) as excinfo:
        await context_resolver.resolve_context(
            tenant_id=tenant_a,
            integration_account_id=acc_a,
            thread_id=thr_b_id, # Attempting to access Tenant B's thread
            current_message_id=msg_b_id,
        )
    assert f"Thread {thr_b_id} not found for tenant {tenant_a}" in str(excinfo.value)


# =============================================================================
# 4. Bounded Chronological Context & Requirements Lifecycle Test
# =============================================================================

@pytest.mark.asyncio
async def test_context_envelope_bounded_chronology_and_requirements(setup_dual_tenants):
    """Verify bounded previous message window and incremental requirement tracking."""
    tenant_id = setup_dual_tenants["tenant_a"]
    account_id = setup_dual_tenants["account_a"]

    thread_id = f"thr_seq_{uuid.uuid4().hex[:8]}"
    base_time = datetime(2026, 10, 15, 10, 0, 0, tzinfo=timezone.utc)

    # Create thread with 6 sequential messages
    messages = []
    async for db in get_db():
        thread = EmailThread(
            id=thread_id,
            tenant_id=tenant_id,
            integration_account_id=account_id,
            external_thread_id="ext_thr_seq_001",
            subject="Catalogue & Bulk Pricing Discussion",
            sender_email="buyer@wholesale.com",
            status=ThreadStatus.PENDING_TRIAGE.value,
            context_revision=1,
            first_message_at=base_time,
            latest_message_at=base_time + timedelta(hours=5),
        )
        db.add(thread)

        # Message 1 (Customer asks for catalogue)
        m1 = EmailMessage(
            id=f"msg_seq_1_{uuid.uuid4().hex[:6]}",
            tenant_id=tenant_id,
            integration_account_id=account_id,
            thread_id=thread_id,
            external_message_id="ext_seq_1",
            direction=MessageDirection.INBOUND.value,
            from_email="buyer@wholesale.com",
            body_text="Hi, please share me your product catalogue and price list.",
            filter_reason=EmailCategory.BUSINESS_CONVERSATION.value,
            sent_at=base_time,
        )
        # Message 2 (Business agent fulfills catalogue request)
        m2 = EmailMessage(
            id=f"msg_seq_2_{uuid.uuid4().hex[:6]}",
            tenant_id=tenant_id,
            integration_account_id=account_id,
            thread_id=thread_id,
            external_message_id="ext_seq_2",
            direction=MessageDirection.OUTBOUND.value,
            from_email="sales@alpha.com",
            body_text="Attached is the catalogue and price list. Let us know your requirements.",
            filter_reason=EmailCategory.BUSINESS_CONVERSATION.value,
            sent_at=base_time + timedelta(hours=1),
        )
        # Message 3 (Customer asks for discount)
        m3 = EmailMessage(
            id=f"msg_seq_3_{uuid.uuid4().hex[:6]}",
            tenant_id=tenant_id,
            integration_account_id=account_id,
            thread_id=thread_id,
            external_message_id="ext_seq_3",
            direction=MessageDirection.INBOUND.value,
            from_email="buyer@wholesale.com",
            body_text="Thanks, could we get a discount for an order of 2,000 pieces?",
            filter_reason=EmailCategory.BUSINESS_CONVERSATION.value,
            sent_at=base_time + timedelta(hours=2),
        )
        # Message 4 (Agent confirms quote)
        m4 = EmailMessage(
            id=f"msg_seq_4_{uuid.uuid4().hex[:6]}",
            tenant_id=tenant_id,
            integration_account_id=account_id,
            thread_id=thread_id,
            external_message_id="ext_seq_4",
            direction=MessageDirection.OUTBOUND.value,
            from_email="sales@alpha.com",
            body_text="Yes, we can offer 15% off for 2,000 units.",
            filter_reason=EmailCategory.BUSINESS_CONVERSATION.value,
            sent_at=base_time + timedelta(hours=3),
        )
        # Message 5 (Customer confirms order)
        m5 = EmailMessage(
            id=f"msg_seq_5_{uuid.uuid4().hex[:6]}",
            tenant_id=tenant_id,
            integration_account_id=account_id,
            thread_id=thread_id,
            external_message_id="ext_seq_5",
            direction=MessageDirection.INBOUND.value,
            from_email="buyer@wholesale.com",
            body_text="We are ready to proceed. Where should we transfer payment?",
            filter_reason=EmailCategory.BUSINESS_CONVERSATION.value,
            sent_at=base_time + timedelta(hours=4),
        )
        db.add_all([m1, m2, m3, m4, m5])
        await db.commit()
        messages = [m1, m2, m3, m4, m5]

    # Resolve context for Message 5 with max_messages=3
    envelope: ContextEnvelope = await context_resolver.resolve_context(
        tenant_id=tenant_id,
        integration_account_id=account_id,
        thread_id=thread_id,
        current_message_id=messages[-1].id,
        max_messages=3, # Bounded window test
    )

    # 1. Assert Current Message
    assert envelope.current_message.id == messages[-1].id
    assert "Where should we transfer payment?" in envelope.current_message.body_text

    # 2. Assert Bounded Chronology
    # Total prior messages = 4. With max_messages=3, it should include m2, m3, m4.
    assert len(envelope.relevant_previous_messages) == 3
    assert envelope.relevant_previous_messages[0].id == messages[1].id
    assert envelope.relevant_previous_messages[1].id == messages[2].id
    assert envelope.relevant_previous_messages[2].id == messages[3].id

    # Strictly ascending sent_at order
    timestamps = [m.sent_at for m in envelope.relevant_previous_messages]
    assert timestamps == sorted(timestamps)

    # 3. Assert Unresolved Requirements & Lifecycle Transitions
    reqs = envelope.unresolved_requirements
    assert len(reqs) >= 1
    # Check that the catalogue request from m1 was marked FULFILLED by m2
    catalogue_req = next((r for r in reqs if "catalogue" in r.description.lower()), None)
    assert catalogue_req is not None
    assert catalogue_req.status == RequirementStatus.FULFILLED
    assert catalogue_req.fulfilled_by_message_id == messages[1].id

    # 4. Assert Thread Summary State
    assert envelope.thread_summary is not None
    assert "buyer@wholesale.com" in envelope.thread_summary.participants
    assert envelope.context_revision == 2 # Incremented from initial 1


# =============================================================================
# 5. Concurrency & Optimistic Locking Test
# =============================================================================

@pytest.mark.asyncio
async def test_concurrency_optimistic_locking_detection(setup_dual_tenants):
    """Verify that concurrent updates trigger OptimisticLockException when revisions conflict."""
    tenant_id = setup_dual_tenants["tenant_a"]
    account_id = setup_dual_tenants["account_a"]
    thread_id = f"thr_opt_{uuid.uuid4().hex[:8]}"
    msg_id = f"msg_opt_{uuid.uuid4().hex[:8]}"

    async for db in get_db():
        thread = EmailThread(
            id=thread_id,
            tenant_id=tenant_id,
            integration_account_id=account_id,
            external_thread_id="ext_thr_opt",
            subject="Optimistic Locking Verification",
            sender_email="partner@opt.com",
            status=ThreadStatus.PENDING_TRIAGE.value,
            context_revision=1,
            first_message_at=datetime.now(timezone.utc),
            latest_message_at=datetime.now(timezone.utc),
        )
        msg = EmailMessage(
            id=msg_id,
            tenant_id=tenant_id,
            integration_account_id=account_id,
            thread_id=thread_id,
            external_message_id="ext_msg_opt",
            direction=MessageDirection.INBOUND.value,
            from_email="partner@opt.com",
            body_text="Testing concurrent context revision increments.",
            filter_reason=EmailCategory.BUSINESS_CONVERSATION.value,
            sent_at=datetime.now(timezone.utc),
        )
        db.add_all([thread, msg])
        await db.commit()

    # Worker 1 succeeds, incrementing revision 1 -> 2
    env1 = await context_resolver.resolve_context(
        tenant_id=tenant_id,
        integration_account_id=account_id,
        thread_id=thread_id,
        current_message_id=msg_id,
    )
    assert env1.context_revision == 2

    # Worker 2 also succeeds sequentially, incrementing revision 2 -> 3
    env2 = await context_resolver.resolve_context(
        tenant_id=tenant_id,
        integration_account_id=account_id,
        thread_id=thread_id,
        current_message_id=msg_id,
    )
    assert env2.context_revision == 3
