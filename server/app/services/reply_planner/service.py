"""Enterprise Reply Planning & Validation Service — Phase 7.

Orchestrates the conversion of Minimal Evidence Packages into natural, verified,
context-aware email replies with deterministic safety validation and policy gating.

Key Capabilities:
1. Evidence-Grounded Drafting: Translates Minimal Evidence Packages into natural,
   professional enterprise prose using OpenAI Structured Outputs or deterministic fallback.
2. Deterministic Claim Validation: Enforces exact price matches, booking confirmation invariants,
   and honest missing-signal disclosures.
3. Bounded Semantic Repair: Executes at most 1 targeted repair attempt if an LLM draft
   violates factual or safety constraints.
4. Policy-Controlled Disposition: Computes SEND, CLARIFY, HUMAN_REVIEW, PARTIAL_RESPONSE,
   or NO_REPLY_REQUIRED with strict authorization controls.
5. Outbound Delivery Idempotency: Protects against duplicate email dispatches during
   worker retries or replay events.
6. Asynchronous Redis Streams Dispatch: Publishes `email.reply_plan.created` for downstream
   observability and telemetry.
"""

from __future__ import annotations

import asyncio
import json
import time
from typing import Any, Dict, List, Optional
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.contracts.evidence_package import MinimalEvidencePackage, PackageStatus
from app.contracts.reply_planner import (
    ReplyDisposition,
    ReplyPlan,
    ReplyValidationReport,
    RequirementCoverageEvaluation,
    StructuredReplyDraft,
    ValidationIssue,
    ValidationIssueSeverity,
)
from app.core.logging import logger
from app.core.messaging import DomainEvent, get_event_bus
from app.services.reply_planner.closing import ReplyClosing, apply_closing, make_closing
from app.services.reply_planner.drafter import ReplyDrafter, _text_to_html, reply_drafter
from app.services.reply_planner.persistence import ReplyPersistenceGateway, reply_persistence_gateway
from app.services.reply_planner.policy_gate import ReplyPolicyGate, reply_policy_gate
from app.services.reply_planner.validator import DeterministicReplyValidator, reply_validator


