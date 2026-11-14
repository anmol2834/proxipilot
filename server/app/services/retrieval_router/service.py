"""Retrieval Router Service Facade & Domain Event Dispatcher — Phase 4.

Provides the primary service interface for:
1. Orchestrating tenant-scoped retrieval through RetrievalRouter.
2. Publishing domain event `email.retrieval.completed` to Redis stream 'ai_processing'.
3. Providing side-effect-free, idempotent re-tryability under worker re-execution.
"""

from __future__ import annotations

from datetime import datetime, timezone
import time
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.contracts.requirement_plan import RequirementPlan
from app.contracts.retrieval_result import RetrievalResult, RetrievalStatus
from app.core.database import db_manager
from app.core.logging import logger
from app.core.messaging import DomainEvent, get_event_bus
from app.services.context_resolver import ContextEnvelope
from app.services.retrieval_router.router import retrieval_router


class RetrievalRouterService:
    """Production retrieval routing service."""

    def __init__(self):
        self._router = retrieval_router

    async def route_and_retrieve(
        self,
        tenant_id: str,
        plan: RequirementPlan,
        envelope: Optional[ContextEnvelope] = None,
        db: Optional[AsyncSession] = None,
        as_of: Optional[datetime] = None,
        dispatch_event: bool = True,
    ) -> RetrievalResult:
        """Route, execute, and verify business knowledge retrieval for a plan."""
        start_time = time.perf_counter()

        # Database session management: use provided session or obtain from manager
        if db is not None:
            result = await self._router.execute_retrieval(
                db=db,
                tenant_id=tenant_id,
                plan=plan,
                envelope=envelope,
                as_of=as_of,
            )
        else:
            async with db_manager.session_factory() as session:
                result = await self._router.execute_retrieval(
                    db=session,
                    tenant_id=tenant_id,
                    plan=plan,
                    envelope=envelope,
                    as_of=as_of,
                )

        # ---------------------------------------------------------------------
        # Dispatch domain event to stream if requested
        # ---------------------------------------------------------------------
        if dispatch_event:
            await self._dispatch_retrieval_event(result)

        return result

    async def _dispatch_retrieval_event(self, result: RetrievalResult) -> None:
        """Publish retrieval outcome event to Redis stream 'ai_processing'."""
        try:
            event_bus = await get_event_bus()
            event = DomainEvent(
                event_type="email.retrieval.completed",
                tenant_id=result.plan_reference.tenant_id,
                payload=result.model_dump(),
            )
            await event_bus.publish(
                stream_name="ai_processing",
                event=event,
            )
            logger.info(
                "Published retrieval completed event to Redis stream",
                retrieval_id=result.retrieval_id,
                plan_id=result.plan_reference.plan_id,
                tenant_id=result.plan_reference.tenant_id,
                status=result.status.value,
            )
        except Exception as err:
            logger.warning(
                "Failed to publish retrieval completed event to stream (non-fatal for caller)",
                error=str(err),
                retrieval_id=result.retrieval_id,
            )


retrieval_router_service = RetrievalRouterService()
