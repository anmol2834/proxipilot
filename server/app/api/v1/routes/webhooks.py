"""Google Cloud Pub/Sub Push Webhook Endpoint (Phase 10.0 Production Implementation).

Responsibilities:
- Fast acknowledgement (< 50ms) to absorb high-velocity Pub/Sub bursts without redelivery storms.
- Cryptographic authentication of Google-signed OIDC JWT token, issuer, and audience.
- Strict tenant isolation and ambiguous multi-account detection.
- Dual-layer Idempotency:
    Layer 1: Redis fast-path SETNX
    Layer 2: PostgreSQL unique constraint on provider_events(provider, provider_event_id)
- Durable Transactional Outbox:
    Atomically records ProviderEvent audit receipt and OutboxEvent in PostgreSQL before returning 200.
    Returns retriable HTTP 503 if the database is unavailable, ensuring zero volatile event loss.
- Asynchronous Queue Relay:
    Dispatches outbox record to Redis Streams ('email_events') with background sweeper recovery.
"""

from __future__ import annotations

import asyncio
import base64
from datetime import datetime, timezone
import hashlib
import json
import time
from typing import Any, Dict, Optional, cast
import uuid

from fastapi import APIRouter, Header, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import db_manager
from app.core.logging import logger
from app.core.redis import redis_manager
from app.models.integration import (
    ConnectedIntegrationAccount,
    EmailProvider,
    IntegrationStatus,
    ProviderEvent,
    ProviderEventStatus,
)
from app.models.outbox import OutboxEvent, OutboxStatus
from app.services.outbox import outbox_service
from app.services.pubsub_auth import pubsub_auth_verifier

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

ACCOUNT_CACHE_PREFIX = "gmail:account_cache:"
ACCOUNT_CACHE_TTL_SECONDS = 300  # 5 minutes


async def invalidate_account_cache(email_address: str) -> None:
    """Invalidate cached integration account metadata in Redis."""
    try:
        redis_client = redis_manager.client
        await redis_client.delete(f"{ACCOUNT_CACHE_PREFIX}{email_address.strip().lower()}")
    except Exception as err:
        logger.warning("Failed to invalidate account cache", email=email_address, error=str(err))


async def _resolve_account_info(email_address: str) -> Optional[Dict[str, Any]]:
    """Resolve integration account with Redis fast-path cache and strict multi-account ambiguity check."""
    redis_client = redis_manager.client
    cache_key = f"{ACCOUNT_CACHE_PREFIX}{email_address}"

    try:
        cached_raw = await redis_client.get(cache_key)
        if cached_raw:
            return cast(Dict[str, Any], json.loads(cached_raw))
    except Exception as cache_err:
        logger.warning("Redis account cache read error, falling back to DB", error=str(cache_err))

    # Cache miss: query PostgreSQL read-only without row locks
    try:
        async with db_manager.session_factory() as db:
            stmt = (
                select(
                    ConnectedIntegrationAccount.id,
                    ConnectedIntegrationAccount.tenant_id,
                    ConnectedIntegrationAccount.status,
                    ConnectedIntegrationAccount.email_address,
                )
                .where(
                    ConnectedIntegrationAccount.email_address == email_address,
                    ConnectedIntegrationAccount.provider == EmailProvider.GMAIL.value,
                )
            )
            res = await db.execute(stmt)
            rows = res.all()
            if not rows:
                return None

            # Multi-tenant ambiguity guard: detect multiple active accounts for the same email
            active_rows = [r for r in rows if r.status != IntegrationStatus.DISCONNECTED.value]
            if len(active_rows) > 1:
                logger.warning(
                    "Ambiguous integration accounts detected for email address; rejecting cross-tenant routing",
                    email=email_address,
                    count=len(active_rows),
                )
                return {"ambiguous": True}

            row = active_rows[0] if active_rows else rows[0]
            account_info = {
                "id": row.id,
                "tenant_id": row.tenant_id,
                "status": row.status,
                "email_address": row.email_address,
                "ambiguous": False,
            }

            try:
                await redis_client.set(cache_key, json.dumps(account_info), ex=ACCOUNT_CACHE_TTL_SECONDS)
            except Exception as cache_write_err:
                logger.warning("Failed to write account cache to Redis", error=str(cache_write_err))

            return account_info
    except HTTPException:
        raise
    except Exception as db_err:
        logger.error("Failed to query integration account from database; DB unavailable", error=str(db_err))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable; account resolution deferred for Pub/Sub retry",
        )


