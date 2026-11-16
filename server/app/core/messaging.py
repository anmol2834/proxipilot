"""Event Bus and Messaging Layer (Redis Streams).

Features:
- Abstract EventBus interface for decoupling
- Immutable domain event schemas (event_id, event_type, tenant_id, schema_version)
- Redis Streams implementation with Consumer Groups
- At-least-once delivery semantics + manual acknowledgment (XACK)
- Dead Letter Queue (DLQ) stream routing for poisoned messages
"""

import asyncio
from abc import ABC, abstractmethod
from datetime import datetime, timezone
import json
import uuid
from typing import Any, Dict, List, Mapping, Optional, cast
from pydantic import BaseModel, Field
from app.core.config import get_settings
from app.core.logging import logger
from app.core.redis import redis_manager


class DomainEvent(BaseModel):
    """Immutable domain event specification.

    Aligned with DomainEventEnvelope in contracts/events.py.
    correlation_id enables end-to-end distributed tracing across services.
    causation_id records which prior event triggered this one.
    """

    event_id: str = Field(default_factory=lambda: f"evt_{uuid.uuid4().hex}")
    event_type: str
    tenant_id: str
    occurred_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    schema_version: int = 1
    producer: str = "proxipilot-backend"
    correlation_id: Optional[str] = Field(
        default=None,
        description="End-to-end request trace ID for distributed log correlation",
    )
    causation_id: Optional[str] = Field(
        default=None,
        description="event_id of the upstream event that caused this event",
    )
    aggregate_type: Optional[str] = Field(
        default=None,
        description="Domain aggregate type (e.g. email_thread, knowledge_item)",
    )
    aggregate_id: Optional[str] = Field(
        default=None,
        description="Primary entity ID this event is about",
    )
    payload: Dict[str, Any] = Field(default_factory=dict)

    def to_stream_payload(self) -> Dict[str, str]:
        """Convert to Redis stream compatible string map."""
        return {
            "event_id": self.event_id,
            "event_type": self.event_type,
            "tenant_id": self.tenant_id,
            "occurred_at": self.occurred_at,
            "schema_version": str(self.schema_version),
            "producer": self.producer,
            "correlation_id": self.correlation_id or "",
            "causation_id": self.causation_id or "",
            "aggregate_type": self.aggregate_type or "",
            "aggregate_id": self.aggregate_id or "",
            "payload": json.dumps(self.payload),
        }

    @classmethod
    def from_stream_payload(cls, data: Mapping[Any, Any]) -> "DomainEvent":
        """Deserialize Redis stream string map into DomainEvent."""
        str_data: Dict[str, Any] = {
            (k.decode() if isinstance(k, bytes) else str(k)): (
                v.decode() if isinstance(v, bytes) else str(v)
            )
            for k, v in data.items()
        }
        return cls(
            event_id=str(str_data["event_id"]),
            event_type=str(str_data["event_type"]),
            tenant_id=str(str_data["tenant_id"]),
            occurred_at=str(str_data["occurred_at"]),
            schema_version=int(str_data.get("schema_version", 1)),
            producer=str(str_data.get("producer", "proxipilot-backend")),
            correlation_id=str_data.get("correlation_id") or None,
            causation_id=str_data.get("causation_id") or None,
            aggregate_type=str_data.get("aggregate_type") or None,
            aggregate_id=str_data.get("aggregate_id") or None,
            payload=json.loads(str(str_data.get("payload", "{}"))),
        )



class EventBus(ABC):
    """Abstract Event Bus contract."""

    @abstractmethod
    async def publish(self, stream_name: str, event: DomainEvent) -> str:
        """Publish a domain event to a stream/topic."""
        pass

    @abstractmethod
    async def create_consumer_group(self, stream_name: str, group_name: str) -> None:
        """Ensure consumer group exists on the stream."""
        pass

    @abstractmethod
    async def read_events(
        self,
        stream_name: str,
        group_name: str,
        consumer_name: str,
        count: int = 10,
        block_ms: int = 1000,
        min_idle_time: Optional[int] = None,
    ) -> Optional[List[tuple[str, DomainEvent]]]:
        """Read a batch of events via consumer group."""
        pass

    @abstractmethod
    async def acknowledge(self, stream_name: str, group_name: str, message_id: str) -> None:
        """Acknowledge processed message."""
        pass

    @abstractmethod
    async def send_to_dlq(self, original_stream: str, event: DomainEvent, error: str) -> str:
        """Route unprocessable event to dead letter stream."""
        pass


# Dead-letter streams have no consumer; keep the most recent entries for inspection.
DLQ_MAX_ENTRIES = 10_000


