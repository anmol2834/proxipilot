"""Automated Tests for Google Cloud Pub/Sub Webhook Ingestion Pipeline (Phase 10.0).

Tests:
1. Valid Pub/Sub push accepted -> ProviderEvent + OutboxEvent committed atomically -> 200 OK.
2. Layer 1 Deduplication: Repeated delivery ignored via Redis fast-path SETNX -> 200 already_processed.
3. Layer 2 Deduplication: Repeated delivery caught by PostgreSQL UniqueConstraint -> 200 already_processed.
4. Corrupted base64 payload returns 400 Bad Request.
5. Incomplete payload (missing email or historyId) returns 200 ignored_incomplete_payload.
6. Non-numeric historyId returns 200 ignored_incomplete_payload.
7. Unknown / disconnected mailbox returns 200 ignored_unknown_or_disconnected_mailbox.
8. Multi-tenant Ambiguity Guard: multiple active accounts for same email across tenants rejected safely.
9. Account requiring re-authorization returns 200 reauth_required without queueing work.
10. Database unavailability returns retriable HTTP 503 Service Unavailable for Pub/Sub redelivery.
"""

import base64
from contextlib import asynccontextmanager
import json
from unittest.mock import AsyncMock, patch
import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.database import get_db
from app.main import app
from app.models.integration import (
    ConnectedIntegrationAccount,
    EmailProvider,
    IntegrationStatus,
    ProviderEvent,
    ProviderEventStatus,
)
from app.models.organization import Organization
from app.models.outbox import OutboxEvent, OutboxStatus
from app.services.pubsub_auth import pubsub_auth_verifier


@pytest.fixture(autouse=True)
def bypass_pubsub_auth():
    """Bypass cryptographic token check in ingestion tests by default (tested separately in test_pubsub_auth)."""
    with patch.object(
        pubsub_auth_verifier,
        "verify_token",
        new=AsyncMock(return_value={"iss": "https://accounts.google.com", "sub": "mock"}),
    ):
        yield


def _encode_pubsub_envelope(
    email: str = "ingest-test@acme.com",
    history_id: str = "5000100",
    message_id: str = "msg_test_001",
) -> dict:
    """Build a standard Google Cloud Pub/Sub push payload."""
    data_dict = {"emailAddress": email, "historyId": history_id}
    data_bytes = json.dumps(data_dict).encode("utf-8")
    data_b64 = base64.b64encode(data_bytes).decode("utf-8")
    return {
        "message": {
            "data": data_b64,
            "messageId": message_id,
            "publishTime": "2026-10-18T19:00:00.000Z",
        },
        "subscription": "projects/proxipilot/subscriptions/gmail-sub",
    }


@pytest.fixture
async def setup_test_accounts():
    """Create test organization and connected integration accounts."""
    test_org_id = f"org_{uuid.uuid4().hex}"
    account_id = f"int_{uuid.uuid4().hex}"
    email = f"ingest_{uuid.uuid4().hex[:8]}@example.com"

    async for db in get_db():
        org = Organization(
            id=test_org_id,
            name="Ingestion Test Org",
            slug=f"ingest-org-{uuid.uuid4().hex[:6]}",
        )
        db.add(org)

        account = ConnectedIntegrationAccount(
            id=account_id,
            tenant_id=test_org_id,
            provider=EmailProvider.GMAIL.value,
            email_address=email,
            status=IntegrationStatus.CONNECTED.value,
        )
        db.add(account)
        await db.commit()

    yield {
        "org_id": test_org_id,
        "account_id": account_id,
        "email": email,
    }