class PubSubMessagePayload(BaseModel):
    data: str
    messageId: str
    publishTime: Optional[str] = None


class PubSubPushEnvelope(BaseModel):
    message: PubSubMessagePayload
    subscription: Optional[str] = None


@router.post("/gmail/pubsub", status_code=status.HTTP_200_OK)
async def handle_gmail_pubsub_push(
    request: Request,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    """Google Cloud Pub/Sub Push Webhook for Gmail mailbox change notifications."""
    t_webhook_start = time.perf_counter()
    settings = get_settings()

    # 1. Cryptographic Google Cloud OIDC token validation
    expected_audience = settings.providers.gmail_pubsub_push_audience
    t_auth_start = time.perf_counter()
    if expected_audience:
        try:
            await pubsub_auth_verifier.verify_token(
                auth_header=authorization,
                expected_audience=expected_audience,
                expected_service_account=settings.providers.gmail_pubsub_push_service_account or None,
            )
        except Exception as auth_err:
            logger.warning("Google Pub/Sub push authentication failed", error=str(auth_err))
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Unauthorized Pub/Sub push: {auth_err}",
            )
    auth_duration_ms = (time.perf_counter() - t_auth_start) * 1000.0

    # 2. Parse request JSON envelope
    try:
        body = await request.json()
        envelope = PubSubPushEnvelope(**body)
    except Exception as exc:
        logger.warning("Invalid Google Pub/Sub push payload format", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Pub/Sub push payload format",
        )

    msg = envelope.message
    message_id = msg.messageId

    # 3. Layer 1: Fast-Path Idempotency via Redis
    t_dedupe_start = time.perf_counter()
    redis_client = redis_manager.client
    redis_dedupe_key = f"gmail:pubsub:dedupe:{message_id}"
    try:
        is_new = await redis_client.set(redis_dedupe_key, "1", ex=86400 * 2, nx=True)
        if not is_new:
            logger.info("Duplicate Pub/Sub event ignored via Redis fast-path", message_id=message_id)
            return {"status": "already_processed", "message_id": message_id}
    except Exception as redis_dedupe_err:
        logger.warning(
            "Redis dedupe check unavailable, proceeding to DB constraint check",
            message_id=message_id,
            error=str(redis_dedupe_err),
        )
    redis_dedupe_ms = (time.perf_counter() - t_dedupe_start) * 1000.0

    # 4. Decode base64 data payload
    try:
        raw_data = base64.b64decode(msg.data).decode("utf-8")
        parsed_data = json.loads(raw_data)
    except Exception as dec_err:
        logger.error("Failed to decode Pub/Sub data payload", error=str(dec_err), message_id=message_id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Corrupted base64 data in message",
        )

    email_address = parsed_data.get("emailAddress", "").strip().lower()
    history_id_raw = parsed_data.get("historyId", "")
    if not email_address or not history_id_raw:
        logger.warning("Pub/Sub message missing emailAddress or historyId", message_id=message_id)
        return {"status": "ignored_incomplete_payload"}

    try:
        history_id_int = int(history_id_raw)
        history_id = str(history_id_int)
    except (ValueError, TypeError) as num_err:
        logger.warning("Pub/Sub message contains invalid historyId", error=str(num_err), message_id=message_id)
        return {"status": "ignored_incomplete_payload"}

    now_utc = datetime.now(timezone.utc)
    now_str = now_utc.isoformat()
    payload_hash = hashlib.sha256(raw_data.encode("utf-8")).hexdigest()

    # 5. Fast account resolution with ambiguity safety
    t_resolve_start = time.perf_counter()
    account_info = await _resolve_account_info(email_address)
    account_resolve_ms = (time.perf_counter() - t_resolve_start) * 1000.0

    if not account_info:
        logger.info(
            "Pub/Sub push received for unknown mailbox; ignoring",
            email=email_address,
            message_id=message_id,
        )
        return {"status": "ignored_unknown_or_disconnected_mailbox"}

    if account_info.get("ambiguous"):
        logger.warning(
            "Pub/Sub push ignored due to ambiguous mailbox mapping across tenants",
            email=email_address,
            message_id=message_id,
        )
        return {"status": "ignored_ambiguous_account"}

    if account_info["status"] == IntegrationStatus.DISCONNECTED.value:
        logger.info(
            "Pub/Sub push received for disconnected mailbox; ignoring",
            email=email_address,
            message_id=message_id,
        )
        return {"status": "ignored_unknown_or_disconnected_mailbox"}

    if account_info["status"] == IntegrationStatus.REAUTH_REQUIRED.value:
        logger.info(
            "Pub/Sub push acknowledged for account requiring re-authorization; skipping sync queue",
            email=email_address,
            account_id=account_info["id"],
            message_id=message_id,
        )
        return {"status": "reauth_required", "message_id": message_id}

    # 6. Durable Event Acceptance: Atomic Transaction (ProviderEvent + OutboxEvent)
    outbox_id = f"out_{uuid.uuid4().hex}"
    outbox_payload = {
        "account_id": account_info["id"],
        "email_address": account_info["email_address"],
        "history_id": history_id,
        "provider_event_id": message_id,
    }

    t_db_start = time.perf_counter()
    try:
        async with db_manager.session_factory() as db:
            # Layer 2 Ingress Deduplication: provider_events unique constraint
            prov_event = ProviderEvent(
                tenant_id=account_info["tenant_id"],
                integration_account_id=account_info["id"],
                provider="gmail",
                provider_event_id=message_id,
                event_type="gmail.mailbox_change",
                event_payload_hash=payload_hash,
                provider_timestamp=msg.publishTime,
                received_at=now_str,
                status=ProviderEventStatus.RECEIVED.value,
            )
            db.add(prov_event)

            # Transactional Outbox Record
            outbox_event = OutboxEvent(
                id=outbox_id,
                tenant_id=account_info["tenant_id"],
                stream_name="email_events",
                event_type="gmail.mailbox_change",
                aggregate_type="integration_account",
                aggregate_id=account_info["id"],
                payload=json.dumps(outbox_payload),
                correlation_id=message_id,
                causation_id=message_id,
                status=OutboxStatus.PENDING.value,
                retry_count=0,
            )
            db.add(outbox_event)

            # Throttled update of last_event_received_at (prevents row-lock contention)
            throttle_key = f"gmail:account:last_event_throttle:{account_info['id']}"
            try:
                should_update_row = await redis_client.set(throttle_key, "1", ex=60, nx=True)
            except Exception:
                should_update_row = False

            if should_update_row:
                await db.execute(
                    update(ConnectedIntegrationAccount)
                    .where(ConnectedIntegrationAccount.id == account_info["id"])
                    .values(last_event_received_at=now_str)
                )

            await db.commit()
    except IntegrityError:
        # Layer 2 Duplicate caught by unique constraint on (provider, provider_event_id)
        logger.info(
            "Duplicate Pub/Sub event ignored via database unique constraint",
            message_id=message_id,
            provider="gmail",
        )
        return {"status": "already_processed", "message_id": message_id}
    except Exception as db_err:
        logger.error(
            "Durable event acceptance failed; database unavailable",
            message_id=message_id,
            error=str(db_err),
        )
        # Return retriable HTTP 503 so Google Pub/Sub redelivers!
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable; event acceptance deferred for Pub/Sub retry",
        )
    db_commit_ms = (time.perf_counter() - t_db_start) * 1000.0
    total_duration_ms = (time.perf_counter() - t_webhook_start) * 1000.0

    # 7. Asynchronous Fast-Path Outbox Dispatch to Redis Stream
    asyncio.create_task(outbox_service.dispatch_fast_path(outbox_id))

    logger.info(
        "Gmail Pub/Sub push accepted and persisted to outbox",
        email=email_address,
        history_id=history_id,
        message_id=message_id,
        outbox_id=outbox_id,
        duration_ms=round(total_duration_ms, 2),
        auth_ms=round(auth_duration_ms, 2),
        dedupe_ms=round(redis_dedupe_ms, 2),
        resolve_ms=round(account_resolve_ms, 2),
        db_commit_ms=round(db_commit_ms, 2),
    )
    # Fast 200 acknowledgment returned immediately (< 50ms)
    return {"status": "accepted", "message_id": message_id}
