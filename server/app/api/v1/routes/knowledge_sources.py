"""Knowledge Source Lineage & Provenance Routes — Phase 7.4.

REST endpoints providing enterprise provenance, lifecycle, and authority tracking:
- POST   /api/v1/knowledge/sources          (Register/Deduplicate source)
- GET    /api/v1/knowledge/sources          (List sources with keyset cursor pagination)
- GET    /api/v1/knowledge/sources/{id}     (Get source metadata)
- PATCH  /api/v1/knowledge/sources/{id}     (Update source metadata/status)
- DELETE /api/v1/knowledge/sources/{id}     (Archive or revoke source)
- GET    /api/v1/knowledge/sources/{id}/lineage (Trace source -> items & versions)
"""

from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.contracts.knowledge_source import (
    KnowledgeSourceCreateDTO,
    KnowledgeSourceCursorPageDTO,
    KnowledgeSourceLineageDTO,
    KnowledgeSourceResponseDTO,
    KnowledgeSourceUpdateDTO,
)
from app.core.context import TenantContext, require_permission
from app.core.database import get_db
from app.services.knowledge_source import knowledge_source_service


router = APIRouter(prefix="/knowledge/sources", tags=["Knowledge Sources"])


@router.post(
    "",
    response_model=KnowledgeSourceResponseDTO,
    status_code=status.HTTP_201_CREATED,
    summary="Create or deduplicate a knowledge source",
    description="Registers a new knowledge source or reuses an existing active source by cryptographic checksum or reference.",
)
async def create_knowledge_source(
    payload: KnowledgeSourceCreateDTO,
    request: Request,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(require_permission("knowledge.create")),
) -> KnowledgeSourceResponseDTO:
    """Create a new knowledge source or deduplicate against existing active sources."""
    client_ip = request.client.host if request.client else None
    dto, _ = await knowledge_source_service.create_or_deduplicate_source(
        db=db,
        tenant_id=tenant_context.organization_id,
        user_id=tenant_context.user_id,
        payload=payload,
        client_ip=client_ip,
    )
    return dto


@router.get(
    "",
    response_model=KnowledgeSourceCursorPageDTO,
    status_code=status.HTTP_200_OK,
    summary="List knowledge sources with keyset pagination",
    description="Returns an indexed page of knowledge sources ordered by (created_at DESC, id DESC) with zero OFFSET.",
)
async def list_knowledge_sources(
    cursor: Optional[str] = Query(None, description="Opaque base64 keyset cursor"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    source_type: Optional[str] = Query(None, description="Filter by source type (manual, csv, xlsx, etc.)"),
    status: Optional[str] = Query(None, description="Filter by status (active, inactive, archived, revoked)"),
    authority_level: Optional[str] = Query(None, description="Filter by authority tier"),
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(require_permission("knowledge.read")),
) -> KnowledgeSourceCursorPageDTO:
    """List tenant-isolated knowledge sources."""
    return await knowledge_source_service.list_sources(
        db=db,
        tenant_id=tenant_context.organization_id,
        cursor=cursor,
        limit=limit,
        source_type=source_type,
        source_status=status,
        authority_level=authority_level,
    )


@router.get(
    "/{source_id}",
    response_model=KnowledgeSourceResponseDTO,
    status_code=status.HTTP_200_OK,
    summary="Get knowledge source details",
    description="Retrieves a single knowledge source strictly within tenant isolation boundary.",
)
async def get_knowledge_source(
    source_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(require_permission("knowledge.read")),
) -> KnowledgeSourceResponseDTO:
    """Retrieve details of a knowledge source."""
    return await knowledge_source_service.get_source(
        db=db,
        tenant_id=tenant_context.organization_id,
        source_id=source_id,
    )


@router.patch(
    "/{source_id}",
    response_model=KnowledgeSourceResponseDTO,
    status_code=status.HTTP_200_OK,
    summary="Update knowledge source",
    description="Updates mutable metadata, validity dates, or status of a knowledge source.",
)
async def update_knowledge_source(
    source_id: str,
    payload: KnowledgeSourceUpdateDTO,
    request: Request,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(require_permission("knowledge.update")),
) -> KnowledgeSourceResponseDTO:
    """Update metadata of a knowledge source."""
    client_ip = request.client.host if request.client else None
    return await knowledge_source_service.update_source(
        db=db,
        tenant_id=tenant_context.organization_id,
        user_id=tenant_context.user_id,
        source_id=source_id,
        payload=payload,
        client_ip=client_ip,
    )


@router.delete(
    "/{source_id}",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="Archive or revoke knowledge source",
    description="Soft-archives or revokes a knowledge source, preserving all historical version lineage.",
)
async def delete_knowledge_source(
    source_id: str,
    request: Request,
    revoke: bool = Query(False, description="Set True to mark as REVOKED instead of ARCHIVED"),
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(require_permission("knowledge.delete")),
) -> Dict[str, Any]:
    """Archive or revoke a knowledge source."""
    client_ip = request.client.host if request.client else None
    return await knowledge_source_service.archive_source(
        db=db,
        tenant_id=tenant_context.organization_id,
        user_id=tenant_context.user_id,
        source_id=source_id,
        revoke=revoke,
        client_ip=client_ip,
    )


@router.get(
    "/{source_id}/lineage",
    response_model=KnowledgeSourceLineageDTO,
    status_code=status.HTTP_200_OK,
    summary="Get source lineage tree",
    description="Traces all KnowledgeItems and KnowledgeVersions originating from this source.",
)
async def get_knowledge_source_lineage(
    source_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(require_permission("knowledge.read")),
) -> KnowledgeSourceLineageDTO:
    """Get full provenance and lineage tree for a source."""
    return await knowledge_source_service.get_source_lineage(
        db=db,
        tenant_id=tenant_context.organization_id,
        source_id=source_id,
    )
