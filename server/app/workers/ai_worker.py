"""AI & RAG Background Worker Scaffold.

Consumes: 'ai_processing' stream.
Configuration: Scoped strictly to AiWorkerSettings (DB, Redis, Qdrant, LLM).
"""

from app.core.config import get_ai_worker_settings
from app.core.database import db_manager
from app.core.logging import logger
from app.core.messaging import DomainEvent
from app.core.qdrant import qdrant_manager
from app.workers.base import BaseWorker

# Strong references for fire-and-forget memory capture tasks.
_MEMORY_TASKS: "set" = set()


def _capture_contact_insights(tenant_id: str, message_id: str, plan, retrieval_res) -> None:
    """Memory 4: store the sender's intent and the products they asked about.

    Uses the pipeline's structured outputs only (no extra model call). Interests are
    taken from confidently matched results (exact / hybrid matches, or high relevance),
    never from generic browsing. Runs in the background so drafting is not delayed.
    """
    try:
        import asyncio

        from app.services.contact_memory import contact_memory_service

        interests = []
        for r in (retrieval_res.results or [])[:5]:
            path = getattr(r, "retrieval_path", "") or ""
            score = float(getattr(r, "relevance_score", 0.0) or 0.0)
            if path in ("exact_structured", "hybrid") or score >= 0.55:
                if getattr(r, "title", None):
                    interests.append(r.title)
        intent = getattr(getattr(plan, "intent", None), "value", None)
        task = asyncio.create_task(contact_memory_service.record_ai_insights(
            tenant_id=tenant_id, message_id=message_id, intent=intent, interests=interests[:3],
        ))
        _MEMORY_TASKS.add(task)
        task.add_done_callback(_MEMORY_TASKS.discard)
    except Exception as err:
        logger.warning("Contact insight capture could not be scheduled", error=str(err)[:200])


