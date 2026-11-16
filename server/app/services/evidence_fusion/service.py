"""Evidence Fusion Service Facade & Event Dispatcher — Phase 5.

Primary orchestrator for:
1. Normalizing heterogeneous candidates from PostgreSQL, Qdrant, and Context.
2. Context-aware short-reply resolution ("yes", "ok", "book now", "proceed").
3. Requirement-aware decomposition and target entity matching.
4. Hard constraint enforcement, version/date verification, and honest coverage assessment.
5. Emitting the versioned VerifiedEvidenceResult (schema_version = "1.0").
6. Publishing domain event `email.evidence_fusion.completed` to Redis Streams.
"""

from __future__ import annotations

from datetime import datetime, timezone
import time
from typing import Any, Dict, List, Optional, Set, Tuple
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.contracts.evidence_fusion import (
    ActionWorkflowContext,
    CandidateRole,
    ConflictRecord,
    EvidenceOverallStatus,
    RequirementCoverageStatus,
    RequirementEvidenceGroup,
    RequirementType,
    VerifiedCandidate,
    VerifiedEvidenceResult,
    VerifiedFact,
)
from app.contracts.requirement_plan import RequirementPlan
from app.contracts.retrieval_result import (
    PlanReferenceDTO,
    RetrievalResult,
    RetrievalStatus,
)
from app.core.database import db_manager
from app.core.logging import logger
from app.core.messaging import DomainEvent, get_event_bus
from app.services.context_resolver import ContextEnvelope
from app.services.evidence_fusion.context_evaluator import ContextualReplyEvaluator
from app.services.evidence_fusion.grouper import RequirementGroupDefinition, RequirementGrouper
from app.services.evidence_fusion.matcher import TargetEntityMatcher
from app.services.evidence_fusion.normalizer import CandidateNormalizer
from app.services.evidence_fusion.verifier import EvidenceFactVerifier


