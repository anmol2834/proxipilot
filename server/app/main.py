"""FastAPI Application Entrypoint for ProxiPilot.

Architecture:
- Stateless API process
- Lifespan connection pool management (Postgres, Redis, Qdrant, HTTP Client)
- Request ID, latency tracking, and structured logging middleware
- Global standardized error handlers
- Exposes ONLY /health, /ready, /metrics (no business APIs per initial setup rules)
"""

import app.core.dns_patch  # noqa: F401 - Must be applied before database or redis connections
from contextlib import asynccontextmanager
import asyncio
import time
import uuid
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.v1.routes.auth import router as auth_router
from app.api.v1.routes.health import router as health_router
from app.api.v1.routes.integrations import router as integrations_router
from app.api.v1.routes.onboarding import router as onboarding_router
from app.api.v1.routes.organizations import router as organizations_router
from app.api.v1.routes.inbox import router as inbox_router
from app.api.v1.routes.knowledge import router as knowledge_router
from app.api.v1.routes.contacts import router as contacts_router
from app.api.v1.routes.feedback import router as feedback_router
from app.api.v1.routes.commitments import router as commitments_router
from app.api.v1.routes.style import router as style_router
from app.api.v1.routes.practices import router as practices_router
from app.api.v1.routes.conversations import router as conversations_router
from app.api.v1.routes.context import router as context_router
from app.api.v1.routes.knowledge_sources import router as knowledge_sources_router
from app.api.v1.routes.knowledge_imports import router as knowledge_imports_router
from app.api.v1.routes.webhooks import router as webhooks_router
from app.api.v1.routes.dashboard import router as dashboard_router
from app.core.config import get_api_settings
from app.core.database import db_manager
from app.core.http_client import http_client_manager
from app.core.logging import logger, setup_logging
from app.core.qdrant import qdrant_manager
from app.core.redis import redis_manager
import structlog.contextvars


# ============================================================================
# HTTP Status → Canonical Error Code Mapping
# ============================================================================

_STATUS_CODE_MAP = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    410: "GONE",
    422: "VALIDATION_ERROR",
    429: "RATE_LIMIT_EXCEEDED",
    500: "INTERNAL_SERVER_ERROR",
    502: "BAD_GATEWAY",
    503: "SERVICE_UNAVAILABLE",
}


