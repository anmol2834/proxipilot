"""Knowledge Import Background Worker — Phase 8.0 / 8.5.

Consumes: 'knowledge_import_events' Redis stream.
Consumer Group: 'knowledge-import-worker-group'
Concurrency: Bounded by asyncio.Semaphore (default 4).

Responsibilities:
- Distributed per-job lock protection against concurrent worker execution.
- Atomic DB job claiming with stale heartbeat takeover.
- Periodic background heartbeat keep-alive task while processing.
- Cooperative stage cancellation checkpoints.
- Centralized state machine progression:
  PARSING -> SCHEMA_DETECTION -> MAPPING -> VALIDATING -> IMPORTING -> PROJECTING -> COMPLETED/PARTIAL
- Phase 8.5: Bulk canonical PostgreSQL persistence during IMPORTING stage.
- Atomic error handling, retry classification, and DLQ routing.
"""

import asyncio
from datetime import datetime, timezone
import time
from typing import Any, List, Optional, Tuple
import uuid
from app.contracts.column_mapping import CompiledMappingPlanDTO
from app.contracts.dataset_profile import DatasetProfileDTO, ParserErrorType
from app.contracts.events import EventNames
from app.contracts.knowledge import normalize_category_key
from app.contracts.persistence import PersistenceBatchConfig
from app.core.config import get_settings
from app.core.database import db_manager
from app.core.logging import logger
from app.core.messaging import DomainEvent, event_bus
from app.core.storage import get_storage_provider
from app.models.audit import AuditAction
from app.models.knowledge import (
    ImportJob,
    ImportJobStage,
    ImportJobStatus,
    KnowledgeAttributeDefinition,
    KnowledgeItem,
    KnowledgeLifecycleStatus,
    KnowledgeSource,
    KnowledgeVersion,
    SourceAuthorityLevel,
)
from app.services.audit import audit_service
from app.services.column_mapping_service import column_mapping_service
from app.services.data_quality_pipeline import DataQualityPipeline
from app.services.dataset_parser import DatasetParserError
from app.services.dataset_profiler import DatasetProfiler
from app.services.gmail_sync import DistributedLock
from app.services.knowledge_import import KNOWLEDGE_IMPORT_STREAM, knowledge_import_service
from app.services.knowledge_persistence import KnowledgePersistenceService
from app.services.knowledge_projection import KnowledgeProjectionService
from app.services.knowledge_reconciliation import knowledge_reconciliation_service
from app.workers.base import BaseWorker
from sqlalchemy import select
from sqlalchemy.orm import selectinload


# Fire-and-forget tasks (e.g. non-critical audit writes) referenced until done.
_BACKGROUND_TASKS: "set[asyncio.Task]" = set()