class ReplyPlannerService:
    """Production service orchestrating response planning, drafting, validation, and policy gating."""

    def __init__(
        self,
        drafter: Optional[ReplyDrafter] = None,
        validator: Optional[DeterministicReplyValidator] = None,
        policy_gate: Optional[ReplyPolicyGate] = None,
        persistence: Optional[ReplyPersistenceGateway] = None,
        context_engine: Optional[Any] = None,
    ) -> None:
        self.drafter = drafter or reply_drafter
        self.validator = validator or reply_validator
        self.policy_gate = policy_gate or reply_policy_gate
        self.persistence = persistence or reply_persistence_gateway
        self._context_engine = context_engine  # None => the shared Context Intelligence Engine

    @staticmethod
    async def _resolve_closing(tenant_id: str, message_id: str) -> ReplyClosing:
        try:
            from app.services.style_memory import style_memory_service

            return await asyncio.wait_for(style_memory_service.closing_for(tenant_id, message_id), 3.0)
        except Exception as exc:  # noqa: BLE001 - the closing must never block or fail a reply
            logger.warning("reply closing unavailable; using default sign-off",
                           error=f"{type(exc).__name__}: {str(exc)[:200]}")
            return make_closing(None, None)

    @staticmethod
    def _with_closing(draft: Any, closing: ReplyClosing) -> Any:
        if draft is None or not getattr(draft, "body_text", None):
            return draft
        body = apply_closing(draft.body_text, closing)
        if body == draft.body_text:
            return draft
        return draft.model_copy(update={"body_text": body, "body_html": _text_to_html(body)})

    async def plan_and_draft_reply(
        self,
        tenant_id: str,
        package: MinimalEvidencePackage,
        db: Optional[AsyncSession] = None,
        allow_auto_send: bool = True,
        dispatch_event: bool = True,
    ) -> ReplyPlan:
        """Construct, validate, gate, and emit an enterprise ReplyPlan."""
        start_t = time.perf_counter()

        # 1. Tenant Security Guard
        if tenant_id != package.tenant_id:
            raise PermissionError(
                f"Tenant isolation mismatch: requested tenant '{tenant_id}' "
                f"does not match evidence package tenant '{package.tenant_id}'"
            )

        # 2. Context Freshness & Stale Package Guard
        if package.package_status == PackageStatus.STALE_REJECTED:
            logger.warning(
                "Evidence package is stale; rejecting reply plan immediately",
                package_id=package.package_id,
                tenant_id=tenant_id,
            )
            report = ReplyValidationReport(
                validation_passed=False,
                is_sendable=False,
                issues=[
                    ValidationIssue(
                        issue_code="STALE_CONTEXT_REVISION",
                        severity=ValidationIssueSeverity.CRITICAL,
                        description="Context revision has been superseded by a newer message in thread.",
                    )
                ],
            )
            return ReplyPlan(
                plan_id=f"rpl_{uuid.uuid4().hex[:12]}",
                package_reference=package.package_id,
                tenant_id=tenant_id,
                thread_id=package.thread_id,
                message_id=package.message_id,
                context_revision=package.context_revision,
                disposition=ReplyDisposition.REJECTED,
                validation_report=report,
                warnings=["Rejected due to stale context revision"],
            )

        # 3. Draft Generation — the Context Intelligence Engine retrieves all seven memories in
        # parallel, cross-checks them against the evidence (conflicts, outdated facts, overdue
        # promises), scores confidence and budgets the context. It never raises.
        from app.services.context_engine import context_engine

        bundle = await (self._context_engine or context_engine).assemble(package)
        memory_kwargs = dict(
            contact_context=bundle.sections.get("contact"), feedback_context=bundle.sections.get("feedback"),
            commitment_context=bundle.sections.get("commitments"), style_context=bundle.sections.get("style"),
            org_context=bundle.sections.get("org"), thread_context=bundle.sections.get("thread"),
            context_alerts=bundle.alerts, catalogue_context=bundle.sections.get("catalogue"),
            customer_message=getattr(bundle, "customer_message", None),
        )
        draft, draft_metrics = await self.drafter.draft_reply(package, **memory_kwargs)
        # Closing = team sign-off + company name, composed by the server (never a model guess
        # like "[Your name]"). Resolved by the style query the context engine just ran: cache hit.
        closing = await self._resolve_closing(tenant_id, package.message_id)
        draft = self._with_closing(draft, closing)
        draft_metrics.update(bundle.metrics())
        draft_metrics["org_situations"] = bundle.situations

        # 4. Deterministic Validation
        validation_report, coverage_evals = self.validator.validate_draft(draft, package)

        # 5. Bounded Semantic Repair (Max 1 retry if critical issues exist)
        if not validation_report.validation_passed:
            repair_instructions = self._format_repair_instructions(validation_report.issues)
            issues_summary = [f"{iss.issue_code}: {iss.description}" for iss in validation_report.issues]
            logger.info(
                "Attempting bounded semantic repair for draft validation issues",
                package_id=package.package_id,
                issues_count=len(validation_report.issues),
                issues=issues_summary,
            )
            repaired_draft, repair_metrics = await self.drafter.draft_reply(
                package, repair_instructions=repair_instructions, **memory_kwargs
            )
            repaired_draft = self._with_closing(repaired_draft, closing)
            repaired_report, repaired_evals = self.validator.validate_draft(repaired_draft, package)

            if repaired_report.validation_passed or len(repaired_report.issues) < len(validation_report.issues):
                draft = repaired_draft
                validation_report = repaired_report
                validation_report.repaired_deterministically = True
                coverage_evals = repaired_evals
                draft_metrics["repair_attempted"] = True
                draft_metrics["repair_successful"] = repaired_report.validation_passed

        # 6. Policy & Disposition Gate
        disposition, human_review_reason, clarification_reason = self.policy_gate.evaluate_disposition(
            draft=draft,
            validation_report=validation_report,
            package=package,
            allow_auto_send=allow_auto_send,
        )

        # 6b. Context Intelligence Engine: high risks (customer chasing an overdue promise, a price
        # that changed since it was quoted while the customer orders), company practices needing
        # approval, or very low context confidence must never be auto-sent.
        if bundle.escalations and disposition in (ReplyDisposition.SEND, ReplyDisposition.HUMAN_REVIEW):
            if disposition == ReplyDisposition.SEND:
                disposition = ReplyDisposition.HUMAN_REVIEW
                human_review_reason = bundle.escalation_reason
            else:  # already escalated: give the reviewer the engine's reasons too
                human_review_reason = "; ".join(r for r in (human_review_reason, bundle.escalation_reason) if r)
            logger.info("Reply routed to human review by context engine", package_id=package.package_id,
                        reasons=bundle.escalations, confidence=bundle.confidence)

        # 7. Durable State Persistence & Idempotency Safeguard
        ai_resp_id, human_rev_id, outbound_id, idempotency_key = await self.persistence.persist_reply_state(
            package=package,
            draft=draft,
            validation_report=validation_report,
            disposition=disposition,
            human_review_reason=human_review_reason,
            db=db,
        )

        duration_ms = (time.perf_counter() - start_t) * 1000.0
        draft_metrics["total_plan_duration_ms"] = round(duration_ms, 2)

        # 8. Assemble Authoritative ReplyPlan
        plan = ReplyPlan(
            plan_id=f"rpl_{uuid.uuid4().hex[:12]}",
            schema_version="1.0",
            package_reference=package.package_id,
            tenant_id=tenant_id,
            thread_id=package.thread_id,
            message_id=package.message_id,
            context_revision=package.context_revision,
            disposition=disposition,
            coverage_evaluations=coverage_evals,
            draft=draft,
            validation_report=validation_report,
            human_review_reason=human_review_reason,
            human_review_id=human_rev_id,
            clarification_reason=clarification_reason,
            outbound_message_id=outbound_id,
            ai_response_id=ai_resp_id,
            idempotency_key=idempotency_key,
            generation_metrics=draft_metrics,
            warnings=list(package.warnings),
        )

        logger.info(
            "Enterprise reply plan compiled successfully",
            plan_id=plan.plan_id,
            package_id=package.package_id,
            tenant_id=tenant_id,
            disposition=plan.disposition.value,
            requirements_covered=len(plan.coverage_evaluations),
            validation_passed=plan.validation_report.validation_passed,
            is_sendable=plan.validation_report.is_sendable,
            duration_ms=round(duration_ms, 2),
        )

        # 9. Asynchronous Event Dispatch
        if dispatch_event and plan.disposition != ReplyDisposition.REJECTED:
            await self._dispatch_reply_plan_event(plan)

        return plan

    def _format_repair_instructions(self, issues: List[ValidationIssue]) -> str:
        lines = []
        for issue in issues:
            if issue.issue_code == "UNCONFIRMED_BOOKING_PROMISE":
                lines.append(
                    "- CRITICAL: Do NOT claim that any appointment or booking is confirmed. "
                    "State that appointment scheduling requires confirmation by the team."
                )
            elif issue.issue_code == "PRICE_MISMATCH":
                lines.append(
                    f"- CRITICAL: Ensure every price quoted strictly matches verified facts: {issue.description}"
                )
            elif issue.issue_code == "UNSUPPORTED_POLICY_CLAIM":
                lines.append(
                    "- CRITICAL: Do NOT invent warranty or refund terms. State that policy terms are unavailable."
                )
            elif issue.issue_code == "FABRICATED_CONTACT":
                lines.append(
                    "- CRITICAL: Do NOT invent any corporate email address or phone number."
                )
            elif issue.issue_code == "MISSING_REQUIREMENT_COVERAGE":
                lines.append(
                    f"- CRITICAL: Must address requirement: {issue.description}"
                )
            elif issue.issue_code == "UNSAFE_HTML":
                lines.append(
                    "- CRITICAL: Remove all script tags and unsafe HTML attributes."
                )
        return "\n".join(lines)

    async def _dispatch_reply_plan_event(self, plan: ReplyPlan) -> None:
        """Publish domain event `email.reply_plan.created` to Redis Streams."""
        try:
            event_bus = await get_event_bus()
            event = DomainEvent(
                event_type="email.reply_plan.created",
                tenant_id=plan.tenant_id,
                correlation_id=plan.message_id,
                causation_id=plan.package_reference,
                payload=plan.model_dump(),
            )
            await event_bus.publish(
                stream_name="ai_processing",
                event=event,
            )
            logger.info(
                "Published reply plan created event to Redis stream",
                plan_id=plan.plan_id,
                tenant_id=plan.tenant_id,
                disposition=plan.disposition.value,
            )
        except Exception as exc:
            logger.error(
                "Failed to publish reply plan event to Redis stream",
                plan_id=plan.plan_id,
                tenant_id=plan.tenant_id,
                error=str(exc),
            )


# Global singleton instance
reply_planner_service = ReplyPlannerService()