class EvidenceFusionService:
    """Production service for candidate fusion, target matching, and evidence verification."""

    def __init__(self):
        self._normalizer = CandidateNormalizer
        self._grouper = RequirementGrouper
        self._matcher = TargetEntityMatcher
        self._context_evaluator = ContextualReplyEvaluator
        self._verifier = EvidenceFactVerifier

    async def fuse_and_verify(
        self,
        tenant_id: str,
        plan: RequirementPlan,
        envelope: Optional[ContextEnvelope] = None,
        retrieval_result: Optional[RetrievalResult] = None,
        raw_candidates: Optional[List[VerifiedCandidate]] = None,
        db: Optional[AsyncSession] = None,
        as_of: Optional[datetime] = None,
        dispatch_event: bool = True,
    ) -> VerifiedEvidenceResult:
        """Execute requirement-aware candidate fusion and evidence verification."""
        start_time = time.perf_counter()
        ref_time = as_of or datetime.now(timezone.utc)

        # ---------------------------------------------------------------------
        # 1. Strict Tenant Identity Guard
        # ---------------------------------------------------------------------
        if plan.tenant_id != tenant_id:
            logger.error(
                "SECURITY: Cross-tenant plan rejected in EvidenceFusionService",
                expected_tenant=tenant_id,
                plan_tenant=plan.tenant_id,
                plan_id=plan.plan_id,
            )
            raise PermissionError(f"Plan tenant_id {plan.tenant_id} does not match authenticated tenant {tenant_id}")

        all_candidates: List[VerifiedCandidate] = []
        excluded_set = {str(x).upper().strip() for x in (plan.excluded_entity_ids or []) if x and str(x).strip()} | {str(x).strip() for x in (plan.excluded_entity_ids or []) if x and str(x).strip()}

        if raw_candidates:
            for cand in raw_candidates:
                ext_key = (cand.external_identity_key or "").strip().upper()
                if excluded_set and (cand.entity_id in excluded_set or (ext_key and ext_key in excluded_set)):
                    continue
                all_candidates.append(cand)

        # Normalize candidates from RetrievalResult if provided
        if retrieval_result and retrieval_result.results:
            for item in retrieval_result.results:
                ext_key = (item.external_identity_key or "").strip().upper()
                if excluded_set and (item.entity_id in excluded_set or (ext_key and ext_key in excluded_set)):
                    continue
                all_candidates.append(self._normalizer.normalize_retrieved_item(item))

        # ---------------------------------------------------------------------
        # 2. Context-Aware Evaluation (Short replies, greetings, antecedents)
        # ---------------------------------------------------------------------
        body_text = ""
        if envelope and envelope.current_message and envelope.current_message.body_text:
            body_text = envelope.current_message.body_text
        elif plan.message_id:
            # Rehydrate full plain-text body from PostgreSQL database
            try:
                from sqlalchemy import select
                from app.models.inbox import EmailMessage

                if db is not None:
                    stmt = select(EmailMessage.body_text).where(
                        EmailMessage.id == plan.message_id,
                        EmailMessage.tenant_id == tenant_id,
                    )
                    res = await db.execute(stmt)
                    db_body = res.scalar_one_or_none()
                    if db_body:
                        body_text = db_body
                else:
                    async with db_manager.session_factory() as session:
                        stmt = select(EmailMessage.body_text).where(
                            EmailMessage.id == plan.message_id,
                            EmailMessage.tenant_id == tenant_id,
                        )
                        res = await session.execute(stmt)
                        db_body = res.scalar_one_or_none()
                        if db_body:
                            body_text = db_body
            except Exception as exc:
                logger.warning(
                    "Could not rehydrate body_text from database in EvidenceFusionService",
                    error=str(exc),
                    message_id=plan.message_id,
                )

        if not body_text and plan.query_text:
            body_text = plan.query_text

        if envelope is None and body_text:
            from app.services.context_resolver import ContextMessage
            envelope = ContextEnvelope(
                tenant_id=tenant_id,
                integration_account_id=plan.integration_account_id,
                provider_thread_id=plan.thread_id,
                thread_id=plan.thread_id,
                current_message_id=plan.message_id,
                context_revision=plan.context_revision,
                current_message=ContextMessage(
                    id=plan.message_id,
                    external_message_id=plan.message_id,
                    direction="inbound",
                    from_email="inbound@customer.com",
                    body_text=body_text,
                ),
            )

        action_context, ctx_group, ctx_overall = self._context_evaluator.evaluate_short_reply(
            message_text=body_text,
            envelope=envelope,
        )

        # If contextual short reply resolved with no external raw candidates needed
        if ctx_group is not None and ctx_overall is not None and not all_candidates:
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            result = VerifiedEvidenceResult(
                price_ranking_unscoped=bool(getattr(retrieval_result, "price_ranking_unscoped", False)),
                schema_version="1.0",
                fusion_id=f"fus_{uuid.uuid4().hex[:12]}",
                verifier_version="1.0.0",
                tenant_id=tenant_id,
                thread_id=plan.thread_id,
                message_id=plan.message_id,
                context_revision=plan.context_revision,
                plan_reference=PlanReferenceDTO(
                    schema_version="1.0",
                    plan_id=plan.plan_id,
                    tenant_id=tenant_id,
                    thread_id=plan.thread_id,
                    message_id=plan.message_id,
                    context_revision=plan.context_revision,
                ),
                overall_status=ctx_overall,
                requirements=[ctx_group],
                verified_facts=[],
                conflicts=[],
                action_context=action_context,
                warnings=list(ctx_group.warnings),
                fusion_duration_ms=duration_ms,
                rechecks_performed=0,
                duplicates_removed=0,
            )
            if dispatch_event:
                await self._dispatch_fusion_event(result)
            return result

        # ---------------------------------------------------------------------
        # Query Tenant Configured Categories (Zero Hallucination Guard)
        # ---------------------------------------------------------------------
        configured_categories: Set[str] = await configured_categories_for(tenant_id, db)

        # Union with categories present in provided or retrieved candidates
        if all_candidates:
            configured_categories = configured_categories.union({c.category for c in all_candidates if c.category})

        # ---------------------------------------------------------------------
        # 3. Requirement-Aware Group Decomposition
        # ---------------------------------------------------------------------
        group_defs = self._grouper.decompose_requirements(plan=plan, envelope=envelope)
        from app.services.retrieval_router.verifier import price_order as _price_order
        _order = _price_order(getattr(plan.comparison, "ranking_criterion", None)) if plan else None
        for _g in group_defs:
            _g.price_order = _order   # 'cheapest / most expensive' survives into each group

        requirement_evidence_groups: List[RequirementEvidenceGroup] = []
        all_verified_facts: List[VerifiedFact] = []
        all_conflicts: List[ConflictRecord] = []
        warnings: List[str] = []
        duplicates_removed_total = 0

        for gdef in group_defs:
            # Match candidates to requirement targets & deduplicate
            matched_candidates, verified_targets, missing_targets = self._matcher.match_and_deduplicate(
                group_def=gdef,
                candidates=all_candidates,
                tenant_id=tenant_id,
            )
            duplicates_removed_total += max(0, len(all_candidates) - len(matched_candidates))

            # Initialize requirement group
            req_group = RequirementEvidenceGroup(
                requirement_id=gdef.requirement_id,
                intent=gdef.intent,
                requirement_type=gdef.requirement_type,
                description=gdef.description,
                requested_targets=gdef.requested_targets,
                verified_targets=verified_targets,
                missing_targets=missing_targets,
                requested_count=gdef.requested_count,
                returned_count=0,
                required_attributes=gdef.required_attributes,
                satisfied_attributes=[],
                missing_attributes=[],
                satisfied_constraints=[],
                unmet_constraints=[],
                status=RequirementCoverageStatus.COMPLETE,
                target_category=gdef.target_category,
                verified_candidates=[],
                missing_evidence_reasons=[],
                warnings=[],
                evidence_references=[],
            )

            # Check if requirement targets an unconfigured category
            is_unconfigured_category = (
                gdef.target_category is not None
                and gdef.target_category not in ("operational_availability",)
                and len(configured_categories) > 0
                and gdef.target_category not in configured_categories
            )

            if is_unconfigured_category:
                req_group.status = RequirementCoverageStatus.CATEGORY_NOT_CONFIGURED
                req_group.missing_evidence_reasons.append(
                    f"Tenant knowledge base has no configured records for category '{gdef.target_category}'. Direct factual assertion withheld to prevent hallucination."
                )
                action_context.requires_human_escalation = True
                if gdef.target_category and gdef.target_category not in action_context.unsupported_categories:
                    action_context.unsupported_categories.append(gdef.target_category)
                action_context.escalation_reason = (
                    f"Customer inquired about '{gdef.target_category}', but tenant has no active knowledge records in this category."
                )
                action_context.safe_response_strategy = "partial_evidence_with_escalation"
            else:
                # Hard constraint verification and ranking
                verified_cands, facts, cnf_list, grp_warnings = self._verifier.verify_and_rank_group(
                    group=req_group,
                    candidates=matched_candidates,
                    plan=plan,
                    tenant_id=tenant_id,
                    as_of=ref_time,
                    group_def=gdef,
                )
                all_verified_facts.extend(facts)
                all_conflicts.extend(cnf_list)
                warnings.extend(grp_warnings)

                # Assess coverage status for this requirement
                self._verifier.assess_group_coverage(
                    group=req_group,
                    verified_candidates=verified_cands,
                )

            # Inherit operational flags into action context
            if gdef.is_operational or req_group.requirement_type == RequirementType.OPERATIONAL_SCHEDULING:
                action_context.workflow_action_required = True
                action_context.required_workflow_type = gdef.operational_type or "appointment_scheduling"
                action_context.booking_confirmed = False  # Strictly False at fusion stage

            requirement_evidence_groups.append(req_group)

        # ---------------------------------------------------------------------
        # 4. Aggregate Overall Coverage
        # ---------------------------------------------------------------------
        overall_status = self._verifier.aggregate_overall_status(requirement_evidence_groups)
        if ctx_overall and ctx_overall in (EvidenceOverallStatus.NEEDS_CLARIFICATION, EvidenceOverallStatus.NO_RETRIEVAL_REQUIRED):
            overall_status = ctx_overall

        if action_context.requires_human_escalation:
            action_context.safe_response_strategy = "partial_evidence_with_escalation"

        duration_ms = (time.perf_counter() - start_time) * 1000.0

        # Construct final versioned VerifiedEvidenceResult
        result = VerifiedEvidenceResult(
            price_ranking_unscoped=bool(getattr(retrieval_result, "price_ranking_unscoped", False)),
            schema_version="1.0",
            fusion_id=f"fus_{uuid.uuid4().hex[:12]}",
            verifier_version="1.0.0",
            tenant_id=tenant_id,
            thread_id=plan.thread_id,
            message_id=plan.message_id,
            context_revision=plan.context_revision,
            plan_reference=PlanReferenceDTO(
                schema_version="1.0",
                plan_id=plan.plan_id,
                tenant_id=tenant_id,
                thread_id=plan.thread_id,
                message_id=plan.message_id,
                context_revision=plan.context_revision,
            ),
            overall_status=overall_status,
            requirements=requirement_evidence_groups,
            verified_facts=all_verified_facts,
            conflicts=all_conflicts,
            action_context=action_context,
            warnings=warnings,
            fusion_duration_ms=duration_ms,
            rechecks_performed=0,
            duplicates_removed=duplicates_removed_total,
        )

        if dispatch_event:
            await self._dispatch_fusion_event(result)

        return result

    async def _dispatch_fusion_event(self, result: VerifiedEvidenceResult) -> None:
        """Publish verified evidence outcome event to Redis stream 'ai_processing'."""
        try:
            event_bus = await get_event_bus()
            event = DomainEvent(
                event_type="email.evidence_fusion.completed",
                tenant_id=result.tenant_id,
                payload=result.model_dump(),
            )
            await event_bus.publish(
                stream_name="ai_processing",
                event=event,
            )
            logger.info(
                "Published evidence fusion completed event to Redis stream",
                fusion_id=result.fusion_id,
                plan_id=result.plan_reference.plan_id,
                tenant_id=result.tenant_id,
                overall_status=result.overall_status.value,
                requirements_count=len(result.requirements),
            )
        except Exception as err:
            logger.warning(
                "Failed to publish evidence fusion completed event to stream (non-fatal for caller)",
                error=str(err),
                fusion_id=result.fusion_id,
            )


