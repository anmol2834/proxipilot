"""Minimal Evidence Package Service — Phase 6: Minimal Evidence Package.

Orchestrates the construction of compact, trustworthy, and requirement-aware
minimal evidence packages from Candidate Fusion & Evidence Verification results.

Key Capabilities:
1. Relevance-Driven Evidence Filtering: Scopes verified facts and excerpts strictly
   to active customer requirements.
2. Provenance Integrity: Preserves authoritative source systems, versions, and
   verification status on all included facts.
3. Explicit Missing Information: Carries clear signals for unconfigured categories,
   unavailable booking capabilities, and missing comparison targets.
4. Token & Payload Budgeting: Emits compact JSON payloads with measured token
   estimates and graceful degradation.
5. Absolute Security & Policy Validation: Guarantees zero cross-tenant leakage,
   context freshness verification, and operational booking safety (booking_confirmed=False).
"""

from __future__ import annotations

import json
import time
from typing import Any, Dict, List, Optional
import uuid

from app.contracts.evidence_fusion import VerifiedEvidenceResult
from app.contracts.evidence_package import (
    MinimalEvidencePackage,
    PackageActionContext,
    PackageStatus,
)
from app.contracts.requirement_plan import RequirementPlan
from app.core.logging import logger
from app.core.messaging import DomainEvent, get_event_bus
from app.services.context_resolver import ContextEnvelope
from app.services.evidence_package.minimizer import EvidenceMinimizer
from app.services.evidence_package.selector import EvidenceSelector
from app.services.evidence_package.validator import PackageConsistencyValidator


def unknown_identifier_report(plan: Optional[RequirementPlan], fusion_result: VerifiedEvidenceResult) -> List[Dict[str, Any]]:
    """Codes the customer typed that match no record, with the closest existing codes found for
    them. Deterministic: built from the plan's identifiers and the verified candidates."""
    if plan is None:
        return []
    requested: List[str] = []
    for e in plan.entities:
        if (e.entity_type or "").lower() in ("sku", "service_code", "product_code", "model_number"):
            code = (e.canonical_value or e.original_text or "").strip().upper()
            if code and code not in requested:
                requested.append(code)
    if not requested:
        return []
    cands = [c for g in fusion_result.requirements for c in g.verified_candidates]
    found = {(c.external_identity_key or "").upper() for c in cands if not getattr(c, "near_match_for", None)}
    report: List[Dict[str, Any]] = []
    for code in requested:
        if code in found:
            continue
        sugg: List[str] = []
        seen = set()
        for c in cands:
            if (getattr(c, "near_match_for", None) or "").upper() == code and c.entity_id not in seen:
                seen.add(c.entity_id)
                sugg.append(f"{c.external_identity_key} - {c.title}")
        report.append({"requested": code, "suggestions": sugg[:3]})
    return report


