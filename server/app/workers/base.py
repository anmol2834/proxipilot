"""Abstract Base Background Worker Framework.

Features:
- Signal-driven graceful shutdown (SIGINT, SIGTERM)
- Managed consumer group registration
- Concurrency bounding using asyncio.Semaphore
- Automated error retry and DLQ routing
- Lifespan management for DB and Redis connections
"""

import asyncio
from abc import ABC, abstractmethod
import signal
from typing import Optional
from app.core.database import db_manager
from app.core.logging import logger
from app.core.messaging import DomainEvent, event_bus
from app.core.redis import redis_manager


class BaseWorker(ABC):
    """Abstract scalable background worker."""

    def __init__(
        self,
        worker_name: str,
        stream_name: str,
        group_name: str,
        concurrency: int = 4,
        max_retries: int = 3,
        standalone: bool = True,
    ):
        self.worker_name = worker_name
        self.stream_name = stream_name
        self.group_name = group_name
        self.concurrency = concurrency
        self.max_retries = max_retries
        self.standalone = standalone
        self._stop_event = asyncio.Event()
        self._semaphore: Optional[asyncio.Semaphore] = None

    @abstractmethod
    async def process_event(self, event: DomainEvent) -> None:
        """Domain-specific business logic for processing an event."""
        pass

    async def initialize(self) -> None:
        """Initialize necessary infrastructure connections."""
        if self.standalone:
            db_manager.initialize()
            redis_manager.initialize()
        await event_bus.create_consumer_group(self.stream_name, self.group_name)
        self._semaphore = asyncio.Semaphore(self.concurrency)
        logger.info(
            "Worker initialized",
            worker=self.worker_name,
            stream=self.stream_name,
            concurrency=self.concurrency,
        )

    async def shutdown(self) -> None:
        """Gracefully release worker resources."""
        logger.info("Worker initiating graceful shutdown...", worker=self.worker_name)
        if self.standalone:
            await db_manager.close()
            await redis_manager.close()
        logger.info("Worker shutdown complete.", worker=self.worker_name)

    async def _get_delivery_count(self, message_id: str) -> int:
        """Query Redis PEL (Pending Entry List) for the delivery count of a message.

        XPENDING returns the number of times a message has been delivered to any consumer.
        This is used to enforce max_retries before routing to DLQ.
        """
        try:
            client = redis_manager.client
            full_stream = event_bus._resolve_stream(self.stream_name)
            # XPENDING stream group - + count [consumer]
            pending_entries = await client.xpending_range(
                full_stream,
                self.group_name,
                min=message_id,
                max=message_id,
                count=1,
            )
            if pending_entries:
                entry = pending_entries[0]
                # entry is a dict with 'times_delivered' key
                return int(entry.get("times_delivered", 1))
        except Exception as err:
            logger.warning(
                "Could not query PEL delivery count, assuming 1",
                worker=self.worker_name,
                message_id=message_id,
                error=str(err),
            )
        return 1

    # Interval at which an in-flight message's PEL idle time is reset. Must stay well
    # below the XAUTOCLAIM min_idle_time (60s/120s) so a message that is still being
    # processed is never reclaimed and redelivered as a duplicate.
    PEL_KEEPALIVE_SECONDS: float = 20.0

    @property
    def consumer_name(self) -> str:
        return f"{self.worker_name}-1"

    async def _pel_keepalive(self, message_id: str) -> None:
        """Periodically re-claim an in-flight message to reset its PEL idle timer.

        Redis Streams has no visibility-timeout extension; XCLAIM with min_idle_time=0
        and JUSTID by the current owner resets the idle counter without redelivering,
        which is the standard way to keep a long-running job from being stolen by
        XAUTOCLAIM.
        """
        full_stream = event_bus._resolve_stream(self.stream_name)
        while True:
            await asyncio.sleep(self.PEL_KEEPALIVE_SECONDS)
            try:
                await redis_manager.client.xclaim(
                    full_stream,
                    self.group_name,
                    self.consumer_name,
                    min_idle_time=0,
                    message_ids=[message_id],
                    justid=True,
                )
            except asyncio.CancelledError:
                raise
            except Exception as err:
                logger.warning(
                    "PEL keepalive failed",
                    worker=self.worker_name,
                    message_id=message_id,
                    error=str(err),
                )

    async def _handle_message(self, message_id: str, event: DomainEvent) -> None:
        """Process a single event with semaphore guard, PEL-based retry, and DLQ."""
        assert self._semaphore is not None
        async with self._semaphore:
            keepalive = asyncio.create_task(self._pel_keepalive(message_id))
            try:
                logger.info(
                    "Processing event",
                    worker=self.worker_name,
                    event_id=event.event_id,
                    event_type=event.event_type,
                    tenant_id=event.tenant_id,
                )
                await self.process_event(event)
                await event_bus.acknowledge(self.stream_name, self.group_name, message_id)
            except Exception as err:
                delivery_count = await self._get_delivery_count(message_id)
                logger.error(
                    "Event processing failed",
                    worker=self.worker_name,
                    event_id=event.event_id,
                    event_type=event.event_type,
                    error=str(err),
                    delivery_count=delivery_count,
                    max_retries=self.max_retries,
                )

                if delivery_count >= self.max_retries:
                    # Max retries exceeded — permanently route to Dead Letter Queue
                    logger.warning(
                        "Max retries exceeded — routing event to DLQ",
                        worker=self.worker_name,
                        event_id=event.event_id,
                        delivery_count=delivery_count,
                        max_retries=self.max_retries,
                    )
                    await event_bus.send_to_dlq(self.stream_name, event, str(err))
                    await event_bus.acknowledge(self.stream_name, self.group_name, message_id)
                else:
                    # Leave message in PEL — it will be redelivered on next XREADGROUP call
                    # after Redis visibility timeout (handled by XCLAIM in a future health check).
                    logger.info(
                        "Event left in PEL for retry",
                        worker=self.worker_name,
                        event_id=event.event_id,
                        delivery_count=delivery_count,
                        retries_remaining=self.max_retries - delivery_count,
                    )
            finally:
                keepalive.cancel()
                try:
                    await keepalive
                except (asyncio.CancelledError, Exception):
                    pass


    async def run(self) -> None:
        """Worker main consumption loop with auto-recovery and supervisor retry."""
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(sig, lambda: self._stop_event.set())
            except NotImplementedError:
                # Windows event loop fallback for signals
                pass

        active_tasks: set = set()
        _err_backoff = 0.0
        _initialized = False
        _recovered = False

        while not self._stop_event.is_set():
            if not _initialized:
                try:
                    await self.initialize()
                    _initialized = True
                    logger.info("Worker started listening for stream events", worker=self.worker_name)
                except Exception as init_err:
                    logger.warning(
                        "Worker initialization failed, retrying in 2s...",
                        worker=self.worker_name,
                        error=str(init_err),
                    )
                    await asyncio.sleep(2)
                    continue

            try:
                # Clean up completed tasks
                active_tasks = {t for t in active_tasks if not t.done()}

                # Backpressure: claim only as many messages as there are free processing slots.
                # Claiming more parks them in memory without a PEL keepalive, so after the
                # XAUTOCLAIM idle window they were reclaimed and processed twice under a burst.
                free = self.concurrency - len(active_tasks)
                if free <= 0:
                    await asyncio.wait(active_tasks, return_when=asyncio.FIRST_COMPLETED)
                    continue

                if not _recovered:
                    # Crash / restart recovery: this consumer's own unacknowledged entries first.
                    _recovered = True
                    own = await event_bus.read_own_pending(
                        self.stream_name, self.group_name, self.consumer_name, count=free)
                    if own:
                        logger.info("Recovering unacknowledged events after restart",
                                    worker=self.worker_name, count=len(own))
                        for message_id, event in own:
                            task = asyncio.create_task(self._handle_message(message_id, event))
                            active_tasks.add(task)
                        if len(own) >= free:
                            _recovered = False   # more may remain; continue recovery next loop
                        continue

                events = await event_bus.read_events(
                    stream_name=self.stream_name,
                    group_name=self.group_name,
                    consumer_name=self.consumer_name,
                    count=free,
                    block_ms=1000,
                )

                if events:
                    _err_backoff = 0.0  # Reset backoff on successful read
                    for message_id, event in events:
                        task = asyncio.create_task(self._handle_message(message_id, event))
                        active_tasks.add(task)
                elif events is None:
                    # Connection error reading from stream.
                    await asyncio.sleep(min(_err_backoff if _err_backoff else 0.5, 2.0))
                    _err_backoff = min(_err_backoff * 1.5 if _err_backoff else 0.5, 2.0)
                    continue
                else:
                    # Normal empty result: stream is idle right now.
                    _err_backoff = 0.0
                    await asyncio.sleep(0.05)
                    continue

                await asyncio.sleep(0.05)

            except asyncio.CancelledError:
                break
            except Exception as loop_err:
                logger.error(
                    "Worker loop iteration error, retrying...",
                    worker=self.worker_name,
                    error=str(loop_err),
                )
                await asyncio.sleep(1)

        if active_tasks:
            logger.info(f"Waiting for {len(active_tasks)} in-flight tasks to complete...")
            await asyncio.gather(*active_tasks, return_exceptions=True)
        await self.shutdown()