class AiWorker(BaseWorker):
    """Worker responsible for asynchronous AI Intent classification, RAG, and response generation."""

    def __init__(self, standalone: bool = True):
        settings = get_ai_worker_settings()
        super().__init__(
            worker_name="ai-worker",
            stream_name="ai_processing",
            group_name="ai-worker-group",
            concurrency=settings.worker.ai_worker_concurrency,
            standalone=standalone,
        )
        self.settings = settings

    async def initialize(self) -> None:
        await super().initialize()
        qdrant_manager.initialize()

    async def shutdown(self) -> None:
        await qdrant_manager.close()
        await super().shutdown()
    async def process_event(self, event: DomainEvent) -> None:
        if event.event_type == "email.requirement_plan.created":
            plan_payload = event.payload or {}
            thread_id = plan_payload.get("thread_id")
            message_id = plan_payload.get("message_id")
            plan_id = plan_payload.get("plan_id")
            logger.info(
                "AI Worker received requirement plan",
                plan_id=plan_id,
                tenant_id=event.tenant_id,
                thread_id=thread_id,
                message_id=message_id,
                intent=plan_payload.get("intent"),
                strategy=plan_payload.get("retrieval_strategy"),
                status=plan_payload.get("validation_status"),
            )

            # Deduplication: single pipeline execution per message
            from app.core.redis import redis_manager
            redis_client = redis_manager.client
            plan_lock_key = f"ai_worker:lock:{event.tenant_id}:{thread_id}:{message_id}"
            try:
                acquired = await redis_client.set(plan_lock_key, "1", nx=True, ex=300)
                if not acquired:
                    logger.info(
                        "AI Worker requirement plan pipeline already running or completed for message",
                        plan_id=plan_id,
                        message_id=message_id,
                    )
                    return
            except Exception as r_err:
                logger.warning("Redis lock error in AI worker", error=str(r_err))

            try:
                from app.contracts.requirement_plan import RequirementPlan
                from app.services.retrieval_router import retrieval_router_service
                
                plan = RequirementPlan(**plan_payload)
                retrieval_res = await retrieval_router_service.route_and_retrieve(
                    tenant_id=event.tenant_id,
                    plan=plan,
                    dispatch_event=False,
                )
                logger.info(
                    "AI Worker executed retrieval routing",
                    plan_id=plan.plan_id,
                    retrieval_id=retrieval_res.retrieval_id,
                    status=retrieval_res.status.value,
                    matches_count=len(retrieval_res.results),
                )

                if message_id:
                    _capture_contact_insights(event.tenant_id, message_id, plan, retrieval_res)

                # Phase 5: Candidate Fusion & Evidence Verification
                from app.services.evidence_fusion import evidence_fusion_service

                fusion_res = await evidence_fusion_service.fuse_and_verify(
                    tenant_id=event.tenant_id,
                    plan=plan,
                    retrieval_result=retrieval_res,
                    dispatch_event=False,
                )
                logger.info(
                    "AI Worker executed evidence fusion and verification",
                    plan_id=plan.plan_id,
                    fusion_id=fusion_res.fusion_id,
                    overall_status=fusion_res.overall_status.value,
                    requirements_count=len(fusion_res.requirements),
                    facts_count=len(fusion_res.verified_facts),
                )

                # Phase 6: Minimal Evidence Package
                from app.services.evidence_package import evidence_package_service

                package_res = await evidence_package_service.build_package(
                    tenant_id=event.tenant_id,
                    fusion_result=fusion_res,
                    plan=plan,
                    dispatch_event=False,
                )
                logger.info(
                    "AI Worker executed minimal evidence packaging",
                    plan_id=plan.plan_id,
                    fusion_id=fusion_res.fusion_id,
                    package_id=package_res.package_id,
                    package_status=package_res.package_status.value,
                    requirements_count=len(package_res.requirements),
                    facts_count=package_res.budget_metrics.facts_included_count,
                    serialized_bytes=package_res.budget_metrics.serialized_package_bytes,
                )

                # Phase 7: Enterprise Reply Planning & Validation
                from app.services.reply_planner import reply_planner_service

                # A DB session is REQUIRED: without it the planner cannot persist the draft
                # (AIRun / AIResponse / HumanReview), so drafts that are not auto-sent were lost.
                async with db_manager.session_factory() as plan_db:
                    reply_plan_res = await reply_planner_service.plan_and_draft_reply(
                        tenant_id=event.tenant_id,
                        package=package_res,
                        db=plan_db,
                        dispatch_event=False,
                    )
                logger.info(
                    "AI Worker executed enterprise reply planning and validation",
                    plan_id=plan.plan_id,
                    reply_plan_id=reply_plan_res.plan_id,
                    disposition=reply_plan_res.disposition.value,
                    validation_passed=reply_plan_res.validation_report.validation_passed,
                    is_sendable=reply_plan_res.validation_report.is_sendable,
                )

                # Automated Outbound Delivery via Gmail
                if reply_plan_res.validation_report.is_sendable:
                    from app.services.reply_planner import outbound_delivery_service
                    await outbound_delivery_service.deliver_reply(
                        tenant_id=event.tenant_id,
                        reply_plan=reply_plan_res,
                        package=package_res,
                    )
            except Exception as exc:
                logger.error(
                    "AI Worker failed to execute retrieval, fusion, packaging, and reply planning for requirement plan",
                    error=str(exc),
                    plan_id=plan_payload.get("plan_id"),
                    tenant_id=event.tenant_id,
                )
        elif event.event_type == "email.retrieval.completed":
            retrieval_payload = event.payload or {}
            logger.info(
                "AI Worker received retrieval completed event",
                retrieval_id=retrieval_payload.get("retrieval_id"),
                tenant_id=event.tenant_id,
                status=retrieval_payload.get("status"),
            )
        elif event.event_type == "email.evidence_fusion.completed":
            fusion_payload = event.payload or {}
            logger.info(
                "AI Worker received evidence fusion completed event",
                fusion_id=fusion_payload.get("fusion_id"),
                tenant_id=event.tenant_id,
                overall_status=fusion_payload.get("overall_status"),
            )
        elif event.event_type == "email.evidence_package.created":
            package_payload = event.payload or {}
            pkg_thread_id = package_payload.get("thread_id")
            pkg_message_id = package_payload.get("message_id")
            logger.info(
                "AI Worker received minimal evidence package created event",
                package_id=package_payload.get("package_id"),
                tenant_id=event.tenant_id,
                thread_id=pkg_thread_id,
                message_id=pkg_message_id,
                status=package_payload.get("package_status"),
            )
            # Guard against duplicate standalone package runs
            from app.core.redis import redis_manager
            redis_client = redis_manager.client
            pkg_lock_key = f"ai_worker:lock:{event.tenant_id}:{pkg_thread_id}:{pkg_message_id}"
            try:
                acquired = await redis_client.set(pkg_lock_key, "1", nx=True, ex=300)
                if not acquired:
                    logger.info(
                        "Evidence package already drafted or pipeline running for message",
                        package_id=package_payload.get("package_id"),
                        message_id=pkg_message_id,
                    )
                    return
            except Exception:
                pass

            try:
                from app.contracts.evidence_package import MinimalEvidencePackage
                from app.services.reply_planner import reply_planner_service

                pkg = MinimalEvidencePackage(**package_payload)
                async with db_manager.session_factory() as plan_db:
                    reply_plan_res = await reply_planner_service.plan_and_draft_reply(
                        tenant_id=event.tenant_id,
                        package=pkg,
                        db=plan_db,
                        dispatch_event=False,
                    )
                logger.info(
                    "AI Worker processed reply plan for evidence package event",
                    package_id=pkg.package_id,
                    reply_plan_id=reply_plan_res.plan_id,
                    disposition=reply_plan_res.disposition.value,
                )

                if reply_plan_res.validation_report.is_sendable:
                    from app.services.reply_planner import outbound_delivery_service
                    await outbound_delivery_service.deliver_reply(
                        tenant_id=event.tenant_id,
                        reply_plan=reply_plan_res,
                        package=pkg,
                    )
            except Exception as exc:
                logger.error(
                    "AI Worker failed to process reply plan for evidence package event",
                    package_id=package_payload.get("package_id"),
                    tenant_id=event.tenant_id,
                    error=str(exc),
                )
        elif event.event_type == "email.reply_plan.created":
            reply_plan_payload = event.payload or {}
            logger.info(
                "AI Worker received reply plan created event",
                plan_id=reply_plan_payload.get("plan_id"),
                tenant_id=event.tenant_id,
                disposition=reply_plan_payload.get("disposition"),
            )
        else:
            logger.info(
                "AI Worker handling event",
                event_id=event.event_id,
                event_type=event.event_type,
                tenant_id=event.tenant_id,
                model=self.settings.llm.openai_model,
            )
