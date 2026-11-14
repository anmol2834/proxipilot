"""Phase 8.0 — Knowledge Import Orchestration & Lifecycle Service.

Provides enterprise-grade management for asynchronous knowledge imports:
- Fast, non-blocking HTTP job initialization with Redis Streams publication
- Strict tenant-isolated lookups and IDOR protection
- Client idempotency key verification preventing duplicate import runs
- Centralized immutable state machine validation (VALID_JOB_TRANSITIONS)
- Distributed worker job claiming with heartbeat keep-alive
- Automatic stuck-job detection and recovery from crashed workers
- Cooperative cancellation checkpoints
- AuditService integration for all lifecycle transitions
"""

from datetime import datetime, timedelta, timezone
import json
from typing import Any, Dict, List, Optional, Tuple
import uuid
from fastapi import HTTPException, status
from sqlalchemy import desc, or_, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.contracts.knowledge_crud import decode_cursor, encode_cursor
from app.contracts.knowledge_import import (
    ImportJobCancelDTO,
    ImportJobCreateDTO,
    ImportJobCursorPageDTO,
    ImportJobResponseDTO,
)
from app.core.logging import logger
from app.core.messaging import DomainEvent, event_bus
from app.core.redis import redis_manager
from app.models.audit import AuditAction
from app.models.knowledge import (
    ImportJob,
    ImportJobStage,
    ImportJobStatus,
    KnowledgeSource,
    KnowledgeSourceStatus,
    KnowledgeSourceType,
    SourceAuthorityLevel,
    VALID_JOB_TRANSITIONS,
)
from app.services.audit import audit_service


# Stream identifier for Knowledge Import jobs
KNOWLEDGE_IMPORT_STREAM = "knowledge_import_events"