class RedisStreamsEventBus(EventBus):
    """Production-grade Redis Streams Event Bus implementation."""

    def __init__(self, stream_prefix: Optional[str] = None):
        self._prefix = stream_prefix or get_settings().worker.stream_prefix

    def _resolve_stream(self, name: str) -> str:
        return f"{self._prefix}{name}"

    async def publish(self, stream_name: str, event: DomainEvent) -> str:
        """Publish domain event to Redis Stream."""
        client = redis_manager.client
        full_stream = self._resolve_stream(stream_name)
        stream_payload = cast(Dict[Any, Any], event.to_stream_payload())

        message_id = await client.xadd(full_stream, stream_payload)
        logger.info(
            "Event published",
            stream=full_stream,
            event_type=event.event_type,
            event_id=event.event_id,
            tenant_id=event.tenant_id,
            message_id=message_id,
        )
        return str(message_id)

    async def create_consumer_group(self, stream_name: str, group_name: str) -> None:
        """Create consumer group idempotently (ignoring BUSYGROUP) with retry."""
        client = redis_manager.client
        full_stream = self._resolve_stream(stream_name)
        for attempt in range(3):
            try:
                await client.xgroup_create(full_stream, group_name, id="0", mkstream=True)
                logger.info("Created consumer group", stream=full_stream, group=group_name)
                return
            except Exception as e:
                if "BUSYGROUP" in str(e):
                    return
                if attempt == 2:
                    logger.error("Failed to create consumer group", stream=full_stream, error=str(e))
                    raise
                await asyncio.sleep(1)

    async def read_events(
        self,
        stream_name: str,
        group_name: str,
        consumer_name: str,
        count: int = 10,
        block_ms: int = 1000,
        min_idle_time: Optional[int] = None,
    ) -> Optional[List[tuple[str, DomainEvent]]]:
        """Read pending or new events for consumer group. Returns None on read error."""
        client = redis_manager.client
        full_stream = self._resolve_stream(stream_name)

        # Check if there are unacknowledged messages in the PEL that have genuinely timed out.
        # AI inference workloads take 15-45s; setting min_idle_time too low (e.g. 5000ms) causes
        # premature PEL message stealing and duplicate processing across consumer slots.
        if min_idle_time is None:
            if "ai" in full_stream.lower() or "ai" in group_name.lower():
                min_idle_time = 120_000  # 120s for AI pipeline
            else:
                min_idle_time = 60_000   # 60s for general stream consumers

        try:
            claim_res: Any = await client.xautoclaim(
                name=full_stream,
                groupname=group_name,
                consumername=consumer_name,
                min_idle_time=min_idle_time,
                start_id="0-0",
                count=count,
            )
            if claim_res and len(claim_res) >= 2 and isinstance(claim_res[1], list) and claim_res[1]:
                reclaimed_messages = claim_res[1]
                reclaimed_events: List[tuple[str, DomainEvent]] = []
                for message in reclaimed_messages:
                    if not isinstance(message, (list, tuple)) or len(message) < 2:
                        continue
                    msg_id = str(message[0])
                    data = message[1]
                    if not isinstance(data, (dict, Mapping)):
                        continue
                    try:
                        event = DomainEvent.from_stream_payload(data)
                        reclaimed_events.append((msg_id, event))
                    except Exception as parse_err:
                        logger.error(
                            "Corrupt event payload in reclaimed stream message",
                            msg_id=msg_id,
                            error=str(parse_err),
                        )
                        # A poison message must not be reclaimed forever: dead-letter + ack it.
                        await self.send_to_dlq(
                            stream_name,
                            DomainEvent(event_type="corrupted.event", tenant_id="system",
                                        payload={"raw": str(data)[:2000], "error": str(parse_err)}),
                            str(parse_err),
                        )
                        await self.acknowledge(stream_name, group_name, msg_id)
                if reclaimed_events:
                    return reclaimed_events
        except Exception:
            # Fall back to standard read if xautoclaim fails
            pass

        # Then try to claim new messages using '>'
        try:
            raw_response: Any = await client.xreadgroup(
                groupname=group_name,
                consumername=consumer_name,
                streams={full_stream: ">"},
                count=count,
                block=block_ms,
            )
        except Exception as err:
            if "NOGROUP" in str(err):
                # Stream/group vanished (Redis flushed or key evicted): self-heal instead of
                # erroring forever until the next process restart.
                try:
                    await self.create_consumer_group(stream_name, group_name)
                    logger.warning("Recreated missing consumer group", stream=full_stream, group=group_name)
                    return []
                except Exception as heal_err:
                    logger.error("Could not recreate consumer group", stream=full_stream, error=str(heal_err))
            logger.error("Error reading from stream", stream=full_stream, error=str(err))
            return None

        events: List[tuple[str, DomainEvent]] = []
        if not raw_response or not isinstance(raw_response, list):
            return events

        for item in raw_response:
            if not isinstance(item, (list, tuple)) or len(item) < 2:
                continue
            messages = item[1]
            if not isinstance(messages, list):
                continue
            for message in messages:
                if not isinstance(message, (list, tuple)) or len(message) < 2:
                    continue
                msg_id = str(message[0])
                data = message[1]
                if not isinstance(data, (dict, Mapping)):
                    continue
                try:
                    event = DomainEvent.from_stream_payload(data)
                    events.append((msg_id, event))
                except Exception as parse_err:
                    logger.error(
                        "Corrupt event payload in stream", msg_id=msg_id, error=str(parse_err)
                    )
                    # Route directly to DLQ
                    await self.send_to_dlq(
                        stream_name,
                        DomainEvent(
                            event_type="corrupted.event",
                            tenant_id="system",
                            payload={"raw": str(data), "error": str(parse_err)},
                        ),
                        str(parse_err),
                    )
                    await self.acknowledge(stream_name, group_name, msg_id)

        return events

    async def read_own_pending(
        self, stream_name: str, group_name: str, consumer_name: str, count: int = 100,
    ) -> List[tuple[str, DomainEvent]]:
        """Entries this consumer had claimed but never acknowledged (its previous run crashed or was
        restarted mid-task). Re-processed immediately at startup instead of waiting for the XAUTOCLAIM
        idle window (60-120 s). Consumer handlers are idempotent (per-message locks + DB guards)."""
        client = redis_manager.client
        full_stream = self._resolve_stream(stream_name)
        try:
            raw: Any = await client.xreadgroup(groupname=group_name, consumername=consumer_name,
                                               streams={full_stream: "0"}, count=count)
        except Exception as err:  # noqa: BLE001
            logger.warning("Own pending recovery read failed", stream=full_stream, error=str(err))
            return []
        out: List[tuple[str, DomainEvent]] = []
        for _stream, messages in raw or []:
            for msg_id, data in messages or []:
                if not data:   # entry deleted while pending: nothing to process, release it
                    await client.xack(full_stream, group_name, msg_id)
                    continue
                try:
                    out.append((str(msg_id), DomainEvent.from_stream_payload(data)))
                except Exception as parse_err:  # noqa: BLE001
                    await self.send_to_dlq(stream_name, DomainEvent(
                        event_type="corrupted.event", tenant_id="system",
                        payload={"raw": str(data)[:2000], "error": str(parse_err)}), str(parse_err))
                    await self.acknowledge(stream_name, group_name, str(msg_id))
        return out

    async def stream_stats(self, stream_name: str, group_name: str) -> Dict[str, Any]:
        """Length, pending, consumer lag and oldest-pending idle time for one stream/group (O(1)
        Redis calls: XLEN, XINFO GROUPS, XPENDING summary + one XPENDING range of 1)."""
        client = redis_manager.client
        full_stream = self._resolve_stream(stream_name)
        stats: Dict[str, Any] = {"stream": stream_name, "length": 0, "pending": 0, "lag": None,
                                 "oldest_pending_idle_ms": 0}
        stats["length"] = int(await client.xlen(full_stream))
        for g in await client.xinfo_groups(full_stream):
            name = g.get("name")
            if (name.decode() if isinstance(name, bytes) else name) == group_name:
                stats["pending"] = int(g.get("pending") or 0)
                lag = g.get("lag")
                stats["lag"] = int(lag) if lag is not None else None
        if stats["pending"]:
            oldest = await client.xpending_range(full_stream, group_name, min="-", max="+", count=1)
            if oldest:
                stats["oldest_pending_idle_ms"] = int(oldest[0].get("time_since_delivered") or 0)
        return stats

    async def acknowledge(self, stream_name: str, group_name: str, message_id: str) -> None:
        """Acknowledge message processing in group, then delete the entry.

        Every stream here is a work queue with exactly ONE consumer group, and nothing reads
        processed entries back. Without the delete, acknowledged entries stayed in the stream
        forever: unbounded growth until Redis reached maxmemory (noeviction) and every XADD
        failed, stopping the whole pipeline. Deleting only after a successful ACK keeps the
        stream bounded by the real backlog, so a burst is never trimmed before it is processed.
        """
        client = redis_manager.client
        full_stream = self._resolve_stream(stream_name)
        acked = await client.xack(full_stream, group_name, message_id)
        if acked:
            try:
                await client.xdel(full_stream, message_id)
            except Exception as err:  # noqa: BLE001 - the ACK already succeeded; retried next time
                logger.warning("Stream entry delete after ack failed", stream=full_stream, error=str(err))

    async def send_to_dlq(self, original_stream: str, event: DomainEvent, error: str) -> str:
        """Append unprocessable message to the DLQ stream."""
        client = redis_manager.client
        dlq_stream = f"{self._prefix}dlq:{original_stream}"
        dlq_payload = event.to_stream_payload()
        dlq_payload["dlq_error"] = error
        dlq_payload["dlq_timestamp"] = datetime.now(timezone.utc).isoformat()

        # Terminal entries kept for inspection only: bound them (approximate trim is O(1)).
        msg_id = await client.xadd(dlq_stream, cast(Dict[Any, Any], dlq_payload),
                                   maxlen=DLQ_MAX_ENTRIES, approximate=True)
        logger.warn(
            "Event moved to Dead Letter Queue",
            dlq_stream=dlq_stream,
            event_id=event.event_id,
            error=error,
        )
        return str(msg_id)


event_bus = RedisStreamsEventBus()


async def get_event_bus() -> EventBus:
    """Dependency or accessor for the event bus."""
    return event_bus
