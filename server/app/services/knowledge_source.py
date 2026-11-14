"""Knowledge Source Lineage & Authority Service — Phase 7.4.

Provides enterprise management for:
- Traceable origin and authority of knowledge facts
- Deterministic deduplication by cryptographic checksum or external reference
- Temporal validity windows (effective_from, effective_until)
- Keyset cursor pagination (zero-OFFSET)
- Multi-tenant isolation and anti-spoofing guarantees
- Deep lineage resolution (Source -> Items -> Versions)
- Integration with AuditService
"""

from datetime import datetime, timezone
import json
from typing import Any, Dict, List, Optional, Tuple
import uuid
from fastapi import HTTPException, status
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.contracts.knowledge_crud import decode_cursor, encode_cursor
from app.contracts.knowledge_source import (
    KnowledgeSourceCreateDTO,
    KnowledgeSourceCursorPageDTO,
    KnowledgeSourceLineageDTO,
    KnowledgeSourceLineageItemDTO,
    KnowledgeSourceLineageVersionDTO,
    KnowledgeSourceResponseDTO,
    KnowledgeSourceUpdateDTO,
)
from app.core.logging import logger
from app.models.audit import AuditAction
from app.models.knowledge import (
    KnowledgeItem,
    KnowledgeSource,
    KnowledgeSourceStatus,
    KnowledgeSourceType,
    KnowledgeVersion,
    SourceAuthorityLevel,
)
from app.services.audit import audit_service


