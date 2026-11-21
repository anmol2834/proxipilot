"""Knowledge File Upload Service — Phase 8.1.

Handles secure multi-tenant file ingest, validation, streaming SHA-256 calculation,
tenant-scoped storage, duplicate detection, and Phase 8.0 ImportJob handoff.
"""

import asyncio
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from typing import Optional
import uuid
from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.contracts.knowledge_import import FileUploadResponseDTO
from app.core.config import get_settings
from app.core.file_validation import (
    FileValidationError,
    detect_and_validate_file_type,
    secure_filename,
)
from app.core.logging import logger
from app.core.messaging import DomainEvent, event_bus
from app.core.storage import get_storage_provider
from app.models.audit import AuditAction
from app.models.knowledge import (
    ImportJob,
    ImportJobStage,
    ImportJobStatus,
    KnowledgeSource,
    KnowledgeSourceStatus,
    KnowledgeSourceType,
    SourceAuthorityLevel,
)
from app.services.audit import audit_service


# Stream identifier for Knowledge Import jobs
KNOWLEDGE_IMPORT_STREAM = "knowledge_import_events"

# 256 KB streaming chunk size (fast streaming throughput with bounded memory)
CHUNK_SIZE_BYTES = 256 * 1024


class KnowledgeUploadService:
    """Enterprise domain service for secure file ingest and tenant-safe storage."""

    async def handle_upload(
        self,
        db: AsyncSession,
        tenant_id: str,
        user_id: Optional[str],
        file: UploadFile,
        dataset_name: Optional[str] = None,
        category: Optional[str] = None,
        source_id: Optional[str] = None,
        idempotency_key: Optional[str] = None,
        correlation_id: Optional[str] = None,
        client_ip: Optional[str] = None,
    ) -> FileUploadResponseDTO:
        """Stream, hash, validate, store, and enqueue uploaded knowledge file.

        Invariants:
        - Bounded streaming chunks: Never reads entire file into memory.
        - Enforces max upload size during streaming: Immediately aborts on breach.
        - Multi-layer validation: Extension, MIME, and binary container magic bytes.
        - Tenant-isolated storage path: Key derived strictly from authenticated tenant_id.
        - Single-pass SHA-256: Hash computed concurrently during upload stream.
        - Tenant-scoped duplicate detection: Indexed lookup prevents duplicate ingestion.
        - Emits AuditAction.KNOWLEDGE_FILE_UPLOADED or KNOWLEDGE_FILE_REJECTED atomically.
        """
        # Reject an unknown or retired category up front (e.g. "contacts" from a stale browser tab):
        # silently importing it as Products & Services would misfile the customer's data.
        if category:
            from app.contracts.knowledge import KnowledgeInvalidCategoryError, normalize_category_key
            try:
                canonical = normalize_category_key(category)
            except KnowledgeInvalidCategoryError as exc:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
            # Company Info is a structured, ownership-aware record edited in Knowledge → Company Info.
            # New file imports into it are refused (already-accepted jobs finish unchanged).
            if canonical == "company_info":
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Company Info can't be imported from a file. Edit it in Knowledge → Company Info.",
                )
        settings = get_settings()
        max_size_bytes = settings.storage.knowledge_max_upload_size_bytes
        now_utc = datetime.now(timezone.utc)

        # 1. Sanitize file name and derive default dataset name
        safe_name = secure_filename(file.filename)
        if not dataset_name or not dataset_name.strip():
            derived_stem = Path(safe_name).stem.replace("_", " ").replace("-", " ")
            clean_dataset_name = derived_stem.title() or "Uploaded Dataset"
        else:
            clean_dataset_name = dataset_name.strip()

        # 2. Generate unique immutable upload identity
        upload_id = f"upl_{uuid.uuid4().hex}"
        tentative_source_id = source_id or f"ks_{uuid.uuid4().hex}"

        # 3. Validate existing KnowledgeSource if provided (Anti-Spoofing / IDOR defense)
        existing_source: Optional[KnowledgeSource] = None
        if source_id:
            src_stmt = select(KnowledgeSource).where(
                KnowledgeSource.id == source_id,
                KnowledgeSource.tenant_id == tenant_id,
            )
            existing_source = (await db.execute(src_stmt)).scalar_one_or_none()
            if not existing_source:
                await audit_service.record(
                    db=db,
                    action=AuditAction.KNOWLEDGE_FILE_REJECTED,
                    resource_type="knowledge_source",
                    resource_id=source_id,
                    organization_id=tenant_id,
                    actor_user_id=user_id,
                    metadata={"reason": "KnowledgeSource not found for tenant", "ip_address": client_ip},
                )
                await db.commit()
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Knowledge source '{source_id}' not found for this organization.",
                )

        # 4. Initialize storage upload session (.uploading/ staging)
        storage = get_storage_provider()
        session = await storage.create_upload_session(
            tenant_id=tenant_id,
            source_id=tentative_source_id,
            upload_id=upload_id,
            safe_filename=safe_name,
        )

        hasher = hashlib.sha256()
        total_bytes = 0
        header_chunk = b""

        try:
            # 5. Stream chunks into storage and hasher simultaneously
            while True:
                chunk = await file.read(CHUNK_SIZE_BYTES)
                if not chunk:
                    break

                total_bytes += len(chunk)

                # Size constraint check (early abort)
                if total_bytes > max_size_bytes:
                    await session.abort()
                    await audit_service.record(
                        db=db,
                        action=AuditAction.KNOWLEDGE_FILE_REJECTED,
                        resource_type="knowledge_file",
                        resource_id=upload_id,
                        organization_id=tenant_id,
                        actor_user_id=user_id,
                        metadata={
                            "reason": f"File size {total_bytes} exceeds limit {max_size_bytes}",
                            "file_name": safe_name,
                            "ip_address": client_ip,
                        },
                    )
                    await db.commit()
                    raise HTTPException(
                        status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                        detail=f"File exceeds maximum allowed size of {max_size_bytes} bytes ({max_size_bytes // (1024 * 1024)} MB).",
                    )

                hasher.update(chunk)

                if len(header_chunk) < 8192:
                    header_chunk += chunk[: 8192 - len(header_chunk)]

                await session.write_chunk(chunk)

            # 6. Verify non-empty file
            if total_bytes == 0:
                await session.abort()
                await audit_service.record(
                    db=db,
                    action=AuditAction.KNOWLEDGE_FILE_REJECTED,
                    resource_type="knowledge_file",
                    resource_id=upload_id,
                    organization_id=tenant_id,
                    actor_user_id=user_id,
                    metadata={"reason": "Empty file (0 bytes)", "file_name": safe_name, "ip_address": client_ip},
                )
                await db.commit()
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Uploaded file is empty (0 bytes).",
                )

            # 7. Content signature and container validation (anti-spoofing)
            try:
                canonical_type, mime_type = detect_and_validate_file_type(
                    header_chunk=header_chunk,
                    filename=safe_name,
                    declared_content_type=file.content_type,
                )
            except FileValidationError as val_err:
                await session.abort()
                await audit_service.record(
                    db=db,
                    action=AuditAction.KNOWLEDGE_FILE_REJECTED,
                    resource_type="knowledge_file",
                    resource_id=upload_id,
                    organization_id=tenant_id,
                    actor_user_id=user_id,
                    metadata={"reason": str(val_err), "file_name": safe_name, "ip_address": client_ip},
                )
                await db.commit()
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=str(val_err),
                )

            checksum = hasher.hexdigest()

            # 8. Tenant-Safe Duplicate Detection (Indexed on tenant_id, checksum)
            dup_stmt = select(KnowledgeSource).where(
                KnowledgeSource.tenant_id == tenant_id,
                KnowledgeSource.checksum == checksum,
                KnowledgeSource.status == KnowledgeSourceStatus.ACTIVE.value,
            )
            dup_source = (await db.execute(dup_stmt)).scalar_one_or_none()

            if dup_source:
                # Find latest ImportJob for this source
                job_stmt = (
                    select(ImportJob)
                    .where(
                        ImportJob.tenant_id == tenant_id,
                        ImportJob.source_id == dup_source.id,
                    )
                    .order_by(ImportJob.created_at.desc())
                )
                dup_job = (await db.execute(job_stmt)).scalars().first()

                in_flight_statuses = {
                    ImportJobStatus.UPLOADED.value,
                    ImportJobStatus.PARSING.value,
                    ImportJobStatus.SCHEMA_DETECTION.value,
                    ImportJobStatus.MAPPING.value,
                    ImportJobStatus.VALIDATING.value,
                    ImportJobStatus.IMPORTING.value,
                    ImportJobStatus.PROJECTING.value,
                }

                # If an import job is actively in-flight right now, return it so client tracks it
                if dup_job and dup_job.status in in_flight_statuses:
                    await session.abort()
                    logger.info(
                        "Active import job already in-flight for duplicate file upload",
                        tenant_id=tenant_id,
                        source_id=dup_source.id,
                        job_id=dup_job.id,
                        status=dup_job.status,
                    )
                    return FileUploadResponseDTO(
                        upload_id=upload_id,
                        source_id=dup_source.id,
                        job_id=dup_job.id,
                        dataset_name=dup_source.dataset_name or clean_dataset_name,
                        file_name=safe_name,
                        file_type=canonical_type,
                        file_size_bytes=total_bytes,
                        checksum=checksum,
                        checksum_algorithm="sha256",
                        status="duplicate",
                        is_duplicate=True,
                        created_at=dup_source.created_at,
                    )

                # Otherwise (previous job failed, cancelled, completed, or none exists):
                # The user is re-uploading or retrying. Create and queue a fresh ImportJob.
                has_stored_file = (
                    await storage.file_exists(dup_source.origin_uri)
                    if dup_source.origin_uri
                    else False
                )
                if has_stored_file:
                    await session.abort()
                    final_file_uri = dup_source.origin_uri
                else:
                    final_file_uri = await session.finalize()
                    dup_source.origin_uri = final_file_uri

                source = dup_source
                source.updated_at = now_utc
                if clean_dataset_name:
                    source.dataset_name = clean_dataset_name
                    source.name = f"Import: {clean_dataset_name}"
            else:
                # 9. Atomic Finalization: Promote from .uploading/ to permanent key
                final_file_uri = await session.finalize()

                # 10. Persist KnowledgeSource (Provenance & Lineage)
                if existing_source:
                    source = existing_source
                    source.checksum = checksum
                    source.origin_uri = final_file_uri
                    source.file_name = safe_name
                    source.updated_at = now_utc
                else:
                    source_type = KnowledgeSourceType.CSV.value if canonical_type == "csv" else KnowledgeSourceType.XLSX.value
                    source = KnowledgeSource(
                        id=tentative_source_id,
                        tenant_id=tenant_id,
                        source_type=source_type,
                        name=f"Import: {clean_dataset_name}",
                        authority_level=SourceAuthorityLevel.IMPORTED_DATA.value,
                        status=KnowledgeSourceStatus.ACTIVE.value,
                        dataset_name=clean_dataset_name,
                        file_name=safe_name,
                        checksum=checksum,
                        origin_uri=final_file_uri,
                        metadata_json=json.dumps({
                            "upload_id": upload_id,
                            "file_size_bytes": total_bytes,
                            "mime_type": mime_type,
                        }),
                        created_by_user_id=user_id,
                        created_at=now_utc,
                        updated_at=now_utc,
                    )
                    db.add(source)

            # 11. Create Durable ImportJob
            from app.contracts.knowledge import normalize_category_key
            try:
                clean_category = normalize_category_key(category) if category else "products_services"
            except Exception:
                clean_category = "products_services"
            job_id = f"ij_{uuid.uuid4().hex}"
            job = ImportJob(
                id=job_id,
                tenant_id=tenant_id,
                source_id=source.id,
                dataset_name=clean_dataset_name,
                file_type=canonical_type,
                file_size_bytes=total_bytes,
                file_uri=final_file_uri,
                idempotency_key=idempotency_key,
                status=ImportJobStatus.UPLOADED.value,
                current_stage=ImportJobStage.UPLOADED.value,
                row_count=None,
                processed_rows=0,
                failed_rows=0,
                progress_percent=0.00,
                retry_count=0,
                max_retries=3,
                metadata_json=json.dumps({
                    "upload_id": upload_id,
                    "category": clean_category,
                    "original_filename": file.filename,
                    "safe_filename": safe_name,
                    "content_type": mime_type,
                    "checksum": checksum,
                    "checksum_algorithm": "sha256",
                }),
                created_by_user_id=user_id,
                created_at=now_utc,
                updated_at=now_utc,
            )
            db.add(job)

            # 12. Record Audit Event
            await audit_service.record(
                db=db,
                action=AuditAction.KNOWLEDGE_FILE_UPLOADED,
                resource_type="knowledge_file",
                resource_id=upload_id,
                organization_id=tenant_id,
                actor_user_id=user_id,
                metadata={
                    "upload_id": upload_id,
                    "source_id": source.id,
                    "job_id": job.id,
                    "file_name": safe_name,
                    "category": clean_category,
                    "file_type": canonical_type,
                    "file_size_bytes": total_bytes,
                    "checksum": checksum,
                    "ip_address": client_ip,
                },
            )

            # expire_on_commit=False keeps all attributes loaded, so no refresh round trip.
            await db.commit()

            # Pre-warm the status cache and publish the job event concurrently: both are
            # remote Redis round trips and neither depends on the other.
            from app.core.redis import redis_manager
            from app.services.knowledge_import import knowledge_import_service

            initial_dto = knowledge_import_service._build_dto(job)
            event = DomainEvent(
                event_type="knowledge.import.requested",
                tenant_id=tenant_id,
                aggregate_type="import_job",
                aggregate_id=job.id,
                correlation_id=correlation_id,
                payload={
                    "job_id": job.id,
                    "source_id": source.id,
                    "upload_id": upload_id,
                    "dataset_name": job.dataset_name,
                    "category": clean_category,
                    "file_type": job.file_type,
                    "file_uri": job.file_uri,
                    "file_size_bytes": job.file_size_bytes,
                    "checksum": checksum,
                    "idempotency_key": job.idempotency_key,
                },
            )
            cache_res, publish_res = await asyncio.gather(
                redis_manager.client.set(
                    f"proxipilot:import_job:{tenant_id}:{job.id}",
                    initial_dto.model_dump_json(),
                    ex=300,
                ),
                event_bus.publish(KNOWLEDGE_IMPORT_STREAM, event),
                return_exceptions=True,
            )
            if isinstance(publish_res, BaseException):
                # Invariant: Job is durably registered in PostgreSQL; the recovery
                # scanner republishes unclaimed UPLOADED jobs.
                logger.error(
                    "Failed to publish knowledge.import.requested to Redis Streams",
                    job_id=job.id,
                    error=str(publish_res),
                )
            else:
                logger.info(
                    "Published knowledge.import.requested event after upload",
                    stream=KNOWLEDGE_IMPORT_STREAM,
                    message_id=publish_res,
                    job_id=job.id,
                    tenant_id=tenant_id,
                )

            return FileUploadResponseDTO(
                upload_id=upload_id,
                source_id=source.id,
                job_id=job.id,
                dataset_name=job.dataset_name,
                file_name=safe_name,
                file_type=canonical_type,
                file_size_bytes=total_bytes,
                checksum=checksum,
                checksum_algorithm="sha256",
                status="uploaded",
                is_duplicate=False,
                created_at=job.created_at,
            )

        except (HTTPException, FileValidationError):
            raise
        except Exception as exc:
            # Clean up temporary staging file on unexpected runtime error
            await session.abort()
            logger.error("Unexpected error during file upload", error=str(exc))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred while processing the file upload.",
            ) from exc


# Global singleton instance
knowledge_upload_service = KnowledgeUploadService()
