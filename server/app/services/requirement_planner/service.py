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

import asyncio
import time
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.contracts.requirement_plan import (
    IntentType,
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
from app.services.requirement_planner.expansion import apply_semantic_expansions

# A cold taxonomy load is one aggregate query; never let it hold up planning.
TAXONOMY_LOAD_TIMEOUT_S = 2.0


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

        # Items already presented in this thread (for selection state), loaded in parallel with
        # planning on its own session so it adds no latency.
        presented_task = asyncio.create_task(self._load_presented(envelope))
        # Business context & taxonomy map for AI #1 (cached per tenant), loaded alongside.
        taxonomy_task = asyncio.create_task(self._load_taxonomy(envelope.tenant_id))

        # ---------------------------------------------------------------------
        # Capability Discovery
        # ---------------------------------------------------------------------
        catalogue = await self.get_or_build_catalogue(envelope.tenant_id, db=db)

        # ---------------------------------------------------------------------
        # Layer B: OpenAI Structured Intent Planning (Fast Path or LLM)
        # ---------------------------------------------------------------------
        taxonomy = await taxonomy_task
        proposal, is_fast_path, planner_metrics = await self.planner.plan_intent(
            envelope=envelope,
            preprocessed=preprocessed,
            catalogue=catalogue,
            taxonomy=taxonomy,
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

        # ---------------------------------------------------------------------
        # Layer D: Conversation selection state (deterministic, from thread evidence)
        # ---------------------------------------------------------------------
        try:
            presented = await presented_task
        except Exception:  # noqa: BLE001
            presented = []
        # AI #1 semantic expansions (translation + HyDE concepts + keywords), sanitised and
        # matched to the requirements they describe. Retrieval aids only.
        plan = apply_semantic_expansions(plan, proposal)
        plan = apply_selection_state(plan, envelope, presented)

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

    @staticmethod
    async def _load_taxonomy(tenant_id: str):
        from app.services.business_taxonomy import load_business_taxonomy

        try:
            async with db_manager.session_factory() as tax_db:
                return await asyncio.wait_for(load_business_taxonomy(tax_db, tenant_id), timeout=TAXONOMY_LOAD_TIMEOUT_S)
        except Exception as exc:  # noqa: BLE001 - plan without a taxonomy rather than fail
            logger.warning("Planning without business taxonomy", tenant_id=tenant_id, error=f"{type(exc).__name__}: {str(exc)[:150]}")
            return None

    @staticmethod
    async def _load_presented(envelope: ContextEnvelope):
        from app.services.conversation_selection import load_presented_items

        if not envelope.thread_id:
            return []
        async with db_manager.session_factory() as sel_db:
            return await load_presented_items(sel_db, envelope.tenant_id, envelope.thread_id)

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


_ALTERNATIVE_INTENTS = (IntentType.MORE_OPTIONS, IntentType.DIFFERENT_OPTIONS)


def apply_selection_state(plan: RequirementPlan, envelope: ContextEnvelope, presented) -> RequirementPlan:
    """Resolve the customer's active selection from the thread and make the plan honour it.

    - A message that names an already-presented item is a SELECTION, never "more options": it must
      not exclude that item and must not rediscover the catalogue.
    - Follow-ups (order, quantity, discount, warranty...) keep the selection.
    - Asking for alternatives without naming an item clears it (normal discovery continues).
    """
    from app.services.conversation_selection import customer_texts, resolve_selection, selection_summary

    if not presented:
        return plan
    wants_alternatives = plan.intent in _ALTERNATIVE_INTENTS
    sel = resolve_selection(customer_texts(envelope), presented, current_requests_alternatives=wants_alternatives)
    if sel is None:
        return plan
    update: Dict[str, Any] = {
        "active_selection": selection_summary(sel),
        "focus_entity_ids": [sel.item.entity_id],
        "excluded_entity_ids": [],
    }
    if wants_alternatives and sel.named_in_current:
        # "Okay, I want <presented item>" was misread as a continuation request.
        update.update({"intent": IntentType.PRODUCT_LOOKUP, "is_continuation": False, "continuation_type": None})
    logger.info("Conversation selection resolved", plan_id=plan.plan_id, thread_id=plan.thread_id,
                selected=sel.item.title[:80], named_in_current=sel.named_in_current,
                original_intent=plan.intent.value)
    return plan.model_copy(update=update)