class KnowledgeImportService:
    """Enterprise domain service for knowledge import orchestration."""

    # =========================================================================
    # 1. Create Import Job (Async Entry Point)
    # =========================================================================

    async def create_import_job(
        self,
        db: AsyncSession,
        tenant_id: str,
        user_id: Optional[str],
        payload: ImportJobCreateDTO,
        correlation_id: Optional[str] = None,
        client_ip: Optional[str] = None,
    ) -> Tuple[ImportJobResponseDTO, bool]:
        """Validate, persist durable ImportJob, and enqueue event to Redis Streams.

        Invariants:
        - HTTP request NEVER executes heavy parsing or row processing.
        - Strict idempotency: Returns existing active job if idempotency_key matches.
        - Emits AuditEvent atomically within the active database transaction.
        """
        now_utc = datetime.now(timezone.utc)

        # 1. Check Idempotency Key within Tenant Boundary
        if payload.idempotency_key:
            stmt = select(ImportJob).where(
                ImportJob.tenant_id == tenant_id,
                ImportJob.idempotency_key == payload.idempotency_key,
            )
            res = await db.execute(stmt)
            existing = res.scalar_one_or_none()
            if existing:
                logger.info(
                    "Reusing existing import job via idempotency key",
                    tenant_id=tenant_id,
                    job_id=existing.id,
                    idempotency_key=payload.idempotency_key,
                )
                return self._build_dto(existing), False

        # 2. Validate or Auto-Provision KnowledgeSource
        source: Optional[KnowledgeSource] = None
        if payload.source_id:
            src_stmt = select(KnowledgeSource).where(
                KnowledgeSource.id == payload.source_id,
                KnowledgeSource.tenant_id == tenant_id,
            )
            res_src = await db.execute(src_stmt)
            source = res_src.scalar_one_or_none()
            if not source:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Knowledge source '{payload.source_id}' not found for this organization.",
                )
        else:
            # Auto-provision dedicated import KnowledgeSource
            s_type = payload.file_type.lower()
            if s_type not in {t.value for t in KnowledgeSourceType}:
                s_type = KnowledgeSourceType.IMPORT.value

            source = KnowledgeSource(
                id=f"ks_{uuid.uuid4().hex}",
                tenant_id=tenant_id,
                source_type=s_type,
                name=f"Import: {payload.dataset_name.strip()}",
                authority_level=SourceAuthorityLevel.IMPORTED_DATA.value,
                status=KnowledgeSourceStatus.ACTIVE.value,
                dataset_name=payload.dataset_name.strip(),
                file_name=payload.file_uri.split("/")[-1] if payload.file_uri else None,
                origin_uri=payload.file_uri,
                created_by_user_id=user_id,
                created_at=now_utc,
                updated_at=now_utc,
            )
            db.add(source)

        meta_str = json.dumps(payload.metadata) if payload.metadata else None

        # 3. Create Durable ImportJob Record
        job_id = f"ij_{uuid.uuid4().hex}"
        job = ImportJob(
            id=job_id,
            tenant_id=tenant_id,
            source_id=source.id,
            dataset_name=payload.dataset_name.strip(),
            file_type=payload.file_type.lower(),
            file_size_bytes=payload.file_size_bytes,
            file_uri=payload.file_uri,
            idempotency_key=payload.idempotency_key,
            status=ImportJobStatus.CREATED.value,
            current_stage=ImportJobStage.CREATED.value,
            row_count=None,
            processed_rows=0,
            failed_rows=0,
            progress_percent=0.00,
            retry_count=0,
            max_retries=3,
            metadata_json=meta_str,
            created_by_user_id=user_id,
            created_at=now_utc,
            updated_at=now_utc,
        )
        db.add(job)

        # 4. Atomic Audit Log
        await audit_service.record(
            db=db,
            action=AuditAction.KNOWLEDGE_IMPORT_CREATED,
            resource_type="import_job",
            resource_id=job.id,
            organization_id=tenant_id,
            actor_user_id=user_id,
            metadata={
                "dataset_name": job.dataset_name,
                "file_type": job.file_type,
                "source_id": source.id,
                "idempotency_key": job.idempotency_key,
                "ip_address": client_ip,
            },
        )

        await db.commit()
        await db.refresh(job)

        # 5. Enqueue Domain Event to Redis Streams
        event = DomainEvent(
            event_type="knowledge.import.requested",
            tenant_id=tenant_id,
            aggregate_type="import_job",
            aggregate_id=job.id,
            correlation_id=correlation_id,
            payload={
                "job_id": job.id,
                "source_id": source.id,
                "dataset_name": job.dataset_name,
                "file_type": job.file_type,
                "file_uri": job.file_uri,
                "idempotency_key": job.idempotency_key,
            },
        )
        try:
            msg_id = await event_bus.publish(KNOWLEDGE_IMPORT_STREAM, event)
            logger.info(
                "Published knowledge.import.requested to Redis Streams",
                stream=KNOWLEDGE_IMPORT_STREAM,
                message_id=msg_id,
                job_id=job.id,
                tenant_id=tenant_id,
            )
        except Exception as err:
            logger.error(
                "Failed to publish knowledge.import.requested event to Redis Streams",
                error=str(err),
                job_id=job.id,
                tenant_id=tenant_id,
            )
            # Job remains safely in Postgres with CREATED status; stuck-job scanner will recover it.

        dto = self._build_dto(job)
        try:
            await redis_manager.client.set(
                f"proxipilot:import_job:{tenant_id}:{job.id}",
                dto.model_dump_json(),
                ex=300,
            )
        except Exception:
            pass

        return dto, True

    # =========================================================================
    # 2. Get Import Job
    # =========================================================================

    async def get_import_job(
        self,
        db: AsyncSession,
        tenant_id: str,
        job_id: str,
    ) -> ImportJobResponseDTO:
        """Fetch an import job strictly within the organization boundary."""
        cache_key = f"proxipilot:import_job:{tenant_id}:{job_id}"
        try:
            cached_raw = await redis_manager.client.get(cache_key)
            if cached_raw:
                return ImportJobResponseDTO.model_validate_json(cached_raw)
        except Exception as cache_err:
            logger.debug("Redis import job cache read miss", error=str(cache_err))

        stmt = select(ImportJob).where(
            ImportJob.id == job_id,
            ImportJob.tenant_id == tenant_id,
        )
        res = await db.execute(stmt)
        job = res.scalar_one_or_none()
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Import job '{job_id}' not found for this organization.",
            )
        dto = self._build_dto(job)
        try:
            await redis_manager.client.set(cache_key, dto.model_dump_json(), ex=120)
        except Exception:
            pass
        return dto

    # =========================================================================
    # 3. List Import Jobs (Keyset Cursor Pagination)
    # =========================================================================

    async def list_import_jobs(
        self,
        db: AsyncSession,
        tenant_id: str,
        cursor: Optional[str] = None,
        limit: int = 20,
        status_filter: Optional[str] = None,
        source_id: Optional[str] = None,
    ) -> ImportJobCursorPageDTO:
        """Query import jobs with stable keyset cursor pagination on (created_at DESC, id DESC)."""
        limit = max(1, min(limit, 100))

        query = select(ImportJob).where(ImportJob.tenant_id == tenant_id)

        if status_filter:
            query = query.where(ImportJob.status == status_filter.lower())
        if source_id:
            query = query.where(ImportJob.source_id == source_id)

        if cursor:
            try:
                cur_dt, cur_id = decode_cursor(cursor)
                query = query.where(
                    or_(
                        ImportJob.created_at < cur_dt,
                        (ImportJob.created_at == cur_dt) & (ImportJob.id < cur_id),
                    )
                )
            except Exception:
                pass

        query = query.order_by(
            desc(ImportJob.created_at),
            desc(ImportJob.id),
        ).limit(limit + 1)

        res = await db.execute(query)
        jobs = list(res.scalars().all())

        has_more = len(jobs) > limit
        page_jobs = jobs[:limit]

        next_cursor = None
        if has_more and page_jobs:
            last_item = page_jobs[-1]
            next_cursor = encode_cursor(last_item.created_at, last_item.id)

        return ImportJobCursorPageDTO(
            items=[self._build_dto(j) for j in page_jobs],
            next_cursor=next_cursor,
            has_more=has_more,
        )

    # =========================================================================
    # 4. Request Cancellation
    # =========================================================================

    async def request_cancellation(
        self,
        db: AsyncSession,
        tenant_id: str,
        user_id: Optional[str],
        job_id: str,
        payload: Optional[ImportJobCancelDTO] = None,
        client_ip: Optional[str] = None,
    ) -> ImportJobResponseDTO:
        """Request cooperative cancellation of an active or pending import job."""
        stmt = select(ImportJob).where(
            ImportJob.id == job_id,
            ImportJob.tenant_id == tenant_id,
        )
        res = await db.execute(stmt)
        job = res.scalar_one_or_none()
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Import job '{job_id}' not found for this organization.",
            )

        terminal_states = {
            ImportJobStatus.COMPLETED.value,
            ImportJobStatus.PARTIAL.value,
            ImportJobStatus.FAILED.value,
            ImportJobStatus.CANCELLED.value,
        }
        if job.status in terminal_states:
            return self._build_dto(job)

        now_utc = datetime.now(timezone.utc)
        job.cancel_requested_at = now_utc

        # If still in CREATED state and not yet claimed, cancel immediately
        if job.status in {ImportJobStatus.CREATED.value, ImportJobStatus.UPLOADING.value} and not job.worker_id:
            job.status = ImportJobStatus.CANCELLED.value
            job.completed_at = now_utc
            job.error_summary = payload.reason if payload else "Cancelled before worker execution"

        job.updated_at = now_utc

        await audit_service.record(
            db=db,
            action=AuditAction.KNOWLEDGE_IMPORT_CANCELLED,
            resource_type="import_job",
            resource_id=job.id,
            organization_id=tenant_id,
            actor_user_id=user_id,
            metadata={"reason": payload.reason if payload else "User requested", "ip_address": client_ip},
        )

        await db.commit()
        await db.refresh(job)
        dto = self._build_dto(job)
        try:
            await redis_manager.client.set(
                f"proxipilot:import_job:{tenant_id}:{job.id}",
                dto.model_dump_json(),
                ex=120,
            )
        except Exception:
            pass
        return dto

    # =========================================================================
    # 5. Worker Coordination: Atomic Claim & Heartbeat
    # =========================================================================

    async def claim_job(
        self,
        db: AsyncSession,
        job_id: str,
        worker_id: str,
        stale_heartbeat_seconds: int = 60,
    ) -> Optional[ImportJob]:
        """Atomically claim an import job for worker execution.

        Conditions for a successful claim:
        - Job is not in a terminal state (COMPLETED, PARTIAL, FAILED, CANCELLED)
        - Job has no current worker, OR is already assigned to this worker,
          OR the previous worker's heartbeat expired (stuck worker crash recovery).
        """
        now_utc = datetime.now(timezone.utc)
        stale_cutoff = now_utc - timedelta(seconds=stale_heartbeat_seconds)

        stmt = select(ImportJob).where(
            ImportJob.id == job_id,
            ImportJob.status.not_in([
                ImportJobStatus.COMPLETED.value,
                ImportJobStatus.PARTIAL.value,
                ImportJobStatus.FAILED.value,
                ImportJobStatus.CANCELLED.value,
            ]),
            or_(
                ImportJob.worker_id.is_(None),
                ImportJob.worker_id == worker_id,
                ImportJob.last_heartbeat_at < stale_cutoff,
            ),
        ).with_for_update()

        res = await db.execute(stmt)
        job = res.scalar_one_or_none()
        if not job:
            return None

        # Check if cancellation was already requested before worker picked it up
        if job.cancel_requested_at:
            job.status = ImportJobStatus.CANCELLED.value
            job.completed_at = now_utc
            job.error_summary = "Job cancelled prior to worker execution."
            job.updated_at = now_utc
            await db.commit()
            return None

        job.worker_id = worker_id
        job.last_heartbeat_at = now_utc
        if not job.started_at:
            job.started_at = now_utc
        job.updated_at = now_utc

        await db.commit()
        await db.refresh(job)
        return job

    async def update_heartbeat(
        self,
        db: AsyncSession,
        job_id: str,
        worker_id: str,
    ) -> bool:
        """Update heartbeat timestamp for an active claimed job."""
        now_utc = datetime.now(timezone.utc)
        stmt = (
            update(ImportJob)
            .where(
                ImportJob.id == job_id,
                ImportJob.worker_id == worker_id,
                ImportJob.status.not_in([
                    ImportJobStatus.COMPLETED.value,
                    ImportJobStatus.PARTIAL.value,
                    ImportJobStatus.FAILED.value,
                    ImportJobStatus.CANCELLED.value,
                ]),
            )
            .values({
                ImportJob.last_heartbeat_at: now_utc,
                ImportJob.updated_at: now_utc,
            })
        )
        res = await db.execute(stmt)
        await db.commit()
        rowcount = getattr(res, "rowcount", 0)
        return bool(rowcount and rowcount > 0)

    # =========================================================================
    # 6. Centralized State Machine Validation & Stage Transition
    # =========================================================================

    async def transition_job(
        self,
        db: AsyncSession,
        job_id: str,
        next_status: ImportJobStatus,
        next_stage: Optional[ImportJobStage] = None,
        processed_rows: Optional[int] = None,
        failed_rows: Optional[int] = None,
        row_count: Optional[int] = None,
        error_summary: Optional[str] = None,
        error_details: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        schema_fingerprint: Optional[str] = None,
    ) -> ImportJob:
        """Enforce valid state machine transitions and update progress metrics.

        Raises ValueError if an illegal state transition is attempted.
        """
        stmt = select(ImportJob).where(ImportJob.id == job_id)
        res = await db.execute(stmt)
        job = res.scalar_one_or_none()
        if not job:
            raise ValueError(f"Import job '{job_id}' not found.")

        current_status = ImportJobStatus(job.status)

        # Validate transition if changing status
        if next_status != current_status:
            allowed = VALID_JOB_TRANSITIONS.get(current_status, set())
            if next_status not in allowed:
                raise ValueError(
                    f"Illegal state transition: Cannot transition from {current_status.value} to {next_status.value}."
                )

        now_utc = datetime.now(timezone.utc)
        job.status = next_status.value
        if next_stage:
            job.current_stage = next_stage.value

        if row_count is not None:
            job.row_count = row_count
        if processed_rows is not None:
            job.processed_rows = processed_rows
        if failed_rows is not None:
            job.failed_rows = failed_rows

        # Calculate weighted multi-stage progress percent
        if next_status in {ImportJobStatus.COMPLETED, ImportJobStatus.PARTIAL}:
            job.progress_percent = 100.0
        elif next_status == ImportJobStatus.PROJECTING or (next_stage and next_stage.value == ImportJobStage.PROJECTING.value):
            job.progress_percent = 92.0
        elif next_status == ImportJobStatus.IMPORTING or (next_stage and next_stage.value == ImportJobStage.IMPORTING.value):
            ratio = (job.processed_rows / job.row_count) if (job.row_count and job.row_count > 0) else 0.5
            job.progress_percent = min(90.0, round(70.0 + (20.0 * ratio), 1))
        elif next_status == ImportJobStatus.VALIDATING or (next_stage and next_stage.value == ImportJobStage.VALIDATING.value):
            ratio = (job.processed_rows / job.row_count) if (job.row_count and job.row_count > 0) else 0.5
            job.progress_percent = min(70.0, round(50.0 + (20.0 * ratio), 1))
        elif next_status == ImportJobStatus.MAPPING or (next_stage and next_stage.value == ImportJobStage.MAPPING.value):
            job.progress_percent = 40.0
        elif next_status == ImportJobStatus.SCHEMA_DETECTION or (next_stage and next_stage.value == ImportJobStage.SCHEMA_DETECTION.value):
            job.progress_percent = 25.0
        elif next_status == ImportJobStatus.PARSING or (next_stage and next_stage.value == ImportJobStage.PARSING.value):
            job.progress_percent = 15.0
        elif next_status in {ImportJobStatus.UPLOADED, ImportJobStatus.UPLOADING}:
            job.progress_percent = 5.0
        elif job.row_count and job.row_count > 0:
            job.progress_percent = min(100.0, round((job.processed_rows / job.row_count) * 100.0, 2))

        if error_summary:
            job.error_summary = error_summary
        if error_details:
            job.error_details_json = json.dumps(error_details)
        if metadata:
            current_meta = json.loads(job.metadata_json) if job.metadata_json else {}
            current_meta.update(metadata)
            job.metadata_json = json.dumps(current_meta)

        if schema_fingerprint and job.source_id:
            from app.models.knowledge import KnowledgeSource
            stmt_source = select(KnowledgeSource).where(KnowledgeSource.id == job.source_id)
            res_source = await db.execute(stmt_source)
            source = res_source.scalar_one_or_none()
            if source:
                source.schema_fingerprint = schema_fingerprint
                source.updated_at = now_utc

        # Mark completion timestamp if terminal
        if next_status in {
            ImportJobStatus.COMPLETED,
            ImportJobStatus.PARTIAL,
            ImportJobStatus.FAILED,
            ImportJobStatus.CANCELLED,
        }:
            job.completed_at = now_utc

        job.updated_at = now_utc
        job.last_heartbeat_at = now_utc

        await db.commit()

        # Update real-time Redis cache so client polling avoids remote DB queries
        try:
            dto = self._build_dto(job)
            ttl = 60 if next_status in {
                ImportJobStatus.COMPLETED,
                ImportJobStatus.PARTIAL,
                ImportJobStatus.FAILED,
                ImportJobStatus.CANCELLED,
            } else 300
            await redis_manager.client.set(
                f"proxipilot:import_job:{job.tenant_id}:{job.id}",
                dto.model_dump_json(),
                ex=ttl,
            )
        except Exception:
            pass

        return job

    async def get_import_job_resilient(
        self,
        session_factory,
        tenant_id: str,
        job_id: str,
        max_attempts: int = 4,
        base_delay_seconds: float = 0.5,
    ) -> "ImportJobResponseDTO":
        """get_import_job on a fresh session per attempt, retrying transient DB / pool errors.

        Workers read the job between stages; on a slow, lossy link a single dropped
        connection or pool-checkout timeout used to mark an import FAILED although every
        row had already been saved and indexed.
        """
        import asyncio

        from app.services.knowledge_persistence import _is_transient_db_error

        for attempt in range(1, max_attempts + 1):
            try:
                async with session_factory() as db:
                    return await self.get_import_job(db=db, tenant_id=tenant_id, job_id=job_id)
            except Exception as err:
                if attempt < max_attempts and _is_transient_db_error(err):
                    logger.warning("Import job read retry", job_id=job_id, attempt=attempt, error=str(err)[:200])
                    await asyncio.sleep(base_delay_seconds * (2 ** (attempt - 1)))
                    continue
                raise
        raise RuntimeError("unreachable")

    async def transition_job_resilient(
        self,
        session_factory,
        job_id: str,
        max_attempts: int = 4,
        base_delay_seconds: float = 0.5,
        **kwargs: Any,
    ) -> ImportJob:
        """transition_job on a fresh session per attempt, retrying transient DB errors.

        Job bookkeeping writes are tiny but happen many times per import; on a
        high-latency / lossy link to a serverless pooler a single dropped connection
        ("connection was closed in the middle of operation") used to mark an otherwise
        successful import as FAILED. Transitions are idempotent, so retrying is safe.
        Illegal state transitions (ValueError) are never retried.
        """
        import asyncio

        from app.services.knowledge_persistence import _is_transient_db_error

        for attempt in range(1, max_attempts + 1):
            try:
                async with session_factory() as db:
                    try:
                        return await self.transition_job(db=db, job_id=job_id, **kwargs)
                    except Exception:
                        try:
                            await db.rollback()
                        except Exception:
                            pass
                        raise
            except ValueError:
                raise
            except Exception as err:
                if attempt < max_attempts and _is_transient_db_error(err):
                    logger.warning(
                        "Import job transition retry",
                        job_id=job_id,
                        attempt=attempt,
                        error=str(err)[:200],
                    )
                    await asyncio.sleep(base_delay_seconds * (2 ** (attempt - 1)))
                    continue
                raise
        raise RuntimeError("unreachable")

    # =========================================================================
    # 7. Stuck Job Recovery Scanner
    # =========================================================================

    # A job is only considered abandoned after this many seconds without a heartbeat.
    # Workers heartbeat every 5s, so 90s tolerates long GC pauses, slow remote DB
    # round trips and event-loop stalls without hijacking a job that is still alive.
    STUCK_JOB_STALE_SECONDS = 90
    # Unclaimed (UPLOADED/CREATED) jobs are re-published at most once per this window.
    UNCLAIMED_REPUBLISH_SECONDS = 60

    @staticmethod
    def job_lock_key(job_id: str) -> str:
        """Redis key of the per-job distributed lock held by the executing worker."""
        return f"lock:import_job:{job_id}"

    async def _is_job_lock_held(self, job_id: str) -> bool:
        """True if a live worker still holds the job's Redis lock (positive liveness signal)."""
        try:
            return bool(await redis_manager.client.exists(self.job_lock_key(job_id)))
        except Exception:
            # Redis unavailable: fall back to heartbeat-only staleness judgement.
            return False

    @staticmethod
    def _build_requeue_event(job: ImportJob) -> DomainEvent:
        return DomainEvent(
            event_type="knowledge.import.requested",
            tenant_id=job.tenant_id,
            aggregate_type="import_job",
            aggregate_id=job.id,
            payload={
                "job_id": job.id,
                "source_id": job.source_id,
                "dataset_name": job.dataset_name,
                "file_type": job.file_type,
                "file_uri": job.file_uri,
                "file_size_bytes": job.file_size_bytes,
                "idempotency_key": job.idempotency_key,
            },
        )

    async def recover_stuck_jobs(
        self,
        db: AsyncSession,
        stale_threshold_seconds: int = STUCK_JOB_STALE_SECONDS,
    ) -> List[str]:
        """Identify genuinely abandoned jobs and requeue (or fail) them.

        Safety rules (root cause of the "job recovered while still importing" bug):
        - A job is abandoned only if its heartbeat is older than the threshold AND no
          worker holds its Redis job lock. A busy-but-alive worker is never touched.
        - Recovered jobs are reset to UPLOADED (a state the worker pipeline can legally
          restart from) and an event is re-published. Previously the scanner forced
          status=PARSING while the job was IMPORTING, which made the next legal
          transition fail and the job crash at the end of the import.
        - Rows are locked with SKIP LOCKED so the scanner never blocks a worker's
          own progress writes on the same row.
        - Unclaimed jobs are re-published at most once per UNCLAIMED_REPUBLISH_SECONDS
          (based on updated_at), not on every 15s scan.
        """
        now_utc = datetime.now(timezone.utc)
        stale_cutoff = now_utc - timedelta(seconds=stale_threshold_seconds)

        active_in_flight_states = [
            ImportJobStatus.PARSING.value,
            ImportJobStatus.SCHEMA_DETECTION.value,
            ImportJobStatus.MAPPING.value,
            ImportJobStatus.VALIDATING.value,
            ImportJobStatus.IMPORTING.value,
            ImportJobStatus.PROJECTING.value,
        ]

        stmt = select(ImportJob).where(
            ImportJob.status.in_(active_in_flight_states),
            ImportJob.last_heartbeat_at < stale_cutoff,
        ).with_for_update(skip_locked=True)

        res = await db.execute(stmt)
        stuck_jobs = list(res.scalars().all())
        recovered_ids: List[str] = []
        to_republish: List[ImportJob] = []

        for job in stuck_jobs:
            if await self._is_job_lock_held(job.id):
                # Worker is alive (lock renewed by its heartbeat) — just slow. Leave it.
                continue

            if job.retry_count >= job.max_retries:
                job.status = ImportJobStatus.FAILED.value
                job.error_summary = (
                    f"Job failed: Worker '{job.worker_id}' abandoned job and exceeded max retries."
                )
                job.completed_at = now_utc
            else:
                job.retry_count += 1
                job.worker_id = None
                job.status = ImportJobStatus.UPLOADED.value
                job.current_stage = ImportJobStage.UPLOADED.value
                job.error_summary = (
                    f"Re-enqueued by recovery scanner (retry {job.retry_count}/{job.max_retries})."
                )
                to_republish.append(job)

            job.updated_at = now_utc
            recovered_ids.append(job.id)

        # Unassigned UPLOADED / CREATED jobs whose event was lost (e.g. Redis publish failed).
        republish_cutoff = now_utc - timedelta(seconds=self.UNCLAIMED_REPUBLISH_SECONDS)
        stmt_unclaimed = select(ImportJob).where(
            ImportJob.status.in_([ImportJobStatus.UPLOADED.value, ImportJobStatus.CREATED.value]),
            ImportJob.worker_id.is_(None),
            ImportJob.updated_at < republish_cutoff,
        ).with_for_update(skip_locked=True)
        res_unclaimed = await db.execute(stmt_unclaimed)
        recovered_set = set(recovered_ids)
        for u_job in res_unclaimed.scalars().all():
            if u_job.id in recovered_set or await self._is_job_lock_held(u_job.id):
                continue
            u_job.updated_at = now_utc
            to_republish.append(u_job)
            recovered_ids.append(u_job.id)

        if not recovered_ids:
            # Release row locks taken by the SELECT ... FOR UPDATE.
            await db.rollback()
            return recovered_ids

        # Commit state BEFORE publishing so a worker that receives the event can claim it.
        await db.commit()

        for job in to_republish:
            try:
                await event_bus.publish(KNOWLEDGE_IMPORT_STREAM, self._build_requeue_event(job))
            except Exception as pub_err:
                logger.warning("Failed to republish recovered job", job_id=job.id, error=str(pub_err))
            try:
                await redis_manager.client.delete(f"proxipilot:import_job:{job.tenant_id}:{job.id}")
            except Exception:
                pass

        logger.warning(
            "Stuck job recovery scanner completed",
            recovered_count=len(recovered_ids),
            job_ids=recovered_ids,
        )
        return recovered_ids

    # =========================================================================
    # 8. Internal Helpers
    # =========================================================================

    def _build_dto(self, job: ImportJob) -> ImportJobResponseDTO:
        meta_dict = None
        if job.metadata_json:
            try:
                meta_dict = json.loads(job.metadata_json)
            except Exception:
                meta_dict = None

        err_dict = None
        if job.error_details_json:
            try:
                err_dict = json.loads(job.error_details_json)
            except Exception:
                err_dict = None

        return ImportJobResponseDTO(
            id=job.id,
            organization_id=job.tenant_id,
            source_id=job.source_id,
            dataset_name=job.dataset_name,
            file_type=job.file_type,
            file_size_bytes=job.file_size_bytes,
            file_uri=job.file_uri,
            idempotency_key=job.idempotency_key,
            status=job.status,
            current_stage=job.current_stage,
            row_count=job.row_count,
            processed_rows=job.processed_rows,
            failed_rows=job.failed_rows,
            progress_percent=float(job.progress_percent),
            worker_id=job.worker_id,
            last_heartbeat_at=job.last_heartbeat_at,
            retry_count=job.retry_count,
            max_retries=job.max_retries,
            started_at=job.started_at,
            completed_at=job.completed_at,
            cancel_requested_at=job.cancel_requested_at,
            created_at=job.created_at,
            updated_at=job.updated_at,
            error_summary=job.error_summary,
            error_details=err_dict,
            metadata=meta_dict,
            created_by_user_id=job.created_by_user_id,
        )


knowledge_import_service = KnowledgeImportService()
