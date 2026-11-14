"""Health and Readiness Probes.

Endpoints:
- GET /health: Liveness check (instant O(1) process check)
- GET /ready: Readiness check (validates database, Redis, and Qdrant connectivity)
- GET /metrics: Prometheus metrics endpoint
"""

import asyncio
from typing import Any, Dict
from fastapi import APIRouter, Response, status
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from app.core.database import db_manager
from app.core.qdrant import qdrant_manager
from app.core.redis import redis_manager

router = APIRouter(tags=["Health & Diagnostics"])


@router.get("/health", status_code=status.HTTP_200_OK)
async def liveness_probe() -> Dict[str, Any]:
    """Liveness probe: verifies that the FastAPI process is alive and accepting requests."""
    return {
        "status": "healthy",
        "service": "proxipilot-api",
        "alive": True,
    }


@router.get("/ready")
async def readiness_probe(response: Response) -> Dict[str, Any]:
    """Readiness probe: validates connectivity to critical backing infrastructure."""
    # Run infrastructure probes concurrently with timeout
    db_task = asyncio.create_task(db_manager.check_health())
    redis_task = asyncio.create_task(redis_manager.check_health())
    qdrant_task = asyncio.create_task(qdrant_manager.check_health())

    results = await asyncio.gather(db_task, redis_task, qdrant_task, return_exceptions=True)

    db_ok = results[0] is True
    redis_ok = results[1] is True
    qdrant_ok = results[2] is True

    # Database and Redis are mandatory for readiness; Qdrant can be degraded
    is_ready = db_ok and redis_ok

    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": "ready" if is_ready else "degraded",
        "dependencies": {
            "database": "connected" if db_ok else "disconnected",
            "redis": "connected" if redis_ok else "disconnected",
            "qdrant": "connected" if qdrant_ok else "disconnected",
        },
    }


@router.get("/metrics")
async def metrics_endpoint() -> Response:
    """Prometheus telemetry scrape endpoint."""
    data = generate_latest()
    return Response(content=data, media_type=CONTENT_TYPE_LATEST)
