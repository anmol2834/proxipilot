"""Phase 7.3 — Knowledge CRUD, Keyset Pagination, and Tenant-Scoped Versioning Service.

Encapsulates:
- Create, Read, List, Update, and Archive operations for business knowledge
- Keyset cursor pagination (updated_at DESC, id DESC) with zero OFFSET
- Immutable version snapshot preservation on every update
- Strict multi-tenant boundaries (IDOR prevention)
- Comprehensive audit trail recording
- Full UI contract formatting for client/src/types/knowledge.types.ts
"""

from datetime import datetime, timezone
from decimal import Decimal
import json
import math
from typing import Any, Dict, List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.contracts.events import EventNames
from app.contracts.knowledge import (
    AttributeValueType,
    KnowledgeInvalidCategoryError,
    category_registry,
    normalize_category_key,
)
from app.contracts.knowledge_crud import (
    KnowledgeCursorPageDTO,
    KnowledgeItemCreateDTO,
    KnowledgeItemResponseDTO,
    KnowledgeVersionHistoryDTO,
    decode_cursor,
    encode_cursor,
)
from app.contracts.version_diff import FieldDiffDTO, VersionDiffDTO
from app.core.logging import logger
from app.core.messaging import DomainEvent, event_bus
from app.models.audit import AuditAction
from app.models.knowledge import (
    KnowledgeAttributeDefinition,
    KnowledgeCategory,
    KnowledgeItem,
    KnowledgeLifecycleStatus,
    KnowledgeSource,
    KnowledgeSourceType,
    KnowledgeVersion,
    SourceAuthorityLevel,
)
from app.services.audit import audit_service
from app.services.knowledge_read_contract import (
    CanonicalKnowledgeReader,
    compute_temporal_status,
    normalize_utc_timestamp,
)
from app.services.version_diff import VersionDiffEngine

# Valid entity types for the products_services category (mirrors the category registry).
_PRODUCT_ENTITY_TYPES = {"PRODUCT", "SERVICE", "PACKAGE", "PLAN", "PART", "RAW_MATERIAL", "ACCESSORY"}


def _manual_identity_key(tenant_id: str, category: str, val_result: Any) -> Optional[str]:
    """Stored identity key for a manually created record, or None when it has no real identity
    (a record with no content at all has no identity)."""
    from app.algorithms.deduplication.category_identity import CategoryIdentityResolver
    from app.services.knowledge_persistence import _strip_identity_key

    full_key = CategoryIdentityResolver.resolve_identity_key(
        tenant_id=tenant_id,
        category=category,
        canonical_data=dict(val_result.cleaned_canonical_data or {}),
        custom_attributes=dict(val_result.cleaned_custom_attributes or {}),
        row_number=None,
    )
    key = _strip_identity_key(full_key)
    if not key or key == "fp:empty" or key.startswith("row:"):
        return None
    return key[:512]


def _reject_managed_company_info(item: KnowledgeItem) -> None:
    """The registration-backed Company Info item is edited only through the Company Info editor
    (its facts are owned by the organization / business profile). Generic edits, version
    publish/rollback, archive and delete would bypass that ownership and could reintroduce an
    outdated value, so they are refused."""
    from app.services.company_info import is_managed

    if is_managed(item):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Company Info is edited in Knowledge → Company Info. Use that editor to change or hide these facts.",
        )


def _products_entity_type(ui_type: Optional[str]) -> str:
    """Map the UI 'type' label to a valid products_services entity type.

    The create DTO defaults ``type`` to "Information" (a label used by other categories), and
    clients may send labels such as "Offer". Those are not product entity types, so instead of
    failing validation for an otherwise valid product we fall back to PRODUCT.
    """
    key = "_".join((ui_type or "").strip().upper().replace("-", " ").split())
    return key if key in _PRODUCT_ENTITY_TYPES else "PRODUCT"