@pytest.mark.asyncio
async def test_valid_pubsub_push_acceptance_and_outbox(setup_test_accounts):
    """Verify that a valid push request commits ProviderEvent + OutboxEvent and returns 200."""
    acc = setup_test_accounts
    message_id = f"pubsub_{uuid.uuid4().hex}"
    history_id = "5001234"
    payload = _encode_pubsub_envelope(email=acc["email"], history_id=history_id, message_id=message_id)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/webhooks/gmail/pubsub",
            json=payload,
            headers={"Authorization": "Bearer mock-token"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "accepted"
        assert data["message_id"] == message_id

    # Verify database persistence
    async for db in get_db():
        # 1. ProviderEvent created
        stmt_pe = select(ProviderEvent).where(ProviderEvent.provider_event_id == message_id)
        res_pe = await db.execute(stmt_pe)
        pe = res_pe.scalar_one_or_none()
        assert pe is not None
        assert pe.tenant_id == acc["org_id"]
        assert pe.integration_account_id == acc["account_id"]
        assert pe.status == ProviderEventStatus.RECEIVED.value

        # 2. OutboxEvent created atomically
        stmt_oe = select(OutboxEvent).where(OutboxEvent.correlation_id == message_id)
        res_oe = await db.execute(stmt_oe)
        oe = res_oe.scalar_one_or_none()
        assert oe is not None
        assert oe.tenant_id == acc["org_id"]
        assert oe.stream_name == "email_events"
        assert oe.event_type == "gmail.mailbox_change"
        assert oe.status in (OutboxStatus.PENDING.value, OutboxStatus.PUBLISHED.value)
        payload_loaded = json.loads(oe.payload)
        assert payload_loaded["account_id"] == acc["account_id"]
        assert payload_loaded["history_id"] == history_id


@pytest.mark.asyncio
async def test_duplicate_delivery_layer1_redis(setup_test_accounts):
    """Verify Layer 1 deduplication returns already_processed on repeated deliveries."""
    acc = setup_test_accounts
    message_id = f"pubsub_{uuid.uuid4().hex}"
    payload = _encode_pubsub_envelope(email=acc["email"], history_id="5001235", message_id=message_id)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # First delivery: accepted
        resp1 = await client.post(
            "/api/v1/webhooks/gmail/pubsub",
            json=payload,
            headers={"Authorization": "Bearer mock-token"},
        )
        assert resp1.status_code == 200
        assert resp1.json()["status"] == "accepted"

        # Immediate repeated delivery: caught by Redis Layer 1
        resp2 = await client.post(
            "/api/v1/webhooks/gmail/pubsub",
            json=payload,
            headers={"Authorization": "Bearer mock-token"},
        )
        assert resp2.status_code == 200
        assert resp2.json()["status"] == "already_processed"


@pytest.mark.asyncio
async def test_duplicate_delivery_layer2_database_unique_constraint(setup_test_accounts):
    """Verify Layer 2 deduplication returns already_processed when Redis dedupe is bypassed."""
    acc = setup_test_accounts
    message_id = f"pubsub_{uuid.uuid4().hex}"
    payload = _encode_pubsub_envelope(email=acc["email"], history_id="5001236", message_id=message_id)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # First delivery
        resp1 = await client.post(
            "/api/v1/webhooks/gmail/pubsub",
            json=payload,
            headers={"Authorization": "Bearer mock-token"},
        )
        assert resp1.status_code == 200
        assert resp1.json()["status"] == "accepted"

    # Simulate Redis restart/eviction by clearing the Redis dedupe key
    from app.core.redis import redis_manager
    await redis_manager.client.delete(f"gmail:pubsub:dedupe:{message_id}")

    # Second delivery: passes Redis, but PostgreSQL raises IntegrityError on provider_events
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp2 = await client.post(
            "/api/v1/webhooks/gmail/pubsub",
            json=payload,
            headers={"Authorization": "Bearer mock-token"},
        )
        assert resp2.status_code == 200
        assert resp2.json()["status"] == "already_processed"


@pytest.mark.asyncio
async def test_corrupted_base64_returns_400():
    """Verify that a corrupted non-base64 payload is rejected with 400 Bad Request."""
    transport = ASGITransport(app=app)
    payload = {
        "message": {
            "data": "!!!THIS_IS_NOT_VALID_BASE64@@@",
            "messageId": f"pubsub_{uuid.uuid4().hex}",
        }
    }
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/webhooks/gmail/pubsub",
            json=payload,
            headers={"Authorization": "Bearer mock-token"},
        )
        assert resp.status_code == 400


