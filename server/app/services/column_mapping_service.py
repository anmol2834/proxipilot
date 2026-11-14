"""Phase 8.3 — Enterprise Column Mapping & Schema Detection Service.

Specification:
- Purpose: Convert Phase 8.2 DatasetProfileDTO into an immutable, category-aware CompiledMappingPlanDTO.
- Signal Hierarchy (Section 2):
  1. Saved Schema Profile Reuse (if active, matching tenant, and not stale)
  2. Exact Canonical Field Match (Confidence: 1.00)
  3. Category-Aware Canonical Alias Match (Confidence: 0.95)
  4. Tenant-Scoped Custom Attribute Match (Confidence: 0.85 - 0.90)
  5. Ambiguous Keyword Safety (AMBIGUOUS_COLUMNS -> NEEDS_REVIEW, Confidence: 0.0)
  6. Constrained Lightweight Token Similarity (Confidence: 0.60 - 0.75)
  7. Fallback: UNMAPPED
- Guardrails:
  - Canonical fields strictly take precedence over custom attributes (Section 5).
  - Multi-tenant isolation: Tenant A never accesses Tenant B attributes or profiles (Section 4).
  - One-Pass Resolution: Built once per dataset, zero per-row or per-column DB queries (Section 7, 18).
"""

import json
from typing import Any, Dict, List, Optional, Set, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.algorithms.matching.similarity import compute_candidate_similarity
from app.contracts.column_mapping import (
    ColumnMappingDTO,
    CompiledMappingPlanDTO,
    MappingReason,
    MappingTargetKind,
)
from app.contracts.dataset_profile import ColumnProfileDTO, DatasetProfileDTO
from app.contracts.flexible_schema import AMBIGUOUS_COLUMNS, sanitize_attribute_key
from app.contracts.knowledge import CanonicalFieldDefinition, category_registry, normalize_category_key
from app.core.logging import logger
from app.models.knowledge import KnowledgeAttributeDefinition, KnowledgeSchemaProfile
from app.services.column_mapping_index import ColumnMappingIndex
from app.services.mapping_compatibility import MappingCompatibilityEvaluator


