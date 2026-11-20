"""Phase 7.1 — Knowledge Taxonomy & Category Schemas Service.

Encapsulates:
- High-performance, in-memory Category Registry access
- Tenant-scoped Custom Attribute definition management
- Canonical and custom attribute validation engine
- Audit trail logging
- Collision prevention and anti-cross-tenant protection
"""

import json
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.contracts.knowledge import (
    CategoryFieldSchemaDTO,
    CategorySummaryDTO,
    CustomAttributeCreateDTO,
    CustomAttributeResponseDTO,
    KnowledgeInvalidCategoryError,
    ValidateRecordResponseDTO,
    category_registry,
    normalize_category_key,
)
from app.core.logging import logger
from app.models.audit import AuditAction
from app.models.knowledge import (
    AttributeValueType,
    KnowledgeAttributeDefinition,
)
from app.services.audit import audit_service


class KnowledgeService:
    """Enterprise domain service for knowledge taxonomy, canonical schemas, and custom attributes."""

    def list_categories(self) -> List[CategorySummaryDTO]:
        """Return all 6 registered canonical categories with full schema metadata."""
        summaries: List[CategorySummaryDTO] = []
        for cat_def in category_registry.list_all():
            summaries.append(
                CategorySummaryDTO(
                    key=cat_def.category.value,
                    display_name=cat_def.display_name,
                    description=cat_def.description,
                    purpose=cat_def.purpose,
                    entity_types=cat_def.entity_types,
                    supports_temporal=cat_def.supports_temporal,
                    supports_regional=cat_def.supports_regional,
                    retrieval_filter_fields=cat_def.retrieval_filter_fields,
                    fields=[
                        CategoryFieldSchemaDTO(
                            name=f.name,
                            type=f.field_type.value,
                            required=f.is_required,
                            description=f.description,
                            allowed_values=f.allowed_values,
                            is_semantic=f.is_semantic,
                            is_filter=f.is_filter,
                            min_value=f.min_value,
                            max_value=f.max_value,
                        )
                        for f in cat_def.fields.values()
                    ],
                )
            )
        return summaries

    def get_category(self, category_key: str) -> CategorySummaryDTO:
        """Return schema metadata for a single category."""
        try:
            cat_def = category_registry.get(category_key)
        except KnowledgeInvalidCategoryError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

        return CategorySummaryDTO(
            key=cat_def.category.value,
            display_name=cat_def.display_name,
            description=cat_def.description,
            purpose=cat_def.purpose,
            entity_types=cat_def.entity_types,
            supports_temporal=cat_def.supports_temporal,
            supports_regional=cat_def.supports_regional,
            retrieval_filter_fields=cat_def.retrieval_filter_fields,
            fields=[
                CategoryFieldSchemaDTO(
                    name=f.name,
                    type=f.field_type.value,
                    required=f.is_required,
                    description=f.description,
                    allowed_values=f.allowed_values,
                    is_semantic=f.is_semantic,
                    is_filter=f.is_filter,
                    min_value=f.min_value,
                    max_value=f.max_value,
                )
                for f in cat_def.fields.values()
            ],
        )

    async def list_custom_attributes(
        self,
        db: AsyncSession,
        tenant_id: str,
        category_key: str,
    ) -> List[CustomAttributeResponseDTO]:
        """List tenant-scoped custom attribute definitions for a specific category."""
        canonical_key = normalize_category_key(category_key)
        stmt = (
            select(KnowledgeAttributeDefinition)
            .where(
                KnowledgeAttributeDefinition.tenant_id == tenant_id,
                KnowledgeAttributeDefinition.category == canonical_key,
            )
            .order_by(KnowledgeAttributeDefinition.created_at.asc())
        )
        res = await db.execute(stmt)
        records = res.scalars().all()

        results: List[CustomAttributeResponseDTO] = []
        for r in records:
            allowed = json.loads(r.allowed_values_json) if r.allowed_values_json else None
            results.append(
                CustomAttributeResponseDTO(
                    id=r.id,
                    tenant_id=r.tenant_id,
                    category=r.category,
                    key=r.key,
                    display_name=r.display_name,
                    value_type=r.value_type,
                    is_required=r.is_required,
                    allowed_values=allowed,
                    validation_regex=r.validation_regex,
                    description=r.description,
                    created_at=r.created_at.isoformat() if r.created_at else "",
                )
            )
        return results

    async def create_custom_attribute(
        self,
        db: AsyncSession,
        tenant_id: str,
        user_id: str,
        category_key: str,
        payload: CustomAttributeCreateDTO,
        client_ip: Optional[str] = None,
    ) -> CustomAttributeResponseDTO:
        """Create a new typed custom attribute definition for an organization."""
        canonical_key = normalize_category_key(category_key)
        cat_def = category_registry.get(canonical_key)

        attr_key = payload.key.strip().lower()
        if attr_key in cat_def.fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Key '{attr_key}' is already a canonical field in category '{canonical_key}'.",
            )

        valid_types = {t.value for t in AttributeValueType}
        if payload.value_type not in valid_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid value_type '{payload.value_type}'. Must be one of: {', '.join(sorted(valid_types))}.",
            )

        allowed_json = json.dumps(payload.allowed_values) if payload.allowed_values else None

        attr_def = KnowledgeAttributeDefinition(
            tenant_id=tenant_id,
            category=canonical_key,
            key=attr_key,
            display_name=payload.display_name.strip(),
            value_type=payload.value_type,
            is_required=payload.is_required,
            allowed_values_json=allowed_json,
            validation_regex=payload.validation_regex,
            description=payload.description,
            created_by_user_id=user_id,
        )
        db.add(attr_def)

        try:
            await db.commit()
            await db.refresh(attr_def)
        except IntegrityError:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Custom attribute '{attr_key}' already exists for category '{canonical_key}' in this organization.",
            )

        # Audit emission
        await audit_service.record(
            db=db,
            action=AuditAction.KNOWLEDGE_UPDATED,
            resource_type="knowledge_attribute_definition",
            resource_id=attr_def.id,
            organization_id=tenant_id,
            actor_user_id=user_id,
            metadata={
                "category": canonical_key,
                "key": attr_key,
                "value_type": payload.value_type,
                "is_required": payload.is_required,
                "ip_address": client_ip,
            },
        )

        # Invalidate flexible schema engine compiled plan cache for this tenant + category
        from app.services.flexible_schema import flexible_schema_engine
        flexible_schema_engine.invalidate_cache(tenant_id=tenant_id, category_key=canonical_key)

        return CustomAttributeResponseDTO(
            id=attr_def.id,
            tenant_id=attr_def.tenant_id,
            category=attr_def.category,
            key=attr_def.key,
            display_name=attr_def.display_name,
            value_type=attr_def.value_type,
            is_required=attr_def.is_required,
            allowed_values=payload.allowed_values,
            validation_regex=attr_def.validation_regex,
            description=attr_def.description,
            created_at=attr_def.created_at.isoformat() if attr_def.created_at else "",
        )

    async def validate_record(
        self,
        db: AsyncSession,
        tenant_id: str,
        category_key: str,
        data: Dict[str, Any],
        strict_custom: bool = False,
    ) -> ValidateRecordResponseDTO:
        """Validate a data dictionary against canonical schema and tenant custom attribute definitions."""
        try:
            canonical_key = normalize_category_key(category_key)
        except KnowledgeInvalidCategoryError as exc:
            return ValidateRecordResponseDTO(
                is_valid=False,
                category=category_key,
                errors=[str(exc)],
                cleaned_canonical_data={},
                cleaned_custom_attributes={},
            )

        # Fetch tenant-scoped custom attribute definitions
        stmt = select(KnowledgeAttributeDefinition).where(
            KnowledgeAttributeDefinition.tenant_id == tenant_id,
            KnowledgeAttributeDefinition.category == canonical_key,
        )
        res = await db.execute(stmt)
        custom_attrs = res.scalars().all()
        custom_defs = {
            ca.key: type(
                "CustomAttrObj",
                (),
                {
                    "is_required": ca.is_required,
                    "value_type": ca.value_type,
                    "allowed_values": json.loads(ca.allowed_values_json) if ca.allowed_values_json else None,
                },
            )()
            for ca in custom_attrs
        }

        # Validate with category registry
        val_res = category_registry.validate_record(
            category=canonical_key,
            record=data,
            custom_definitions=custom_defs,
            strict_custom=strict_custom,
        )

        return ValidateRecordResponseDTO(
            is_valid=val_res.is_valid,
            category=canonical_key,
            errors=val_res.errors,
            cleaned_canonical_data=val_res.cleaned_canonical_data,
            cleaned_custom_attributes=val_res.cleaned_custom_attributes,
        )


knowledge_service = KnowledgeService()