evidence_fusion_service = EvidenceFusionService()


# ---------------------------------------------------------------------------
# Tenant configured categories (zero-hallucination guard), cached briefly per tenant
# ---------------------------------------------------------------------------
# One GROUP BY over the tenant's knowledge used to run on EVERY fusion call (one extra DB
# session per email; ~0.4 s cross-region). Categories only change when knowledge is imported,
# and the import worker invalidates this cache when an import completes.
CONFIGURED_CATEGORIES_TTL_S = 60.0
_CONFIGURED_CATEGORIES: Dict[str, Tuple[float, Set[str]]] = {}


async def configured_categories_for(tenant_id: str, db: Optional[AsyncSession] = None) -> Set[str]:
    hit = _CONFIGURED_CATEGORIES.get(tenant_id)
    if hit is not None and time.monotonic() - hit[0] < CONFIGURED_CATEGORIES_TTL_S:
        return set(hit[1])
    try:
        from sqlalchemy import select
        from app.models.knowledge import KnowledgeItem

        stmt = select(KnowledgeItem.category).where(KnowledgeItem.tenant_id == tenant_id).group_by(KnowledgeItem.category)
        if db is not None:
            rows = (await db.execute(stmt)).fetchall()
        else:
            async with db_manager.session_factory() as session:
                rows = (await session.execute(stmt)).fetchall()
    except Exception as exc:  # noqa: BLE001 - same fail-soft behaviour as before (not cached)
        logger.warning(
            "Could not query configured knowledge categories in EvidenceFusionService",
            error=str(exc),
            tenant_id=tenant_id,
        )
        return set()
    cats = {row[0] for row in rows if row[0]}
    _CONFIGURED_CATEGORIES[tenant_id] = (time.monotonic(), cats)
    return set(cats)


def invalidate_configured_categories(tenant_id: str) -> None:
    _CONFIGURED_CATEGORIES.pop(tenant_id, None)
