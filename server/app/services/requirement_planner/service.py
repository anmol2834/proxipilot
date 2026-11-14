"""Requirement & Intent Planner Orchestrator Service.

Coordinates:
ContextEnvelope
    ↓
Layer A: Deterministic Preprocessing (preprocessor.py)
    ↓
Layer B: OpenAI Structured Intent Planner (planner.py)
    ↓
Layer C: Deterministic Validation & Policy Engine (validator.py)
    ↓
Validated, Versioned RequirementPlan (`schema_version = '1.0'`)
    ↓
Dispatch to Downstream Retrieval Pipeline via Domain Event
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.contracts.requirement_plan import (
    PlanMetadata,
    RequirementPlan,
    ValidationStatus,
)
from app.contracts.retrieval_capability import (
    RetrievalCapabilityCatalogue,
    build_retrieval_capability_catalogue,
)
from app.core.database import db_manager
from app.core.logging import logger
from app.core.messaging import DomainEvent, get_event_bus
from app.models.knowledge import KnowledgeAttributeDefinition
from app.services.context_resolver import ContextEnvelope
from app.services.embedding_profile import embedding_profile_registry
from app.services.requirement_planner.planner import (
    OpenAIStructuredPlanner,
    openai_structured_planner,
)
from app.services.requirement_planner.preprocessor import (
    DeterministicPreprocessor,
    deterministic_preprocessor,
)
from app.services.requirement_planner.validator import (
    DeterministicPlanValidator,
    deterministic_plan_validator,
)


class RequirementPlannerService:
    """Production orchestrator for Stage 3 Requirement & Intent Planning."""

    def __init__(
        self,
        preprocessor: Optional[DeterministicPreprocessor] = None,
        planner: Optional[OpenAIStructuredPlanner] = None,
        validator: Optional[DeterministicPlanValidator] = None,
    ):
        self.preprocessor = preprocessor or deterministic_preprocessor
        self.planner = planner or openai_structured_planner
        self.validator = validator or deterministic_plan_validator
        # Tenant catalogue cache: tenant_id -> RetrievalCapabilityCatalogue
        self._catalogue_cache: Dict[str, RetrievalCapabilityCatalogue] = {}

    async def get_or_build_catalogue(
        self,
        tenant_id: str,
        db: Optional[AsyncSession] = None,
    ) -> RetrievalCapabilityCatalogue:
        """Resolve tenant-scoped RetrievalCapabilityCatalogue with in-memory caching."""
        if tenant_id in self._catalogue_cache:
            return self._catalogue_cache[tenant_id]

        custom_defs: List[KnowledgeAttributeDefinition] = []
        if db is not None:
            stmt = select(KnowledgeAttributeDefinition).where(
                KnowledgeAttributeDefinition.tenant_id == tenant_id
            )
            res = await db.execute(stmt)
            custom_defs = list(res.scalars().all())

        profile = embedding_profile_registry.get_active_profile()
        catalogue = build_retrieval_capability_catalogue(
            tenant_id=tenant_id,
            custom_definitions=custom_defs,
            embedding_profile_id=profile.profile_id,
        )
        self._catalogue_cache[tenant_id] = catalogue
        return catalogue

    async def plan_requirements(
        self,
        envelope: ContextEnvelope,
        db: Optional[AsyncSession] = None,
        dispatch_event: bool = True,
    ) -> RequirementPlan:
        """Execute the complete 3-layer requirement and intent planning pipeline."""
        start_t = time.perf_counter()
        logger.info(
            "Starting requirement planning for incoming email",
            tenant_id=envelope.tenant_id,
            thread_id=envelope.thread_id,
            message_id=envelope.current_message_id,
            revision=envelope.context_revision,
        )

        # ---------------------------------------------------------------------
        # Layer A: Deterministic Preprocessing
        # ---------------------------------------------------------------------
        curr_msg = envelope.current_message
        preprocessed = self.preprocessor.preprocess(
            raw_text=curr_msg.body_text,
            subject=curr_msg.subject,
        )

        # ---------------------------------------------------------------------
        # Capability Discovery
        # ---------------------------------------------------------------------
        catalogue = await self.get_or_build_catalogue(envelope.tenant_id, db=db)

        # ---------------------------------------------------------------------
        # Layer B: OpenAI Structured Intent Planning (Fast Path or LLM)
        # ---------------------------------------------------------------------
        proposal, is_fast_path, planner_metrics = await self.planner.plan_intent(
            envelope=envelope,
            preprocessed=preprocessed,
            catalogue=catalogue,
        )

        metadata = PlanMetadata(
            model_used=planner_metrics.get("model_used"),
            planner_duration_ms=planner_metrics.get("planner_duration_ms", 0.0),
            prompt_tokens=planner_metrics.get("prompt_tokens", 0),
            completion_tokens=planner_metrics.get("completion_tokens", 0),
            embedding_profile_id=catalogue.embedding_profile_id,
            fast_path_used=is_fast_path,
        )

        # ---------------------------------------------------------------------
        # Layer C: Deterministic Validation & Policy Engine
        # ---------------------------------------------------------------------
        plan = self.validator.validate_and_compile(
            envelope=envelope,
            preprocessed=preprocessed,
            proposal=proposal,
            catalogue=catalogue,
            metadata=metadata,
        )

        total_duration_ms = (time.perf_counter() - start_t) * 1000.0
        logger.info(
            "Requirement plan generated successfully",
            plan_id=plan.plan_id,
            tenant_id=plan.tenant_id,
            intent=plan.intent.value,
            strategy=plan.retrieval_strategy.value,
            status=plan.validation_status.value,
            fast_path=is_fast_path,
            duration_ms=round(total_duration_ms, 2),
            errors=len(plan.validation_errors),
        )

        # ---------------------------------------------------------------------
        # Dispatch to Downstream Retrieval Stream via Domain Event
        # ---------------------------------------------------------------------
        if dispatch_event:
            await self._dispatch_plan_event(plan)

        return plan

    async def _dispatch_plan_event(self, plan: RequirementPlan) -> None:
        """Publish requirement plan event to Redis stream 'ai_processing'."""
        try:
            event_bus = await get_event_bus()
            event = DomainEvent(
                event_type="email.requirement_plan.created",
                tenant_id=plan.tenant_id,
                payload=plan.model_dump(),
            )
            await event_bus.publish(
                stream_name="ai_processing",
                event=event,
            )
            logger.debug("Dispatched email.requirement_plan.created event", plan_id=plan.plan_id)
        except Exception as err:
            logger.warning(
                "Failed to dispatch requirement plan event to stream (non-fatal for caller)",
                plan_id=plan.plan_id,
                error=str(err),
            )


# Singleton orchestrator service instance
requirement_planner_service = RequirementPlannerService()
