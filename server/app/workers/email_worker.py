"""Email Background Worker Implementation.

Consumes: 'email_events' Redis stream.
Consumer Group: 'email-worker-group'
Concurrency: Bounded by asyncio.Semaphore (EMAIL_WORKER_CONCURRENCY).
Responsibilities:
- Incremental Gmail synchronization upon Pub/Sub push notification.
- Initial mailbox synchronization upon OAuth connection.
- Recovery synchronization fallback upon cursor invalidation.
- Distributed per-account lock protection against concurrent mailbox races.
- Automatic DLQ routing for poisoned messages via BaseWorker.
"""

from app.core.config import get_email_worker_settings
from app.core.database import db_manager
from app.core.logging import logger
from app.core.messaging import DomainEvent
from app.services.gmail_sync import gmail_sync_engine
from app.services.gmail_watch import gmail_watch_service
from app.workers.base import BaseWorker


class EmailWorker(BaseWorker):
    """Worker responsible for email ingestion processing and outbound delivery via Gmail/Graph."""

    def __init__(self, standalone: bool = True):
        settings = get_email_worker_settings()
        super().__init__(
            worker_name="email-worker",
            stream_name="email_events",
            group_name="email-worker-group",
            concurrency=settings.worker.email_worker_concurrency,
            max_retries=settings.providers.gmail_max_retries,
            standalone=standalone,
        )
        self.settings = settings

    async def process_event(self, event: DomainEvent) -> None:
        """Process inbound Gmail Pub/Sub events or sync dispatch jobs."""
        event_type = event.event_type
        payload = event.payload or {}
        account_id = payload.get("account_id") or event.aggregate_id

        logger.info(
            "EmailWorker processing event",
            event_id=event.event_id,
            event_type=event_type,
            tenant_id=event.tenant_id,
            account_id=account_id,
        )

        if not account_id:
            logger.warning("Event missing account_id in payload, skipping", event_id=event.event_id)
            return

        if event_type in ("gmail.mailbox_change", "gmail.incremental_sync"):
            # Pass history_id for coalescing — if another sync is running,
            # the high-watermark ensures this event is not silently lost.
            incoming_history_id = payload.get("history_id")
            await gmail_sync_engine.sync_account(
                account_id=account_id,
                incoming_history_id=incoming_history_id,
            )

        elif event_type in ("gmail.initial_sync", "gmail.recovery_sync"):
            # Initial and recovery syncs establish baseline with full sync
            await gmail_sync_engine.sync_account(account_id=account_id, is_initial_sync=True)

        elif event_type == "gmail.watch_renew":
            from sqlalchemy import select
            from app.models.integration import ConnectedIntegrationAccount
            async with db_manager.session_factory() as session:
                res = await session.execute(
                    select(ConnectedIntegrationAccount).where(ConnectedIntegrationAccount.id == account_id)
                )
                account = res.scalar_one_or_none()
                if account:
                    await gmail_watch_service.create_or_renew_watch(account, session, is_renewal=True)

        elif event_type == "email.context.resolve":
            from app.services.context_resolver import context_resolver
            thread_id = payload.get("thread_id")
            message_id = payload.get("message_id")
            tenant_id = event.tenant_id or payload.get("tenant_id")
            if not thread_id or not message_id or not tenant_id:
                logger.warning(
                    "email.context.resolve missing required identifiers",
                    event_id=event.event_id,
                    thread_id=thread_id,
                    message_id=message_id,
                    tenant_id=tenant_id,
                )
                return

            # Single-flight deduplication per (tenant, thread, message)
            from app.core.redis import redis_manager
            redis_client = redis_manager.client
            resolve_lock_key = f"email:context_resolve:{tenant_id}:{thread_id}:{message_id}"
            try:
                acquired = await redis_client.set(resolve_lock_key, "1", nx=True, ex=300)
                if not acquired:
                    logger.info(
                        "email.context.resolve already in progress or completed for message, skipping duplicate",
                        thread_id=thread_id,
                        message_id=message_id,
                    )
                    return
            except Exception as err:
                logger.warning("Redis lock check failed in EmailWorker", error=str(err))

            try:
                # Database check: Ensure message exists, is INBOUND, and has not already been replied to
                from sqlalchemy import select
                from app.models.inbox import EmailMessage, MessageDirection
                from app.models.outbound import OutboundMessage
                from app.services.reply_planner.delivery_state import BLOCKING_STATUSES
                async with db_manager.session_factory() as check_session:
                    msg = await check_session.get(EmailMessage, message_id)
                    if not msg:
                        logger.warning("Message not found for context resolution", message_id=message_id)
                        return
                    if msg.direction != MessageDirection.INBOUND.value:
                        logger.info("Message is not inbound, skipping context resolution", message_id=message_id, direction=msg.direction)
                        return

                    stmt_replied = select(EmailMessage.id).where(
                        EmailMessage.thread_id == thread_id,
                        EmailMessage.direction == MessageDirection.OUTBOUND.value,
                        EmailMessage.in_reply_to_external_id == msg.external_message_id,
                    )
                    if (await check_session.execute(stmt_replied)).scalar_one_or_none():
                        logger.info("Message has already been replied to (EmailMessage exists), skipping", message_id=message_id)
                        return

                    stmt_out_sent = select(OutboundMessage.id).where(
                        OutboundMessage.thread_id == thread_id,
                        OutboundMessage.in_reply_to_external_id == msg.external_message_id,
                        OutboundMessage.delivery_status.in_(BLOCKING_STATUSES),
                    )
                    if (await check_session.execute(stmt_out_sent)).scalar_one_or_none():
                        logger.info("Message has already been replied to (OutboundMessage exists), skipping", message_id=message_id)
                        return

                envelope = await context_resolver.resolve_context(
                    tenant_id=tenant_id,
                    integration_account_id=account_id,
                    thread_id=thread_id,
                    current_message_id=message_id,
                )
                logger.info(
                    "Conversation context resolved by email worker",
                    event_id=event.event_id,
                    tenant_id=tenant_id,
                    thread_id=thread_id,
                    message_id=message_id,
                    revision=envelope.context_revision,
                    open_requirements=len([r for r in envelope.unresolved_requirements if r.status.value == "OPEN"]),
                )

                # Stage 3: Requirement & Intent Planner
                from app.services.requirement_planner import requirement_planner_service
                async with db_manager.session_factory() as session:
                    await requirement_planner_service.plan_requirements(
                        envelope=envelope,
                        db=session,
                        dispatch_event=True,
                    )
            except Exception:
                # Free the single-flight lock so the stream's retry (PEL redelivery) can run;
                # otherwise the retry is skipped as "already in progress" and the email is lost.
                try:
                    await redis_client.delete(resolve_lock_key)
                except Exception as rel_err:  # noqa: BLE001 - the lock still expires
                    logger.warning("Could not release context-resolve lock", error=str(rel_err))
                raise

        elif event_type == "email.outbound.sent":
            logger.info(
                "EmailWorker received outbound sent event",
                event_id=event.event_id,
                tenant_id=event.tenant_id,
                thread_id=payload.get("thread_id"),
                plan_id=payload.get("plan_id"),
                provider_message_id=payload.get("provider_message_id"),
            )

        else:
            logger.info("EmailWorker received unhandled event type", event_type=event_type)