class ColumnMappingService:
    """Enterprise service orchestrating category-aware schema detection and column mapping."""

    MEDIA_TOKENS: Set[str] = {
        "image", "img", "photo", "picture", "thumbnail", "thumb",
        "avatar", "icon", "logo", "banner", "pic", "gallery",
    }

    NON_MEDIA_ESSENTIAL_TOKENS: Set[str] = {
        "website", "web", "site", "manual", "doc", "document", "policy",
        "track", "tracking", "ship", "shipping", "spec", "specification",
        "support", "map", "guide", "faq", "terms", "file_url", "doc_url",
        "portal", "catalog", "catalogue", "invoice", "receipt", "contract",
    }

    IMAGE_EXTENSIONS: Tuple[str, ...] = (
        ".jpg", ".jpeg", ".png", ".webp", ".svg", ".gif", ".bmp", ".ico", ".tiff", ".avif"
    )

    def _is_media_column(self, col: ColumnProfileDTO, norm_name: str) -> bool:
        """Deterministically detect product image and media columns to avoid embedding noise."""
        name_lower = norm_name.lower()
        tokens = set(name_lower.split("_"))

        # 1. Negative guard: preserve essential business endpoints and documents
        if any(t in tokens for t in self.NON_MEDIA_ESSENTIAL_TOKENS):
            return False

        # 2. Token-level detection: explicit image/media keywords
        has_media_token = any(t in tokens for t in self.MEDIA_TOKENS) or any(
            pattern in name_lower
            for pattern in (
                "product_image", "image_url", "img_url", "front_image", "back_image",
                "photo_url", "thumbnail_url", "item_pic", "product_photo", "image_file"
            )
        )

        # 3. Sample-level detection: image file extensions or data URIs
        has_image_samples = False
        if col.samples:
            for s in col.samples:
                s_clean = str(s).strip().lower()
                if s_clean.startswith("data:image/") or any(
                    s_clean.split("?")[0].endswith(ext) for ext in self.IMAGE_EXTENSIONS
                ):
                    has_image_samples = True
                    break

        return has_media_token or has_image_samples

    async def detect_and_compile_mapping(
        self,
        db: AsyncSession,
        tenant_id: str,
        category: str,
        profile: DatasetProfileDTO,
        source_type: str = "csv",
    ) -> CompiledMappingPlanDTO:
        """Execute deterministic mapping pipeline once for a dataset profile.

        Args:
            db: Async database session.
            tenant_id: Organization identifier strictly scoping queries.
            category: Canonical knowledge category key.
            profile: Phase 8.2 DatasetProfileDTO containing column statistics and fingerprint.
            source_type: File format ('csv', 'xlsx', 'xls').

        Returns:
            Immutable CompiledMappingPlanDTO ready for Phase 8.4 batch normalization.
        """
        norm_category = normalize_category_key(category)
        cat_def = category_registry.get(norm_category)

        # 1. Single-Query Batch Load of Tenant Custom Attributes & Saved Profiles
        stmt_attrs = select(KnowledgeAttributeDefinition).where(
            KnowledgeAttributeDefinition.tenant_id == tenant_id,
            KnowledgeAttributeDefinition.category == norm_category,
        )
        res_attrs = await db.execute(stmt_attrs)
        custom_attrs = list(res_attrs.scalars().all())

        stmt_profile = select(KnowledgeSchemaProfile).where(
            KnowledgeSchemaProfile.tenant_id == tenant_id,
            KnowledgeSchemaProfile.category == norm_category,
            KnowledgeSchemaProfile.fingerprint == profile.schema_fingerprint,
            KnowledgeSchemaProfile.is_active == True,
        ).order_by(KnowledgeSchemaProfile.version.desc()).limit(1)
        res_profile = await db.execute(stmt_profile)
        saved_profile = res_profile.scalar_one_or_none()

        # Build In-Memory Index (O(1) lookup)
        mapping_index = ColumnMappingIndex(
            tenant_id=tenant_id,
            category=norm_category,
            custom_attributes=custom_attrs,
        )

        # 2. Check Saved Profile Reuse (Section 15 & 16)
        if saved_profile:
            reused_plan = self._try_reuse_saved_profile(
                saved_profile=saved_profile,
                profile=profile,
                mapping_index=mapping_index,
                category=norm_category,
            )
            if reused_plan:
                logger.info(
                    "Reused approved schema mapping profile",
                    tenant_id=tenant_id,
                    category=norm_category,
                    fingerprint=profile.schema_fingerprint,
                    profile_id=saved_profile.id,
                )
                return reused_plan

        # 3. Deterministic Pipeline: Column-by-Column Resolution
        column_mappings: List[ColumnMappingDTO] = []
        assigned_canonical_targets: Dict[str, str] = {}  # target_name -> source_column
        assigned_custom_targets: Dict[str, str] = {}     # target_key -> source_column

        for col in profile.columns:
            mapping = self._resolve_column_mapping(
                col=col,
                mapping_index=mapping_index,
                assigned_canonical_targets=assigned_canonical_targets,
                assigned_custom_targets=assigned_custom_targets,
            )
            column_mappings.append(mapping)
            if mapping.target_kind == MappingTargetKind.CANONICAL_FIELD and mapping.target_field:
                assigned_canonical_targets[mapping.target_field] = col.original_name
            elif mapping.target_kind == MappingTargetKind.CUSTOM_ATTRIBUTE and mapping.target_field:
                assigned_custom_targets[mapping.target_field] = col.original_name

        mapped_count = sum(
            1 for m in column_mappings if m.target_kind in (MappingTargetKind.CANONICAL_FIELD, MappingTargetKind.CUSTOM_ATTRIBUTE)
        )
        needs_review_count = sum(1 for m in column_mappings if m.target_kind == MappingTargetKind.NEEDS_REVIEW)
        unmapped_count = sum(1 for m in column_mappings if m.target_kind == MappingTargetKind.UNMAPPED)
        ignored_count = sum(1 for m in column_mappings if m.target_kind == MappingTargetKind.IGNORED)

        return CompiledMappingPlanDTO(
            schema_fingerprint=profile.schema_fingerprint,
            category=norm_category,
            is_reused_from_profile=False,
            profile_id=None,
            columns=column_mappings,
            mapped_count=mapped_count,
            unmapped_count=unmapped_count,
            needs_review_count=needs_review_count,
            ignored_count=ignored_count,
            total_columns=len(column_mappings),
        )

    def _resolve_column_mapping(
        self,
        col: ColumnProfileDTO,
        mapping_index: ColumnMappingIndex,
        assigned_canonical_targets: Dict[str, str],
        assigned_custom_targets: Optional[Dict[str, str]] = None,
    ) -> ColumnMappingDTO:
        """Resolve an individual source column against the deterministic signal hierarchy."""
        norm_name = col.normalized_name

        # Check Ambiguous Keywords (Section 10)
        # Ambiguous keywords are safely preserved as dynamic custom attributes to avoid data loss.
        if norm_name in AMBIGUOUS_COLUMNS:
            target_key = sanitize_attribute_key(norm_name or col.original_name) or "custom_attribute"
            if assigned_custom_targets is not None and (target_key in mapping_index.canonical_fields or target_key in assigned_custom_targets):
                target_key = f"custom_{target_key}"
                counter = 2
                while target_key in assigned_custom_targets:
                    target_key = f"custom_{sanitize_attribute_key(norm_name or col.original_name)}_{counter}"
                    counter += 1
            target_type = col.dominant_type if col.dominant_type else "string"
            return ColumnMappingDTO(
                source_column=col.original_name,
                normalized_column=norm_name,
                target_kind=MappingTargetKind.CUSTOM_ATTRIBUTE,
                target_field=target_key,
                target_type=target_type,
                confidence=0.5,
                reason=MappingReason.AMBIGUOUS_KEYWORD,
                candidates=[f.name for f in mapping_index.canonical_fields.values()][:3],
                validation_notes=f"Column '{norm_name}' is generic/ambiguous; preserved as custom attribute '{target_key}'.",
            )

        # Signal 1: Exact Canonical Match
        canonical_exact = mapping_index.get_canonical_by_exact_name(norm_name)
        if canonical_exact:
            # Check target collision: if already assigned, fall through to custom attribute below
            if canonical_exact.name not in assigned_canonical_targets:
                compat = MappingCompatibilityEvaluator.evaluate(
                    source_col=col,
                    target_type=canonical_exact.field_type.value,
                    allowed_values=canonical_exact.allowed_values,
                    min_value=canonical_exact.min_value,
                    max_value=canonical_exact.max_value,
                )
                if compat.is_compatible:
                    return ColumnMappingDTO(
                        source_column=col.original_name,
                        normalized_column=norm_name,
                        target_kind=MappingTargetKind.CANONICAL_FIELD,
                        target_field=canonical_exact.name,
                        target_type=canonical_exact.field_type.value,
                        confidence=round(1.0 * compat.confidence_factor, 2),
                        reason=MappingReason.EXACT_CANONICAL,
                        is_required=canonical_exact.is_required if canonical_exact.is_required is not None else False,
                        transformation_op=compat.recommended_op,
                        validation_notes=compat.advisory_note,
                    )
            # If collided or incompatible, don't drop! Proceed down the signal hierarchy.

        # Signal 2: Category-Aware Canonical Alias Match
        canonical_alias = mapping_index.get_canonical_by_alias(norm_name)
        if canonical_alias:
            # Only map if canonical target is not already claimed and data is compatible
            if canonical_alias.name not in assigned_canonical_targets:
                compat = MappingCompatibilityEvaluator.evaluate(
                    source_col=col,
                    target_type=canonical_alias.field_type.value,
                    allowed_values=canonical_alias.allowed_values,
                    min_value=canonical_alias.min_value,
                    max_value=canonical_alias.max_value,
                )
                if compat.is_compatible:
                    return ColumnMappingDTO(
                        source_column=col.original_name,
                        normalized_column=norm_name,
                        target_kind=MappingTargetKind.CANONICAL_FIELD,
                        target_field=canonical_alias.name,
                        target_type=canonical_alias.field_type.value,
                        confidence=round(0.95 * compat.confidence_factor, 2),
                        reason=MappingReason.CATEGORY_ALIAS,
                        is_required=canonical_alias.is_required if canonical_alias.is_required is not None else False,
                        transformation_op=compat.recommended_op,
                        validation_notes=compat.advisory_note,
                    )
            # If collided or incompatible with alias, fall through to preserve data!

        # Signal 3: Tenant Custom Attribute Match
        custom_attr = mapping_index.get_custom_attribute(norm_name)
        if custom_attr:
            compat = MappingCompatibilityEvaluator.evaluate(
                source_col=col,
                target_type=custom_attr.value_type,
            )
            is_key_match = norm_name == sanitize_attribute_key(custom_attr.key)
            base_conf = 0.90 if is_key_match else 0.85
            reason = MappingReason.CUSTOM_ATTRIBUTE_KEY if is_key_match else MappingReason.CUSTOM_ATTRIBUTE_DISPLAY

            if compat.is_compatible:
                return ColumnMappingDTO(
                    source_column=col.original_name,
                    normalized_column=norm_name,
                    target_kind=MappingTargetKind.CUSTOM_ATTRIBUTE,
                    target_field=custom_attr.key,
                    target_type=custom_attr.value_type,
                    confidence=round(base_conf * compat.confidence_factor, 2),
                    reason=reason,
                    is_required=custom_attr.is_required if custom_attr.is_required is not None else False,
                    transformation_op=compat.recommended_op,
                    validation_notes=compat.advisory_note,
                )

        # Media / Product Image Detection: explicitly IGNORE for standard structured/textual RAG ingestion
        if self._is_media_column(col, norm_name):
            return ColumnMappingDTO(
                source_column=col.original_name,
                normalized_column=norm_name,
                target_kind=MappingTargetKind.IGNORED,
                target_field=norm_name,
                target_type="media_ignored",
                confidence=0.95,
                reason=MappingReason.MEDIA_IGNORED,
                validation_notes="Auto-classified as media/image field; deliberately excluded from semantic RAG embedding.",
            )

        # Signal 4: Constrained Token / String Similarity (Section 13)
        similarity_candidates: List[Tuple[str, CanonicalFieldDefinition, float]] = []
        for c_name, c_def in mapping_index.canonical_fields.items():
            if c_name in assigned_canonical_targets:
                continue
            sim = compute_candidate_similarity(norm_name, c_name)
            if sim >= 0.55:
                similarity_candidates.append((c_name, c_def, sim))

        if similarity_candidates:
            similarity_candidates.sort(key=lambda x: x[2], reverse=True)
            top_name, top_def, top_sim = similarity_candidates[0]

            # Check if there is ambiguity (multiple close candidates)
            close_candidates = [c[0] for c in similarity_candidates if top_sim - c[2] <= 0.15]
            if len(close_candidates) <= 1:
                compat = MappingCompatibilityEvaluator.evaluate(
                    source_col=col,
                    target_type=top_def.field_type.value,
                    allowed_values=top_def.allowed_values,
                    min_value=top_def.min_value,
                    max_value=top_def.max_value,
                )
                if compat.is_compatible and top_sim >= 0.70:
                    return ColumnMappingDTO(
                        source_column=col.original_name,
                        normalized_column=norm_name,
                        target_kind=MappingTargetKind.CANONICAL_FIELD,
                        target_field=top_def.name,
                        target_type=top_def.field_type.value,
                        confidence=round(top_sim * compat.confidence_factor, 2),
                        reason=MappingReason.TOKEN_SIMILARITY,
                        is_required=top_def.is_required if top_def.is_required is not None else False,
                        transformation_op=compat.recommended_op,
                        validation_notes=compat.advisory_note,
                    )

        # Fallback: Preserve as dynamic CUSTOM_ATTRIBUTE (Zero User Data Loss)
        target_key = sanitize_attribute_key(norm_name or col.original_name)
        if not target_key:
            target_key = "custom_attribute"

        # If target_key collides with a canonical field or an already assigned custom target
        if assigned_custom_targets is None:
            assigned_custom_targets = {}
        if target_key in mapping_index.canonical_fields or target_key in assigned_custom_targets:
            target_key = f"custom_{target_key}"
            counter = 2
            while target_key in assigned_custom_targets:
                target_key = f"custom_{sanitize_attribute_key(norm_name or col.original_name)}_{counter}"
                counter += 1

        target_type = col.dominant_type if col.dominant_type else "string"
        return ColumnMappingDTO(
            source_column=col.original_name,
            normalized_column=norm_name,
            target_kind=MappingTargetKind.CUSTOM_ATTRIBUTE,
            target_field=target_key,
            target_type=target_type,
            confidence=round(max(0.60, col.type_confidence), 2),
            reason=MappingReason.CUSTOM_ATTRIBUTE_KEY,
            candidates=[],
            validation_notes=f"Preserved as dynamic custom attribute '{target_key}' with inferred type '{target_type}'.",
        )

    def _try_reuse_saved_profile(
        self,
        saved_profile: KnowledgeSchemaProfile,
        profile: DatasetProfileDTO,
        mapping_index: ColumnMappingIndex,
        category: str,
    ) -> Optional[CompiledMappingPlanDTO]:
        """Verify saved profile is not stale and compile plan if valid (Section 15 & 16)."""
        try:
            saved_mappings_raw = json.loads(saved_profile.mappings_json)
        except Exception:
            return None

        # Build lookup of saved mapping by normalized source field
        saved_map_dict: Dict[str, Dict[str, Any]] = {}
        for sm in saved_mappings_raw:
            src = sm.get("source_field") or sm.get("normalized_source_field") or sm.get("source_column")
            if src:
                clean_src = sanitize_attribute_key(src)
                saved_map_dict[clean_src] = sm

        compiled_cols: List[ColumnMappingDTO] = []
        is_stale = False

        for col in profile.columns:
            sm = saved_map_dict.get(col.normalized_name)
            if not sm:
                # Column structure has drifted from saved profile
                is_stale = True
                break

            target_kind_str = sm.get("target_kind", "").upper()
            target_field = sm.get("target_field") or sm.get("target")

            if target_kind_str == "CANONICAL" or target_kind_str == "CANONICAL_FIELD":
                if not target_field or target_field.lower() not in mapping_index.canonical_fields:
                    is_stale = True  # Canonical field was deprecated or deleted
                    break
                c_field = mapping_index.canonical_fields[target_field.lower()]
                compiled_cols.append(
                    ColumnMappingDTO(
                        source_column=col.original_name,
                        normalized_column=col.normalized_name,
                        target_kind=MappingTargetKind.CANONICAL_FIELD,
                        target_field=c_field.name,
                        target_type=c_field.field_type.value,
                        confidence=1.0,
                        reason=MappingReason.SAVED_PROFILE_REUSE,
                        is_required=c_field.is_required,
                        transformation_op=sm.get("transformation_op", "trim"),
                        validation_notes="Reused from approved schema profile.",
                    )
                )
            elif target_kind_str == "CUSTOM_ATTRIBUTE":
                if not target_field:
                    is_stale = True
                    break
                custom_def = mapping_index.custom_key_index.get(target_field.lower())
                c_key = custom_def.key if custom_def else target_field
                c_type = custom_def.value_type if custom_def else (sm.get("target_type") or "string")
                c_req = custom_def.is_required if custom_def else bool(sm.get("is_required", False))
                compiled_cols.append(
                    ColumnMappingDTO(
                        source_column=col.original_name,
                        normalized_column=col.normalized_name,
                        target_kind=MappingTargetKind.CUSTOM_ATTRIBUTE,
                        target_field=c_key,
                        target_type=c_type,
                        confidence=1.0,
                        reason=MappingReason.SAVED_PROFILE_REUSE,
                        is_required=c_req,
                        transformation_op=sm.get("transformation_op", "trim"),
                        validation_notes="Reused from approved schema profile.",
                    )
                )
            elif target_kind_str in ("UNMAPPED", "IGNORED"):
                compiled_cols.append(
                    ColumnMappingDTO(
                        source_column=col.original_name,
                        normalized_column=col.normalized_name,
                        target_kind=MappingTargetKind.IGNORED if target_kind_str == "IGNORED" else MappingTargetKind.UNMAPPED,
                        target_field=None,
                        target_type=None,
                        confidence=1.0,
                        reason=MappingReason.SAVED_PROFILE_REUSE,
                        validation_notes="Marked ignored/unmapped in approved profile.",
                    )
                )
            else:
                is_stale = True
                break

        if is_stale or len(compiled_cols) != len(profile.columns):
            logger.warning(
                "Saved schema profile is stale or does not match current columns; falling back to dynamic detection.",
                profile_id=saved_profile.id,
            )
            return None

        mapped_count = sum(
            1 for m in compiled_cols if m.target_kind in (MappingTargetKind.CANONICAL_FIELD, MappingTargetKind.CUSTOM_ATTRIBUTE)
        )
        return CompiledMappingPlanDTO(
            schema_fingerprint=profile.schema_fingerprint,
            category=category,
            is_reused_from_profile=True,
            profile_id=saved_profile.id,
            columns=compiled_cols,
            mapped_count=mapped_count,
            unmapped_count=sum(1 for m in compiled_cols if m.target_kind == MappingTargetKind.UNMAPPED),
            needs_review_count=0,
            total_columns=len(compiled_cols),
        )

    async def save_schema_profile(
        self,
        db: AsyncSession,
        tenant_id: str,
        category: str,
        profile: DatasetProfileDTO,
        plan: CompiledMappingPlanDTO,
        profile_name: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Optional[KnowledgeSchemaProfile]:
        """Persist a compiled mapping plan to KnowledgeSchemaProfile for O(1) instant reuse.
        
        Guarantees that subsequent imports with the same column headers and types
        require 0 LLM calls and 0 heuristic recalculations.
        """
        norm_category = normalize_category_key(category)

        # Check if already exists
        stmt = (
            select(KnowledgeSchemaProfile)
            .where(
                KnowledgeSchemaProfile.tenant_id == tenant_id,
                KnowledgeSchemaProfile.category == norm_category,
                KnowledgeSchemaProfile.fingerprint == profile.schema_fingerprint,
                KnowledgeSchemaProfile.is_active == True,
            )
            .order_by(KnowledgeSchemaProfile.version.desc())
            .limit(1)
        )
        res = await db.execute(stmt)
        existing = res.scalar_one_or_none()
        if existing:
            return existing

        mappings_list = [
            {
                "source_column": c.source_column,
                "normalized_column": c.normalized_column,
                "target_kind": c.target_kind.value,
                "target_field": c.target_field,
                "target_type": c.target_type,
                "confidence": c.confidence,
                "transformation_op": c.transformation_op,
            }
            for c in plan.columns
        ]

        new_profile = KnowledgeSchemaProfile(
            tenant_id=tenant_id,
            category=norm_category,
            fingerprint=profile.schema_fingerprint,
            name=profile_name or f"Approved Schema for {norm_category} ({profile.schema_fingerprint[:8]})",
            source_type="xlsx" if "xlsx" in str(getattr(profile, "source_type", "")).lower() else "csv",
            mappings_json=json.dumps(mappings_list),
            version=1,
            is_active=True,
            created_by_user_id=user_id,
        )
        db.add(new_profile)
        await db.flush()
        logger.info(
            "Persisted approved schema mapping profile",
            tenant_id=tenant_id,
            category=norm_category,
            fingerprint=profile.schema_fingerprint,
            profile_id=new_profile.id,
        )
        return new_profile


column_mapping_service = ColumnMappingService()
