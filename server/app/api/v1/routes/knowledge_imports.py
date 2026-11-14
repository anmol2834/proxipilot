"""Knowledge Import Routes — Phase 8.0.

REST endpoints for asynchronous knowledge base dataset imports:
- POST /api/v1/knowledge/imports            (Initiate async import job)
- GET  /api/v1/knowledge/imports            (List import jobs with keyset cursor pagination)
- GET  /api/v1/knowledge/imports/{job_id}   (Inspect job status, stage, progress, errors)
- POST /api/v1/knowledge/imports/{job_id}/cancel (Request cooperative job cancellation)
"""

from typing import Optional
from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.contracts.knowledge_import import (
    FileUploadResponseDTO,
    ImportJobCancelDTO,
    ImportJobCreateDTO,
    ImportJobCursorPageDTO,
    ImportJobResponseDTO,
)
from app.core.context import TenantContext, require_permission
from app.core.database import get_db
from app.services.knowledge_import import knowledge_import_service
from app.services.knowledge_upload import knowledge_upload_service
from app.services.storage_cleanup import storage_cleanup_service


router = APIRouter(prefix="/knowledge/imports", tags=["Knowledge Imports"])


@router.post(
    "/upload",
    response_model=FileUploadResponseDTO,
    status_code=status.HTTP_201_CREATED,
    summary="Secure knowledge file upload and tenant-safe storage",
    description="Streams, validates (extension, MIME, magic bytes), hashes (SHA-256), isolates storage by tenant, detects duplicates, and stages for background import.",
)
async def upload_knowledge_file(
    request: Request,
    file: UploadFile = File(..., description="Uploaded CSV, XLS, or XLSX file"),
    dataset_name: Optional[str] = Form(default=None, description="Logical dataset name (auto-derived if omitted)"),
    category: Optional[str] = Form(default=None, description="Knowledge category (e.g. products_services, support_faqs, policies)"),
    source_id: Optional[str] = Form(default=None, description="Optional existing KnowledgeSource ID"),
    idempotency_key: Optional[str] = Form(default=None, description="Optional idempotency key"),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(require_permission("knowledge.create")),
) -> FileUploadResponseDTO:
    """Stream and store file safely without blocking or unbounded memory allocations."""
    client_ip = request.client.host if request.client else None
    correlation_id = getattr(request.state, "request_id", None)

    return await knowledge_upload_service.handle_upload(
        db=db,
        tenant_id=tenant_ctx.organization_id,
        user_id=tenant_ctx.user_id,
        file=file,
        dataset_name=dataset_name,
        category=category,
        source_id=source_id,
        idempotency_key=idempotency_key,
        correlation_id=correlation_id,
        client_ip=client_ip,
    )


@router.post(
    "/cleanup",
    status_code=status.HTTP_200_OK,
    summary="Trigger stale temporary uploads cleanup",
    description="Purges abandoned .uploading temporary directories older than the configured threshold.",
)
async def cleanup_stale_uploads(
    max_age_seconds: Optional[int] = Query(default=None, description="Custom age threshold in seconds"),
    tenant_ctx: TenantContext = Depends(require_permission("knowledge.delete")),
):
    """Clean up stale unfinalized uploads."""
    cleaned = await storage_cleanup_service.cleanup_stale_uploads(max_age_seconds=max_age_seconds)
    return {"cleaned_count": cleaned, "status": "completed"}


@router.post(
    "",
    response_model=ImportJobResponseDTO,
    status_code=status.HTTP_201_CREATED,
    summary="Initiate an asynchronous knowledge import job",
    description="Registers a durable ImportJob in PostgreSQL, publishes a compact domain event to Redis Streams, and returns immediately without blocking.",
)
async def create_import_job(
    payload: ImportJobCreateDTO,
    request: Request,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(require_permission("knowledge.create")),
) -> ImportJobResponseDTO:
    """Non-blocking HTTP endpoint to initiate a multi-stage background import."""
    client_ip = request.client.host if request.client else None
    correlation_id = getattr(request.state, "request_id", None)

    job_dto, _ = await knowledge_import_service.create_import_job(
        db=db,
        tenant_id=tenant_ctx.organization_id,
        user_id=tenant_ctx.user_id,
        payload=payload,
        correlation_id=correlation_id,
        client_ip=client_ip,
    )
    return job_dto


@router.get(
    "",
    response_model=ImportJobCursorPageDTO,
    summary="List knowledge import jobs",
    description="Fetch tenant-scoped import jobs with stable zero-OFFSET keyset cursor pagination.",
)
async def list_import_jobs(
    cursor: Optional[str] = Query(default=None, description="Opaque pagination cursor"),
    limit: int = Query(default=20, ge=1, le=100, description="Items per page (max 100)"),
    status: Optional[str] = Query(default=None, description="Filter by status (created, parsing, completed, etc.)"),
    source_id: Optional[str] = Query(default=None, description="Filter by source ID"),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(require_permission("knowledge.read")),
) -> ImportJobCursorPageDTO:
    """List import jobs with tenant isolation."""
    return await knowledge_import_service.list_import_jobs(
        db=db,
        tenant_id=tenant_ctx.organization_id,
        cursor=cursor,
        limit=limit,
        status_filter=status,
        source_id=source_id,
    )


@router.get(
    "/{job_id}",
    response_model=ImportJobResponseDTO,
    summary="Get import job progress and status",
    description="Inspect current stage, processed rows, progress percentage, and error summary.",
)
async def get_import_job(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(require_permission("knowledge.read")),
) -> ImportJobResponseDTO:
    """Fetch job status strictly within tenant boundary."""
    return await knowledge_import_service.get_import_job(
        db=db,
        tenant_id=tenant_ctx.organization_id,
        job_id=job_id,
    )


@router.post(
    "/{job_id}/cancel",
    response_model=ImportJobResponseDTO,
    summary="Cancel an active import job",
    description="Sets the cooperative cancellation flag. The worker will cleanly stop at the nearest stage checkpoint.",
)
async def cancel_import_job(
    job_id: str,
    payload: Optional[ImportJobCancelDTO] = None,
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(require_permission("knowledge.update")),
) -> ImportJobResponseDTO:
    """Cancel import job execution cooperatively."""
    client_ip = request.client.host if request and request.client else None
    return await knowledge_import_service.request_cancellation(
        db=db,
        tenant_id=tenant_ctx.organization_id,
        user_id=tenant_ctx.user_id,
        job_id=job_id,
        payload=payload,
        client_ip=client_ip,
    )