def _status_to_error_code(status_code: int) -> str:
    """Map HTTP status code to a stable machine-readable error code string."""
    return _STATUS_CODE_MAP.get(status_code, f"HTTP_{status_code}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application connection pools on startup and shutdown."""
    settings = get_api_settings()
    setup_logging(
        json_format=settings.observability.log_format_json,
        log_level=settings.observability.log_level,
    )
    logger.info("Starting ProxiPilot API...", env=settings.environment)

    # Initialize shared connection pools
    db_manager.initialize()
    redis_manager.initialize()
    qdrant_manager.initialize()
    http_client_manager.initialize()

    # Open warm DB connections up front (in parallel) so first requests never pay
    # connection setup / serverless cold-start latency, then keep them alive.
    await db_manager.warm_pool()
    db_keepalive_task = asyncio.create_task(db_manager.keepalive_forever())

    # Ensure system RBAC roles and permissions exist
    try:
        from app.core.rbac_seed import ensure_system_rbac
        async with db_manager.session_factory() as startup_session:
            await ensure_system_rbac(startup_session)
    except Exception as exc:
        logger.warning("Could not verify RBAC roles on startup", error=str(exc))

    # Start embedded background workers so email sync, knowledge imports,
    # and vector indexing are processed automatically in real-time
    active_workers = []
    worker_tasks = []
    renewal_task = None
    recovery_task = None

    try:
        from app.workers.email_worker import EmailWorker
        from app.workers.import_worker import KnowledgeImportWorker
        from app.workers.knowledge_embedding_worker import KnowledgeEmbeddingWorker
        from app.workers.ai_worker import AiWorker
        from app.services.gmail_renewal_scheduler import gmail_renewal_scheduler
        from app.services.knowledge_import import knowledge_import_service

        email_worker = EmailWorker(standalone=False)
        knowledge_import_worker = KnowledgeImportWorker(standalone=False)
        knowledge_embedding_worker = KnowledgeEmbeddingWorker(standalone=False)
        ai_worker = AiWorker(standalone=False)

        active_workers.extend([email_worker, knowledge_import_worker, knowledge_embedding_worker, ai_worker])

        worker_tasks.append(asyncio.create_task(email_worker.run()))
        worker_tasks.append(asyncio.create_task(knowledge_import_worker.run()))
        worker_tasks.append(asyncio.create_task(knowledge_embedding_worker.run()))
        worker_tasks.append(asyncio.create_task(ai_worker.run()))

        logger.info(
            "Embedded workers started in API process",
            workers=["email-worker", "knowledge-import-worker", "knowledge-indexer", "ai-worker"],
        )

        # Immediate recovery check for any pending or unclaimed jobs from prior restart
        try:
            async with db_manager.session_factory() as startup_scan_session:
                await knowledge_import_service.recover_stuck_jobs(startup_scan_session)
        except Exception as scan_err:
            logger.warning("Startup stuck job recovery scan failed", error=str(scan_err))

        async def _periodic_watch_renewal():
            # Initial check 5 seconds after startup to promptly address expired or due watches
            await asyncio.sleep(5)
            while True:
                try:
                    async with db_manager.session_factory() as session:
                        await gmail_renewal_scheduler.rebuild_from_db(session)
                        await gmail_renewal_scheduler.check_and_renew_due_watches(session)
                except asyncio.CancelledError:
                    break
                except Exception as loop_err:
                    logger.warning("Watch renewal check error", error=str(loop_err))
                await asyncio.sleep(21600)  # Check every 6 hours

        async def _periodic_job_recovery():
            while True:
                try:
                    # Scan every 30s. The stale threshold must be far larger than the 5s
                    # worker heartbeat; a 20s threshold used to hijack live imports.
                    await asyncio.sleep(30)
                    async with db_manager.session_factory() as session:
                        await knowledge_import_service.recover_stuck_jobs(session)
                except asyncio.CancelledError:
                    break
                except Exception as loop_err:
                    logger.warning("Periodic job recovery check error", error=str(loop_err))

        async def _check_vector_models():
            try:
                from app.services.knowledge_reconciliation import knowledge_reconciliation_service
                await knowledge_reconciliation_service.check_vector_model_consistency()
                # Warm the embedding API connection so the first edit / customer query
                # does not pay DNS + TLS setup (several seconds on slow links).
                provider = knowledge_reconciliation_service.embedding_service.provider
                if hasattr(provider, "warm_up"):
                    await provider.warm_up()
            except Exception as chk_err:
                logger.debug("Vector model consistency check failed", error=str(chk_err))

        vector_check_task = asyncio.create_task(_check_vector_models())  # noqa: F841 (fire-and-forget)
        async def _periodic_knowledge_sync_sweep():
            # Safety net for Memory Update & Sync: re-sync ACTIVE versions that are still
            # not indexed (inline sync and its retry event both failed, or a crash
            # happened between commit and sync).
            from app.services.knowledge_sync import knowledge_sync_service

            while True:
                try:
                    await asyncio.sleep(60)
                    await knowledge_sync_service.sweep_pending()
                except asyncio.CancelledError:
                    break
                except Exception as sweep_err:
                    logger.warning("Knowledge sync sweep error", error=str(sweep_err)[:300])

        knowledge_sweep_task = asyncio.create_task(_periodic_knowledge_sync_sweep())

        async def _periodic_style_refresh():
            # Memory 2: re-learn communication style once enough new human-sent mail exists.
            from app.services.style_memory import style_memory_service

            await asyncio.sleep(120)  # let startup settle
            while True:
                try:
                    await style_memory_service.refresh_stale()
                    await asyncio.sleep(6 * 3600)
                except asyncio.CancelledError:
                    break
                except Exception as style_err:
                    logger.warning("Style refresh error", error=str(style_err)[:300])
                    await asyncio.sleep(600)

        style_refresh_task = asyncio.create_task(_periodic_style_refresh())
        renewal_task = asyncio.create_task(_periodic_watch_renewal())

        # Gmail fallback poller: process new mail even when Pub/Sub push is not delivered.
        from app.core.config import get_settings
        from app.services.gmail_fallback_poller import gmail_fallback_poller
        _poll_s = get_settings().providers.gmail_fallback_poll_seconds
        if _poll_s > 0:
            gmail_poll_task = asyncio.create_task(gmail_fallback_poller.run_forever(float(_poll_s)))
            worker_tasks.append(gmail_poll_task)
        recovery_task = asyncio.create_task(_periodic_job_recovery())

    except Exception as worker_init_err:
        logger.warning("Failed to start embedded workers", error=str(worker_init_err))

    yield

    # Graceful shutdown: stop background workers and clean connection pools
    logger.info("Shutting down ProxiPilot API...")
    for worker in active_workers:
        try:
            worker._stop_event.set()
        except Exception:
            pass

    for t in worker_tasks:
        if t:
            t.cancel()

    db_keepalive_task.cancel()
    if renewal_task:
        renewal_task.cancel()
    if recovery_task:
        recovery_task.cancel()
    try:
        knowledge_sweep_task.cancel()
        style_refresh_task.cancel()
    except NameError:
        pass

    await http_client_manager.close()
    await qdrant_manager.close()
    await redis_manager.close()
    await db_manager.close()
    logger.info("ProxiPilot API stopped.")


def create_app() -> FastAPI:
    """Application factory."""
    settings = get_api_settings()

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="Autonomous AI Email & Workflow Proxy Platform",
        docs_url="/docs" if settings.environment != "production" else None,
        redoc_url="/redoc" if settings.environment != "production" else None,
        lifespan=lifespan,
    )

    # CORS Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Request ID, Trace Binding, and Latency Middleware
    @app.middleware("http")
    async def request_context_middleware(request: Request, call_next):
        request_id = request.headers.get("x-request-id", f"req_{uuid.uuid4().hex[:12]}")
        start_time = time.perf_counter()

        # Bind request context into structlog so ALL log lines in this request
        # automatically carry request_id and path without manual passing.
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            method=request.method,
            path=request.url.path,
        )

        response = await call_next(request)

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        response.headers["x-request-id"] = request_id
        response.headers["x-response-time-ms"] = str(duration_ms)

        logger.info(
            "HTTP Request",
            status_code=response.status_code,
            duration_ms=duration_ms,
        )
        return response

    # Standardized HTTPException Handler (4xx errors use canonical ErrorResponse schema)
    @app.exception_handler(HTTPException)
    async def standardized_http_exception_handler(request: Request, exc: HTTPException):
        request_id = request.headers.get("x-request-id", "unknown")
        logger.warning(
            "HTTP exception",
            status_code=exc.status_code,
            detail=exc.detail,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": {
                    "code": _status_to_error_code(exc.status_code),
                    "message": exc.detail if isinstance(exc.detail, str) else str(exc.detail),
                    "request_id": request_id,
                },
            },
            headers=exc.headers or {},
        )

    # Global Unhandled Exception Handler
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error("Unhandled server exception", error=str(exc))
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected error occurred while processing the request.",
                    "request_id": getattr(request.state, "request_id", "unknown"),
                },
            },
        )

    # Register Health, Readiness, and Diagnostics probes
    app.include_router(health_router)
    app.include_router(health_router, prefix="/api/v1")

    # Register Authentication & Session Routes
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(auth_router)

    # Register Organization & RBAC Routes
    app.include_router(organizations_router, prefix="/api/v1")
    app.include_router(organizations_router)

    # Register Onboarding & Business Profile Routes
    app.include_router(onboarding_router, prefix="/api/v1")
    app.include_router(onboarding_router)

    # Register Integrations Routes (Gmail multi-account, OAuth, health)
    app.include_router(integrations_router, prefix="/api/v1")
    app.include_router(integrations_router)

    # Register Inbox Routes (clean email thread and message read model)
    app.include_router(inbox_router, prefix="/api/v1")

    # Register Webhooks Routes (Google Cloud Pub/Sub push)
    app.include_router(webhooks_router, prefix="/api/v1")
    app.include_router(webhooks_router)

    # Register Knowledge Sources Routes (Lineage, Provenance, Authority)
    app.include_router(knowledge_sources_router, prefix="/api/v1")
    app.include_router(knowledge_sources_router)

    # Register Knowledge Imports Routes (Async Orchestration & Lifecycle)
    app.include_router(knowledge_imports_router, prefix="/api/v1")
    app.include_router(knowledge_imports_router)

    # Register Knowledge Routes (Taxonomy, Category Schemas, Validation, Custom Attributes)
    app.include_router(knowledge_router, prefix="/api/v1")
    app.include_router(knowledge_router)

    # Register Contacts Routes (Memory 4: Contact & Relationship Memory)
    app.include_router(contacts_router, prefix="/api/v1")
    app.include_router(feedback_router, prefix="/api/v1")
    app.include_router(dashboard_router, prefix="/api/v1")
    app.include_router(commitments_router, prefix="/api/v1")
    app.include_router(style_router, prefix="/api/v1")
    app.include_router(practices_router, prefix="/api/v1")
    app.include_router(conversations_router, prefix="/api/v1")
    app.include_router(context_router, prefix="/api/v1")

    return app


app = create_app()
