"""Outbound delivery state machine with reconciliation before any retry.

    PENDING ──► SEND_ATTEMPTED ──► PROVIDER_ACCEPTED ──► SENT          (normal)
                     │
                     ├─ 4xx (bad request / forbidden) ───────────────► FAILED_FINAL
                     ├─ 401 / 408 / 429 (not accepted) ──────────────► FAILED_RETRYABLE
                     └─ timeout / network / 5xx ─► DELIVERY_UNKNOWN
                                                     │ reconcile: search the thread for a SENT
                                                     │ message with X-ProxiPilot-Outbound-Id
                                                     ├─ found ─────────────► PROVIDER_ACCEPTED
                                                     ├─ not found ─────────► FAILED_RETRYABLE / FAILED_FINAL
                                                     └─ Gmail unreachable ─► RECONCILIATION_REQUIRED

SEND_ATTEMPTED is committed BEFORE calling Gmail, so a process crash mid-send leaves a durable
marker that the reconciler resolves by asking Gmail (never by blindly re-sending). A retry only
ever happens after Gmail confirmed the message is NOT in the thread: no duplicates, no silent loss.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

import httpx

from app.core.logging import logger
from app.models.outbound import DeliveryStatus

# A record in one of these states must never be sent again by a new pipeline run.
BLOCKING_STATUSES = frozenset({
    DeliveryStatus.SENT.value, DeliveryStatus.PROVIDER_ACCEPTED.value, DeliveryStatus.SEND_ATTEMPTED.value,
    DeliveryStatus.DELIVERY_UNKNOWN.value, DeliveryStatus.RECONCILIATION_REQUIRED.value,
    DeliveryStatus.FAILED_RETRYABLE.value, DeliveryStatus.SENDING.value,
})
SUCCESS_STATUSES = frozenset({DeliveryStatus.SENT.value, DeliveryStatus.PROVIDER_ACCEPTED.value})


class DeliveryOutcomeUnknown(Exception):
    """Gmail may or may not have sent the message and it could not be verified yet."""


def classify_send_failure(err: BaseException) -> str:
    """'unknown' (may have been sent), 'retryable' (definitely not sent) or 'final'."""
    status = getattr(err, "status_code", None)
    if isinstance(err, (httpx.TimeoutException, httpx.NetworkError, httpx.RemoteProtocolError)):
        return "unknown"
    if status is None:
        return "unknown"
    if status in (401, 408, 429):
        return "retryable"
    if 400 <= int(status) < 500:
        return "final"
    return "unknown"          # 5xx: the request may have been processed


async def dispatch_with_reconciliation(
    db: Any, outbound: Any, account: Any, *, gmail_thread_id: Optional[str], send_kwargs: Dict[str, Any],
) -> Dict[str, Any]:
    """Send `outbound` through Gmail under the state machine. Returns the provider response on a
    confirmed send (status PROVIDER_ACCEPTED; the caller finalises to SENT with its bookkeeping).
    Raises on a failed or still-unknown outcome after recording the state durably."""
    from app.services.gmail_client import gmail_client

    now = datetime.now(timezone.utc).isoformat()
    outbound.delivery_status = DeliveryStatus.SEND_ATTEMPTED.value
    outbound.send_attempts = int(outbound.send_attempts or 0) + 1
    outbound.last_attempt_at = now
    await db.commit()   # durable BEFORE the provider call

    token: Optional[str] = None
    try:
        token = await gmail_client.get_valid_access_token(account, db)
        res = await gmail_client.send_message(access_token=token, outbound_id=outbound.id, **send_kwargs)
        outbound.delivery_status = DeliveryStatus.PROVIDER_ACCEPTED.value
        outbound.provider_message_id = str(res.get("id")) if res.get("id") is not None else None
        return res
    except Exception as err:  # noqa: BLE001 - classified below
        kind = "retryable" if token is None else classify_send_failure(err)
        outbound.last_error = f"{type(err).__name__}: {str(err)[:900]}"
        if kind == "final":
            outbound.delivery_status = DeliveryStatus.FAILED_FINAL.value
            await db.commit()
            raise
        if kind == "retryable":
            outbound.delivery_status = _retry_or_final(outbound)
            await db.commit()
            raise
        # Unknown: Gmail may have accepted it. Reconcile before anything else.
        outbound.delivery_status = DeliveryStatus.DELIVERY_UNKNOWN.value
        await db.commit()
        found = await reconcile(outbound, token, gmail_thread_id)
        if found is True:
            await db.commit()
            logger.warning("Send timed out but Gmail had accepted it (reconciled)",
                           outbound_id=outbound.id, provider_message_id=outbound.provider_message_id)
            return {"id": outbound.provider_message_id, "threadId": gmail_thread_id, "reconciled": True}
        await db.commit()
        if found is None:
            raise DeliveryOutcomeUnknown(f"delivery outcome unknown for {outbound.id}") from err
        raise


async def reconcile(outbound: Any, token: Optional[str], gmail_thread_id: Optional[str]) -> Optional[bool]:
    """Ask Gmail whether `outbound` was sent. True = sent (PROVIDER_ACCEPTED), False = verified not
    sent (FAILED_RETRYABLE / FAILED_FINAL), None = could not verify (RECONCILIATION_REQUIRED)."""
    from app.services.gmail_client import gmail_client

    if not token or not gmail_thread_id:
        outbound.delivery_status = DeliveryStatus.RECONCILIATION_REQUIRED.value
        return None
    try:
        provider_id = await gmail_client.find_sent_by_outbound_id(token, gmail_thread_id, outbound.id)
    except Exception as err:  # noqa: BLE001
        outbound.delivery_status = DeliveryStatus.RECONCILIATION_REQUIRED.value
        outbound.last_error = f"reconcile: {type(err).__name__}: {str(err)[:400]}"
        return None
    if provider_id:
        outbound.delivery_status = DeliveryStatus.PROVIDER_ACCEPTED.value
        outbound.provider_message_id = provider_id
        return True
    outbound.delivery_status = _retry_or_final(outbound)
    return False


def _retry_or_final(outbound: Any) -> str:
    if int(outbound.send_attempts or 0) < int(outbound.max_send_attempts or 3):
        return DeliveryStatus.FAILED_RETRYABLE.value
    return DeliveryStatus.FAILED_FINAL.value