class KnowledgeCRUDService:
    """Enterprise domain service for Knowledge Base CRUD and lifecycle management."""

    # =========================================================================
    # 1. Create Knowledge Item
    # =========================================================================

    async def create_item(
        self,
        db: AsyncSession,
        tenant_id: str,
        user_id: str,
        payload: KnowledgeItemCreateDTO,
        client_ip: Optional[str] = None,
    ) -> KnowledgeItemResponseDTO:
        """Create a new KnowledgeItem and its authoritative Version 1 snapshot."""
        # 1. Validate temporal dates
        try:
            payload.validate_temporal_dates()
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

        # 2. Validate category
        try:
            canonical_cat = normalize_category_key(payload.category)
        except KnowledgeInvalidCategoryError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

        if canonical_cat == "company_info":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Company Info is managed in Knowledge → Company Info. Add or change these facts there.",
            )

        # 3. Fetch tenant custom attribute definitions
        stmt = select(KnowledgeAttributeDefinition).where(
            KnowledgeAttributeDefinition.tenant_id == tenant_id,
            KnowledgeAttributeDefinition.category == canonical_cat,
        )
        res = await db.execute(stmt)
        custom_attrs = res.scalars().all()
        custom_defs = {
            ca.key: type(
                "CustDef",
                (),
                {
                    "is_required": ca.is_required,
                    "value_type": ca.value_type,
                    "allowed_values": json.loads(ca.allowed_values_json) if ca.allowed_values_json else None,
                },
            )()
            for ca in custom_attrs
        }

        # 4. Assemble record fields for validation
        record_data: Dict[str, Any] = dict(payload.canonical_data or {})
        if payload.custom_attributes:
            record_data.update(payload.custom_attributes)

        # Merge direct convenience UI properties if not already in canonical_data
        if payload.pricing and "price" not in record_data:
            record_data["price"] = payload.pricing
        if payload.currency and "currency" not in record_data:
            record_data["currency"] = payload.currency
        if payload.warranty and "warranty" not in record_data:
            record_data["warranty"] = payload.warranty
        if payload.serviceRegions and "region" not in record_data:
            record_data["region"] = payload.serviceRegions
        if payload.email and "email" not in record_data:
            record_data["email"] = payload.email
        if payload.phone and "phone" not in record_data:
            record_data["phone"] = payload.phone
        if payload.role and "role_title" not in record_data:
            record_data["role_title"] = payload.role
        if payload.conditions and "terms_conditions" not in record_data:
            record_data["terms_conditions"] = payload.conditions
        if payload.question and "question" not in record_data:
            record_data["question"] = payload.question
        if payload.answer and "answer" not in record_data:
            record_data["answer"] = payload.answer
        if payload.discount and "discount_value" not in record_data:
            record_data["discount_value"] = payload.discount
        if payload.code:
            # A "code" means different things per category: a product's SKU, an offer's discount code.
            code_field = {"products_services": "sku", "offers_promotions": "discount_code"}.get(canonical_cat, "code")
            record_data.setdefault(code_field, payload.code)
        if payload.city and "city" not in record_data:
            record_data["city"] = payload.city
        if "name" not in record_data:
            record_data["name"] = payload.title.strip()
        if "entity_type" not in record_data and canonical_cat == "products_services":
            record_data["entity_type"] = _products_entity_type(payload.type)

        # 5. Validate through canonical category registry
        val_result = category_registry.validate_record(
            category=canonical_cat,
            record=record_data,
            custom_definitions=custom_defs,
            strict_custom=False,
        )
        if not val_result.is_valid:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"message": "Knowledge validation failed", "errors": val_result.errors},
            )

        # 5b. Identity: the same deterministic key an import would give this record (SKU / code /
        # name + variant / policy name ...). One item per real-world thing, whichever path adds it:
        # an existing item is refused here, and a later import of the same record updates this one.
        identity_key = _manual_identity_key(tenant_id, canonical_cat, val_result)
        if identity_key:
            dup = (await db.execute(
                select(KnowledgeItem.id).where(
                    KnowledgeItem.tenant_id == tenant_id,
                    KnowledgeItem.category == canonical_cat,
                    KnowledgeItem.external_identity_key == identity_key,
                ).limit(1)
            )).scalar_one_or_none()
            if dup:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={"message": "This item already exists in your knowledge. Re-import your file "
                                       "to update it.", "existing_item_id": dup},
                )

        # 6. Resolve KnowledgeSource with strict tenant verification
        if payload.source_id:
            src_stmt = select(KnowledgeSource).where(
                KnowledgeSource.id == payload.source_id,
                KnowledgeSource.tenant_id == tenant_id,
            )
            src_res = await db.execute(src_stmt)
            source = src_res.scalar_one_or_none()
            if not source:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Knowledge source '{payload.source_id}' not found for this organization.",
                )
        else:
            from app.services.knowledge_source import knowledge_source_service
            source = await knowledge_source_service.ensure_default_manual_source(db, tenant_id, user_id)

        # 7. Create KnowledgeItem
        tags_json = json.dumps(payload.tags) if payload.tags else None
        item = KnowledgeItem(
            tenant_id=tenant_id,
            title=payload.title.strip(),
            category=canonical_cat,
            description=payload.description or (payload.content[:250] if payload.content else None),
            source_id=source.id,
            source_type=source.source_type,
            tags=tags_json,
            is_active=True,
            created_by_user_id=user_id,
            external_identity_key=identity_key,
        )
        db.add(item)
        await db.flush()

        # 8. Create initial KnowledgeVersion (v1)
        now_utc = datetime.now(timezone.utc)
        status_val = KnowledgeLifecycleStatus.ACTIVE.value
        if payload.status and payload.status.lower() in {"draft", "drafts"}:
            status_val = KnowledgeLifecycleStatus.DRAFT.value

        canonical_dict = dict(val_result.cleaned_canonical_data)
        if val_result.cleaned_custom_attributes:
            canonical_dict["custom_attributes"] = dict(val_result.cleaned_custom_attributes)

        auth_level = payload.authority_level or source.authority_level or SourceAuthorityLevel.MANUAL.value
        version = KnowledgeVersion(
            tenant_id=tenant_id,
            knowledge_item_id=item.id,
            version_number=1,
            status=status_val,
            source_id=source.id,
            authority_level=auth_level,
            content_text=payload.content or payload.description,
            change_summary="Initial version creation",
            canonical_data=canonical_dict,
            projection_status="pending",
            semantic_status="pending",
            published_at=now_utc if status_val == KnowledgeLifecycleStatus.ACTIVE.value else None,
            effective_from=payload.effective_from or now_utc,
            effective_until=payload.effective_until,
            created_by_user_id=user_id,
        )
        db.add(version)
        await db.flush()

        # Link item to current version
        item.current_version_id = version.id

        # 9. Version and item persistence complete (authoritative canonical_data stored on KnowledgeVersion)
        await db.commit()
        await db.refresh(item)

        # 10. Audit event
        await audit_service.record(
            db=db,
            action=AuditAction.KNOWLEDGE_CREATED,
            resource_type="knowledge_item",
            resource_id=item.id,
            organization_id=tenant_id,
            actor_user_id=user_id,
            metadata={
                "category": canonical_cat,
                "title": item.title,
                "version": 1,
                "source": item.source_type,
                "actor": user_id,
                "ip_address": client_ip,
            },
        )
        await self._finalize_change(db, tenant_id, item.id, "created", version.id, item=item, version=version)

        return self._format_response(
            item=item,
            version=version,
            canonical_data=val_result.cleaned_canonical_data,
            custom_attributes=val_result.cleaned_custom_attributes,
            ui_type=payload.type or "Information",
        )

    # =========================================================================
    # 2. Get Knowledge Item by ID
    # =========================================================================

    async def get_item(
        self,
        db: AsyncSession,
        tenant_id: str,
        item_id: str,
        as_of: Optional[datetime] = None,
    ) -> KnowledgeItemResponseDTO:
        """Fetch a specific knowledge item strictly scoped to tenant, optionally at a point-in-time."""
        if as_of is not None:
            resolved = await CanonicalKnowledgeReader.get_current_item_version(
                db=db,
                tenant_id=tenant_id,
                item_id=item_id,
                as_of=as_of,
            )
            if not resolved:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Knowledge item '{item_id}' has no active version effective as of {as_of.isoformat()}.",
                )
            item, current_version = resolved
            canonical_data, custom_attrs = self._extract_attributes_from_version(current_version, item.category)
            return self._format_response(
                item=item,
                version=current_version,
                canonical_data=canonical_data,
                custom_attributes=custom_attrs,
            )

        stmt = (
            select(KnowledgeItem)
            .where(
                KnowledgeItem.id == item_id,
                KnowledgeItem.tenant_id == tenant_id,
            )
            .options(
                selectinload(KnowledgeItem.versions),
                selectinload(KnowledgeItem.source),
            )
        )
        res = await db.execute(stmt)
        item = res.scalar_one_or_none()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Knowledge item '{item_id}' not found.",
            )

        # Find current version
        current_version = None
        if item.current_version_id and item.versions:
            current_version = next((v for v in item.versions if v.id == item.current_version_id), None)
        if not current_version and item.versions:
            current_version = max(item.versions, key=lambda v: v.version_number)

        canonical_data, custom_attrs = self._extract_attributes_from_version(current_version, item.category)

        return self._format_response(
            item=item,
            version=current_version,
            canonical_data=canonical_data,
            custom_attributes=custom_attrs,
        )

    # =========================================================================
    # 3. Keyset Cursor-Paginated List & Search (Zero OFFSET)
    # =========================================================================

    async def list_items(
        self,
        db: AsyncSession,
        tenant_id: str,
        category: Optional[str] = None,
        status_filter: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 10,
        page: Optional[int] = None,
        cursor: Optional[str] = None,
        sort: str = "updated-desc",
        as_of: Optional[datetime] = None,
    ) -> KnowledgeCursorPageDTO:
        """List knowledge items in batches using keyset cursor pagination, page offset, or point-in-time temporal resolution."""
        if as_of is not None:
            norm_cat = None
            if category and category.lower() != "all":
                try:
                    norm_cat = normalize_category_key(category)
                except KnowledgeInvalidCategoryError:
                    return KnowledgeCursorPageDTO(items=[], next_cursor=None, has_more=False, total_count=0, page=1, page_size=limit, total_pages=0)

            pairs = await CanonicalKnowledgeReader.get_current_knowledge(
                db=db,
                tenant_id=tenant_id,
                category=norm_cat,
                as_of=as_of,
                limit=limit,
                offset=((page - 1) * limit) if (page and page > 1) else 0,
            )
            items_dto = []
            for it, cur_ver in pairs:
                c_data, cust_attrs = self._extract_attributes_from_version(cur_ver, it.category)
                items_dto.append(
                    self._format_response(
                        item=it,
                        version=cur_ver,
                        canonical_data=c_data,
                        custom_attributes=cust_attrs,
                    )
                )
            return KnowledgeCursorPageDTO(
                items=items_dto,
                next_cursor=None,
                has_more=False,
                total_count=len(items_dto),
                page=page or 1,
                page_size=limit,
                total_pages=1 if items_dto else 0,
            )

        limit = min(max(limit, 1), 100)

        # The registration-backed Company Info record is shown and edited in the Company Info editor,
        # not as a generic row (generic edits to it are refused anyway).
        base_conditions = [
            KnowledgeItem.tenant_id == tenant_id,
            or_(KnowledgeItem.external_identity_key.is_(None), KnowledgeItem.external_identity_key != "company_profile"),
        ]

        # 1. Category filter
        if category and category.lower() != "all":
            try:
                norm_cat = normalize_category_key(category)
                base_conditions.append(KnowledgeItem.category == norm_cat)
            except KnowledgeInvalidCategoryError:
                return KnowledgeCursorPageDTO(
                    items=[], next_cursor=None, has_more=False, total_count=0, page=page or 1, page_size=limit, total_pages=0
                )

        # 2. Status filter
        if status_filter and status_filter.lower() != "all":
            sf = status_filter.lower()
            if sf in {"active", "published"}:
                base_conditions.append(KnowledgeItem.is_active == True)
            elif sf in {"archived"}:
                base_conditions.append(KnowledgeItem.is_active == False)

        # 3. Search filter (indexed substring search)
        if search and search.strip():
            term = f"%{search.strip().lower()}%"
            base_conditions.append(
                or_(
                    func.lower(KnowledgeItem.title).like(term),
                    func.lower(KnowledgeItem.description).like(term),
                )
            )

        # Round-trip-minimal page query: the total count comes from a window function
        # in the same statement and the source is joined, instead of a separate COUNT
        # query plus two selectinload queries (one of which loaded every version of
        # every item on the page). On a high-latency DB link each round trip costs
        # seconds, which is what made this endpoint exceed the client timeout.
        total_col = func.count().over().label("_total_count")
        stmt = (
            select(KnowledgeItem, total_col)
            .where(and_(*base_conditions))
            .options(joinedload(KnowledgeItem.source))
        )

        # Order by
        if sort == "title-asc":
            stmt = stmt.order_by(KnowledgeItem.title.asc(), KnowledgeItem.id.asc())
        elif sort == "title-desc":
            stmt = stmt.order_by(KnowledgeItem.title.desc(), KnowledgeItem.id.desc())
        elif sort == "updated-asc":
            stmt = stmt.order_by(KnowledgeItem.updated_at.asc(), KnowledgeItem.id.asc())
        else:
            stmt = stmt.order_by(KnowledgeItem.updated_at.desc(), KnowledgeItem.id.desc())

        # 4. Keyset Cursor evaluation OR Page offset
        if cursor:
            try:
                cursor_dt, cursor_id = decode_cursor(cursor)
                stmt = stmt.where(
                    or_(
                        KnowledgeItem.updated_at < cursor_dt,
                        and_(
                            KnowledgeItem.updated_at == cursor_dt,
                            KnowledgeItem.id < cursor_id,
                        ),
                    )
                )
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid pagination cursor.",
                )
            stmt = stmt.limit(limit + 1)
        elif page is not None and page > 1:
            offset = (page - 1) * limit
            stmt = stmt.offset(offset).limit(limit + 1)
        else:
            stmt = stmt.limit(limit + 1)

        res = await db.execute(stmt)
        rows = res.unique().all()
        records = [r[0] for r in rows]

        if rows and not cursor:
            total_count = int(rows[0][1] or 0)
        else:
            # Cursor pages filter by keyset, and an out-of-range page returns no rows:
            # in both cases the window count is not the full total, so count separately.
            count_stmt = select(func.count(KnowledgeItem.id)).where(and_(*base_conditions))
            total_count = (await db.scalar(count_stmt)) or 0
        total_pages = max(1, math.ceil(total_count / limit)) if total_count > 0 else 0

        has_more = len(records) > limit
        page_records = records[:limit]

        next_cursor = None
        if has_more and page_records:
            last = page_records[-1]
            next_cursor = encode_cursor(last.updated_at, last.id)

        # One query for exactly the versions the page needs (current, else latest).
        versions_by_item: Dict[str, KnowledgeVersion] = {}
        if page_records:
            item_ids = [it.id for it in page_records]
            current_ids = [it.current_version_id for it in page_records if it.current_version_id]
            ver_res = await db.execute(
                select(KnowledgeVersion)
                .where(
                    KnowledgeVersion.tenant_id == tenant_id,
                    KnowledgeVersion.knowledge_item_id.in_(item_ids),
                    or_(
                        KnowledgeVersion.id.in_(current_ids),
                        KnowledgeVersion.knowledge_item_id.in_(
                            [it.id for it in page_records if not it.current_version_id]
                        ),
                    ),
                )
            )
            current_set = set(current_ids)
            for v in ver_res.scalars().all():
                prev = versions_by_item.get(v.knowledge_item_id)
                if v.id in current_set:
                    versions_by_item[v.knowledge_item_id] = v
                elif prev is None or (prev.id not in current_set and v.version_number > prev.version_number):
                    versions_by_item[v.knowledge_item_id] = v

        items_dto = []
        for it in page_records:
            cur_ver = versions_by_item.get(it.id)

            c_data, cust_attrs = self._extract_attributes_from_version(cur_ver, it.category)
            items_dto.append(
                self._format_response(
                    item=it,
                    version=cur_ver,
                    canonical_data=c_data,
                    custom_attributes=cust_attrs,
                )
            )

        return KnowledgeCursorPageDTO(
            items=items_dto,
            next_cursor=next_cursor,
            has_more=has_more,
            total_count=total_count,
            page=page or 1,
            page_size=limit,
            total_pages=total_pages,
        )

    async def get_category_counts(self, db: AsyncSession, tenant_id: str) -> Dict[str, int]:
        """Aggregate counts per category for tenant dashboard cards."""
        stmt = (
            select(KnowledgeItem.category, func.count(KnowledgeItem.id))
            .where(KnowledgeItem.tenant_id == tenant_id)
            .group_by(KnowledgeItem.category)
        )
        res = await db.execute(stmt)
        rows = res.all()
        counts: Dict[str, int] = {}
        total = 0
        for cat, cnt in rows:
            normalized = cat.replace("_", "-")
            counts[normalized] = cnt
            total += cnt
        counts["all"] = total
        return counts

    # =========================================================================
    # 5. Delete Knowledge Item (permanent)
    # =========================================================================

    async def delete_item(
        self,
        db: AsyncSession,
        tenant_id: str,
        user_id: str,
        item_id: str,
        client_ip: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Permanently delete a knowledge item strictly within the tenant.

        Versions and semantic chunks cascade in PostgreSQL; the post-commit sync removes the item's
        vectors and its search-index row, so a deleted item can never be retrieved again. There is
        no soft-archive: an archived row would keep its identity key and turn a later re-import of
        the same product into an invisible update instead of a visible item.
        """
        stmt = select(KnowledgeItem).where(
            KnowledgeItem.id == item_id,
            KnowledgeItem.tenant_id == tenant_id,
        )
        item = (await db.execute(stmt)).scalar_one_or_none()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Knowledge item '{item_id}' not found for this organization.",
            )

        _reject_managed_company_info(item)
        title = item.title
        await db.delete(item)
        await db.commit()
        await audit_service.record(
            db=db,
            action=AuditAction.KNOWLEDGE_DELETED,
            resource_type="knowledge_item",
            resource_id=item_id,
            organization_id=tenant_id,
            actor_user_id=user_id,
            metadata={"title": title, "hard_delete": True, "ip_address": client_ip},
        )
        await self._finalize_change(db, tenant_id, item_id, "deleted")
        return {"status": "deleted", "id": item_id}

    # =========================================================================
    # 6. Version History
    # =========================================================================

    async def get_version_history(
        self,
        db: AsyncSession,
        tenant_id: str,
        item_id: str,
    ) -> List[KnowledgeVersionHistoryDTO]:
        """Retrieve the immutable version history snapshots for a knowledge item."""
        # Verify item exists for this tenant
        item_stmt = select(KnowledgeItem.id, KnowledgeItem.category).where(
            KnowledgeItem.id == item_id,
            KnowledgeItem.tenant_id == tenant_id,
        )
        item_res = await db.execute(item_stmt)
        item_row = item_res.first()
        if not item_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Knowledge item '{item_id}' not found for this organization.",
            )

        category = item_row[1]

        v_stmt = (
            select(KnowledgeVersion)
            .where(
                KnowledgeVersion.knowledge_item_id == item_id,
                KnowledgeVersion.tenant_id == tenant_id,
            )
            .order_by(KnowledgeVersion.version_number.desc())
        )
        v_res = await db.execute(v_stmt)
        versions = v_res.scalars().all()

        history_dtos = []
        for v in versions:
            c_data, cust_attrs = self._extract_attributes_from_version(v, category)
            history_dtos.append(
                KnowledgeVersionHistoryDTO(
                    id=v.id,
                    knowledge_item_id=v.knowledge_item_id,
                    version_number=v.version_number,
                    status=v.status,
                    change_summary=v.change_summary,
                    authority_level=v.authority_level,
                    content_text=v.content_text,
                    created_at=v.created_at.isoformat() if v.created_at else "",
                    published_at=v.published_at.isoformat() if v.published_at else None,
                    archived_at=v.archived_at.isoformat() if v.archived_at else None,
                    created_by_user_id=v.created_by_user_id,
                    canonical_data=c_data,
                    custom_attributes=cust_attrs,
                )
            )

        return history_dtos

    # =========================================================================
    # 7. Version Inspection & Diff
    # =========================================================================

    async def get_version(
        self,
        db: AsyncSession,
        tenant_id: str,
        item_id: str,
        version_number: int,
    ) -> KnowledgeItemResponseDTO:
        """Fetch a specific version snapshot of a knowledge item strictly scoped to tenant."""
        stmt = (
            select(KnowledgeItem)
            .where(
                KnowledgeItem.id == item_id,
                KnowledgeItem.tenant_id == tenant_id,
            )
            .options(
                selectinload(KnowledgeItem.versions),
                selectinload(KnowledgeItem.source),
            )
        )
        res = await db.execute(stmt)
        item = res.scalar_one_or_none()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Knowledge item '{item_id}' not found for this organization.",
            )

        target_ver = next((v for v in item.versions if v.version_number == version_number), None)
        if not target_ver:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Version {version_number} not found for knowledge item '{item_id}'.",
            )

        c_data, cust_attrs = self._extract_attributes_from_version(target_ver, item.category)
        return self._format_response(
            item=item,
            version=target_ver,
            canonical_data=c_data,
            custom_attributes=cust_attrs,
        )

    async def get_version_diff(
        self,
        db: AsyncSession,
        tenant_id: str,
        item_id: str,
        version_number: int,
        compare_to: Optional[int] = None,
    ) -> VersionDiffDTO:
        """Compare two historical versions of a knowledge item and return deterministic field-level diff."""
        stmt = (
            select(KnowledgeItem)
            .where(
                KnowledgeItem.id == item_id,
                KnowledgeItem.tenant_id == tenant_id,
            )
            .options(
                selectinload(KnowledgeItem.versions),
            )
        )
        res = await db.execute(stmt)
        item = res.scalar_one_or_none()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Knowledge item '{item_id}' not found for this organization.",
            )

        target_ver = next((v for v in item.versions if v.version_number == version_number), None)
        if not target_ver:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Version {version_number} not found for knowledge item '{item_id}'.",
            )

        base_version_num = compare_to if compare_to is not None else (version_number - 1)
        base_ver = next((v for v in item.versions if v.version_number == base_version_num), None)

        target_canonical, target_custom = self._extract_attributes_from_version(target_ver, item.category)
        base_canonical, base_custom = self._extract_attributes_from_version(base_ver, item.category) if base_ver else ({}, {})

        old_headers = {
            "title": item.title,
            "description": item.description,
            "tags": json.loads(item.tags) if item.tags else None,
            "is_active": item.is_active,
        }
        new_headers = dict(old_headers)

        old_temp = {
            "effective_from": base_ver.effective_from if base_ver else None,
            "effective_until": base_ver.effective_until if base_ver else None,
        }
        new_temp = {
            "effective_from": target_ver.effective_from,
            "effective_until": target_ver.effective_until,
        }

        return VersionDiffEngine.compute_diff(
            item_id=item.id,
            from_version=base_ver.version_number if base_ver else None,
            to_version=target_ver.version_number,
            old_headers=old_headers,
            new_headers=new_headers,
            old_content=base_ver.content_text if base_ver else None,
            new_content=target_ver.content_text,
            old_canonical=base_canonical,
            new_canonical=target_canonical,
            old_custom=base_custom,
            new_custom=target_custom,
            old_temporal=old_temp,
            new_temporal=new_temp,
        )

    # =========================================================================
    # 8b. Post-commit finalisation: durable audit + instant memory sync
    # =========================================================================

    async def _finalize_change(
        self,
        db: AsyncSession,
        tenant_id: str,
        item_id: str,
        reason: str,
        version_id: Optional[str] = None,
        item: Optional[KnowledgeItem] = None,
        version: Optional[KnowledgeVersion] = None,
    ) -> None:
        """Persist the audit trail and synchronise retrieval for a committed change.

        - Audit events are added to the session AFTER the business commit, so they
          need their own commit (previously they were never persisted). A failure here
          is logged but cannot undo the already-committed change.
        - ``sync_after_commit`` updates the vector index inline (bounded by a timeout)
          and falls back to a durable retry event + periodic sweep; it never raises.
        """
        from app.services.knowledge_sync import knowledge_sync_service

        try:
            await db.commit()
        except Exception as audit_err:
            try:
                await db.rollback()
            except Exception:
                pass
            logger.error(
                "Failed to persist knowledge audit events",
                tenant_id=tenant_id, item_id=item_id, reason=reason, error=str(audit_err)[:300],
            )
        await knowledge_sync_service.sync_after_commit(
            tenant_id=tenant_id, item_id=item_id, reason=reason, version_id=version_id,
            item=item, version=version,
        )

    # =========================================================================
    # 9. Helper Formatters & Attribute Extraction
    # =========================================================================

    def _extract_attributes_from_version(
        self,
        version: Optional[KnowledgeVersion],
        category: str,
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """Extract canonical and custom attributes dictionary from a KnowledgeVersion.

        Phase 9.6: Dual-read architecture.
        1. Fast path: If version.canonical_data is populated (JSONB), read directly from PostgreSQL.
        2. Fallback path: If canonical_data is NULL, fall back to legacy EAV attributes.
        """
        canonical_data: Dict[str, Any] = {}
        custom_attrs: Dict[str, Any] = {}

        if not version:
            return canonical_data, custom_attrs

        cat_def = None
        try:
            cat_def = category_registry.get(category)
        except Exception:
            pass

        canonical_field_names = set(cat_def.fields.keys()) if cat_def else set()

        # 1. Fast path: canonical_data JSONB
        if version.canonical_data is not None:
            raw_data = dict(version.canonical_data)
            nested_custom = raw_data.pop("custom_attributes", None)
            if isinstance(nested_custom, dict):
                custom_attrs.update(nested_custom)

            for k, val in raw_data.items():
                if k in canonical_field_names:
                    canonical_data[k] = val
                else:
                    custom_attrs[k] = val
            return canonical_data, custom_attrs

        # 2. Fallback path: legacy EAV attributes if available
        legacy_attrs = getattr(version, "attributes", None)
        if not legacy_attrs:
            return canonical_data, custom_attrs

        for attr in legacy_attrs:
            k = attr.key
            val = None
            if attr.string_value is not None:
                val = attr.string_value
            elif attr.text_value is not None:
                val = attr.text_value
            elif attr.number_value is not None:
                val = attr.number_value
            elif attr.boolean_value is not None:
                val = attr.boolean_value
            elif attr.date_value is not None:
                val = attr.date_value.isoformat()
            elif attr.json_value is not None:
                try:
                    val = json.loads(attr.json_value)
                except Exception:
                    val = attr.json_value

            if k in canonical_field_names:
                canonical_data[k] = val
            else:
                custom_attrs[k] = val

        return canonical_data, custom_attrs

    def _format_response(
        self,
        item: KnowledgeItem,
        version: Optional[KnowledgeVersion],
        canonical_data: Dict[str, Any],
        custom_attributes: Dict[str, Any],
        ui_type: Optional[str] = None,
    ) -> KnowledgeItemResponseDTO:
        """Format domain model into KnowledgeItemResponseDTO matching the existing UI contract."""
        tags_list = json.loads(item.tags) if item.tags else None
        
        # Derive UI status label
        ui_status = "Published"
        if not item.is_active:
            ui_status = "Archived"
        elif version:
            if version.status == KnowledgeLifecycleStatus.DRAFT.value:
                ui_status = "Draft"
            elif version.status == KnowledgeLifecycleStatus.ARCHIVED.value:
                ui_status = "Archived"

        # Derive UI type
        resolved_type = ui_type
        if not resolved_type:
            if item.category == "products_services":
                resolved_type = canonical_data.get("entity_type", "Service").capitalize()
            elif item.category == "policies":
                resolved_type = "Policy"
            elif item.category == "offers_promotions":
                resolved_type = "Offer"
            elif item.category == "support_faqs":
                resolved_type = "FAQ"
            elif item.category == "processes_timelines":
                resolved_type = "Process"
            else:
                resolved_type = "Information"

        # Pricing formatting
        pricing_str = None
        if "price" in canonical_data:
            p_val = canonical_data["price"]
            curr = canonical_data.get("currency", "USD")
            pricing_str = f"{p_val} {curr}" if isinstance(p_val, (int, float)) else str(p_val)

        # Date formatting for UI (e.g. "Sep 12, 2024")
        updated_dt = item.updated_at or (version.created_at if version else datetime.now(timezone.utc))
        updated_at_str = updated_dt.strftime("%b %d, %Y")

        return KnowledgeItemResponseDTO(
            id=item.id,
            organizationId=item.tenant_id,
            source_id=item.source_id,
            category=item.category.replace("_", "-"),  # UI uses kebab-case
            type=resolved_type,
            title=item.title,
            excerpt=item.description or "",
            content=version.content_text if version else None,
            status=ui_status,
            source=(item.source.name if ("source" in item.__dict__ and item.source) else item.source_type.capitalize()),
            version=version.version_number if version else 1,
            updatedAt=updated_at_str,
            updatedBy="You",
            tags=tags_list,
            canonical_data=canonical_data,
            custom_attributes=custom_attributes,
            effective_from=version.effective_from.isoformat() if (version and version.effective_from) else None,
            effective_until=version.effective_until.isoformat() if (version and version.effective_until) else None,
            temporal_status=compute_temporal_status(version.effective_from, version.effective_until) if version else None,
            pricing=pricing_str,
            currency=canonical_data.get("currency"),
            warranty=canonical_data.get("warranty") or custom_attributes.get("warranty_period"),
            serviceRegions=canonical_data.get("region") or canonical_data.get("service_regions"),
            email=canonical_data.get("email"),
            phone=canonical_data.get("phone"),
            role=canonical_data.get("role_title"),
            conditions=canonical_data.get("terms_conditions") or custom_attributes.get("terms_conditions") or canonical_data.get("details"),
            question=canonical_data.get("question"),
            answer=canonical_data.get("answer"),
            discount=str(canonical_data.get("discount_value") or custom_attributes.get("discount_value")) if ("discount_value" in canonical_data or "discount_value" in custom_attributes) else None,
            code=canonical_data.get("discount_code") or canonical_data.get("sku") or canonical_data.get("code"),
            city=canonical_data.get("city"),
        )


# Global singleton instance
knowledge_crud_service = KnowledgeCRUDService()