class KnowledgeSourceService:
    """Enterprise domain service for KnowledgeSource provenance and lifecycle."""

    # =========================================================================
    # 1. Create or Deduplicate Source
    # =========================================================================

    async def create_or_deduplicate_source(
        self,
        db: AsyncSession,
        tenant_id: str,
        user_id: str,
        payload: KnowledgeSourceCreateDTO,
        client_ip: Optional[str] = None,
    ) -> Tuple[KnowledgeSourceResponseDTO, bool]:
        """Create a new source or reuse an existing identical active source within tenant.
        
        Returns:
            Tuple[KnowledgeSourceResponseDTO, bool]: (source_dto, was_created)
        """
        # Deduplication Strategy 1: Checksum match within tenant
        if payload.checksum:
            stmt_chk = select(KnowledgeSource).where(
                KnowledgeSource.tenant_id == tenant_id,
                KnowledgeSource.checksum == payload.checksum,
                KnowledgeSource.status == KnowledgeSourceStatus.ACTIVE.value,
            )
            res_chk = await db.execute(stmt_chk)
            existing_chk = res_chk.scalar_one_or_none()
            if existing_chk:
                logger.info(
                    "Reusing existing active KnowledgeSource by checksum match",
                    source_id=existing_chk.id,
                    tenant_id=tenant_id,
                    checksum=payload.checksum,
                )
                return await self._build_dto(db, existing_chk), False

        # Deduplication Strategy 2: Source reference + source_type match within tenant
        if payload.source_reference:
            stmt_ref = select(KnowledgeSource).where(
                KnowledgeSource.tenant_id == tenant_id,
                KnowledgeSource.source_type == payload.source_type,
                KnowledgeSource.source_reference == payload.source_reference,
                KnowledgeSource.status == KnowledgeSourceStatus.ACTIVE.value,
            )
            res_ref = await db.execute(stmt_ref)
            existing_ref = res_ref.scalar_one_or_none()
            if existing_ref:
                logger.info(
                    "Reusing existing active KnowledgeSource by reference match",
                    source_id=existing_ref.id,
                    tenant_id=tenant_id,
                    source_reference=payload.source_reference,
                )
                return await self._build_dto(db, existing_ref), False

        # Validate enums
        valid_types = {t.value for t in KnowledgeSourceType}
        if payload.source_type not in valid_types:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid source_type '{payload.source_type}'. Allowed: {', '.join(sorted(valid_types))}.",
            )

        valid_authorities = {a.value for a in SourceAuthorityLevel}
        if payload.authority_level not in valid_authorities:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid authority_level '{payload.authority_level}'. Allowed: {', '.join(sorted(valid_authorities))}.",
            )

        now_utc = datetime.now(timezone.utc)
        meta_str = json.dumps(payload.metadata) if payload.metadata else None

        source = KnowledgeSource(
            id=f"ks_{uuid.uuid4().hex}",
            tenant_id=tenant_id,
            source_type=payload.source_type,
            name=payload.name,
            authority_level=payload.authority_level,
            status=payload.status or KnowledgeSourceStatus.ACTIVE.value,
            source_reference=payload.source_reference,
            dataset_name=payload.dataset_name,
            file_name=payload.file_name,
            checksum=payload.checksum,
            schema_fingerprint=payload.schema_fingerprint,
            effective_from=payload.effective_from,
            effective_until=payload.effective_until,
            origin_uri=payload.origin_uri,
            metadata_json=meta_str,
            created_by_user_id=user_id,
            created_at=now_utc,
            updated_at=now_utc,
        )
        db.add(source)

        await audit_service.record(
            db=db,
            action=AuditAction.KNOWLEDGE_SOURCE_CREATED,
            resource_type="knowledge_source",
            resource_id=source.id,
            organization_id=tenant_id,
            actor_user_id=user_id,
            metadata={
                "name": source.name,
                "source_type": source.source_type,
                "authority_level": source.authority_level,
                "ip_address": client_ip,
            },
        )
        await db.commit()
        await db.refresh(source)

        return await self._build_dto(db, source), True

    # =========================================================================
    # 2. Get Source
    # =========================================================================

    async def get_source(
        self,
        db: AsyncSession,
        tenant_id: str,
        source_id: str,
    ) -> KnowledgeSourceResponseDTO:
        """Fetch a single knowledge source strictly within tenant boundary."""
        stmt = select(KnowledgeSource).where(
            KnowledgeSource.id == source_id,
            KnowledgeSource.tenant_id == tenant_id,
        )
        res = await db.execute(stmt)
        source = res.scalar_one_or_none()
        if not source:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Knowledge source '{source_id}' not found for this organization.",
            )
        return await self._build_dto(db, source)

    # =========================================================================
    # 3. List Sources (Keyset Cursor Pagination)
    # =========================================================================

    async def list_sources(
        self,
        db: AsyncSession,
        tenant_id: str,
        cursor: Optional[str] = None,
        limit: int = 20,
        source_type: Optional[str] = None,
        source_status: Optional[str] = None,
        authority_level: Optional[str] = None,
    ) -> KnowledgeSourceCursorPageDTO:
        """Query sources with stable keyset cursor pagination on (created_at DESC, id DESC)."""
        limit = max(1, min(limit, 100))

        # Base tenant-isolated query
        query = select(KnowledgeSource).where(KnowledgeSource.tenant_id == tenant_id)

        if source_type:
            query = query.where(KnowledgeSource.source_type == source_type)
        if source_status:
            query = query.where(KnowledgeSource.status == source_status)
        if authority_level:
            query = query.where(KnowledgeSource.authority_level == authority_level)

        # Apply keyset cursor
        if cursor:
            try:
                cur_dt, cur_id = decode_cursor(cursor)
                query = query.where(
                    or_(
                        KnowledgeSource.created_at < cur_dt,
                        (KnowledgeSource.created_at == cur_dt) & (KnowledgeSource.id < cur_id),
                    )
                )
            except Exception:
                pass

        # Stable deterministic sort
        query = query.order_by(
            desc(KnowledgeSource.created_at),
            desc(KnowledgeSource.id),
        ).limit(limit + 1)

        res = await db.execute(query)
        sources = list(res.scalars().all())

        has_more = len(sources) > limit
        page_sources = sources[:limit]

        next_cursor = None
        if has_more and page_sources:
            last_item = page_sources[-1]
            next_cursor = encode_cursor(last_item.created_at, last_item.id)

        # Batch counts for page
        dto_list = [await self._build_dto(db, s) for s in page_sources]

        return KnowledgeSourceCursorPageDTO(
            items=dto_list,
            next_cursor=next_cursor,
            has_more=has_more,
        )

    # =========================================================================
    # 4. Update Source
    # =========================================================================

    async def update_source(
        self,
        db: AsyncSession,
        tenant_id: str,
        user_id: str,
        source_id: str,
        payload: KnowledgeSourceUpdateDTO,
        client_ip: Optional[str] = None,
    ) -> KnowledgeSourceResponseDTO:
        """Update mutable metadata and validity for a KnowledgeSource."""
        stmt = select(KnowledgeSource).where(
            KnowledgeSource.id == source_id,
            KnowledgeSource.tenant_id == tenant_id,
        )
        res = await db.execute(stmt)
        source = res.scalar_one_or_none()
        if not source:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Knowledge source '{source_id}' not found for this organization.",
            )

        if payload.name is not None:
            source.name = payload.name
        if payload.status is not None:
            valid_statuses = {s.value for s in KnowledgeSourceStatus}
            if payload.status not in valid_statuses:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Invalid status '{payload.status}'. Allowed: {', '.join(sorted(valid_statuses))}.",
                )
            source.status = payload.status
        if payload.authority_level is not None:
            source.authority_level = payload.authority_level
        if payload.dataset_name is not None:
            source.dataset_name = payload.dataset_name
        if payload.effective_from is not None:
            source.effective_from = payload.effective_from
        if payload.effective_until is not None:
            source.effective_until = payload.effective_until
        if payload.metadata is not None:
            source.metadata_json = json.dumps(payload.metadata)

        source.updated_at = datetime.now(timezone.utc)
        await audit_service.record(
            db=db,
            action=AuditAction.KNOWLEDGE_SOURCE_UPDATED,
            resource_type="knowledge_source",
            resource_id=source.id,
            organization_id=tenant_id,
            actor_user_id=user_id,
            metadata={"status": source.status, "name": source.name, "ip_address": client_ip},
        )
        await db.commit()
        await db.refresh(source)

        return await self._build_dto(db, source)

    # =========================================================================
    # 5. Archive or Revoke Source
    # =========================================================================

    async def archive_source(
        self,
        db: AsyncSession,
        tenant_id: str,
        user_id: str,
        source_id: str,
        revoke: bool = False,
        client_ip: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Soft-archive or explicitly revoke a KnowledgeSource."""
        stmt = select(KnowledgeSource).where(
            KnowledgeSource.id == source_id,
            KnowledgeSource.tenant_id == tenant_id,
        )
        res = await db.execute(stmt)
        source = res.scalar_one_or_none()
        if not source:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Knowledge source '{source_id}' not found for this organization.",
            )

        now_utc = datetime.now(timezone.utc)
        new_status = KnowledgeSourceStatus.REVOKED.value if revoke else KnowledgeSourceStatus.ARCHIVED.value
        source.status = new_status
        source.updated_at = now_utc

        action = AuditAction.KNOWLEDGE_SOURCE_REVOKED if revoke else AuditAction.KNOWLEDGE_SOURCE_ARCHIVED
        await audit_service.record(
            db=db,
            action=action,
            resource_type="knowledge_source",
            resource_id=source.id,
            organization_id=tenant_id,
            actor_user_id=user_id,
            metadata={"new_status": new_status, "ip_address": client_ip},
        )
        await db.commit()

        return {"status": new_status, "id": source_id}

    # =========================================================================
    # 6. Deep Lineage Resolution
    # =========================================================================

    async def get_source_lineage(
        self,
        db: AsyncSession,
        tenant_id: str,
        source_id: str,
    ) -> KnowledgeSourceLineageDTO:
        """Trace all KnowledgeItems and KnowledgeVersions originating from this source."""
        stmt = select(KnowledgeSource).where(
            KnowledgeSource.id == source_id,
            KnowledgeSource.tenant_id == tenant_id,
        )
        res = await db.execute(stmt)
        source = res.scalar_one_or_none()
        if not source:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Knowledge source '{source_id}' not found for this organization.",
            )

        # Query all items originating from this source
        item_stmt = (
            select(KnowledgeItem)
            .where(
                KnowledgeItem.tenant_id == tenant_id,
                KnowledgeItem.source_id == source_id,
            )
            .options(selectinload(KnowledgeItem.versions))
            .order_by(desc(KnowledgeItem.created_at))
        )
        res_items = await db.execute(item_stmt)
        items = list(res_items.scalars().all())

        # Query all versions pointing to this source
        ver_stmt = (
            select(KnowledgeVersion, KnowledgeItem.title)
            .join(KnowledgeItem, KnowledgeVersion.knowledge_item_id == KnowledgeItem.id)
            .where(
                KnowledgeVersion.tenant_id == tenant_id,
                KnowledgeVersion.source_id == source_id,
            )
            .order_by(desc(KnowledgeVersion.created_at))
        )
        res_vers = await db.execute(ver_stmt)
        versions_with_titles = res_vers.all()

        lineage_items: List[KnowledgeSourceLineageItemDTO] = [
            KnowledgeSourceLineageItemDTO(
                id=item.id,
                title=item.title,
                category=item.category,
                is_active=item.is_active,
                version_count=len(item.versions) if item.versions else 0,
                created_at=item.created_at,
            )
            for item in items
        ]

        lineage_vers: List[KnowledgeSourceLineageVersionDTO] = [
            KnowledgeSourceLineageVersionDTO(
                id=ver.id,
                knowledge_item_id=ver.knowledge_item_id,
                item_title=title,
                version_number=ver.version_number,
                status=ver.status,
                authority_level=ver.authority_level,
                effective_from=ver.effective_from,
                effective_until=ver.effective_until,
                change_summary=ver.change_summary,
                created_at=ver.created_at,
            )
            for ver, title in versions_with_titles
        ]

        active_items_count = sum(1 for it in items if it.is_active)
        source_dto = await self._build_dto(db, source)

        return KnowledgeSourceLineageDTO(
            source=source_dto,
            total_items=len(lineage_items),
            total_versions=len(lineage_vers),
            active_items_count=active_items_count,
            items=lineage_items,
            versions=lineage_vers,
        )

    # =========================================================================
    # 7. Default Manual Source Resolver
    # =========================================================================

    async def ensure_default_manual_source(
        self,
        db: AsyncSession,
        tenant_id: str,
        user_id: Optional[str] = None,
    ) -> KnowledgeSource:
        """Fetch or create a standard MANUAL source for direct UI operations."""
        stmt = select(KnowledgeSource).where(
            KnowledgeSource.tenant_id == tenant_id,
            KnowledgeSource.source_type == KnowledgeSourceType.MANUAL.value,
            KnowledgeSource.name == "Direct Manual Entry",
            KnowledgeSource.status == KnowledgeSourceStatus.ACTIVE.value,
        )
        res = await db.execute(stmt)
        source = res.scalar_one_or_none()
        if source:
            return source

        now_utc = datetime.now(timezone.utc)
        new_source = KnowledgeSource(
            id=f"ks_{uuid.uuid4().hex}",
            tenant_id=tenant_id,
            source_type=KnowledgeSourceType.MANUAL.value,
            name="Direct Manual Entry",
            authority_level=SourceAuthorityLevel.MANUAL.value,
            status=KnowledgeSourceStatus.ACTIVE.value,
            created_by_user_id=user_id,
            created_at=now_utc,
            updated_at=now_utc,
        )
        db.add(new_source)
        await db.commit()
        await db.refresh(new_source)
        return new_source

    # =========================================================================
    # 8. Internal Helpers
    # =========================================================================

    async def _build_dto(
        self,
        db: AsyncSession,
        source: KnowledgeSource,
    ) -> KnowledgeSourceResponseDTO:
        meta_dict = None
        if source.metadata_json:
            try:
                meta_dict = json.loads(source.metadata_json)
            except Exception:
                meta_dict = None

        # Count linked items and versions efficiently
        items_cnt_stmt = select(func.count(KnowledgeItem.id)).where(
            KnowledgeItem.tenant_id == source.tenant_id,
            KnowledgeItem.source_id == source.id,
        )
        items_count = (await db.execute(items_cnt_stmt)).scalar() or 0

        vers_cnt_stmt = select(func.count(KnowledgeVersion.id)).where(
            KnowledgeVersion.tenant_id == source.tenant_id,
            KnowledgeVersion.source_id == source.id,
        )
        vers_count = (await db.execute(vers_cnt_stmt)).scalar() or 0

        return KnowledgeSourceResponseDTO(
            id=source.id,
            organizationId=source.tenant_id,
            source_type=source.source_type,
            name=source.name,
            authority_level=source.authority_level,
            status=source.status,
            source_reference=source.source_reference,
            dataset_name=source.dataset_name,
            file_name=source.file_name,
            checksum=source.checksum,
            schema_fingerprint=source.schema_fingerprint,
            effective_from=source.effective_from,
            effective_until=source.effective_until,
            origin_uri=source.origin_uri,
            metadata=meta_dict,
            created_by_user_id=source.created_by_user_id,
            created_at=source.created_at,
            updated_at=source.updated_at,
            items_count=items_count,
            versions_count=vers_count,
        )


# Global singleton
knowledge_source_service = KnowledgeSourceService()