class MinimalEvidencePackageService:
    """Production service for assembling and validating Minimal Evidence Packages."""

    def __init__(self) -> None:
        self.selector = EvidenceSelector()
        self.minimizer = EvidenceMinimizer()
        self.validator = PackageConsistencyValidator()

    async def build_package(
        self,
        tenant_id: str,
        fusion_result: VerifiedEvidenceResult,
        envelope: Optional[ContextEnvelope] = None,
        plan: Optional[RequirementPlan] = None,
        max_bytes: int = 65536,
        dispatch_event: bool = True,
    ) -> MinimalEvidencePackage:
        """Construct, minimize, validate, and emit a MinimalEvidencePackage."""
        start_t = time.perf_counter()

        # 1. Tenant Security Guard
        if tenant_id != fusion_result.tenant_id:
            raise PermissionError(
                f"Tenant isolation mismatch: requested tenant '{tenant_id}' "
                f"does not match fusion result tenant '{fusion_result.tenant_id}'"
            )

        # 2. Estimate Raw Input Footprint
        raw_input_bytes = len(json.dumps(fusion_result.model_dump(), default=str).encode("utf-8"))

        # 3. Select Evidence per Requirement
        requirement_packages = []
        for req_group in fusion_result.requirements:
            req_pkg = self.selector.select_requirement_evidence(
                group=req_group,
                fusion_result=fusion_result,
                plan=plan,
            )
            requirement_packages.append(req_pkg)

        # 4. Resolve Contextual Reference for Short / Dependent Messages
        contextual_ref = self.selector.resolve_contextual_reference(
            envelope=envelope,
            fusion_result=fusion_result,
        )

        # 5. Minimize Footprint & Enforce Budget
        minimized_reqs, budget_metrics = self.minimizer.minimize_and_budget(
            requirements=requirement_packages,
            max_bytes=max_bytes,
            raw_input_bytes=raw_input_bytes,
        )

        # 6. Build Downstream Action Context
        act_ctx = fusion_result.action_context
        safe_strategy = act_ctx.safe_response_strategy
        is_cont = bool(plan and plan.is_continuation)
        cont_type = plan.continuation_type if plan else None
        excl_ids = list(plan.excluded_entity_ids) if plan else []

        if is_cont:
            if budget_metrics.facts_included_count > 0:
                safe_strategy = "continuation_discovery"
            else:
                safe_strategy = "catalogue_exhausted"

        package_action_context = PackageActionContext(
            safe_response_strategy=safe_strategy,
            workflow_action_required=act_ctx.workflow_action_required,
            required_workflow_type=act_ctx.required_workflow_type,
            booking_confirmed=act_ctx.booking_confirmed,
            requires_human_escalation=act_ctx.requires_human_escalation,
            unsupported_categories=list(act_ctx.unsupported_categories),
            escalation_reason=act_ctx.escalation_reason,
            clarification_prompt=act_ctx.clarification_reason,
            contextual_intent=act_ctx.contextual_intent,
            referenced_proposal_id=act_ctx.referenced_proposal_id,
        )

        # 7. Assemble MinimalEvidencePackage
        package = MinimalEvidencePackage(
            package_id=f"evp_{uuid.uuid4().hex[:12]}",
            schema_version="1.0",
            builder_version="1.0.0",
            tenant_id=tenant_id,
            thread_id=fusion_result.thread_id,
            message_id=fusion_result.message_id,
            context_revision=fusion_result.context_revision,
            plan_id=fusion_result.plan_reference.plan_id if fusion_result.plan_reference else None,
            fusion_id=fusion_result.fusion_id,
            package_status=PackageStatus.VALID,
            requirements=minimized_reqs,
            contextual_reference=contextual_ref,
            action_context=package_action_context,
            is_continuation=is_cont,
            continuation_type=cont_type,
            previously_presented_entity_ids=excl_ids,
            active_selection_title=((plan.active_selection or {}).get("title") if plan else None),
            unknown_identifiers=unknown_identifier_report(plan, fusion_result),
            price_ranking_unscoped=bool(getattr(fusion_result, "price_ranking_unscoped", False)),
            search_incomplete=bool(getattr(fusion_result, "search_incomplete", False)),
            novelty_verified=is_cont,
            budget_metrics=budget_metrics,
            warnings=list(fusion_result.warnings),
        )

        # 8. Policy & Consistency Gate
        package = self.validator.validate_and_compile(
            package=package,
            envelope=envelope,
            fusion_result=fusion_result,
            plan=plan,
        )

        duration_ms = (time.perf_counter() - start_t) * 1000.0

        logger.info(
            "Minimal evidence package assembled successfully",
            package_id=package.package_id,
            tenant_id=tenant_id,
            status=package.package_status.value,
            requirements_count=len(package.requirements),
            facts_included=package.budget_metrics.facts_included_count,
            serialized_bytes=package.budget_metrics.serialized_package_bytes,
            estimated_tokens=package.budget_metrics.estimated_tokens,
            duration_ms=round(duration_ms, 2),
        )

        # 9. Asynchronous Dispatch to Redis Stream 'ai_processing'
        if dispatch_event and package.package_status != PackageStatus.STALE_REJECTED:
            await self._dispatch_package_event(package)

        return package

    async def _dispatch_package_event(self, package: MinimalEvidencePackage) -> None:
        """Publish domain event `email.evidence_package.created` to Redis Streams."""
        try:
            event_bus = await get_event_bus()
            event = DomainEvent(
                event_type="email.evidence_package.created",
                tenant_id=package.tenant_id,
                correlation_id=package.message_id,
                causation_id=package.fusion_id,
                payload=package.model_dump(),
            )
            await event_bus.publish(
                stream_name="ai_processing",
                event=event,
            )
            logger.info(
                "Published evidence package created event to Redis stream",
                package_id=package.package_id,
                tenant_id=package.tenant_id,
                status=package.package_status.value,
            )
        except Exception as exc:
            logger.error(
                "Failed to publish evidence package event to Redis stream",
                package_id=package.package_id,
                tenant_id=package.tenant_id,
                error=str(exc),
            )


# Global singleton instance
evidence_package_service = MinimalEvidencePackageService()