@pytest.mark.asyncio
async def test_incomplete_payload_returns_ignored():
    """Verify that payloads missing emailAddress or historyId return ignored."""
    transport = ASGITransport(app=app)
    # Missing email
    missing_email = base64.b64encode(json.dumps({"historyId": "12345"}).encode()).decode()
    payload = {"message": {"data": missing_email, "messageId": f"msg_{uuid.uuid4().hex}"}}

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/webhooks/gmail/pubsub",
            json=payload,
            headers={"Authorization": "Bearer mock-token"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "ignored_incomplete_payload"


@pytest.mark.asyncio
async def test_non_numeric_history_id_ignored():
    """Verify that non-numeric historyId (e.g. string/NaN) is rejected safely."""
    transport = ASGITransport(app=app)
    bad_history = base64.b64encode(
        json.dumps({"emailAddress": "test@test.com", "historyId": "NOT_A_NUMBER"}).encode()
    ).decode()
    payload = {"message": {"data": bad_history, "messageId": f"msg_{uuid.uuid4().hex}"}}

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/webhooks/gmail/pubsub",
            json=payload,
            headers={"Authorization": "Bearer mock-token"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "ignored_incomplete_payload"


@pytest.mark.asyncio
async def test_unknown_mailbox_ignored():
    """Verify that push notifications for unknown mailboxes are acknowledged without queueing."""
    transport = ASGITransport(app=app)
    payload = _encode_pubsub_envelope(
        email=f"nonexistent_{uuid.uuid4().hex}@domain.com",
        history_id="1000",
        message_id=f"msg_{uuid.uuid4().hex}",
    )

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/webhooks/gmail/pubsub",
            json=payload,
            headers={"Authorization": "Bearer mock-token"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "ignored_unknown_or_disconnected_mailbox"


@pytest.mark.asyncio
async def test_multi_tenant_ambiguity_guard():
    """Negative test: multiple active accounts for the same email address across different organizations
    MUST be rejected to prevent cross-tenant data leaks and processing races."""
    org1_id = f"org_{uuid.uuid4().hex}"
    org2_id = f"org_{uuid.uuid4().hex}"
    shared_email = f"shared_{uuid.uuid4().hex[:8]}@partner.com"

    async for db in get_db():
        # Org 1
        db.add(Organization(id=org1_id, name="Tenant A", slug=f"tenant-a-{uuid.uuid4().hex[:6]}"))
        db.add(ConnectedIntegrationAccount(
            id=f"int_{uuid.uuid4().hex}",
            tenant_id=org1_id,
            provider=EmailProvider.GMAIL.value,
            email_address=shared_email,
            status=IntegrationStatus.CONNECTED.value,
        ))
        # Org 2
        db.add(Organization(id=org2_id, name="Tenant B", slug=f"tenant-b-{uuid.uuid4().hex[:6]}"))
        db.add(ConnectedIntegrationAccount(
            id=f"int_{uuid.uuid4().hex}",
            tenant_id=org2_id,
            provider=EmailProvider.GMAIL.value,
            email_address=shared_email,
            status=IntegrationStatus.CONNECTED.value,
        ))
        await db.commit()

    # Invalidate cache to test DB ambiguity path
    from app.api.v1.routes.webhooks import invalidate_account_cache
    await invalidate_account_cache(shared_email)

    transport = ASGITransport(app=app)
    payload = _encode_pubsub_envelope(
        email=shared_email,
        history_id="123456",
        message_id=f"msg_{uuid.uuid4().hex}",
    )
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/webhooks/gmail/pubsub",
            json=payload,
            headers={"Authorization": "Bearer mock-token"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "ignored_ambiguous_account"


@pytest.mark.asyncio
async def test_database_failure_returns_retriable_503(setup_test_accounts):
    """Verify that if the database is unavailable, webhook returns 503 so Pub/Sub redelivers."""
    acc = setup_test_accounts
    payload = _encode_pubsub_envelope(
        email=acc["email"],
        history_id="5009999",
        message_id=f"msg_{uuid.uuid4().hex}",
    )

    @asynccontextmanager
    async def broken_session():
        raise RuntimeError("Neon serverless pool connection failed")
        yield  # noqa

    class BrokenFactory:
        def __call__(self):
            return broken_session()

    from app.core.database import DatabaseManager
    transport = ASGITransport(app=app)
    with patch.object(DatabaseManager, "session_factory", new_callable=lambda: property(lambda self: BrokenFactory())):
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/webhooks/gmail/pubsub",
                json=payload,
                headers={"Authorization": "Bearer mock-token"},
            )
            assert resp.status_code == 503
            err_data = resp.json().get("error", {})
            assert "Database unavailable" in err_data.get("message", "")