class KnowledgeImportWorker(BaseWorker):
    """Worker responsible for orchestrating the multi-stage asynchronous knowledge import pipeline."""

    def __init__(self, concurrency: int = 4, max_retries: int = 3, standalone: bool = True):
        super().__init__(
            worker_name="knowledge-import-worker",
            stream_name=KNOWLEDGE_IMPORT_STREAM,
            group_name="knowledge-import-worker-group",
            concurrency=concurrency,
            max_retries=max_retries,
            standalone=standalone,
        )

    async def process_event(self, event: DomainEvent) -> None:
        """Process incoming knowledge.import.requested event through pipeline stages."""
        payload = event.payload or {}
        job_id = payload.get("job_id") or event.aggregate_id

        if not job_id:
            logger.warning("Import event missing job_id in payload, skipping", event_id=event.event_id)
            return

        worker_instance_id = f"{self.worker_name}-{uuid.uuid4().hex[:8]}"

        logger.info(
            "KnowledgeImportWorker picked up import job",
            job_id=job_id,
            worker_id=worker_instance_id,
            tenant_id=event.tenant_id,
        )

        # 1. Distributed Lock Protection — TTL is renewed by the heartbeat loop for the
        # whole job duration, so a long import can never lose its lock mid-run.
        lock_key = knowledge_import_service.job_lock_key(job_id)
        lock = DistributedLock(key=lock_key, ttl_seconds=60)
        acquired = await lock.acquire()
        if not acquired:
            logger.info("Import job is already locked by another worker instance", job_id=job_id)
            return

        heartbeat_task: Optional[asyncio.Task] = None
        stop_heartbeat = asyncio.Event()

        try:
            # 2. Atomic Database Claim
            async with db_manager.session_factory() as db:
                claimed_job = await knowledge_import_service.claim_job(
                    db=db,
                    job_id=job_id,
                    worker_id=worker_instance_id,
                    stale_heartbeat_seconds=60,
                )
                if not claimed_job:
                    logger.info("Import job could not be claimed (already running or cancelled)", job_id=job_id)
                    return

            # Start audit is recorded off the critical path (one fewer remote write
            # before parsing starts); failures are logged, never fatal.
            async def _record_start_audit(job=claimed_job) -> None:
                try:
                    async with db_manager.session_factory() as db_audit:
                        await audit_service.record(
                            db=db_audit,
                            action=AuditAction.KNOWLEDGE_IMPORT_STARTED,
                            resource_type="import_job",
                            resource_id=job.id,
                            organization_id=job.tenant_id,
                            actor_user_id=job.created_by_user_id,
                            metadata={"worker_id": worker_instance_id},
                        )
                        await db_audit.commit()
                except Exception as audit_err:
                    logger.warning("Could not record import start audit", job_id=job_id, error=str(audit_err)[:200])

            _audit_task = asyncio.create_task(_record_start_audit())
            _BACKGROUND_TASKS.add(_audit_task)  # keep a strong reference until it finishes
            _audit_task.add_done_callback(_BACKGROUND_TASKS.discard)

            # 3. Start Periodic Heartbeat Background Task & In-Memory Cancel State
            cancel_requested_flag = False

            async def _heartbeat_loop():
                nonlocal cancel_requested_flag
                while not stop_heartbeat.is_set():
                    try:
                        await asyncio.sleep(5)
                        # Renew the Redis job lock first: it is the liveness signal the
                        # recovery scanner checks before touching an in-flight job.
                        await lock.extend()
                        async with db_manager.session_factory() as db_hb:
                            await knowledge_import_service.update_heartbeat(
                                db=db_hb,
                                job_id=job_id,
                                worker_id=worker_instance_id,
                            )
                            # Read cancellation straight from the DB (one indexed column),
                            # bypassing the status cache.
                            cancel_at = (
                                await db_hb.execute(
                                    select(ImportJob.cancel_requested_at).where(ImportJob.id == job_id)
                                )
                            ).scalar_one_or_none()
                            if cancel_at:
                                cancel_requested_flag = True
                    except asyncio.CancelledError:
                        break
                    except Exception as hb_err:
                        logger.warning("Heartbeat update failed", job_id=job_id, error=str(hb_err))

            heartbeat_task = asyncio.create_task(_heartbeat_loop())

            def _cancel_checker() -> bool:
                """Synchronous non-blocking cancel checker safely callable from streaming threads."""
                return cancel_requested_flag

            # 4. Orchestrate State Machine Pipeline Stages
            # Streamlined pipeline: PARSING -> SCHEMA_DETECTION -> VALIDATING -> IMPORTING -> PROJECTING
            stages = [
                (ImportJobStatus.PARSING, ImportJobStage.PARSING),
                (ImportJobStatus.SCHEMA_DETECTION, ImportJobStage.SCHEMA_DETECTION),
                (ImportJobStatus.VALIDATING, ImportJobStage.VALIDATING),
                (ImportJobStatus.IMPORTING, ImportJobStage.IMPORTING),
                (ImportJobStatus.PROJECTING, ImportJobStage.PROJECTING),
            ]

            streamed_index_stats = {"indexed": 0, "embedded": 0, "deferred_batches": 0}

            for next_status, next_stage in stages:
                # Check Cancellation Checkpoint (Redis-cached read, retried on transient errors)
                job_dto = await knowledge_import_service.get_import_job_resilient(
                    session_factory=db_manager.session_factory,
                    tenant_id=event.tenant_id,
                    job_id=job_id,
                )
                if job_dto.cancel_requested_at or _cancel_checker():
                    logger.info("Job cancellation requested at stage boundary", job_id=job_id, stage=next_stage.value)
                    await knowledge_import_service.transition_job_resilient(
                        session_factory=db_manager.session_factory,
                        job_id=job_id,
                        next_status=ImportJobStatus.CANCELLED,
                        error_summary="Job cancelled during execution by user request.",
                    )
                    return

                # Transition to stage
                await knowledge_import_service.transition_job_resilient(
                    session_factory=db_manager.session_factory,
                    job_id=job_id,
                    next_status=next_status,
                    next_stage=next_stage,
                )
                logger.info(
                    "Import stage progressed",
                    job_id=job_id,
                    status=next_status.value,
                    stage=next_stage.value,
                )

                # Phase 8.2: If stage is PARSING and staged file exists, execute streaming profiler
                if next_stage == ImportJobStage.PARSING and job_dto.file_uri:
                    storage_provider = get_storage_provider()
                    local_path = await storage_provider.resolve_local_path(job_dto.file_uri)
                    if local_path and local_path.is_file():
                        t0 = time.perf_counter()
                        logger.info(
                            "knowledge.parser.started",
                            job_id=job_id,
                            organization_id=event.tenant_id,
                            source_id=job_dto.source_id,
                            file_type=job_dto.file_type,
                        )

                        profiler = DatasetProfiler()
                        try:
                            profile_dto = await asyncio.to_thread(
                                profiler.profile_file,
                                local_path,
                                job_dto.file_type,
                                cancel_checker=_cancel_checker,
                            )
                            duration = round(time.perf_counter() - t0, 4)
                            rows = profile_dto.quality_summary.total_rows
                            cols = profile_dto.quality_summary.total_columns
                            rps = round(rows / duration, 2) if duration > 0 else 0

                            logger.info(
                                "knowledge.parser.completed",
                                job_id=job_id,
                                organization_id=event.tenant_id,
                                source_id=job_dto.source_id,
                                rows_processed=rows,
                                columns_detected=cols,
                                duration=duration,
                                rows_per_second=rps,
                            )

                            await knowledge_import_service.transition_job_resilient(
                                session_factory=db_manager.session_factory,
                                job_id=job_id,
                                next_status=ImportJobStatus.PARSING,
                                next_stage=ImportJobStage.PARSING,
                                row_count=rows,
                                metadata={"dataset_profile": profile_dto.model_dump()},
                                schema_fingerprint=profile_dto.schema_fingerprint,
                            )
                        except DatasetParserError as pe:
                            logger.error(
                                "knowledge.parser.failed",
                                job_id=job_id,
                                organization_id=event.tenant_id,
                                source_id=job_dto.source_id,
                                error_type=pe.error_type.value,
                                error=pe.message,
                            )
                            async with db_manager.session_factory() as db:
                                if pe.error_type == ParserErrorType.CANCELLED:
                                    await knowledge_import_service.transition_job(
                                        db=db,
                                        job_id=job_id,
                                        next_status=ImportJobStatus.CANCELLED,
                                        error_summary=pe.message,
                                    )
                                else:
                                    await knowledge_import_service.transition_job(
                                        db=db,
                                        job_id=job_id,
                                        next_status=ImportJobStatus.FAILED,
                                        error_summary=pe.message,
                                        error_details={"error_type": pe.error_type.value},
                                    )
                            return

                # Phase 8.3: If stage is SCHEMA_DETECTION, execute deterministic column mapping
                if next_stage == ImportJobStage.SCHEMA_DETECTION:
                    async with db_manager.session_factory() as db:
                        current_job = await knowledge_import_service.get_import_job(
                            db=db,
                            tenant_id=event.tenant_id,
                            job_id=job_id,
                        )
                        raw_meta = current_job.metadata or {}
                        profile_dict = raw_meta.get("dataset_profile")
                        if profile_dict:
                            profile_dto = DatasetProfileDTO.model_validate(profile_dict)
                            raw_cat = raw_meta.get("category") or payload.get("category") or "products_services"
                            category = normalize_category_key(raw_cat)

                            mapping_plan = await column_mapping_service.detect_and_compile_mapping(
                                db=db,
                                tenant_id=event.tenant_id,
                                category=category,
                                profile=profile_dto,
                                source_type=current_job.file_type,
                            )
                            # Persist approved schema profile for zero-LLM O(1) instant reuse on subsequent imports
                            if not mapping_plan.is_reused_from_profile and mapping_plan.mapped_count > 0:
                                try:
                                    saved_prof = await column_mapping_service.save_schema_profile(
                                        db=db,
                                        tenant_id=event.tenant_id,
                                        category=category,
                                        profile=profile_dto,
                                        plan=mapping_plan,
                                        user_id=current_job.created_by_user_id,
                                    )
                                    if saved_prof:
                                        mapping_plan.profile_id = saved_prof.id
                                except Exception as sp_err:
                                    logger.warning("Could not persist schema profile", error=str(sp_err))

                            logger.info(
                                "knowledge.schema_detection.completed",
                                job_id=job_id,
                                organization_id=event.tenant_id,
                                category=category,
                                mapped_columns=mapping_plan.mapped_count,
                                needs_review=mapping_plan.needs_review_count,
                                unmapped=mapping_plan.unmapped_count,
                                reused_profile=mapping_plan.is_reused_from_profile,
                            )
                            await knowledge_import_service.transition_job_resilient(
                                session_factory=db_manager.session_factory,
                                job_id=job_id,
                                next_status=ImportJobStatus.SCHEMA_DETECTION,
                                next_stage=ImportJobStage.SCHEMA_DETECTION,
                                metadata={
                                    "mapping_plan": mapping_plan.model_dump(),
                                    "category": category,
                                },
                            )

                # Phase 8.4: If stage is VALIDATING, execute pre-flight quality and mapping verification
                if next_stage == ImportJobStage.VALIDATING:
                    async with db_manager.session_factory() as db:
                        current_job = await knowledge_import_service.get_import_job(
                            db=db,
                            tenant_id=event.tenant_id,
                            job_id=job_id,
                        )
                        raw_meta = current_job.metadata or {}
                        plan_dict = raw_meta.get("mapping_plan")
                        profile_dict = raw_meta.get("dataset_profile")
                        raw_cat = raw_meta.get("category") or payload.get("category") or "products_services"
                        category = normalize_category_key(raw_cat)

                        mapped_count = 0
                        if plan_dict:
                            mapping_plan = CompiledMappingPlanDTO.model_validate(plan_dict)
                            mapped_count = mapping_plan.mapped_count

                        # Quality gate: refuse to import if no columns mapped at all —
                        # importing with 0 mapped columns creates empty items that pollute the RAG index.
                        if mapped_count == 0:
                            logger.error(
                                "knowledge.validation.failed — zero columns mapped, aborting import",
                                job_id=job_id,
                                organization_id=event.tenant_id,
                                category=category,
                            )
                            await knowledge_import_service.transition_job(
                                db=db,
                                job_id=job_id,
                                next_status=ImportJobStatus.FAILED,
                                error_summary=(
                                    "No columns could be mapped to the selected category schema. "
                                    "Please check that your file has recognizable column headers "
                                    f"for the '{category}' category."
                                ),
                            )
                            return

                        logger.info(
                            "knowledge.validation.preflight_passed",
                            job_id=job_id,
                            organization_id=event.tenant_id,
                            category=category,
                            mapped_columns=mapped_count,
                        )

                        await knowledge_import_service.transition_job_resilient(
                            session_factory=db_manager.session_factory,
                            job_id=job_id,
                            next_status=ImportJobStatus.VALIDATING,
                            next_stage=ImportJobStage.VALIDATING,
                            processed_rows=0,
                            failed_rows=0,
                            metadata={
                                "validation_preflight": {
                                    "status": "passed",
                                    "category": category,
                                    "mapped_columns": mapped_count,
                                }
                            },
                        )

                # -------------------------------------------------------
                # Phase 8.5: IMPORTING — Bulk canonical PostgreSQL persistence
                # -------------------------------------------------------
                if next_stage == ImportJobStage.IMPORTING and job_dto.file_uri:
                    async with db_manager.session_factory() as db:
                        current_job = await knowledge_import_service.get_import_job(
                            db=db,
                            tenant_id=event.tenant_id,
                            job_id=job_id,
                        )
                        raw_meta = current_job.metadata or {}
                        plan_dict = raw_meta.get("mapping_plan")
                        if plan_dict:
                            mapping_plan = CompiledMappingPlanDTO.model_validate(plan_dict)
                            raw_cat = raw_meta.get("category") or payload.get("category") or "products_services"
                            category = normalize_category_key(raw_cat)

                            # Load tenant custom attributes (0 DB queries in row loop)
                            res = await db.execute(
                                select(KnowledgeAttributeDefinition).where(
                                    KnowledgeAttributeDefinition.tenant_id == event.tenant_id,
                                    KnowledgeAttributeDefinition.category == category,
                                )
                            )
                            custom_attrs = list(res.scalars().all())

                            # Load source authority level from KnowledgeSource
                            src_res = await db.execute(
                                select(KnowledgeSource).where(
                                    KnowledgeSource.id == current_job.source_id,
                                    KnowledgeSource.tenant_id == event.tenant_id,
                                )
                            )
                            knowledge_source = src_res.scalar_one_or_none()
                            authority = (
                                knowledge_source.authority_level
                                if knowledge_source
                                else SourceAuthorityLevel.IMPORTED_DATA.value
                            )

                            storage_provider = get_storage_provider()
                            local_path = await storage_provider.resolve_local_path(job_dto.file_uri)
                            if local_path and local_path.is_file():
                                # Resolve configurable batch settings
                                settings = get_settings()
                                import_cfg = settings.knowledge_import
                                batch_size = import_cfg.knowledge_import_batch_size
                                progress_interval = import_cfg.knowledge_import_progress_interval

                                persist_config = PersistenceBatchConfig(
                                    batch_size=batch_size,
                                    progress_update_interval_rows=progress_interval,
                                )

                                # Build bounded-memory quality pipeline
                                pipeline = DataQualityPipeline(
                                    tenant_id=event.tenant_id,
                                    category=category,
                                    mapping_plan=mapping_plan,
                                    custom_attributes=custom_attrs,
                                    batch_size=batch_size,
                                )

                                # Persistence service — derives tenant from authoritative job
                                persistence_svc = KnowledgePersistenceService(
                                    tenant_id=event.tenant_id,
                                    source_id=current_job.source_id,
                                    category=category,
                                    job_id=job_id,
                                    created_by_user_id=current_job.created_by_user_id,
                                    authority_level=authority,
                                    config=persist_config,
                                )

                                t_import = time.perf_counter()

                                # Streaming pipeline: each batch is parsed (thread), persisted
                                # + projected in ONE transaction, then embedded and upserted to
                                # Qdrant straight from memory. Up to N batches are in flight so
                                # network round trips of different batches overlap. Nothing is
                                # re-read from PostgreSQL afterwards.
                                max_inflight = max(1, import_cfg.knowledge_import_pipeline_concurrency)
                                slots = asyncio.Semaphore(max_inflight)
                                write_lane = asyncio.Semaphore(
                                    max(1, import_cfg.knowledge_import_db_write_concurrency)
                                )
                                progress_lock = asyncio.Lock()
                                batch_tasks: List[asyncio.Task] = []
                                rows_since_checkpoint = 0

                                async def _persist_and_index(qb) -> None:
                                    nonlocal rows_since_checkpoint
                                    try:
                                        async with write_lane:
                                            batch_result, indexable = await persistence_svc.persist_and_project_batch(
                                                session_factory=db_manager.session_factory,
                                                batch=qb,
                                            )
                                        if indexable:
                                            try:
                                                idx = await knowledge_reconciliation_service.index_documents(
                                                    event.tenant_id, indexable
                                                )
                                                streamed_index_stats["indexed"] += idx.get("indexed", 0)
                                                streamed_index_stats["embedded"] += idx.get("embedded", 0)
                                            except Exception as idx_err:
                                                # Rows stay semantic_status='pending'; the PROJECTING
                                                # stage reconciles them. Never fail the import here.
                                                streamed_index_stats["deferred_batches"] += 1
                                                logger.warning(
                                                    "knowledge.indexing.batch_deferred",
                                                    job_id=job_id,
                                                    batch_index=qb.batch_index,
                                                    error=str(idx_err)[:300],
                                                )
                                        rows_since_checkpoint += batch_result.total_rows
                                        if rows_since_checkpoint >= progress_interval:
                                            rows_since_checkpoint = 0
                                            summary = persistence_svc.get_summary()
                                            async with progress_lock:
                                                await knowledge_import_service.transition_job_resilient(
                                                    session_factory=db_manager.session_factory,
                                                    job_id=job_id,
                                                    next_status=ImportJobStatus.IMPORTING,
                                                    next_stage=ImportJobStage.IMPORTING,
                                                    processed_rows=summary.total_inserted + summary.total_versioned + summary.total_unchanged,
                                                    failed_rows=summary.total_failed,
                                                )
                                    finally:
                                        slots.release()

                                async def _drain() -> None:
                                    results = await asyncio.gather(*batch_tasks, return_exceptions=True)
                                    for r in results:
                                        if isinstance(r, BaseException):
                                            raise r

                                # Stream batches — bounded memory (≤ max_inflight batches held)
                                gen = pipeline.process_file_batches(
                                    str(local_path),
                                    current_job.file_type,
                                    cancel_checker=_cancel_checker,
                                )
                                try:
                                    while True:
                                        if _cancel_checker():
                                            await asyncio.gather(*batch_tasks, return_exceptions=True)
                                            logger.info(
                                                "Import cancelled between persistence batches",
                                                job_id=job_id,
                                            )
                                            await knowledge_import_service.transition_job_resilient(
                                                session_factory=db_manager.session_factory,
                                                job_id=job_id,
                                                next_status=ImportJobStatus.CANCELLED,
                                                error_summary="Cancelled during IMPORTING stage.",
                                            )
                                            return

                                        await slots.acquire()
                                        # Parsing + normalisation is CPU-bound: run in a thread so
                                        # the API event loop is never blocked.
                                        try:
                                            quality_batch = await asyncio.to_thread(next, gen, None)
                                        except BaseException:
                                            slots.release()
                                            raise
                                        if quality_batch is None:
                                            slots.release()
                                            break
                                        batch_tasks.append(
                                            asyncio.create_task(_persist_and_index(quality_batch))
                                        )
                                    await _drain()

                                except DatasetParserError as pe:
                                    await asyncio.gather(*batch_tasks, return_exceptions=True)
                                    if pe.error_type == ParserErrorType.CANCELLED:
                                        await knowledge_import_service.transition_job_resilient(
                                            session_factory=db_manager.session_factory,
                                            job_id=job_id,
                                            next_status=ImportJobStatus.CANCELLED,
                                            error_summary=pe.message,
                                        )
                                        return
                                    raise

                                import_duration = round(time.perf_counter() - t_import, 4)
                                final_summary = persistence_svc.get_summary()

                                logger.info(
                                    "knowledge.importing.completed",
                                    job_id=job_id,
                                    organization_id=event.tenant_id,
                                    category=category,
                                    inserted=final_summary.total_inserted,
                                    versioned=final_summary.total_versioned,
                                    unchanged=final_summary.total_unchanged,
                                    duplicates=final_summary.total_duplicates,
                                    conflicts=final_summary.total_conflicts,
                                    failed=final_summary.total_failed,
                                    batches_committed=final_summary.batches_committed,
                                    batches_rolled_back=final_summary.batches_rolled_back,
                                    duration=import_duration,
                                )

                                # Final progress write for IMPORTING stage
                                await knowledge_import_service.transition_job_resilient(
                                    session_factory=db_manager.session_factory,
                                    job_id=job_id,
                                    next_status=ImportJobStatus.IMPORTING,
                                    next_stage=ImportJobStage.IMPORTING,
                                    processed_rows=final_summary.total_inserted + final_summary.total_versioned + final_summary.total_unchanged,
                                    failed_rows=final_summary.total_failed,
                                    metadata={
                                        "persistence_summary": {
                                            "inserted": final_summary.total_inserted,
                                            "versioned": final_summary.total_versioned,
                                            "unchanged": final_summary.total_unchanged,
                                            "duplicates": final_summary.total_duplicates,
                                            "conflicts": final_summary.total_conflicts,
                                            "failed": final_summary.total_failed,
                                            "batches_committed": final_summary.batches_committed,
                                            "batches_rolled_back": final_summary.batches_rolled_back,
                                            "duration_seconds": import_duration,
                                        }
                                    },
                                )

                # Phase 8.6: PROJECTING — now a safety net only.
                # Projection, chunking, embedding and Qdrant upserts already happened per batch
                # during IMPORTING. Here we only index versions that are still pending (a batch
                # whose indexing failed, or rows left by a crashed earlier run). With nothing
                # pending this costs one small query instead of re-downloading the whole dataset.
                # -------------------------------------------------------
                if next_stage == ImportJobStage.PROJECTING:
                    current_job = await knowledge_import_service.get_import_job_resilient(
                        session_factory=db_manager.session_factory,
                        tenant_id=event.tenant_id,
                        job_id=job_id,
                    )
                    if current_job.source_id:
                        t_proj = time.perf_counter()
                        recon_summary = await knowledge_reconciliation_service.reconcile_tenant_vectors(
                            tenant_id=event.tenant_id,
                            source_id=current_job.source_id,
                            batch_size=200,
                        )
                        proj_duration = round(time.perf_counter() - t_proj, 4)
                        logger.info(
                            "knowledge.projection_and_indexing.completed",
                            job_id=job_id,
                            organization_id=event.tenant_id,
                            streamed_indexed_vectors=streamed_index_stats["indexed"],
                            deferred_batches=streamed_index_stats["deferred_batches"],
                            leftover_indexed_vectors=recon_summary.get("indexed_vectors", 0),
                            duration=proj_duration,
                        )
                        await knowledge_import_service.transition_job_resilient(
                            session_factory=db_manager.session_factory,
                            job_id=job_id,
                            next_status=ImportJobStatus.PROJECTING,
                            next_stage=ImportJobStage.PROJECTING,
                            metadata={
                                "projection_summary": {
                                    "mode": "streaming",
                                    "streamed_indexed_vectors": streamed_index_stats["indexed"],
                                    "deferred_batches": streamed_index_stats["deferred_batches"],
                                    "leftover_indexed_vectors": recon_summary.get("indexed_vectors", 0),
                                    "duration_seconds": proj_duration,
                                },
                                "indexing_summary": recon_summary,
                            },
                        )

                # Cooperative pause between stage transitions
                await asyncio.sleep(0.05)

            # 5. Final Stage Completion (COMPLETED or PARTIAL)
            final_job = await knowledge_import_service.get_import_job_resilient(
                session_factory=db_manager.session_factory,
                tenant_id=event.tenant_id,
                job_id=job_id,
            )
            final_status = (
                ImportJobStatus.PARTIAL
                if final_job.failed_rows > 0
                else ImportJobStatus.COMPLETED
            )
            await knowledge_import_service.transition_job_resilient(
                session_factory=db_manager.session_factory,
                job_id=job_id,
                next_status=final_status,
                next_stage=ImportJobStage.COMPLETED,
                processed_rows=final_job.row_count or final_job.processed_rows,
            )

            # Completion audit is best-effort: the data is committed and indexed, so a
            # dropped connection here must not turn a successful import into a failure.
            try:
                async with db_manager.session_factory() as db:
                    await audit_service.record(
                        db=db,
                        action=AuditAction.KNOWLEDGE_IMPORT_COMPLETED,
                        resource_type="import_job",
                        resource_id=final_job.id,
                        organization_id=final_job.organization_id,
                        actor_user_id=final_job.created_by_user_id,
                        metadata={
                            "status": final_status.value,
                            "processed_rows": final_job.processed_rows,
                            "failed_rows": final_job.failed_rows,
                        },
                    )
                    await db.commit()
            except Exception as audit_err:
                logger.warning("Could not record import completion audit", job_id=job_id, error=str(audit_err)[:200])

            # New/changed catalogue: product-family vocabulary must reflect it immediately.
            try:
                from app.services.retrieval_router.entity_eligibility import invalidate_tenant_vocabulary
                from app.services.business_taxonomy import invalidate_business_taxonomy
                from app.services.evidence_fusion.service import invalidate_configured_categories
                invalidate_tenant_vocabulary(event.tenant_id)
                invalidate_business_taxonomy(event.tenant_id)
                invalidate_configured_categories(event.tenant_id)
            except Exception:  # noqa: BLE001
                pass
            logger.info("Import job pipeline completed successfully", job_id=job_id, final_status=final_status.value)

        except Exception as err:
            logger.error("Import worker pipeline failed", job_id=job_id, error=str(err))
            async with db_manager.session_factory() as db_err:
                try:
                    await knowledge_import_service.transition_job(
                        db=db_err,
                        job_id=job_id,
                        next_status=ImportJobStatus.FAILED,
                        error_summary=str(err),
                        error_details={"exception_type": type(err).__name__, "message": str(err)},
                    )
                    await audit_service.record(
                        db=db_err,
                        action=AuditAction.KNOWLEDGE_IMPORT_FAILED,
                        resource_type="import_job",
                        resource_id=job_id,
                        organization_id=event.tenant_id,
                        metadata={"error": str(err)},
                    )
                    await db_err.commit()
                except Exception as transition_err:
                    logger.error("Could not record import failure state", job_id=job_id, error=str(transition_err))
            raise  # Let BaseWorker handle retry count and DLQ

        finally:
            stop_heartbeat.set()
            if heartbeat_task:
                heartbeat_task.cancel()
                try:
                    await heartbeat_task
                except asyncio.CancelledError:
                    pass
            await lock.release()
