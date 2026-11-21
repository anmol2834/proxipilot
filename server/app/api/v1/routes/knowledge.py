"""Knowledge Taxonomy, Category Schemas & Custom Attributes API Routes.

Endpoints:
- GET  /api/v1/knowledge/categories: List all 6 canonical category definitions and field contracts.
- GET  /api/v1/knowledge/categories/{category_key}: Get schema definition for a specific category.
- GET  /api/v1/knowledge/categories/{category_key}/custom-attributes: List tenant-scoped custom attribute definitions.
- POST /api/v1/knowledge/categories/{category_key}/custom-attributes: Create a tenant-scoped custom attribute definition (OWNER/ADMIN).
- POST /api/v1/knowledge/validate: Validate candidate record against canonical schema and tenant custom definitions.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.contracts.knowledge import (
    CategorySummaryDTO,
    CustomAttributeCreateDTO,
    CustomAttributeResponseDTO,
    ValidateRecordRequestDTO,
    ValidateRecordResponseDTO,
)
from app.contracts.flexible_schema import (
    CompilePlanRequestDTO,
    CompilePlanResponseDTO,
    FieldMappingDTO,
    NormalizedRecordPreviewDTO,
    NormalizePreviewRequestDTO,
    NormalizePreviewResponseDTO,
    RowValidationErrorDTO,
    SchemaDetectRequestDTO,
    SchemaDetectResponseDTO,
    SchemaProfileCreateDTO,
    SchemaProfileResponseDTO,
)
from app.contracts.company_info import CompanyInfoUpdateRequest
from app.contracts.knowledge_crud import (
    KnowledgeCursorPageDTO,
    KnowledgeItemCreateDTO,
    KnowledgeItemResponseDTO,
    KnowledgeItemUpdateDTO,
    KnowledgeVersionHistoryDTO,
)
from app.contracts.version_diff import (
    PublishVersionRequestDTO,
    RollbackRequestDTO,
    VersionDiffDTO,
)
from app.core.context import TenantContext, get_tenant_context, require_permission
from app.core.database import get_db
from app.contracts.rag import (
    HybridRetrievalRequestDTO,
    HybridRetrievalResponseDTO,
)
from app.models.organization import SystemRole
from app.services.flexible_schema import flexible_schema_engine
from app.services.hybrid_retrieval import hybrid_retrieval_service
from app.services.knowledge import knowledge_service
from app.services.knowledge_crud import knowledge_crud_service

router = APIRouter(prefix="/knowledge", tags=["Knowledge Base & Taxonomy"])


@router.get(
    "/categories",
    response_model=List[CategorySummaryDTO],
    summary="List all canonical knowledge categories",
    description="Returns schema definitions, canonical fields, and validation rules for all 6 frozen knowledge categories.",
)
async def list_categories() -> List[CategorySummaryDTO]:
    """Publicly inspectable schema definitions for the 6 knowledge categories."""
    return knowledge_service.list_categories()


@router.get(
    "/categories/{category_key}",
    response_model=CategorySummaryDTO,
    summary="Get canonical schema for a category",
    description="Returns canonical fields, validation rules, and temporal/regional capabilities for a category.",
)
async def get_category(category_key: str) -> CategorySummaryDTO:
    """Retrieve schema metadata for a specific category key."""
    return knowledge_service.get_category(category_key)


@router.get(
    "/categories/{category_key}/custom-attributes",
    response_model=List[CustomAttributeResponseDTO],
    summary="List tenant-scoped custom attributes for a category",
    description="Returns all custom attributes defined by the current organization for this category.",
)
async def list_custom_attributes(
    category_key: str,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context),
) -> List[CustomAttributeResponseDTO]:
    """Strictly tenant-scoped list of custom attribute definitions."""
    return await knowledge_service.list_custom_attributes(
        db=db,
        tenant_id=tenant_context.organization_id,
        category_key=category_key,
    )


@router.post(
    "/categories/{category_key}/custom-attributes",
    response_model=CustomAttributeResponseDTO,
    status_code=status.HTTP_201_CREATED,
    summary="Define a custom attribute for a category",
    description="Registers a strongly-typed custom attribute definition for the calling organization (OWNER or ADMIN only).",
)
async def create_custom_attribute(
    category_key: str,
    payload: CustomAttributeCreateDTO,
    request: Request,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context),
) -> CustomAttributeResponseDTO:
    """Create a tenant-scoped custom attribute definition."""
    # RBAC Enforcement: Only OWNER or ADMIN may define organization-level schemas
    if tenant_context.role_name not in {SystemRole.OWNER.value, SystemRole.ADMIN.value}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Organization Owners and Admins can define custom attribute schemas.",
        )

    client_ip = request.client.host if request.client else None
    return await knowledge_service.create_custom_attribute(
        db=db,
        tenant_id=tenant_context.organization_id,
        user_id=tenant_context.user_id,
        category_key=category_key,
        payload=payload,
        client_ip=client_ip,
    )


@router.post(
    "/validate",
    response_model=ValidateRecordResponseDTO,
    summary="Validate a candidate knowledge record",
    description="Checks candidate data against category canonical rules and organization custom attributes.",
)
async def validate_record(
    payload: ValidateRecordRequestDTO,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context),
) -> ValidateRecordResponseDTO:
    """Deterministic validation endpoint for UI authoring forms and Phase 8 import mapping."""
    return await knowledge_service.validate_record(
        db=db,
        tenant_id=tenant_context.organization_id,
        category_key=payload.category,
        data=payload.data,
        strict_custom=payload.strict_custom,
    )


# =============================================================================
# Phase 7.2 Flexible Schema Normalization & Mapping Routes
# =============================================================================


@router.post(
    "/schema/detect",
    response_model=SchemaDetectResponseDTO,
    summary="Detect field mappings from dataset column headers",
    description="Maps source headers to canonical category fields or organization custom attributes with confidence scoring.",
)
async def detect_schema(
    payload: SchemaDetectRequestDTO,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context),
) -> SchemaDetectResponseDTO:
    """Propose deterministic field mappings from raw column headers."""
    custom_attrs = await knowledge_service.list_custom_attributes(
        db=db,
        tenant_id=tenant_context.organization_id,
        category_key=payload.category,
    )
    custom_defs = {ca.key: ca for ca in custom_attrs}

    return flexible_schema_engine.detect_schema(
        tenant_id=tenant_context.organization_id,
        category_key=payload.category,
        source_columns=payload.source_columns,
        custom_definitions=custom_defs,
        sample_rows=payload.sample_rows,
    )


@router.post(
    "/schema/compile",
    response_model=CompilePlanResponseDTO,
    summary="Compile approved schema mappings into an immutable plan",
    description="Pre-binds transformations, validators, and null semantics into an in-memory execution plan.",
)
async def compile_schema_plan(
    payload: CompilePlanRequestDTO,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context),
) -> CompilePlanResponseDTO:
    """Compile approved field mappings into an execution plan."""
    custom_attrs = await knowledge_service.list_custom_attributes(
        db=db,
        tenant_id=tenant_context.organization_id,
        category_key=payload.category,
    )
    custom_defs = {ca.key: ca for ca in custom_attrs}

    plan = flexible_schema_engine.compile_plan(
        tenant_id=tenant_context.organization_id,
        category_key=payload.category,
        mappings=payload.mappings,
        custom_definitions=custom_defs,
    )

    return CompilePlanResponseDTO(
        tenant_id=plan.tenant_id,
        category=plan.category,
        schema_fingerprint=plan.schema_fingerprint,
        is_executable=plan.is_executable(),
        canonical_fields_count=len(plan.canonical_mappings),
        custom_attributes_count=len(plan.custom_mappings),
        unmapped_count=len(plan.unmapped_columns),
        missing_required_canonical=plan.required_canonical_missing,
        missing_required_custom=plan.required_custom_missing,
    )


@router.post(
    "/schema/normalize-preview",
    response_model=NormalizePreviewResponseDTO,
    summary="Preview batch normalization on sample rows",
    description="Executes compiled plan locally across sample rows, returning normalized canonical & custom fields and errors.",
)
async def normalize_preview(
    payload: NormalizePreviewRequestDTO,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context),
) -> NormalizePreviewResponseDTO:
    """Execute preview normalization over sample rows."""
    custom_attrs = await knowledge_service.list_custom_attributes(
        db=db,
        tenant_id=tenant_context.organization_id,
        category_key=payload.category,
    )
    custom_defs = {ca.key: ca for ca in custom_attrs}

    plan = flexible_schema_engine.compile_plan(
        tenant_id=tenant_context.organization_id,
        category_key=payload.category,
        mappings=payload.mappings,
        custom_definitions=custom_defs,
    )

    batch_res = flexible_schema_engine.normalize_batch(
        rows=payload.sample_rows,
        plan=plan,
    )

    preview_records = []
    for r in batch_res.normalized_records:
        preview_records.append(
            NormalizedRecordPreviewDTO(
                row_index=r.row_index,
                is_valid=r.is_valid,
                canonical_data=r.canonical_data,
                custom_attributes=r.custom_attributes,
                errors=[
                    RowValidationErrorDTO(
                        row_index=e.row_index,
                        field=e.field,
                        source_field=e.source_field,
                        error_code=e.error_code,
                        message=e.message,
                        severity=e.severity.value,
                    )
                    for e in r.errors
                ],
                warnings=[
                    RowValidationErrorDTO(
                        row_index=w.row_index,
                        field=w.field,
                        source_field=w.source_field,
                        error_code=w.error_code,
                        message=w.message,
                        severity=w.severity.value,
                    )
                    for w in r.warnings
                ],
            )
        )

    return NormalizePreviewResponseDTO(
        total_rows=batch_res.total_rows,
        valid_rows_count=batch_res.valid_rows_count,
        error_rows_count=batch_res.error_rows_count,
        records=preview_records,
    )


@router.post(
    "/schema/profiles",
    response_model=SchemaProfileResponseDTO,
    status_code=status.HTTP_201_CREATED,
    summary="Save a reusable schema mapping profile",
    description="Stores approved field mapping specification for recurring imports (OWNER or ADMIN).",
)
async def save_schema_profile(
    payload: SchemaProfileCreateDTO,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context),
) -> SchemaProfileResponseDTO:
    """Persist reusable schema profile."""
    if tenant_context.role_name not in {SystemRole.OWNER.value, SystemRole.ADMIN.value}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Organization Owners and Admins can save schema profiles.",
        )

    return await flexible_schema_engine.save_profile(
        db=db,
        tenant_id=tenant_context.organization_id,
        user_id=tenant_context.user_id,
        payload=payload,
    )


@router.get(
    "/schema/profiles",
    response_model=List[SchemaProfileResponseDTO],
    summary="List saved schema mapping profiles",
    description="Returns all active schema mapping profiles defined by the organization.",
)
async def list_schema_profiles(
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context),
) -> List[SchemaProfileResponseDTO]:
    """List tenant-scoped schema profiles."""
    return await flexible_schema_engine.list_profiles(
        db=db,
        tenant_id=tenant_context.organization_id,
        category_key=category,
    )


@router.get(
    "/schema/profiles/{profile_id}",
    response_model=SchemaProfileResponseDTO,
    summary="Get a specific schema mapping profile",
    description="Retrieves a single schema mapping profile strictly within tenant boundary.",
)
async def get_schema_profile(
    profile_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context),
) -> SchemaProfileResponseDTO:
    """Fetch schema profile strictly by tenant boundary."""
    return await flexible_schema_engine.get_profile(
        db=db,
        tenant_id=tenant_context.organization_id,
        profile_id=profile_id,
    )


# =============================================================================
# Phase 7.3 Knowledge CRUD, Keyset Pagination, and Versioning Endpoints
# =============================================================================


@router.post(
    "",
    response_model=KnowledgeItemResponseDTO,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new knowledge item",
    description="Registers a new knowledge item and initial version snapshot, validated against canonical category schemas.",
)
async def create_knowledge_item(
    payload: KnowledgeItemCreateDTO,
    request: Request,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(require_permission("knowledge.create")),
) -> KnowledgeItemResponseDTO:
    """Create a new knowledge entry within the calling tenant."""
    client_ip = request.client.host if request.client else None
    return await knowledge_crud_service.create_item(
        db=db,
        tenant_id=tenant_context.organization_id,
        user_id=tenant_context.user_id,
        payload=payload,
        client_ip=client_ip,
    )


# =============================================================================
# Company Info — structured editor (registration-backed facts + Company-Info-owned facts)
# =============================================================================


@router.get(
    "/company-info",
    summary="Company Info editor state",
    description="Shared facts (with their owner and share flag), Company-Info-owned facts, what the email AI "
                "can share, and the indexing state of the saved revision.",
)
async def get_company_info(
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(require_permission("knowledge.read")),
) -> Dict[str, Any]:
    from app.services import company_info

    return await company_info.get_state(db, tenant_context.organization_id, tenant_context.permissions)


@router.put(
    "/company-info",
    summary="Save Company Info (partial, revision-checked)",
    description="Only the sent keys change. A stale `revision` returns 409 with the current state so the "
                "editor can refresh and reapply. Shared facts are written to their owners.",
)
async def save_company_info(
    payload: CompanyInfoUpdateRequest,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(require_permission("knowledge.read")),
) -> Dict[str, Any]:
    from app.services import company_info

    try:
        return await company_info.save(db, tenant_context.organization_id, tenant_context.user_id, payload,
                                       tenant_context.permissions)
    except ValueError as exc:      # merged facts failed validation
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.get(
    "/stats",
    summary="Get tenant knowledge category statistics",
    description="Returns aggregate item counts per category for the calling organization.",
)
async def get_knowledge_stats(
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(require_permission("knowledge.read")),
) -> Dict[str, int]:
    """Lightweight aggregate counts for category cards."""
    return await knowledge_crud_service.get_category_counts(
        db=db,
        tenant_id=tenant_context.organization_id,
    )


@router.get(
    "",
    response_model=KnowledgeCursorPageDTO,
    summary="List knowledge items in batches with keyset cursor pagination or page offset",
    description="Returns knowledge items filtered by category, status, or search query using batch pagination, keyset cursor pagination, or point-in-time active resolution with as_of.",
)
async def list_knowledge_items(
    category: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: Optional[int] = Query(default=1, ge=1, description="Page number for batch pagination (1-indexed)"),
    limit: int = Query(default=10, ge=1, le=100, description="Batch size per page"),
    cursor: Optional[str] = None,
    sort: str = "updated-desc",
    as_of: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(require_permission("knowledge.read")),
) -> KnowledgeCursorPageDTO:
    """List knowledge items for calling tenant with batch pagination or canonical temporal resolution."""
    return await knowledge_crud_service.list_items(
        db=db,
        tenant_id=tenant_context.organization_id,
        category=category,
        status_filter=status,
        search=search,
        limit=limit,
        page=page,
        cursor=cursor,
        sort=sort,
        as_of=as_of,
    )


@router.get(
    "/{id}",
    response_model=KnowledgeItemResponseDTO,
    summary="Get knowledge item by ID",
    description="Retrieves a specific knowledge item and its active version facts strictly within tenant boundary, optionally point-in-time with as_of.",
)
async def get_knowledge_item(
    id: str,
    as_of: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(require_permission("knowledge.read")),
) -> KnowledgeItemResponseDTO:
    """Retrieve single knowledge item with IDOR protection."""
    return await knowledge_crud_service.get_item(
        db=db,
        tenant_id=tenant_context.organization_id,
        item_id=id,
        as_of=as_of,
    )


@router.patch(
    "/{id}",
    response_model=KnowledgeItemResponseDTO,
    summary="Update knowledge item",
    description="Updates knowledge item by creating a new immutable version snapshot, preserving historical version lineage.",
)
async def update_knowledge_item(
    id: str,
    payload: KnowledgeItemUpdateDTO,
    request: Request,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(require_permission("knowledge.update")),
) -> KnowledgeItemResponseDTO:
    """Update knowledge item by creating a new version snapshot."""
    client_ip = request.client.host if request.client else None
    return await knowledge_crud_service.update_item(
        db=db,
        tenant_id=tenant_context.organization_id,
        user_id=tenant_context.user_id,
        item_id=id,
        payload=payload,
        client_ip=client_ip,
    )


@router.delete(
    "/{id}",
    summary="Archive or delete knowledge item",
    description="Soft-archives (default) or hard-deletes a knowledge item strictly within tenant boundary.",
)
async def delete_knowledge_item(
    id: str,
    request: Request,
    hard_delete: bool = False,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(require_permission("knowledge.delete")),
) -> Dict[str, Any]:
    """Archive or delete knowledge item."""
    client_ip = request.client.host if request and request.client else None
    return await knowledge_crud_service.archive_item(
        db=db,
        tenant_id=tenant_context.organization_id,
        user_id=tenant_context.user_id,
        item_id=id,
        hard_delete=hard_delete,
        client_ip=client_ip,
    )


@router.get(
    "/{id}/versions",
    response_model=List[KnowledgeVersionHistoryDTO],
    summary="Get immutable version history for a knowledge item",
    description="Returns all version snapshots and historical change summaries for a knowledge item.",
)
async def get_knowledge_version_history(
    id: str,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(require_permission("knowledge.read")),
) -> List[KnowledgeVersionHistoryDTO]:
    """Retrieve version history snapshots strictly within tenant boundary."""
    return await knowledge_crud_service.get_version_history(
        db=db,
        tenant_id=tenant_context.organization_id,
        item_id=id,
    )


@router.get(
    "/{id}/versions/{version_number}",
    response_model=KnowledgeItemResponseDTO,
    summary="Get a specific version snapshot of a knowledge item",
    description="Retrieves the exact facts and content of a historical version snapshot.",
)
async def get_knowledge_version(
    id: str,
    version_number: int,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(require_permission("knowledge.read")),
) -> KnowledgeItemResponseDTO:
    """Retrieve specific version snapshot strictly within tenant boundary."""
    return await knowledge_crud_service.get_version(
        db=db,
        tenant_id=tenant_context.organization_id,
        item_id=id,
        version_number=version_number,
    )


@router.get(
    "/{id}/versions/{version_number}/diff",
    response_model=VersionDiffDTO,
    summary="Compute field-level diff between versions",
    description="Computes deterministic field diff between version_number and compare_to (defaults to version_number - 1).",
)
async def get_knowledge_version_diff(
    id: str,
    version_number: int,
    compare_to: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(require_permission("knowledge.read")),
) -> VersionDiffDTO:
    """Get field-level differences between two versions."""
    return await knowledge_crud_service.get_version_diff(
        db=db,
        tenant_id=tenant_context.organization_id,
        item_id=id,
        version_number=version_number,
        compare_to=compare_to,
    )


@router.post(
    "/{id}/publish",
    response_model=KnowledgeItemResponseDTO,
    summary="Publish a version to active state",
    description="Transitions a draft version to active state with lifecycle state machine validation and old active archiving.",
)
async def publish_knowledge_version(
    id: str,
    payload: PublishVersionRequestDTO,
    request: Request,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(require_permission("knowledge.update")),
) -> KnowledgeItemResponseDTO:
    """Publish a version to become the current active version."""
    client_ip = request.client.host if request.client else None
    return await knowledge_crud_service.publish_version(
        db=db,
        tenant_id=tenant_context.organization_id,
        user_id=tenant_context.user_id,
        item_id=id,
        version_number=payload.version_number,
        client_ip=client_ip,
    )


@router.post(
    "/{id}/rollback",
    response_model=KnowledgeItemResponseDTO,
    summary="Rollback knowledge item to a historical version",
    description="Creates a new monotonic version mirroring the target historical snapshot (Approach B rollback).",
)
async def rollback_knowledge_version(
    id: str,
    payload: RollbackRequestDTO,
    request: Request,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(require_permission("knowledge.update")),
) -> KnowledgeItemResponseDTO:
    """Rollback knowledge item to a previous version."""
    client_ip = request.client.host if request.client else None
    return await knowledge_crud_service.rollback_to_version(
        db=db,
        tenant_id=tenant_context.organization_id,
        user_id=tenant_context.user_id,
        item_id=id,
        target_version_number=payload.target_version_number,
        reason=payload.reason,
        client_ip=client_ip,
    )


@router.post(
    "/retrieve",
    response_model=HybridRetrievalResponseDTO,
    summary="Execute hybrid retrieval and authoritative fact verification",
    description="Combines Qdrant vector semantic search with PostgreSQL canonical fact re-hydration and requirement coverage validation.",
)
async def retrieve_verified_knowledge(
    payload: HybridRetrievalRequestDTO,
    db: AsyncSession = Depends(get_db),
    tenant_context: TenantContext = Depends(require_permission("knowledge.read")),
) -> HybridRetrievalResponseDTO:
    """Execute hybrid retrieval with authoritative fact verification."""
    return await hybrid_retrieval_service.retrieve_and_verify(
        db=db,
        tenant_id=tenant_context.organization_id,
        request=payload,
    )



