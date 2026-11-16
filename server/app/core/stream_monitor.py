"""Redis Streams health: length, pending (in-flight), consumer lag and oldest-pending age.

Runs inside the API process next to the embedded workers. Each tick costs O(1) Redis calls per
stream (XLEN, XINFO GROUPS, XPENDING summary/range 1), so it is safe at any traffic level.
Exposed as Prometheus gauges on /metrics (localhost-only via nginx) and logged as a warning when a
backlog builds up or a message is stuck, so an outage is visible long before customers notice.
"""

from __future__ import annotations

import asyncio
from typing import Dict, List, Tuple

from prometheus_client import Gauge

from app.core.logging import logger
from app.core.messaging import event_bus

# (stream, consumer group) of every embedded worker
MONITORED_STREAMS: List[Tuple[str, str]] = [
    ("email_events", "email-worker-group"),
    ("ai_processing", "ai-worker-group"),
    ("knowledge_import_events", "knowledge-import-worker-group"),
    ("knowledge-events", "knowledge-indexer-group"),
]
INTERVAL_SECONDS = 30.0
LAG_WARN = 200                  # entries not yet delivered to the group
STUCK_PENDING_WARN_MS = 300_000  # an in-flight message older than 5 minutes

_LENGTH = Gauge("proxipilot_stream_length", "Entries in the stream (backlog + in-flight)", ["stream"])
_PENDING = Gauge("proxipilot_stream_pending", "Delivered but unacknowledged entries", ["stream"])
_LAG = Gauge("proxipilot_stream_lag", "Entries not yet delivered to the consumer group", ["stream"])
_OLDEST = Gauge("proxipilot_stream_oldest_pending_ms", "Idle time of the oldest in-flight entry", ["stream"])


async def collect_once() -> Dict[str, Dict[str, object]]:
    """One snapshot of every monitored stream (never raises)."""
    out: Dict[str, Dict[str, object]] = {}
    for stream, group in MONITORED_STREAMS:
        try:
            s = await event_bus.stream_stats(stream, group)
        except Exception as err:  # noqa: BLE001 - monitoring must never affect processing
            logger.warning("Stream stats unavailable", stream=stream, error=str(err)[:200])
            continue
        out[stream] = s
        _LENGTH.labels(stream).set(s["length"])
        _PENDING.labels(stream).set(s["pending"])
        _LAG.labels(stream).set(s["lag"] if s["lag"] is not None else -1)
        _OLDEST.labels(stream).set(s["oldest_pending_idle_ms"])
        if (s["lag"] or 0) >= LAG_WARN or s["oldest_pending_idle_ms"] >= STUCK_PENDING_WARN_MS:
            logger.warning("Stream backlog or stuck message", **s)
    return out


async def run_forever(interval: float = INTERVAL_SECONDS) -> None:
    while True:
        await collect_once()
        await asyncio.sleep(interval)
